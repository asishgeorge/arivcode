import { Command } from 'commander';
import { chmod } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import { createNodeFs } from './adapters/node-fs.js';
import { createNodeProcessRunner } from './adapters/node-process.js';
import { createInquirerPresenter, createInquirerPrompter } from './adapters/inquirer-presenter.js';
import { loadConfig, saveConfig } from './core/config.js';
import { createGitClient } from './core/git.js';
import { createLLMClient } from './core/llm.js';
import { runQuiz } from './commands/quiz.js';
import { runInit } from './commands/init.js';
import { runHookInstall, runHookUninstall } from './commands/hook.js';
import type { ConfigStore, Logger } from './types.js';

function createLogger(): Logger {
  return {
    info: (msg: string) => console.log(chalk.green('✔'), msg),
    error: (msg: string) => console.error(chalk.red('✖'), msg),
    warn: (msg: string) => console.warn(chalk.yellow('⚠'), msg),
  };
}

function createConfigStore(): ConfigStore {
  const fs = createNodeFs();
  return {
    loadConfig: (projectDir?: string) => loadConfig(fs, projectDir ?? process.cwd()),
    saveConfig: (config, scope, projectDir?) =>
      saveConfig(fs, config, scope, projectDir ?? process.cwd()),
  };
}

export function createCli(): Command {
  const program = new Command();

  program
    .name('arivcode')
    .description('Quiz yourself on code changes before committing')
    .version('0.1.0');

  program
    .command('quiz')
    .description('Quiz on current staged changes')
    .option('--skip', 'Skip the quiz and allow the commit')
    .action(async (opts) => {
      const logger = createLogger();
      const fs = createNodeFs();
      const runner = createNodeProcessRunner();
      const configStore = createConfigStore();
      const config = await configStore.loadConfig();
      const gitClient = createGitClient(runner);
      const llmClient = createLLMClient(config);
      const presenter = createInquirerPresenter();

      const exitCode = await runQuiz({
        configStore,
        gitClient,
        llmClient,
        presenter,
        logger,
        options: { skip: opts.skip },
      });
      process.exit(exitCode);
    });

  program
    .command('init')
    .description('Setup arivcode configuration')
    .option('--global', 'Save config globally instead of per-project')
    .action(async (opts) => {
      const logger = createLogger();
      const configStore = createConfigStore();
      const prompter = createInquirerPrompter();

      await runInit({
        prompter,
        configStore,
        logger,
        options: { global: opts.global },
      });
    });

  const hook = program
    .command('hook')
    .description('Manage git pre-commit hook');

  hook
    .command('install')
    .description('Install git pre-commit hook')
    .action(async () => {
      const logger = createLogger();
      const fs = createNodeFs();

      const cwd = process.cwd();
      const exitCode = await runHookInstall({
        fs,
        logger,
        projectDir: cwd,
      });
      if (exitCode === 0) {
        await chmod(join(cwd, '.git', 'hooks', 'pre-commit'), 0o755);
      }
      process.exit(exitCode);
    });

  hook
    .command('uninstall')
    .description('Remove git pre-commit hook')
    .action(async () => {
      const logger = createLogger();
      const fs = createNodeFs();

      const exitCode = await runHookUninstall({
        fs,
        logger,
        projectDir: process.cwd(),
      });
      process.exit(exitCode);
    });

  return program;
}
