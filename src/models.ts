import {
	DEFAULT_MODEL_OUTPUT_TOKENS,
	DEFAULT_REMOTE_CONTEXT_TOKENS,
	FAMILY,
	TOOLS_LIMIT,
} from './consts';
import type { ModelDefinition, ThinkingCapability } from './types';

/**
 * Standard capability set for reasoning models.
 */
export const STANDARD_THINKING: ThinkingCapability = {
	supportedEfforts: ['low', 'medium', 'high'] as const,
	defaultEffort: 'medium',
	canDisable: true,
};

/**
 * Helper to construct a standard model definition from an ID.
 */
export function createDefaultModelDefinition(
	id: string,
	name?: string,
	category = 'Discovered',
): ModelDefinition {
	return {
		id,
		name: name || id.split('/').pop() || id,
		family: FAMILY,
		version: 'catalog',
		detail: 'Model available via Command Code API.',
		maxInputTokens: DEFAULT_REMOTE_CONTEXT_TOKENS,
		maxOutputTokens: DEFAULT_MODEL_OUTPUT_TOKENS,
		capabilities: {
			toolCalling: TOOLS_LIMIT,
			imageInput: true,
			thinking: STANDARD_THINKING,
		},
		category,
	};
}
