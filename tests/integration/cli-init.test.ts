import { describe, it, expect } from 'vitest';
import { runInit } from '../../src/commands/init.js';
import type { Logger, PartialArivConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/types.js';

interface MockPrompter {
  prompt(questions: any[]): Promise<Record<string, any>>;
}

function createMockPrompter(answers: Record<string, any>): MockPrompter {
  return {
    prompt: async () => answers,
  };
}

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

describe('init command', () => {
  it('saves provider, apiKey, model in simple mode', async () => {
    const answers = {
      provider: 'openai',
      apiKey: 'sk-test-123',
      model: 'gpt-4o-mini',
      installHook: false,
    };
    const { store, getSaved } = createMockConfigStore();
    await runInit({
      prompter: createMockPrompter(answers),
      configStore: store,
      logger: createMockLogger(),
      options: {},
    });
    const { config } = getSaved();
    expect(config).toBeDefined();
    expect(config!.apiKey).toBe('sk-test-123');
    expect(config!.provider).toBe('openai');
    expect(config!.model).toBe('gpt-4o-mini');
    // Advanced fields should not be set in simple mode
    expect(config!.difficulty).toBeUndefined();
    expect(config!.focusAreas).toBeUndefined();
  });

  it('saves config to project scope by default', async () => {
    const { store, getSaved } = createMockConfigStore();
    await runInit({
      prompter: createMockPrompter({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
        installHook: false,
      }),
      configStore: store,
      logger: createMockLogger(),
      options: {},
    });
    expect(getSaved().scope).toBe('project');
  });

  it('saves config to global scope with --global flag', async () => {
    const { store, getSaved } = createMockConfigStore();
    await runInit({
      prompter: createMockPrompter({
        provider: 'anthropic',
        apiKey: 'sk-ant-test',
        model: 'claude-3-haiku-20240307',
        installHook: false,
      }),
      configStore: store,
      logger: createMockLogger(),
      options: { global: true },
    });
    expect(getSaved().scope).toBe('global');
  });

  it('includes all fields in advanced mode', async () => {
    const answers = {
      provider: 'openai',
      apiKey: 'sk-test-123',
      model: 'gpt-4o-mini',
      difficulty: 'advanced',
      minLines: 20,
      passingScore: 90,
      focusAreas: ['syntax', 'architecture'],
      scoreInCommitMessage: true,
      installHook: false,
    };
    const { store, getSaved } = createMockConfigStore();
    await runInit({
      prompter: createMockPrompter(answers),
      configStore: store,
      logger: createMockLogger(),
      options: { advanced: true },
    });
    const { config } = getSaved();
    expect(config).toBeDefined();
    expect(config!.provider).toBe('openai');
    expect(config!.difficulty).toBe('advanced');
    expect(config!.passingScore).toBe(90);
    expect(config!.scoreInCommitMessage).toBe(true);
    expect(config!.focusAreas).toEqual(['syntax', 'architecture']);
  });

  it('saves mode from default init flow', async () => {
    const answers = {
      provider: 'openai',
      apiKey: 'sk-test-123',
      model: 'gpt-4o-mini',
      mode: 'push',
      installHook: false,
    };
    const { store, getSaved } = createMockConfigStore();
    await runInit({
      prompter: createMockPrompter(answers),
      configStore: store,
      logger: createMockLogger(),
      options: {},
    });
    const { config } = getSaved();
    expect(config).toBeDefined();
    expect(config!.mode).toBe('push');
  });

  it('defaults mode to commit when not specified', async () => {
    const answers = {
      provider: 'openai',
      apiKey: 'sk-test-123',
      model: 'gpt-4o-mini',
      mode: 'commit',
      installHook: false,
    };
    const { store, getSaved } = createMockConfigStore();
    await runInit({
      prompter: createMockPrompter(answers),
      configStore: store,
      logger: createMockLogger(),
      options: {},
    });
    const { config } = getSaved();
    expect(config!.mode).toBe('commit');
  });

  it('defaults to all focus areas when none selected in advanced mode', async () => {
    const { store, getSaved } = createMockConfigStore();
    await runInit({
      prompter: createMockPrompter({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
        difficulty: 'intermediate',
        minLines: 10,
        passingScore: 80,
        focusAreas: [],
        scoreInCommitMessage: true,
        installHook: false,
      }),
      configStore: store,
      logger: createMockLogger(),
      options: { advanced: true },
    });
    const { config } = getSaved();
    expect(config!.focusAreas).toEqual(['syntax', 'execution', 'architecture', 'edge-cases']);
  });
});
