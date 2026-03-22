import { describe, it, expect } from 'vitest';
import { runHookInstall, runHookUninstall } from '../../src/commands/hook.js';
import type { FileSystem, Logger } from '../../src/types.js';

function createMockFs(files: Record<string, string> = {}): FileSystem {
  return {
    readFile: async (path: string) => {
      if (path in files) return files[path];
      throw new Error(`ENOENT: no such file: ${path}`);
    },
    writeFile: async (path: string, content: string) => {
      files[path] = content;
    },
    exists: async (path: string) => path in files,
    unlink: async (path: string) => {
      delete files[path];
    },
    mkdir: async () => {},
    chmod: async () => {},
  };
}

function createMockLogger(): Logger & { messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    info: (msg: string) => messages.push(msg),
    error: (msg: string) => messages.push(msg),
    warn: (msg: string) => messages.push(msg),
    startSpinner: () => {},
    stopSpinner: () => {},
  };
}

describe('hook install', () => {
  it('writes pre-commit hook to .git/hooks/pre-commit', async () => {
    const files: Record<string, string> = {};
    const fs = createMockFs(files);
    const logger = createMockLogger();
    // Simulate .git directory existing
    files['/project/.git/HEAD'] = 'ref: refs/heads/main';

    await runHookInstall({ fs, logger, projectDir: '/project' });
    expect(files['/project/.git/hooks/pre-commit']).toBeDefined();
  });

  it('hook script contains "arivcode quiz" command', async () => {
    const files: Record<string, string> = {};
    const fs = createMockFs(files);
    files['/project/.git/HEAD'] = 'ref: refs/heads/main';

    await runHookInstall({ fs, logger: createMockLogger(), projectDir: '/project' });
    expect(files['/project/.git/hooks/pre-commit']).toContain('arivcode quiz');
  });

  it('warns if hook file already exists', async () => {
    const files: Record<string, string> = {
      '/project/.git/HEAD': 'ref: refs/heads/main',
      '/project/.git/hooks/pre-commit': '#!/bin/sh\necho "existing hook"',
    };
    const fs = createMockFs(files);
    const logger = createMockLogger();

    await runHookInstall({ fs, logger, projectDir: '/project' });
    expect(logger.messages.some((m) => m.includes('existing') || m.includes('overwrite') || m.includes('replaced'))).toBe(true);
  });

  it('fails if .git directory does not exist', async () => {
    const fs = createMockFs();
    const logger = createMockLogger();

    const exitCode = await runHookInstall({ fs, logger, projectDir: '/project' });
    expect(exitCode).toBe(1);
    expect(logger.messages.some((m) => m.includes('git'))).toBe(true);
  });
});

describe('hook uninstall', () => {
  it('removes .git/hooks/pre-commit if it contains arivcode', async () => {
    const files: Record<string, string> = {
      '/project/.git/hooks/pre-commit': '#!/bin/sh\nexec arivcode quiz\n',
    };
    const fs = createMockFs(files);
    const logger = createMockLogger();

    await runHookUninstall({ fs, logger, projectDir: '/project' });
    expect(files['/project/.git/hooks/pre-commit']).toBeUndefined();
  });

  it('does not remove hook if it does not contain arivcode', async () => {
    const files: Record<string, string> = {
      '/project/.git/hooks/pre-commit': '#!/bin/sh\nnpm test\n',
    };
    const fs = createMockFs(files);
    const logger = createMockLogger();

    await runHookUninstall({ fs, logger, projectDir: '/project' });
    expect(files['/project/.git/hooks/pre-commit']).toBeDefined();
    expect(logger.messages.some((m) => m.includes('not managed'))).toBe(true);
  });

  it('shows message if no hook found', async () => {
    const fs = createMockFs();
    const logger = createMockLogger();

    await runHookUninstall({ fs, logger, projectDir: '/project' });
    expect(logger.messages.some((m) => m.includes('No pre-commit hook') || m.includes('not found'))).toBe(true);
  });
});
