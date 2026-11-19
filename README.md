# CommandCode-Copilot Bridger

Use models from [Command Code](https://commandcode.ai) directly in GitHub Copilot Chat for VS Code. Supports cloud catalog synchronization, custom user-added models, vision, thinking mode, agent tools, and BYOK.

Maintained by [Yun_Hydrogen](https://github.com/Yun-Hydrogen).

## What it provides

- Command Code Go models in Copilot Chat's model picker
- Copilot agent mode, tools, MCP servers, instructions, and skills
- Streaming text and reasoning responses
- Image input where the selected Go model supports it
- API-token storage through VS Code SecretStorage

The canonical model list and availability are maintained by Command Code. See the [Go-plan model list](https://commandcode.ai/docs/plans/go#models) rather than relying on a static list in this README.

### Model catalog

The extension ships a static allowlist of Go-plan models. On startup it also validates that allowlist against Command Code's public model catalog (`GET https://api.commandcode.ai/provider/v1/models`, no authentication), and hides entries the service no longer advertises. Models that the catalog lists but the extension does not ship are added with **1,000,000 input tokens, 32,000 output tokens, and vision enabled**. If the request fails, times out, or returns no matching models, the bundled list is used unchanged, so the picker never empties because of a network problem. Results are cached for 10 minutes (2 minutes after a failure) and re-fetched by **Command Code Go: Refresh Models**.

## Setup

### 1. Install Command Code and sign in

Install the CLI globally:

```bash
npm install --global command-code@latest
```

Start the browser-based login flow:

```bash
command-code login
```

Complete the authorization flow and retrieve the API token created for your Command Code account. If the CLI does not print it, copy it from `~/.commandcode/auth.json` or from Command Code Studio's API Keys page. Keep the token private.

### 2. Add the token to VS Code

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run **Command Code Go: Set API Key**.
3. Paste the token and confirm.

The extension stores it in VS Code SecretStorage and does not write it to the repository.

### 3. Choose a model

Open Copilot Chat, choose a Command Code model, and start chatting. The model list is limited to the current [Command Code Go plan](https://commandcode.ai/docs/plans/go).

## Requirements

- VS Code 1.116 or newer
- GitHub Copilot Chat
- An active Command Code Go plan
- Node.js (only needed to install and authenticate the Command Code CLI)

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `commandcode-copilot.maxTokens` | `0` | Output-token cap; `0` uses the model's advertised limit. The smaller of this value and the model limit is sent. |
| `commandcode-copilot.zdr` | `false` | Request zero-data-retention routing when available. |
| `commandcode-copilot.apiKey` | unset | Optional fallback token source; SecretStorage takes precedence. |
| `commandcode-copilot.debugMode` | `minimal` | Control diagnostic logging in the Command Code output channel. |

The extension uses the Command Code Generate API and its required protocol headers. Its workspace and Git context are collected from the current VS Code workspace for each request.

## Model settings

Run **Command Code Go: Model Settings** to open a table of every known model: bundled entries plus anything discovered in the catalog. Each row can override:

- input context window (`maxInputTokens`)
- output token cap (`maxOutputTokens`)
- vision support
- thinking default (`Default`, `Off`, `Light`, `Standard`, `Deep`)
- whether the model appears in the picker at all

Overrides are stored in VS Code `globalState` (not in `settings.json`), apply immediately to Copilot Chat's model picker, and can be cleared with **Reset all overrides**. **Refresh catalog** re-fetches the remote list without reloading the window.

## Development

```bash
npm install
npm run compile   # clean + tsc
npm run lint
npm run package   # builds dist/commandcode-copilot-bridger.vsix
```

## Problems or missing models

If a model is not available in the extension, or a supported request fails, please create an issue with the model name and the relevant output-channel error. Never include your API token.

## Attribution

This project is maintained and published by [Yun_Hydrogen](https://github.com/Yun-Hydrogen), based on the work by Ho Trung Nhan and the original [Command Code Copilot Provider](https://github.com/Tyrannmisu/commandcode-copilot-provider) by Tyrannmisu.

The original work was released under the MIT License. Those terms still apply to the upstream code: the full MIT text and its copyright notices are preserved in [LICENSE-MIT](LICENSE-MIT), alongside the AGPL license that now covers this project as a whole.

## License

[AGPL-3.0-or-later](LICENSE).

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but **without any warranty**; without even the implied warranty of merchantability or fitness for a particular purpose. See the GNU Affero General Public License for more details.
