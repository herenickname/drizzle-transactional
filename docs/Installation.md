# Installation

## 📦 Basic Installation

Install the required packages:

```bash
npm install drizzle-transactional drizzle-orm
```

## 🔧 Requirements

### Node.js Version

- **Node.js**: 18+

### TypeScript Configuration

Add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node"
  }
}
```

## 🗄️ Database Dependencies

### PostgreSQL (Recommended)

```bash
npm install pg @types/pg
```

### Other Databases

The library works with any Drizzle-supported database:

```bash
# MySQL
npm install mysql2

# SQLite
npm install better-sqlite3
```

## 🏗️ Optional Dependencies

For enhanced development experience:

```bash
# TypeScript support
npm install -D typescript tsx @types/node

# Reflection metadata (for advanced decorator features)
npm install reflect-metadata
```

## ✅ Verification

Verify your installation with this simple test:

```typescript
import {
  initializeDrizzleTransactionalContext,
  Transactional,
} from "drizzle-transactional";

// Initialize context
initializeDrizzleTransactionalContext();

console.log("✅ Drizzle Transactional installed successfully!");
```

## 🚨 Common Issues

### Module Resolution Errors

If you encounter module resolution issues:

1. Ensure you're using `"type": "module"` in your `package.json`
2. Use `.js` extensions in imports when using ESM
3. Run with `--experimental-vm-modules` flag

### Decorator Support

If decorators aren't working:

1. Check `tsconfig.json` has `experimentalDecorators: true`
2. Install `reflect-metadata` if using advanced features
3. Ensure TypeScript version is 5.0+

### PostgreSQL Connection Issues

If PostgreSQL connections fail:

1. Verify PostgreSQL server is running
2. Check connection string format and credentials
3. Ensure network connectivity to database host

## 📋 Next Steps

After installation, proceed to:

- **[Quick Start](Quick-Start.md)** - Get started in minutes
- **[Basic Usage](Basic-Usage.md)** - Learn the fundamentals
