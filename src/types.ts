/**
 * Type definitions for the Prisma read-after-write analyzer
 */

export type PrismaOperationType = 'read' | 'write';

export type PrismaReadMethod =
  | 'findMany'
  | 'findUnique'
  | 'findFirst'
  | 'findFirstOrThrow'
  | 'findUniqueOrThrow'
  | 'count'
  | 'aggregate'
  | 'groupBy';

export type PrismaWriteMethod =
  | 'create'
  | 'createMany'
  | 'update'
  | 'updateMany'
  | 'upsert'
  | 'delete'
  | 'deleteMany';

export type PrismaMethod = PrismaReadMethod | PrismaWriteMethod;

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

export interface PrismaOperation {
  type: PrismaOperationType;
  method: PrismaMethod;
  model: string;
  location: SourceLocation;
  usesReplica: boolean;
  usesPrimary: boolean;
  inTransaction: boolean;
}

export interface CallChainEntry {
  functionName: string;
  file: string;
  line: number;
}

export interface Issue {
  type: 'read-after-write';
  severity: 'error' | 'warning';
  writeOperation: PrismaOperation;
  readOperation: PrismaOperation;
  callChain: string[];
  message: string;
}

export interface AnalysisResult {
  summary: {
    totalIssues: number;
    filesAnalyzed: number;
    executionTime: string;
  };
  issues: Issue[];
}

export interface AnalyzerOptions {
  projectPath: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxDepth?: number;
}
