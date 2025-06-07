/**
 * Enumeration that represents transaction isolation levels for use with the Transactional decorator
 */
export enum IsolationLevel {
  /**
   * A constant indicating that dirty reads, non-repeatable reads and phantom reads can occur.
   */
  READ_UNCOMMITTED = "read uncommitted",
  /**
   * A constant indicating that dirty reads are prevented; non-repeatable reads and phantom reads can occur.
   */
  READ_COMMITTED = "read committed",
  /**
   * A constant indicating that dirty reads and non-repeatable reads are prevented; phantom reads can occur.
   */
  REPEATABLE_READ = "repeatable read",
  /**
   * A constant indicating that dirty reads, non-repeatable reads and phantom reads are prevented.
   */
  SERIALIZABLE = "serializable",
}
