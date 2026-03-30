import type { DiffResult, GitClient, ProcessRunner, QuizMode } from '../types.js';

export function countChangedLines(diff: string): number {
  if (!diff) return 0;

  let count = 0;
  const lines = diff.split('\n');

  for (const line of lines) {
    // Skip file headers (--- a/file, +++ b/file)
    if (line.startsWith('--- ') || line.startsWith('+++ ')) continue;
    // Skip diff/index/hunk headers
    if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('@@ ')) continue;

    if (line.startsWith('+') || line.startsWith('-')) {
      count++;
    }
  }

  return count;
}

export function extractPathsFromDiff(diff: string): string[] {
  const paths = new Set<string>();
  const regex = /^diff --git a\/(.+?) b\/(.+?)$/gm;
  let match;
  while ((match = regex.exec(diff)) !== null) {
    paths.add(match[2]);
  }
  return [...paths];
}

export function createGitClient(runner: ProcessRunner, mode: QuizMode = 'commit'): GitClient {
  return {
    async getDiff(): Promise<DiffResult> {
      if (mode === 'push') {
        try {
          const { stdout } = await runner.exec('git diff @{upstream}..HEAD');
          return { raw: stdout, linesChanged: countChangedLines(stdout) };
        } catch {
          // No upstream set — fall back to origin/main
          const { stdout } = await runner.exec('git diff origin/main..HEAD');
          return { raw: stdout, linesChanged: countChangedLines(stdout) };
        }
      }

      const { stdout } = await runner.exec('git diff --staged');
      return { raw: stdout, linesChanged: countChangedLines(stdout) };
    },

    async getRepoTree(): Promise<string> {
      const { stdout } = await runner.exec('git ls-files');
      return stdout.trim();
    },

    async getFileContents(paths: string[]): Promise<Record<string, string>> {
      const prefix = mode === 'push' ? 'HEAD:' : ':';
      const contents: Record<string, string> = {};
      for (const path of paths) {
        try {
          const { stdout } = await runner.exec(`git show ${prefix}${path}`);
          contents[path] = stdout;
        } catch {
          // File may have been deleted in this diff — skip
        }
      }
      return contents;
    },
  };
}
