/**
 * Comprehensive test suite for drizzle-transactional library
 * This test suite orchestrates all test categories and provides unified reporting
 */

import { addTransactionalDrizzleDatabase } from "../dist/esm/drizzle/database-manager.js";
import { initializeDrizzleTransactionalContext } from "../dist/esm/storage/index.js";
import { AdvancedIsolationTests } from "./advanced-isolation-tests.js";
import { BasicTransactionTests } from "./basic-transaction-tests.js";
import { setupDatabase } from "./database-schema-postgres.js";
import { IsolationLevelTests } from "./isolation-level-tests.js";
import { NestedTimeoutTests } from "./nested-timeout-test.js";
import { RealWorldScenarioTests } from "./real-world-scenario-tests.js";

/**
 * Initialize database and transactional context
 */
async function initializeTestEnvironment(): Promise<void> {
  try {
    // Initialize the transactional context
    initializeDrizzleTransactionalContext();

    // Setup database
    const { db } = await setupDatabase();

    // Register the database with the transactional system
    addTransactionalDrizzleDatabase(db, "default");

    console.log("✅ Test environment initialized successfully\n");
  } catch (error) {
    console.error("❌ Failed to initialize test environment:", error);
    throw error;
  }
}

/**
 * Main test orchestrator that runs all test categories
 */
class ComprehensiveTestSuite {
  private totalTestsPassed = 0;
  private totalTestsFailed = 0;
  private allFailedTests: string[] = [];

  /**
   * Run all test suites and aggregate results
   */
  public async runAllTests(): Promise<void> {
    console.log(
      "🚀 Starting comprehensive test suite for drizzle-transactional\n"
    );

    // Initialize test environment first
    await initializeTestEnvironment();

    const testSuites = [
      { name: "Basic Transaction Tests", suite: new BasicTransactionTests() },
      { name: "Isolation Level Tests", suite: new IsolationLevelTests() },
      { name: "Advanced Isolation Tests", suite: new AdvancedIsolationTests() },
      {
        name: "Real World Scenario Tests",
        suite: new RealWorldScenarioTests(),
      },
      { name: "PostgreSQL Transaction Tests", suite: new NestedTimeoutTests() },
    ];

    for (const { name, suite } of testSuites) {
      console.log(`\n🧪 Running ${name}...`);
      console.log("=".repeat(50));

      try {
        await suite.runTests();
        const results = suite.getResults();

        this.totalTestsPassed += results.passed;
        this.totalTestsFailed += results.failed;
        this.allFailedTests.push(...results.failedTests);

        console.log(`\n📊 ${name} Results:`);
        console.log(`   ✅ Passed: ${results.passed}`);
        console.log(`   ❌ Failed: ${results.failed}`);
      } catch (error) {
        console.error(
          `\n💥 ${name} suite failed with unexpected error:`,
          error
        );
        this.totalTestsFailed++;
        this.allFailedTests.push(`${name} (Suite Error)`);
      }
    }

    this.printFinalResults();
  }

  /**
   * Print comprehensive test results summary
   */
  private printFinalResults(): void {
    console.log("\n" + "=".repeat(60));
    console.log("🏁 COMPREHENSIVE TEST SUITE RESULTS");
    console.log("=".repeat(60));
    console.log(`✅ Total tests passed: ${this.totalTestsPassed}`);
    console.log(`❌ Total tests failed: ${this.totalTestsFailed}`);
    console.log(
      `📈 Total tests run: ${this.totalTestsPassed + this.totalTestsFailed}`
    );

    if (this.totalTestsFailed > 0) {
      console.log("\n❌ Failed tests:");
      this.allFailedTests.forEach((test) => console.log(`   - ${test}`));
      console.log("=".repeat(60));
      console.log("💀 Test suite FAILED");
    } else {
      console.log("=".repeat(60));
      console.log("🎉 All tests PASSED!");
    }

    console.log("=".repeat(60));

    // Exit with appropriate code
    if (this.totalTestsFailed > 0) {
      process.exit(1);
    }
  }
}

// Run the comprehensive test suite
const testSuite = new ComprehensiveTestSuite();
testSuite.runAllTests().catch((error) => {
  console.error("💥 Test suite failed with unexpected error:", error);
  process.exit(1);
});
