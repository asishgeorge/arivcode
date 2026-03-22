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
  it('prompts for provider, apiKey, model, difficulty, threshold, focusAreas', async () => {
    const answers = {
      provider: 'openai',
      apiKey: 'sk-test-123',
      model: 'gpt-4o-mini',
      difficulty: 'intermediate',
      minLines: 10,
      passingScore: 80,
      focusAreas: ['syntax', 'execution', 'architecture', 'edge-cases'],
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
    expect(config!.focusAreas).toEqual(['syntax', 'execution', 'architecture', 'edge-cases']);
  });

  it('saves config to project scope by default', async () => {
    const { store, getSaved } = createMockConfigStore();
    await runInit({
      prompter: createMockPrompter({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
        difficulty: 'beginner',
        minLines: 5,
        passingScore: 70,
        focusAreas: ['syntax'],
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
        difficulty: 'advanced',
        minLines: 15,
        passingScore: 90,
        focusAreas: ['architecture', 'edge-cases'],
      }),
      configStore: store,
      logger: createMockLogger(),
      options: { global: true },
    });
    expect(getSaved().scope).toBe('global');
  });

  it('defaults to all focus areas when none selected', async () => {
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
      }),
      configStore: store,
      logger: createMockLogger(),
      options: {},
    });
    const { config } = getSaved();
    expect(config!.focusAreas).toEqual(['syntax', 'execution', 'architecture', 'edge-cases']);
  });
});
