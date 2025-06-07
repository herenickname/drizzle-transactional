# Quick Start

Get up and running with Drizzle Transactional in just a few minutes!

## 🚀 Step 1: Setup Database and Initialize Context

```typescript
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  initializeDrizzleTransactionalContext,
  addTransactionalDrizzleDatabase,
  createTransactionalDatabaseProxy,
} from "drizzle-transactional";

// Create database connection
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

// Initialize transactional context
initializeDrizzleTransactionalContext();

// Register database
addTransactionalDrizzleDatabase(database, "default");

// Create transactional proxy
export const db = createTransactionalDatabaseProxy("default");
```

## 📋 Step 2: Define Your Schema

```typescript
import { pgTable, serial, text, boolean, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: integer("author_id").notNull(),
  published: boolean("published").notNull().default(false),
});
```

## 🎯 Step 3: Create Your First Transactional Service

```typescript
import { Transactional } from "drizzle-transactional";
import { eq } from "drizzle-orm";

export class UserService {
  @Transactional()
  async createUser(name: string, email: string) {
    const result = await db
      .insert(users)
      .values({ name, email })
      .returning({ id: users.id });

    return result[0];
  }

  @Transactional()
  async getUserById(id: number) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }
}
```

## 🪝 Step 4: Add Transaction Hooks

```typescript
import {
  Transactional,
  runOnTransactionCommit,
  runOnTransactionRollback,
} from "drizzle-transactional";

export class NotificationService {
  @Transactional()
  async createUserWithNotification(name: string, email: string) {
    const user = await db.insert(users).values({ name, email }).returning();

    // Register hooks
    runOnTransactionCommit(() => {
      console.log(`✅ User ${name} successfully created!`);
      // Send welcome email, etc.
    });

    runOnTransactionRollback((error) => {
      console.log(`❌ Failed to create user ${name}: ${error.message}`);
      // Log error, send alert, etc.
    });

    return user[0];
  }
}
```

## 🔄 Step 5: Use Programmatic Transactions

```typescript
import { runInTransaction } from "drizzle-transactional";

async function complexOperation() {
  return await runInTransaction(async () => {
    const userService = new UserService();
    const user = await userService.createUser("John", "john@example.com");

    const post = await db
      .insert(posts)
      .values({
        title: "Hello World",
        content: "My first post",
        authorId: user.id,
      })
      .returning();

    return { user, post };
  });
}
```

## 🧪 Step 6: Test Your Setup

Create a simple test file:

```typescript
// test.ts
import { setupDatabase } from "./setup"; // Your setup from Step 1

async function test() {
  const userService = new UserService();

  try {
    // Test basic transaction
    const user = await userService.createUser("Test User", "test@example.com");
    console.log("✅ User created:", user);

    // Test transaction with hooks
    const notificationService = new NotificationService();
    await notificationService.createUserWithNotification(
      "Jane",
      "jane@example.com"
    );

    // Test programmatic transaction
    const result = await complexOperation();
    console.log("✅ Complex operation completed:", result);
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

test();
```

Run your test:

```bash
node --experimental-vm-modules test.js
```

## 🎉 You're Ready!

You now have a working Drizzle Transactional setup! Here's what you can do next:

### Learn More

- **[Basic Usage](Basic-Usage.md)** - Explore more examples
- **[Decorators](Decorators.md)** - Deep dive into decorators
- **[Propagation Behaviors](Propagation-Behaviors.md)** - Advanced transaction control

### Advanced Features

- **[Transaction Hooks](Transaction-Hooks.md)** - Lifecycle management
- **[Multiple Databases](Multiple-Databases.md)** - Multi-database support
- **[Error Handling](Error-Handling.md)** - Robust error handling

### Migration

- **[Migration Guide](Migration-Guide.md)** - Migrate from TypeORM or plain Drizzle

## 🚨 Common First-Time Issues

### "Cannot use import statement outside a module"

- Add `"type": "module"` to your `package.json`
- Use `.js` extensions in imports when using ESM

### "Decorators are not valid here"

- Check your `tsconfig.json` has `experimentalDecorators: true`
- Ensure you're using TypeScript 5.0+

### Database connection issues

- Verify your PostgreSQL connection string is correct
- Check that PostgreSQL server is running and accessible

## 💡 Tips for Success

1. **Start Simple**: Begin with basic `@Transactional()` decorators
2. **Test Early**: Use hooks to verify transaction behavior
3. **Read Error Messages**: The library provides detailed error information
4. **Use TypeScript**: Full type safety helps catch issues early
5. **Check Examples**: See [Examples](Examples.md) for real-world patterns
