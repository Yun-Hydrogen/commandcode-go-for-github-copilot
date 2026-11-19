import vscode from 'vscode';

/**
 * Lightweight i18n module — zero dependencies, follows VS Code display language.
 *
 *  - en / en-US / en-*      → English (default)
 *  - zh-cn                  → Simplified Chinese
 *  - all other locales      → English until translated
 */

function isZh(): boolean {
	const lang = vscode.env.language.toLowerCase();
	return lang === 'zh-cn';
}

// ---- Translation dictionaries ----

type Translations = Record<string, string>;

const zh: Translations = {
	// Auth
	'auth.apiKeyRequiredDetail': '请先配置 API Key',
	'auth.prompt': '请输入 Command Code API Key。',
	'auth.placeholder': 'cmd-... 或服务商令牌',
	'auth.emptyValidation': 'API Key 不能为空',
	'auth.saved': 'API Key 已安全保存。',
	'auth.removed': 'API Key 已移除。',
	'auth.notConfigured': 'API Key 未配置，请在命令面板运行 "Command Code Go: 设置 API Key"。',

	// Thinking Effort — short labels for model picker dropdown
	'status.thinking': '思考模式',
	'thinking.none': '停用',
	'thinking.none.desc': '停用思考，响应更快',
	'thinking.low': '轻量',
	'thinking.low.desc': '轻量推理，适合快速编辑和简单任务',
	'thinking.medium': '标准',
	'thinking.medium.desc': '推荐日常使用',
	'thinking.high': '深度',
	'thinking.high.desc': '深度推理，适合复杂任务',

	// Models
	'models.refreshInProgress': '正在刷新模型列表...',
	'models.refreshSucceeded': '已从 Command Code 拉取 {0} 个模型。',
	'models.refreshFailed': '拉取模型列表失败：{0}',
	'models.empty': '没有可用的模型。请检查 API Key，或调整模型黑名单设置。',
	'models.fetchRequiresKey': '需要先配置 API Key 才能拉取模型列表。',
	'models.manage.title': 'Command Code Go: 模型设置',
	'models.manage.intro':
		'调整 Command Code 模型在 Copilot Chat 选择器中的表现。从目录发现的模型默认使用 1,000,000 输入 token 并支持视觉，可在下方修改或停用。',
	'models.manage.hint': '修改会全局保存，并立即应用到模型选择器。',
	'models.manage.save': '保存',
	'models.manage.reset': '重置所有覆盖项',
	'models.manage.refresh': '刷新目录',
	'models.manage.saved': '模型设置已保存。',
	'models.manage.resetDone': '已清除模型覆盖项。',
	'models.manage.refreshed': '模型目录已刷新。',
	'models.manage.empty': '暂无模型，请尝试刷新目录。',
	'models.manage.enabled': '启用',
	'models.manage.model': '模型',
	'models.manage.source': '来源',
	'models.manage.bundled': '内置',
	'models.manage.discovered': '官方目录',
	'models.manage.custom': '自定义',
	'models.manage.catalog': '官方目录',
	'models.manage.add': '添加模型',
	'models.manage.addCustom': '添加自定义模型',
	'models.manage.delete': '删除',
	'models.manage.modelId': '模型 ID',
	'models.manage.modelIdPlaceholder': '例如: anthropic/claude-3-7-sonnet',
	'models.manage.modelName': '显示名称',
	'models.manage.modelNamePlaceholder': '例如: Claude 3.7 Sonnet',
	'models.manage.search': '搜索模型 ID 或名称...',
	'models.manage.cancel': '取消',
	'models.manage.confirm': '确认添加',
	'models.manage.idRequired': '请输入模型 ID',
	'models.manage.added': '自定义模型已添加。',
	'models.manage.deleted': '自定义模型已删除。',
	'models.manage.customModelsSection': '自定义模型',
	'models.manage.catalogModelsSection': '云端官方模型',
	'models.manage.context': '输入 tokens',
	'models.manage.output': '输出 tokens',
	'models.manage.vision': '视觉',
	'models.manage.thinking': '思考',
	'models.manage.inherit': '默认',
	'models.manage.none': '关闭',

	// Quota & Usage
	'quota.title': '账户额度与用量',
	'quota.intro': '查询当前 Command Code 账户的额度、5小时滚动窗口与用量概览。',
	'quota.refresh': '刷新额度',
	'quota.refreshing': '正在查询额度...',
	'quota.plan': '订阅套餐',
	'quota.status': '状态',
	'quota.credits': '可用积分 / 额度',
	'quota.monthlyCredits': '每月额度',
	'quota.purchasedCredits': '增购额度',
	'quota.freeCredits': '赠送额度',
	'quota.rolling5h': '5小时滚动用量',
	'quota.rollingWeekly': '每周滚动用量',
	'quota.cost': '当前周期累计费用',
	'quota.requests': '请求总数',
	'quota.tokens': 'Token 总量',
	'quota.updatedAt': '更新时间',
	'quota.openStudio': '前往 Studio 管理',
	'quota.noKey': '尚未配置 API Key，请先配置 API Key 才能查询额度。',
	'quota.queryFailed': '额度查询失败',
	'quota.used': '已用',
	'quota.cap': '上限',
	'quota.resetAt': '重置时间',
	'quota.refreshedNotification': 'Command Code 账户额度信息已更新。',

	// Status Bar & Menu
	'statusBar.noKey': '未配置 Key',
	'statusBar.noKeyTooltip': 'Command Code: 尚未配置 API Key。点击可进行配置。',
	'statusBar.refreshing': '正在获取额度...',
	'statusBar.error': '额度获取失败',
	'statusBar.menu.title': 'CommandCode 快捷菜单',
	'statusBar.menu.quotaSummary': '当前账户额度',
	'statusBar.menu.refreshModels': '刷新模型目录',
	'statusBar.menu.refreshModelsDesc': '从 Command Code 云端拉取最新可用模型并更新 Copilot Chat',
	'statusBar.menu.openSettings': '打开模型设置',
	'statusBar.menu.openSettingsDesc': '管理自定义模型、推理强度、Token 上限及详细用量',
	'statusBar.menu.setApiKey': '重置 / 设置 API 密钥',
	'statusBar.menu.setApiKeyDesc': '更新保存在安全存储中的 Command Code API Key',
	'statusBar.menu.refreshQuota': '刷新用量信息',
	'statusBar.menu.refreshQuotaDesc': '重新获取账户可用额度与 5 小时滚动限制窗口',
	'statusBar.menu.openStudio': '前往 Studio 管理',
	'statusBar.menu.openStudioDesc': '在浏览器中打开 Command Code Studio 控制台',
	'statusBar.menu.clickToRefresh': '点击直接刷新用量',

	// Request
	'request.toolsLimitExceeded':
		'Command Code 单次 tools 请求最多支持 {0} 个 functions，当前请求包含 {1} 个。请先用 VS Code 的 Configure Tools 关闭不常用的工具。',

	// Errors
	'error.http.400': '[{0}] 请求体格式错误。{1}',
	'error.http.401':
		'[{0}] API Key 错误，认证失败。请检查您的 API Key 是否正确。如果没有 API key，请前往 Studio 创建。',
	'error.http.401.withCreateApiKeyLink':
		'[{0}] API Key 错误，认证失败。请检查您的 API Key 是否正确。如果没有 API key，请前往 [Studio]({1}) 创建。',
	'error.http.403':
		'[{0}] Command Code Go 访问被拒绝。请运行 command-code login，并确认账户已启用 Go 计划。',
	'error.http.403.withUpgradeLink':
		'[{0}] Command Code Go 访问被拒绝。请运行 command-code login，并确认账户已启用 Go 计划。查看 [套餐]({1})。',
	'error.http.422': '[{0}] 请求体参数错误（{1}）。请检查模型 ID、参数或 ZDR 设置。',
	'error.http.429': '[{0}] 请求速率过高。请稍后重试。',
	'error.http.500': '[{0}] 服务器内部故障。请稍后重试。',
	'error.http.503': '[{0}] 服务器负载过高。请稍后重试。',
	'error.http.generic': '[{0}] 服务返回错误响应：{1}',
	'error.action.createApiKey': '创建 API Key',
	'error.action.viewPricing': '套餐详情',
	'error.network.dns': '[{0}] DNS 解析失败。请检查网络连接、防火墙或代理设置。',
	'error.network.unreachable': '[{0}] 目标不可达或拒绝连接。请检查代理服务、网络连接或防火墙设置。',
	'error.network.interrupted': '[{0}] 连接被中断。请检查网络连接、防火墙或代理设置，或稍后重试。',
	'error.network.timeout': '[{0}] 连接超时。请稍后重试，或检查网络连接、防火墙或代理设置。',
	'error.network.tls': '[{0}] TLS/证书校验失败。请检查代理或证书配置。',
	'error.network.aborted':
		'[{0}] 请求已中止。如果不是主动取消，请检查网络连接或代理设置，或稍后重试。',
	'error.network.protocol': '[{0}] HTTP 连接或响应解析失败。请检查代理设置或服务响应。',
	'error.network.configuration': '[{0}] 请求配置无效。请检查扩展设置。',
	'error.network.generic': '[{0}] 网络请求失败。请检查网络连接、防火墙或代理设置。',
	'error.unknown': 'Command Code 请求失败：{0}',

	// Extension
	'extension.activateFailed': 'Command Code Go 扩展激活失败，请查看日志。',
	'extension.welcomeFailed': '欢迎流程执行失败。',
	'extension.deactivateFailed': '停用 Command Code Go 扩展时出错。',
};

const en: Translations = {
	// Auth
	'auth.apiKeyRequiredDetail': 'Configure your API key to enable this model',
	'auth.prompt': 'Enter your Command Code API key.',
	'auth.placeholder': 'cmd-... or provider token',
	'auth.emptyValidation': 'API key cannot be empty',
	'auth.saved': 'API key saved securely.',
	'auth.removed': 'API key removed.',
	'auth.notConfigured':
		'API key not configured. Run "Command Code Go: Set API Key" from the command palette.',

	// Thinking Effort — short labels for model picker dropdown
	'status.thinking': 'Thinking effort',
	'thinking.none': 'Off',
	'thinking.none.desc': 'Disable thinking, fastest responses',
	'thinking.low': 'Light',
	'thinking.low.desc': 'Light reasoning for quick edits and simple tasks',
	'thinking.medium': 'Standard',
	'thinking.medium.desc': 'Recommended for everyday use',
	'thinking.high': 'Deep',
	'thinking.high.desc': 'Deep reasoning for complex tasks',

	// Models
	'models.refreshInProgress': 'Refreshing model list...',
	'models.refreshSucceeded': 'Pulled {0} models from Command Code.',
	'models.refreshFailed': 'Failed to refresh models: {0}',
	'models.empty': 'No models are available. Check your API key or model blacklist.',
	'models.fetchRequiresKey': 'Set an API key before refreshing the model list.',
	'models.manage.title': 'Command Code Go: Model Settings',
	'models.manage.intro':
		'Adjust how Command Code models appear in the Copilot Chat picker. Models discovered from the catalog default to 1,000,000 input tokens and vision support; edit or disable them below.',
	'models.manage.hint': 'Changes are stored globally and applied to the model picker immediately.',
	'models.manage.save': 'Save',
	'models.manage.reset': 'Reset all overrides',
	'models.manage.refresh': 'Refresh catalog',
	'models.manage.saved': 'Model settings saved.',
	'models.manage.resetDone': 'Model overrides cleared.',
	'models.manage.refreshed': 'Model catalog refreshed.',
	'models.manage.empty': 'No models yet. Try refreshing the catalog.',
	'models.manage.enabled': 'Enabled',
	'models.manage.model': 'Model',
	'models.manage.source': 'Source',
	'models.manage.bundled': 'Bundled',
	'models.manage.discovered': 'Catalog',
	'models.manage.custom': 'Custom',
	'models.manage.catalog': 'Catalog',
	'models.manage.add': 'Add Model',
	'models.manage.addCustom': 'Add Custom Model',
	'models.manage.delete': 'Delete',
	'models.manage.modelId': 'Model ID',
	'models.manage.modelIdPlaceholder': 'e.g. anthropic/claude-3-7-sonnet',
	'models.manage.modelName': 'Display Name',
	'models.manage.modelNamePlaceholder': 'e.g. Claude 3.7 Sonnet',
	'models.manage.search': 'Search model ID or name...',
	'models.manage.cancel': 'Cancel',
	'models.manage.confirm': 'Add Model',
	'models.manage.idRequired': 'Model ID is required',
	'models.manage.added': 'Custom model added.',
	'models.manage.deleted': 'Custom model deleted.',
	'models.manage.customModelsSection': 'Custom Models',
	'models.manage.catalogModelsSection': 'Command Code Models',
	'models.manage.context': 'Input tokens',
	'models.manage.output': 'Output tokens',
	'models.manage.vision': 'Vision',
	'models.manage.thinking': 'Thinking',
	'models.manage.inherit': 'Default',
	'models.manage.none': 'Off',

	// Quota & Usage
	'quota.title': 'Account Quota & Usage',
	'quota.intro':
		'View your Command Code credit balances, 5-hour rolling limit window, and usage summary.',
	'quota.refresh': 'Refresh Quota',
	'quota.refreshing': 'Querying quota...',
	'quota.plan': 'Plan',
	'quota.status': 'Status',
	'quota.credits': 'Available Credits',
	'quota.monthlyCredits': 'Monthly Credits',
	'quota.purchasedCredits': 'Purchased Credits',
	'quota.freeCredits': 'Free Credits',
	'quota.rolling5h': '5-Hour Rolling Limit',
	'quota.rollingWeekly': 'Weekly Rolling Limit',
	'quota.cost': 'Cycle Cost',
	'quota.requests': 'Total Requests',
	'quota.tokens': 'Total Tokens',
	'quota.updatedAt': 'Updated',
	'quota.openStudio': 'Manage in Studio',
	'quota.noKey': 'API Key not configured. Please set your API key first to check quota.',
	'quota.queryFailed': 'Quota query failed',
	'quota.used': 'Used',
	'quota.cap': 'Cap',
	'quota.resetAt': 'Resets at',
	'quota.refreshedNotification': 'Command Code quota information updated.',

	// Status Bar & Menu
	'statusBar.noKey': 'No Key',
	'statusBar.noKeyTooltip': 'Command Code: API Key not configured. Click to configure.',
	'statusBar.refreshing': 'Fetching quota...',
	'statusBar.error': 'Quota error',
	'statusBar.menu.title': 'CommandCode Quick Actions',
	'statusBar.menu.quotaSummary': 'Account Quota',
	'statusBar.menu.refreshModels': 'Refresh Models',
	'statusBar.menu.refreshModelsDesc':
		'Pull latest models from Command Code and update Copilot Chat',
	'statusBar.menu.openSettings': 'Open Model Settings',
	'statusBar.menu.openSettingsDesc':
		'Configure custom models, reasoning effort, token limits, and detailed usage',
	'statusBar.menu.setApiKey': 'Reset / Set API Key',
	'statusBar.menu.setApiKeyDesc': 'Update Command Code API key in secure storage',
	'statusBar.menu.refreshQuota': 'Refresh Quota & Usage',
	'statusBar.menu.refreshQuotaDesc': 'Fetch latest credit balances and 5-hour rolling limits',
	'statusBar.menu.openStudio': 'Open Studio',
	'statusBar.menu.openStudioDesc': 'Open Command Code Studio in browser',
	'statusBar.menu.clickToRefresh': 'Click to refresh quota',

	// Request
	'request.toolsLimitExceeded':
		"Command Code accepts at most {0} tools per request; this request contains {1}. Disable rarely-used tools in VS Code's Configure Tools view.",

	// Errors
	'error.http.400': '[{0}] Malformed request body. {1}',
	'error.http.401':
		"[{0}] Authentication failed. Check your Command Code API key. Create one in Studio if you don't have one yet.",
	'error.http.401.withCreateApiKeyLink':
		"[{0}] Authentication failed. Check your Command Code API key. Create one in [Studio]({1}) if you don't have one yet.",
	'error.http.403':
		'[{0}] Command Code Go access was denied. Run command-code login and verify that your account has the Go plan.',
	'error.http.403.withUpgradeLink':
		'[{0}] Command Code Go access was denied. Run command-code login and verify that your account has the Go plan. See [plans]({1}).',
	'error.http.422':
		'[{0}] Invalid request parameters ({1}). Check the model ID, parameters, or ZDR setting.',
	'error.http.429': '[{0}] Rate limit exceeded. Try again in a moment.',
	'error.http.500': '[{0}] Internal server error. Try again later.',
	'error.http.503': '[{0}] Service is overloaded. Try again later.',
	'error.http.generic': '[{0}] The service returned an error: {1}',
	'error.action.createApiKey': 'Create API key',
	'error.action.viewPricing': 'Pricing',
	'error.network.dns': '[{0}] DNS lookup failed. Check your network, firewall, and proxy.',
	'error.network.unreachable':
		'[{0}] The endpoint is unreachable or refused the connection. Check your proxy, network, and firewall.',
	'error.network.interrupted':
		'[{0}] The connection was interrupted. Check your network, firewall, or proxy, or retry shortly.',
	'error.network.timeout':
		'[{0}] The connection timed out. Retry shortly, or check your network, firewall, and proxy.',
	'error.network.tls':
		'[{0}] TLS / certificate validation failed. Check your proxy and certificates.',
	'error.network.aborted':
		'[{0}] Request aborted. If you did not cancel it, check your network or proxy, or retry shortly.',
	'error.network.protocol':
		'[{0}] HTTP connection or response parsing failed. Check your proxy or the service response.',
	'error.network.configuration':
		'[{0}] Invalid request configuration. Check the extension settings.',
	'error.network.generic': '[{0}] Network request failed. Check your network, firewall, and proxy.',
	'error.unknown': 'Command Code request failed: {0}',

	// Extension
	'extension.activateFailed': 'Command Code Go extension failed to activate; see logs for details.',
	'extension.welcomeFailed': 'Welcome walkthrough failed.',
	'extension.deactivateFailed': 'Failed to deactivate Command Code Go extension cleanly.',
};

export function t(key: string, ...args: unknown[]): string {
	const dict = isZh() ? zh : en;
	const template = dict[key] ?? en[key] ?? key;
	if (args.length === 0) {
		return template;
	}
	return template.replace(/\{(\d+)\}/g, (_match, index: string) => {
		const i = Number(index);
		return i < args.length ? String(args[i]) : '';
	});
}
