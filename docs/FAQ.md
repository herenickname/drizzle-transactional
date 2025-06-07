# FAQ - Frequently Asked Questions

Common questions and answers about Drizzle Transactional.

## General Questions

### Q: What is Drizzle Transactional?

**A:** Drizzle Transactional is a library that brings declarative transaction management to Drizzle ORM through decorators. It's inspired by TypeORM's transactional decorators and provides features like transaction propagation, isolation levels, and lifecycle hooks.

### Q: How is this different from using Drizzle's built-in transactions?

**A:** While Drizzle ORM provides basic transaction support, Drizzle Transactional adds:

- **Declarative approach** using decorators instead of manual transaction management
- **Transaction propagation** behaviors (REQUIRED, REQUIRES_NEW, etc.)
- **Lifecycle hooks** for commit/rollback events
- **Context management** using AsyncLocalStorage for thread-safe operations
- **Automatic rollback** on exceptions

### Q: Can I use this with existing Drizzle code?

**A:** Yes! Drizzle Transactional is designed to work alongside existing Drizzle code. You can gradually adopt transactional decorators without changing your existing database operations.

## Installation & Setup

### Q: What are the minimum requirements?

**A:**

- Node.js 18+
- TypeScript 5.0+
- Drizzle ORM 0.36+
- Experimental decorators enabled in TypeScript

### Q: What database do I need?

**A:** Drizzle Transactional is optimized for PostgreSQL and works with any PostgreSQL-compatible database. Other databases supported by Drizzle ORM should work but PostgreSQL is recommended for best performance.

### Q: How do I enable experimental decorators?

**A:** Add this to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Q: Do I need any special Node.js flags?

**A:** No special flags are required. Just ensure you're using Node.js 18+ with proper TypeScript configuration.

## Usage Questions

### Q: When should I use `@Transactional()` vs `@TransactionalClass()`?

**A:**

- Use `@Transactional()` on individual methods that need transaction management
- Use `@TransactionalClass()` when most/all methods in a class should be transactional

```typescript
// Individual method
class UserService {
  @Transactional()
  async createUser(data: UserData) {
    /* ... */
  }

  // Non-transactional method
  async getUserById(id: string) {
    /* ... */
  }
}

// Entire class
@TransactionalClass()
class OrderService {
  // All methods are automatically transactional
  async createOrder(data: OrderData) {
    /* ... */
  }
  async updateOrder(id: string, data: Partial<OrderData>) {
    /* ... */
  }
}
```

### Q: Can I nest transactional methods?

**A:** Yes! Transaction nesting behavior depends on the propagation setting:

```typescript
class ServiceA {
  @Transactional() // REQUIRED (default)
  async method1() {
    await serviceB.method2(); // Joins same transaction
  }
}

class ServiceB {
  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  async method2() {
    // Creates new transaction
  }
}
```

### Q: How do I handle errors in transactional methods?

**A:** Just throw an error or let exceptions bubble up. The transaction will automatically rollback:

```typescript
@Transactional()
async createUser(userData: UserData) {
  const user = await db.insert(users).values(userData).returning();

  if (!user[0]) {
    throw new Error("Failed to create user"); // Triggers rollback
  }

  return user[0];
}
```

### Q: When should I use different propagation behaviors?

**A:**

- **REQUIRED** (default): Join existing transaction or create new one
- **REQUIRES_NEW**: Always create a new transaction (useful for logging/auditing)
- **MANDATORY**: Must have existing transaction (throws if none exists)
- **NEVER**: Must not have transaction (throws if one exists)
- **NOT_SUPPORTED**: Suspend existing transaction
- **SUPPORTS**: Join if exists, run without if not

```typescript
// Logging should always succeed, even if main transaction fails
@Transactional({ propagation: Propagation.REQUIRES_NEW })
async logUserAction(userId: string, action: string) {
  await db.insert(auditLog).values({ userId, action, timestamp: new Date() });
}
```

## Hooks & Lifecycle

### Q: When do transaction hooks execute?

**A:**

- `runOnTransactionCommit`: After transaction commits successfully
- `runOnTransactionRollback`: After transaction rolls back
- `runOnTransactionComplete`: After transaction ends (commit or rollback)

### Q: Can hooks affect the transaction outcome?

**A:** No, hooks execute after the transaction is already committed or rolled back. Hook errors don't affect the transaction:

```typescript
@Transactional()
async method() {
  await db.insert(users).values(userData);

  runOnTransactionCommit(() => {
    throw new Error("Hook error"); // Transaction still commits
  });
}
```

### Q: How do I ensure hooks execute in order?

**A:** Hooks execute in the order they're registered:

```typescript
@Transactional()
async method() {
  runOnTransactionCommit(() => console.log("First"));
  runOnTransactionCommit(() => console.log("Second"));
  runOnTransactionCommit(() => console.log("Third"));
  // Executes: First, Second, Third
}
```

## Performance & Best Practices

### Q: Does using decorators impact performance?

**A:** The decorator overhead is minimal. The main performance considerations are:

- Transaction scope (keep it as small as possible)
- Isolation level (higher levels may cause more conflicts)
- Number of operations per transaction

### Q: Should I make every database operation transactional?

**A:** No, only use transactions when you need ACID properties:

- Multiple related operations that must succeed/fail together
- Data consistency requirements
- Complex business logic

Simple read operations rarely need transactions:

```typescript
// ✓ Good: Simple read, no transaction needed
async getUserById(id: string) {
  return await db.select().from(users).where(eq(users.id, id));
}

// ✓ Good: Multiple operations, transaction needed
@Transactional()
async createUserWithProfile(userData: UserData) {
  const user = await db.insert(users).values(userData).returning();
  await db.insert(profiles).values({ userId: user[0].id, ...userData.profile });
  return user[0];
}
```

### Q: What's the best way to handle large datasets?

**A:** Process in batches and consider using `REQUIRES_NEW` for each batch:

```typescript
async processBulkData(items: Item[]) {
  const batches = chunk(items, 1000);

  for (const batch of batches) {
    await this.processBatch(batch);
  }
}

@Transactional({ propagation: Propagation.REQUIRES_NEW })
async processBatch(items: Item[]) {
  await db.insert(itemsTable).values(items);
}
```

## Testing

### Q: How do I test transactional code?

**A:** Use in-memory databases or test databases with proper cleanup:

```typescript
describe("UserService", () => {
  beforeEach(async () => {
    // Clean database state
    await db.delete(users);
  });

  test("should rollback on error", async () => {
    const initialCount = await getUserCount();

    await expect(service.failingMethod()).rejects.toThrow();

    const finalCount = await getUserCount();
    expect(finalCount).toBe(initialCount);
  });
});
```

### Q: How do I test hooks?

**A:** Use mocks or test doubles to verify hook execution:

```typescript
test("should send email on user creation", async () => {
  const emailSpy = jest.spyOn(emailService, "sendWelcomeEmail");

  await userService.createUser(userData);

  expect(emailSpy).toHaveBeenCalledWith(userData.email);
});
```

## Migration & Compatibility

### Q: How do I migrate from TypeORM transactional?

**A:** The API is very similar. Main changes:

- Import from `drizzle-transactional` instead of `typeorm-transactional`
- Initialize with Drizzle DB instance instead of TypeORM
- Use Drizzle query syntax instead of TypeORM repositories

See the [Migration Guide](Migration-Guide.md) for detailed steps.

### Q: Can I use this with other ORMs?

**A:** No, this library is specifically designed for Drizzle ORM and uses Drizzle's transaction mechanisms.

### Q: Is this compatible with Drizzle Studio?

**A:** Yes, Drizzle Transactional doesn't interfere with Drizzle Studio or any other Drizzle tooling.

## Troubleshooting

### Q: "Transactional context not found" error

**A:** This means the transactional system wasn't initialized. Add this before using decorators:

```typescript
import { initializeTransactional } from "drizzle-transactional";

await initializeTransactional({ db });
```

### Q: Decorators aren't working

**A:** Check that:

1. Experimental decorators are enabled in `tsconfig.json`
2. You're using Node.js with `--experimental-vm-modules`
3. The transactional system is initialized

### Q: Transactions aren't rolling back

**A:** Make sure errors are being thrown and not caught:

```typescript
@Transactional()
async method() {
  try {
    await riskyOperation();
  } catch (error) {
    console.error(error);
    // DON'T do this - swallows the error
    // return null;

    // DO this - re-throw to trigger rollback
    throw error;
  }
}
```

### Q: Poor performance with transactions

**A:** Consider:

- Reducing transaction scope
- Using lower isolation levels
- Batching operations
- Using `REQUIRES_NEW` for independent operations

For more troubleshooting help, see the [Troubleshooting Guide](Troubleshooting.md).

## Advanced Usage

### Q: Can I use custom isolation levels?

**A:** You can use any of the standard PostgreSQL isolation levels:

```typescript
@Transactional({
  isolationLevel: IsolationLevel.SERIALIZABLE
})
async criticalOperation() {
  // Highest isolation level
}
```

### Q: How do I handle deadlocks?

**A:** Implement retry logic for serialization failures:

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
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        continue;
      }
      throw error;
    }
  }
}
```

### Q: Can I access the current transaction?

**A:** You can access transaction context for debugging:

```typescript
import { getTransactionContext } from "drizzle-transactional";

@Transactional()
async method() {
  const context = getTransactionContext();
  console.log("Transaction ID:", context.id);
}
```

## Contributing & Support

### Q: How can I contribute?

**A:** Contributions are welcome! Please:

1. Read the [Contributing Guide](../CONTRIBUTING.md)
2. Check existing issues
3. Follow the code style
4. Add tests for new features

### Q: Where do I report bugs?

**A:** Create an issue on GitHub with:

- Minimal reproduction case
- Environment details (Node.js version, dependencies)
- Expected vs actual behavior

### Q: Is there a roadmap?

**A:** Check the GitHub project for planned features and current development status.

## Still Have Questions?

If your question isn't answered here:

1. Check the [API Reference](API-Reference.md) for detailed documentation
2. Look at [Examples](Examples.md) for usage patterns
3. Review the [Troubleshooting Guide](Troubleshooting.md) for common issues
4. Create an issue on GitHub for new questions

---

_This FAQ is updated regularly. If you have suggestions for new questions, please let us know!_
