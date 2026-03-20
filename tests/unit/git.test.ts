import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createGitClient, countChangedLines } from '../../src/core/git.js';
import type { ProcessRunner } from '../../src/types.js';

const sampleDiff = readFileSync(
  join(import.meta.dirname, '../fixtures/sample-diff.txt'),
  'utf-8',
);

function createMockRunner(stdout: string, stderr = ''): ProcessRunner {
  return {
    exec: async () => ({ stdout, stderr }),
  };
}

function createFailingRunner(error: Error): ProcessRunner {
  return {
    exec: async () => {
      throw error;
    },
  };
}

describe('git', () => {
  describe('getStagedDiff', () => {
    it('runs "git diff --staged" and returns raw output', async () => {
      const runner = createMockRunner(sampleDiff);
      const client = createGitClient(runner);
      const result = await client.getStagedDiff();
      expect(result.raw).toBe(sampleDiff);
    });

    it('counts lines changed (additions + deletions)', async () => {
      const runner = createMockRunner(sampleDiff);
      const client = createGitClient(runner);
      const result = await client.getStagedDiff();
      // sample-diff.txt has: 2 deletions (- lines) + 7 additions (+ lines) = 9
      expect(result.linesChanged).toBe(9);
    });

    it('returns linesChanged: 0 for empty diff', async () => {
      const runner = createMockRunner('');
      const client = createGitClient(runner);
      const result = await client.getStagedDiff();
      expect(result.raw).toBe('');
      expect(result.linesChanged).toBe(0);
    });

    it('throws descriptive error when not in a git repo', async () => {
      const runner = createFailingRunner(new Error('fatal: not a git repository'));
      const client = createGitClient(runner);
      await expect(client.getStagedDiff()).rejects.toThrow(/not a git repository/);
    });
  });

  describe('countChangedLines', () => {
    it('counts only + and - lines (not headers/context)', () => {
      expect(countChangedLines(sampleDiff)).toBe(9);
    });

    it('ignores --- and +++ file header lines', () => {
      const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
-old line
+new line
 context line`;
      expect(countChangedLines(diff)).toBe(2);
    });

    it('returns 0 for empty string', () => {
      expect(countChangedLines('')).toBe(0);
    });

    it('handles multiple files in one diff', () => {
      const diff = `diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
@@ -1,2 +1,2 @@
-old
+new
diff --git a/file2.ts b/file2.ts
--- a/file2.ts
+++ b/file2.ts
@@ -1,2 +1,3 @@
 keep
-remove
+add1
+add2`;
      // file1: 1 del + 1 add = 2, file2: 1 del + 2 add = 3, total = 5
      expect(countChangedLines(diff)).toBe(5);
    });
  });
});
