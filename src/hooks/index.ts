import { EventEmitter } from "events";
import {
  getContextValue,
  setContextValue,
  hasActiveContext,
} from "../context/async-local-storage.js";
import { getDrizzleTransactionalOptions } from "../storage/index.js";
import { DrizzleTransactionalError } from "../errors/transactional.js";

const HOOK_CONTEXT_KEY = "@drizzle-transactional/hook";

/**
 * Get the transactional context hook
 */
export function getTransactionalContextHook(): EventEmitter {
  if (!hasActiveContext()) {
    throw DrizzleTransactionalError.contextError("NO_CONTEXT");
  }

  const emitter = getContextValue<EventEmitter>(HOOK_CONTEXT_KEY);
  if (!emitter) {
    throw DrizzleTransactionalError.contextError("NO_HOOK");
  }

  return emitter;
}

/**
 * Create a new event emitter for the current context
 */
export function createEventEmitterInContext(): EventEmitter {
  const options = getDrizzleTransactionalOptions();
  const emitter = new EventEmitter();
  emitter.setMaxListeners(options.maxHookHandlers);
  setContextValue(HOOK_CONTEXT_KEY, emitter);
  return emitter;
}

/**
 * Run and trigger hooks for transaction lifecycle
 * Ensures all hooks execute immediately for reliable testing and proper lifecycle management
 */
export async function runAndTriggerHooks<T>(
  hook: EventEmitter,
  callback: () => Promise<T>
): Promise<T> {
  try {
    const result = await Promise.resolve(callback());

    // Trigger commit and end hooks immediately for reliable execution
    hook.emit("commit");
    hook.emit("end", undefined);
    hook.removeAllListeners();

    return result;
  } catch (error) {
    // Trigger rollback and end hooks immediately for reliable error handling
    hook.emit("rollback", error);
    hook.emit("end", error);
    hook.removeAllListeners();

    throw error;
  }
}

/**
 * Register a callback to be executed after the current transaction was successfully committed
 */
export function runOnTransactionCommit(callback: () => void): void {
  getTransactionalContextHook().once("commit", callback);
}

/**
 * Register a callback to be executed after the current transaction rolls back
 */
export function runOnTransactionRollback(
  callback: (error: Error) => void
): void {
  getTransactionalContextHook().once("rollback", callback);
}

/**
 * Register a callback to be executed at the completion of the current transactional context
 */
export function runOnTransactionComplete(
  callback: (error: Error | undefined) => void
): void {
  getTransactionalContextHook().once("end", callback);
}
