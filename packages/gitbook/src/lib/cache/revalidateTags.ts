import { assertIsNotV2 } from '../v2';
import { cacheBackends } from './backends';
import type { CacheEntryLookup } from './types';

interface RevalidateTagsStats {
    [key: string]: {
        /**
         * Tag associated with the key.
         */
        tag?: string;

        /**
         * Backends that have the key.
         */
        backends: Record<string, { set: boolean }>;
    };
}

/**
 * Purge all cache entries associated with the given tags.
 * TODO: Implement background revalidation.
 */
export async function revalidateTags(tags: string[]): Promise<{
    stats: RevalidateTagsStats;
}> {
    assertIsNotV2();

    if (tags.length === 0) {
        return { stats: {} };
    }

    const stats: RevalidateTagsStats = {};

    const keysByBackend = new Map<number, string[]>();
    const entries = new Map<string, CacheEntryLookup>();

    await Promise.all(
        cacheBackends.map(async (backend, backendIndex) => {
            try {
                const { entries: addedEntries } = await backend.revalidateTags(tags);

                addedEntries.forEach(({ key, tag }) => {
                    stats[key] = stats[key] ?? {
                        tag,
                        backends: {},
                    };
                    stats[key].backends[backend.name] = { set: true };

                    entries.set(key, { tag, key });
                    keysByBackend.set(backendIndex, [
                        ...(keysByBackend.get(backendIndex) ?? []),
                        key,
                    ]);
                });
            } catch (err) {
                throw new Error(`error revalidating tags on backend ${backend.name}: ${err}`);
            }
        })
    );

    // Clear the keys on the backends that didn't return them
    await Promise.all(
        cacheBackends.map(async (backend, backendIndex) => {
            const unclearedEntries = Array.from(entries.values()).filter(
                (entry) => !keysByBackend.get(backendIndex)?.includes(entry.key)
            );

            if (unclearedEntries.length > 0) {
                unclearedEntries.forEach((entry) => {
                    stats[entry.key].backends[backend.name] = { set: false };
                });

                try {
                    await backend.del(unclearedEntries);
                } catch (error) {
                    if (error instanceof Error && error.message === 'Too many subrequests.') {
                        if (backend.replication === 'local') {
                            return;
                        }
                    }

                    throw new Error(`error deleting entries on backend ${backend.name}: ${error}`);
                }
            }
        })
    );

    return {
        stats,
    };
}
