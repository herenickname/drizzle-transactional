# Troubleshooting

This guide helps you diagnose and fix common issues when using Drizzle Transactional.

## Table of Contents

- [Common Issues](#common-issues)
- [Error Messages](#error-messages)
- [Configuration Problems](#configuration-problems)
- [Performance Issues](#performance-issues)
- [Transaction Problems](#transaction-problems)
- [Hook Issues](#hook-issues)
- [Debugging Tips](#debugging-tips)

## Common Issues

### Issue: "Transactional context not found"

**Error Message:**

```
Error: No transactional context found. Make sure to initialize the transactional system.
```

**Cause:** The transactional system hasn't been initialized.

**Solution:**

```typescript
import { initializeTransactional } from "drizzle-transactional";
import { db } from "./database";

// Initialize before using any transactional decorators
await initializeTransactional({ db });
```

**Note:** This must be called before any code that uses `@Transactional` decorators.

### Issue: Decorators Not Working

**Error Message:**

```
TypeError: Cannot read property 'apply' of undefined
```

**Cause:** TypeScript experimental decorators are not enabled.

**Solution:**

1. Enable experimental decorators in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

2. For Node.js, ensure you're using the `--experimental-vm-modules` flag:

```bash
node --experimental-vm-modules dist/index.js
```

### Issue: Database Connection Errors

**Error Message:**

```
Error: Connection terminated unexpectedly
```

**Cause:** Database connection is lost or not properly configured.

**Solution:**

1. Check database connection:

```typescript
// Test connection
try {
  await db.select().from(users).limit(1);
  console.log("Database connection OK");
} catch (error) {
  console.error("Database connection failed:", error);
}
```

2. For PostgreSQL, ensure proper connection:

```typescript
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const pool = new Pool({
  connectionString: "postgresql://username:password@localhost:5432/mydb",
});
const db = drizzle(pool);

// Initialize transactional system
initializeDrizzleTransactionalContext();
addTransactionalDrizzleDatabase(db, "default");
```

### Issue: Transactions Not Rolling Back

**Symptoms:** Data persists even when errors occur within transactional methods.

**Cause:** Errors are being caught and not re-thrown.

**Solution:**

```typescript
@Transactional()
async problematicMethod() {
  try {
    await someOperation();
  } catch (error) {
    console.error("Error occurred:", error);
    // WRONG: Don't swallow the error
    // return null;

    // CORRECT: Re-throw the error to trigger rollback
    throw error;
  }
}
```

### Issue: Hook Functions Not Executing

**Symptoms:** `runOnTransactionCommit` or `runOnTransactionRollback` callbacks are not executing.

**Cause:** Hooks are registered outside of a transactional context.

**Solution:**

```typescript
@Transactional()
async correctHookUsage() {
  // CORRECT: Register hooks inside transactional method
  runOnTransactionCommit(() => {
    console.log("Transaction committed");
  });

  await someOperation();
}

// WRONG: Registering hooks outside transactional context
async incorrectHookUsage() {
  runOnTransactionCommit(() => {
    console.log("This won't work");
  });
}
```

## Error Messages

### "Transaction already started"

**Full Error:**

```
Error: Transaction already started in this context
```

**Cause:** Attempting to start a new transaction when one is already active.

**Solution:**
Check your propagation behavior:

```typescript
// If you need a new transaction regardless of existing context
@Transactional({ propagation: Propagation.REQUIRES_NEW })
async method() {
  // This will always create a new transaction
}

// If you want to join existing transaction or create new if none exists
@Transactional({ propagation: Propagation.REQUIRED })
async method() {
  // This is the default behavior
}
```

### "Isolation level not supported"

**Full Error:**

```
Error: Isolation level CUSTOM not supported
```

**Cause:** Using an unsupported isolation level.

**Solution:**
Use supported isolation levels:

```typescript
import { IsolationLevel } from "drizzle-transactional";

@Transactional({
  isolationLevel: IsolationLevel.READ_COMMITTED // ✓ Supported
  // isolationLevel: "CUSTOM" // ✗ Not supported
})
async method() {
  // ...
}
```

Supported isolation levels:

- `READ_UNCOMMITTED`
- `READ_COMMITTED`
- `REPEATABLE_READ`
- `SERIALIZABLE`

### "Serialization failure"

**Full Error:**

```
Error: could not serialize access due to concurrent update
```

**Cause:** Concurrent transactions modifying the same data with `SERIALIZABLE` isolation.

**Solution:**

1. Implement retry logic:

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (error.code === "40001" && attempt < maxRetries) {
        // Serialization failure, retry
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 100)
        );
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

// Usage
const result = await withRetry(() =>
  service.updateUserWithSerializableIsolation(userId, data)
);
```

2. Consider using lower isolation level:

```typescript
@Transactional({ isolationLevel: IsolationLevel.READ_COMMITTED })
async updateUser(id: string, data: UserData) {
  // Less strict isolation, fewer conflicts
}
```

## Configuration Problems

### Wrong Database Driver

**Error Message:**

```
Error: Database driver not supported
```

**Solution:**
Ensure you're using a supported Drizzle database configuration:

```typescript
// ✓ Supported: PostgreSQL (recommended)
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const pool = new Pool({
  connectionString: "postgresql://username:password@localhost:5432/mydb",
});
const db = drizzle(pool);

// ✓ Also supported: MySQL
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

const connection = await createConnection({
  host: "localhost",
  user: "root",
  database: "mydb",
});
const db = drizzle(connection);
```

### Missing Schema Configuration

**Error Message:**

```
Error: Table not found
```

**Solution:**
Ensure your schema is properly configured:

```typescript
import * as schema from "./schema";

const db = drizzle(pool, { schema });
initializeDrizzleTransactionalContext();
addTransactionalDrizzleDatabase(db, "default");
```

## Performance Issues

### Slow Transaction Performance

**Symptoms:** Transactions are taking too long to complete.

**Diagnosis:**

1. Enable logging to see query execution times:

```typescript
const db = drizzle(client, {
  logger: true, // Enable query logging
});
```

2. Check for long-running operations:

```typescript
@Transactional()
async slowMethod() {
  console.time("transaction");

  await someOperation();

  console.timeEnd("transaction");
}
```

**Solutions:**

1. Reduce transaction scope:

```typescript
// WRONG: Large transaction scope
@Transactional()
async processLargeDataset(items: Item[]) {
  for (const item of items) {
    await processItem(item); // Each item in same transaction
  }
}

// BETTER: Smaller transaction scopes
async processLargeDataset(items: Item[]) {
  for (const item of items) {
    await this.processItemInTransaction(item);
  }
}

@Transactional()
async processItemInTransaction(item: Item) {
  await processItem(item);
}
```

2. Use batch operations:

```typescript
@Transactional()
async batchInsert(items: Item[]) {
  // Insert all items in one query instead of individual inserts
  await db.insert(itemsTable).values(items);
}
```

### High Memory Usage

**Symptoms:** Memory usage increases over time.

**Cause:** Hook functions holding references to large objects.

**Solution:**

```typescript
@Transactional()
async methodWithHooks() {
  const largeData = await loadLargeData();

  // WRONG: Hook holds reference to large data
  runOnTransactionCommit(() => {
    console.log("Processed", largeData.length, "items");
  });

  // BETTER: Extract only needed data
  const itemCount = largeData.length;
  runOnTransactionCommit(() => {
    console.log("Processed", itemCount, "items");
  });
}
```

## Transaction Problems

### Nested Transaction Issues

**Problem:** Unexpected behavior with nested transactions.

**Solution:**
Understand propagation behaviors:

```typescript
class ServiceA {
  @Transactional() // Uses REQUIRED by default
  async method1() {
    await serviceB.method2(); // Joins same transaction
  }
}

class ServiceB {
  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  async method2() {
    // Always creates new transaction
    throw new Error("This only rolls back method2");
  }
}
```

### Deadlock Detection

**Error Message:**

```
Error: deadlock detected
```

**Solution:**

1. Ensure consistent lock ordering:

```typescript
// WRONG: Inconsistent lock ordering
async transferMoney(fromId: number, toId: number, amount: number) {
  await lockAccount(fromId);
  await lockAccount(toId);
  // ... transfer logic
}

// CORRECT: Consistent lock ordering
async transferMoney(fromId: number, toId: number, amount: number) {
  const [firstId, secondId] = [fromId, toId].sort();
  await lockAccount(firstId);
  await lockAccount(secondId);
  // ... transfer logic
}
```

2. Use timeout for transactions:

```typescript
@Transactional({ timeout: 30000 }) // 30 second timeout
async longRunningOperation() {
  // ...
}
```

## Hook Issues

### Hooks Not Executing in Order

**Problem:** Multiple hooks don't execute in expected order.

**Solution:**
Hooks execute in registration order:

```typescript
@Transactional()
async method() {
  runOnTransactionCommit(() => console.log("First"));
  runOnTransactionCommit(() => console.log("Second"));
  runOnTransactionCommit(() => console.log("Third"));

  // Output will be: First, Second, Third
}
```

### Hook Errors Breaking Transaction

**Problem:** Error in hook function causes transaction to fail.

**Solution:**
Hook errors are isolated and don't affect transaction outcome:

```typescript
@Transactional()
async method() {
  await someOperation();

  runOnTransactionCommit(() => {
    throw new Error("Hook error"); // This won't rollback the transaction
  });

  // Transaction will still commit
}
```

If you need hook errors to affect the transaction, handle them explicitly:

```typescript
@Transactional()
async method() {
  await someOperation();

  try {
    // Critical post-processing that must succeed
    await criticalPostProcessing();
  } catch (error) {
    // This will cause rollback
    throw new Error(`Post-processing failed: ${error.message}`);
  }
}
```

## Debugging Tips

### Enable Debug Logging

```typescript
// Set environment variable
process.env.DEBUG = "drizzle-transactional:*";

// Or use logging in your code
import { setLogLevel } from "drizzle-transactional";

setLogLevel("debug"); // Enable debug logging
```

### Transaction Context Inspection

```typescript
import { getTransactionContext } from "drizzle-transactional";

@Transactional()
async debugMethod() {
  const context = getTransactionContext();
  console.log("Transaction ID:", context.id);
  console.log("Isolation Level:", context.isolationLevel);
  console.log("Propagation:", context.propagation);
}
```

### Testing Transaction Behavior

```typescript
// Test that transactions work as expected
describe("Transaction Debugging", () => {
  test("should rollback on error", async () => {
    const initialCount = await getUserCount();

    try {
      await service.failingMethod();
    } catch (error) {
      // Expected
    }

    const finalCount = await getUserCount();
    expect(finalCount).toBe(initialCount); // Should be unchanged
  });
});
```

### Performance Profiling

```typescript
class ProfiledService {
  @Transactional()
  async profiledMethod() {
    const start = process.hrtime.bigint();

    await someOperation();

    const end = process.hrtime.bigint();
    console.log(`Operation took ${Number(end - start) / 1_000_000}ms`);
  }
}
```

## Getting Help

If you're still experiencing issues:

1. **Check the logs** - Enable debug logging to see what's happening
2. **Simplify the code** - Create a minimal reproduction case
3. **Check dependencies** - Ensure all packages are up to date
4. **Review the documentation** - Check [API Reference](API-Reference.md) for correct usage
5. **Look at examples** - See [Examples](Examples.md) for working patterns

## Common Environment Issues

### Node.js Version

Ensure you're using Node.js 18+:

```bash
node --version # Should be 18.0.0 or higher
```

### TypeScript Configuration

Verify your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true
  }
}
```

### Package Versions

Check that all packages are compatible:

```bash
npm ls drizzle-orm drizzle-transactional pg
```

Expected versions:

- `drizzle-orm`: 0.36+
- `pg`: 8.11+
- `typescript`: 5.0+
- `@types/pg`: 8.11+ (for TypeScript support)

If issues persist, please create an issue with:

- Your environment details
- Minimal reproduction case
- Error messages and stack traces
- Relevant configuration files

## Next Steps

- Review [API Reference](API-Reference.md) for detailed documentation
- Check [Examples](Examples.md) for working code patterns
- Read [Testing Guide](Testing-Guide.md) for testing strategies
