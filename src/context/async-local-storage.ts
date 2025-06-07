import { AsyncLocalStorage } from "async_hooks";
import { ZodSchema } from "zod";

/**
 * The global AsyncLocalStorage instance for storing transactional context
 */
const asyncLocalStorage = new AsyncLocalStorage<Map<string, unknown>>();

/**
 * Get the current transactional context
 */
export function getContext(): Record<string, unknown> {
  const context = asyncLocalStorage.getStore();
  if (context instanceof Map) {
    return Object.fromEntries(context);
  }
  return {};
}

/**
 * Get the current transactional context validated against a Zod schema
 */
export function getZodContext<T extends object>(schema: ZodSchema<T>): T {
  const context = asyncLocalStorage.getStore();
  const contextObj = context instanceof Map ? Object.fromEntries(context) : {};
  const result = schema.safeParse(contextObj);

  if (result.success) {
    return result.data;
  }

  throw new Error(`Context does not match schema: ${result.error.message}`);
}

/**
 * Run a function with a specific transactional context
 * Optimized to avoid unnecessary Map operations
 */
export function runWithContext<T>(
  context: Record<string, unknown>,
  fn: () => T
): T {
  const currentStore = asyncLocalStorage.getStore();

  // If no current store and no context to add, just run the function
  if (!currentStore && Object.keys(context).length === 0) {
    return asyncLocalStorage.run(new Map(), fn);
  }

  const newStore = new Map(currentStore);

  // Merge new context into the store (only if there are changes)
  const contextEntries = Object.entries(context);
  if (contextEntries.length > 0) {
    for (const [key, value] of contextEntries) {
      newStore.set(key, value);
    }
  }

  return asyncLocalStorage.run(newStore, fn);
}

/**
 * Get a value from the current context by key
 */
export function getContextValue<T>(key: string): T | undefined {
  const store = asyncLocalStorage.getStore();
  return store?.get(key) as T | undefined;
}

/**
 * Set a value in the current context
 */
export function setContextValue(key: string, value: unknown): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.set(key, value);
  }
}

/**
 * Check if we're currently running in a transactional context
 */
export function hasActiveContext(): boolean {
  return asyncLocalStorage.getStore() !== undefined;
}

/**
 * Get the raw AsyncLocalStorage instance (for advanced usage)
 */
export function getAsyncLocalStorage(): AsyncLocalStorage<
  Map<string, unknown>
> {
  return asyncLocalStorage;
}
