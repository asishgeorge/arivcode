import type { FileSystem, Logger } from '../types.js';

const HOOK_SCRIPT = `#!/bin/sh
exec arivcode quiz
`;

export interface HookDeps {
  fs: FileSystem;
  logger: Logger;
  projectDir: string;
}

export async function runHookInstall(deps: HookDeps): Promise<number> {
  const { fs, logger, projectDir } = deps;
  const gitDir = `${projectDir}/.git`;
  const hookPath = `${gitDir}/hooks/pre-commit`;

  const gitExists = await fs.exists(`${gitDir}/HEAD`);
  if (!gitExists) {
    logger.error('Not a git repository. Run "git init" first.');
    return 1;
  }

  const hookExists = await fs.exists(hookPath);
  if (hookExists) {
    logger.warn('An existing pre-commit hook was found and will be replaced.');
  }

  await fs.mkdir(`${gitDir}/hooks`, { recursive: true });
  await fs.writeFile(hookPath, HOOK_SCRIPT);
  logger.info('Pre-commit hook installed successfully.');
  return 0;
}

export async function runHookUninstall(deps: HookDeps): Promise<number> {
  const { fs, logger, projectDir } = deps;
  const hookPath = `${projectDir}/.git/hooks/pre-commit`;

  const exists = await fs.exists(hookPath);
  if (!exists) {
    logger.info('No pre-commit hook found.');
    return 0;
  }

  const content = await fs.readFile(hookPath);
  if (!content.includes('arivcode')) {
    logger.warn('Pre-commit hook exists but is not managed by arivcode. Leaving it in place.');
    return 0;
  }

  await fs.unlink(hookPath);
  logger.info('Pre-commit hook removed.');
  return 0;
}
