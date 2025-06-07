import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type DatabaseName = string | "default";

/**
 * Enhanced Drizzle database type with better typing
 */
export type DrizzleDatabase = PgDatabase<
  PgQueryResultHKT,
  Record<string, never>,
  ExtractTablesWithRelations<Record<string, never>>
>;

/**
 * Type for transaction callback parameter
 */
export type DrizzleTransaction = Parameters<
  Parameters<DrizzleDatabase["transaction"]>[0]
>[0];

/**
 * Extended database info with transactional state
 */
export interface TransactionalDatabaseInfo {
  database: DrizzleDatabase;
  isTransacting: boolean;
  baseDatabase: DrizzleDatabase;
}

/**
 * Generic function type for better type safety
 */
export type Func<Args extends readonly unknown[] = any[], Return = any> = (
  ...args: Args
) => Promise<Return>;

/**
 * Method descriptor type with better generics
 */
export type MethodDesc<
  Args extends readonly unknown[] = any[],
  Return = any
> = TypedPropertyDescriptor<Func<Args, Return>>;

/**
 * Enhanced method decorator with better typing for both legacy and modern decorator syntax
 */
export type MethodDecorator = <Args extends readonly unknown[], Return>(
  target: object,
  methodName: string | symbol,
  descriptor?: MethodDesc<Args, Return>
) =>
  | void
  | MethodDesc<Args, Return>
  | ((desc: MethodDesc<Args, Return>) => MethodDesc<Args, Return>);

/**
 * Class decorator type
 */
export type ClassDecorator = <T extends new (...args: any[]) => any>(
  target: T
) => T | void;

/**
 * Method descriptor value getter with enhanced typing
 */
export type MethodDescValueGetter = <Args extends readonly unknown[], Return>(
  descriptor: MethodDesc<Args, Return>,
  originalMethod: Func<Args, Return>
) => Func<Args, Return>;

/**
 * Stage 3 decorator context types (TC39 proposal)
 * Only define if not already available globally
 */
declare global {
  namespace DecoratorTypes {
    interface DecoratorContext {
      kind: "class" | "method" | "getter" | "setter" | "field" | "accessor";
      name: string | symbol;
      access?: {
        get?(): unknown;
        set?(value: unknown): void;
      };
      private?: boolean;
      static?: boolean;
      addInitializer?(initializer: () => void): void;
    }

    interface ClassDecoratorContext extends DecoratorContext {
      kind: "class";
      name: string | symbol;
    }

    interface MethodDecoratorContext extends DecoratorContext {
      kind: "method";
    }

    interface GetterDecoratorContext extends DecoratorContext {
      kind: "getter";
    }

    interface SetterDecoratorContext extends DecoratorContext {
      kind: "setter";
    }

    interface FieldDecoratorContext extends DecoratorContext {
      kind: "field";
    }

    interface AccessorDecoratorContext extends DecoratorContext {
      kind: "accessor";
    }
  }
}

/**
 * Export decorator context type for easier use
 */
export type DecoratorContext = DecoratorTypes.DecoratorContext;

/**
 * Universal decorator types that support all decorator standards
 */
export type UniversalMethodDecorator = (
  target: any,
  propertyKey?: string | symbol,
  descriptorOrContext?: PropertyDescriptor | DecoratorContext
) => any;

export type UniversalClassDecorator = <T extends { new (...args: any[]): any }>(
  target: T,
  context?: DecoratorContext
) => T;
