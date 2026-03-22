import { z } from 'zod';

// === Providers ===

export const SUPPORTED_PROVIDERS = ['openai', 'google', 'anthropic'] as const;
export type Provider = (typeof SUPPORTED_PROVIDERS)[number];

// === Focus Areas ===

export const FOCUS_AREAS = ['syntax', 'execution', 'architecture', 'edge-cases'] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];

// === Question Brackets ===

export const QUESTION_BRACKETS = [
  { minLines: 10, maxLines: 100, questions: 8 },
  { minLines: 101, maxLines: 250, questions: 12 },
  { minLines: 251, maxLines: 500, questions: 16 },
  { minLines: 501, maxLines: Infinity, questions: 20 },
] as const;

// === Config ===

export interface ArivConfig {
  provider: Provider;
  apiKey: string;
  model: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  minLines: number;
  passingScore: number;
  focusAreas: FocusArea[];
  scoreInCommitMessage: boolean;
}

export type PartialArivConfig = Partial<ArivConfig>;

export const DEFAULT_CONFIG: ArivConfig = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  difficulty: 'intermediate',
  minLines: 10,
  passingScore: 80,
  focusAreas: ['syntax', 'execution', 'architecture', 'edge-cases'],
  scoreInCommitMessage: false,
};

// === Project Registry ===

export interface ProjectRegistryEntry {
  absolutePath: string;
  remoteUrl: string;
}

export interface ProjectRegistry {
  projects: Record<string, ProjectRegistryEntry>;
}

// === Quiz (Zod schemas for generateText) ===

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

// === Quiz Context ===

export interface QuizContext {
  diff: string;
  repoTree: string;
  touchedFileContents: Record<string, string>;
  questionCount: number;
}

// === Git ===

export interface DiffResult {
  raw: string;
  linesChanged: number;
}

// === Dependency Injection Interfaces ===

export interface GitClient {
  getStagedDiff(): Promise<DiffResult>;
  getRepoTree(): Promise<string>;
  getFileContents(paths: string[]): Promise<Record<string, string>>;
}

export interface LLMClient {
  generateQuiz(context: QuizContext, config: ArivConfig): Promise<QuizResponse>;
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
  chmod(path: string, mode: number): Promise<void>;
}

export interface ProcessRunner {
  exec(command: string): Promise<{ stdout: string; stderr: string }>;
}

export interface Logger {
  info(message: string): void;
  error(message: string): void;
  warn(message: string): void;
  startSpinner(message: string): void;
  stopSpinner(success?: boolean, message?: string): void;
}
