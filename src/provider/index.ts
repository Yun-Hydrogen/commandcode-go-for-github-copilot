import vscode from 'vscode';
import { AuthManager } from '../auth';
import { MODEL_OVERRIDES_KEY, VENDOR_ID } from '../consts';
import { t } from '../i18n';
import { logger } from '../logger';
import {
	sanitizeModelOverrides,
	type ModelOverrideMap,
} from '../modelOverrides';
import type { ModelDefinition } from '../types';
import {
	buildModelRows,
	enabledDefinitions,
	type EditableModelRow,
} from './modelCatalog';
import { toChatInfo } from './models';
import { RemoteModelCatalog } from './remoteModels';
import { prepareChatRequest } from './request';
import { streamChatCompletion } from './stream';
import { estimateTokenCount } from './tokens';

/**
 * Command Code Go Chat Provider — implements `vscode.LanguageModelChatProvider`
 * so Command Code Go models appear directly in the Copilot Chat
 * model picker.
 */
export class CommandCodeChatProvider implements vscode.LanguageModelChatProvider {
	private readonly authManager: AuthManager;
	private readonly globalState: vscode.Memento;
	private readonly onDidChangeLanguageModelChatInformationEmitter = new vscode.EventEmitter<void>();
	private isActive = true;
	private readonly remoteModels = new RemoteModelCatalog();
	private overrides: ModelOverrideMap;

	readonly onDidChangeLanguageModelChatInformation =
		this.onDidChangeLanguageModelChatInformationEmitter.event;

	/**
	 * Adaptive chars-per-token ratio, calibrated from real usage data via an
	 * exponential moving average each time the API reports token counts.
	 */
	private charsPerToken = 4.0;

	constructor(context: vscode.ExtensionContext) {
		this.authManager = new AuthManager(context);
		this.globalState = context.globalState;
		this.overrides = sanitizeModelOverrides(context.globalState.get(MODEL_OVERRIDES_KEY));

		context.subscriptions.push(
			this.onDidChangeLanguageModelChatInformationEmitter,
			// The API key may be stored in settings or SecretStorage.
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (e.affectsConfiguration('commandcode-copilot.apiKey')) {
					this.refreshModelPicker();
				}
			}),
			// Multi-window: SecretStorage changes don't fire onDidChangeConfiguration.
			context.secrets.onDidChange((e) => {
				if (e.key === 'commandcode-copilot.apiKey') {
					this.refreshModelPicker();
				}
			}),
		);
	}

	// ---- Public commands ----

	async configureApiKey(): Promise<void> {
		const saved = await this.authManager.promptForApiKey();
		if (saved) {
			this.refreshModelPicker();
		}
	}

	async clearApiKey(): Promise<void> {
		await this.authManager.deleteApiKey();
		this.refreshModelPicker();
		vscode.window.showInformationMessage(t('auth.removed'));
	}

	async hasApiKey(): Promise<boolean> {
		return this.authManager.hasApiKey();
	}

	/** Every known model, including disabled ones, for the Model Settings GUI. */
	getEditableModels(): EditableModelRow[] {
		return buildModelRows(this.remoteModels.getCachedIds(), this.overrides);
	}

	/** Persist overrides edited in the GUI and refresh the picker. */
	async saveModelOverrides(value: unknown): Promise<void> {
		this.overrides = sanitizeModelOverrides(value);
		await this.globalState.update(MODEL_OVERRIDES_KEY, this.overrides);
		this.onDidChangeLanguageModelChatInformationEmitter.fire();
	}

	/** Re-fetch the remote catalog and return the refreshed rows. */
	async reloadModelCatalog(): Promise<EditableModelRow[]> {
		this.remoteModels.invalidate();
		await this.remoteModels.getAvailableIds();
		this.onDidChangeLanguageModelChatInformationEmitter.fire();
		return this.getEditableModels();
	}

	/**
	 * Force Copilot Chat to re-query model information and re-validate the
	 * catalog. The fetch runs in the background: the picker is refreshed
	 * immediately from the cached or bundled list, then refreshed again once
	 * the catalog confirms which models still exist.
	 */
	refreshModelPicker(): void {
		this.remoteModels.invalidate();
		void this.remoteModels.getAvailableIds().then((ids) => {
			if (ids) {
				this.onDidChangeLanguageModelChatInformationEmitter.fire();
			}
		});
		this.onDidChangeLanguageModelChatInformationEmitter.fire();
	}

	async prepareForDeactivate(): Promise<void> {
		this.isActive = false;
		this.onDidChangeLanguageModelChatInformationEmitter.fire();

		// Trigger one final sync pull so the picker drops our entries immediately
		// instead of waiting for the host to invalidate its cache. With
		// `isActive = false` we return [], which makes Copilot Chat drop
		// Command Code Go models from the picker immediately on deactivate.
		try {
			await vscode.lm.selectChatModels({ vendor: VENDOR_ID });
		} catch (error) {
			logger.warn('Failed to refresh Command Code models during deactivate', error);
		}
	}

	// ---- LanguageModelChatProvider ----

	async provideLanguageModelChatInformation(
		_options: vscode.PrepareLanguageModelChatModelOptions,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelChatInformation[]> {
		if (!this.isActive) {
			return [];
		}

		const hasKey = await this.authManager.hasApiKey();
		return this.getDefinitions().map((m) => toChatInfo(m, hasKey));
	}

	/**
	 * The models the picker should show: bundled entries still present in the
	 * catalog (or all of them when the catalog is unavailable), catalog-only
	 * entries with their defaults, plus the user's overrides, minus disabled
	 * entries.
	 */
	private getDefinitions(): readonly ModelDefinition[] {
		return enabledDefinitions(this.getEditableModels());
	}

	async provideLanguageModelChatResponse(
		modelInfo: vscode.LanguageModelChatInformation,
		messages: readonly vscode.LanguageModelChatRequestMessage[],
		options: vscode.ProvideLanguageModelChatResponseOptions,
		progress: vscode.Progress<vscode.LanguageModelResponsePart>,
		token: vscode.CancellationToken,
	): Promise<void> {
		const modelDefinition = this.getDefinitions().find((m) => m.id === modelInfo.id);

		const prepared = await prepareChatRequest({
			authManager: this.authManager,
			modelInfo,
			modelDefinition,
			messages,
			options,
		});

		return streamChatCompletion({
			prepared,
			progress,
			token,
			getCharsPerToken: () => this.charsPerToken,
			setCharsPerToken: (charsPerToken) => {
				this.charsPerToken = charsPerToken;
			},
		});
	}

	async provideTokenCount(
		_modelInfo: vscode.LanguageModelChatInformation,
		text: string | vscode.LanguageModelChatRequestMessage,
		_token: vscode.CancellationToken,
	): Promise<number> {
		return estimateTokenCount(text, this.charsPerToken);
	}
}

export type { EditableModelRow } from './modelCatalog';
export { VENDOR_ID as PROVIDER_VENDOR };
