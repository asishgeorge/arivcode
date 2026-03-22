import { Command } from 'commander';
import { chmod } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { createNodeFs } from './adapters/node-fs.js';
import { createNodeProcessRunner } from './adapters/node-process.js';
import { createInquirerPresenter, createInquirerPrompter } from './adapters/inquirer-presenter.js';
import { loadConfig, saveConfig } from './core/config.js';
import { createGitClient } from './core/git.js';
import { createLLMClient } from './core/llm.js';
import { runQuiz } from './commands/quiz.js';
import { runInit } from './commands/init.js';
import { runHookInstall, runHookUninstall } from './commands/hook.js';
import { runConfigSet } from './commands/config-cmd.js';
import type { ConfigStore, Logger } from './types.js';

// __VERSION__ is injected by tsup at build time via `define`.
// At test time it's not defined, so we fall back to '0.0.0-dev'.
declare const __VERSION__: string;
const VERSION: string = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0-dev';

function createLogger(): Logger {
  let spinner: Ora | null = null;
  return {
    info: (msg: string) => console.log(chalk.green('✔'), msg),
    error: (msg: string) => console.error(chalk.red('✖'), msg),
    warn: (msg: string) => console.warn(chalk.yellow('⚠'), msg),
    startSpinner: (msg: string) => {
      spinner = ora({ text: msg, discardStdin: false }).start();
    },
    stopSpinner: (success = true, msg?: string) => {
      if (!spinner) return;
      if (success) {
        spinner.succeed(msg);
      } else {
        spinner.fail(msg);
      }
      spinner = null;
    },
  };
}

function createConfigStore(): ConfigStore {
  const fs = createNodeFs();
  const runner = createNodeProcessRunner();
  return {
    loadConfig: (projectDir?: string) => loadConfig(fs, runner, projectDir ?? process.cwd()),
    saveConfig: (config, scope, projectDir?) =>
      saveConfig(fs, config, scope, projectDir ?? process.cwd(), runner),
  };
}

export function createCli(): Command {
  const program = new Command();

  program
    .name('arivcode')
    .description('Quiz yourself on code changes before committing')
    .version(VERSION);

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
        fs,
        projectDir: process.cwd(),
      });
      process.exit(exitCode);
    });

  program
    .command('init')
    .description('Setup arivcode configuration')
    .option('--global', 'Save config globally instead of per-project')
    .option('--advanced', 'Show all configuration options')
    .action(async (opts) => {
      const logger = createLogger();
      const configStore = createConfigStore();
      const prompter = createInquirerPrompter();

      await runInit({
        prompter,
        configStore,
        logger,
        options: { global: opts.global, advanced: opts.advanced },
        fs: createNodeFs(),
        projectDir: process.cwd(),
      });
    });

  const hook = program.command('hook').description('Manage git pre-commit hook');

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
        await chmod(join(cwd, '.git', 'hooks', 'prepare-commit-msg'), 0o755);
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

  const configCmd = program.command('config').description('Manage configuration');

  configCmd
    .command('set <key> <value>')
    .description('Set a config value (e.g. arivcode config set passingScore 70)')
    .option('--global', 'Update global config instead of per-project')
    .action(async (key, value, opts) => {
      const logger = createLogger();
      const configStore = createConfigStore();
      const scope = opts.global ? 'global' : 'project';

      const exitCode = await runConfigSet({ key, value, configStore, logger, scope });
      process.exit(exitCode);
    });

  program
    .command('upgrade')
    .description('Upgrade arivcode to the latest version')
    .action(async () => {
      const logger = createLogger();
      const runner = createNodeProcessRunner();

      logger.info(`Current version: ${VERSION}`);
      logger.startSpinner('Upgrading arivcode...');
      try {
        await runner.exec('npm update -g arivcode');
        logger.stopSpinner(true, 'arivcode upgraded successfully');
      } catch {
        logger.stopSpinner(false, 'Upgrade failed. Try manually: npm update -g arivcode');
      }
    });

  return program;
}
