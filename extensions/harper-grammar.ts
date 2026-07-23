// Live grammar checking of the chat input box, powered by Harper (harper-cli).
// Checks what you are ABOUT to send — the text in the input editor — not files.
// Works in Pi and OMP (Oh My Pi). Toggle with /grammar.

import { spawn } from "node:child_process";

// Minimal structural types for just the extension-API surface this file uses.
// Declaring them locally keeps the package harness-agnostic (Pi and OMP both
// provide a superset at runtime) and free of any type-only dependency.
type WidgetPlacement = "aboveEditor" | "belowEditor";
interface ExtensionUI {
  setWidget(key: string, content: string[] | undefined, options?: { placement?: WidgetPlacement }): void;
  getEditorText(): string;
  setEditorText(text: string): void;
  setStatus(key: string, text: string | undefined): void;
  notify(message: string, type?: "info" | "warning" | "error"): void;
}
interface ExtensionContext {
  hasUI: boolean;
  ui: ExtensionUI;
  setInterval(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}
type EventHandler = (event: unknown, ctx: ExtensionContext) => void | Promise<void>;
interface ExtensionAPI {
  setLabel(label: string): void;
  on(event: string, handler: EventHandler): void;
  registerCommand(
    name: string,
    def: { description: string; handler: (args: string, ctx: ExtensionContext) => void | Promise<void> },
  ): void;
  registerShortcut(
    shortcut: string,
    def: { description?: string; handler: (ctx: ExtensionContext) => void | Promise<void> },
  ): void;
}

const WIDGET_KEY = "harper-grammar";
const POLL_MS = 600; // editor is polled this often; a check fires once text is stable
const MAX_LINES = 8; // lint rows shown (widget hard-caps content at 10 lines total)
const BIN_CANDIDATES = [
  process.env.HARPER_CLI,
  "harper-cli",
  "/opt/homebrew/bin/harper-cli",
  "/usr/local/bin/harper-cli",
].filter((x): x is string => typeof x === "string" && x.length > 0);

interface HarperLint {
  matched_text: string;
  message: string;
  suggestions: string[];
  span?: { char_start: number; char_end: number };
}

function cleanSuggestion(s: string | undefined): string {
  if (!s) return "";
  // Harper phrases suggestions like: Replace with: “a”
  const m = s.match(/“([^”]+)”/);
  if (m) return m[1];
  return s.replace(/^\s*Replace with:\s*/i, "").trim();
}

// Pull the literal replacement out of a Harper suggestion ("Replace with: “X”").
// Returns null for non-replacement suggestions, which are left un-fixed.
function extractReplacement(suggestion: string | undefined): string | null {
  if (!suggestion) return null;
  const m = suggestion.match(/^Replace with:\s*“(.*)”$/s);
  return m ? m[1] : null;
}

// Apply Harper's replacement suggestions to `text`. Edits are applied
// right-to-left by span so earlier offsets stay valid; overlapping spans are skipped.
function fixText(text: string, lints: HarperLint[]): { fixed: string; applied: number } {
  const edits: { start: number; end: number; rep: string }[] = [];
  for (const l of lints) {
    const rep = extractReplacement(l.suggestions?.[0]);
    if (rep === null) continue;
    const start = l.span?.char_start;
    const end = l.span?.char_end;
    if (typeof start !== "number" || typeof end !== "number" || start < 0 || end > text.length || start >= end) {
      continue;
    }
    edits.push({ start, end, rep });
  }
  edits.sort((a, b) => b.start - a.start);
  let fixed = text;
  let applied = 0;
  let lastStart = Number.POSITIVE_INFINITY;
  for (const e of edits) {
    if (e.end <= lastStart) {
      fixed = fixed.slice(0, e.start) + e.rep + fixed.slice(e.end);
      lastStart = e.start;
      applied += 1;
    }
  }
  return { fixed, applied };
}

function runHarper(bin: string, text: string): Promise<{ lints: HarperLint[]; enoent: boolean }> {
  const { promise, resolve } = Promise.withResolvers<{ lints: HarperLint[]; enoent: boolean }>();
  let child;
  try {
    child = spawn(bin, ["lint", "--format", "json", "--quiet", "--no-color"], {
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch {
    resolve({ lints: [], enoent: true });
    return promise;
  }
  let out = "";
  let enoent = false;
  child.stdout?.on("data", (d) => {
    out += d.toString();
  });
  child.on("error", (err) => {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") enoent = true;
  });
  child.stdin?.on("error", () => {});
  child.on("close", () => {
    if (enoent) {
      resolve({ lints: [], enoent: true });
      return;
    }
    try {
      const parsed: unknown = JSON.parse(out);
      const lints = Array.isArray(parsed)
        ? parsed.flatMap((f) => (f && typeof f === "object" && "lints" in f && Array.isArray(f.lints) ? (f.lints as HarperLint[]) : []))
        : [];
      resolve({ lints, enoent: false });
    } catch {
      resolve({ lints: [], enoent: false });
    }
  });
  try {
    child.stdin?.end(text);
  } catch {
    resolve({ lints: [], enoent: false });
  }
  return promise;
}

function renderWidget(ctx: ExtensionContext, lints: HarperLint[]): void {
  if (lints.length === 0) {
    ctx.ui.setWidget(WIDGET_KEY, undefined);
    return;
  }
  const fixable = lints.some((l) => extractReplacement(l.suggestions?.[0]) !== null);
  const header = `⚠ Grammar: ${lints.length} issue${lints.length === 1 ? "" : "s"}${fixable ? "  ·  alt+g to fix" : ""}`;
  const lines: string[] = [header];
  for (const l of lints.slice(0, MAX_LINES)) {
    const fix = cleanSuggestion(l.suggestions?.[0]);
    const matched = (l.matched_text ?? "").replace(/\s+/g, " ").trim();
    const head = matched ? `"${matched}"${fix ? ` → ${fix}` : ""}` : fix;
    lines.push(`  • ${head}  —  ${l.message}`);
  }
  if (lints.length > MAX_LINES) lines.push(`  …and ${lints.length - MAX_LINES} more`);
  ctx.ui.setWidget(WIDGET_KEY, lines, { placement: "belowEditor" });
}

export default function harperGrammar(pi: ExtensionAPI): void {
  pi.setLabel("Grammar");

  let enabled = true;
  let bin: string | null = null; // resolved harper-cli path, or null before first probe
  let binIndex = 0;
  let missing = false; // harper-cli not found anywhere
  let lastSeen = ""; // text observed on the previous tick (typing-stability tracker)
  let lastChecked = ""; // text most recently sent to harper (dedupe)
  let running = false;
  let started = false; // guard against a second session_start registering a 2nd timer
  let lastLints: HarperLint[] = []; // full lint set from the most recent check (for fixing)
  let lastLintedText = ""; // the exact (trimmed) text those lints were computed against
  const STATUS_KEY = "harper-grammar-status";
  let appliedStatusText: string | null = null; // editor text when the apply-status was shown; cleared when it changes

  async function check(ctx: ExtensionContext, text: string): Promise<void> {
    running = true;
    try {
      // Try the candidate binaries in order until one is not ENOENT.
      while (binIndex < BIN_CANDIDATES.length) {
        const candidate = bin ?? BIN_CANDIDATES[binIndex];
        const { lints, enoent } = await runHarper(candidate, text);
        if (enoent) {
          binIndex += 1;
          bin = null;
          continue;
        }
        bin = candidate; // lock in the working binary
        lastChecked = text;
        lastLints = lints;
        lastLintedText = text;
        renderWidget(ctx, lints);
        return;
      }
      // Exhausted candidates: harper-cli is not installed.
      if (!missing) {
        missing = true;
        ctx.ui.setWidget(WIDGET_KEY, [
          "⚠ Grammar: harper-cli not found on PATH",
          "  install harper-cli — see https://writewithharper.com  (or set $HARPER_CLI)",
        ]);
      }
    } finally {
      running = false;
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return; // no editor to check in headless/print/subagent modes
    if (started) return;
    started = true;
    const timer = ctx.setInterval(() => {
      if (!enabled || running || missing) return;
      let text: string;
      try {
        text = (ctx.ui.getEditorText() ?? "").trim();
      } catch {
        return;
      }
      if (appliedStatusText !== null && text !== appliedStatusText) {
        ctx.ui.setStatus(STATUS_KEY, undefined); // clear the "applied fixes" note once you type something new
        appliedStatusText = null;
      }
      if (text === lastChecked) return; // already reflected in the widget
      if (text.length === 0 || text.startsWith("/")) {
        // Empty input or a slash command — clear any stale grammar widget.
        lastChecked = text;
        lastSeen = text;
        lastLints = [];
        lastLintedText = "";
        ctx.ui.setWidget(WIDGET_KEY, undefined);
        return;
      }
      if (text !== lastSeen) {
        // Still typing: wait for the text to be stable across one tick (debounce).
        lastSeen = text;
        return;
      }
      // Text is stable and differs from the last check → run Harper.
      void check(ctx, text);
    }, POLL_MS);
    pi.on("session_shutdown", () => {
      ctx.clearTimer(timer);
      started = false; // allow re-registration if the session restarts in-process
    });
  });

  pi.registerCommand("grammar", {
    description: "Toggle live grammar checking of the chat input",
    handler: async (_args, ctx) => {
      enabled = !enabled;
      if (!enabled) {
        ctx.ui.setWidget(WIDGET_KEY, undefined);
      } else {
        // Force a re-check of whatever is currently in the editor.
        lastChecked = "\u0000";
        lastSeen = "\u0000";
      }
      ctx.ui.notify(`Grammar checking ${enabled ? "on" : "off"}`, "info");
    },
  });

  function applyFixesNow(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;
    let raw: string;
    try {
      raw = ctx.ui.getEditorText() ?? "";
    } catch {
      return;
    }
    const text = raw.trim();
    // Only act on lints that match the text currently in the editor.
    if (text.length === 0 || text !== lastLintedText || lastLints.length === 0) {
      ctx.ui.setStatus(STATUS_KEY, "Grammar: nothing to fix");
      appliedStatusText = text;
      return;
    }
    const { fixed, applied } = fixText(text, lastLints);
    if (applied === 0) {
      ctx.ui.setStatus(STATUS_KEY, "Grammar: no auto-fixable issues");
      appliedStatusText = text;
      return;
    }
    ctx.ui.setEditorText(fixed);
    // Force the poll to re-check the corrected text and refresh the widget.
    lastChecked = "\u0000";
    lastSeen = "\u0000";
    lastLints = [];
    lastLintedText = "";
    ctx.ui.setStatus(STATUS_KEY, `Grammar: applied ${applied} fix${applied === 1 ? "" : "es"}`);
    appliedStatusText = fixed.trim();
  }

  pi.registerShortcut("alt+g", {
    description: "Apply grammar fixes to the chat input",
    handler: (ctx) => applyFixesNow(ctx),
  });
}
