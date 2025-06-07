import { drizzle } from "drizzle-orm/node-postgres";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Pool } from "pg";

// Database schema - same as before but now for real PostgreSQL
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content"),
  authorId: integer("author_id").references(() => users.id),
  published: boolean("published").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  postId: integer("post_id").references(() => posts.id),
  authorId: integer("author_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Database configuration
const TEST_DB_CONFIG = {
  host: "localhost",
  port: 5433,
  database: "test_db",
  user: "test_user",
  password: "test_password",
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

let globalPool: Pool | null = null;

/**
 * Setup database connection for tests
 */
export async function setupDatabase() {
  if (globalPool) {
    // Reuse existing connection
    const db = drizzle(globalPool);
    return { client: globalPool, db };
  }

  console.log("🔗 Connecting to PostgreSQL test database...");

  try {
    const pool = new Pool(TEST_DB_CONFIG);

    // Test connection
    const client = await pool.connect();
    await client.query("SELECT NOW()");
    client.release();

    globalPool = pool;
    const db = drizzle(pool);

    console.log("✅ PostgreSQL connection established");

    // Clean up existing test data
    await cleanupTestData(db);

    return { client: pool, db };
  } catch (error) {
    console.error("❌ Failed to connect to PostgreSQL:", error);
    throw new Error(`Database connection failed: ${error}`);
  }
}

/**
 * Clean up test data between test runs
 */
export async function cleanupTestData(db: ReturnType<typeof drizzle>) {
  try {
    // Delete in correct order due to foreign key constraints
    await db.delete(comments);
    await db.delete(posts);
    await db.delete(users);

    // Reset sequences
    await db.execute(`ALTER SEQUENCE users_id_seq RESTART WITH 1`);
    await db.execute(`ALTER SEQUENCE posts_id_seq RESTART WITH 1`);
    await db.execute(`ALTER SEQUENCE comments_id_seq RESTART WITH 1`);

    console.log("🧹 Test data cleaned up");
  } catch (error) {
    console.warn("⚠️ Warning: Failed to cleanup test data:", error);
    // Don't throw error - tests can still run
  }
}

/**
 * Close database connection
 */
export async function closeDatabase() {
  if (globalPool) {
    await globalPool.end();
    globalPool = null;
    console.log("🔌 Database connection closed");
  }
}

/**
 * Get database connection info for debugging
 */
export function getDatabaseInfo() {
  return {
    config: TEST_DB_CONFIG,
    isConnected: globalPool !== null,
    totalConnections: globalPool?.totalCount || 0,
    idleConnections: globalPool?.idleCount || 0,
    waitingConnections: globalPool?.waitingCount || 0,
  };
}
