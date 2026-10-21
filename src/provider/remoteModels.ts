import { MODEL_CATALOG_URL } from '../consts';
import { logger } from '../logger';

const FETCH_TIMEOUT_MS = 4_000;
const SUCCESS_TTL_MS = 10 * 60_000;
const FAILURE_TTL_MS = 2 * 60_000;

/**
 * Validates the bundled model allowlist against Command Code's public model
 * catalog. The catalog is unauthenticated, so no user credential leaves the
 * extension. Every failure path is soft: the caller keeps using `MODELS`.
 */
export class RemoteModelCatalog {
	private availableIds: ReadonlySet<string> | undefined;
	private lastAttempt = 0;
	private ttl = 0;
	private inFlight: Promise<ReadonlySet<string> | undefined> | undefined;

	async getAvailableIds(): Promise<ReadonlySet<string> | undefined> {
		if (this.ttl > 0 && Date.now() - this.lastAttempt < this.ttl) {
			return this.availableIds;
		}

		if (!this.inFlight) {
			this.inFlight = this.fetchIds().finally(() => {
				this.inFlight = undefined;
			});
		}

		return this.inFlight;
	}

	/**
	 * The last known result without waiting. Used on the picker's hot path so a
	 * cold or slow network never delays `provideLanguageModelChatInformation`.
	 * A stale set is served while a refresh is in flight; a failed refresh
	 * clears it, which falls back to the bundled allowlist.
	 */
	getCachedIds(): ReadonlySet<string> | undefined {
		return this.availableIds;
	}

	/** Drop the cache so the next lookup re-fetches, e.g. on an explicit refresh. */
	invalidate(): void {
		this.ttl = 0;
	}

	private async fetchIds(): Promise<ReadonlySet<string> | undefined> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		try {
			const response = await fetch(MODEL_CATALOG_URL, {
				headers: { Accept: 'application/json' },
				signal: controller.signal,
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const ids = extractModelIds(await response.json());
			if (!ids) {
				throw new Error('catalog contained no model ids');
			}

			this.availableIds = ids;
			this.ttl = SUCCESS_TTL_MS;
			logger.debug(`Model catalog validated: ${ids.size} models advertised`);
			return ids;
		} catch (error) {
			this.availableIds = undefined;
			this.ttl = FAILURE_TTL_MS;
			logger.debug('Model catalog unavailable; using the bundled allowlist', error);
			return undefined;
		} finally {
			clearTimeout(timer);
			this.lastAttempt = Date.now();
		}
	}
}

/**
 * The endpoint has been observed to return a bare array, but tolerate the
 * common `{ data: [...] }` / `{ models: [...] }` envelopes as well so a
 * response-shape change degrades to "no validation" instead of an empty picker.
 */
function extractModelIds(payload: unknown): ReadonlySet<string> | undefined {
	const entries = findModelEntries(payload);
	if (!entries) {
		return undefined;
	}

	const ids = new Set<string>();
	for (const entry of entries) {
		if (typeof entry === 'string' && entry) {
			ids.add(entry);
			continue;
		}
		if (entry && typeof entry === 'object') {
			const id = (entry as Record<string, unknown>).id;
			if (typeof id === 'string' && id) {
				ids.add(id);
			}
		}
	}

	return ids.size > 0 ? ids : undefined;
}

function findModelEntries(payload: unknown): unknown[] | undefined {
	if (Array.isArray(payload)) {
		return payload;
	}
	if (!payload || typeof payload !== 'object') {
		return undefined;
	}

	const record = payload as Record<string, unknown>;
	for (const key of ['data', 'models']) {
		const value = record[key];
		if (Array.isArray(value)) {
			return value;
		}
		if (value && typeof value === 'object') {
			const nested = findModelEntries(value);
			if (nested) {
				return nested;
			}
		}
	}

	return undefined;
}
