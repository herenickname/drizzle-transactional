# Transaction Hooks

Transaction hooks allow you to register callbacks that execute at specific points in the transaction lifecycle. This is perfect for cleanup operations, notifications, logging, and other side effects.

## 🪝 Available Hooks

| Hook                       | When It Executes                             | Use Cases                         |
| -------------------------- | -------------------------------------------- | --------------------------------- |
| `runOnTransactionCommit`   | After successful transaction commit          | Send notifications, update caches |
| `runOnTransactionRollback` | After transaction rollback (with error info) | Log errors, cleanup resources     |
| `runOnTransactionComplete` | After transaction ends (success or failure)  | General cleanup, metrics          |

## ✅ runOnTransactionCommit

Executes only when the transaction commits successfully.

```typescript
import { Transactional, runOnTransactionCommit } from "drizzle-transactional";

class UserService {
  @Transactional()
  async createUser(name: string, email: string) {
    const user = await db.insert(users).values({ name, email }).returning();

    runOnTransactionCommit(() => {
      console.log(`✅ User ${name} successfully created!`);
      // Send welcome email
      emailService.sendWelcomeEmail(email);
      // Update analytics
      analytics.track("user_created", { userId: user[0].id });
    });

    return user[0];
  }
}
```

### Multiple Commit Hooks

You can register multiple commit hooks in the same transaction:

```typescript
@Transactional()
async processOrder(orderData: OrderData) {
  const order = await db.insert(orders).values(orderData).returning();

  runOnTransactionCommit(() => {
    // Send confirmation email
    emailService.sendOrderConfirmation(order[0].id);
  });

  runOnTransactionCommit(() => {
    // Update inventory
    inventoryService.updateStock(orderData.items);
  });

  runOnTransactionCommit(() => {
    // Log analytics
    analytics.track('order_created', { orderId: order[0].id });
  });

  return order[0];
}
```

## ❌ runOnTransactionRollback

Executes when the transaction rolls back, providing error information.

```typescript
import { Transactional, runOnTransactionRollback } from "drizzle-transactional";

class PaymentService {
  @Transactional()
  async processPayment(orderId: number, amount: number) {
    const payment = await db.insert(payments).values({ orderId, amount });

    runOnTransactionRollback((error) => {
      console.error(`❌ Payment failed for order ${orderId}: ${error.message}`);

      // Log detailed error
      logger.error("Payment processing failed", {
        orderId,
        amount,
        error: error.message,
        stack: error.stack,
      });

      // Send alert to admin
      alertService.sendPaymentFailureAlert(orderId, error);

      // Update metrics
      metrics.increment("payment_failures");
    });

    // Simulate payment processing
    if (amount > 10000) {
      throw new Error("Amount exceeds limit");
    }

    return payment;
  }
}
```

## 🏁 runOnTransactionComplete

Executes after transaction ends, regardless of success or failure.

```typescript
import { Transactional, runOnTransactionComplete } from "drizzle-transactional";

class DataService {
  @Transactional()
  async importData(data: DataItem[]) {
    const startTime = Date.now();

    runOnTransactionComplete(() => {
      const duration = Date.now() - startTime;
      console.log(`🏁 Data import completed in ${duration}ms`);

      // Record metrics regardless of success/failure
      metrics.recordTransactionDuration("data_import", duration);

      // Cleanup temp resources
      tempFileService.cleanup();

      // Log completion
      logger.info("Data import transaction completed", {
        recordCount: data.length,
        duration,
      });
    });

    // Process data
    for (const item of data) {
      await db.insert(dataTable).values(item);
    }
  }
}
```

## 🔄 Combining All Hooks

```typescript
class OrderService {
  @Transactional()
  async createOrder(orderData: OrderData) {
    const transactionId = generateTransactionId();

    // Log transaction start
    logger.info(`Starting order creation transaction: ${transactionId}`);

    const order = await db.insert(orders).values(orderData).returning();

    // Success handler
    runOnTransactionCommit(() => {
      logger.info(`✅ Order ${order[0].id} created successfully`);
      emailService.sendOrderConfirmation(order[0].customerEmail);
      inventoryService.reserveItems(orderData.items);
      analytics.track("order_created", { orderId: order[0].id });
    });

    // Error handler
    runOnTransactionRollback((error) => {
      logger.error(`❌ Order creation failed: ${error.message}`, {
        transactionId,
        orderData,
        error: error.stack,
      });
      alertService.sendOrderCreationAlert(error);
      metrics.increment("order_creation_failures");
    });

    // Cleanup handler
    runOnTransactionComplete(() => {
      logger.info(`🏁 Order transaction completed: ${transactionId}`);
      sessionService.cleanup(transactionId);
      metrics.recordTransactionCompletion("order_creation");
    });

    return order[0];
  }
}
```

## 🔧 Advanced Hook Patterns

### Conditional Hooks

```typescript
@Transactional()
async updateUserProfile(userId: number, updates: ProfileUpdates) {
  const oldProfile = await db.select().from(profiles).where(eq(profiles.userId, userId));
  await db.update(profiles).set(updates).where(eq(profiles.userId, userId));

  // Only send notification if email changed
  if (updates.email && updates.email !== oldProfile[0].email) {
    runOnTransactionCommit(() => {
      emailService.sendEmailChangeNotification(updates.email);
    });
  }

  // Always log profile updates
  runOnTransactionCommit(() => {
    auditService.logProfileUpdate(userId, updates);
  });
}
```

### Hook with Async Operations

```typescript
@Transactional()
async createPost(postData: PostData) {
  const post = await db.insert(posts).values(postData).returning();

  runOnTransactionCommit(async () => {
    // Async operations in hooks
    try {
      await searchIndexService.indexPost(post[0]);
      await cacheService.invalidateUserPosts(postData.authorId);
      await notificationService.notifyFollowers(postData.authorId, post[0].id);
    } catch (error) {
      // Handle hook errors gracefully
      logger.error('Post-commit hook failed', error);
    }
  });

  return post[0];
}
```

### Hook Error Handling

```typescript
@Transactional()
async processLargeDataset(data: DataItem[]) {
  for (const item of data) {
    await db.insert(dataTable).values(item);
  }

  runOnTransactionCommit(() => {
    try {
      // Risky operation that might fail
      externalApiService.notifyCompletion(data.length);
    } catch (error) {
      // Don't let hook errors affect the main transaction
      logger.error('External API notification failed', error);

      // Schedule retry
      retryQueue.add('notify_completion', { recordCount: data.length });
    }
  });

  runOnTransactionRollback((error) => {
    // Cleanup on failure
    tempStorage.cleanup();
    logger.error('Large dataset processing failed', error);
  });
}
```

## 🧪 Testing with Hooks

Hooks are extremely useful for testing transaction behavior:

```typescript
// test-utils.ts
export class TransactionTestUtils {
  static commitCallbacks: (() => void)[] = [];
  static rollbackCallbacks: ((error: Error) => void)[] = [];
  static completeCallbacks: (() => void)[] = [];

  static setupTestHooks() {
    runOnTransactionCommit(() => {
      this.commitCallbacks.forEach((cb) => cb());
    });

    runOnTransactionRollback((error) => {
      this.rollbackCallbacks.forEach((cb) => cb(error));
    });

    runOnTransactionComplete(() => {
      this.completeCallbacks.forEach((cb) => cb());
    });
  }

  static reset() {
    this.commitCallbacks = [];
    this.rollbackCallbacks = [];
    this.completeCallbacks = [];
  }
}

// test.ts
describe("User Service", () => {
  beforeEach(() => {
    TransactionTestUtils.reset();
  });

  it("should send welcome email on successful user creation", async () => {
    let emailSent = false;

    TransactionTestUtils.commitCallbacks.push(() => {
      emailSent = true;
    });

    TransactionTestUtils.setupTestHooks();

    const userService = new UserService();
    await userService.createUser("John", "john@example.com");

    expect(emailSent).toBe(true);
  });
});
```

## ⚠️ Important Considerations

### Hook Execution Order

1. Hooks execute in the order they were registered
2. All commit hooks run before rollback hooks (obviously)
3. Complete hooks run after commit/rollback hooks

### Error Handling in Hooks

```typescript
runOnTransactionCommit(() => {
  try {
    // Risky operation
    riskyOperation();
  } catch (error) {
    // Always handle errors in hooks
    logger.error("Hook failed", error);
  }
});
```

### Performance

- Hooks add minimal overhead
- Async operations in hooks don't block transaction completion
- Use hooks for side effects, not critical business logic

### Memory Management

```typescript
// Avoid memory leaks in long-running applications
runOnTransactionComplete(() => {
  // Cleanup references
  largeObjectReference = null;
  tempArrays.length = 0;
});
```

## 🔗 Hook Integration with Services

### Event Service Integration

```typescript
class EventDrivenService {
  @Transactional()
  async createOrder(orderData: OrderData) {
    const order = await db.insert(orders).values(orderData).returning();

    runOnTransactionCommit(() => {
      // Publish domain events
      eventBus.publish("OrderCreated", {
        orderId: order[0].id,
        customerId: orderData.customerId,
        timestamp: new Date(),
      });
    });

    runOnTransactionRollback((error) => {
      // Publish failure events
      eventBus.publish("OrderCreationFailed", {
        orderData,
        error: error.message,
        timestamp: new Date(),
      });
    });

    return order[0];
  }
}
```

### Cache Integration

```typescript
class CachedUserService {
  @Transactional()
  async updateUser(userId: number, updates: UserUpdates) {
    await db.update(users).set(updates).where(eq(users.id, userId));

    runOnTransactionCommit(() => {
      // Invalidate cache only on successful update
      cache.delete(`user:${userId}`);
      cache.delete(`user:profile:${userId}`);
    });
  }
}
```

## 📚 Next Steps

- **[Error Handling](Error-Handling.md)** - Handle transaction errors
- **[Testing Guide](Testing-Guide.md)** - Test transactional code
- **[Performance](Performance.md)** - Optimize hook performance
