import type { DiffResult, GitClient, ProcessRunner } from '../types.js';

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

export function createGitClient(runner: ProcessRunner): GitClient {
  return {
    async getStagedDiff(): Promise<DiffResult> {
      const { stdout } = await runner.exec('git diff --staged');
      return {
        raw: stdout,
        linesChanged: countChangedLines(stdout),
      };
    },
  };
}
