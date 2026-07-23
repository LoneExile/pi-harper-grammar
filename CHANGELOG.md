# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.2] - 2026-07-23

### Fixed

- Show a description under the plugin in `omp plugin list` (OMP reads it from an
  `omp` manifest key, not the top-level npm `description`).

## [0.2.1] - 2026-07-23

### Fixed

- The "applied N fixes" / "nothing to fix" confirmation now clears as soon as you
  type something new, instead of lingering. Uses a clearable status message.

## [0.2.0] - 2026-07-23

### Added

- Apply Harper's suggested fixes to the current chat input in place, via the
  `alt+g` hotkey or the `/grammar-fix` command. Fixes are applied right-to-left
  by span; only concrete "replace" suggestions are applied (lints without a
  replacement are left for manual editing). The widget shows an `alt+g to fix`
  hint only when at least one issue is auto-fixable.

## [0.1.3] - 2026-07-23

### Fixed

- Suggestions containing an apostrophe are no longer truncated (e.g. `don't` was
  shown as `don`). The parser now matches Harper's curly quotes only.

### Changed

- Hardening: swallow `stdin` pipe errors on the harper-cli subprocess, and guard
  `session_start` against registering a duplicate poll timer (reset on shutdown).

## [0.1.2] - 2026-07-23

### Added

- Demo video/GIF preview for the pi.dev package gallery (`pi.video` / `pi.image`
  manifest fields) and an embedded demo GIF in the README. Recording is
  reproducible via `assets/demo.tape` (VHS).

## [0.1.1] - 2026-07-23

### Added

- Ship `CHANGELOG.md` inside the published npm tarball.

### Changed

- Repository tooling: CI typecheck workflow, tokenless (OIDC) npm release
  workflow with provenance, and Renovate for dependency updates. No runtime
  behavior change.

## [0.1.0] - 2026-07-23

### Added

- Live grammar checking of the Pi/OMP chat input box, powered by Harper
  (`harper-cli`). Lints the text you are about to send — not files — and shows
  issues with fixes in a widget below the editor.
- `/grammar` command to toggle the checker on and off.
- `$HARPER_CLI` override and a one-line install hint when `harper-cli` is not
  found on `PATH`.

[Unreleased]: https://github.com/LoneExile/pi-harper-grammar/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/LoneExile/pi-harper-grammar/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/LoneExile/pi-harper-grammar/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/LoneExile/pi-harper-grammar/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/LoneExile/pi-harper-grammar/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/LoneExile/pi-harper-grammar/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/LoneExile/pi-harper-grammar/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/LoneExile/pi-harper-grammar/releases/tag/v0.1.0
