import { VisualConfig } from "../config/VisualConfig";
import { CacheEntry } from "../types/index";

/**
 * In-memory caching service for expensive operations like network requests.
 * Supports TTL-based expiration, LRU eviction, and request coalescing to prevent
 * duplicate concurrent fetches for the same resource.
 * 
 * @example
 * ```typescript
 * const cache = new CacheService();
 * const data = await cache.getOrFetch('boundary-data', () => fetchBoundaries());
 * ```
 */
export class CacheService {
    private cache: Map<string, CacheEntry<any>>;
    private maxEntries: number;
    private expiryMs: number; // default TTL when not specified
    private pending: Map<string, Promise<any>>;

    /**
     * Creates a new CacheService with configuration from VisualConfig.
     */
    constructor() {
        this.cache = new Map();
        this.maxEntries = VisualConfig.CACHE.MAX_ENTRIES;
        this.expiryMs = VisualConfig.CACHE.EXPIRY_MS;
    this.pending = new Map();
    }

    /**
     * Retrieves data from cache or fetches it using the provided function.
     * Implements request coalescing to prevent duplicate concurrent fetches.
     * @typeParam T - The type of data being cached
     * @param key - Unique cache key for the data
     * @param fetchFn - Async function to fetch data if not cached
     * @param options - Optional cache configuration
     * @param options.ttlMs - Custom TTL in milliseconds (overrides default)
     * @param options.response - Response object for header inspection
     * @param options.respectCacheHeaders - Whether to honor Cache-Control headers
     * @returns The cached or freshly fetched data
     */
    public async getOrFetch<T>(
        key: string,
        fetchFn: () => Promise<T>,
        options?: { ttlMs?: number; response?: Response | null; respectCacheHeaders?: boolean }
    ): Promise<T> {
        const cached = this.cache.get(key);

    if (cached && this.isValid(cached)) {
            return cached.data;
        }

        // Coalesce concurrent in-flight fetches for the same key
    const existing = this.pending.get(key) as Promise<T> | undefined;
        if (existing) {
            return existing;
        }

        const p = (async () => {
            try {
                const result = await fetchFn();
                // Support both direct data and { data, response }
                let data: any = result;
                let response: Response | null = null;
                if (result && typeof result === 'object' && 'data' in result && 'response' in result) {
                    data = (result as any).data;
                    response = (result as any).response as Response | null;
                }
                // Only cache truthy values; avoid caching null/undefined failures
                if (data !== null && data !== undefined) {
                    // Determine TTL
                    let ttl = options?.ttlMs ?? this.expiryMs;
                    const respToInspect = options?.respectCacheHeaders ? (response ?? options?.response ?? null) : null;
                    if (respToInspect) {
                        const header = respToInspect.headers.get('Cache-Control') || '';
                        const m = header.match(/max-age=(\d+)/i);
                        if (m) {
                            const maxAgeSec = parseInt(m[1], 10);
                            if (!Number.isNaN(maxAgeSec) && maxAgeSec > 0) {
                                ttl = Math.min(ttl, maxAgeSec * 1000);
                            }
                        }
                    }
                    this.set(key, data, ttl);
                }
                return data as T;
            } finally {
                this.pending.delete(key);
            }
        })();
        this.pending.set(key, p);
        return p;
    }

    /**
     * Stores data in the cache with an optional custom TTL.
     * Automatically evicts the oldest entry if cache is full.
     * @typeParam T - The type of data being stored
     * @param key - Unique cache key
     * @param data - Data to cache
     * @param ttlMs - Optional custom TTL in milliseconds
     */
    public set<T>(key: string, data: T, ttlMs?: number): void {
        if (this.cache.size >= this.maxEntries) {
            this.evictOldest();
        }

        const effectiveTtl = ttlMs ?? this.expiryMs;
        const timestamp = Date.now();

        this.cache.set(key, {
            data,
            timestamp,
            expiresAt: timestamp + effectiveTtl
        });
    }

    /**
     * Retrieves data from cache if it exists and hasn't expired.
     * @typeParam T - The expected type of cached data
     * @param key - Cache key to look up
     * @returns Cached data or undefined if not found/expired
     */
    public get<T>(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry || !this.isValid(entry)) {
            return undefined;
        }
        return entry.data;
    }

    /**
     * Clears all entries from the cache.
     */
    public clear(): void {
        this.cache.clear();
    }

    private isValid(entry: CacheEntry<any>): boolean {
        return Date.now() < entry.expiresAt;
    }

    private evictOldest(): void {
        let oldestKey: string | null = null;
        let oldestTimestamp = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTimestamp) {
                oldestTimestamp = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }
} 