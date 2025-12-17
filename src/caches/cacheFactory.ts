import type { Key, Options, Stats, ValueSetItem } from "node-cache";
import NodeCache from "node-cache";

/**
 * A type-safe wrapper around `node-cache` with enhanced JSDoc documentation.
 * All methods update cache statistics automatically.
 *
 * @template T - The type of values stored in the cache.
 */
export type CacheFactoryResult<T> = {
  /**
   * Retrieves a value from the cache by key and increments the `hits` stat.
   * Returns `undefined` if the key is not found or expired.
   *
   * @param key - The cache key (string or number)
   * @returns The cached value of type `T`, or `undefined` if not found
   *
   * @example
   * ```ts
   * const user = cache.get('user:123');
   * if (user) console.log(user.name);
   * ```
   */
  get(key: Key): T | undefined;

  /**
   * Retrieves multiple values by keys in a single operation.
   * Only existing (non-expired) keys are returned. Updates stats accordingly.
   *
   * @param keys - Array of cache keys to retrieve
   * @returns Object mapping keys (as strings) to their cached values of type `T`
   *
   * @example
   * ```ts
   * const values = cache.mget(['user:1', 'user:2']);
   * // => { 'user:1': { name: 'Alice' }, 'user:2': { name: 'Bob' } }
   * ```
   */
  mget(keys: Key[]): { [key: string]: T };

  /**
   * Stores a value in the cache with an optional TTL (time-to-live).
   *
   * @overload
   * @param key - The cache key
   * @param value - Value to cache. If `options.useClones` is false, this is stored by reference.
   * @param ttl - Time to live in seconds. Use `0` or omit for no expiration.
   * @returns `true` if set successfully
   *
   * @example
   * ```ts
   * cache.set('session:abc', { userId: 123 }, 3600); // expires in 1 hour
   * ```
   */
  set(key: Key, value: T, ttl: number | string): boolean;

  /**
   * @overload
   * Stores a value in the cache without expiration (infinite TTL).
   *
   * @param key - The cache key
   * @param value - Value to cache
   * @returns `true` if set successfully
   */
  set(key: Key, value: T): boolean;

  /**
   * Stores multiple key-value pairs with optional TTLs in a single operation.
   * Updates stats for all successful sets.
   *
   * @param keyValueSet - Array of objects containing `key`, `val`, and optional `ttl`
   * @returns `true` if all items were set successfully
   *
   * @example
   * ```ts
   * cache.mset([
   *   { key: 'a', val: 1, ttl: 60 },
   *   { key: 'b', val: 2 }
   * ]);
   * ```
   */
  mset(keyValueSet: ValueSetItem<T>[]): boolean;

  /**
   * Deletes one or more keys from the cache.
   *
   * @param keys - Single key or array of keys to delete
   * @returns Number of keys actually deleted
   *
   * @example
   * ```ts
   * cache.del('temp:123');
   * cache.del(['user:1', 'user:2']);
   * ```
   */
  del(keys: Key | Key[]): number;

  /**
   * Retrieves and **immediately deletes** a key from the cache.
   * Ideal for one-time tokens (e.g. OTP, email verification).
   *
   * @param key - The cache key
   * @returns The cached value of type `T`, or `undefined` if not found
   *
   * @example
   * ```ts
   * const code = cache.take('otp:12345');
   * if (code) validateOTP(code);
   * ```
   */
  take(key: Key): T | undefined;

  /**
   * Updates the TTL of an existing key or deletes it if `ttl` is `0`.
   *
   * @overload
   * @param key - The cache key
   * @param ttl - New TTL in seconds (`0` = delete, negative = no change)
   * @returns `true` if key existed and TTL was updated
   *
   * @example
   * ```ts
   * cache.ttl('session:abc', 1800); // extend to 30 minutes
   * ```
   */
  ttl(key: Key, ttl: number): boolean;

  /**
   * @overload
   * Deletes the key (equivalent to `del(key)`).
   *
   * @param key - The cache key to delete
   * @returns `true` if key existed and was deleted
   */
  ttl(key: Key): boolean;

  /**
   * Gets the remaining TTL of a key in milliseconds.
   *
   * @param key - The cache key
   * @returns Remaining TTL in milliseconds, `undefined` if key doesn't exist or has no TTL
   *
   * @example
   * ```ts
   * const expiresIn = cache.getTtl('session:abc');
   * if (expiresIn && expiresIn < 60000) refreshSession();
   * ```
   */
  getTtl(key: Key): number | undefined;

  /**
   * Lists all currently cached keys (non-expired).
   *
   * @returns Array of string keys
   *
   * @example
   * ```ts
   * const activeKeys = cache.keys();
   * console.log(`Cache has ${activeKeys.length} items`);
   * ```
   */
  keys(): string[];

  /**
   * Gets current cache statistics (hits, misses, keys, etc.).
   *
   * @returns Stats object with performance metrics
   *
   * @example
   * ```ts
   * const stats = cache.getStats();
   * console.log(`Hit rate: ${stats.hits / (stats.hits + stats.misses) * 100}%`);
   * ```
   */
  getStats(): Stats;

  /**
   * Checks if a key exists and is not expired.
   *
   * @param key - The cache key to check
   * @returns `true` if the key is cached and valid
   *
   * @example
   * ```ts
   * if (cache.has('config')) useCachedConfig();
   * ```
   */
  has(key: Key): boolean;

  /**
   * Removes **all** keys and resets statistics.
   * Use with caution in production.
   *
   * @example
   * ```ts
   * cache.flushAll(); // clear everything
   * ```
   */
  flushAll(): void;

  /**
   * Closes the cache and clears the background check interval (if `checkperiod` was set).
   * Should be called on app shutdown.
   *
   * @example
   * ```ts
   * process.on('SIGTERM', () => {
   *   cache.close();
   *   process.exit(0);
   * });
   * ```
   */
  close(): void;

  /**
   * Resets all statistics counters to zero without affecting cached data.
   *
   * @example
   * ```ts
   * cache.flushStats(); // start fresh metrics
   * ```
   */
  flushStats(): void;
};

/**
 * Creates a type-safe cache instance with optional configuration.
 *
 * @template T - The type of values to be cached
 * @param options - Configuration options for `node-cache`
 * @returns A cache instance with full type safety and rich documentation
 *
 * @example
 * ```ts
 * interface User { id: number; name: string; }
 * const userCache = cacheFactory<User>({ stdTTL: 600 });
 *
 * userCache.set('user:1', { id: 1, name: 'Alice' });
 * const user = userCache.get('user:1');
 * ```
 */
export default function cacheFactory<T>(
  options?: Options,
  errorOnMissing: boolean = false
): CacheFactoryResult<T> {
  const cache = new NodeCache({ errorOnMissing, ...options });
  return cache;
}
