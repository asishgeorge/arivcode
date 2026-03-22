import type { ArivConfig, FocusArea, QuizContext } from '../types.js';

const MAX_TOTAL_LENGTH = 50000;

// === Language Detection ===

const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript (React)',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript (React)',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.swift': 'Swift',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.c': 'C',
  '.cpp': 'C++',
  '.h': 'C/C++',
  '.cs': 'C#',
  '.scala': 'Scala',
  '.dart': 'Dart',
  '.lua': 'Lua',
  '.r': 'R',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.zsh': 'Shell',
  '.sql': 'SQL',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.xml': 'XML',
  '.md': 'Markdown',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.erl': 'Erlang',
  '.zig': 'Zig',
};

export function extractLanguagesFromDiff(diff: string): string[] {
  const seen = new Set<string>();
  const regex = /^diff --git a\/(.+?) b\//gm;
  let match;
  while ((match = regex.exec(diff)) !== null) {
    const filePath = match[1];
    const dotIdx = filePath.lastIndexOf('.');
    if (dotIdx !== -1) {
      const ext = filePath.substring(dotIdx).toLowerCase();
      const lang = EXTENSION_MAP[ext];
      if (lang) seen.add(lang);
      else seen.add(ext);
    }
  }
  return [...seen];
}

// === Difficulty Guidance ===

const DIFFICULTY_GUIDANCE: Record<string, string> = {
  beginner: `Difficulty: Beginner
- Ask "What does this code do?" style questions
- Test recognition and basic comprehension of the changes
- Wrong answers should be clearly incorrect — easy to eliminate if the developer read the diff
- Focus on surface-level understanding: what was added, removed, or renamed`,

  intermediate: `Difficulty: Intermediate
- Ask "Why was this approach chosen?" style questions
- Test understanding of intent and design reasoning behind the changes
- Distractors should be plausible alternatives but distinguishable with genuine understanding
- Include questions about how the changes interact with surrounding code`,

  advanced: `Difficulty: Advanced
- Ask "What edge case does this miss?" and "What would break if..." style questions
- Test deep understanding of implications, failure modes, and correctness
- Distractors should be subtle and require careful reasoning to eliminate
- Include questions about concurrency issues, boundary conditions, and implicit assumptions`,
};

// === Focus Area Instructions ===

const FOCUS_DESCRIPTIONS: Record<FocusArea, string> = {
  syntax:
    'Syntax & API: specific syntax, language constructs, API signatures, and method calls used in the diff',
  execution:
    'Execution & Flow: how the code executes, control flow paths, state changes, and runtime behavior',
  architecture:
    'Architecture & Design: patterns, design decisions, trade-offs, and structural choices',
  'edge-cases':
    'Edge Cases & Errors: boundary conditions, error handling paths, failure modes, and defensive coding',
};

function buildFocusAreaInstructions(focusAreas: FocusArea[], questionCount: number): string {
  const perArea = Math.floor(questionCount / focusAreas.length);
  const remainder = questionCount % focusAreas.length;

  let instructions = `\nQuestion distribution across focus areas (${questionCount} total):\n`;
  focusAreas.forEach((area, i) => {
    const count = perArea + (i < remainder ? 1 : 0);
    instructions += `- ${FOCUS_DESCRIPTIONS[area]}: ~${count} questions\n`;
  });
  return instructions;
}

// === Truncation Helpers ===

function truncateFileContents(
  contents: Record<string, string>,
  remaining: number,
): { parts: string[]; consumed: number } {
  const entries = Object.entries(contents).sort((a, b) => a[1].length - b[1].length);
  const parts: string[] = [];
  let used = 0;

  for (const [path, content] of entries) {
    const part = `### ${path}\n\`\`\`\n${content}\n\`\`\``;
    if (part.length <= remaining - used) {
      parts.push(part);
      used += part.length;
    } else if (remaining - used > 200) {
      const truncated = content.substring(0, remaining - used - 200);
      parts.push(`### ${path}\n\`\`\`\n${truncated}\n[truncated]\n\`\`\``);
      used = remaining;
      break;
    }
  }

  return { parts, consumed: used };
}

function truncateRepoTree(tree: string, remaining: number): string {
  if (tree.length <= remaining - 50) return tree;

  const lines = tree.split('\n');
  const truncatedLines: string[] = [];
  let len = 0;
  for (const line of lines) {
    if (len + line.length + 1 > remaining - 80) break;
    truncatedLines.push(line);
    len += line.length + 1;
  }
  return truncatedLines.join('\n') + '\n[truncated]';
}

// === User Prompt Assembly ===

function buildUserPrompt(context: QuizContext): string {
  const sections: string[] = [];
  let remaining = MAX_TOTAL_LENGTH;

  const diffSection = `## Git Diff\n\n${context.diff}`;
  sections.push(diffSection);
  remaining -= diffSection.length;

  if (Object.keys(context.touchedFileContents).length > 0) {
    const { parts, consumed } = truncateFileContents(context.touchedFileContents, remaining);
    remaining -= consumed;
    if (parts.length > 0) {
      sections.push(`## Full File Contents\n\n${parts.join('\n\n')}`);
    }
  }

  if (context.repoTree && remaining > 100) {
    const tree = truncateRepoTree(context.repoTree, remaining);
    sections.push(`## Repository Structure\n\n${tree}`);
  }

  return sections.join('\n\n');
}

// === Main Builder ===

export function buildQuizPrompt(
  context: QuizContext,
  config: ArivConfig,
): { system: string; user: string } {
  const languages = extractLanguagesFromDiff(context.diff);
  const langLine = languages.length > 0 ? `Languages in this diff: ${languages.join(', ')}` : '';

  const difficulty = DIFFICULTY_GUIDANCE[config.difficulty] ?? DIFFICULTY_GUIDANCE.intermediate;
  const focusInstructions = buildFocusAreaInstructions(config.focusAreas, context.questionCount);

  const system = `You are a code review quiz generator. Given a git diff along with repository context, generate up to ${context.questionCount} multiple-choice questions that test whether the developer truly understands the changes they made.

Rules:
- Questions must be specific to THIS diff, not general programming knowledge
- Each question has 4 options (A-D) with exactly 1 correct answer
- Include a brief explanation for the correct answer
- Use the repository structure and full file contents to understand how the changes fit into the broader codebase
- Never repeat or rephrase the same question — each question must test a distinct concept
- If the diff does not contain enough meaningful changes to justify ${context.questionCount} unique questions, generate fewer. Quality over quantity.
${langLine ? `- ${langLine}` : ''}

${difficulty}
${focusInstructions}`;

  const user = buildUserPrompt(context);

  return { system, user };
}
