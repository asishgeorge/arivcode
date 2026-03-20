import { describe, it, expect } from 'vitest';
import { buildQuizPrompt } from '../../src/core/prompt-builder.js';
import { DEFAULT_CONFIG } from '../../src/types.js';

const sampleDiff = `diff --git a/src/utils.ts b/src/utils.ts
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,5 @@
-import { old } from './old';
+import { newFn } from './new';
+import { helper } from './helper';
 export function calc(a: number): number {
-  return old(a);
+  return newFn(a) + helper(a);
 }`;

describe('prompt-builder', () => {
  describe('buildQuizPrompt', () => {
    const config = { ...DEFAULT_CONFIG, apiKey: 'sk-test' };

    it('includes the diff in the user message', () => {
      const { user } = buildQuizPrompt(sampleDiff, config);
      expect(user).toContain(sampleDiff);
    });

    it('includes difficulty level from config', () => {
      const { system } = buildQuizPrompt(sampleDiff, config);
      expect(system).toContain('intermediate');
    });

    it('includes language from config', () => {
      const { system } = buildQuizPrompt(sampleDiff, config);
      expect(system).toContain('typescript');
    });

    it('includes questionsPerQuiz count', () => {
      const { system } = buildQuizPrompt(sampleDiff, config);
      expect(system).toContain('4');
    });

    it('returns { system, user } message pair', () => {
      const result = buildQuizPrompt(sampleDiff, config);
      expect(result).toHaveProperty('system');
      expect(result).toHaveProperty('user');
      expect(typeof result.system).toBe('string');
      expect(typeof result.user).toBe('string');
    });

    it('truncates diff to 15000 chars with a note if too long', () => {
      const longDiff = 'x'.repeat(20000);
      const { user } = buildQuizPrompt(longDiff, config);
      expect(user.length).toBeLessThan(20000);
      expect(user).toContain('truncated');
    });
  });
});
