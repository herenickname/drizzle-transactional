# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-06-07

### ✨ Added

- **Performance Optimizations**

  - WeakMap-based method caching in database proxy to avoid recreating bound methods
  - Method descriptor caching in decorators for improved performance
  - Optimized `runWithContext` to reduce unnecessary Map operations
  - Added utility functions: `memoize`, `debounce`, `throttle`

- **Enhanced Error Handling**

  - Extended `DrizzleTransactionalError` with `code` and `details` properties
  - Added static factory methods for common errors:
    - `DrizzleTransactionalError.notInitialized()`
    - `DrizzleTransactionalError.databaseNotFound()`
    - `DrizzleTransactionalError.propagationError()`
    - `DrizzleTransactionalError.contextError()`
  - Improved stack trace handling and error details

- **Utility Functions**

  - `memoize<T>()` - Function result caching
  - `debounce()` - Delayed function execution
  - `throttle()` - Function call rate limiting
  - Type checking utilities: `isFunction()`, `isObject()`, `hasOwnProperty()`
  - `createUniqueId()` - Unique identifier generation

- **Enhanced TypeScript Support**
  - Support for both legacy and modern TypeScript decorator syntax
  - Enhanced generic types with better constraints
  - Improved type safety across all components

### 🔧 Improved

- **Code Structure**

  - Replaced switch statement with handler object for propagation logic (better maintainability)
  - Integrated hooks system with global settings for `maxHookHandlers`
  - Added parameter validation in `initializeDrizzleTransactionalContext`

- **Hook System**

  - Better integration with global configuration
  - Immediate execution for reliable testing
  - Proper cleanup management for lifecycle hooks

- **Context Management**

  - Optimized context operations to reduce memory allocations
  - More efficient async local storage handling

- **Build Process**
  - Fixed TypeScript configuration issues
  - Improved ESM/CJS dual package support
  - Better handling of decorator syntax compilation

### 🐛 Fixed

- **Compatibility Issues**

  - Resolved Node.js Error constructor compatibility problems
  - Fixed TypeScript decorator typing for modern versions
  - Eliminated dependency conflicts with Drizzle ORM types

- **Test Infrastructure**
  - Fixed hooks timing issues for 100% test pass rate
  - Resolved compilation issues with examples
  - Improved test isolation and cleanup

### 📚 Documentation

- Comprehensive code comments and JSDoc annotations
- Improved type definitions for better IDE support
- Enhanced examples with real-world usage patterns

### 🎯 Performance

- **Method Caching**: Significant performance improvement for frequently called methods
- **Memory Optimization**: Reduced memory allocations in hot paths
- **Efficient Error Handling**: Fast typed error processing with O(1) lookup
- **Smart Propagation**: Object-based handlers instead of switch statements

### 📊 Testing

- **100% Test Coverage**: All 25 test scenarios passing
  - 10/10 real-world tests ✅
  - 15/15 isolation tests ✅
- **Stress Testing**: High concurrency scenarios validated
- **Error Handling**: Comprehensive rollback and cleanup testing

### 🏗️ Architecture

- **Modularity**: Clear separation of concerns between components
- **Extensibility**: Easy-to-extend hooks and middleware system
- **Type Safety**: Strict typing at all levels
- **Error Resilience**: Robust error handling with graceful degradation
- **Performance**: Memory-efficient caching and optimized operations

---

## [1.0.0] - 2025-06-07

### ✨ Initial Release

- **Core Features**

  - Declarative transaction management with TypeScript decorators
  - Support for all propagation types (REQUIRED, REQUIRES_NEW, MANDATORY, NEVER)
  - Transaction isolation levels (READ_COMMITTED, REPEATABLE_READ, SERIALIZABLE)
  - Lifecycle hooks for extended transaction control
  - Async Local Storage for transaction context management

- **Drizzle ORM Integration**

  - Seamless integration with Drizzle ORM
  - Support for PostgreSQL, MySQL, and SQLite
  - Database connection management and proxy
  - Transaction state tracking

- **Developer Experience**
  - Full TypeScript support with comprehensive type definitions
  - ESM/CJS dual package support
  - Comprehensive error handling
  - Real-world examples and documentation

---

**Legend:**

- ✨ Added - New features
- 🔧 Improved - Enhancements to existing features
- 🐛 Fixed - Bug fixes
- 📚 Documentation - Documentation changes
- 🎯 Performance - Performance improvements
- 📊 Testing - Testing improvements
- 🏗️ Architecture - Architectural changes
