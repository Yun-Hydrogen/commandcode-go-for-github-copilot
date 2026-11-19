import vscode from 'vscode';
import { AuthManager } from '../auth';
import { CUSTOM_MODELS_KEY, MODEL_OVERRIDES_KEY, VENDOR_ID } from '../consts';
import { CustomModelDefinition, sanitizeCustomModels } from '../customModels';
import { t } from '../i18n';
import { logger } from '../logger';
import { sanitizeModelOverrides, type ModelOverrideMap } from '../modelOverrides';
import { createDefaultModelDefinition } from '../models';
import { fetchAccountQuota, type AccountQuotaResult } from '../client';
import type { ModelDefinition } from '../types';
import { buildModelRows, enabledDefinitions, type EditableModelRow } from './modelCatalog';
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
	private customModels: CustomModelDefinition[];

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
		this.customModels = sanitizeCustomModels(context.globalState.get(CUSTOM_MODELS_KEY));

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

	async getAccountQuota(): Promise<AccountQuotaResult> {
		const key = await this.authManager.getApiKey();
		if (!key) {
			return {
				success: false,
				error: t('auth.notConfigured'),
			};
		}
		return fetchAccountQuota(key);
	}

	/** Every known model, including custom and disabled ones, for the Model Settings GUI. */
	getEditableModels(): EditableModelRow[] {
		return buildModelRows(this.remoteModels.getCachedIds(), this.customModels, this.overrides);
	}

	/** Persist overrides edited in the GUI and refresh the picker. */
	async saveModelOverrides(value: unknown): Promise<void> {
		this.overrides = sanitizeModelOverrides(value);
		await this.globalState.update(MODEL_OVERRIDES_KEY, this.overrides);
		this.onDidChangeLanguageModelChatInformationEmitter.fire();
	}

	/** Get current custom models list. */
	getCustomModels(): readonly CustomModelDefinition[] {
		return this.customModels;
	}

	/** Save custom models list. */
	async saveCustomModels(value: unknown): Promise<void> {
		this.customModels = sanitizeCustomModels(value);
		await this.globalState.update(CUSTOM_MODELS_KEY, this.customModels);
		this.onDidChangeLanguageModelChatInformationEmitter.fire();
	}

	/** Add or update a custom model. */
	async addCustomModel(model: unknown): Promise<boolean> {
		const sanitized = sanitizeCustomModels([model]);
		if (sanitized.length === 0) {
			return false;
		}
		const newModel = sanitized[0]!;
		const filtered = this.customModels.filter((m) => m.id !== newModel.id);
		filtered.push(newModel);
		this.customModels = filtered;
		await this.globalState.update(CUSTOM_MODELS_KEY, this.customModels);
		this.onDidChangeLanguageModelChatInformationEmitter.fire();
		return true;
	}

	/** Delete a custom model by id. */
	async deleteCustomModel(id: string): Promise<boolean> {
		const initialCount = this.customModels.length;
		this.customModels = this.customModels.filter((m) => m.id !== id);
		if (this.customModels.length !== initialCount) {
			await this.globalState.update(CUSTOM_MODELS_KEY, this.customModels);
			// Also clean up any override for this model
			if (this.overrides[id]) {
				delete this.overrides[id];
				await this.globalState.update(MODEL_OVERRIDES_KEY, this.overrides);
			}
			this.onDidChangeLanguageModelChatInformationEmitter.fire();
			return true;
		}
		return false;
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
	 * catalog.
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
	 * The models the picker should show: custom models, catalog models, plus overrides,
	 * minus disabled entries.
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
		const modelDefinition =
			this.getDefinitions().find((m) => m.id === modelInfo.id) ??
			createDefaultModelDefinition(modelInfo.id, modelInfo.name);

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
