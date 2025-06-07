/**
 * Enumeration that represents storage engines to use with initializeDrizzleTransactionalContext
 */
export enum StorageDriver {
  /**
   * Uses AsyncLocalStorage (modern Node.js approach)
   */
  ASYNC_LOCAL_STORAGE = "ASYNC_LOCAL_STORAGE",
}
