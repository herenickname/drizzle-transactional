# Examples

This page contains real-world examples of using Drizzle Transactional in various scenarios.

## Table of Contents

- [Basic Service Layer](#basic-service-layer)
- [E-commerce Order Processing](#e-commerce-order-processing)
- [User Registration with Email](#user-registration-with-email)
- [Batch Operations](#batch-operations)
- [Transaction Hooks Usage](#transaction-hooks-usage)
- [Error Handling Patterns](#error-handling-patterns)

## Basic Service Layer

```typescript
import { Transactional, TransactionalClass } from "drizzle-transactional";
import { db } from "./database";
import { users, profiles } from "./schema";

@TransactionalClass()
class UserService {
  @Transactional()
  async createUser(userData: CreateUserData) {
    const user = await db
      .insert(users)
      .values({
        email: userData.email,
        name: userData.name,
      })
      .returning();

    await db.insert(profiles).values({
      userId: user[0].id,
      bio: userData.bio || "",
      avatar: userData.avatar,
    });

    return user[0];
  }

  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  async createUserWithNewTransaction(userData: CreateUserData) {
    // This will always run in a new transaction
    return this.createUser(userData);
  }
}
```

## E-commerce Order Processing

```typescript
import {
  Transactional,
  runOnTransactionCommit,
  runOnTransactionRollback,
} from "drizzle-transactional";
import { Propagation } from "drizzle-transactional";

@TransactionalClass()
class OrderService {
  constructor(
    private inventoryService: InventoryService,
    private paymentService: PaymentService,
    private emailService: EmailService,
    private notificationService: NotificationService
  ) {}

  @Transactional()
  async processOrder(orderData: OrderData) {
    // 1. Create order record
    const order = await db
      .insert(orders)
      .values({
        userId: orderData.userId,
        status: "processing",
        total: orderData.total,
      })
      .returning();

    // 2. Reserve inventory (nested transaction)
    await this.inventoryService.reserveItems(orderData.items);

    // 3. Process payment (nested transaction)
    const payment = await this.paymentService.processPayment({
      orderId: order[0].id,
      amount: orderData.total,
      method: orderData.paymentMethod,
    });

    // 4. Update order status
    await db
      .update(orders)
      .set({
        status: "completed",
        paymentId: payment.id,
        completedAt: new Date(),
      })
      .where(eq(orders.id, order[0].id));

    // 5. Schedule post-transaction actions
    runOnTransactionCommit(() => {
      // Send confirmation email
      this.emailService.sendOrderConfirmation(order[0]);

      // Send push notification
      this.notificationService.sendOrderNotification(
        orderData.userId,
        order[0]
      );

      // Update analytics
      this.analyticsService.trackOrderCompleted(order[0]);
    });

    runOnTransactionRollback(() => {
      // Log failed order for analysis
      this.logger.error("Order processing failed", { orderId: order[0].id });

      // Send failure notification
      this.emailService.sendOrderFailureNotification(orderData.userId);
    });

    return order[0];
  }
}

@TransactionalClass()
class InventoryService {
  @Transactional({ propagation: Propagation.REQUIRED })
  async reserveItems(items: OrderItem[]) {
    for (const item of items) {
      const product = await db
        .select()
        .from(products)
        .where(eq(products.id, item.productId))
        .for("update"); // Lock for update

      if (product[0].stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }

      // Reduce stock
      await db
        .update(products)
        .set({
          stock: product[0].stock - item.quantity,
          reservedStock: product[0].reservedStock + item.quantity,
        })
        .where(eq(products.id, item.productId));

      // Create reservation record
      await db.insert(inventoryReservations).values({
        productId: item.productId,
        quantity: item.quantity,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      });
    }
  }
}
```

## User Registration with Email

```typescript
@TransactionalClass()
class AuthService {
  constructor(
    private emailService: EmailService,
    private auditService: AuditService
  ) {}

  @Transactional()
  async registerUser(registrationData: UserRegistrationData) {
    // 1. Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, registrationData.email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error("User already exists");
    }

    // 2. Create user account
    const user = await db
      .insert(users)
      .values({
        email: registrationData.email,
        hashedPassword: await this.hashPassword(registrationData.password),
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        isVerified: false,
      })
      .returning();

    // 3. Create email verification token
    const verificationToken = await db
      .insert(emailVerificationTokens)
      .values({
        userId: user[0].id,
        token: generateSecureToken(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      })
      .returning();

    // 4. Create user profile
    await db.insert(userProfiles).values({
      userId: user[0].id,
      displayName: `${registrationData.firstName} ${registrationData.lastName}`,
      createdAt: new Date(),
    });

    // 5. Log audit event (runs in same transaction)
    await this.auditService.logUserRegistration(user[0].id, {
      email: registrationData.email,
      ipAddress: registrationData.ipAddress,
      userAgent: registrationData.userAgent,
    });

    // 6. Schedule post-transaction actions
    runOnTransactionCommit(() => {
      // Send verification email
      this.emailService.sendEmailVerification(
        user[0].email,
        verificationToken[0].token
      );

      // Send welcome email
      this.emailService.sendWelcomeEmail(user[0]);

      // Track registration event
      this.analyticsService.trackUserRegistration(user[0]);
    });

    return {
      user: user[0],
      verificationToken: verificationToken[0].token,
    };
  }
}
```

## Batch Operations

```typescript
@TransactionalClass()
class BatchService {
  @Transactional()
  async batchUpdateUsers(updates: UserUpdate[]) {
    const results = [];

    for (const update of updates) {
      try {
        const result = await db
          .update(users)
          .set(update.data)
          .where(eq(users.id, update.userId))
          .returning();

        results.push({ success: true, userId: update.userId, user: result[0] });
      } catch (error) {
        // Log error but continue with other updates
        console.error(`Failed to update user ${update.userId}:`, error);
        results.push({
          success: false,
          userId: update.userId,
          error: error.message,
        });
      }
    }

    // If any critical updates failed, rollback all
    const failedCritical = results.filter(
      (r) => !r.success && updates.find((u) => u.userId === r.userId)?.critical
    );
    if (failedCritical.length > 0) {
      throw new Error(
        `Critical updates failed: ${failedCritical
          .map((f) => f.userId)
          .join(", ")}`
      );
    }

    return results;
  }

  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  async batchProcessWithIndependentTransactions(items: ProcessItem[]) {
    const results = [];

    for (const item of items) {
      try {
        // Each item is processed in its own transaction
        const result = await this.processItemInNewTransaction(item);
        results.push({ success: true, itemId: item.id, result });
      } catch (error) {
        // Failed items don't affect others
        results.push({ success: false, itemId: item.id, error: error.message });
      }
    }

    return results;
  }

  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  private async processItemInNewTransaction(item: ProcessItem) {
    // This runs in its own transaction, isolated from the batch
    return await db.insert(processedItems).values(item).returning();
  }
}
```

## Transaction Hooks Usage

```typescript
@TransactionalClass()
class OrderService {
  @Transactional()
  async createOrderWithHooks(orderData: OrderData) {
    // Create the order
    const order = await db.insert(orders).values(orderData).returning();

    // Register commit hooks
    runOnTransactionCommit(() => {
      console.log(`Order ${order[0].id} committed successfully`);

      // Send notifications
      this.notificationService.sendOrderCreated(order[0]);

      // Update cache
      this.cacheService.invalidateUserOrders(order[0].userId);

      // Trigger external webhooks
      this.webhookService.triggerOrderCreated(order[0]);
    });

    // Register rollback hooks
    runOnTransactionRollback(() => {
      console.log(`Order ${order[0].id} rolled back`);

      // Clean up any external resources
      this.externalService.cleanupOrderResources(order[0].id);

      // Log failure for analysis
      this.auditService.logOrderFailure(order[0], "Transaction rolled back");
    });

    // Register completion hooks (runs on both commit and rollback)
    runOnTransactionComplete((committed) => {
      const status = committed ? "committed" : "rolled back";
      console.log(`Order ${order[0].id} transaction ${status}`);

      // Always update metrics
      this.metricsService.recordOrderTransaction(order[0], committed);
    });

    return order[0];
  }
}
```

## Error Handling Patterns

```typescript
@TransactionalClass()
class RobustService {
  @Transactional()
  async processWithRetry(data: ProcessData, maxRetries = 3) {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.doProcess(data);
      } catch (error) {
        lastError = error;

        // Log attempt
        console.warn(`Process attempt ${attempt} failed:`, error.message);

        // Don't retry on certain errors
        if (
          error instanceof ValidationError ||
          error instanceof AuthenticationError
        ) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw new Error(
      `Process failed after ${maxRetries} attempts. Last error: ${lastError.message}`
    );
  }

  @Transactional()
  async processWithFallback(data: ProcessData) {
    try {
      // Try primary processing
      return await this.primaryProcess(data);
    } catch (error) {
      console.warn("Primary process failed, trying fallback:", error.message);

      try {
        // Try fallback processing
        return await this.fallbackProcess(data);
      } catch (fallbackError) {
        // Both failed, log and rethrow original error
        console.error("Both primary and fallback processing failed", {
          primary: error.message,
          fallback: fallbackError.message,
        });

        throw error; // Throw original error
      }
    }
  }

  @Transactional({
    propagation: Propagation.REQUIRES_NEW,
    isolationLevel: IsolationLevel.SERIALIZABLE,
  })
  async handleConcurrentUpdates(id: string, updateData: UpdateData) {
    try {
      // Use optimistic locking with version field
      const current = await db
        .select()
        .from(entities)
        .where(eq(entities.id, id))
        .for("update");

      if (!current.length) {
        throw new Error("Entity not found");
      }

      if (current[0].version !== updateData.expectedVersion) {
        throw new OptimisticLockError(
          "Entity was modified by another transaction"
        );
      }

      return await db
        .update(entities)
        .set({
          ...updateData,
          version: current[0].version + 1,
          updatedAt: new Date(),
        })
        .where(eq(entities.id, id))
        .returning();
    } catch (error) {
      if (error.code === "40001") {
        // Serialization failure
        throw new ConcurrencyError("Concurrent update detected, please retry");
      }
      throw error;
    }
  }
}
```

## Performance Patterns

```typescript
@TransactionalClass()
class PerformanceOptimizedService {
  @Transactional({ isolationLevel: IsolationLevel.READ_COMMITTED })
  async bulkInsert(items: InsertItem[]) {
    // Use batch insert for better performance
    const batches = this.chunk(items, 1000); // Process in batches of 1000
    const results = [];

    for (const batch of batches) {
      const batchResult = await db.insert(items).values(batch).returning();
      results.push(...batchResult);
    }

    return results;
  }

  @Transactional()
  async optimizedUserCreation(userData: UserData) {
    // Use a single query with CTE for related data
    const result = await db.execute(sql`
      WITH new_user AS (
        INSERT INTO users (email, name, created_at)
        VALUES (${userData.email}, ${userData.name}, NOW())
        RETURNING id, email, name
      ),
      new_profile AS (
        INSERT INTO user_profiles (user_id, bio, avatar)
        SELECT id, ${userData.bio}, ${userData.avatar}
        FROM new_user
        RETURNING user_id, bio, avatar
      )
      SELECT 
        u.id, u.email, u.name,
        p.bio, p.avatar
      FROM new_user u
      LEFT JOIN new_profile p ON p.user_id = u.id
    `);

    return result.rows[0];
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

## Testing Examples

For testing patterns and examples, see the [Testing Guide](Testing-Guide.md).

## Next Steps

- Learn about [Transaction Hooks](Transaction-Hooks.md) for lifecycle management
- Explore [Propagation Behaviors](Propagation-Behaviors.md) for complex scenarios
- Check the [API Reference](API-Reference.md) for complete method documentation
