import type { CallExpression, PropertyAccessExpression } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';
import type {
  PrismaMethod,
  PrismaOperationType,
  PrismaOperation,
  SourceLocation,
} from '../types.js';

const WRITE_METHODS: ReadonlySet<string> = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

const READ_METHODS: ReadonlySet<string> = new Set([
  'findMany',
  'findUnique',
  'findFirst',
  'findFirstOrThrow',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

/**
 * Classify a Prisma method call as read or write operation
 */
export const classifyOperation = (
  callExpression: CallExpression
): PrismaOperation | null => {
  const expression = callExpression.getExpression();

  // Must be a property access (e.g., prisma.user.findMany())
  if (expression.getKind() !== SyntaxKind.PropertyAccessExpression) {
    return null;
  }

  const propertyAccess = expression as PropertyAccessExpression;
  const methodName = propertyAccess.getName();

  // Determine operation type
  let type: PrismaOperationType | null = null;
  if (WRITE_METHODS.has(methodName)) {
    type = 'write';
  } else if (READ_METHODS.has(methodName)) {
    type = 'read';
  }

  if (!type) {
    return null;
  }

  // Extract model name (e.g., "user" from prisma.user.findMany())
  const model = extractModelName(propertyAccess);
  if (!model) {
    return null;
  }

  // Get location information
  const sourceFile = callExpression.getSourceFile();
  const { line, column } = sourceFile.getLineAndColumnAtPos(callExpression.getStart());
  const location: SourceLocation = {
    file: sourceFile.getFilePath(),
    line,
    column,
  };

  // Check for $primary() or $replica()
  const { usesPrimary, usesReplica } = checkReplicaUsage(propertyAccess);

  // Check if in transaction
  const inTransaction = isInTransaction(callExpression);

  return {
    type,
    method: methodName as PrismaMethod,
    model,
    location,
    usesPrimary,
    usesReplica,
    inTransaction,
  };
};

/**
 * Extract model name from property access expression
 * e.g., prisma.user.findMany() -> "user"
 * e.g., prisma.$primary().user.findMany() -> "user"
 */
const extractModelName = (propertyAccess: PropertyAccessExpression): string | null => {
  const expression = propertyAccess.getExpression();

  if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
    const innerAccess = expression as PropertyAccessExpression;
    const name = innerAccess.getName();

    // Skip $primary and $replica
    if (name === '$primary' || name === '$replica') {
      return null;
    }

    return name;
  }

  return null;
};

/**
 * Check if the operation uses $primary() or $replica()
 */
const checkReplicaUsage = (
  propertyAccess: PropertyAccessExpression
): { usesPrimary: boolean; usesReplica: boolean } => {
  let usesPrimary = false;
  let usesReplica = false;

  // Traverse up the chain to find $primary() or $replica()
  let current = propertyAccess.getExpression();

  while (current) {
    const text = current.getText();

    if (text.includes('$primary()')) {
      usesPrimary = true;
      break;
    }

    if (text.includes('$replica()')) {
      usesReplica = true;
      break;
    }

    // Move up the chain
    if (current.getKind() === SyntaxKind.PropertyAccessExpression) {
      current = (current as PropertyAccessExpression).getExpression();
    } else if (current.getKind() === SyntaxKind.CallExpression) {
      current = (current as CallExpression).getExpression();
    } else {
      break;
    }
  }

  return { usesPrimary, usesReplica };
};

/**
 * Check if a call expression is inside a transaction
 */
const isInTransaction = (callExpression: CallExpression): boolean => {
  let parent = callExpression.getParent();

  while (parent) {
    // Check if inside $transaction call
    if (parent.getKind() === SyntaxKind.CallExpression) {
      const call = parent as CallExpression;
      const expr = call.getExpression();

      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expr as PropertyAccessExpression;
        if (propAccess.getName() === '$transaction') {
          return true;
        }
      }
    }

    parent = parent.getParent();
  }

  return false;
};

/**
 * Check if a method is a write operation
 */
export const isWriteMethod = (method: string): boolean => {
  return WRITE_METHODS.has(method);
};

/**
 * Check if a method is a read operation
 */
export const isReadMethod = (method: string): boolean => {
  return READ_METHODS.has(method);
};
