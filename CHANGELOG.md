# Changelog

## Unreleased

### Features

- Validate the bundled model list against Command Code's public model catalog; fall back to the bundled list when it is unreachable.
- Add **Command Code Go: Model Settings**, a webview for editing each model's input context, output limit, vision support, thinking default, and visibility. Models discovered in the catalog are added with 1,000,000 input tokens and vision enabled.
- Respect the smaller of the global `maxTokens` setting and the model's advertised output limit.

### Build

- Replace Bun-based scripts with npm scripts; add `package-lock.json`.

### License

- Relicense the project to AGPL-3.0-or-later. The upstream MIT license text and copyright notices are preserved in `LICENSE-MIT`.

## 0.1.1 (2026-08-19)

### Features

- Added `Qwen/Qwen3.8-27B` to the model catalog (262K context, vision, reasoning).

## 0.1.0 (2026-08-17)

### Features

- Initial release — Command Code Go for VS Code.
- Pulls live model list from `GET /provider/v1/models` and exposes them in the Copilot Chat model picker.
- Streaming Chat Completions over the OpenAI-compatible `/provider/v1/chat/completions` endpoint.
- BYOK API key stored in VS Code SecretStorage.
- Per-model thinking effort selector (`none`, `low`, `medium`, `high`).
- Vision-capable models receive image parts natively (no proxy required).
- Optional zero-data-retention header (`x-cmdc-zdr: 1`).
