import type { ThinkingEffort } from './types';

/** `inherit` keeps the value shipped with the model definition. */
export type ThinkingOverride = 'inherit' | ThinkingEffort;

export interface ModelOverride {
	enabled?: boolean;
	maxInputTokens?: number;
	maxOutputTokens?: number;
	imageInput?: boolean;
	thinking?: ThinkingOverride;
}

export type ModelOverrideMap = Record<string, ModelOverride>;

const THINKING_OVERRIDES: readonly ThinkingOverride[] = [
	'inherit',
	'none',
	'low',
	'medium',
	'high',
];

const MIN_CONTEXT_TOKENS = 1_000;
const MAX_CONTEXT_TOKENS = 10_000_000;
const MIN_OUTPUT_TOKENS = 1;
const MAX_OUTPUT_TOKENS = 1_000_000;

/**
 * Normalize whatever globalState holds (or a webview sends) into a trusted
 * map. Unknown keys and invalid values are dropped rather than trusted.
 */
export function sanitizeModelOverrides(value: unknown): ModelOverrideMap {
	if (!isRecord(value)) {
		return {};
	}

	const result: ModelOverrideMap = {};
	for (const [id, raw] of Object.entries(value)) {
		if (!id || !isRecord(raw)) {
			continue;
		}

		const override: ModelOverride = {};
		if (typeof raw.enabled === 'boolean') {
			override.enabled = raw.enabled;
		}
		if (typeof raw.imageInput === 'boolean') {
			override.imageInput = raw.imageInput;
		}

		const maxInputTokens = sanitizeInteger(
			raw.maxInputTokens,
			MIN_CONTEXT_TOKENS,
			MAX_CONTEXT_TOKENS,
		);
		if (maxInputTokens !== undefined) {
			override.maxInputTokens = maxInputTokens;
		}

		const maxOutputTokens = sanitizeInteger(
			raw.maxOutputTokens,
			MIN_OUTPUT_TOKENS,
			MAX_OUTPUT_TOKENS,
		);
		if (maxOutputTokens !== undefined) {
			override.maxOutputTokens = maxOutputTokens;
		}

		if (isThinkingOverride(raw.thinking)) {
			override.thinking = raw.thinking;
		}

		if (Object.keys(override).length > 0) {
			result[id] = override;
		}
	}

	return result;
}

function sanitizeInteger(value: unknown, min: number, max: number): number | undefined {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return undefined;
	}
	return Math.min(Math.max(Math.round(value), min), max);
}

function isThinkingOverride(value: unknown): value is ThinkingOverride {
	return THINKING_OVERRIDES.some((effort) => effort === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
