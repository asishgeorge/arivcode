import { describe, it, expect } from 'vitest';
import { resolveProvider } from '../../src/core/llm.js';

describe('llm', () => {
  describe('resolveProvider', () => {
    it('returns a provider for "openai"', () => {
      const provider = resolveProvider('openai', 'sk-test');
      expect(provider).toBeDefined();
    });

    it('returns a provider for "google"', () => {
      const provider = resolveProvider('google', 'test-key');
      expect(provider).toBeDefined();
    });

    it('returns a provider for "anthropic"', () => {
      const provider = resolveProvider('anthropic', 'sk-ant-test');
      expect(provider).toBeDefined();
    });

    it('throws on unknown provider', () => {
      expect(() => resolveProvider('mistral' as any, 'key')).toThrow(
        /Unsupported provider/,
      );
    });
  });
});
