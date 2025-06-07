/**
 * Base error class for all Drizzle Transactional related errors
 */
export class DrizzleTransactionalError extends Error {
  public readonly name = "DrizzleTransactionalError";
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options?: {
      cause?: unknown;
      code?: string;
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    if (options?.cause) {
      this.cause = options.cause;
    }
    this.code = options?.code;
    this.details = options?.details;

    // Ensure the stack trace points to this constructor
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DrizzleTransactionalError);
    }
  }

  /**
   * Create an error for initialization issues
   */
  static notInitialized(): DrizzleTransactionalError {
    return new DrizzleTransactionalError(
      "Drizzle transactional context not initialized. Please call initializeDrizzleTransactionalContext() before application start.",
      { code: "NOT_INITIALIZED" }
    );
  }

  /**
   * Create an error for database issues
   */
  static databaseNotFound(name: string): DrizzleTransactionalError {
    return new DrizzleTransactionalError(
      `No database registered with name "${name}". Please call addTransactionalDrizzleDatabase() first.`,
      { code: "DATABASE_NOT_FOUND", details: { databaseName: name } }
    );
  }

  /**
   * Create an error for propagation issues
   */
  static propagationError(
    type: "MANDATORY" | "NEVER" | "UNKNOWN",
    propagation: string
  ): DrizzleTransactionalError {
    const messages = {
      MANDATORY:
        "No existing transaction found for transaction marked with propagation 'MANDATORY'",
      NEVER:
        "Found an existing transaction, transaction marked with propagation 'NEVER'",
      UNKNOWN: `Unknown propagation type: ${propagation}`,
    };

    return new DrizzleTransactionalError(messages[type], {
      code: `PROPAGATION_${type}`,
      details: { propagation },
    });
  }

  /**
   * Create an error for context issues
   */
  static contextError(
    type: "NO_CONTEXT" | "NO_HOOK"
  ): DrizzleTransactionalError {
    const messages = {
      NO_CONTEXT:
        "No transactional context found. Are you using @Transactional()?",
      NO_HOOK:
        "No hook manager found in context. Are you using @Transactional()?",
    };

    return new DrizzleTransactionalError(messages[type], {
      code: `CONTEXT_${type}`,
    });
  }
}
