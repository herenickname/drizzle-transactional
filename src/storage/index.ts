import { StorageDriver } from "../enums/storage-driver.js";

/**
 * Options for initializing the drizzle transactional context
 */
export interface DrizzleTransactionalOptions {
  /**
   * Controls how many hooks (commit, rollback, complete) can be used simultaneously.
   * If you exceed the number of hooks of same type, you get a warning.
   */
  maxHookHandlers?: number;

  /**
   * Controls storage driver used for providing persistency during the async request timespan.
   * Currently only AsyncLocalStorage is supported.
   */
  storageDriver?: StorageDriver;
}

/**
 * Global state for drizzle transactional
 */
interface DrizzleTransactionalData {
  options: Required<DrizzleTransactionalOptions>;
  initialized: boolean;
}

/**
 * Default options
 */
const defaultOptions: Required<DrizzleTransactionalOptions> = {
  maxHookHandlers: 10,
  storageDriver: StorageDriver.ASYNC_LOCAL_STORAGE,
};

/**
 * Global data store
 */
const data: DrizzleTransactionalData = {
  options: { ...defaultOptions },
  initialized: false,
};

/**
 * Initialize the drizzle transactional context
 */
export function initializeDrizzleTransactionalContext(
  options?: Partial<DrizzleTransactionalOptions>
): void {
  // Validate options
  if (options?.maxHookHandlers !== undefined) {
    if (
      !Number.isInteger(options.maxHookHandlers) ||
      options.maxHookHandlers <= 0
    ) {
      throw new Error("maxHookHandlers must be a positive integer");
    }
  }

  if (options?.storageDriver !== undefined) {
    if (!Object.values(StorageDriver).includes(options.storageDriver)) {
      throw new Error(`Invalid storage driver: ${options.storageDriver}`);
    }
  }

  data.options = { ...defaultOptions, ...options };
  data.initialized = true;
}

/**
 * Get the current drizzle transactional options
 */
export function getDrizzleTransactionalOptions(): Required<DrizzleTransactionalOptions> {
  return data.options;
}

/**
 * Check if drizzle transactional context has been initialized
 */
export function isDrizzleTransactionalInitialized(): boolean {
  return data.initialized;
}
