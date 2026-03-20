import { describe, it, expect } from 'vitest';
import { scoreQuiz, shouldSkipQuiz, getQuestionCount } from '../../src/core/quiz-engine.js';
import type { QuizQuestion } from '../../src/types.js';

const questions: QuizQuestion[] = [
  {
    question: 'What does function X do?',
    options: { A: 'Adds', B: 'Subtracts', C: 'Multiplies', D: 'Divides' },
    correct: 'A',
    explanation: 'It adds two numbers.',
  },
  {
    question: 'Why was Y changed?',
    options: { A: 'Performance', B: 'Bug fix', C: 'Refactor', D: 'New feature' },
    correct: 'B',
    explanation: 'It was a bug fix.',
  },
  {
    question: 'What edge case exists?',
    options: { A: 'Null input', B: 'Empty array', C: 'Negative', D: 'Overflow' },
    correct: 'C',
    explanation: 'Negative values are not handled.',
  },
  {
    question: 'What import was added?',
    options: { A: 'lodash', B: 'helper', C: 'utils', D: 'config' },
    correct: 'B',
    explanation: 'The helper module was imported.',
  },
];

describe('quiz-engine', () => {
  describe('scoreQuiz', () => {
    it('returns 100% when all answers correct', () => {
      const result = scoreQuiz(questions, ['A', 'B', 'C', 'B'], 80);
      expect(result.percentage).toBe(100);
      expect(result.correct).toBe(4);
      expect(result.total).toBe(4);
      expect(result.passed).toBe(true);
    });

    it('returns 0% when all answers wrong', () => {
      const result = scoreQuiz(questions, ['D', 'D', 'D', 'D'], 80);
      expect(result.percentage).toBe(0);
      expect(result.correct).toBe(0);
      expect(result.passed).toBe(false);
    });

    it('returns 75% for 3/4 correct', () => {
      const result = scoreQuiz(questions, ['A', 'B', 'C', 'D'], 80);
      expect(result.percentage).toBe(75);
      expect(result.correct).toBe(3);
    });

    it('marks passed=true when percentage >= passingScore', () => {
      const result = scoreQuiz(questions, ['A', 'B', 'C', 'B'], 100);
      expect(result.passed).toBe(true);
    });

    it('marks passed=false when percentage < passingScore', () => {
      const result = scoreQuiz(questions, ['A', 'B', 'C', 'D'], 80);
      expect(result.passed).toBe(false);
    });

    it('includes per-question detail with explanation', () => {
      const result = scoreQuiz(questions, ['A', 'D', 'C', 'B'], 80);
      expect(result.details).toHaveLength(4);
      expect(result.details[0].isCorrect).toBe(true);
      expect(result.details[1].isCorrect).toBe(false);
      expect(result.details[1].explanation).toBe('It was a bug fix.');
      expect(result.details[1].userAnswer).toBe('D');
      expect(result.details[1].correctAnswer).toBe('B');
    });
  });

  describe('shouldSkipQuiz', () => {
    it('returns true when linesChanged < minLines', () => {
      expect(shouldSkipQuiz(5, 10)).toBe(true);
    });

    it('returns false when linesChanged >= minLines', () => {
      expect(shouldSkipQuiz(15, 10)).toBe(false);
    });

    it('returns false when linesChanged equals minLines exactly', () => {
      expect(shouldSkipQuiz(10, 10)).toBe(false);
    });
  });

  describe('getQuestionCount', () => {
    it('returns 8 for 10-100 lines', () => {
      expect(getQuestionCount(10)).toBe(8);
      expect(getQuestionCount(50)).toBe(8);
      expect(getQuestionCount(100)).toBe(8);
    });

    it('returns 12 for 101-250 lines', () => {
      expect(getQuestionCount(101)).toBe(12);
      expect(getQuestionCount(150)).toBe(12);
      expect(getQuestionCount(250)).toBe(12);
    });

    it('returns 16 for 251-500 lines', () => {
      expect(getQuestionCount(251)).toBe(16);
      expect(getQuestionCount(400)).toBe(16);
      expect(getQuestionCount(500)).toBe(16);
    });

    it('returns 20 for 500+ lines', () => {
      expect(getQuestionCount(501)).toBe(20);
      expect(getQuestionCount(1000)).toBe(20);
    });

    it('returns 8 as fallback for values below brackets', () => {
      expect(getQuestionCount(5)).toBe(8);
    });
  });
});
