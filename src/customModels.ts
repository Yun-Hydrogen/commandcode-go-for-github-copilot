import type { ThinkingOverride } from './modelOverrides';
import type { ModelDefinition, ThinkingCapability } from './types';
import {
	DEFAULT_MODEL_OUTPUT_TOKENS,
	DEFAULT_REMOTE_CONTEXT_TOKENS,
	FAMILY,
	TOOLS_LIMIT,
} from './consts';

export interface CustomModelDefinition {
	id: string;
	name: string;
	maxInputTokens: number;
	maxOutputTokens: number;
	imageInput: boolean;
	thinking: ThinkingOverride;
}

const STANDARD_THINKING: ThinkingCapability = {
	supportedEfforts: ['low', 'medium', 'high'] as const,
	defaultEffort: 'medium',
	canDisable: true,
};

const MIN_CONTEXT_TOKENS = 1_000;
const MAX_CONTEXT_TOKENS = 10_000_000;
const MIN_OUTPUT_TOKENS = 1;
const MAX_OUTPUT_TOKENS = 1_000_000;

const VALID_THINKING_VALUES: readonly ThinkingOverride[] = [
	'inherit',
	'none',
	'low',
	'medium',
	'high',
];

export function sanitizeCustomModels(value: unknown): CustomModelDefinition[] {
	if (!Array.isArray(value)) {
		return [];
	}

	const result: CustomModelDefinition[] = [];
	const seen = new Set<string>();

	for (const raw of value) {
		if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id.trim()) {
			continue;
		}

		const id = raw.id.trim();
		if (seen.has(id)) {
			continue;
		}
		seen.add(id);

		const name =
			typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id.split('/').pop() || id;

		const maxInputTokens =
			sanitizeInteger(raw.maxInputTokens, MIN_CONTEXT_TOKENS, MAX_CONTEXT_TOKENS) ??
			DEFAULT_REMOTE_CONTEXT_TOKENS;

		const maxOutputTokens =
			sanitizeInteger(raw.maxOutputTokens, MIN_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS) ??
			DEFAULT_MODEL_OUTPUT_TOKENS;

		const imageInput = typeof raw.imageInput === 'boolean' ? raw.imageInput : true;
		const thinking: ThinkingOverride =
			typeof raw.thinking === 'string' &&
			VALID_THINKING_VALUES.includes(raw.thinking as ThinkingOverride)
				? (raw.thinking as ThinkingOverride)
				: 'inherit';

		result.push({
			id,
			name,
			maxInputTokens,
			maxOutputTokens,
			imageInput,
			thinking,
		});
	}

	return result;
}

export function customModelToDefinition(custom: CustomModelDefinition): ModelDefinition {
	const thinkingCapability: ThinkingCapability | false =
		custom.thinking === 'none'
			? false
			: {
					...STANDARD_THINKING,
					defaultEffort: custom.thinking === 'inherit' ? 'medium' : custom.thinking,
				};

	return {
		id: custom.id,
		name: custom.name,
		family: FAMILY,
		version: 'custom',
		detail: 'Custom user-defined model',
		maxInputTokens: custom.maxInputTokens,
		maxOutputTokens: custom.maxOutputTokens,
		capabilities: {
			toolCalling: TOOLS_LIMIT,
			imageInput: custom.imageInput,
			thinking: thinkingCapability,
		},
		category: 'Custom',
	};
}

function sanitizeInteger(value: unknown, min: number, max: number): number | undefined {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return undefined;
	}
	return Math.min(Math.max(Math.round(value), min), max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
