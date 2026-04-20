type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

export async function getCachedValue<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const existing = cacheStore.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  const value = await loader();
  cacheStore.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function clearCacheByPrefix(prefix: string) {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) cacheStore.delete(key);
  }
}
