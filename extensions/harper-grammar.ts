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
}

function cleanSuggestion(s: string | undefined): string {
  if (!s) return "";
  // Harper phrases suggestions like: Replace with: “a”
  const m = s.match(/“([^”]+)”/);
  if (m) return m[1];
  return s.replace(/^\s*Replace with:\s*/i, "").trim();
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
  const lines: string[] = [`⚠ Harper: ${lints.length} issue${lints.length === 1 ? "" : "s"}`];
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
  pi.setLabel("Harper grammar");

  let enabled = true;
  let bin: string | null = null; // resolved harper-cli path, or null before first probe
  let binIndex = 0;
  let missing = false; // harper-cli not found anywhere
  let lastSeen = ""; // text observed on the previous tick (typing-stability tracker)
  let lastChecked = ""; // text most recently sent to harper (dedupe)
  let running = false;
  let started = false; // guard against a second session_start registering a 2nd timer

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
        renderWidget(ctx, lints);
        return;
      }
      // Exhausted candidates: harper-cli is not installed.
      if (!missing) {
        missing = true;
        ctx.ui.setWidget(WIDGET_KEY, [
          "⚠ Harper: harper-cli not found on PATH",
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
      if (text === lastChecked) return; // already reflected in the widget
      if (text.length === 0 || text.startsWith("/")) {
        // Empty input or a slash command — clear any stale grammar widget.
        lastChecked = text;
        lastSeen = text;
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
    description: "Toggle live Harper grammar checking of the chat input",
    handler: async (_args, ctx) => {
      enabled = !enabled;
      if (!enabled) {
        ctx.ui.setWidget(WIDGET_KEY, undefined);
      } else {
        // Force a re-check of whatever is currently in the editor.
        lastChecked = "\u0000";
        lastSeen = "\u0000";
      }
      ctx.ui.notify(`Harper grammar checking ${enabled ? "on" : "off"}`, "info");
    },
  });
}
