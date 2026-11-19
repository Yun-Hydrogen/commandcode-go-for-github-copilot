import { randomBytes } from 'node:crypto';
import vscode from 'vscode';
import { EXTERNAL_URLS } from '../consts';
import { t } from '../i18n';
import type { ThinkingOverride } from '../modelOverrides';
import type { CommandCodeChatProvider, EditableModelRow } from '../provider';

interface ModelRowDto {
	id: string;
	name: string;
	isCustom: boolean;
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
			currentPanel = new ModelSettingsPanel(context, provider, () => {
				currentPanel = undefined;
			});
		}),
	);
}

class ModelSettingsPanel {
	private readonly panel: vscode.WebviewPanel;
	private readonly messageSubscription: vscode.Disposable;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly provider: CommandCodeChatProvider,
		onDispose: () => void,
	) {
		this.panel = vscode.window.createWebviewPanel(
			'commandcode-copilot.modelSettings',
			t('models.manage.title'),
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'resources')],
			},
		);

		this.panel.webview.html = this.renderHtml();
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
		void this.fetchAndPostQuota();
	}

	private async handleMessage(message: unknown): Promise<void> {
		if (!isRecord(message)) {
			return;
		}

		try {
			if (message.type === 'ready') {
				this.postRows();
				void this.fetchAndPostQuota();
				return;
			}

			if (message.type === 'getQuota' || message.type === 'refreshQuota') {
				await this.fetchAndPostQuota();
				return;
			}

			if (message.type === 'openUrl') {
				if (typeof message.url === 'string' && message.url) {
					await vscode.env.openExternal(vscode.Uri.parse(message.url));
				}
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
				return;
			}

			if (message.type === 'addCustomModel') {
				const added = await this.provider.addCustomModel(message.model);
				if (added) {
					this.postRows();
					await this.postStatus(t('models.manage.added'));
				} else {
					await this.postStatus(t('models.manage.idRequired'), true);
				}
				return;
			}

			if (message.type === 'deleteCustomModel') {
				if (typeof message.id === 'string' && message.id) {
					const deleted = await this.provider.deleteCustomModel(message.id);
					if (deleted) {
						this.postRows();
						await this.postStatus(t('models.manage.deleted'));
					}
				}
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

	private async fetchAndPostQuota(): Promise<void> {
		try {
			const quota = await this.provider.getAccountQuota();
			void this.panel.webview.postMessage({ type: 'quota', data: quota });
		} catch (error) {
			void this.panel.webview.postMessage({
				type: 'quota',
				data: {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				},
			});
		}
	}

	private async postStatus(message: string, isError = false): Promise<void> {
		await this.panel.webview.postMessage({ type: 'status', message, isError });
	}

	private renderHtml(): string {
		const nonce = randomBytes(16).toString('base64');
		const webview = this.panel.webview;

		const vueUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'webview', 'vue.global.prod.js'),
		);
		const rizUiUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'webview', 'riz-ui.umd.cjs'),
		);

		const labels = JSON.stringify({
			title: t('models.manage.title'),
			intro: t('models.manage.intro'),
			hint: t('models.manage.hint'),
			empty: t('models.manage.empty'),
			save: t('models.manage.save'),
			reset: t('models.manage.reset'),
			refresh: t('models.manage.refresh'),
			add: t('models.manage.add'),
			addCustom: t('models.manage.addCustom'),
			delete: t('models.manage.delete'),
			modelId: t('models.manage.modelId'),
			modelIdPlaceholder: t('models.manage.modelIdPlaceholder'),
			modelName: t('models.manage.modelName'),
			modelNamePlaceholder: t('models.manage.modelNamePlaceholder'),
			search: t('models.manage.search'),
			cancel: t('models.manage.cancel'),
			confirm: t('models.manage.confirm'),
			idRequired: t('models.manage.idRequired'),
			customModelsSection: t('models.manage.customModelsSection'),
			catalogModelsSection: t('models.manage.catalogModelsSection'),
			custom: t('models.manage.custom'),
			catalog: t('models.manage.catalog'),
			context: t('models.manage.context'),
			output: t('models.manage.output'),
			vision: t('models.manage.vision'),
			thinking: t('models.manage.thinking'),
			enabled: t('models.manage.enabled'),
			thinkingOptions: {
				inherit: t('models.manage.inherit'),
				none: t('models.manage.none'),
				low: t('thinking.low'),
				medium: t('thinking.medium'),
				high: t('thinking.high'),
			},
			quotaTitle: t('quota.title'),
			quotaIntro: t('quota.intro'),
			quotaRefresh: t('quota.refresh'),
			quotaRefreshing: t('quota.refreshing'),
			quotaPlan: t('quota.plan'),
			quotaStatus: t('quota.status'),
			quotaCredits: t('quota.credits'),
			quotaMonthlyCredits: t('quota.monthlyCredits'),
			quotaPurchasedCredits: t('quota.purchasedCredits'),
			quotaFreeCredits: t('quota.freeCredits'),
			quotaRolling5h: t('quota.rolling5h'),
			quotaRollingWeekly: t('quota.rollingWeekly'),
			quotaCost: t('quota.cost'),
			quotaRequests: t('quota.requests'),
			quotaTokens: t('quota.tokens'),
			quotaUpdatedAt: t('quota.updatedAt'),
			quotaOpenStudio: t('quota.openStudio'),
			quotaNoKey: t('quota.noKey'),
			quotaUsed: t('quota.used'),
			quotaCap: t('quota.cap'),
			quotaResetAt: t('quota.resetAt'),
			studioUrl: EXTERNAL_URLS.commandcode.studio,
		});

		return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; font-src data: ${webview.cspSource}; script-src 'nonce-${nonce}' 'unsafe-eval' ${webview.cspSource}; img-src data: ${webview.cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(t('models.manage.title'))}</title>
<style>
	:root {
		--rz-theme-color: #39c5bb;
	}
	body {
		font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
		color: var(--vscode-foreground);
		background-color: var(--vscode-editor-background);
		padding: 20px 24px 60px;
		margin: 0;
		box-sizing: border-box;
	}
	.header-card {
		margin-bottom: 20px;
	}
	.toolbar {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 14px;
	}
	.search-box {
		flex: 1;
		min-width: 220px;
	}
	.section-title {
		font-size: 1.15em;
		font-weight: 600;
		margin: 28px 0 12px;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.section-badge {
		font-size: 0.75em;
		padding: 2px 8px;
		border-radius: 12px;
		background: var(--vscode-badge-background);
		color: var(--vscode-badge-foreground);
		font-weight: normal;
	}
	.model-table {
		width: 100%;
		border-collapse: collapse;
		background: var(--vscode-editor-background);
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2));
		margin-bottom: 24px;
	}
	.model-table th, .model-table td {
		padding: 10px 12px;
		text-align: left;
		border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2));
		vertical-align: middle;
	}
	.model-table th {
		background: var(--vscode-sideBar-background, rgba(128, 128, 128, 0.08));
		font-weight: 600;
		font-size: 0.88em;
		color: var(--vscode-descriptionForeground);
	}
	.model-table tr:last-child td {
		border-bottom: none;
	}
	.model-table tr.disabled-row {
		opacity: 0.55;
	}
	.model-name {
		font-weight: 500;
	}
	.model-id {
		font-family: var(--vscode-editor-font-family, monospace);
		font-size: 0.82em;
		color: var(--vscode-descriptionForeground);
		display: block;
		margin-top: 2px;
	}
	.badge-tag {
		display: inline-block;
		font-size: 0.75em;
		padding: 1px 7px;
		border-radius: 4px;
		background: rgba(57, 197, 187, 0.15);
		color: #39c5bb;
		font-weight: 500;
	}
	.badge-catalog {
		background: rgba(128, 128, 128, 0.15);
		color: var(--vscode-descriptionForeground);
	}
	.token-input {
		width: 110px;
	}
	.dialog-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 8px 0;
	}
	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 20px;
	}
	.quota-card {
		margin-top: 16px;
		margin-bottom: 30px;
	}
	.quota-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 16px;
		margin-top: 14px;
	}
	.quota-stat-box {
		background: var(--vscode-sideBar-background, rgba(128, 128, 128, 0.08));
		border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2));
		border-radius: 8px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.quota-stat-label {
		font-size: 0.82em;
		color: var(--vscode-descriptionForeground);
		font-weight: 500;
	}
	.quota-stat-value {
		font-size: 1.5em;
		font-weight: 600;
		color: #39c5bb;
	}
	.quota-stat-sub {
		font-size: 0.78em;
		color: var(--vscode-descriptionForeground);
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: 2px;
	}
	.quota-progress-container {
		margin-top: 8px;
	}
	.quota-progress-meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.82em;
		margin-bottom: 6px;
		color: var(--vscode-descriptionForeground);
	}
	.quota-actions {
		display: flex;
		gap: 10px;
		align-items: center;
		justify-content: space-between;
		margin-top: 18px;
		padding-top: 14px;
		border-top: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.15));
		flex-wrap: wrap;
	}
	.quota-updated {
		font-size: 0.8em;
		color: var(--vscode-descriptionForeground);
	}
</style>
<script nonce="${nonce}">
	window.addEventListener('error', function(e) {
		console.error('Webview error:', e.error || e.message);
		var container = document.getElementById('runtime-error-boundary');
		if (!container) {
			container = document.createElement('div');
			container.id = 'runtime-error-boundary';
			container.style.cssText = 'padding: 12px 16px; margin: 16px; background: rgba(244,63,94,0.1); border: 1px solid #f43f5e; color: #f43f5e; border-radius: 6px; font-family: monospace; white-space: pre-wrap; font-size: 13px;';
			document.body ? document.body.prepend(container) : document.documentElement.appendChild(container);
		}
		container.textContent = 'Webview Error: ' + (e.error ? (e.error.stack || e.error.message) : e.message);
	});
</script>
<script nonce="${nonce}" src="${vueUri}"></script>
<script nonce="${nonce}" src="${rizUiUri}"></script>
</head>
<body>
<div id="app">
	<rizui_card class="header-card" :title="labels.title" :desc="labels.intro">
		<div class="toolbar">
			<div class="search-box">
				<rizui_text
					v-model="searchQuery"
					:placeholder="labels.search"
					color="#39c5bb"
				></rizui_text>
			</div>
			<rizui_button primary :text="labels.addCustom" color="#39c5bb" @click="openAddDialog"></rizui_button>
			<rizui_button :text="labels.save" color="#39c5bb" @click="saveAll"></rizui_button>
			<rizui_button :text="labels.refresh" @click="refreshCatalog"></rizui_button>
			<rizui_button danger :text="labels.reset" @click="resetOverrides"></rizui_button>
		</div>
	</rizui_card>

	<!-- Custom Models Section -->
	<div class="section-title">
		<span>{{ labels.customModelsSection }}</span>
		<span class="section-badge">{{ filteredCustomModels.length }}</span>
	</div>

	<div v-if="filteredCustomModels.length === 0">
		<rizui_infobox
			type="info"
			text="暂无自定义模型。点击上方「添加自定义模型」按钮，即可添加任意兼容的自定义模型或私有模型。"
		></rizui_infobox>
	</div>
	<table v-else class="model-table">
		<thead>
			<tr>
				<th style="width: 50px;">{{ labels.enabled }}</th>
				<th>{{ labels.modelName }} / ID</th>
				<th style="width: 130px;">{{ labels.context }}</th>
				<th style="width: 130px;">{{ labels.output }}</th>
				<th style="width: 80px;">{{ labels.vision }}</th>
				<th style="width: 140px;">{{ labels.thinking }}</th>
				<th style="width: 80px;">操作</th>
			</tr>
		</thead>
		<tbody>
			<tr v-for="model in filteredCustomModels" :key="model.id" :class="{ 'disabled-row': !model.enabled }">
				<td>
					<rizui_switch v-model="model.enabled" color="#39c5bb"></rizui_switch>
				</td>
				<td>
					<span class="model-name">{{ model.name }}</span>
					<span class="badge-tag" style="margin-left: 6px;">{{ labels.custom }}</span>
					<code class="model-id">{{ model.id }}</code>
				</td>
				<td>
					<rizui_text
						class="token-input"
						type="number"
						v-model.number="model.maxInputTokens"
						color="#39c5bb"
					></rizui_text>
				</td>
				<td>
					<rizui_text
						class="token-input"
						type="number"
						v-model.number="model.maxOutputTokens"
						color="#39c5bb"
					></rizui_text>
				</td>
				<td>
					<rizui_checkbox v-model="model.imageInput" color="#39c5bb"></rizui_checkbox>
				</td>
				<td>
					<rizui_dropdown
						v-model="model.thinking"
						:options="thinkingDropdownOptions"
						color="#39c5bb"
					></rizui_dropdown>
				</td>
				<td>
					<rizui_button danger :text="labels.delete" @click="deleteCustomModel(model.id)"></rizui_button>
				</td>
			</tr>
		</tbody>
	</table>

	<!-- Catalog Models Section -->
	<div class="section-title">
		<span>{{ labels.catalogModelsSection }}</span>
		<span class="section-badge">{{ filteredCatalogModels.length }}</span>
	</div>

	<div v-if="filteredCatalogModels.length === 0">
		<rizui_infobox
			type="info"
			:text="labels.empty"
		></rizui_infobox>
	</div>
	<table v-else class="model-table">
		<thead>
			<tr>
				<th style="width: 50px;">{{ labels.enabled }}</th>
				<th>{{ labels.modelName }} / ID</th>
				<th style="width: 130px;">{{ labels.context }}</th>
				<th style="width: 130px;">{{ labels.output }}</th>
				<th style="width: 80px;">{{ labels.vision }}</th>
				<th style="width: 140px;">{{ labels.thinking }}</th>
			</tr>
		</thead>
		<tbody>
			<tr v-for="model in filteredCatalogModels" :key="model.id" :class="{ 'disabled-row': !model.enabled }">
				<td>
					<rizui_switch v-model="model.enabled" color="#39c5bb"></rizui_switch>
				</td>
				<td>
					<span class="model-name">{{ model.name }}</span>
					<span class="badge-tag badge-catalog" style="margin-left: 6px;">{{ labels.catalog }}</span>
					<code class="model-id">{{ model.id }}</code>
				</td>
				<td>
					<rizui_text
						class="token-input"
						type="number"
						v-model.number="model.maxInputTokens"
						color="#39c5bb"
					></rizui_text>
				</td>
				<td>
					<rizui_text
						class="token-input"
						type="number"
						v-model.number="model.maxOutputTokens"
						color="#39c5bb"
					></rizui_text>
				</td>
				<td>
					<rizui_checkbox v-model="model.imageInput" color="#39c5bb"></rizui_checkbox>
				</td>
				<td>
					<rizui_dropdown
						v-model="model.thinking"
						:options="thinkingDropdownOptions"
						color="#39c5bb"
					></rizui_dropdown>
				</td>
			</tr>
		</tbody>
	</table>

	<!-- Quota & Usage Section -->
	<div class="section-title">
		<span>{{ labels.quotaTitle }}</span>
	</div>

	<rizui_card class="quota-card" :title="labels.quotaTitle" :desc="labels.quotaIntro">
		<div v-if="quotaLoading" style="padding: 16px 0; text-align: center; color: var(--vscode-descriptionForeground);">
			{{ labels.quotaRefreshing }}
		</div>
		<div v-else-if="quotaError">
			<rizui_infobox type="warning" :text="quotaError"></rizui_infobox>
			<div class="quota-actions" style="margin-top: 14px; border-top: none; padding-top: 0;">
				<rizui_button primary :text="labels.quotaRefresh" color="#39c5bb" @click="fetchQuota"></rizui_button>
				<rizui_button :text="labels.quotaOpenStudio" @click="openStudio"></rizui_button>
			</div>
		</div>
		<div v-else-if="quotaData">
			<div class="quota-grid">
				<!-- Stat 1: Plan & Usage Overview -->
				<div class="quota-stat-box">
					<div class="quota-stat-label">{{ labels.quotaPlan }}</div>
					<div class="quota-stat-value" style="font-size: 1.25em;">
						{{ quotaData.plan || 'Command Code Plan' }}
						<span v-if="quotaData.status" class="badge-tag" style="font-size: 0.65em; vertical-align: middle; margin-left: 6px;">{{ quotaData.status }}</span>
					</div>
					<div class="quota-stat-sub">
						<span v-if="quotaData.totalCost !== undefined">{{ labels.quotaCost }}: \${{ quotaData.totalCost }}</span>
						<span v-if="quotaData.requestCount !== undefined">{{ labels.quotaRequests }}: {{ quotaData.requestCount }}</span>
						<span v-if="quotaData.tokenCount !== undefined">{{ labels.quotaTokens }}: {{ quotaData.tokenCount }}</span>
					</div>
				</div>

				<!-- Stat 2: Total Credits -->
				<div class="quota-stat-box">
					<div class="quota-stat-label">{{ labels.quotaCredits }}</div>
					<div class="quota-stat-value">
						{{ quotaData.totalRemainingCredits !== undefined ? quotaData.totalRemainingCredits : (quotaData.monthlyCredits ?? '—') }}
					</div>
					<div class="quota-stat-sub">
						<span v-if="quotaData.monthlyCredits !== undefined">{{ labels.quotaMonthlyCredits }}: {{ quotaData.monthlyCredits }}</span>
						<span v-if="quotaData.purchasedCredits !== undefined">{{ labels.quotaPurchasedCredits }}: {{ quotaData.purchasedCredits }}</span>
						<span v-if="quotaData.freeCredits !== undefined">{{ labels.quotaFreeCredits }}: {{ quotaData.freeCredits }}</span>
					</div>
				</div>

				<!-- Stat 3: 5-Hour Window -->
				<div v-if="quotaData.fiveHour" class="quota-stat-box" style="grid-column: 1 / -1;">
					<div class="quota-stat-label">{{ labels.quotaRolling5h }}</div>
					<div class="quota-progress-container">
						<div class="quota-progress-meta">
							<span>{{ labels.quotaUsed }}: {{ quotaData.fiveHour.used }} / {{ quotaData.fiveHour.cap }}</span>
							<span>{{ quotaData.fiveHour.percent }}%</span>
						</div>
						<rizui_progress :value="quotaData.fiveHour.percent" :max="100" :color="getProgressColor(quotaData.fiveHour.percent)"></rizui_progress>
					</div>
					<div v-if="quotaData.fiveHour.resetAt" class="quota-stat-sub" style="margin-top: 6px;">
						{{ labels.quotaResetAt }}: {{ formatTime(quotaData.fiveHour.resetAt) }}
					</div>
				</div>

				<!-- Stat 4: Weekly Window -->
				<div v-if="quotaData.weekly" class="quota-stat-box" style="grid-column: 1 / -1;">
					<div class="quota-stat-label">{{ labels.quotaRollingWeekly }}</div>
					<div class="quota-progress-container">
						<div class="quota-progress-meta">
							<span>{{ labels.quotaUsed }}: {{ quotaData.weekly.used }} / {{ quotaData.weekly.cap }}</span>
							<span>{{ quotaData.weekly.percent }}%</span>
						</div>
						<rizui_progress :value="quotaData.weekly.percent" :max="100" :color="getProgressColor(quotaData.weekly.percent)"></rizui_progress>
					</div>
					<div v-if="quotaData.weekly.resetAt" class="quota-stat-sub" style="margin-top: 6px;">
						{{ labels.quotaResetAt }}: {{ formatTime(quotaData.weekly.resetAt) }}
					</div>
				</div>
			</div>

			<div class="quota-actions">
				<div class="quota-updated">
					<span v-if="quotaData.updatedAt">{{ labels.quotaUpdatedAt }}: {{ quotaData.updatedAt }}</span>
				</div>
				<div style="display: flex; gap: 8px;">
					<rizui_button primary :text="labels.quotaRefresh" color="#39c5bb" @click="fetchQuota"></rizui_button>
					<rizui_button :text="labels.quotaOpenStudio" @click="openStudio"></rizui_button>
				</div>
			</div>
		</div>
		<div v-else style="padding: 12px 0;">
			<rizui_button primary :text="labels.quotaRefresh" color="#39c5bb" @click="fetchQuota"></rizui_button>
		</div>
	</rizui_card>

	<!-- Add Custom Model Dialog -->
	<rizui_dialog
		:show="showAddDialog"
		:title="labels.addCustom"
		color="#39c5bb"
		width="560px"
		closable
		mask-close
		@close="showAddDialog = false"
		@update:show="showAddDialog = $event"
	>
		<div class="dialog-form">
			<rizui_cfgrow :label="labels.modelId" hint="模型唯一标识 Slug (必填)">
				<rizui_text
					v-model="newModel.id"
					:placeholder="labels.modelIdPlaceholder"
					color="#39c5bb"
				></rizui_text>
			</rizui_cfgrow>
			<rizui_cfgrow :label="labels.modelName" hint="Copilot Chat 中展示的名称">
				<rizui_text
					v-model="newModel.name"
					:placeholder="labels.modelNamePlaceholder"
					color="#39c5bb"
				></rizui_text>
			</rizui_cfgrow>
			<rizui_cfgrow :label="labels.context" hint="最大输入 Token 数量">
				<rizui_text
					type="number"
					v-model.number="newModel.maxInputTokens"
					color="#39c5bb"
				></rizui_text>
			</rizui_cfgrow>
			<rizui_cfgrow :label="labels.output" hint="最大输出 Token 数量">
				<rizui_text
					type="number"
					v-model.number="newModel.maxOutputTokens"
					color="#39c5bb"
				></rizui_text>
			</rizui_cfgrow>
			<rizui_cfgrow :label="labels.vision" hint="是否支持多模态图像识别">
				<rizui_switch v-model="newModel.imageInput" color="#39c5bb"></rizui_switch>
			</rizui_cfgrow>
			<rizui_cfgrow :label="labels.thinking" hint="模型默认思考推理强度">
				<rizui_dropdown
					v-model="newModel.thinking"
					:options="thinkingDropdownOptions"
					color="#39c5bb"
				></rizui_dropdown>
			</rizui_cfgrow>
		</div>
		<template #footer>
			<div class="dialog-actions">
				<rizui_button :text="labels.cancel" @click="showAddDialog = false"></rizui_button>
				<rizui_button primary :text="labels.confirm" color="#39c5bb" @click="submitAddCustomModel"></rizui_button>
			</div>
		</template>
	</rizui_dialog>

	<!-- Toast Message -->
	<rizui_toast
		v-if="toast.show"
		:type="toast.isError ? 'error' : 'info'"
		:title="toast.message"
		:countdown="3"
		color="#39c5bb"
		@close="toast.show = false"
	></rizui_toast>
</div>

<script nonce="${nonce}">
	const vscode = acquireVsCodeApi();
	const labels = ${labels};

	const { createApp, ref, computed, onMounted } = Vue;

	const app = createApp({
		setup() {
			const rows = ref([]);
			const searchQuery = ref('');
			const showAddDialog = ref(false);

			const quotaData = ref(null);
			const quotaLoading = ref(false);
			const quotaError = ref('');

			const newModel = ref({
				id: '',
				name: '',
				maxInputTokens: 1000000,
				maxOutputTokens: 32000,
				imageInput: true,
				thinking: 'inherit'
			});

			const toast = ref({
				show: false,
				message: '',
				isError: false
			});

			const thinkingDropdownOptions = [
				{ value: 'inherit', label: labels.thinkingOptions.inherit },
				{ value: 'none', label: labels.thinkingOptions.none },
				{ value: 'low', label: labels.thinkingOptions.low },
				{ value: 'medium', label: labels.thinkingOptions.medium },
				{ value: 'high', label: labels.thinkingOptions.high }
			];

			const filteredCustomModels = computed(() => {
				const query = searchQuery.value.trim().toLowerCase();
				return rows.value.filter(m => m.isCustom && (!query || m.id.toLowerCase().includes(query) || m.name.toLowerCase().includes(query)));
			});

			const filteredCatalogModels = computed(() => {
				const query = searchQuery.value.trim().toLowerCase();
				return rows.value.filter(m => !m.isCustom && (!query || m.id.toLowerCase().includes(query) || m.name.toLowerCase().includes(query)));
			});

			function showToast(message, isError = false) {
				toast.value = {
					show: true,
					message,
					isError
				};
			}

			function fetchQuota() {
				quotaLoading.value = true;
				quotaError.value = '';
				vscode.postMessage({ type: 'getQuota' });
			}

			function openStudio() {
				vscode.postMessage({ type: 'openUrl', url: labels.studioUrl });
			}

			function getProgressColor(percent) {
				if (percent >= 90) return '#f43f5e';
				if (percent >= 75) return '#fbbf24';
				return '#39c5bb';
			}

			function formatTime(val) {
				if (!val) return '';
				try {
					const date = new Date(val);
					if (isNaN(date.getTime())) return String(val);
					return date.toLocaleString();
				} catch {
					return String(val);
				}
			}

			function openAddDialog() {
				newModel.value = {
					id: '',
					name: '',
					maxInputTokens: 1000000,
					maxOutputTokens: 32000,
					imageInput: true,
					thinking: 'inherit'
				};
				showAddDialog.value = true;
			}

			function submitAddCustomModel() {
				if (!newModel.value.id || !newModel.value.id.trim()) {
					showToast(labels.idRequired, true);
					return;
				}
				vscode.postMessage({
					type: 'addCustomModel',
					model: {
						id: newModel.value.id.trim(),
						name: newModel.value.name ? newModel.value.name.trim() : newModel.value.id.trim(),
						maxInputTokens: Number(newModel.value.maxInputTokens) || 1000000,
						maxOutputTokens: Number(newModel.value.maxOutputTokens) || 32000,
						imageInput: Boolean(newModel.value.imageInput),
						thinking: newModel.value.thinking
					}
				});
				showAddDialog.value = false;
			}

			function deleteCustomModel(id) {
				vscode.postMessage({
					type: 'deleteCustomModel',
					id
				});
			}

			function saveAll() {
				vscode.postMessage({
					type: 'save',
					rows: rows.value.map(m => ({
						id: m.id,
						enabled: m.enabled,
						maxInputTokens: m.maxInputTokens,
						maxOutputTokens: m.maxOutputTokens,
						imageInput: m.imageInput,
						thinking: m.thinking
					}))
				});
			}

			function refreshCatalog() {
				showToast('正在从云端刷新模型目录...', false);
				vscode.postMessage({ type: 'refresh' });
			}

			function resetOverrides() {
				vscode.postMessage({ type: 'reset' });
			}

			onMounted(() => {
				window.addEventListener('message', (event) => {
					const data = event.data;
					if (data.type === 'rows') {
						rows.value = data.rows || [];
					} else if (data.type === 'status') {
						showToast(data.message, data.isError);
					} else if (data.type === 'quota') {
						quotaLoading.value = false;
						if (data.data && data.data.success) {
							quotaData.value = data.data;
							quotaError.value = '';
						} else {
							quotaError.value = (data.data && data.data.error) || '获取额度失败';
						}
					}
				});

				vscode.postMessage({ type: 'ready' });
			});

			return {
				labels,
				rows,
				searchQuery,
				showAddDialog,
				newModel,
				toast,
				quotaData,
				quotaLoading,
				quotaError,
				thinkingDropdownOptions,
				filteredCustomModels,
				filteredCatalogModels,
				openAddDialog,
				submitAddCustomModel,
				deleteCustomModel,
				saveAll,
				refreshCatalog,
				resetOverrides,
				fetchQuota,
				openStudio,
				getProgressColor,
				formatTime
			};
		}
	});

	if (window.RizUI) {
		for (const [key, comp] of Object.entries(window.RizUI)) {
			if (typeof comp === 'object' && comp !== null) {
				app.component(key, comp);
			}
		}
	}

	app.mount('#app');
</script>
</body>
</html>`;
	}
}

function toDto(row: EditableModelRow): ModelRowDto {
	return {
		id: row.id,
		name: row.name,
		isCustom: row.isCustom,
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

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
