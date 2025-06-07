/**
 * Enhanced Base Test Runner with better error handling and performance
 */
export abstract class EnhancedBaseTestRunner {
  private testsPassed = 0;
  private testsFailed = 0;
  private failedTests: string[] = [];
  private testStartTime = 0;
  private totalTestTime = 0;

  /**
   * Run a single test with enhanced error handling and performance monitoring
   */
  protected async runTest(
    testName: string,
    testFn: () => Promise<void>,
    options: {
      timeout?: number;
      retries?: number;
      skipOnError?: boolean;
    } = {}
  ): Promise<void> {
    const { timeout = 5000, retries = 0, skipOnError = false } = options;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(
          `🧪 Running test: ${testName}${
            attempt > 0 ? ` (retry ${attempt})` : ""
          }`
        );

        this.testStartTime = Date.now();

        // Enhanced timeout with proper cleanup
        const testTimeout = new Promise<never>((_, reject) => {
          const timer = setTimeout(() => {
            reject(
              new Error(`Test "${testName}" timed out after ${timeout}ms`)
            );
          }, timeout);

          // Ensure timer is cleared even if test completes
          testTimeout.finally?.(() => clearTimeout(timer));
        });

        await Promise.race([testFn(), testTimeout]);

        const testTime = Date.now() - this.testStartTime;
        this.totalTestTime += testTime;

        this.testsPassed++;
        console.log(`✅ Test passed: ${testName} (${testTime}ms)`);
        return; // Success, no retry needed
      } catch (error) {
        const testTime = Date.now() - this.testStartTime;

        if (attempt === retries) {
          // Final attempt failed
          this.testsFailed++;
          this.failedTests.push(testName);

          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(`❌ Test failed: ${testName} (${testTime}ms)`);
          console.error(`   Error: ${errorMessage}`);

          if (!skipOnError) {
            // Optional: Continue with other tests or fail fast
            console.error(
              `   Stack: ${
                error instanceof Error ? error.stack : "No stack trace"
              }`
            );
          }
        } else {
          console.warn(
            `⚠️  Test attempt ${attempt + 1} failed: ${testName}, retrying...`
          );
          // Small delay before retry
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }
  }

  /**
   * Get enhanced test results with performance metrics
   */
  public getResults(): {
    passed: number;
    failed: number;
    failedTests: string[];
    totalTime: number;
    averageTime: number;
  } {
    const totalTests = this.testsPassed + this.testsFailed;
    return {
      passed: this.testsPassed,
      failed: this.testsFailed,
      failedTests: [...this.failedTests],
      totalTime: this.totalTestTime,
      averageTime: totalTests > 0 ? this.totalTestTime / totalTests : 0,
    };
  }

  /**
   * Reset test counters and metrics
   */
  public reset(): void {
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.failedTests = [];
    this.totalTestTime = 0;
  }

  /**
   * Setup method called before each test suite
   */
  protected async setupSuite(): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Cleanup method called after each test suite
   */
  protected async cleanupSuite(): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Abstract method that each test category must implement
   */
  public abstract runTests(): Promise<void>;
}
