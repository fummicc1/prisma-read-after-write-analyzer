#!/usr/bin/env node

import { Command } from 'commander';
import { analyze } from './index.js';
import { logger } from './utils/logger.js';
import type { AnalyzerOptions } from './types.js';

const program = new Command();

program
  .name('prisma-raw-analyzer')
  .description('Analyze Prisma code for read-after-write issues with read replicas')
  .version('0.1.0')
  .argument('<project-path>', 'Path to the TypeScript project to analyze')
  .option('-o, --output <file>', 'Output file for JSON results (default: stdout)')
  .option('-i, --include <patterns>', 'Comma-separated glob patterns to include', 'src/**/*.ts')
  .option('-e, --exclude <patterns>', 'Comma-separated glob patterns to exclude', 'node_modules/**,dist/**,build/**')
  .option('--max-depth <number>', 'Maximum depth for call graph traversal', '100')
  .action(async (projectPath: string, options) => {
    try {
      logger.info(`Analyzing project at: ${projectPath}`);

      const analyzerOptions: AnalyzerOptions = {
        projectPath,
        includePatterns: options.include?.split(',').map((p: string) => p.trim()),
        excludePatterns: options.exclude?.split(',').map((p: string) => p.trim()),
        maxDepth: options.maxDepth ? parseInt(options.maxDepth, 10) : undefined,
      };

      const startTime = Date.now();
      const result = await analyze(analyzerOptions);
      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

      result.summary.executionTime = `${executionTime}s`;

      // Output results
      const jsonOutput = JSON.stringify(result, null, 2);

      if (options.output) {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(options.output, jsonOutput);
        logger.success(`Results written to: ${options.output}`);
      } else {
        console.log(jsonOutput);
      }

      // Summary
      logger.info(`\nAnalysis complete:`);
      logger.info(`  Files analyzed: ${result.summary.filesAnalyzed}`);
      logger.info(`  Issues found: ${result.summary.totalIssues}`);
      logger.info(`  Execution time: ${executionTime}s`);

      if (result.summary.totalIssues > 0) {
        logger.warning(`\n${result.summary.totalIssues} read-after-write issue(s) detected!`);
        process.exit(1);
      } else {
        logger.success('\nNo issues detected!');
        process.exit(0);
      }
    } catch (error) {
      logger.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        logger.debug(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
