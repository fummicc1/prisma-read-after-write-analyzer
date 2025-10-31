import type { SourceFile, VariableDeclaration, NewExpression } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

export interface PrismaClientInstance {
  name: string;
  file: string;
  line: number;
  hasReadReplicaExtension: boolean;
}

/**
 * Detect all PrismaClient instances in the project
 */
export const detectPrismaClients = (sourceFiles: SourceFile[]): PrismaClientInstance[] => {
  const instances: PrismaClientInstance[] = [];

  for (const sourceFile of sourceFiles) {
    // Find variable declarations
    const variableDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);

    for (const declaration of variableDeclarations) {
      if (isPrismaClientDeclaration(declaration)) {
        const name = declaration.getName();
        const { line } = sourceFile.getLineAndColumnAtPos(declaration.getStart());
        const hasReadReplicaExtension = checkReadReplicaExtension(declaration);

        instances.push({
          name,
          file: sourceFile.getFilePath(),
          line,
          hasReadReplicaExtension,
        });
      }
    }
  }

  return instances;
};

/**
 * Check if a variable declaration is a PrismaClient instance
 */
const isPrismaClientDeclaration = (declaration: VariableDeclaration): boolean => {
  const initializer = declaration.getInitializer();
  if (!initializer) {
    return false;
  }

  // Check for: new PrismaClient()
  if (initializer.getKind() === SyntaxKind.NewExpression) {
    const newExpr = initializer as NewExpression;
    const exprText = newExpr.getExpression().getText();
    return exprText === 'PrismaClient';
  }

  // Check for: prisma.$extends(...)
  const text = initializer.getText();
  return text.includes('PrismaClient') || text.includes('.$extends');
};

/**
 * Check if PrismaClient has read replica extension
 */
const checkReadReplicaExtension = (declaration: VariableDeclaration): boolean => {
  const initializer = declaration.getInitializer();
  if (!initializer) {
    return false;
  }

  const text = initializer.getText();

  // Check for readReplicas extension
  return text.includes('readReplicas') || text.includes('read-replicas');
};

/**
 * Check if an identifier refers to a PrismaClient instance
 */
export const isPrismaClientReference = (
  identifierName: string,
  prismaInstances: PrismaClientInstance[]
): boolean => {
  return prismaInstances.some((instance) => instance.name === identifierName);
};
