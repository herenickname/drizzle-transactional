import { IsolationLevel } from "../dist/esm/enums/isolation-level.js";
import { runInTransaction } from "../dist/esm/transactions/run-in-transaction.js";
import { BaseTestRunner } from "./base-test-runner.js";
import { IsolationTestService } from "./services.js";

/**
 * Isolation level tests focusing on basic isolation behavior
 */
export class IsolationLevelTests extends BaseTestRunner {
  public async runTests(): Promise<void> {
    await this.runTest("Basic Isolation Levels", () =>
      this.testIsolationLevels()
    );
  }

  /**
   * Test transaction isolation levels
   */
  private async testIsolationLevels(): Promise<void> {
    const isolationService = new IsolationTestService();

    // Test READ_COMMITTED isolation
    await runInTransaction(
      async () => {
        await isolationService.createTestRecord(
          "isolation-test",
          "READ_COMMITTED test"
        );
      },
      { isolationLevel: IsolationLevel.READ_COMMITTED }
    );

    // Test SERIALIZABLE isolation
    await runInTransaction(
      async () => {
        await isolationService.createTestRecord(
          "serializable-test",
          "SERIALIZABLE test"
        );
      },
      { isolationLevel: IsolationLevel.SERIALIZABLE }
    );

    // Verify records were created
    const records = await isolationService.getAllRecords();
    const readCommittedRecord = records.find(
      (r) => r.name === "isolation-test"
    );
    const serializableRecord = records.find(
      (r) => r.name === "serializable-test"
    );

    if (!readCommittedRecord || !serializableRecord) {
      throw new Error("Isolation level test records not found");
    }
  }
}
