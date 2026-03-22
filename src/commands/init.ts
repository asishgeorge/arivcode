import type { ConfigStore, FileSystem, Logger, PartialArivConfig } from '../types.js';
import { runHookInstall } from './hook.js';

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
  fs?: FileSystem;
  projectDir?: string;
}

export async function runInit(deps: InitDeps): Promise<void> {
  const { prompter, configStore, logger, options, fs, projectDir } = deps;

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

  const { focusAreas } = await prompter.prompt([
    {
      type: 'checkbox',
      name: 'focusAreas',
      message: 'Select quiz focus areas:',
      choices: [
        { name: 'Syntax — language constructs, API signatures', value: 'syntax' },
        { name: 'Execution — control flow, state changes', value: 'execution' },
        { name: 'Architecture — patterns, design decisions', value: 'architecture' },
        { name: 'Edge Cases — boundary conditions, error paths', value: 'edge-cases' },
      ],
    },
  ]);

  answers.provider = provider;

  const config: PartialArivConfig = {
    provider: answers.provider,
    apiKey: answers.apiKey,
    model: answers.model,
    difficulty: answers.difficulty,
    minLines: Number(answers.minLines),
    passingScore: Number(answers.passingScore),
    focusAreas: focusAreas.length > 0 ? focusAreas : ['syntax', 'execution', 'architecture', 'edge-cases'],
  };

  const scope = options.global ? 'global' : 'project';
  await configStore.saveConfig(config, scope);
  logger.info(`Config saved (${scope}).`);

  // Offer to install git pre-commit hook (only for project-scoped init)
  if (!options.global && fs && projectDir) {
    const { installHook } = await prompter.prompt([
      {
        type: 'list',
        name: 'installHook',
        message: 'Would you like to install a git pre-commit hook?',
        choices: [
          { name: 'Yes — run quiz before every commit', value: true },
          { name: 'No — I\'ll set it up later', value: false },
        ],
      },
    ]);

    if (installHook) {
      await runHookInstall({ fs, logger, projectDir });
    }
  }
}
