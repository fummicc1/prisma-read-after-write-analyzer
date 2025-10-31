import { Project } from 'ts-morph';
import type { AnalyzerOptions, AnalysisResult, Issue } from './types.js';
import { logger } from './utils/logger.js';
import { pathExists, isDirectory } from './utils/file-utils.js';
import { detectPrismaClients } from './analyzer/prisma-detector.js';
import { detectIssuesInFile } from './analyzer/issue-detector.js';

/**
 * Main analysis function
 */
export const analyze = async (options: AnalyzerOptions): Promise<AnalysisResult> => {
  // Validate project path
  if (!pathExists(options.projectPath)) {
    throw new Error(`Project path does not exist: ${options.projectPath}`);
  }

  if (!isDirectory(options.projectPath)) {
    throw new Error(`Project path is not a directory: ${options.projectPath}`);
  }

  logger.info('Initializing TypeScript project...');

  // Initialize ts-morph project
  const project = new Project({
    tsConfigFilePath: `${options.projectPath}/tsconfig.json`,
  });

  const sourceFiles = project.getSourceFiles();
  logger.info(`Found ${sourceFiles.length} source files`);

  // Step 1: Detect PrismaClient instances
  logger.info('Detecting PrismaClient instances...');
  const prismaInstances = detectPrismaClients(sourceFiles);
  logger.info(`Found ${prismaInstances.length} PrismaClient instance(s)`);

  if (prismaInstances.length === 0) {
    logger.warning('No PrismaClient instances found. Analysis complete.');
    return {
      summary: {
        totalIssues: 0,
        filesAnalyzed: sourceFiles.length,
        executionTime: '0s',
      },
      issues: [],
    };
  }

  // Check if any instance has read replica extension
  const hasReadReplica = prismaInstances.some((instance) => instance.hasReadReplicaExtension);
  if (!hasReadReplica) {
    logger.warning('No read replica extension detected. Analysis may not be applicable.');
  }

  // Step 2: Analyze each file for read-after-write issues
  logger.info('Analyzing files for read-after-write issues...');
  const allIssues: Issue[] = [];

  for (const sourceFile of sourceFiles) {
    const issues = detectIssuesInFile(sourceFile, prismaInstances);
    allIssues.push(...issues);
  }

  logger.info(`Analysis complete. Found ${allIssues.length} issue(s)`);

  const result: AnalysisResult = {
    summary: {
      totalIssues: allIssues.length,
      filesAnalyzed: sourceFiles.length,
      executionTime: '0s', // Will be set by CLI
    },
    issues: allIssues,
  };

  return result;
};

export * from './types.js';
