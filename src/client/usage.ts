import { COMMAND_CODE_CLIENT_VERSION, DEFAULT_BASE_URL } from '../consts';

export interface QuotaWindowData {
	used: number;
	cap: number;
	percent: number;
	resetAt?: string;
}

export interface AccountQuotaResult {
	success: boolean;
	error?: string;
	monthlyCredits?: number;
	purchasedCredits?: number;
	freeCredits?: number;
	totalRemainingCredits?: number;
	plan?: string;
	status?: string;
	fiveHour?: QuotaWindowData;
	weekly?: QuotaWindowData;
	totalCost?: number | string;
	requestCount?: number;
	tokenCount?: number;
	updatedAt?: string;
	raw?: unknown;
}

function parseNumber(val: unknown): number | undefined {
	if (typeof val === 'number' && !Number.isNaN(val)) {
		return val;
	}
	if (typeof val === 'string') {
		const parsed = parseFloat(val);
		if (!Number.isNaN(parsed)) {
			return parsed;
		}
	}
	return undefined;
}

function parseWindow(rawWindow: unknown): QuotaWindowData | undefined {
	if (!rawWindow || typeof rawWindow !== 'object') {
		return undefined;
	}
	const w = rawWindow as Record<string, unknown>;
	const used = parseNumber(w.used) ?? parseNumber(w.current) ?? 0;
	const cap = parseNumber(w.cap) ?? parseNumber(w.limit) ?? parseNumber(w.total) ?? 0;
	const percent = cap > 0 ? Math.min(100, Math.max(0, Math.round((used / cap) * 100))) : 0;
	const resetAt =
		typeof w.resetAt === 'string' || typeof w.resetAt === 'number' ? String(w.resetAt) : undefined;
	return { used, cap, percent, resetAt };
}

export async function fetchAccountQuota(apiKey: string): Promise<AccountQuotaResult> {
	if (!apiKey || !apiKey.trim()) {
		return {
			success: false,
			error: 'API Key 未配置',
		};
	}

	const headers: Record<string, string> = {
		Authorization: `Bearer ${apiKey.trim()}`,
		Accept: 'application/json',
		'User-Agent': 'cli',
		'x-command-code-version': COMMAND_CODE_CLIENT_VERSION,
		'x-cli-environment': 'production',
	};

	try {
		const [creditsRes, subRes, summaryRes] = await Promise.allSettled([
			fetch(`${DEFAULT_BASE_URL}/billing/credits`, { headers }),
			fetch(`${DEFAULT_BASE_URL}/billing/subscriptions`, { headers }),
			fetch(`${DEFAULT_BASE_URL}/usage/summary`, { headers }),
		]);

		if (creditsRes.status === 'rejected') {
			return {
				success: false,
				error:
					creditsRes.reason instanceof Error
						? creditsRes.reason.message
						: String(creditsRes.reason),
			};
		}

		const creditsResponse = creditsRes.value;
		if (!creditsResponse.ok) {
			if (creditsResponse.status === 401) {
				return {
					success: false,
					error: 'API Key 无效或未授权 (401)',
				};
			}
			return {
				success: false,
				error: `请求额度接口失败 (${creditsResponse.status})`,
			};
		}

		const creditsData = (await creditsResponse.json().catch(() => ({}))) as Record<string, unknown>;

		let plan: string | undefined;
		let subStatus: string | undefined;
		if (subRes.status === 'fulfilled' && subRes.value.ok) {
			const subData = (await subRes.value.json().catch(() => ({}))) as Record<string, unknown>;
			const subObj = (subData.subscription || subData.data || subData) as Record<string, unknown>;
			plan =
				typeof subObj.planId === 'string'
					? subObj.planId
					: typeof subObj.plan === 'string'
						? subObj.plan
						: undefined;
			subStatus = typeof subObj.status === 'string' ? subObj.status : undefined;
		}

		let totalCost: number | string | undefined;
		let requestCount: number | undefined;
		let tokenCount: number | undefined;
		if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
			const sumData = (await summaryRes.value.json().catch(() => ({}))) as Record<string, unknown>;
			const sumObj = (sumData.summary || sumData.data || sumData) as Record<string, unknown>;
			totalCost =
				parseNumber(sumObj.totalCost) ??
				(typeof sumObj.cost === 'string' || typeof sumObj.cost === 'number'
					? sumObj.cost
					: undefined);
			requestCount = parseNumber(sumObj.requests) ?? parseNumber(sumObj.totalRequests);
			tokenCount = parseNumber(sumObj.tokens) ?? parseNumber(sumObj.totalTokens);
		}

		const c = (creditsData.credits || creditsData.data || creditsData) as Record<string, unknown>;

		const monthlyCredits = parseNumber(c.monthlyCredits) ?? parseNumber(c.monthly);
		const purchasedCredits = parseNumber(c.purchasedCredits) ?? parseNumber(c.purchased);
		const freeCredits = parseNumber(c.freeCredits) ?? parseNumber(c.free);

		const totalRemainingCredits =
			parseNumber(c.totalRemaining) ??
			parseNumber(c.remaining) ??
			parseNumber(c.balance) ??
			(monthlyCredits !== undefined || purchasedCredits !== undefined || freeCredits !== undefined
				? (monthlyCredits ?? 0) + (purchasedCredits ?? 0) + (freeCredits ?? 0)
				: undefined);

		const fiveHour = parseWindow(c.fiveHour || c['5hour'] || c.rolling5h);
		const weekly = parseWindow(c.weekly || c.rollingWeekly);

		return {
			success: true,
			monthlyCredits,
			purchasedCredits,
			freeCredits,
			totalRemainingCredits,
			plan,
			status: subStatus,
			fiveHour,
			weekly,
			totalCost,
			requestCount,
			tokenCount,
			updatedAt: new Date().toLocaleTimeString(),
			raw: creditsData,
		};
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
