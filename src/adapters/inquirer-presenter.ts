import { select, password, checkbox, input } from '@inquirer/prompts';
import chalk from 'chalk';
import type { QuizPresenter, QuizQuestion } from '../types.js';

function stripBackticks(text: string): string {
  return text.replaceAll('`', '');
}

export function getBoxWidth(): number {
  const termWidth = process.stdout.columns || 80;
  return Math.max(40, Math.min(80, termWidth - 4));
}

export function wrapText(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function box(lines: string[], width = 52): string {
  const top = `┌${'─'.repeat(width - 2)}┐`;
  const bottom = `└${'─'.repeat(width - 2)}┘`;
  const padded = lines.map((line) => {
    // eslint-disable-next-line no-control-regex
    const stripped = line.replaceAll(/\u001b\[[0-9;]*m/g, '');
    const padding = Math.max(0, width - 4 - stripped.length);
    return `│  ${line}${' '.repeat(padding)}│`;
  });
  return [top, ...padded, bottom].join('\n');
}

function renderPreviousAnswers(
  questions: QuizQuestion[],
  answers: string[],
  results: boolean[],
): string {
  const lines = results.map((correct, i) => {
    const label = `Q${i + 1}`;
    const letter = answers[i];
    if (correct) {
      return `  ${chalk.green('✔')} ${label}: ${chalk.green(letter)} Correct`;
    }
    const correctAnswer = chalk.dim('(answer: ' + questions[i].correct + ')');
    return `  ${chalk.red('✗')} ${label}: ${chalk.red(letter)} Incorrect ${correctAnswer}`;
  });
  return lines.join('\n');
}

export function createInquirerPresenter(): QuizPresenter {
  return {
    async presentQuiz(questions: QuizQuestion[]): Promise<string[]> {
      const answers: string[] = [];
      const results: boolean[] = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];

        // Show previous answers recap (starting from Q2)
        if (i > 0) {
          console.log();
          console.log(chalk.bold('  Previous Answers'));
          console.log(renderPreviousAnswers(questions, answers, results));
          console.log();
        }

        // Question box
        const questionText = stripBackticks(q.question);
        const width = getBoxWidth();
        const innerWidth = width - 4;
        const wrappedQuestion = wrapText(questionText, innerWidth);
        console.log(
          box(
            [chalk.bold.cyan(`Question ${i + 1} of ${questions.length}`), '', ...wrappedQuestion],
            width,
          ),
        );
        console.log();

        const answer = await select({
          message: 'Select your answer:',
          choices: [
            { name: `A) ${stripBackticks(q.options.A)}`, value: 'A' },
            { name: `B) ${stripBackticks(q.options.B)}`, value: 'B' },
            { name: `C) ${stripBackticks(q.options.C)}`, value: 'C' },
            { name: `D) ${stripBackticks(q.options.D)}`, value: 'D' },
          ],
        });

        results.push(answer === q.correct);
        answers.push(answer);
      }

      return answers;
    },
  };
}

export interface Prompter {
  prompt(questions: any[]): Promise<Record<string, any>>;
}

export function createInquirerPrompter(): Prompter {
  return {
    async prompt(questions: any[]): Promise<Record<string, any>> {
      const results: Record<string, any> = {};
      for (const q of questions) {
        if (q.type === 'list' || q.type === 'select') {
          results[q.name] = await select({
            message: q.message,
            choices: q.choices,
            default: q.default,
          });
        } else if (q.type === 'checkbox') {
          results[q.name] = await checkbox({
            message: q.message,
            choices: q.choices,
          });
        } else if (q.type === 'password') {
          results[q.name] = await password({
            message: q.message,
            mask: q.mask,
          });
        } else {
          results[q.name] = await input({
            message: q.message,
            default: q.default,
          });
        }
      }
      return results;
    },
  };
}
