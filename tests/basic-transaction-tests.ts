import { Propagation } from "../dist/esm/enums/propagation.js";
import { DrizzleTransactionalError } from "../dist/esm/errors/transactional.js";
import {
  runOnTransactionCommit,
  runOnTransactionComplete,
  runOnTransactionRollback,
} from "../dist/esm/hooks/index.js";
import { runInTransaction } from "../dist/esm/transactions/run-in-transaction.js";
import { BaseTestRunner } from "./base-test-runner.js";
import { PostService, UserService } from "./services.js";

/**
 * Basic transaction functionality tests
 */
export class BasicTransactionTests extends BaseTestRunner {
  public async runTests(): Promise<void> {
    await this.runTest("Basic Transactions", () =>
      this.testBasicTransactions()
    );
    await this.runTest("Transaction Rollback", () =>
      this.testTransactionRollback()
    );
    await this.runTest("Transaction Hooks", () => this.testTransactionHooks());
    await this.runTest("Nested Transactions", () =>
      this.testNestedTransactions()
    );
  }

  /**
   * Test basic transaction functionality
   */
  private async testBasicTransactions(): Promise<void> {
    const userService = new UserService();
    const postService = new PostService();

    // Test successful transaction
    const userId = await userService.createUser("John Doe", "john@example.com");
    if (!userId) throw new Error("Failed to create user");

    const postId = await postService.createPost(
      userId.id,
      "My First Post",
      "This is a test post"
    );
    if (!postId) throw new Error("Failed to create post");

    // Verify data was committed
    const user = await userService.findUserById(userId.id);
    if (!user || user.name !== "John Doe") {
      throw new Error("User data not properly committed");
    }

    const post = await postService.findPostById(postId.id);
    if (!post || post.title !== "My First Post") {
      throw new Error("Post data not properly committed");
    }
  }

  /**
   * Test transaction rollback functionality
   */
  private async testTransactionRollback(): Promise<void> {
    const userService = new UserService();

    let rollbackExecuted = false;
    let commitExecuted = false;

    try {
      await runInTransaction(async () => {
        // Add hooks to verify they execute correctly
        runOnTransactionRollback(() => {
          rollbackExecuted = true;
        });

        runOnTransactionCommit(() => {
          commitExecuted = true;
        });

        // Create a user
        const userId = await userService.createUser(
          "Failed User",
          "failed@example.com"
        );
        if (!userId) throw new Error("Failed to create user for rollback test");

        // Intentionally throw an error to trigger rollback
        throw new DrizzleTransactionalError("Intentional rollback for testing");
      });
    } catch (error) {
      if (
        !(error instanceof DrizzleTransactionalError) ||
        error.message !== "Intentional rollback for testing"
      ) {
        throw error;
      }
    }

    // Verify rollback hook was executed and commit hook was not
    if (!rollbackExecuted) {
      throw new Error("Rollback hook was not executed");
    }
    if (commitExecuted) {
      throw new Error(
        "Commit hook should not have been executed during rollback"
      );
    }

    // Verify user was not persisted due to rollback
    const users = await userService.getAllUsers();
    const failedUser = users.find((u) => u.email === "failed@example.com");
    if (failedUser) {
      throw new Error("User should not exist after rollback");
    }
  }

  /**
   * Test transaction hooks functionality
   */
  private async testTransactionHooks(): Promise<void> {
    const userService = new UserService();
    let commitHookExecuted = false;
    let completeHookExecuted = false;

    await runInTransaction(async () => {
      // Add transaction hooks
      runOnTransactionCommit(() => {
        commitHookExecuted = true;
      });

      runOnTransactionComplete(() => {
        completeHookExecuted = true;
      });

      // Create a user
      await userService.createUser("Hook Test User", "hooks@example.com");
    });

    // Verify hooks were executed
    if (!commitHookExecuted) {
      throw new Error("Commit hook was not executed");
    }
    if (!completeHookExecuted) {
      throw new Error("Complete hook was not executed");
    }
  }

  /**
   * Test nested transactions and propagation
   */
  private async testNestedTransactions(): Promise<void> {
    const userService = new UserService();
    const postService = new PostService();

    await runInTransaction(async () => {
      // Create user in outer transaction
      const userId = await userService.createUser(
        "Nested User",
        "nested@example.com"
      );
      if (!userId)
        throw new Error("Failed to create user in nested transaction test");

      // Create post in nested transaction (should use same transaction)
      await runInTransaction(
        async () => {
          const postId = await postService.createPost(
            userId.id,
            "Nested Post",
            "Created in nested transaction"
          );
          if (!postId)
            throw new Error("Failed to create post in nested transaction");
        },
        { propagation: Propagation.REQUIRED }
      );
    });

    // Verify both user and post were created
    const users = await userService.getAllUsers();
    const nestedUser = users.find((u) => u.email === "nested@example.com");
    if (!nestedUser) {
      throw new Error("Nested transaction user not found");
    }

    const posts = await postService.getAllPosts();
    const nestedPost = posts.find((p) => p.title === "Nested Post");
    if (!nestedPost) {
      throw new Error("Nested transaction post not found");
    }
  }
}
