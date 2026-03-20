import type { ConfigStore, Logger, PartialArivConfig } from '../types.js';

export interface InitOptions {
  global?: boolean;
}

interface Prompter {
  prompt(questions: any[]): Promise<Record<string, any>>;
}

export interface InitDeps {
  prompter: Prompter;
  configStore: ConfigStore;
  logger: Logger;
  options: InitOptions;
}

export async function runInit(deps: InitDeps): Promise<void> {
  const { prompter, configStore, logger, options } = deps;

  const modelsByProvider: Record<string, string[]> = {
    openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano'],
    google: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    anthropic: ['claude-sonnet-4-5-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-20250514'],
  };

  const { provider } = await prompter.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select your LLM provider (use arrow keys):',
      choices: [
        { name: 'OpenAI      — gpt-4o-mini, gpt-4o, gpt-4.1', value: 'openai' },
        { name: 'Google      — gemini-2.0-flash, gemini-2.5', value: 'google' },
        { name: 'Anthropic   — claude-sonnet, claude-haiku, claude-opus', value: 'anthropic' },
      ],
    },
  ]);

  const models = modelsByProvider[provider] ?? [];
  const answers = await prompter.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your API key:',
      mask: '*',
    },
    {
      type: 'list',
      name: 'model',
      message: 'Which model?',
      choices: models.map((m: string) => ({ name: m, value: m })),
    },
    {
      type: 'list',
      name: 'difficulty',
      message: 'Quiz difficulty level:',
      choices: [
        { name: 'Beginner', value: 'beginner' },
        { name: 'Intermediate', value: 'intermediate' },
        { name: 'Advanced', value: 'advanced' },
      ],
      default: 'intermediate',
    },
    {
      type: 'list',
      name: 'language',
      message: 'Primary language of your codebase:',
      choices: [
        { name: 'TypeScript', value: 'typescript' },
        { name: 'JavaScript', value: 'javascript' },
        { name: 'Python', value: 'python' },
        { name: 'Go', value: 'go' },
        { name: 'Rust', value: 'rust' },
        { name: 'Java', value: 'java' },
        { name: 'Other', value: 'other' },
      ],
      default: 'typescript',
    },
    {
      type: 'list',
      name: 'minLines',
      message: 'Minimum changed lines to trigger quiz:',
      choices: [
        { name: '5 lines', value: 5 },
        { name: '10 lines (recommended)', value: 10 },
        { name: '20 lines', value: 20 },
        { name: '50 lines', value: 50 },
      ],
      default: 10,
    },
    {
      type: 'list',
      name: 'questionsPerQuiz',
      message: 'Questions per quiz:',
      choices: [
        { name: '3 questions', value: 3 },
        { name: '4 questions (recommended)', value: 4 },
        { name: '5 questions', value: 5 },
      ],
      default: 4,
    },
    {
      type: 'list',
      name: 'passingScore',
      message: 'Passing score:',
      choices: [
        { name: '60%', value: 60 },
        { name: '70%', value: 70 },
        { name: '80% (recommended)', value: 80 },
        { name: '100%', value: 100 },
      ],
      default: 80,
    },
  ]);

  answers.provider = provider;

  const config: PartialArivConfig = {
    provider: answers.provider,
    apiKey: answers.apiKey,
    model: answers.model,
    difficulty: answers.difficulty,
    language: answers.language,
    minLines: Number(answers.minLines),
    questionsPerQuiz: Number(answers.questionsPerQuiz),
    passingScore: Number(answers.passingScore),
  };

  const scope = options.global ? 'global' : 'project';
  await configStore.saveConfig(config, scope);
  logger.info(`Config saved (${scope}).`);
}
