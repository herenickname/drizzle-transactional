import { randomUUID } from "crypto";
import {
  getContextValue,
  setContextValue,
  runWithContext,
} from "../context/async-local-storage.js";
import type {
  DrizzleDatabase,
  DrizzleTransaction,
  DatabaseName,
  TransactionalDatabaseInfo,
} from "../types/index.js";
import { DrizzleTransactionalError } from "../errors/transactional.js";

const DATABASE_MAP_KEY = "@drizzle-transactional/databases";
const CURRENT_DB_ID_KEY = "@drizzle-transactional/current-db-id";

/**
 * Map of registered database instances
 */
const registeredDatabases = new Map<DatabaseName, DrizzleDatabase>();

/**
 * Map of active transaction databases by transaction ID
 */
const transactionDatabases = new Map<string, DrizzleTransaction>();

/**
 * Register a Drizzle database instance for transactional usage
 */
export function addTransactionalDrizzleDatabase(
  database: DrizzleDatabase,
  name: DatabaseName = "default"
): void {
  if (registeredDatabases.has(name)) {
    throw new DrizzleTransactionalError(
      `Database with name "${name}" is already registered.`,
      { code: "DATABASE_ALREADY_REGISTERED", details: { databaseName: name } }
    );
  }

  registeredDatabases.set(name, database);
}

/**
 * Get a registered database by name
 */
export function getDrizzleDatabaseByName(
  name: DatabaseName = "default"
): DrizzleDatabase {
  const database = registeredDatabases.get(name);
  if (!database) {
    throw DrizzleTransactionalError.databaseNotFound(name);
  }
  return database;
}

/**
 * Remove a registered database by name
 */
export function removeDrizzleDatabaseByName(
  name: DatabaseName = "default"
): boolean {
  return registeredDatabases.delete(name);
}

/**
 * Get the current transactional database info for a given database name
 */
export function getCurrentDatabaseInfo(
  name: DatabaseName = "default"
): TransactionalDatabaseInfo {
  const baseDatabase = getDrizzleDatabaseByName(name);
  const currentDbId = getContextValue<string>(CURRENT_DB_ID_KEY);

  if (!currentDbId) {
    // Not in a transaction context
    return {
      database: baseDatabase,
      isTransacting: false,
      baseDatabase,
    };
  }

  const transactionDb = transactionDatabases.get(currentDbId);
  if (!transactionDb) {
    throw new DrizzleTransactionalError(
      `No transaction database found for ID: ${currentDbId}`
    );
  }

  return {
    database: transactionDb as any, // Type assertion needed due to Drizzle's complex types
    isTransacting: true,
    baseDatabase,
  };
}

/**
 * Cache for bound methods to avoid recreating them on each access
 */
const methodCache = new WeakMap<object, Map<string | symbol, Function>>();

/**
 * Create a transactional database proxy that automatically returns the correct database instance
 */
export function createTransactionalDatabaseProxy(
  name: DatabaseName = "default"
): DrizzleDatabase {
  return new Proxy({} as DrizzleDatabase, {
    get(_, prop) {
      const dbInfo = getCurrentDatabaseInfo(name);
      const target = dbInfo.database as any;

      // Handle special properties directly
      if (prop === "isTransacting") {
        return dbInfo.isTransacting;
      }

      if (prop === "baseDatabase") {
        return dbInfo.baseDatabase;
      }

      const value = target[prop];

      // Cache bound methods for better performance
      if (typeof value === "function") {
        let cache = methodCache.get(target);
        if (!cache) {
          cache = new Map();
          methodCache.set(target, cache);
        }

        const cachedMethod = cache.get(prop);
        if (cachedMethod) {
          return cachedMethod;
        }

        const boundMethod = value.bind(target);
        cache.set(prop, boundMethod);
        return boundMethod;
      }

      return value;
    },

    set(_, prop, value) {
      const dbInfo = getCurrentDatabaseInfo(name);
      const target = dbInfo.database as any;
      target[prop] = value;
      return true;
    },

    has(_, prop) {
      if (prop === "isTransacting" || prop === "baseDatabase") {
        return true;
      }
      const dbInfo = getCurrentDatabaseInfo(name);
      return prop in dbInfo.database;
    },

    ownKeys(_) {
      const dbInfo = getCurrentDatabaseInfo(name);
      const keys = Reflect.ownKeys(dbInfo.database);
      return [...keys, "isTransacting", "baseDatabase"];
    },

    getOwnPropertyDescriptor(_, prop) {
      if (prop === "isTransacting" || prop === "baseDatabase") {
        return {
          enumerable: true,
          configurable: true,
          get: () => {
            const dbInfo = getCurrentDatabaseInfo(name);
            return prop === "isTransacting"
              ? dbInfo.isTransacting
              : dbInfo.baseDatabase;
          },
        };
      }

      const dbInfo = getCurrentDatabaseInfo(name);
      return Reflect.getOwnPropertyDescriptor(dbInfo.database, prop);
    },
  });
}

/**
 * Run a function within a database transaction context
 */
export async function runInDatabaseTransaction<T>(
  databaseName: DatabaseName,
  isolationLevel: string | undefined,
  callback: () => Promise<T>
): Promise<T> {
  const baseDatabase = getDrizzleDatabaseByName(databaseName);
  const transactionId = randomUUID();

  const transactionRunner = async (tx: DrizzleTransaction) => {
    // Store the transaction database
    transactionDatabases.set(transactionId, tx);

    try {
      // Run the callback in the transaction context
      return await runWithContext(
        { [CURRENT_DB_ID_KEY]: transactionId },
        callback
      );
    } finally {
      // Clean up the transaction database
      transactionDatabases.delete(transactionId);
    }
  };

  // Run the transaction with or without isolation level
  if (isolationLevel) {
    return await baseDatabase.transaction(transactionRunner, {
      isolationLevel: isolationLevel as any,
    });
  } else {
    return await baseDatabase.transaction(transactionRunner);
  }
}
