import { describe, it, expect } from 'vitest';
import { buildQuizPrompt, extractLanguagesFromDiff } from '../../src/core/prompt-builder.js';
import { DEFAULT_CONFIG } from '../../src/types.js';
import type { QuizContext } from '../../src/types.js';

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

function makeContext(overrides: Partial<QuizContext> = {}): QuizContext {
  return {
    diff: sampleDiff,
    repoTree: 'src/utils.ts\nsrc/index.ts\npackage.json',
    touchedFileContents: {
      'src/utils.ts': 'import { newFn } from "./new";\nexport function calc(a: number) { return newFn(a); }',
    },
    questionCount: 8,
    ...overrides,
  };
}

describe('prompt-builder', () => {
  describe('extractLanguagesFromDiff', () => {
    it('detects TypeScript from .ts extension', () => {
      const langs = extractLanguagesFromDiff(sampleDiff);
      expect(langs).toContain('TypeScript');
    });

    it('detects multiple languages', () => {
      const diff = `diff --git a/app.py b/app.py
--- a/app.py
+++ b/app.py
+print("hello")
diff --git a/style.css b/style.css
--- a/style.css
+++ b/style.css
+body { color: red; }`;
      const langs = extractLanguagesFromDiff(diff);
      expect(langs).toContain('Python');
      expect(langs).toContain('CSS');
    });

    it('returns empty array for no files', () => {
      expect(extractLanguagesFromDiff('')).toEqual([]);
    });
  });

  describe('buildQuizPrompt', () => {
    const config = { ...DEFAULT_CONFIG, apiKey: 'sk-test' };

    it('includes the diff in the user message', () => {
      const { user } = buildQuizPrompt(makeContext(), config);
      expect(user).toContain(sampleDiff);
    });

    it('includes difficulty guidance for intermediate', () => {
      const { system } = buildQuizPrompt(makeContext(), config);
      expect(system).toContain('Intermediate');
      expect(system).toContain('Why was this approach chosen');
    });

    it('includes beginner guidance', () => {
      const { system } = buildQuizPrompt(makeContext(), { ...config, difficulty: 'beginner' });
      expect(system).toContain('Beginner');
      expect(system).toContain('What does this code do');
    });

    it('includes advanced guidance', () => {
      const { system } = buildQuizPrompt(makeContext(), { ...config, difficulty: 'advanced' });
      expect(system).toContain('Advanced');
      expect(system).toContain('edge case');
    });

    it('includes auto-detected language', () => {
      const { system } = buildQuizPrompt(makeContext(), config);
      expect(system).toContain('TypeScript');
    });

    it('includes question count', () => {
      const { system } = buildQuizPrompt(makeContext({ questionCount: 12 }), config);
      expect(system).toContain('12');
    });

    it('includes focus area instructions', () => {
      const { system } = buildQuizPrompt(makeContext(), config);
      expect(system).toContain('Syntax & API');
      expect(system).toContain('Execution & Flow');
      expect(system).toContain('Architecture & Design');
      expect(system).toContain('Edge Cases & Errors');
    });

    it('distributes questions across focus areas', () => {
      const ctx = makeContext({ questionCount: 8 });
      const twoAreas = { ...config, focusAreas: ['syntax', 'execution'] as any };
      const { system } = buildQuizPrompt(ctx, twoAreas);
      expect(system).toContain('~4 questions');
    });

    it('includes repo tree in user prompt', () => {
      const { user } = buildQuizPrompt(makeContext(), config);
      expect(user).toContain('Repository Structure');
      expect(user).toContain('src/utils.ts');
    });

    it('includes full file contents in user prompt', () => {
      const { user } = buildQuizPrompt(makeContext(), config);
      expect(user).toContain('Full File Contents');
      expect(user).toContain('src/utils.ts');
      expect(user).toContain('newFn');
    });

    it('returns { system, user } message pair', () => {
      const result = buildQuizPrompt(makeContext(), config);
      expect(result).toHaveProperty('system');
      expect(result).toHaveProperty('user');
      expect(typeof result.system).toBe('string');
      expect(typeof result.user).toBe('string');
    });
  });
});
