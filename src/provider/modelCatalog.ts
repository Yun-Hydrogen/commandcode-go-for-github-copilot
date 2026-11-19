import { CustomModelDefinition, customModelToDefinition } from '../customModels';
import type { ModelOverride, ModelOverrideMap, ThinkingOverride } from '../modelOverrides';
import { createDefaultModelDefinition, STANDARD_THINKING } from '../models';
import type { ModelDefinition, ThinkingCapability, ThinkingEffort } from '../types';

/** One row of the Model Settings GUI, including disabled and custom models. */
export interface EditableModelRow {
	readonly id: string;
	readonly name: string;
	readonly isCustom: boolean;
	readonly enabled: boolean;
	readonly maxInputTokens: number;
	readonly maxOutputTokens: number;
	readonly imageInput: boolean;
	readonly thinking: ThinkingOverride;
	readonly base: ModelDefinition;
}

/**
 * Combine user custom models with the fetched catalog and the user's overrides.
 */
export function buildModelRows(
	remoteIds: ReadonlySet<string> | undefined,
	customModels: readonly CustomModelDefinition[],
	overrides: ModelOverrideMap,
): EditableModelRow[] {
	const rows: EditableModelRow[] = [];
	const seen = new Set<string>();

	// 1. Custom models added by the user
	for (const custom of customModels) {
		const base = customModelToDefinition(custom);
		rows.push(toRow(base, true, overrides[custom.id]));
		seen.add(custom.id);
	}

	// 2. Models discovered from the remote catalog
	if (remoteIds) {
		const sortedRemoteIds = [...remoteIds].filter((id) => !seen.has(id)).sort();
		for (const id of sortedRemoteIds) {
			rows.push(toRow(createDefaultModelDefinition(id), false, overrides[id]));
			seen.add(id);
		}
	}

	// 3. Models that have overrides stored from previous sessions
	for (const id of Object.keys(overrides)) {
		if (!seen.has(id)) {
			rows.push(toRow(createDefaultModelDefinition(id), false, overrides[id]));
			seen.add(id);
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
	isCustom: boolean,
	override: ModelOverride | undefined,
): EditableModelRow {
	return {
		id: base.id,
		name: base.name,
		isCustom,
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

function resolveThinking(
	baseThinking: ThinkingCapability | false,
	override: ThinkingOverride,
): ThinkingCapability | false {
	const effort: ThinkingEffort =
		override === 'inherit'
			? baseThinking === false
				? 'none'
				: baseThinking.defaultEffort
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
