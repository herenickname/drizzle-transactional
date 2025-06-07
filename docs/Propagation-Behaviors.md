# Propagation Behaviors

Propagation behaviors define how transactions interact when methods call each other. This is one of the most powerful features of Drizzle Transactional.

## 📋 Overview

| Propagation     | Description                                           | Use Case                                   |
| --------------- | ----------------------------------------------------- | ------------------------------------------ |
| `REQUIRED`      | Join existing transaction or create new one (default) | Most common operations                     |
| `REQUIRES_NEW`  | Always create new transaction                         | Independent operations                     |
| `MANDATORY`     | Must be called within existing transaction            | Ensuring transactional context             |
| `NEVER`         | Must NOT be called within transaction                 | Read-only operations                       |
| `NOT_SUPPORTED` | Suspend current transaction                           | Operations that shouldn't be transactional |
| `SUPPORTS`      | Join if exists, otherwise run without transaction     | Flexible operations                        |
| `NESTED`        | Create nested transaction (treated as REQUIRES_NEW)   | Complex nested operations                  |

## 🎯 REQUIRED (Default)

**Behavior**: Join existing transaction or create a new one if none exists.

```typescript
import { Transactional, Propagation } from "drizzle-transactional";

class UserService {
  @Transactional() // Default is REQUIRED
  async createUser(name: string, email: string) {
    return await db.insert(users).values({ name, email }).returning();
  }

  @Transactional({ propagation: Propagation.REQUIRED })
  async updateUser(id: number, data: Partial<User>) {
    return await db.update(users).set(data).where(eq(users.id, id));
  }
}
```

**Example**: Nested calls share the same transaction:

```typescript
@Transactional()
async createUserWithProfile(userData: UserData, profileData: ProfileData) {
  // Transaction starts here
  const user = await this.createUser(userData.name, userData.email); // Joins same transaction
  const profile = await this.createProfile(user.id, profileData); // Joins same transaction
  return { user, profile };
  // Transaction commits here (or rolls back on error)
}
```

## 🔄 REQUIRES_NEW

**Behavior**: Always create a new transaction, suspending any existing transaction.

```typescript
class AuditService {
  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  async logAction(action: string, userId: number) {
    // This always runs in its own transaction
    return await db
      .insert(auditLogs)
      .values({ action, userId, timestamp: new Date() });
  }
}
```

**Example**: Independent audit logging:

```typescript
@Transactional()
async transferMoney(fromId: number, toId: number, amount: number) {
  try {
    await this.debitAccount(fromId, amount);
    await this.creditAccount(toId, amount);

    // Audit log runs in separate transaction
    // Even if main transaction fails, audit is preserved
    await auditService.logAction("TRANSFER", fromId);

  } catch (error) {
    // Main transaction rolls back, but audit log remains
    throw error;
  }
}
```

## ⚡ MANDATORY

**Behavior**: Must be called within an existing transaction. Throws error if no transaction exists.

```typescript
class PaymentService {
  @Transactional({ propagation: Propagation.MANDATORY })
  async processPayment(orderId: number, amount: number) {
    // This method REQUIRES a transaction to be active
    return await db.insert(payments).values({ orderId, amount });
  }
}
```

**Example**: Ensuring transactional context:

```typescript
@Transactional()
async placeOrder(orderData: OrderData) {
  const order = await this.createOrder(orderData);

  // This will work because we're in a transaction
  await paymentService.processPayment(order.id, orderData.total);
}

async directPayment() {
  // This will throw an error!
  await paymentService.processPayment(123, 100); // DrizzleTransactionalError
}
```

## 🚫 NEVER

**Behavior**: Must NOT be called within a transaction. Throws error if transaction exists.

```typescript
class ReportService {
  @Transactional({ propagation: Propagation.NEVER })
  async generateReport() {
    // This method must run outside transactions
    // Perfect for read-only operations or long-running tasks
    return await db
      .select()
      .from(orders)
      .where(gte(orders.createdAt, lastMonth));
  }
}
```

## 🔄 NOT_SUPPORTED

**Behavior**: Suspend any existing transaction and run without transaction.

```typescript
class CacheService {
  @Transactional({ propagation: Propagation.NOT_SUPPORTED })
  async updateCache(key: string, value: any) {
    // Runs outside any transaction context
    // Perfect for caching operations
    return await cacheStore.set(key, value);
  }
}
```

## 🤝 SUPPORTS

**Behavior**: Join existing transaction if present, otherwise run without transaction.

```typescript
class LogService {
  @Transactional({ propagation: Propagation.SUPPORTS })
  async log(message: string) {
    // Flexible: works both inside and outside transactions
    return await db.insert(logs).values({ message, timestamp: new Date() });
  }
}
```

## 🔗 NESTED

**Behavior**: Create nested transaction. With Drizzle/PostgreSQL, treated as REQUIRES_NEW.

```typescript
class OrderService {
  @Transactional({ propagation: Propagation.NESTED })
  async createOrderItem(orderId: number, itemData: ItemData) {
    // In supported databases, this would be a nested transaction
    // With Drizzle/PostgreSQL, creates a new transaction
    return await db.insert(orderItems).values({ orderId, ...itemData });
  }
}
```

## 🔀 Complex Propagation Examples

### Example 1: Order Processing with Multiple Services

```typescript
class OrderProcessingService {
  @Transactional() // REQUIRED
  async processOrder(orderData: OrderData) {
    // Main transaction starts
    const order = await orderService.createOrder(orderData); // Joins transaction

    // Payment in separate transaction (survives even if order fails)
    await paymentService.chargeCard(orderData.paymentInfo); // REQUIRES_NEW

    // Inventory check must be in transaction
    await inventoryService.reserveItems(orderData.items); // MANDATORY

    // Audit logging is flexible
    await auditService.logOrderCreated(order.id); // SUPPORTS

    return order;
  }
}

class PaymentService {
  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  async chargeCard(paymentInfo: PaymentInfo) {
    // Independent transaction - payment is processed regardless
    const payment = await db.insert(payments).values(paymentInfo);
    await externalPaymentGateway.charge(paymentInfo);
    return payment;
  }
}

class InventoryService {
  @Transactional({ propagation: Propagation.MANDATORY })
  async reserveItems(items: Item[]) {
    // Must be called within a transaction
    for (const item of items) {
      await db
        .update(inventory)
        .set({ reserved: sql`reserved + ${item.quantity}` })
        .where(eq(inventory.productId, item.productId));
    }
  }
}
```

### Example 2: Data Migration with Error Handling

```typescript
class MigrationService {
  @Transactional()
  async migrateUserData() {
    const users = await this.getAllUsers(); // SUPPORTS

    for (const user of users) {
      try {
        await this.migrateUser(user); // REQUIRES_NEW
      } catch (error) {
        // Log error but continue with other users
        await this.logMigrationError(user.id, error); // REQUIRES_NEW
      }
    }
  }

  @Transactional({ propagation: Propagation.SUPPORTS })
  async getAllUsers() {
    // Flexible - works in or out of transaction
    return await db.select().from(users);
  }

  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  async migrateUser(user: User) {
    // Each user migration is independent
    await db.insert(newUsersTable).values(transformUser(user));
    await this.updateUserFlags(user.id); // Joins this transaction
  }

  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  async logMigrationError(userId: number, error: Error) {
    // Error logging is independent
    await db.insert(migrationErrors).values({
      userId,
      error: error.message,
      timestamp: new Date(),
    });
  }
}
```

## 🔧 Propagation with Options

You can combine propagation with other transaction options:

```typescript
@Transactional({
  propagation: Propagation.REQUIRES_NEW,
  isolationLevel: IsolationLevel.SERIALIZABLE,
  databaseName: "analytics"
})
async generateCriticalReport() {
  // New transaction with high isolation on specific database
}
```

## ⚠️ Important Notes

### Drizzle/PostgreSQL Limitations

1. **NESTED**: Treated as REQUIRES_NEW due to Drizzle ORM limitations
2. **Savepoints**: Not fully supported, so nested transactions create new connections
3. **Warning Messages**: Library logs warnings when limitations are encountered

### Performance Considerations

1. **REQUIRES_NEW**: Creates new database connections, use sparingly
2. **MANDATORY**: Fastest when you know transaction context exists
3. **SUPPORTS**: Most flexible but slightly more overhead

### Error Handling

```typescript
@Transactional({ propagation: Propagation.REQUIRES_NEW })
async independentOperation() {
  try {
    // This transaction is independent
    await riskyOperation();
  } catch (error) {
    // This rollback doesn't affect parent transaction
    throw new BusinessLogicError("Independent operation failed");
  }
}
```

## 📚 Next Steps

- **[Isolation Levels](Isolation-Levels.md)** - Control transaction isolation
- **[Transaction Hooks](Transaction-Hooks.md)** - Add lifecycle callbacks
- **[Error Handling](Error-Handling.md)** - Handle propagation errors
