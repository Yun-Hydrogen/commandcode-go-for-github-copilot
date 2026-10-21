import { DEFAULT_MODEL_OUTPUT_TOKENS, DEFAULT_REMOTE_CONTEXT_TOKENS, FAMILY, TOOLS_LIMIT } from '../consts';
import type { ModelOverride, ModelOverrideMap, ThinkingOverride } from '../modelOverrides';
import { MODELS } from '../models';
import type { ModelDefinition, ThinkingCapability, ThinkingEffort } from '../types';

const STANDARD_THINKING: ThinkingCapability = {
	supportedEfforts: ['low', 'medium', 'high'],
	defaultEffort: 'medium',
	canDisable: true,
};

const REMOTE_DETAIL = 'Discovered in the Command Code catalog. Adjust it in Model Settings.';

/** One row of the Model Settings GUI, including disabled models. */
export interface EditableModelRow {
	readonly id: string;
	readonly name: string;
	readonly bundled: boolean;
	readonly enabled: boolean;
	readonly maxInputTokens: number;
	readonly maxOutputTokens: number;
	readonly imageInput: boolean;
	readonly thinking: ThinkingOverride;
	readonly base: ModelDefinition;
}

/**
 * Combine the bundled allowlist with the fetched catalog and the user's
 * overrides. `remoteIds === undefined` means the catalog is unavailable, in
 * which case the bundled list is used unchanged (never an empty picker).
 */
export function buildModelRows(
	remoteIds: ReadonlySet<string> | undefined,
	overrides: ModelOverrideMap,
): EditableModelRow[] {
	const rows: EditableModelRow[] = [];
	const seen = new Set<string>();

	for (const model of MODELS) {
		if (remoteIds && !remoteIds.has(model.id)) {
			continue;
		}
		rows.push(toRow(model, true, overrides[model.id]));
		seen.add(model.id);
	}

	if (remoteIds) {
		const discovered = [...remoteIds].filter((id) => !seen.has(id)).sort();
		for (const id of discovered) {
			rows.push(toRow(remoteOnlyModel(id), false, overrides[id]));
		}
	}

	return rows;
}

export function toModelDefinition(row: EditableModelRow): ModelDefinition {
	return {
		...row.base,
		maxInputTokens: row.maxInputTokens,
		maxOutputTokens: row.maxOutputTokens,
		capabilities: {
			...row.base.capabilities,
			imageInput: row.imageInput,
			thinking: resolveThinking(row.base.capabilities.thinking, row.thinking),
		},
	};
}

export function enabledDefinitions(rows: readonly EditableModelRow[]): ModelDefinition[] {
	return rows.filter((row) => row.enabled).map(toModelDefinition);
}

function toRow(
	base: ModelDefinition,
	bundled: boolean,
	override: ModelOverride | undefined,
): EditableModelRow {
	return {
		id: base.id,
		name: base.name,
		bundled,
		enabled: override?.enabled ?? true,
		maxInputTokens: override?.maxInputTokens ?? base.maxInputTokens,
		maxOutputTokens: override?.maxOutputTokens ?? base.maxOutputTokens,
		imageInput: override?.imageInput ?? base.capabilities.imageInput,
		thinking:
			override?.thinking ??
			(base.capabilities.thinking ? base.capabilities.thinking.defaultEffort : 'inherit'),
		base,
	};
}

function remoteOnlyModel(id: string): ModelDefinition {
	return {
		id,
		name: id.split('/').pop() || id,
		family: FAMILY,
		version: 'catalog',
		detail: REMOTE_DETAIL,
		maxInputTokens: DEFAULT_REMOTE_CONTEXT_TOKENS,
		maxOutputTokens: DEFAULT_MODEL_OUTPUT_TOKENS,
		capabilities: {
			toolCalling: TOOLS_LIMIT,
			// Fetched models default to vision on; the GUI can turn it off.
			imageInput: true,
			thinking: STANDARD_THINKING,
		},
		category: 'Discovered',
	};
}

function resolveThinking(
	baseThinking: ThinkingCapability | false,
	override: ThinkingOverride,
): ThinkingCapability | false {
	const effort: ThinkingEffort =
		override === 'inherit'
			? (baseThinking === false ? 'none' : baseThinking.defaultEffort)
			: override;

	if (baseThinking === false) {
		if (effort === 'none') {
			return false;
		}
		return {
			supportedEfforts: STANDARD_THINKING.supportedEfforts,
			defaultEffort: effort,
			canDisable: true,
		};
	}

	if (effort === 'none') {
		return { ...baseThinking, defaultEffort: 'none', canDisable: true };
	}

	const supportedEfforts = baseThinking.supportedEfforts.includes(effort)
		? baseThinking.supportedEfforts
		: [...baseThinking.supportedEfforts, effort];

	return { ...baseThinking, supportedEfforts, defaultEffort: effort, canDisable: true };
}
