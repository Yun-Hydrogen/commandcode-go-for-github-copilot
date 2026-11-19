import vscode from 'vscode';
import type { AccountQuotaResult } from '../client';
import { EXTERNAL_URLS } from '../consts';
import { t } from '../i18n';
import { logger } from '../logger';
import type { CommandCodeChatProvider } from '../provider';

interface ActionQuickPickItem extends vscode.QuickPickItem {
	action: 'refreshQuota' | 'refreshModels' | 'openSettings' | 'setApiKey' | 'openStudio';
}

function formatCredits(val: number | undefined): string {
	if (val === undefined || Number.isNaN(val)) {
		return '0';
	}
	// If integer, show integer, else 2 decimals
	return Number.isInteger(val) ? String(val) : val.toFixed(2);
}

function formatTime(val: string | undefined): string {
	if (!val) {
		return '';
	}
	try {
		const date = new Date(val);
		if (Number.isNaN(date.getTime())) {
			return String(val);
		}
		return date.toLocaleString();
	} catch {
		return String(val);
	}
}

export function registerStatusBar(
	context: vscode.ExtensionContext,
	provider: CommandCodeChatProvider,
): vscode.Disposable {
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.name = 'CommandCode Quota';
	statusBarItem.command = 'commandcode-copilot.statusBarMenu';

	let currentQuota: AccountQuotaResult | undefined;

	function updateDisplay(quota?: AccountQuotaResult, loading = false, errorMessage?: string): void {
		if (loading) {
			statusBarItem.text = `$(sync~spin) CC: ${t('statusBar.refreshing')}`;
			statusBarItem.tooltip = t('statusBar.refreshing');
			statusBarItem.backgroundColor = undefined;
			return;
		}

		if (errorMessage) {
			statusBarItem.text = `$(warning) CC: ${t('statusBar.error')}`;
			statusBarItem.tooltip = errorMessage;
			statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
			return;
		}

		if (!quota || !quota.success) {
			statusBarItem.text = `$(key) CC: ${t('statusBar.noKey')}`;
			statusBarItem.tooltip = t('statusBar.noKeyTooltip');
			statusBarItem.backgroundColor = undefined;
			return;
		}

		// Calculate remaining credits
		const totalCredits = quota.totalRemainingCredits ?? quota.monthlyCredits ?? 0;
		const creditsStr = `${formatCredits(totalCredits)} Cr`;

		// Status text with rolling 5h window if available
		if (quota.fiveHour) {
			statusBarItem.text = `$(dashboard) CC: ${creditsStr} (${quota.fiveHour.percent}%)`;
		} else {
			statusBarItem.text = `$(dashboard) CC: ${creditsStr}`;
		}

		// Warning color if 5-hour limit usage is high
		if (quota.fiveHour && quota.fiveHour.percent >= 90) {
			statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
		} else if (quota.fiveHour && quota.fiveHour.percent >= 75) {
			statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
		} else {
			statusBarItem.backgroundColor = undefined;
		}

		// Rich markdown tooltip on hover
		const md = new vscode.MarkdownString('', true);
		md.isTrusted = true;
		md.supportThemeIcons = true;
		md.appendMarkdown('### $(organization) CommandCode Copilot Bridger\n\n');

		if (quota.plan) {
			md.appendMarkdown(
				`**${t('quota.plan')}**: \`${quota.plan}\`${quota.status ? ` (${quota.status})` : ''}\n\n`,
			);
		}
		md.appendMarkdown('---\n\n');

		md.appendMarkdown(`- **${t('quota.credits')}**: **${formatCredits(totalCredits)}** Credits\n`);
		if (quota.monthlyCredits !== undefined) {
			md.appendMarkdown(
				`  - ${t('quota.monthlyCredits')}: ${formatCredits(quota.monthlyCredits)}\n`,
			);
		}
		if (quota.purchasedCredits !== undefined && quota.purchasedCredits > 0) {
			md.appendMarkdown(
				`  - ${t('quota.purchasedCredits')}: ${formatCredits(quota.purchasedCredits)}\n`,
			);
		}
		if (quota.freeCredits !== undefined && quota.freeCredits > 0) {
			md.appendMarkdown(`  - ${t('quota.freeCredits')}: ${formatCredits(quota.freeCredits)}\n`);
		}

		if (quota.fiveHour) {
			md.appendMarkdown(
				`- **${t('quota.rolling5h')}**: **${quota.fiveHour.used} / ${quota.fiveHour.cap}** (${quota.fiveHour.percent}%)\n`,
			);
			if (quota.fiveHour.resetAt) {
				md.appendMarkdown(`  - ${t('quota.resetAt')}: ${formatTime(quota.fiveHour.resetAt)}\n`);
			}
		}

		if (quota.weekly) {
			md.appendMarkdown(
				`- **${t('quota.rollingWeekly')}**: **${quota.weekly.used} / ${quota.weekly.cap}** (${quota.weekly.percent}%)\n`,
			);
			if (quota.weekly.resetAt) {
				md.appendMarkdown(`  - ${t('quota.resetAt')}: ${formatTime(quota.weekly.resetAt)}\n`);
			}
		}

		if (quota.totalCost !== undefined || quota.requestCount !== undefined) {
			md.appendMarkdown('\n---\n\n');
			if (quota.totalCost !== undefined) {
				md.appendMarkdown(`- ${t('quota.cost')}: \`$${quota.totalCost}\`\n`);
			}
			if (quota.requestCount !== undefined) {
				md.appendMarkdown(`- ${t('quota.requests')}: \`${quota.requestCount}\`\n`);
			}
			if (quota.tokenCount !== undefined) {
				md.appendMarkdown(`- ${t('quota.tokens')}: \`${quota.tokenCount}\`\n`);
			}
		}

		md.appendMarkdown('\n---\n\n');
		if (quota.updatedAt) {
			md.appendMarkdown(`*${t('quota.updatedAt')}: ${quota.updatedAt}*\n\n`);
		}
		md.appendMarkdown(`*$(zap) ${t('statusBar.menu.clickToRefresh')}*`);

		statusBarItem.tooltip = md;
	}

	async function fetchQuota(notify = false): Promise<void> {
		const hasKey = await provider.hasApiKey();
		if (!hasKey) {
			currentQuota = undefined;
			updateDisplay(undefined, false);
			return;
		}

		updateDisplay(currentQuota, true);
		try {
			const res = await provider.getAccountQuota();
			if (res.success) {
				currentQuota = res;
				updateDisplay(res, false);
				if (notify) {
					vscode.window.showInformationMessage(t('quota.refreshedNotification'));
				}
			} else {
				updateDisplay(currentQuota, false, res.error);
				if (notify && res.error) {
					vscode.window.showWarningMessage(res.error);
				}
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			updateDisplay(currentQuota, false, msg);
			logger.warn('Failed to refresh status bar quota', err);
		}
	}

	async function showQuickActionsMenu(): Promise<void> {
		const quotaText = currentQuota?.success
			? `${formatCredits(currentQuota.totalRemainingCredits ?? currentQuota.monthlyCredits ?? 0)} Cr` +
				(currentQuota.fiveHour ? ` | 5h: ${currentQuota.fiveHour.percent}%` : '')
			: (await provider.hasApiKey())
				? t('statusBar.error')
				: t('statusBar.noKey');

		const items: ActionQuickPickItem[] = [
			{
				label: `$(dashboard) ${t('statusBar.menu.quotaSummary')}: ${quotaText}`,
				description: currentQuota?.plan ? `套餐: ${currentQuota.plan}` : undefined,
				detail: `${t('statusBar.menu.clickToRefresh')} (${currentQuota?.updatedAt || '—'})`,
				action: 'refreshQuota',
			},
			{
				label: `$(sync) ${t('statusBar.menu.refreshModels')}`,
				description: t('statusBar.menu.refreshModelsDesc'),
				action: 'refreshModels',
			},
			{
				label: `$(gear) ${t('statusBar.menu.openSettings')}`,
				description: t('statusBar.menu.openSettingsDesc'),
				action: 'openSettings',
			},
			{
				label: `$(key) ${t('statusBar.menu.setApiKey')}`,
				description: t('statusBar.menu.setApiKeyDesc'),
				action: 'setApiKey',
			},
			{
				label: `$(refresh) ${t('statusBar.menu.refreshQuota')}`,
				description: t('statusBar.menu.refreshQuotaDesc'),
				action: 'refreshQuota',
			},
			{
				label: `$(link-external) ${t('statusBar.menu.openStudio')}`,
				description: t('statusBar.menu.openStudioDesc'),
				action: 'openStudio',
			},
		];

		const selected = await vscode.window.showQuickPick(items, {
			title: t('statusBar.menu.title'),
			placeHolder: '选择要执行的 CommandCode 操作...',
		});

		if (!selected) {
			return;
		}

		switch (selected.action) {
			case 'refreshQuota':
				void fetchQuota(true);
				break;
			case 'refreshModels':
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: t('models.refreshInProgress'),
					},
					async () => {
						const rows = await provider.reloadModelCatalog();
						vscode.window.showInformationMessage(t('models.refreshSucceeded', rows.length));
					},
				);
				break;
			case 'openSettings':
				await vscode.commands.executeCommand('commandcode-copilot.manageModels');
				break;
			case 'setApiKey':
				await provider.configureApiKey();
				void fetchQuota(false);
				break;
			case 'openStudio':
				await vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.commandcode.studio));
				break;
			default:
				break;
		}
	}

	// Register commands
	const menuCommand = vscode.commands.registerCommand(
		'commandcode-copilot.statusBarMenu',
		() => void showQuickActionsMenu(),
	);
	const refreshCommand = vscode.commands.registerCommand(
		'commandcode-copilot.refreshQuota',
		() => void fetchQuota(true),
	);

	// Watch for API key changes to auto-refresh
	const secretsSub = context.secrets.onDidChange((e) => {
		if (e.key === 'commandcode-copilot.apiKey') {
			void fetchQuota(false);
		}
	});

	const configSub = vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration('commandcode-copilot.apiKey')) {
			void fetchQuota(false);
		}
	});

	// Poll every 10 minutes
	const intervalId = setInterval(
		() => {
			void fetchQuota(false);
		},
		10 * 60 * 1000,
	);

	// Initial fetch & show
	statusBarItem.show();
	void fetchQuota(false);

	return vscode.Disposable.from(statusBarItem, menuCommand, refreshCommand, secretsSub, configSub, {
		dispose: () => clearInterval(intervalId),
	});
}
