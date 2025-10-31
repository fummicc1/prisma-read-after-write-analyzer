import chalk from 'chalk';

export const logger = {
  info: (message: string): void => {
    console.log(chalk.blue('ℹ'), message);
  },

  success: (message: string): void => {
    console.log(chalk.green('✓'), message);
  },

  error: (message: string): void => {
    console.error(chalk.red('✗'), message);
  },

  warning: (message: string): void => {
    console.warn(chalk.yellow('⚠'), message);
  },

  debug: (message: string): void => {
    if (process.env.DEBUG) {
      console.log(chalk.gray('🔍'), message);
    }
  },
};
