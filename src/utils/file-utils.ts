import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Check if a path is a directory
 */
export const isDirectory = (path: string): boolean => {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/**
 * Check if a path is a file
 */
export const isFile = (path: string): boolean => {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
};

/**
 * Check if a path exists
 */
export const pathExists = (path: string): boolean => {
  return existsSync(path);
};

/**
 * Resolve a path relative to a base directory
 */
export const resolvePath = (basePath: string, relativePath: string): string => {
  return join(basePath, relativePath);
};

/**
 * Check if a file should be analyzed (TypeScript files only)
 */
export const shouldAnalyzeFile = (filePath: string): boolean => {
  return filePath.endsWith('.ts') || filePath.endsWith('.tsx');
};
