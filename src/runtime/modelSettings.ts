import { randomBytes } from 'node:crypto';
import vscode from 'vscode';
import { t } from '../i18n';
import type { ThinkingOverride } from '../modelOverrides';
import type { CommandCodeChatProvider, EditableModelRow } from '../provider';

interface ModelRowDto {
	id: string;
	name: string;
	bundled: boolean;
	enabled: boolean;
	maxInputTokens: number;
	maxOutputTokens: number;
	imageInput: boolean;
	thinking: ThinkingOverride;
}

let currentPanel: ModelSettingsPanel | undefined;

export function registerModelSettings(
	context: vscode.ExtensionContext,
	provider: CommandCodeChatProvider,
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('commandcode-copilot.manageModels', () => {
			if (currentPanel) {
				currentPanel.reveal();
				return;
			}
			currentPanel = new ModelSettingsPanel(provider, () => {
				currentPanel = undefined;
			});
		}),
	);
}

class ModelSettingsPanel {
	private readonly panel: vscode.WebviewPanel;
	private readonly messageSubscription: vscode.Disposable;

	constructor(
		private readonly provider: CommandCodeChatProvider,
		onDispose: () => void,
	) {
		this.panel = vscode.window.createWebviewPanel(
			'commandcode-copilot.modelSettings',
			t('models.manage.title'),
			vscode.ViewColumn.Active,
			{ enableScripts: true },
		);

		this.panel.webview.html = renderHtml();
		this.messageSubscription = this.panel.webview.onDidReceiveMessage((message: unknown) => {
			void this.handleMessage(message);
		});
		this.panel.onDidDispose(() => {
			this.messageSubscription.dispose();
			onDispose();
		});
	}

	reveal(): void {
		this.panel.reveal();
		this.postRows();
	}

	private async handleMessage(message: unknown): Promise<void> {
		if (!isRecord(message)) {
			return;
		}

		try {
			if (message.type === 'ready') {
				this.postRows();
				return;
			}

			if (message.type === 'save') {
				const overrides = toOverrideMap(message.rows);
				if (!overrides) {
					return;
				}
				await this.provider.saveModelOverrides(overrides);
				this.postRows();
				await this.postStatus(t('models.manage.saved'));
				return;
			}

			if (message.type === 'reset') {
				await this.provider.saveModelOverrides({});
				this.postRows();
				await this.postStatus(t('models.manage.resetDone'));
				return;
			}

			if (message.type === 'refresh') {
				await this.provider.reloadModelCatalog();
				this.postRows();
				await this.postStatus(t('models.manage.refreshed'));
			}
		} catch (error) {
			await this.postStatus(error instanceof Error ? error.message : String(error), true);
		}
	}

	private postRows(): void {
		void this.panel.webview.postMessage({
			type: 'rows',
			rows: this.provider.getEditableModels().map(toDto),
		});
	}

	private async postStatus(message: string, isError = false): Promise<void> {
		await this.panel.webview.postMessage({ type: 'status', message, isError });
	}
}

function toDto(row: EditableModelRow): ModelRowDto {
	return {
		id: row.id,
		name: row.name,
		bundled: row.bundled,
		enabled: row.enabled,
		maxInputTokens: row.maxInputTokens,
		maxOutputTokens: row.maxOutputTokens,
		imageInput: row.imageInput,
		thinking: row.thinking,
	};
}

function toOverrideMap(rows: unknown): Record<string, unknown> | undefined {
	if (!Array.isArray(rows)) {
		return undefined;
	}

	const overrides: Record<string, unknown> = {};
	for (const row of rows) {
		if (!isRecord(row) || typeof row.id !== 'string' || !row.id) {
			continue;
		}
		overrides[row.id] = {
			enabled: row.enabled,
			maxInputTokens: row.maxInputTokens,
			maxOutputTokens: row.maxOutputTokens,
			imageInput: row.imageInput,
			thinking: row.thinking,
		};
	}
	return overrides;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function renderHtml(): string {
	const nonce = randomBytes(16).toString('base64');
	const labels = JSON.stringify({
		empty: t('models.manage.empty'),
		bundled: t('models.manage.bundled'),
		discovered: t('models.manage.discovered'),
		thinking: {
			inherit: t('models.manage.inherit'),
			none: t('models.manage.none'),
			low: t('thinking.low'),
			medium: t('thinking.medium'),
			high: t('thinking.high'),
		},
	});

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(t('models.manage.title'))}</title>
<style nonce="${nonce}">
	body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 16px 20px 40px; }
	h1 { font-size: 1.3em; margin: 0 0 8px; }
	p { color: var(--vscode-descriptionForeground); margin: 6px 0; max-width: 90ch; }
	.toolbar { display: flex; gap: 8px; margin: 16px 0; flex-wrap: wrap; }
	button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 14px; border-radius: 2px; cursor: pointer; }
	button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
	table { border-collapse: collapse; width: 100%; }
	th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border); vertical-align: middle; }
	th { font-weight: 600; font-size: 0.9em; color: var(--vscode-descriptionForeground); position: sticky; top: 0; background: var(--vscode-editor-background); }
	td code { display: block; font-size: 0.85em; color: var(--vscode-descriptionForeground); }
	input[type="number"] { width: 110px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); padding: 3px 6px; }
	select { background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border, transparent); padding: 3px 6px; }
	.badge { font-size: 0.8em; border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 1px 8px; color: var(--vscode-descriptionForeground); white-space: nowrap; }
	#status { min-height: 1.4em; margin-top: 12px; color: var(--vscode-descriptionForeground); }
	#status.error { color: var(--vscode-errorForeground); }
	tr.disabled td.name, tr.disabled td.id { opacity: 0.55; }
</style>
</head>
<body>
	<h1>${escapeHtml(t('models.manage.title'))}</h1>
	<p>${escapeHtml(t('models.manage.intro'))}</p>
	<p>${escapeHtml(t('models.manage.hint'))}</p>
	<div class="toolbar">
		<button id="save">${escapeHtml(t('models.manage.save'))}</button>
		<button id="refresh" class="secondary">${escapeHtml(t('models.manage.refresh'))}</button>
		<button id="reset" class="secondary">${escapeHtml(t('models.manage.reset'))}</button>
	</div>
	<table>
		<thead>
			<tr>
				<th>${escapeHtml(t('models.manage.enabled'))}</th>
				<th>${escapeHtml(t('models.manage.model'))}</th>
				<th>${escapeHtml(t('models.manage.source'))}</th>
				<th>${escapeHtml(t('models.manage.context'))}</th>
				<th>${escapeHtml(t('models.manage.output'))}</th>
				<th>${escapeHtml(t('models.manage.vision'))}</th>
				<th>${escapeHtml(t('models.manage.thinking'))}</th>
			</tr>
		</thead>
		<tbody id="rows"></tbody>
	</table>
	<div id="status" role="status"></div>
<script nonce="${nonce}">
	const vscode = acquireVsCodeApi();
	const labels = ${labels};
	const tbody = document.getElementById('rows');
	const status = document.getElementById('status');

	function cell(element) {
		const td = document.createElement('td');
		td.appendChild(element);
		return td;
	}

	function numberInput(value, className, min, max, step) {
		const input = document.createElement('input');
		input.type = 'number';
		input.min = String(min);
		input.max = String(max);
		input.step = String(step);
		input.value = String(value);
		input.className = className;
		return input;
	}

	function rowElement(model) {
		const tr = document.createElement('tr');
		tr.dataset.id = model.id;
		if (!model.enabled) {
			tr.classList.add('disabled');
		}

		const enabled = document.createElement('input');
		enabled.type = 'checkbox';
		enabled.className = 'enabled';
		enabled.checked = model.enabled;
		enabled.addEventListener('change', () => tr.classList.toggle('disabled', !enabled.checked));
		tr.appendChild(cell(enabled));

		const nameTd = document.createElement('td');
		nameTd.textContent = model.name;
		const idLine = document.createElement('code');
		idLine.textContent = model.id;
		nameTd.appendChild(idLine);
		tr.appendChild(nameTd);

		const sourceTd = document.createElement('td');
		const badge = document.createElement('span');
		badge.className = 'badge';
		badge.textContent = model.bundled ? labels.bundled : labels.discovered;
		sourceTd.appendChild(badge);
		tr.appendChild(sourceTd);

		tr.appendChild(cell(numberInput(model.maxInputTokens, 'context-size', 1000, 10000000, 1000)));
		tr.appendChild(cell(numberInput(model.maxOutputTokens, 'output-size', 1, 1000000, 1)));

		const vision = document.createElement('input');
		vision.type = 'checkbox';
		vision.className = 'vision';
		vision.checked = model.imageInput;
		tr.appendChild(cell(vision));

		const select = document.createElement('select');
		select.className = 'thinking';
		for (const value of ['inherit', 'none', 'low', 'medium', 'high']) {
			const option = document.createElement('option');
			option.value = value;
			option.textContent = labels.thinking[value];
			select.appendChild(option);
		}
		select.value = model.thinking;
		tr.appendChild(cell(select));

		return tr;
	}

	function render(rows) {
		tbody.textContent = '';
		if (rows.length === 0) {
			const tr = document.createElement('tr');
			const td = document.createElement('td');
			td.colSpan = 7;
			td.textContent = labels.empty;
			tr.appendChild(td);
			tbody.appendChild(tr);
			return;
		}
		for (const model of rows) {
			tbody.appendChild(rowElement(model));
		}
	}

	function setStatus(message, isError) {
		status.textContent = message;
		status.classList.toggle('error', Boolean(isError));
	}

	function collectRows() {
		return Array.from(tbody.querySelectorAll('tr[data-id]')).map((tr) => ({
			id: tr.dataset.id,
			enabled: tr.querySelector('.enabled').checked,
			maxInputTokens: Number(tr.querySelector('.context-size').value),
			maxOutputTokens: Number(tr.querySelector('.output-size').value),
			imageInput: tr.querySelector('.vision').checked,
			thinking: tr.querySelector('.thinking').value,
		}));
	}

	document.getElementById('save').addEventListener('click', () => {
		vscode.postMessage({ type: 'save', rows: collectRows() });
	});
	document.getElementById('refresh').addEventListener('click', () => {
		setStatus('', false);
		vscode.postMessage({ type: 'refresh' });
	});
	document.getElementById('reset').addEventListener('click', () => {
		vscode.postMessage({ type: 'reset' });
	});

	window.addEventListener('message', (event) => {
		const message = event.data;
		if (message.type === 'rows') {
			render(message.rows);
		} else if (message.type === 'status') {
			setStatus(message.message, message.isError);
		}
	});

	vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
