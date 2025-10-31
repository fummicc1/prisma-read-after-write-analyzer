import type { SourceFile, CallExpression, Node } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';
import type { PrismaOperation, Issue } from '../types.js';
import { classifyOperation } from './operation-classifier.js';
import type { PrismaClientInstance } from './prisma-detector.js';

interface OperationWithNode {
  operation: PrismaOperation;
  node: CallExpression;
}

/**
 * Detect read-after-write issues in a source file
 */
export const detectIssuesInFile = (
  sourceFile: SourceFile,
  _prismaInstances: PrismaClientInstance[]
): Issue[] => {
  const issues: Issue[] = [];

  // Get all functions in the file
  const functions = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
  ];

  // Analyze each function separately
  for (const func of functions) {
    const funcIssues = detectIssuesInFunction(func);
    issues.push(...funcIssues);
  }

  return issues;
};

/**
 * Detect read-after-write issues within a single function
 */
const detectIssuesInFunction = (func: Node): Issue[] => {
  const issues: Issue[] = [];

  // Get all call expressions in this function
  const callExpressions = func.getDescendantsOfKind(SyntaxKind.CallExpression);

  // Classify all Prisma operations
  const operations: OperationWithNode[] = [];
  for (const callExpr of callExpressions) {
    const operation = classifyOperation(callExpr);
    if (operation) {
      operations.push({ operation, node: callExpr });
    }
  }

  // Detect write → read patterns within this function
  for (let i = 0; i < operations.length; i++) {
    const { operation: writeOp } = operations[i];

    // Skip if not a write operation
    if (writeOp.type !== 'write') {
      continue;
    }

    // Skip if in transaction (always uses primary)
    if (writeOp.inTransaction) {
      continue;
    }

    // Look for read operations after this write in the same function
    for (let j = i + 1; j < operations.length; j++) {
      const { operation: readOp } = operations[j];

      // Skip if not a read operation
      if (readOp.type !== 'read') {
        continue;
      }

      // Skip if in transaction
      if (readOp.inTransaction) {
        continue;
      }

      // Skip if explicitly uses $primary()
      if (readOp.usesPrimary) {
        continue;
      }

      // This is a potential issue:
      // - Write operation followed by read operation in the same function
      // - Read operation doesn't explicitly use $primary()
      // - Read operation will use replica by default (or explicitly uses $replica())

      const issue: Issue = {
        type: 'read-after-write',
        severity: 'error',
        writeOperation: writeOp,
        readOperation: readOp,
        callChain: [
          `${writeOp.location.file}:${writeOp.location.line}`,
          `${readOp.location.file}:${readOp.location.line}`,
        ],
        message: `Read operation on ${readOp.model}.${readOp.method}() may use replica immediately after write operation on ${writeOp.model}.${writeOp.method}(), potentially reading stale data. Consider using $primary() for the read operation.`,
      };

      issues.push(issue);
    }
  }

  return issues;
};

