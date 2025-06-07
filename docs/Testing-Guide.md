# Testing Guide

This guide covers testing strategies and patterns for applications using Drizzle Transactional.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Setup](#test-setup)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [Transaction Testing](#transaction-testing)
- [Mocking Strategies](#mocking-strategies)
- [Common Patterns](#common-patterns)
- [Testing Hooks](#testing-hooks)

## Testing Philosophy

When testing transactional code, consider:

1. **Transaction Boundaries**: Test that transactions commit and rollback as expected
2. **Isolation**: Test that concurrent operations behave correctly
3. **Side Effects**: Test that hooks fire at the right times
4. **Error Handling**: Test rollback scenarios
5. **Performance**: Test transaction overhead

## Test Setup

### Basic Test Setup with PostgreSQL

```typescript
// test-setup.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  initializeDrizzleTransactionalContext,
  addTransactionalDrizzleDatabase,
  createTransactionalDatabaseProxy,
} from "drizzle-transactional";
import * as schema from "./schema";

let db: ReturnType<typeof createTransactionalDatabaseProxy>;
let pool: Pool;

export async function setupTestDatabase() {
  // Create test database connection
  pool = new Pool({
    connectionString:
      process.env.TEST_DATABASE_URL ||
      "postgresql://test:test@localhost:5432/test_db",
  });

  const database = drizzle(pool, { schema });

  // Initialize transactional system
  initializeDrizzleTransactionalContext();
  addTransactionalDrizzleDatabase(database, "default");
  db = createTransactionalDatabaseProxy("default");

  // Run migrations
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      bio TEXT,
      avatar VARCHAR(255)
    );
  `);

  return { db, pool };
}

export async function teardownTestDatabase() {
  await pool.end();
}

export async function cleanDatabase() {
  await pool.query(`
    TRUNCATE TABLE profiles, users RESTART IDENTITY CASCADE;
  `);
}
```

### Test Utilities

```typescript
// test-utils.ts
import { db } from "./test-setup";

export class TestHelpers {
  static async createTestUser(data: Partial<User> = {}) {
    const userData = {
      email: `test-${Date.now()}@example.com`,
      name: "Test User",
      ...data,
    };

    return await db.insert(users).values(userData).returning();
  }

  static async getUserCount(): Promise<number> {
    const result = await db.select({ count: sql`count(*)` }).from(users);
    return parseInt(result[0].count);
  }

  static async waitForMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static expectToThrow(fn: () => Promise<any>, expectedError?: string) {
    return async () => {
      try {
        await fn();
        throw new Error("Expected function to throw");
      } catch (error) {
        if (expectedError && !error.message.includes(expectedError)) {
          throw new Error(
            `Expected error to contain "${expectedError}", got: ${error.message}`
          );
        }
      }
    };
  }
}
```

## Unit Testing

### Testing Service Methods

```typescript
// user-service.test.ts
import { UserService } from "../src/services/user-service";
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
} from "./test-setup";
import { TestHelpers } from "./test-utils";

describe("UserService", () => {
  let userService: UserService;

  beforeAll(async () => {
    await setupTestDatabase();
    userService = new UserService();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("createUser", () => {
    test("should create user successfully", async () => {
      const userData = {
        email: "test@example.com",
        name: "Test User",
      };

      const user = await userService.createUser(userData);

      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.id).toBeDefined();
    });

    test("should rollback on profile creation failure", async () => {
      const userData = {
        email: "test@example.com",
        name: "Test User",
        profile: {
          bio: null, // This will cause constraint violation
        },
      };

      const initialCount = await TestHelpers.getUserCount();

      await TestHelpers.expectToThrow(
        () => userService.createUser(userData),
        "constraint violation"
      )();

      const finalCount = await TestHelpers.getUserCount();
      expect(finalCount).toBe(initialCount); // Should be rolled back
    });
  });
});
```

### Testing Decorators

```typescript
// decorators.test.ts
import { Transactional, TransactionalClass } from "drizzle-transactional";
import { Propagation } from "drizzle-transactional";

@TransactionalClass()
class TestService {
  @Transactional()
  async method1() {
    await TestHelpers.createTestUser();
    return "method1";
  }

  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  async method2() {
    await TestHelpers.createTestUser();
    throw new Error("Should rollback");
  }

  @Transactional()
  async callingMethod() {
    await this.method1(); // Should use existing transaction
    await this.method2(); // Should create new transaction
  }
}

describe("Transaction Decorators", () => {
  let service: TestService;

  beforeEach(async () => {
    await cleanDatabase();
    service = new TestService();
  });

  test("should commit transaction on success", async () => {
    const initialCount = await TestHelpers.getUserCount();

    await service.method1();

    const finalCount = await TestHelpers.getUserCount();
    expect(finalCount).toBe(initialCount + 1);
  });

  test("should rollback transaction on error", async () => {
    const initialCount = await TestHelpers.getUserCount();

    await TestHelpers.expectToThrow(() => service.method2())();

    const finalCount = await TestHelpers.getUserCount();
    expect(finalCount).toBe(initialCount); // Should be rolled back
  });

  test("should handle nested transactions correctly", async () => {
    const initialCount = await TestHelpers.getUserCount();

    await TestHelpers.expectToThrow(() => service.callingMethod())();

    const finalCount = await TestHelpers.getUserCount();
    // method1 should be rolled back, but method2 (REQUIRES_NEW) should also be rolled back
    expect(finalCount).toBe(initialCount);
  });
});
```

## Integration Testing

### Testing Real Workflows

```typescript
// order-processing.test.ts
import { OrderService } from "../src/services/order-service";
import { InventoryService } from "../src/services/inventory-service";
import { PaymentService } from "../src/services/payment-service";

describe("Order Processing Integration", () => {
  let orderService: OrderService;
  let inventoryService: InventoryService;
  let paymentService: PaymentService;

  beforeEach(async () => {
    await cleanDatabase();

    // Setup services
    inventoryService = new InventoryService();
    paymentService = new PaymentService();
    orderService = new OrderService(inventoryService, paymentService);

    // Setup test data
    await setupTestProducts();
    await setupTestUser();
  });

  test("should process order successfully", async () => {
    const orderData = {
      userId: 1,
      items: [
        { productId: 1, quantity: 2, price: 10.0 },
        { productId: 2, quantity: 1, price: 15.0 },
      ],
      total: 35.0,
      paymentMethod: "credit_card",
    };

    const order = await orderService.processOrder(orderData);

    expect(order.status).toBe("completed");
    expect(order.total).toBe(35.0);

    // Verify inventory was updated
    const product1 = await getProduct(1);
    expect(product1.stock).toBe(8); // Was 10, reduced by 2

    // Verify payment was processed
    const payment = await getPayment(order.paymentId);
    expect(payment.amount).toBe(35.0);
    expect(payment.status).toBe("completed");
  });

  test("should rollback on payment failure", async () => {
    const orderData = {
      userId: 1,
      items: [{ productId: 1, quantity: 2, price: 10.0 }],
      total: 20.0,
      paymentMethod: "invalid_card", // This will cause payment to fail
    };

    const initialStock = await getProduct(1);

    await TestHelpers.expectToThrow(
      () => orderService.processOrder(orderData),
      "Payment failed"
    )();

    // Verify inventory was not changed
    const finalStock = await getProduct(1);
    expect(finalStock.stock).toBe(initialStock.stock);

    // Verify no order was created
    const orders = await getOrdersByUser(1);
    expect(orders.length).toBe(0);
  });

  test("should rollback on insufficient inventory", async () => {
    const orderData = {
      userId: 1,
      items: [{ productId: 1, quantity: 20, price: 10.0 }], // More than available
      total: 200.0,
      paymentMethod: "credit_card",
    };

    await TestHelpers.expectToThrow(
      () => orderService.processOrder(orderData),
      "Insufficient stock"
    )();

    // Verify no payment was attempted
    const payments = await getPaymentsByUser(1);
    expect(payments.length).toBe(0);
  });
});
```

## Transaction Testing

### Testing Isolation Levels

```typescript
// isolation.test.ts
import { IsolationLevel } from "drizzle-transactional";

describe("Transaction Isolation", () => {
  test("should handle read committed isolation", async () => {
    const service1 = new TestService();
    const service2 = new TestService();

    // Start concurrent transactions
    const promise1 = service1.updateUserWithIsolation(
      1,
      { name: "Name1" },
      IsolationLevel.READ_COMMITTED
    );
    const promise2 = service2.updateUserWithIsolation(
      1,
      { name: "Name2" },
      IsolationLevel.READ_COMMITTED
    );

    const results = await Promise.allSettled([promise1, promise2]);

    // One should succeed, one should fail or retry
    const successful = results.filter((r) => r.status === "fulfilled");
    expect(successful.length).toBeGreaterThanOrEqual(1);
  });

  test("should handle serializable isolation", async () => {
    const service1 = new TestService();
    const service2 = new TestService();

    const promise1 = service1.updateUserWithIsolation(
      1,
      { name: "Name1" },
      IsolationLevel.SERIALIZABLE
    );
    const promise2 = service2.updateUserWithIsolation(
      1,
      { name: "Name2" },
      IsolationLevel.SERIALIZABLE
    );

    const results = await Promise.allSettled([promise1, promise2]);

    // One should succeed, one should fail with serialization error
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });
});
```

### Testing Propagation Behaviors

```typescript
// propagation.test.ts
describe("Transaction Propagation", () => {
  test("REQUIRED should join existing transaction", async () => {
    let transactionCount = 0;

    class CountingService {
      @Transactional({ propagation: Propagation.REQUIRED })
      async method1() {
        transactionCount++;
        await this.method2();
      }

      @Transactional({ propagation: Propagation.REQUIRED })
      async method2() {
        transactionCount++;
      }
    }

    const service = new CountingService();
    await service.method1();

    // Both methods should use the same transaction
    expect(transactionCount).toBe(1); // Only one transaction started
  });

  test("REQUIRES_NEW should create new transaction", async () => {
    let outerUser: User;
    let innerUser: User;

    class PropagationService {
      @Transactional()
      async outerMethod() {
        outerUser = await TestHelpers.createTestUser({ name: "Outer" });

        try {
          await this.innerMethod();
        } catch (error) {
          // Inner transaction failed, but outer should continue
        }

        return outerUser;
      }

      @Transactional({ propagation: Propagation.REQUIRES_NEW })
      async innerMethod() {
        innerUser = await TestHelpers.createTestUser({ name: "Inner" });
        throw new Error("Inner transaction fails");
      }
    }

    const service = new PropagationService();
    const result = await service.outerMethod();

    // Outer transaction should have committed
    expect(result.name).toBe("Outer");
    const users = await getAllUsers();
    expect(users.some((u) => u.name === "Outer")).toBe(true);
    expect(users.some((u) => u.name === "Inner")).toBe(false); // Rolled back
  });
});
```

## Testing Hooks

### Testing Transaction Hooks

```typescript
// hooks.test.ts
import {
  runOnTransactionCommit,
  runOnTransactionRollback,
  runOnTransactionComplete,
} from "drizzle-transactional";

describe("Transaction Hooks", () => {
  test("should execute commit hooks on successful transaction", async () => {
    let commitExecuted = false;
    let rollbackExecuted = false;
    let completeExecuted = false;

    class HookService {
      @Transactional()
      async createUserWithHooks(userData: UserData) {
        const user = await TestHelpers.createTestUser(userData);

        runOnTransactionCommit(() => {
          commitExecuted = true;
        });

        runOnTransactionRollback(() => {
          rollbackExecuted = true;
        });

        runOnTransactionComplete((committed) => {
          completeExecuted = true;
          expect(committed).toBe(true);
        });

        return user;
      }
    }

    const service = new HookService();
    await service.createUserWithHooks({
      name: "Test",
      email: "test@example.com",
    });

    // Wait for hooks to execute
    await TestHelpers.waitForMs(10);

    expect(commitExecuted).toBe(true);
    expect(rollbackExecuted).toBe(false);
    expect(completeExecuted).toBe(true);
  });

  test("should execute rollback hooks on failed transaction", async () => {
    let commitExecuted = false;
    let rollbackExecuted = false;
    let completeExecuted = false;

    class HookService {
      @Transactional()
      async failingMethod() {
        await TestHelpers.createTestUser();

        runOnTransactionCommit(() => {
          commitExecuted = true;
        });

        runOnTransactionRollback(() => {
          rollbackExecuted = true;
        });

        runOnTransactionComplete((committed) => {
          completeExecuted = true;
          expect(committed).toBe(false);
        });

        throw new Error("Transaction should fail");
      }
    }

    const service = new HookService();

    await TestHelpers.expectToThrow(() => service.failingMethod())();

    // Wait for hooks to execute
    await TestHelpers.waitForMs(10);

    expect(commitExecuted).toBe(false);
    expect(rollbackExecuted).toBe(true);
    expect(completeExecuted).toBe(true);
  });

  test("should handle hook errors gracefully", async () => {
    let hookError: Error | null = null;

    // Mock console.error to capture hook errors
    const originalConsoleError = console.error;
    console.error = (error: any) => {
      hookError = error;
    };

    class HookService {
      @Transactional()
      async methodWithFailingHook() {
        await TestHelpers.createTestUser();

        runOnTransactionCommit(() => {
          throw new Error("Hook fails");
        });
      }
    }

    const service = new HookService();

    // Transaction should still succeed even if hook fails
    const result = await service.methodWithFailingHook();
    expect(result).toBeDefined();

    // Wait for hook to execute and fail
    await TestHelpers.waitForMs(10);

    expect(hookError).toBeDefined();
    expect(hookError.message).toContain("Hook fails");

    // Restore console.error
    console.error = originalConsoleError;
  });
});
```

## Mocking Strategies

### Mocking External Services

```typescript
// mocks.test.ts
interface EmailService {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

class MockEmailService implements EmailService {
  public sentEmails: Array<{ to: string; subject: string; body: string }> = [];

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    this.sentEmails.push({ to, subject, body });
  }

  reset() {
    this.sentEmails = [];
  }

  getEmailsSentTo(email: string) {
    return this.sentEmails.filter((e) => e.to === email);
  }
}

describe("Service with External Dependencies", () => {
  let userService: UserService;
  let mockEmailService: MockEmailService;

  beforeEach(async () => {
    await cleanDatabase();
    mockEmailService = new MockEmailService();
    userService = new UserService(mockEmailService);
  });

  test("should send welcome email on user creation", async () => {
    const userData = {
      email: "test@example.com",
      name: "Test User",
    };

    await userService.createUser(userData);

    const emails = mockEmailService.getEmailsSentTo(userData.email);
    expect(emails.length).toBe(1);
    expect(emails[0].subject).toContain("Welcome");
  });

  test("should not send email if transaction rolls back", async () => {
    const userData = {
      email: "test@example.com",
      name: null, // This will cause validation error
    };

    await TestHelpers.expectToThrow(() => userService.createUser(userData))();

    const emails = mockEmailService.getEmailsSentTo(userData.email);
    expect(emails.length).toBe(0); // No email should be sent
  });
});
```

## Performance Testing

### Testing Transaction Overhead

```typescript
// performance.test.ts
describe("Performance Tests", () => {
  test("should handle high transaction volume", async () => {
    const service = new UserService();
    const startTime = Date.now();
    const userCount = 1000;

    const promises = Array.from({ length: userCount }, (_, i) =>
      service.createUser({
        email: `user${i}@example.com`,
        name: `User ${i}`,
      })
    );

    await Promise.all(promises);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`Created ${userCount} users in ${duration}ms`);
    expect(duration).toBeLessThan(30000); // Should complete in under 30 seconds

    const finalCount = await TestHelpers.getUserCount();
    expect(finalCount).toBe(userCount);
  });

  test("should handle concurrent transactions", async () => {
    const service = new UserService();
    const concurrency = 50;

    const promises = Array.from({ length: concurrency }, (_, i) =>
      service.createUser({
        email: `concurrent${i}@example.com`,
        name: `Concurrent User ${i}`,
      })
    );

    const results = await Promise.allSettled(promises);

    const successful = results.filter((r) => r.status === "fulfilled");
    expect(successful.length).toBe(concurrency);
  });
});
```

## Common Testing Patterns

### Test Data Builders

```typescript
// test-builders.ts
export class UserBuilder {
  private userData: Partial<User> = {};

  withEmail(email: string) {
    this.userData.email = email;
    return this;
  }

  withName(name: string) {
    this.userData.name = name;
    return this;
  }

  withProfile(profile: Partial<Profile>) {
    this.userData.profile = profile;
    return this;
  }

  build(): UserData {
    return {
      email: this.userData.email || `test-${Date.now()}@example.com`,
      name: this.userData.name || "Test User",
      ...this.userData,
    };
  }

  async create(): Promise<User> {
    const userData = this.build();
    return await TestHelpers.createTestUser(userData);
  }
}

export class OrderBuilder {
  private orderData: Partial<OrderData> = {};

  withUser(userId: number) {
    this.orderData.userId = userId;
    return this;
  }

  withItems(items: OrderItem[]) {
    this.orderData.items = items;
    return this;
  }

  withTotal(total: number) {
    this.orderData.total = total;
    return this;
  }

  build(): OrderData {
    return {
      userId: this.orderData.userId || 1,
      items: this.orderData.items || [],
      total: this.orderData.total || 0,
      paymentMethod: "credit_card",
      ...this.orderData,
    };
  }
}

// Usage in tests
test("should create user with profile", async () => {
  const user = await new UserBuilder()
    .withName("John Doe")
    .withEmail("john@example.com")
    .withProfile({ bio: "Software developer" })
    .create();

  expect(user.name).toBe("John Doe");
});
```

## Best Practices

1. **Clean State**: Always clean database state between tests
2. **Isolate Tests**: Each test should be independent
3. **Test Boundaries**: Test transaction commit/rollback scenarios
4. **Mock External Dependencies**: Use mocks for external services
5. **Test Error Cases**: Test rollback scenarios thoroughly
6. **Use Builders**: Use test data builders for complex objects
7. **Async Cleanup**: Ensure proper cleanup of async resources
8. **Hook Testing**: Test that hooks execute at the right times
9. **Concurrency Testing**: Test concurrent transaction scenarios
10. **Performance Monitoring**: Include performance tests for critical paths

## Next Steps

- Learn about [Propagation Behaviors](Propagation-Behaviors.md) for complex transaction scenarios
- Check out [Examples](Examples.md) for real-world usage patterns
- Review [API Reference](API-Reference.md) for complete method documentation
