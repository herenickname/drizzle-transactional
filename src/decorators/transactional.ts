import {
  wrapInTransaction,
  type WrapInTransactionOptions,
} from "../transactions/wrap-in-transaction.js";
import type { DecoratorContext } from "../types/index.js";

/**
 * Type guard to check if we're dealing with Stage 3 decorator context
 */
function isStage3DecoratorContext(context: any): context is DecoratorContext {
  return (
    context &&
    typeof context === "object" &&
    typeof context.kind === "string" &&
    typeof context.name === "string"
  );
}

/**
 * Universal transactional method decorator that supports:
 * - Stage 3 decorators (TC39 proposal)
 * - Legacy decorators (TypeScript experimental)
 * - Modern decorators with descriptor
 */
export function Transactional(options?: WrapInTransactionOptions) {
  return function (
    target: any,
    propertyKey?: string | symbol,
    descriptorOrContext?: PropertyDescriptor | DecoratorContext
  ): any {
    // Legacy/Experimental decorator (TypeScript style)
    // In experimental decorators: (target, propertyKey, descriptor)
    // propertyKey is always defined for method decorators
    if (typeof propertyKey !== "undefined") {
      // If descriptorOrContext is a PropertyDescriptor, we have a complete experimental decorator call
      if (
        descriptorOrContext &&
        typeof descriptorOrContext === "object" &&
        "value" in descriptorOrContext &&
        !("kind" in descriptorOrContext)
      ) {
        const descriptor = descriptorOrContext as PropertyDescriptor;
        const originalMethod = descriptor.value as (...args: any[]) => any;

        if (typeof originalMethod !== "function") {
          throw new Error("@Transactional can only be applied to methods");
        }

        descriptor.value = wrapInTransaction(originalMethod, {
          ...options,
          name: propertyKey,
        });

        // Preserve metadata and function name
        if (descriptor.value) {
          preserveMethodMetadata(originalMethod, descriptor.value);
        }

        return descriptor;
      }

      // Legacy decorator without descriptor (modern TypeScript)
      if (descriptorOrContext === undefined) {
        return function (descriptor: PropertyDescriptor) {
          const originalMethod = descriptor.value as (...args: any[]) => any;

          if (typeof originalMethod !== "function") {
            throw new Error("@Transactional can only be applied to methods");
          }

          descriptor.value = wrapInTransaction(originalMethod, {
            ...options,
            name: propertyKey,
          });

          // Preserve metadata and function name
          if (descriptor.value) {
            preserveMethodMetadata(originalMethod, descriptor.value);
          }

          return descriptor;
        };
      }
    }

    // Stage 3 decorator (TC39 proposal)
    if (isStage3DecoratorContext(descriptorOrContext)) {
      const context = descriptorOrContext;

      // Only handle method decorators
      if (context.kind !== "method") {
        throw new Error("@Transactional can only be applied to methods");
      }

      return function (originalMethod: Function, context: DecoratorContext) {
        const wrappedMethod = wrapInTransaction(originalMethod as any, {
          ...options,
          name: context.name,
        });

        // Preserve metadata and function name
        preserveMethodMetadata(originalMethod, wrappedMethod);

        return wrappedMethod;
      };
    }

    // Fallback error
    throw new Error(
      `@Transactional: Unsupported decorator usage. target: ${typeof target}, propertyKey: ${typeof propertyKey}, descriptor: ${typeof descriptorOrContext}`
    );
  };
}

/**
 * Helper function to preserve method metadata
 */
function preserveMethodMetadata(
  originalMethod: Function,
  newMethod: Function
): void {
  // Validate input parameters
  if (!originalMethod || !newMethod) {
    return;
  }

  // Preserve metadata if reflect-metadata is available
  if (
    typeof Reflect !== "undefined" &&
    Reflect.getMetadataKeys &&
    typeof originalMethod === "function"
  ) {
    try {
      const metadataKeys = Reflect.getMetadataKeys(originalMethod);
      if (metadataKeys) {
        metadataKeys.forEach((previousMetadataKey) => {
          const previousMetadata = Reflect.getMetadata(
            previousMetadataKey,
            originalMethod
          );
          Reflect.defineMetadata(
            previousMetadataKey,
            previousMetadata,
            newMethod as object
          );
        });
      }
    } catch (error) {
      // Silently ignore metadata preservation errors
      console.warn("Failed to preserve method metadata:", error);
    }
  }

  // Preserve function name
  if (typeof originalMethod === "function" && originalMethod.name) {
    try {
      Object.defineProperty(newMethod, "name", {
        value: originalMethod.name,
        writable: false,
      });
    } catch (error) {
      // Silently ignore if name property can't be set
      console.warn("Failed to preserve function name:", error);
    }
  }
}

/**
 * Cache for method descriptors to avoid repeated reflection
 */
const methodDescriptorCache = new WeakMap<
  object,
  Array<{
    name: string;
    descriptor: PropertyDescriptor & { value: Function };
  }>
>();

/**
 * Get method descriptors from a class prototype (with caching)
 */
function getMethodsDescriptors(prototype: object): Array<{
  name: string;
  descriptor: PropertyDescriptor & { value: Function };
}> {
  // Check cache first
  const cached = methodDescriptorCache.get(prototype);
  if (cached) {
    return cached;
  }

  const propertyNames = Object.getOwnPropertyNames(prototype);

  const methodNames = propertyNames.filter((propName) => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, propName);
    return (
      descriptor?.value instanceof Function &&
      propName !== "constructor" &&
      typeof descriptor.value === "function"
    );
  });

  const result = methodNames
    .map((methodName) => {
      const descriptor = Object.getOwnPropertyDescriptor(
        prototype,
        methodName
      )!;
      return {
        name: methodName,
        descriptor: descriptor as PropertyDescriptor & { value: Function },
      };
    })
    .filter(({ descriptor }) => typeof descriptor.value === "function");

  // Cache the result
  methodDescriptorCache.set(prototype, result);
  return result;
}

/**
 * Universal transactional class decorator that supports:
 * - Stage 3 decorators (TC39 proposal)
 * - Legacy decorators (TypeScript experimental)
 * Applies @Transactional to all methods in the class
 */
export function TransactionalClass(options?: WrapInTransactionOptions) {
  return function <T extends { new (...args: any[]): any }>(
    target: T,
    context?: DecoratorContext
  ): T {
    // Stage 3 decorator
    if (isStage3DecoratorContext(context)) {
      if (context.kind !== "class") {
        throw new Error("@TransactionalClass can only be applied to classes");
      }

      return class extends target {
        constructor(...args: any[]) {
          super(...args);

          // Apply transactional wrapper to all methods after construction
          const prototype = Object.getPrototypeOf(this);
          const methodDescriptors = getMethodsDescriptors(prototype);

          for (const { name, descriptor } of methodDescriptors) {
            const originalMethod = descriptor.value;

            // Skip if method is already wrapped or not a function
            if (typeof originalMethod !== "function") {
              continue;
            }

            // Check if method is already wrapped by individual @Transactional decorator
            if (
              originalMethod.name &&
              originalMethod.name.includes("wrapper")
            ) {
              continue;
            }

            descriptor.value = wrapInTransaction(originalMethod, {
              ...options,
              name,
            });

            // Preserve metadata and function name
            if (descriptor.value) {
              preserveMethodMetadata(originalMethod, descriptor.value);
            }

            Object.defineProperty(this, name, descriptor);
          }
        }
      } as T;
    }

    // Legacy decorator
    const prototype = target.prototype;
    const methodDescriptors = getMethodsDescriptors(prototype);

    for (const { name, descriptor } of methodDescriptors) {
      const originalMethod = descriptor.value;

      // Skip if method is already wrapped or not a function
      if (typeof originalMethod !== "function") {
        continue;
      }

      // Check if method is already wrapped by individual @Transactional decorator
      if (originalMethod.name && originalMethod.name.includes("wrapper")) {
        continue;
      }

      descriptor.value = wrapInTransaction(originalMethod, {
        ...options,
        name,
      });

      // Preserve metadata and function name
      if (descriptor.value) {
        preserveMethodMetadata(originalMethod, descriptor.value);
      }

      Object.defineProperty(prototype, name, descriptor);
    }

    return target;
  };
}
