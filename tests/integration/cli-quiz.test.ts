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
});
