import {
  runWithContext,
  hasActiveContext,
  getContextValue,
} from "../context/async-local-storage.js";
import {
  createEventEmitterInContext,
  runAndTriggerHooks,
} from "../hooks/index.js";
import {
  runInDatabaseTransaction,
  getCurrentDatabaseInfo,
} from "../drizzle/database-manager.js";
import { DrizzleTransactionalError } from "../errors/transactional.js";
import { isDrizzleTransactionalInitialized } from "../storage/index.js";
import { Propagation } from "../enums/propagation.js";
import { IsolationLevel } from "../enums/isolation-level.js";
import type { DatabaseName } from "../types/index.js";

export interface WrapInTransactionOptions {
  /**
   * Database name to use for this transactional context
   */
  databaseName?: DatabaseName;

  /**
   * Transaction propagation behavior
   */
  propagation?: Propagation;

  /**
   * Transaction isolation level
   */
  isolationLevel?: IsolationLevel;

  /**
   * Method name (for debugging)
   */
  name?: string | symbol;
}

const CURRENT_TRANSACTION_KEY = "@drizzle-transactional/current-transaction";

/**
 * Propagation handlers for better maintainability and performance
 */
const propagationHandlers = {
  [Propagation.MANDATORY]: (
    currentTransaction: boolean,
    runOriginal: () => any
  ) => {
    if (!currentTransaction) {
      throw DrizzleTransactionalError.propagationError(
        "MANDATORY",
        Propagation.MANDATORY
      );
    }
    return runOriginal();
  },

  [Propagation.NESTED]: (
    _: boolean,
    __: () => any,
    runWithNewTransaction: () => any
  ) => {
    // Drizzle doesn't support nested transactions, so treat as REQUIRES_NEW
    return runWithNewTransaction();
  },

  [Propagation.NEVER]: (
    currentTransaction: boolean,
    _: () => any,
    __: () => any,
    runWithNewHook: () => any
  ) => {
    if (currentTransaction) {
      throw DrizzleTransactionalError.propagationError(
        "NEVER",
        Propagation.NEVER
      );
    }
    return runWithNewHook();
  },

  [Propagation.NOT_SUPPORTED]: (
    currentTransaction: boolean,
    runOriginal: () => any,
    __: () => any,
    runWithNewHook: () => any
  ) => {
    if (currentTransaction) {
      // Suspend current transaction and run without it
      return runWithContext({ [CURRENT_TRANSACTION_KEY]: false }, () =>
        runWithNewHook()
      );
    }
    return runOriginal();
  },

  [Propagation.REQUIRED]: (
    currentTransaction: boolean,
    runOriginal: () => any,
    runWithNewTransaction: () => any
  ) => {
    return currentTransaction ? runOriginal() : runWithNewTransaction();
  },

  [Propagation.REQUIRES_NEW]: (
    currentTransaction: boolean,
    _: () => any,
    runWithNewTransaction: () => any,
    runWithNewHook: () => any
  ) => {
    if (currentTransaction) {
      // Drizzle doesn't support nested transactions, so we'll run without transaction
      // when already inside one, logging a warning
      console.warn(
        "REQUIRES_NEW propagation detected inside existing transaction. " +
          "Drizzle doesn't support nested transactions, running without transaction."
      );
      return runWithContext({ [CURRENT_TRANSACTION_KEY]: false }, () =>
        runWithNewHook()
      );
    }
    return runWithNewTransaction();
  },

  [Propagation.SUPPORTS]: (
    currentTransaction: boolean,
    runOriginal: () => any,
    __: () => any,
    runWithNewHook: () => any
  ) => {
    return currentTransaction ? runOriginal() : runWithNewHook();
  },
} as const;

/**
 * Wrap a function to run within a transaction
 */
export function wrapInTransaction<
  Fn extends (this: any, ...args: any[]) => ReturnType<Fn>
>(fn: Fn, options?: WrapInTransactionOptions): Fn {
  // eslint-disable-next-line func-style
  function wrapper(this: unknown, ...args: unknown[]) {
    if (!isDrizzleTransactionalInitialized()) {
      throw DrizzleTransactionalError.notInitialized();
    }

    const databaseName = options?.databaseName ?? "default";
    const propagation = options?.propagation ?? Propagation.REQUIRED;
    const isolationLevel = options?.isolationLevel;

    const runOriginal = () => fn.apply(this, args);
    const runWithNewHook = () => {
      const hook = createEventEmitterInContext();
      return runAndTriggerHooks(hook, async () => runOriginal());
    };

    const runWithNewTransaction = () => {
      const hook = createEventEmitterInContext();

      return runAndTriggerHooks(hook, async () => {
        return runInDatabaseTransaction(
          databaseName,
          isolationLevel,
          async () => {
            return runWithContext(
              { [CURRENT_TRANSACTION_KEY]: true },
              runOriginal
            );
          }
        );
      });
    };

    // If not in an async context, create one
    if (!hasActiveContext()) {
      return runWithContext({}, () => {
        return executeWithPropagation();
      });
    }

    return executeWithPropagation();

    function executeWithPropagation() {
      const currentTransaction = getContextValue<boolean>(
        CURRENT_TRANSACTION_KEY
      );

      const handler = propagationHandlers[propagation];
      if (!handler) {
        throw DrizzleTransactionalError.propagationError(
          "UNKNOWN",
          propagation
        );
      }

      return handler(
        currentTransaction ?? false,
        runOriginal,
        runWithNewTransaction,
        runWithNewHook
      );
    }
  }

  return wrapper as Fn;
}
