import type { ArivConfig } from '../types.js';

const MAX_DIFF_LENGTH = 15000;

export function buildQuizPrompt(
  diff: string,
  config: ArivConfig,
): { system: string; user: string } {
  const system = `You are a code review quiz generator. Given a git diff, generate ${config.questionsPerQuiz} multiple-choice questions that test whether the developer truly understands the changes they made.

Rules:
- Questions must be specific to THIS diff, not general programming knowledge
- Test understanding of: what the code does, why it was changed, potential edge cases, and how it connects to the surrounding codebase
- Each question has 4 options (A-D) with exactly 1 correct answer
- Include a brief explanation for the correct answer
- Difficulty level: ${config.difficulty}
- Code language: ${config.language}`;

  let truncatedDiff = diff;
  let note = '';
  if (diff.length > MAX_DIFF_LENGTH) {
    truncatedDiff = diff.substring(0, MAX_DIFF_LENGTH);
    note = '\n\n[Note: diff was truncated due to length]';
  }

  const user = `Here is the git diff to quiz on:\n\n${truncatedDiff}${note}`;

  return { system, user };
}
