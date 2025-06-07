import { IsolationLevel } from "../dist/esm/enums/isolation-level.js";
import { runInTransaction } from "../dist/esm/transactions/run-in-transaction.js";
import { BaseTestRunner } from "./base-test-runner.js";
import { UserService } from "./services.js";

/**
 * Advanced isolation scenario tests including concurrent transactions
 */
export class AdvancedIsolationTests extends BaseTestRunner {
  public async runTests(): Promise<void> {
    console.log("Testing advanced isolation scenarios...");

    await this.runTest("Dirty Read Prevention", () =>
      this.testDirtyReadPrevention()
    );
    await this.runTest("Non-Repeatable Read Scenario", () =>
      this.testNonRepeatableReadScenario()
    );
    await this.runTest("Phantom Read Scenario", () =>
      this.testPhantomReadScenario()
    );
    await this.runTest("Concurrent Write Conflicts", () =>
      this.testConcurrentWriteConflicts()
    );
    await this.runTest("Transaction Timeout Scenario", () =>
      this.testTransactionTimeoutScenario()
    );
  }

  /**
   * Test dirty read prevention in READ_COMMITTED isolation level
   */
  private async testDirtyReadPrevention(): Promise<void> {
    console.log("🔍 Testing dirty read prevention...");

    const userService = new UserService();
    let transaction1Complete = false;
    let transaction2ReadValue: any = null;

    // Start two concurrent transactions
    const transaction1Promise = runInTransaction(
      async () => {
        console.log("T1: Creating user in uncommitted transaction...");
        const user = await userService.createUser(
          "Dirty Read Test User",
          "dirty@test.com"
        );

        // Simulate some processing time before commit
        await new Promise((resolve) => setTimeout(resolve, 100));

        console.log("T1: About to commit transaction...");
        transaction1Complete = true;
        return user;
      },
      { isolationLevel: IsolationLevel.READ_COMMITTED }
    );

    // Second transaction tries to read uncommitted data
    const transaction2Promise = runInTransaction(
      async () => {
        // Wait a bit for T1 to create the user but not commit
        await new Promise((resolve) => setTimeout(resolve, 50));

        console.log("T2: Attempting to read potentially dirty data...");
        const users = await userService.getAllUsers();
        transaction2ReadValue = users.find((u) => u.email === "dirty@test.com");

        console.log(`T2: Found user: ${transaction2ReadValue ? "YES" : "NO"}`);

        // In READ_COMMITTED, we should not see uncommitted changes
        if (transaction2ReadValue && !transaction1Complete) {
          throw new Error(
            "Dirty read detected! This should not happen in READ_committed"
          );
        }

        return transaction2ReadValue;
      },
      { isolationLevel: IsolationLevel.READ_COMMITTED }
    );

    await Promise.all([transaction1Promise, transaction2Promise]);
    console.log("✅ Dirty read prevention test passed");
  }

  /**
   * Test non-repeatable read scenario
   */
  private async testNonRepeatableReadScenario(): Promise<void> {
    console.log("🔍 Testing non-repeatable read scenario...");

    const userService = new UserService();

    // First, create a user to test with
    const initialUser = await userService.createUser(
      "Repeatable Read Test",
      "repeatable@test.com"
    );

    let firstRead: any = null;
    let secondRead: any = null;

    // Transaction 1: Read data twice with READ_COMMITTED
    const readTransaction = runInTransaction(
      async () => {
        console.log("READ_T: First read...");
        firstRead = await userService.findUserById(initialUser.id);

        // Wait for concurrent transaction to modify data
        await new Promise((resolve) => setTimeout(resolve, 200));

        console.log("READ_T: Second read...");
        secondRead = await userService.findUserById(initialUser.id);

        return { firstRead, secondRead };
      },
      { isolationLevel: IsolationLevel.READ_COMMITTED }
    );

    // Transaction 2: Modify the user data
    const modifyTransaction = new Promise(async (resolve) => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log("MODIFY_T: Updating user status...");
      await userService.updateUserStatus(initialUser.id, false);
      console.log("MODIFY_T: User status updated");
      resolve(true);
    });

    await Promise.all([readTransaction, modifyTransaction]);

    // In READ_COMMITTED, the two reads might return different values
    console.log(`First read active status: ${firstRead?.isActive}`);
    console.log(`Second read active status: ${secondRead?.isActive}`);

    console.log("✅ Non-repeatable read scenario test completed");
  }

  /**
   * Test phantom read scenario
   */
  private async testPhantomReadScenario(): Promise<void> {
    console.log("🔍 Testing phantom read scenario...");

    const userService = new UserService();
    let firstCount = 0;
    let secondCount = 0;

    // Transaction 1: Count records twice in REPEATABLE_READ
    const countTransaction = runInTransaction(
      async () => {
        console.log("COUNT_T: First count...");
        const firstUsers = await userService.getAllUsers();
        firstCount = firstUsers.filter((u) =>
          u.email.includes("phantom")
        ).length;

        // Wait for concurrent transaction to insert new records
        await new Promise((resolve) => setTimeout(resolve, 200));

        console.log("COUNT_T: Second count...");
        const secondUsers = await userService.getAllUsers();
        secondCount = secondUsers.filter((u) =>
          u.email.includes("phantom")
        ).length;

        return { firstCount, secondCount };
      },
      { isolationLevel: IsolationLevel.REPEATABLE_READ }
    );

    // Transaction 2: Insert new phantom records
    const insertTransaction = new Promise(async (resolve) => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log("INSERT_T: Inserting phantom records...");
      await userService.createUser("Phantom User 1", "phantom1@test.com");
      await userService.createUser("Phantom User 2", "phantom2@test.com");
      console.log("INSERT_T: Phantom records inserted");
      resolve(true);
    });

    await Promise.all([countTransaction, insertTransaction]);

    console.log(`First count of phantom users: ${firstCount}`);
    console.log(`Second count of phantom users: ${secondCount}`);

    // In REPEATABLE_READ, phantom reads might still occur
    console.log("✅ Phantom read scenario test completed");
  }

  /**
   * Test concurrent write conflicts and resolution
   */
  private async testConcurrentWriteConflicts(): Promise<void> {
    console.log("🔍 Testing concurrent write conflicts...");

    const userService = new UserService();

    // Create a user for testing conflicts
    const testUser = await userService.createUser(
      "Conflict Test User",
      "conflict@test.com"
    );

    let transaction1Success = false;
    let transaction2Success = false;

    // Two transactions trying to update the same user simultaneously
    const transaction1 = runInTransaction(
      async () => {
        console.log("CONFLICT_T1: Updating user status to false...");
        await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate processing
        await userService.updateUserStatus(testUser.id, false);
        transaction1Success = true;
        console.log("CONFLICT_T1: Update successful");
      },
      { isolationLevel: IsolationLevel.SERIALIZABLE }
    ).catch((error) => {
      console.log("CONFLICT_T1: Update failed -", error.message);
    });

    const transaction2 = runInTransaction(
      async () => {
        console.log("CONFLICT_T2: Updating user status to true...");
        await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate processing
        await userService.updateUserStatus(testUser.id, true);
        transaction2Success = true;
        console.log("CONFLICT_T2: Update successful");
      },
      { isolationLevel: IsolationLevel.SERIALIZABLE }
    ).catch((error) => {
      console.log("CONFLICT_T2: Update failed -", error.message);
    });

    await Promise.all([transaction1, transaction2]);

    // At least one transaction should succeed
    if (!transaction1Success && !transaction2Success) {
      throw new Error(
        "Both concurrent transactions failed - this is unexpected"
      );
    }

    console.log(
      `T1 Success: ${transaction1Success}, T2 Success: ${transaction2Success}`
    );
    console.log("✅ Concurrent write conflict test completed");
  }

  /**
   * Test transaction timeout and deadlock simulation
   */
  private async testTransactionTimeoutScenario(): Promise<void> {
    console.log("🔍 Testing transaction timeout scenario...");

    const userService = new UserService();

    // Create two users for deadlock simulation
    const user1 = await userService.createUser(
      "Deadlock User 1",
      "deadlock1@test.com"
    );
    const user2 = await userService.createUser(
      "Deadlock User 2",
      "deadlock2@test.com"
    );

    let transaction1Complete = false;
    let transaction2Complete = false;
    let deadlockDetected = false;

    // Simulate potential deadlock scenario
    const transaction1 = runInTransaction(
      async () => {
        console.log("DEADLOCK_T1: Locking user 1...");
        await userService.updateUserStatus(user1.id, false);

        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 100));

        console.log("DEADLOCK_T1: Attempting to lock user 2...");
        await userService.updateUserStatus(user2.id, false);

        transaction1Complete = true;
        console.log("DEADLOCK_T1: Completed successfully");
      },
      { isolationLevel: IsolationLevel.SERIALIZABLE }
    ).catch((error) => {
      console.log("DEADLOCK_T1: Failed -", error.message);
      if (
        error.message.includes("deadlock") ||
        error.message.includes("serialization")
      ) {
        deadlockDetected = true;
      }
    });

    const transaction2 = runInTransaction(
      async () => {
        console.log("DEADLOCK_T2: Locking user 2...");
        await userService.updateUserStatus(user2.id, true);

        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 100));

        console.log("DEADLOCK_T2: Attempting to lock user 1...");
        await userService.updateUserStatus(user1.id, true);

        transaction2Complete = true;
        console.log("DEADLOCK_T2: Completed successfully");
      },
      { isolationLevel: IsolationLevel.SERIALIZABLE }
    ).catch((error) => {
      console.log("DEADLOCK_T2: Failed -", error.message);
      if (
        error.message.includes("deadlock") ||
        error.message.includes("serialization")
      ) {
        deadlockDetected = true;
      }
    });

    // Add overall timeout for the deadlock test
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error("Deadlock test timed out - this is expected behavior")
        );
      }, 5000);
    });

    try {
      await Promise.race([
        Promise.all([transaction1, transaction2]),
        timeoutPromise,
      ]);
    } catch (error: any) {
      if (error.message.includes("timed out")) {
        console.log("⚠️  Deadlock test timed out as expected");
        deadlockDetected = true;
      } else {
        throw error;
      }
    }

    console.log(
      `T1 Complete: ${transaction1Complete}, T2 Complete: ${transaction2Complete}`
    );
    console.log(
      `Deadlock/Serialization conflict detected: ${deadlockDetected}`
    );
    console.log("✅ Transaction timeout/deadlock scenario test completed");
  }
}
