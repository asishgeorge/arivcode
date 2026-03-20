import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createGitClient, countChangedLines, extractPathsFromDiff } from '../../src/core/git.js';
import type { ProcessRunner } from '../../src/types.js';

const sampleDiff = readFileSync(
  join(import.meta.dirname, '../fixtures/sample-diff.txt'),
  'utf-8',
);

function createMockRunner(responses: Record<string, string> = {}): ProcessRunner {
  return {
    exec: async (cmd: string) => {
      if (cmd in responses) return { stdout: responses[cmd], stderr: '' };
      // Default: return the sampleDiff for git diff --staged
      if (cmd === 'git diff --staged') return { stdout: sampleDiff, stderr: '' };
      if (cmd === 'git ls-files') return { stdout: 'src/index.ts\nsrc/utils.ts\npackage.json\n', stderr: '' };
      if (cmd.startsWith('git show :')) {
        const path = cmd.replace('git show :', '');
        return { stdout: `// contents of ${path}`, stderr: '' };
      }
      return { stdout: '', stderr: '' };
    },
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
      const runner = createMockRunner();
      const client = createGitClient(runner);
      const result = await client.getStagedDiff();
      expect(result.raw).toBe(sampleDiff);
    });

    it('counts lines changed (additions + deletions)', async () => {
      const runner = createMockRunner();
      const client = createGitClient(runner);
      const result = await client.getStagedDiff();
      expect(result.linesChanged).toBe(9);
    });

    it('returns linesChanged: 0 for empty diff', async () => {
      const runner = createMockRunner({ 'git diff --staged': '' });
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

  describe('getRepoTree', () => {
    it('returns file list from git ls-files', async () => {
      const runner = createMockRunner();
      const client = createGitClient(runner);
      const tree = await client.getRepoTree();
      expect(tree).toContain('src/index.ts');
      expect(tree).toContain('package.json');
    });
  });

  describe('getFileContents', () => {
    it('reads file contents via git show', async () => {
      const runner = createMockRunner();
      const client = createGitClient(runner);
      const contents = await client.getFileContents(['src/utils.ts']);
      expect(contents['src/utils.ts']).toContain('contents of src/utils.ts');
    });

    it('skips files that fail to read (e.g. deleted)', async () => {
      const runner: ProcessRunner = {
        exec: async (cmd: string) => {
          if (cmd.startsWith('git show :')) throw new Error('path not found');
          return { stdout: '', stderr: '' };
        },
      };
      const client = createGitClient(runner);
      const contents = await client.getFileContents(['deleted-file.ts']);
      expect(contents).toEqual({});
    });
  });

  describe('extractPathsFromDiff', () => {
    it('extracts file paths from diff headers', () => {
      const diff = `diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
+new line
diff --git a/src/bar.ts b/src/bar.ts
--- a/src/bar.ts
+++ b/src/bar.ts
+another line`;
      const paths = extractPathsFromDiff(diff);
      expect(paths).toContain('src/foo.ts');
      expect(paths).toContain('src/bar.ts');
      expect(paths).toHaveLength(2);
    });

    it('returns empty array for empty diff', () => {
      expect(extractPathsFromDiff('')).toEqual([]);
    });

    it('deduplicates paths', () => {
      const diff = `diff --git a/src/foo.ts b/src/foo.ts
+line1
diff --git a/src/foo.ts b/src/foo.ts
+line2`;
      const paths = extractPathsFromDiff(diff);
      expect(paths).toHaveLength(1);
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
      expect(countChangedLines(diff)).toBe(5);
    });
  });
});
