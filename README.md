# pi-harper-grammar

[![CI](https://github.com/LoneExile/pi-harper-grammar/actions/workflows/ci.yml/badge.svg)](https://github.com/LoneExile/pi-harper-grammar/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/pi-harper-grammar.svg)](https://www.npmjs.com/package/pi-harper-grammar)
[![npm downloads](https://img.shields.io/npm/dm/pi-harper-grammar.svg)](https://www.npmjs.com/package/pi-harper-grammar)
[![license](https://img.shields.io/npm/l/pi-harper-grammar.svg)](./LICENSE)

Live grammar checking of the **chat input box** in [Pi](https://pi.dev) and
[OMP (Oh My Pi)](https://omp.sh), powered by [Harper](https://writewithharper.com).

It lints what you are **about to send** — the text in the input editor — and
shows issues (with fixes) in a widget just below the editor. It does **not**
read or check your project files, and it never sends anything to the model to
do the check: everything runs locally through `harper-cli`.

![pi-harper-grammar demo](https://github.com/LoneExile/pi-harper-grammar/releases/download/v0.1.1/demo.gif)

## Prerequisite: Harper

This extension shells out to the `harper-cli` binary. Install it first:

- **macOS:** `brew install harper`
- **Cargo:** `cargo install harper-cli`
- **Other:** see <https://writewithharper.com> / the
  [releases](https://github.com/Automattic/harper/releases)

`harper-cli` must be on your `PATH` (or point `$HARPER_CLI` at it). If it's
missing, the extension shows a one-line install hint instead of failing
silently.

## Install

```bash
# Pi
pi install npm:pi-harper-grammar

# OMP (Oh My Pi)
omp plugin install npm:pi-harper-grammar
```

Or straight from git without npm:

```bash
pi install git:github.com/LoneExile/pi-harper-grammar
```

Restart the agent (or open a new session) after installing.

## Usage

Just type. As soon as your input is stable for a moment, Harper checks it and
lists any issues below the editor. The widget clears when the input is empty,
corrected, or a slash command.

- **`/grammar`** — toggle the live checker on/off.

## Configuration

- **`$HARPER_CLI`** — absolute path to the `harper-cli` binary, if it isn't on
  `PATH`.
- **User dictionary** — Harper reads a per-user dictionary (one word per line).
  Its default location is printed by `harper-cli lint --help`
  (`--user-dict-path`). Add terms there to stop them being flagged.

Tunables live at the top of `extensions/harper-grammar.ts`:

- `POLL_MS` — how often the editor is polled (debounce cadence).
- `MAX_LINES` — how many issues are shown at once.

## How it works

There is no per-keystroke editor event, so the extension polls
`ctx.ui.getEditorText()` on a timer and runs `harper-cli` once the text has
been stable across a tick (a lightweight debounce). Results are parsed from
`harper-cli lint --format json` and rendered via `ctx.ui.setWidget(...)` in a
`belowEditor` widget. Warm `harper-cli` runs in well under a second, and a
check only fires when the text actually changes.

This checks **your** input before you send it. It does not grammar-check the
assistant's replies.

## License

MIT — see [LICENSE](./LICENSE).
