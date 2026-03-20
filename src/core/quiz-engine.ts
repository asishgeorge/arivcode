import type { QuizQuestion, QuizResult } from '../types.js';

export function scoreQuiz(
  questions: QuizQuestion[],
  answers: string[],
  passingScore: number,
): QuizResult {
  const details = questions.map((q, i) => ({
    question: q.question,
    userAnswer: answers[i] ?? '',
    correctAnswer: q.correct,
    isCorrect: answers[i] === q.correct,
    explanation: q.explanation,
  }));

  const correct = details.filter((d) => d.isCorrect).length;
  const total = questions.length;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    total,
    correct,
    percentage,
    passed: percentage >= passingScore,
    details,
  };
}

export function shouldSkipQuiz(linesChanged: number, minLines: number): boolean {
  return linesChanged < minLines;
}
