/**
 * Utility functions for better performance and code quality
 */

/**
 * Memoization utility for expensive operations
 */
export function memoize<Args extends readonly unknown[], Return>(
  fn: (...args: Args) => Return,
  getKey?: (...args: Args) => string | number
): (...args: Args) => Return {
  const cache = new Map<string | number, Return>();

  return (...args: Args): Return => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Debounce utility for rate limiting
 */
export function debounce<Args extends readonly unknown[]>(
  fn: (...args: Args) => void,
  delay: number
): (...args: Args) => void {
  let timeoutId: NodeJS.Timeout | undefined;

  return (...args: Args): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Throttle utility for performance control
 */
export function throttle<Args extends readonly unknown[]>(
  fn: (...args: Args) => void,
  limit: number
): (...args: Args) => void {
  let inThrottle = false;

  return (...args: Args): void => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Check if a value is a function
 */
export function isFunction(value: unknown): value is Function {
  return typeof value === "function";
}

/**
 * Check if a value is an object (but not null or array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Safe object property access
 */
export function hasOwnProperty<T extends object, K extends PropertyKey>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Create a UUID-like string for unique identifiers
 */
export function createUniqueId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
