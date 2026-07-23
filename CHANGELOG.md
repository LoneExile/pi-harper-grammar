# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/LoneExile/pi-harper-grammar/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/LoneExile/pi-harper-grammar/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/LoneExile/pi-harper-grammar/releases/tag/v0.1.0
