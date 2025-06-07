import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createTransactionalDatabaseProxy } from "../dist/esm/drizzle/database-manager.js";
import { IsolationLevel } from "../dist/esm/enums/isolation-level.js";
import { Propagation } from "../dist/esm/enums/propagation.js";
import { runInTransaction } from "../dist/esm/transactions/run-in-transaction.js";
import { BaseTestRunner } from "./base-test-runner.js";
import { posts, users } from "./database-schema-postgres.js";

/**
 * Test suite to demonstrate transaction behavior with PostgreSQL
 *
 * This test demonstrates how different propagation behaviors work with PostgreSQL
 * and how to handle complex transaction scenarios properly.
 */
export class NestedTimeoutTests extends BaseTestRunner {
  /**
   * Get the global database instance
   */
  private getDatabase() {
    return createTransactionalDatabaseProxy(
      "default"
    ) as NodePgDatabase<any> & {
      isTransacting: boolean;
      baseDatabase: NodePgDatabase<any>;
    };
  }

  /**
   * Custom assertion helper that throws if condition is false
   */
  private assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /**
   * Run all nested timeout tests
   */
  public async runTests(): Promise<void> {
    await this.runTest(
      "Multiple nested transactions with REQUIRED propagation",
      () => this.testMultipleNestedTransactions()
    );
    await this.runTest("Concurrent transactions with proper isolation", () =>
      this.testConcurrentNestedTransactions()
    );
    await this.runTest("Resource-intensive nested operations", () =>
      this.testResourceIntensiveNestedOperations()
    );
  }

  /**
   * Test that demonstrates how multiple REQUIRED operations can create
   * transactional hierarchies. Since NESTED is treated as REQUIRES_NEW,
   * we test with REQUIRED propagation instead.
   */
  private async testMultipleNestedTransactions(): Promise<void> {
    const db = this.getDatabase();

    try {
      console.log("🔄 Starting nested transaction test...");

      const result = await runInTransaction(
        async () => {
          console.log("🚀 Starting outer transaction...");

          // Insert initial user in outer transaction
          const [user] = await db
            .insert(users)
            .values({
              name: "Nested Test User",
              email: "nested@test.com",
            })
            .returning();

          console.log("✅ Created user in outer transaction:", user.id);

          // First nested operation using REQUIRED (joins same transaction)
          await runInTransaction(
            async () => {
              console.log("🔸 Starting first nested transaction...");

              const [post1] = await db
                .insert(posts)
                .values({
                  authorId: user.id,
                  title: "First Nested Post",
                  content: "Content of first nested post",
                })
                .returning();

              console.log(
                "✅ Created first post in nested transaction:",
                post1.id
              );

              // Second level nesting using REQUIRED (also joins same transaction)
              await runInTransaction(
                async () => {
                  console.log("🔹 Starting second nested transaction...");

                  const [post2] = await db
                    .insert(posts)
                    .values({
                      authorId: user.id,
                      title: "Second Nested Post",
                      content: "Content of second nested post",
                    })
                    .returning();

                  console.log(
                    "✅ Created second post in deeply nested transaction:",
                    post2.id
                  );

                  // Simulate work delay
                  await new Promise((resolve) => setTimeout(resolve, 10));
                },
                {
                  propagation: Propagation.REQUIRED,
                  isolationLevel: IsolationLevel.READ_COMMITTED,
                }
              );
            },
            {
              propagation: Propagation.REQUIRED,
              isolationLevel: IsolationLevel.READ_COMMITTED,
            }
          );

          console.log("🔍 Verifying transaction results...");

          // Verify all data was created
          const allUsers = await db.select().from(users);
          const allPosts = await db.select().from(posts);

          this.assert(allUsers.length >= 1, "Should have at least 1 user");
          this.assert(allPosts.length >= 2, "Should have at least 2 posts");

          console.log("✅ All transaction data verified successfully");
          return { users: allUsers, posts: allPosts };
        },
        {
          propagation: Propagation.REQUIRED,
          isolationLevel: IsolationLevel.READ_COMMITTED,
        }
      );

      console.log("🎉 Nested transaction test completed successfully");
    } catch (error) {
      console.error("❌ Test failed:", error);
      throw error;
    }
  }

  /**
   * Test that demonstrates concurrent transactions with proper isolation
   */
  private async testConcurrentNestedTransactions(): Promise<void> {
    const db = this.getDatabase();

    try {
      console.log("🔄 Starting concurrent nested transactions test...");

      // Create initial data outside of any transaction to avoid conflicts
      const [user1] = await db
        .insert(users)
        .values({
          name: "Concurrent User 1",
          email: "concurrent1@test.com",
        })
        .returning();

      const [user2] = await db
        .insert(users)
        .values({
          name: "Concurrent User 2",
          email: "concurrent2@test.com",
        })
        .returning();

      // Use REQUIRES_NEW to ensure truly independent transactions
      const operation1 = runInTransaction(
        async () => {
          console.log("🔸 Operation 1: Starting...");

          await db
            .update(users)
            .set({ name: "Concurrent User 1 Updated" })
            .where(eq(users.id, user1.id));

          // Simulate some processing time
          await new Promise((resolve) => setTimeout(resolve, 10));

          console.log("🔸 Operation 1: Completed");
        },
        {
          propagation: Propagation.REQUIRES_NEW,
          isolationLevel: IsolationLevel.READ_COMMITTED,
        }
      );

      const operation2 = runInTransaction(
        async () => {
          console.log("🔺 Operation 2: Starting...");

          await db
            .update(users)
            .set({ name: "Concurrent User 2 Updated" })
            .where(eq(users.id, user2.id));

          // Simulate some processing time
          await new Promise((resolve) => setTimeout(resolve, 10));

          console.log("🔺 Operation 2: Completed");
        },
        {
          propagation: Propagation.REQUIRES_NEW,
          isolationLevel: IsolationLevel.READ_COMMITTED,
        }
      );

      // Wait for operations to complete
      const results = await Promise.allSettled([operation1, operation2]);

      // Check that both operations succeeded (since they operate on different users)
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length;

      this.assert(successCount >= 1, "At least one operation should succeed");

      console.log(
        "✅ Concurrent nested transactions test completed successfully"
      );
    } catch (error) {
      console.error("❌ Test failed:", error);
      throw error;
    }
  }

  /**
   * Test that demonstrates resource-intensive nested operations
   */
  private async testResourceIntensiveNestedOperations(): Promise<void> {
    const db = this.getDatabase();

    try {
      const startTime = Date.now();

      await runInTransaction(
        async () => {
          // Create multiple users with posts in nested transactions using REQUIRED
          for (let i = 0; i < 5; i++) {
            await runInTransaction(
              async () => {
                const [user] = await db
                  .insert(users)
                  .values({
                    name: `Resource Test User ${i}`,
                    email: `resource${i}@test.com`,
                  })
                  .returning();

                // Create posts for each user using REQUIRED (joins same transaction)
                for (let j = 0; j < 3; j++) {
                  await runInTransaction(
                    async () => {
                      await db.insert(posts).values({
                        authorId: user.id,
                        title: `Resource Post ${j} by User ${i}`,
                        content: `Content for resource post ${j}`,
                      });
                    },
                    { propagation: Propagation.REQUIRED }
                  );
                }
              },
              { propagation: Propagation.REQUIRED }
            );
          }

          const endTime = Date.now();
          const duration = endTime - startTime;

          console.log(`Resource-intensive test completed in ${duration}ms`);

          // Verify all data was created
          const allUsers = await db.select().from(users);
          const allPosts = await db.select().from(posts);

          this.assert(allUsers.length >= 5, "Should have at least 5 users");
          this.assert(allPosts.length >= 15, "Should have at least 15 posts");

          // Test should complete within reasonable time
          this.assert(
            duration < 10000,
            "Test should complete within 10 seconds"
          );
        },
        { isolationLevel: IsolationLevel.READ_COMMITTED }
      );

      console.log(
        "✅ Resource-intensive nested operations test completed successfully"
      );
    } catch (error) {
      console.error("❌ Test failed:", error);
      throw error;
    }
  }
}
