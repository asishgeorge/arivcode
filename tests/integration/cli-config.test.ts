import { describe, it, expect } from 'vitest';
import { runConfigSet } from '../../src/commands/config-cmd.js';
import type { Logger, PartialArivConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/types.js';

function createMockConfigStore() {
  let savedConfig: PartialArivConfig | null = null;
  let savedScope: string | null = null;
  return {
    store: {
      loadConfig: async () => DEFAULT_CONFIG,
      saveConfig: async (config: PartialArivConfig, scope: 'project' | 'global') => {
        savedConfig = config;
        savedScope = scope;
      },
    },
    getSaved: () => ({ config: savedConfig, scope: savedScope }),
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

describe('config set command', () => {
  it('sets a string field (model)', async () => {
    const { store, getSaved } = createMockConfigStore();
    const exitCode = await runConfigSet({
      key: 'model',
      value: 'gpt-4o',
      configStore: store,
      logger: createMockLogger(),
      scope: 'project',
    });
    expect(exitCode).toBe(0);
    expect(getSaved().config).toEqual({ model: 'gpt-4o' });
  });

  it('sets a number field (passingScore)', async () => {
    const { store, getSaved } = createMockConfigStore();
    const exitCode = await runConfigSet({
      key: 'passingScore',
      value: '70',
      configStore: store,
      logger: createMockLogger(),
      scope: 'project',
    });
    expect(exitCode).toBe(0);
    expect(getSaved().config).toEqual({ passingScore: 70 });
  });

  it('sets a boolean field (scoreInCommitMessage)', async () => {
    const { store, getSaved } = createMockConfigStore();
    const exitCode = await runConfigSet({
      key: 'scoreInCommitMessage',
      value: 'true',
      configStore: store,
      logger: createMockLogger(),
      scope: 'project',
    });
    expect(exitCode).toBe(0);
    expect(getSaved().config).toEqual({ scoreInCommitMessage: true });
  });

  it('sets an array field (focusAreas) with comma-separated values', async () => {
    const { store, getSaved } = createMockConfigStore();
    const exitCode = await runConfigSet({
      key: 'focusAreas',
      value: 'syntax,execution',
      configStore: store,
      logger: createMockLogger(),
      scope: 'project',
    });
    expect(exitCode).toBe(0);
    expect(getSaved().config).toEqual({ focusAreas: ['syntax', 'execution'] });
  });

  it('rejects unknown keys', async () => {
    const { store } = createMockConfigStore();
    const logger = createMockLogger();
    const exitCode = await runConfigSet({
      key: 'unknownKey',
      value: 'anything',
      configStore: store,
      logger,
      scope: 'project',
    });
    expect(exitCode).toBe(1);
    expect(logger.messages.some((m) => m.includes('Unknown config key'))).toBe(true);
  });

  it('rejects invalid provider value', async () => {
    const { store } = createMockConfigStore();
    const logger = createMockLogger();
    const exitCode = await runConfigSet({
      key: 'provider',
      value: 'invalid-provider',
      configStore: store,
      logger,
      scope: 'project',
    });
    expect(exitCode).toBe(1);
    expect(logger.messages.some((m) => m.includes('must be one of'))).toBe(true);
  });

  it('rejects passingScore out of range', async () => {
    const { store } = createMockConfigStore();
    const logger = createMockLogger();
    const exitCode = await runConfigSet({
      key: 'passingScore',
      value: '150',
      configStore: store,
      logger,
      scope: 'project',
    });
    expect(exitCode).toBe(1);
  });

  it('rejects invalid boolean value', async () => {
    const { store } = createMockConfigStore();
    const logger = createMockLogger();
    const exitCode = await runConfigSet({
      key: 'scoreInCommitMessage',
      value: 'yes',
      configStore: store,
      logger,
      scope: 'project',
    });
    expect(exitCode).toBe(1);
  });

  it('saves to global scope when specified', async () => {
    const { store, getSaved } = createMockConfigStore();
    await runConfigSet({
      key: 'model',
      value: 'gpt-4o',
      configStore: store,
      logger: createMockLogger(),
      scope: 'global',
    });
    expect(getSaved().scope).toBe('global');
  });

  it('sets mode to push', async () => {
    const { store, getSaved } = createMockConfigStore();
    const exitCode = await runConfigSet({
      key: 'mode',
      value: 'push',
      configStore: store,
      logger: createMockLogger(),
      scope: 'project',
    });
    expect(exitCode).toBe(0);
    expect(getSaved().config).toEqual({ mode: 'push' });
  });

  it('sets mode to commit', async () => {
    const { store, getSaved } = createMockConfigStore();
    const exitCode = await runConfigSet({
      key: 'mode',
      value: 'commit',
      configStore: store,
      logger: createMockLogger(),
      scope: 'project',
    });
    expect(exitCode).toBe(0);
    expect(getSaved().config).toEqual({ mode: 'commit' });
  });

  it('rejects invalid mode value', async () => {
    const { store } = createMockConfigStore();
    const logger = createMockLogger();
    const exitCode = await runConfigSet({
      key: 'mode',
      value: 'invalid',
      configStore: store,
      logger,
      scope: 'project',
    });
    expect(exitCode).toBe(1);
    expect(logger.messages.some((m) => m.includes('must be one of'))).toBe(true);
  });

  it('rejects setting configVersion', async () => {
    const { store } = createMockConfigStore();
    const logger = createMockLogger();
    const exitCode = await runConfigSet({
      key: 'configVersion',
      value: '2',
      configStore: store,
      logger,
      scope: 'project',
    });
    expect(exitCode).toBe(1);
  });
});
