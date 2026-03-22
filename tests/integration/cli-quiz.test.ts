import { describe, it, expect } from 'vitest';
import { runQuiz } from '../../src/commands/quiz.js';
import type {
  ArivConfig,
  ConfigStore,
  DiffResult,
  GitClient,
  LLMClient,
  Logger,
  QuizContext,
  QuizPresenter,
  QuizQuestion,
} from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/types.js';

const validConfig: ArivConfig = { ...DEFAULT_CONFIG, apiKey: 'sk-test' };

const sampleQuestions: QuizQuestion[] = [
  {
    question: 'What does X do?',
    options: { A: 'Adds', B: 'Subtracts', C: 'Multiplies', D: 'Divides' },
    correct: 'A',
    explanation: 'It adds.',
  },
  {
    question: 'Why was Y changed?',
    options: { A: 'Perf', B: 'Bug fix', C: 'Refactor', D: 'Feature' },
    correct: 'B',
    explanation: 'Bug fix.',
  },
  {
    question: 'Edge case?',
    options: { A: 'Null', B: 'Empty', C: 'Negative', D: 'Overflow' },
    correct: 'C',
    explanation: 'Negatives.',
  },
  {
    question: 'Import?',
    options: { A: 'lodash', B: 'helper', C: 'utils', D: 'config' },
    correct: 'B',
    explanation: 'Helper.',
  },
];

function createMockConfigStore(config: ArivConfig = validConfig): ConfigStore {
  return {
    loadConfig: async () => config,
    saveConfig: async () => {},
  };
}

function createMockGitClient(diff: DiffResult): GitClient {
  return {
    getStagedDiff: async () => diff,
    getRepoTree: async () => 'src/index.ts\npackage.json',
    getFileContents: async () => ({ 'src/index.ts': '// file content' }),
  };
}

function createMockLLMClient(): LLMClient {
  return {
    generateQuiz: async (_context: QuizContext, _config: ArivConfig) => ({
      questions: sampleQuestions,
    }),
  };
}

function createMockPresenter(answers: string[]): QuizPresenter {
  return { presentQuiz: async () => answers };
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

describe('quiz command', () => {
  it('skips quiz when diff below threshold, exits 0', async () => {
    const logger = createMockLogger();
    const exitCode = await runQuiz({
      configStore: createMockConfigStore(),
      gitClient: createMockGitClient({ raw: 'small', linesChanged: 3 }),
      llmClient: createMockLLMClient(),
      presenter: createMockPresenter([]),
      logger,
      options: {},
    });
    expect(exitCode).toBe(0);
    expect(logger.messages.some((m) => m.includes('skip'))).toBe(true);
  });

  it('passes on >= 80%, exits 0', async () => {
    const logger = createMockLogger();
    const exitCode = await runQuiz({
      configStore: createMockConfigStore(),
      gitClient: createMockGitClient({ raw: 'diff --git a/f.ts b/f.ts\n+big diff', linesChanged: 20 }),
      llmClient: createMockLLMClient(),
      presenter: createMockPresenter(['A', 'B', 'C', 'B']), // 100%
      logger,
      options: {},
    });
    expect(exitCode).toBe(0);
  });

  it('fails with exit 1 when score < 80%', async () => {
    const exitCode = await runQuiz({
      configStore: createMockConfigStore(),
      gitClient: createMockGitClient({ raw: 'diff --git a/f.ts b/f.ts\n+big diff', linesChanged: 20 }),
      llmClient: createMockLLMClient(),
      presenter: createMockPresenter(['D', 'D', 'D', 'D']), // 0%
      logger: createMockLogger(),
      options: {},
    });
    expect(exitCode).toBe(1);
  });

  it('respects --skip flag and exits 0 immediately', async () => {
    const logger = createMockLogger();
    const exitCode = await runQuiz({
      configStore: createMockConfigStore(),
      gitClient: createMockGitClient({ raw: 'diff --git a/f.ts b/f.ts\n+big diff', linesChanged: 20 }),
      llmClient: createMockLLMClient(),
      presenter: createMockPresenter([]),
      logger,
      options: { skip: true },
    });
    expect(exitCode).toBe(0);
    expect(logger.messages.some((m) => m.includes('skip'))).toBe(true);
  });

  it('shows error when no API key configured', async () => {
    const logger = createMockLogger();
    const exitCode = await runQuiz({
      configStore: createMockConfigStore({ ...DEFAULT_CONFIG, apiKey: '' }),
      gitClient: createMockGitClient({ raw: 'diff --git a/f.ts b/f.ts\n+big diff', linesChanged: 20 }),
      llmClient: createMockLLMClient(),
      presenter: createMockPresenter([]),
      logger,
      options: {},
    });
    expect(exitCode).toBe(1);
    expect(logger.messages.some((m) => m.includes('apiKey'))).toBe(true);
  });

  it('shows "no staged changes" message when diff is empty', async () => {
    const logger = createMockLogger();
    const exitCode = await runQuiz({
      configStore: createMockConfigStore(),
      gitClient: createMockGitClient({ raw: '', linesChanged: 0 }),
      llmClient: createMockLLMClient(),
      presenter: createMockPresenter([]),
      logger,
      options: {},
    });
    expect(exitCode).toBe(0);
    expect(logger.messages.some((m) => m.includes('no staged changes'))).toBe(true);
  });

  it('shows wrong answers even when quiz passes', async () => {
    const logger = createMockLogger();
    // 3 out of 4 correct = 75%, with passingScore 60 this passes
    const exitCode = await runQuiz({
      configStore: createMockConfigStore({ ...validConfig, passingScore: 60 }),
      gitClient: createMockGitClient({ raw: 'diff --git a/f.ts b/f.ts\n+big diff', linesChanged: 20 }),
      llmClient: createMockLLMClient(),
      presenter: createMockPresenter(['A', 'B', 'C', 'D']), // 4th is wrong (correct: B)
      logger,
      options: {},
    });
    expect(exitCode).toBe(0);
    expect(logger.messages.some((m) => m.includes('Quiz passed'))).toBe(true);
    expect(logger.messages.some((m) => m.includes('Incorrect answers'))).toBe(true);
  });

  it('handles network errors gracefully', async () => {
    const logger = createMockLogger();
    const exitCode = await runQuiz({
      configStore: createMockConfigStore(),
      gitClient: createMockGitClient({ raw: 'diff --git a/f.ts b/f.ts\n+big diff', linesChanged: 20 }),
      llmClient: {
        generateQuiz: async () => { throw new Error('fetch failed'); },
      },
      presenter: createMockPresenter([]),
      logger,
      options: {},
    });
    expect(exitCode).toBe(1);
    expect(logger.messages.some((m) => m.includes('Network error'))).toBe(true);
  });

  it('handles invalid API key errors gracefully', async () => {
    const logger = createMockLogger();
    const exitCode = await runQuiz({
      configStore: createMockConfigStore(),
      gitClient: createMockGitClient({ raw: 'diff --git a/f.ts b/f.ts\n+big diff', linesChanged: 20 }),
      llmClient: {
        generateQuiz: async () => { throw new Error('401 Unauthorized'); },
      },
      presenter: createMockPresenter([]),
      logger,
      options: {},
    });
    expect(exitCode).toBe(1);
    expect(logger.messages.some((m) => m.includes('Invalid API key'))).toBe(true);
  });

  it('handles rate limit errors gracefully', async () => {
    const logger = createMockLogger();
    const exitCode = await runQuiz({
      configStore: createMockConfigStore(),
      gitClient: createMockGitClient({ raw: 'diff --git a/f.ts b/f.ts\n+big diff', linesChanged: 20 }),
      llmClient: {
        generateQuiz: async () => { throw new Error('429 rate limit exceeded'); },
      },
      presenter: createMockPresenter([]),
      logger,
      options: {},
    });
    expect(exitCode).toBe(1);
    expect(logger.messages.some((m) => m.includes('Rate limited'))).toBe(true);
  });

  it('handles ExitPromptError gracefully', async () => {
    const logger = createMockLogger();
    const error = new Error('User force closed the prompt');
    error.name = 'ExitPromptError';
    const exitCode = await runQuiz({
      configStore: createMockConfigStore(),
      gitClient: createMockGitClient({ raw: 'diff --git a/f.ts b/f.ts\n+big diff', linesChanged: 20 }),
      llmClient: createMockLLMClient(),
      presenter: {
        presentQuiz: async () => { throw error; },
      },
      logger,
      options: {},
    });
    expect(exitCode).toBe(1);
    expect(logger.messages.some((m) => m.includes('cancelled'))).toBe(true);
  });
});
