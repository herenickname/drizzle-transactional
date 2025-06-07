# API Reference

Complete API documentation for Drizzle Transactional.

## 📦 Core Functions

### `initializeDrizzleTransactionalContext(options?)`

Initializes the transactional context. Must be called before using any transactional features.

```typescript
function initializeDrizzleTransactionalContext(options?: {
  maxHookHandlers?: number;
}): void;
```

**Parameters:**

- `options.maxHookHandlers` (optional): Maximum number of hook handlers per transaction (default: 100)

**Example:**

```typescript
initializeDrizzleTransactionalContext({
  maxHookHandlers: 50,
});
```

### `addTransactionalDrizzleDatabase(database, name?)`

Registers a database instance for transactional operations.

```typescript
function addTransactionalDrizzleDatabase<T>(database: T, name?: string): void;
```

**Parameters:**

- `database`: Drizzle database instance
- `name` (optional): Database name identifier (default: "default")

**Example:**

```typescript
const db = drizzle(client);
addTransactionalDrizzleDatabase(db, "primary");
addTransactionalDrizzleDatabase(analyticsDb, "analytics");
```

### `createTransactionalDatabaseProxy(name?)`

Creates a proxy that automatically uses transactional context.

```typescript
function createTransactionalDatabaseProxy<T>(name?: string): T;
```

**Parameters:**

- `name` (optional): Database name to proxy (default: "default")

**Returns:** Proxied database instance

**Example:**

```typescript
export const db = createTransactionalDatabaseProxy("primary");
```

### `runInTransaction(fn, options?)`

Executes a function within a transaction context.

```typescript
function runInTransaction<T>(
  fn: () => Promise<T>,
  options?: TransactionOptions
): Promise<T>;
```

**Parameters:**

- `fn`: Async function to execute in transaction
- `options` (optional): Transaction configuration

**Returns:** Promise resolving to function result

**Example:**

```typescript
const result = await runInTransaction(
  async () => {
    const user = await db.insert(users).values(userData);
    const profile = await db.insert(profiles).values(profileData);
    return { user, profile };
  },
  {
    isolationLevel: IsolationLevel.SERIALIZABLE,
    propagation: Propagation.REQUIRES_NEW,
  }
);
```

## 🎯 Decorators

### `@Transactional(options?)`

Method decorator that wraps execution in a transaction.

```typescript
function Transactional(options?: TransactionOptions): MethodDecorator;
```

**Parameters:**

- `options` (optional): Transaction configuration

**Example:**

```typescript
class UserService {
  @Transactional()
  async createUser(name: string, email: string) {
    return await db.insert(users).values({ name, email });
  }

  @Transactional({
    propagation: Propagation.REQUIRES_NEW,
    isolationLevel: IsolationLevel.SERIALIZABLE,
    databaseName: "primary",
  })
  async criticalOperation() {
    // High-isolation, independent transaction
  }
}
```

### `@TransactionalClass(options?)`

Class decorator that applies transaction options to all methods.

```typescript
function TransactionalClass(options?: TransactionOptions): ClassDecorator;
```

**Parameters:**

- `options` (optional): Default transaction configuration for all methods

**Example:**

```typescript
@TransactionalClass({
  isolationLevel: IsolationLevel.READ_COMMITTED,
  databaseName: "analytics",
})
class AnalyticsService {
  async recordEvent(event: Event) {
    // Inherits class-level transaction options
  }

  @Transactional({ propagation: Propagation.NEVER })
  async getStats() {
    // Overrides class-level options
  }
}
```

## 🪝 Transaction Hooks

### `runOnTransactionCommit(handler)`

Registers a callback to execute on successful transaction commit.

```typescript
function runOnTransactionCommit(handler: () => void | Promise<void>): void;
```

**Parameters:**

- `handler`: Function to execute on commit

**Example:**

```typescript
@Transactional()
async createUser(userData: UserData) {
  const user = await db.insert(users).values(userData);

  runOnTransactionCommit(() => {
    emailService.sendWelcomeEmail(user.email);
  });

  return user;
}
```

### `runOnTransactionRollback(handler)`

Registers a callback to execute on transaction rollback.

```typescript
function runOnTransactionRollback(
  handler: (error: Error) => void | Promise<void>
): void;
```

**Parameters:**

- `handler`: Function to execute on rollback, receives error information

**Example:**

```typescript
@Transactional()
async processPayment(paymentData: PaymentData) {
  runOnTransactionRollback((error) => {
    logger.error('Payment failed', { error, paymentData });
    alertService.sendPaymentFailureAlert(paymentData.orderId);
  });

  return await db.insert(payments).values(paymentData);
}
```

### `runOnTransactionComplete(handler)`

Registers a callback to execute when transaction ends (success or failure).

```typescript
function runOnTransactionComplete(handler: () => void | Promise<void>): void;
```

**Parameters:**

- `handler`: Function to execute on transaction completion

**Example:**

```typescript
@Transactional()
async importData(data: DataItem[]) {
  const startTime = Date.now();

  runOnTransactionComplete(() => {
    const duration = Date.now() - startTime;
    metrics.recordTransactionDuration('data_import', duration);
  });

  // Process data...
}
```

## 📋 Types and Interfaces

### `TransactionOptions`

Configuration options for transactions.

```typescript
interface TransactionOptions {
  propagation?: Propagation;
  isolationLevel?: IsolationLevel;
  databaseName?: string;
}
```

### `Propagation`

Transaction propagation behaviors.

```typescript
enum Propagation {
  REQUIRED = "REQUIRED",
  REQUIRES_NEW = "REQUIRES_NEW",
  MANDATORY = "MANDATORY",
  NEVER = "NEVER",
  NOT_SUPPORTED = "NOT_SUPPORTED",
  SUPPORTS = "SUPPORTS",
  NESTED = "NESTED",
}
```

### `IsolationLevel`

Database isolation levels.

```typescript
enum IsolationLevel {
  READ_UNCOMMITTED = "READ UNCOMMITTED",
  READ_COMMITTED = "READ COMMITTED",
  REPEATABLE_READ = "REPEATABLE READ",
  SERIALIZABLE = "SERIALIZABLE",
}
```

### `DrizzleTransactionalError`

Custom error class for transaction-related errors.

```typescript
class DrizzleTransactionalError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: Record<string, any>
  );

  // Static factory methods
  static notInitialized(): DrizzleTransactionalError;
  static databaseNotFound(name: string): DrizzleTransactionalError;
  static propagationError(propagation: string): DrizzleTransactionalError;
  static contextError(message: string): DrizzleTransactionalError;
}
```

## 🔧 Utility Functions

### `memoize<T>(fn)`

Memoizes function results for performance optimization.

```typescript
function memoize<T extends (...args: any[]) => any>(fn: T): T;
```

**Example:**

```typescript
const expensiveOperation = memoize((id: number) => {
  return db.select().from(complexView).where(eq(complexView.id, id));
});
```

### `debounce(fn, delay)`

Delays function execution until after delay milliseconds.

```typescript
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void;
```

**Example:**

```typescript
const debouncedSave = debounce(async (data) => {
  await saveToDatabase(data);
}, 1000);
```

### `throttle(fn, limit)`

Limits function execution frequency.

```typescript
function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void;
```

**Example:**

```typescript
const throttledUpdate = throttle(async (userId, updates) => {
  await updateUser(userId, updates);
}, 5000);
```

### `createUniqueId()`

Generates unique identifiers.

```typescript
function createUniqueId(): string;
```

**Example:**

```typescript
const transactionId = createUniqueId();
logger.info(`Starting transaction: ${transactionId}`);
```

## 🔍 Type Checking Utilities

### `isFunction(value)`

Checks if value is a function.

```typescript
function isFunction(value: any): value is Function;
```

### `isObject(value)`

Checks if value is an object.

```typescript
function isObject(value: any): value is object;
```

### `hasOwnProperty(obj, prop)`

Type-safe property checking.

```typescript
function hasOwnProperty<T, K extends string>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown>;
```

## 📊 Context Management

### `getCurrentTransactionId()`

Gets the current transaction ID (if in transaction context).

```typescript
function getCurrentTransactionId(): string | undefined;
```

### `isInTransaction()`

Checks if currently in a transaction context.

```typescript
function isInTransaction(): boolean;
```

### `getTransactionDatabase(name?)`

Gets the database instance for the current transaction.

```typescript
function getTransactionDatabase<T>(name?: string): T | undefined;
```

## 🚨 Error Handling

### Error Codes

```typescript
const ERROR_CODES = {
  NOT_INITIALIZED: "DRIZZLE_TRANSACTIONAL_NOT_INITIALIZED",
  DATABASE_NOT_FOUND: "DRIZZLE_TRANSACTIONAL_DATABASE_NOT_FOUND",
  PROPAGATION_ERROR: "DRIZZLE_TRANSACTIONAL_PROPAGATION_ERROR",
  CONTEXT_ERROR: "DRIZZLE_TRANSACTIONAL_CONTEXT_ERROR",
} as const;
```

### Error Factory Methods

```typescript
// Context not initialized
DrizzleTransactionalError.notInitialized();

// Database not found
DrizzleTransactionalError.databaseNotFound("analytics");

// Propagation violation
DrizzleTransactionalError.propagationError("NEVER");

// Context error
DrizzleTransactionalError.contextError("Custom error message");
```

## 🔄 Advanced Context Operations

### `runWithContext(context, fn)`

Runs function with specific transaction context.

```typescript
function runWithContext<T>(
  context: TransactionContext,
  fn: () => Promise<T>
): Promise<T>;
```

### `getContext()`

Gets current transaction context.

```typescript
function getContext(): TransactionContext | undefined;
```

### `setContext(context)`

Sets transaction context.

```typescript
function setContext(context: TransactionContext): void;
```

## 📋 Configuration

### Global Configuration

```typescript
interface GlobalConfig {
  maxHookHandlers: number;
  defaultIsolationLevel: IsolationLevel;
  defaultPropagation: Propagation;
}

function configureGlobal(config: Partial<GlobalConfig>): void;
```

### Database Configuration

```typescript
interface DatabaseConfig {
  name: string;
  instance: any;
  defaultOptions: TransactionOptions;
}

function configureDatabases(configs: DatabaseConfig[]): void;
```

## 🧪 Testing Utilities

### Test Context

```typescript
function createTestContext(): TransactionContext;
function resetTestContext(): void;
function mockTransactionHooks(): {
  commitHooks: Array<() => void>;
  rollbackHooks: Array<(error: Error) => void>;
  completeHooks: Array<() => void>;
};
```

### Example Usage

```typescript
describe("Transactional Tests", () => {
  beforeEach(() => {
    resetTestContext();
  });

  it("should execute commit hooks", async () => {
    const { commitHooks } = mockTransactionHooks();

    await runInTransaction(async () => {
      runOnTransactionCommit(() => {
        commitHooks.push(() => console.log("Committed!"));
      });
    });

    expect(commitHooks).toHaveLength(1);
  });
});
```

## 📚 Type Definitions

### Complete Type Export

```typescript
export {
  // Core types
  TransactionOptions,
  Propagation,
  IsolationLevel,

  // Error types
  DrizzleTransactionalError,

  // Context types
  TransactionContext,

  // Utility types
  Memoized,
  Debounced,
  Throttled,
};
```

This API reference covers all public interfaces of Drizzle Transactional. For implementation examples, see [Examples](Examples.md) and [Testing Guide](Testing-Guide.md).
