# Migration Guide

This guide helps you migrate from TypeORM Transactional, plain Drizzle ORM, or other transaction management solutions to Drizzle Transactional.

## 🔄 From TypeORM Transactional

If you're coming from `typeorm-transactional`, the migration is straightforward since Drizzle Transactional is inspired by it.

### Package Replacement

```bash
# Remove TypeORM transactional
npm uninstall typeorm-transactional typeorm

# Install Drizzle Transactional
npm install drizzle-transactional drizzle-orm pg @types/pg
```

### Import Changes

```typescript
// Before (TypeORM)
import { Transactional } from "typeorm-transactional";
import { DataSource } from "typeorm";

// After (Drizzle)
import { Transactional } from "drizzle-transactional";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
```

### Initialization Changes

```typescript
// Before (TypeORM)
import { initializeTransactionalContext } from "typeorm-transactional";
initializeTransactionalContext();

// After (Drizzle)
import { initializeDrizzleTransactionalContext } from "drizzle-transactional";
initializeDrizzleTransactionalContext();
```

### Decorator Migration

Most decorators work exactly the same:

```typescript
// Before (TypeORM)
class UserService {
  @Transactional()
  async createUser(userData: CreateUserDto) {
    return await this.userRepository.save(userData);
  }

  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  async auditLog(action: string) {
    return await this.auditRepository.save({ action });
  }
}

// After (Drizzle) - Almost identical!
class UserService {
  @Transactional()
  async createUser(userData: CreateUserDto) {
    return await db.insert(users).values(userData).returning();
  }

  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  async auditLog(action: string) {
    return await db.insert(auditLogs).values({ action }).returning();
  }
}
```

### Database Setup

```typescript
// Before (TypeORM)
const dataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "username",
  password: "password",
  database: "mydb",
});
await dataSource.initialize();

// After (Drizzle)
const pool = new Pool({
  connectionString: "postgresql://username:password@localhost:5432/mydb",
  // or individual options:
  // host: "localhost",
  // port: 5432,
  // user: "username",
  // password: "password",
  // database: "mydb",
});
const database = drizzle(pool);
addTransactionalDrizzleDatabase(database, "default");
const db = createTransactionalDatabaseProxy("default");
```

### Repository to Query Migration

```typescript
// Before (TypeORM Repository)
@Entity()
class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
}

class UserService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>
  ) {}

  @Transactional()
  async findUser(id: number) {
    return await this.userRepository.findOne({ where: { id } });
  }

  @Transactional()
  async createUser(name: string) {
    return await this.userRepository.save({ name });
  }
}

// After (Drizzle Schema)
const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

class UserService {
  @Transactional()
  async findUser(id: number) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  @Transactional()
  async createUser(name: string) {
    return await db.insert(users).values({ name }).returning();
  }
}
```

## 🆕 From Plain Drizzle ORM

If you're using plain Drizzle ORM, migration provides immediate benefits with minimal changes.

### Gradual Migration Strategy

1. **Keep existing code working** (100% backward compatibility)
2. **Add decorators to new methods**
3. **Gradually refactor existing methods**
4. **Add hooks and advanced features**

### Step 1: Setup (No Code Changes Required)

```typescript
// Your existing Drizzle setup
const pool = new Pool({
  connectionString: "postgresql://username:password@localhost:5432/mydb",
});
const database = drizzle(pool);

// Add transactional context
import {
  initializeDrizzleTransactionalContext,
  addTransactionalDrizzleDatabase,
  createTransactionalDatabaseProxy,
} from "drizzle-transactional";

initializeDrizzleTransactionalContext();
addTransactionalDrizzleDatabase(database, "default");

// Create proxy (your existing 'database' still works!)
export const db = createTransactionalDatabaseProxy("default");
```

### Step 2: Existing Code Works Unchanged

```typescript
// This code continues to work exactly as before
async function getUsers() {
  return await db.select().from(users);
}

async function createUser(name: string, email: string) {
  return await db.insert(users).values({ name, email }).returning();
}

// Native transactions still work
await database.transaction(async (tx) => {
  await tx.insert(users).values({ name: "John" });
  await tx.insert(profiles).values({ userId: 1, bio: "Hello" });
});
```

### Step 3: Add Decorators to New Methods

```typescript
class UserService {
  // New method with decorator
  @Transactional()
  async createUserWithProfile(name: string, email: string, bio: string) {
    const user = await db.insert(users).values({ name, email }).returning();
    await db.insert(profiles).values({ userId: user[0].id, bio });
    return user[0];
  }

  // Existing method - no changes needed
  async getUser(id: number) {
    return await db.select().from(users).where(eq(users.id, id));
  }
}
```

### Step 4: Gradually Refactor

```typescript
class UserService {
  // Refactored with transaction support
  @Transactional()
  async updateUserWithLogging(id: number, updates: UserUpdates) {
    const user = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();

    // Add hooks for side effects
    runOnTransactionCommit(() => {
      auditService.logUserUpdate(id, updates);
    });

    return user[0];
  }

  // Original method still works
  async simpleUserUpdate(id: number, updates: UserUpdates) {
    return await db.update(users).set(updates).where(eq(users.id, id));
  }
}
```

### Step 5: Advanced Features

```typescript
class UserService {
  @Transactional({
    propagation: Propagation.REQUIRES_NEW,
    isolationLevel: IsolationLevel.SERIALIZABLE,
  })
  async criticalUserOperation(id: number) {
    // High isolation, independent transaction
  }
}
```

## 📊 From Other ORMs

### From Prisma

```typescript
// Before (Prisma)
async function transferFunds(fromId: number, toId: number, amount: number) {
  return await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: fromId },
      data: { balance: { decrement: amount } }
    });

    await tx.account.update({
      where: { id: toId },
      data: { balance: { increment: amount } }
    });
  });
}

// After (Drizzle Transactional)
@Transactional()
async function transferFunds(fromId: number, toId: number, amount: number) {
  await db.update(accounts)
    .set({ balance: sql`balance - ${amount}` })
    .where(eq(accounts.id, fromId));

  await db.update(accounts)
    .set({ balance: sql`balance + ${amount}` })
    .where(eq(accounts.id, toId));
}
```

### From Sequelize

```typescript
// Before (Sequelize)
async function createUserWithProfile(userData, profileData) {
  const transaction = await sequelize.transaction();
  try {
    const user = await User.create(userData, { transaction });
    const profile = await Profile.create({
      ...profileData,
      userId: user.id
    }, { transaction });

    await transaction.commit();
    return { user, profile };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// After (Drizzle Transactional)
@Transactional()
async function createUserWithProfile(userData: UserData, profileData: ProfileData) {
  const user = await db.insert(users).values(userData).returning();
  const profile = await db.insert(profiles).values({
    ...profileData,
    userId: user[0].id
  }).returning();

  return { user: user[0], profile: profile[0] };
}
```

## 🔧 Migration Patterns

### Pattern 1: Service-by-Service Migration

```typescript
// Migrate one service at a time
class OrderService {
  // Migrated methods
  @Transactional()
  async createOrder(orderData: OrderData) {
    // New transactional method
  }

  // Legacy methods (still work)
  async getOrder(id: number) {
    return await db.select().from(orders).where(eq(orders.id, id));
  }
}
```

### Pattern 2: Wrapper Migration

```typescript
// Create wrapper methods during migration
class UserService {
  @Transactional()
  async createUserTransactional(userData: UserData) {
    return await this.createUser(userData);
  }

  // Keep original method for compatibility
  async createUser(userData: UserData) {
    return await db.insert(users).values(userData).returning();
  }
}
```

### Pattern 3: Feature Flag Migration

```typescript
class PaymentService {
  async processPayment(paymentData: PaymentData) {
    if (config.useTransactionalDecorators) {
      return await this.processPaymentTransactional(paymentData);
    } else {
      return await this.processPaymentLegacy(paymentData);
    }
  }

  @Transactional()
  async processPaymentTransactional(paymentData: PaymentData) {
    // New implementation
  }

  async processPaymentLegacy(paymentData: PaymentData) {
    // Original implementation
  }
}
```

## 🧪 Testing Migration

### Before and After Tests

```typescript
describe("User Service Migration", () => {
  it("should work with legacy method", async () => {
    const userService = new UserService();
    const user = await userService.createUserLegacy({ name: "John" });
    expect(user).toBeDefined();
  });

  it("should work with transactional method", async () => {
    const userService = new UserService();
    const user = await userService.createUserTransactional({ name: "John" });
    expect(user).toBeDefined();
  });

  it("should rollback on error with transactional method", async () => {
    const userService = new UserService();

    await expect(async () => {
      await userService.createUserWithValidation({ name: "" }); // Invalid data
    }).rejects.toThrow();

    // Verify rollback
    const users = await db.select().from(usersTable);
    expect(users).toHaveLength(0);
  });
});
```

## ⚠️ Migration Gotchas

### Common Issues

1. **Forgot to Initialize Context**

   ```typescript
   // Don't forget this!
   initializeDrizzleTransactionalContext();
   ```

2. **Mixed Transaction Approaches**

   ```typescript
   // Avoid mixing
   @Transactional()
   async badMethod() {
     // Don't use native transaction inside decorator
     await database.transaction(async (tx) => { /* ... */ });
   }
   ```

3. **Hook Timing Issues**

   ```typescript
   @Transactional()
   async userCreation() {
     const user = await db.insert(users).values(data);

     // Hooks run after transaction, not immediately
     runOnTransactionCommit(() => {
       // This runs AFTER the method completes
     });
   }
   ```

### Best Practices

1. **Test Both Approaches During Migration**
2. **Use Feature Flags for Gradual Rollout**
3. **Monitor Performance During Migration**
4. **Keep Documentation Updated**

## 📋 Migration Checklist

### Pre-Migration

- [ ] Install Drizzle Transactional
- [ ] Update TypeScript config for decorators
- [ ] Setup test environment
- [ ] Document current transaction patterns

### During Migration

- [ ] Initialize transactional context
- [ ] Add database proxy setup
- [ ] Verify existing code still works
- [ ] Add decorators to new methods
- [ ] Test transaction rollbacks
- [ ] Add hooks for side effects

### Post-Migration

- [ ] Remove old transaction management code
- [ ] Update documentation
- [ ] Train team on new patterns
- [ ] Monitor performance
- [ ] Cleanup temporary wrapper methods

## 🚀 Next Steps After Migration

1. **[Advanced Features](Advanced-Features.md)** - Explore advanced capabilities
2. **[Performance](Performance.md)** - Optimize your implementation
3. **[Testing Guide](Testing-Guide.md)** - Test transactional code effectively
4. **[Troubleshooting](Troubleshooting.md)** - Solve common issues
