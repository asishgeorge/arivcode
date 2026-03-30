import { DEFAULT_CONFIG } from '../types.js';
import type { ArivConfig, ConfigStore, FileSystem, Logger, PartialArivConfig } from '../types.js';
import { runHookInstall } from './hook.js';

export interface InitOptions {
  global?: boolean;
  advanced?: boolean;
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

const modelsByProvider: Record<string, string[]> = {
  openai: [
    'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano',
    'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
    'o3', 'o3-mini', 'o4-mini',
  ],
  google: [
    'gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite',
    'gemini-2.5-pro', 'gemini-2.5-flash',
  ],
  anthropic: [
    'claude-opus-4-6', 'claude-sonnet-4-6',
    'claude-sonnet-4-5-20250514', 'claude-haiku-4-5-20251001',
  ],
};

const defaultModelByProvider: Record<string, string> = {
  openai: 'gpt-5.4-mini',
  google: 'gemini-2.5-flash',
  anthropic: 'claude-sonnet-4-6',
};

export async function runInit(deps: InitDeps): Promise<void> {
  const { prompter, configStore, logger, options, fs, projectDir } = deps;

  // Load existing config for pre-filling defaults in advanced mode
  let existing: ArivConfig = DEFAULT_CONFIG;
  if (options.advanced) {
    try {
      existing = await configStore.loadConfig(projectDir);
    } catch {
      // Fall back to defaults if config can't be loaded
    }
  }

  const { provider } = await prompter.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select your LLM provider (use arrow keys):',
      choices: [
        { name: 'OpenAI      — gpt-5.4, gpt-4.1, o3', value: 'openai' },
        { name: 'Google      — gemini-3.1-pro, gemini-3-flash, gemini-2.5', value: 'google' },
        { name: 'Anthropic   — claude-opus-4.6, claude-sonnet-4.6, claude-haiku', value: 'anthropic' },
      ],
      default: existing.provider,
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
      default: existing.model === DEFAULT_CONFIG.model
        ? defaultModelByProvider[provider] ?? models[0]
        : existing.model,
    },
  ]);

  answers.provider = provider;

  const { mode } = await prompter.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'When should the quiz run?',
      choices: [
        { name: 'Every commit — thorough review of each change', value: 'commit' },
        { name: 'Every push   — stay in flow, quiz before sharing', value: 'push' },
      ],
      default: existing.mode ?? 'commit',
    },
  ]);

  const config: PartialArivConfig = {
    provider: answers.provider,
    apiKey: answers.apiKey,
    model: answers.model,
    mode,
  };

  if (options.advanced) {
    const advancedAnswers = await prompter.prompt([
      {
        type: 'list',
        name: 'difficulty',
        message: 'Quiz difficulty level:',
        choices: [
          { name: 'Beginner', value: 'beginner' },
          { name: 'Intermediate', value: 'intermediate' },
          { name: 'Advanced', value: 'advanced' },
        ],
        default: existing.difficulty,
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
        default: existing.minLines,
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
        default: existing.passingScore,
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
        default: existing.focusAreas,
      },
    ]);

    const { scoreInCommitMessage } = await prompter.prompt([
      {
        type: 'list',
        name: 'scoreInCommitMessage',
        message: 'Append quiz score to commit messages?',
        choices: [
          { name: 'Yes — add score badge to each commit', value: true },
          { name: 'No', value: false },
        ],
        default: existing.scoreInCommitMessage,
      },
    ]);

    config.difficulty = advancedAnswers.difficulty;
    config.minLines = Number(advancedAnswers.minLines);
    config.passingScore = Number(advancedAnswers.passingScore);
    config.focusAreas =
      focusAreas.length > 0 ? focusAreas : ['syntax', 'execution', 'architecture', 'edge-cases'];
    config.scoreInCommitMessage = scoreInCommitMessage;
  }

  const scope = options.global ? 'global' : 'project';
  await configStore.saveConfig(config, scope);
  logger.info(`Config saved (${scope}).`);

  // Offer to install git hook (only for project-scoped init)
  if (!options.global && fs && projectDir) {
    const hookType = mode === 'push' ? 'pre-push' : 'pre-commit';
    const hookDesc = mode === 'push' ? 'run quiz before every push' : 'run quiz before every commit';

    const { installHook } = await prompter.prompt([
      {
        type: 'list',
        name: 'installHook',
        message: `Would you like to install a git ${hookType} hook?`,
        choices: [
          { name: `Yes — ${hookDesc}`, value: true },
          { name: "No — I'll set it up later", value: false },
        ],
      },
    ]);

    if (installHook) {
      await runHookInstall({ fs, logger, projectDir, mode });
    }
  }
}
