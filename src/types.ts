import { z } from 'zod';

// === Providers ===

export const SUPPORTED_PROVIDERS = ['openai', 'google', 'anthropic'] as const;
export type Provider = (typeof SUPPORTED_PROVIDERS)[number];

// === Config ===

export interface ArivConfig {
  provider: Provider;
  apiKey: string;
  model: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  minLines: number;
  questionsPerQuiz: number;
  passingScore: number;
}

export type PartialArivConfig = Partial<ArivConfig>;

export const DEFAULT_CONFIG: ArivConfig = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  difficulty: 'intermediate',
  language: 'typescript',
  minLines: 10,
  questionsPerQuiz: 4,
  passingScore: 80,
};

// === Quiz (Zod schemas for generateObject) ===

export const quizQuestionSchema = z.object({
  question: z.string(),
  options: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
  }),
  correct: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string(),
});

export const quizResponseSchema = z.object({
  questions: z.array(quizQuestionSchema),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizResponse = z.infer<typeof quizResponseSchema>;

export interface QuizResult {
  total: number;
  correct: number;
  percentage: number;
  passed: boolean;
  details: Array<{
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }>;
}

// === Git ===

export interface DiffResult {
  raw: string;
  linesChanged: number;
}

// === Dependency Injection Interfaces ===

export interface GitClient {
  getStagedDiff(): Promise<DiffResult>;
}

export interface LLMClient {
  generateQuiz(diff: string, config: ArivConfig): Promise<QuizResponse>;
}

export interface ConfigStore {
  loadConfig(projectDir?: string): Promise<ArivConfig>;
  saveConfig(
    config: PartialArivConfig,
    scope: 'project' | 'global',
    projectDir?: string,
  ): Promise<void>;
}

export interface QuizPresenter {
  presentQuiz(questions: QuizQuestion[]): Promise<string[]>;
}

export interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  unlink(path: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
}

export interface ProcessRunner {
  exec(command: string): Promise<{ stdout: string; stderr: string }>;
}

export interface Logger {
  info(message: string): void;
  error(message: string): void;
  warn(message: string): void;
}
