import { select, input, password } from '@inquirer/prompts';
import type { QuizPresenter, QuizQuestion } from '../types.js';

export function createInquirerPresenter(): QuizPresenter {
  return {
    async presentQuiz(questions: QuizQuestion[]): Promise<string[]> {
      const answers: string[] = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const answer = await select({
          message: `Q${i + 1}/${questions.length}: ${q.question}`,
          choices: [
            { name: `A) ${q.options.A}`, value: 'A' },
            { name: `B) ${q.options.B}`, value: 'B' },
            { name: `C) ${q.options.C}`, value: 'C' },
            { name: `D) ${q.options.D}`, value: 'D' },
          ],
        });

        const explanation = await input({
          message: 'Explain your reasoning (optional, press Enter to skip):',
        });

        if (explanation) {
          console.log(`  Your reasoning: ${explanation}`);
        }

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
