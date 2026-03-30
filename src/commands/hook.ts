import type { FileSystem, Logger, QuizMode } from '../types.js';

const PRE_COMMIT_HOOK = `#!/bin/sh
if [ -t 0 ]; then
  arivcode quiz
else
  exec < /dev/tty
  arivcode quiz
fi
`;

const PRE_PUSH_HOOK = `#!/bin/sh
# arivcode: pre-push quiz
# pre-push receives push info on stdin, but we need stdin for the quiz
# consume stdin first, then redirect from tty
cat > /dev/null
exec < /dev/tty
arivcode quiz
`;

const PREPARE_COMMIT_MSG_HOOK = `#!/bin/sh
# arivcode: prepend quiz score to commit message
SCORE_FILE="$(git rev-parse --git-dir)/ARIVCODE_SCORE"
if [ -f "$SCORE_FILE" ]; then
  COMMIT_MSG_FILE="$1"
  ORIGINAL=$(cat "$COMMIT_MSG_FILE")
  # Skip if score is already prepended (e.g. amend)
  echo "$ORIGINAL" | grep -q "^arivcode" && { rm -f "$SCORE_FILE"; exit 0; }
  SCORE=$(cat "$SCORE_FILE")
  echo "$SCORE | $ORIGINAL" > "$COMMIT_MSG_FILE"
  rm -f "$SCORE_FILE"
fi
`;

export interface HookDeps {
  fs: FileSystem;
  logger: Logger;
  projectDir: string;
  mode?: QuizMode;
}

export async function runHookInstall(deps: HookDeps): Promise<number> {
  const { fs, logger, projectDir, mode = 'commit' } = deps;
  const gitDir = `${projectDir}/.git`;

  const gitExists = await fs.exists(`${gitDir}/HEAD`);
  if (!gitExists) {
    logger.error('Not a git repository. Run "git init" first.');
    return 1;
  }

  await fs.mkdir(`${gitDir}/hooks`, { recursive: true });

  if (mode === 'push') {
    const prePushPath = `${gitDir}/hooks/pre-push`;

    const prePushExists = await fs.exists(prePushPath);
    if (prePushExists) {
      logger.warn('An existing pre-push hook was found and will be replaced.');
    }

    await fs.writeFile(prePushPath, PRE_PUSH_HOOK);
    logger.info('Hook installed: pre-push');
  } else {
    const preCommitPath = `${gitDir}/hooks/pre-commit`;
    const prepareCommitMsgPath = `${gitDir}/hooks/prepare-commit-msg`;

    const preCommitExists = await fs.exists(preCommitPath);
    if (preCommitExists) {
      logger.warn('An existing pre-commit hook was found and will be replaced.');
    }

    const prepareExists = await fs.exists(prepareCommitMsgPath);
    if (prepareExists) {
      logger.warn('An existing prepare-commit-msg hook was found and will be replaced.');
    }

    await fs.writeFile(preCommitPath, PRE_COMMIT_HOOK);
    await fs.writeFile(prepareCommitMsgPath, PREPARE_COMMIT_MSG_HOOK);
    logger.info('Hooks installed: pre-commit, prepare-commit-msg');
  }

  return 0;
}

async function uninstallHook(
  fs: FileSystem,
  hookPath: string,
  hookName: string,
  logger: Logger,
): Promise<void> {
  const exists = await fs.exists(hookPath);
  if (!exists) {
    logger.info(`No ${hookName} hook found.`);
    return;
  }

  const content = await fs.readFile(hookPath);
  if (!content.includes('arivcode')) {
    logger.warn(`${hookName} hook exists but is not managed by arivcode. Leaving it in place.`);
    return;
  }

  await fs.unlink(hookPath);
  logger.info(`${hookName} hook removed.`);
}

export async function runHookUninstall(deps: HookDeps): Promise<number> {
  const { fs, logger, projectDir } = deps;
  const hooksDir = `${projectDir}/.git/hooks`;

  await uninstallHook(fs, `${hooksDir}/pre-commit`, 'pre-commit', logger);
  await uninstallHook(fs, `${hooksDir}/prepare-commit-msg`, 'prepare-commit-msg', logger);
  await uninstallHook(fs, `${hooksDir}/pre-push`, 'pre-push', logger);

  return 0;
}
