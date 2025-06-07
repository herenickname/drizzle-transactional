import {
  wrapInTransaction,
  type WrapInTransactionOptions,
} from "../transactions/wrap-in-transaction.js";

/**
 * Run a function within a transaction
 */
export function runInTransaction<T>(
  fn: () => Promise<T>,
  options?: WrapInTransactionOptions
): Promise<T> {
  return wrapInTransaction(fn, options)();
}
