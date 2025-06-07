/**
 * Base test runner with common functionality for all test categories
 */
export abstract class BaseTestRunner {
  private testsPassed = 0;
  private testsFailed = 0;
  private failedTests: string[] = [];

  /**
   * Run a single test with error handling
   */
  protected async runTest(
    testName: string,
    testFn: () => Promise<void>
  ): Promise<void> {
    try {
      console.log(`🧪 Running test: ${testName}`);

      // Add individual test timeout (30 seconds per test)
      const testTimeout = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error(`Test "${testName}" timed out after 30 seconds`)),
          30000
        )
      );

      await Promise.race([testFn(), testTimeout]);

      this.testsPassed++;
      console.log(`✅ Test passed: ${testName}`);
    } catch (error) {
      this.testsFailed++;
      this.failedTests.push(testName);
      console.error(`❌ Test failed: ${testName}`);
      console.error(
        `   Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get test results for aggregation
   */
  public getResults(): {
    passed: number;
    failed: number;
    failedTests: string[];
  } {
    return {
      passed: this.testsPassed,
      failed: this.testsFailed,
      failedTests: [...this.failedTests],
    };
  }

  /**
   * Reset test counters
   */
  public reset(): void {
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.failedTests = [];
  }

  /**
   * Abstract method that each test category must implement
   */
  public abstract runTests(): Promise<void>;
}
