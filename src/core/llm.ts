import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import {
  quizResponseSchema,
  type ArivConfig,
  type LLMClient,
  type Provider,
  type QuizResponse,
} from '../types.js';
import { buildQuizPrompt } from './prompt-builder.js';

export function resolveProvider(provider: Provider, apiKey: string) {
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey });
    case 'google':
      return createGoogleGenerativeAI({ apiKey });
    case 'anthropic':
      return createAnthropic({ apiKey });
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export function createLLMClient(config: ArivConfig): LLMClient {
  return {
    async generateQuiz(diff: string, cfg: ArivConfig): Promise<QuizResponse> {
      const provider = resolveProvider(cfg.provider, cfg.apiKey);
      const model = provider(cfg.model);
      const { system, user } = buildQuizPrompt(diff, cfg);

      const { object } = await generateObject({
        model,
        schema: quizResponseSchema,
        system,
        prompt: user,
      });

      return object;
    },
  };
}
