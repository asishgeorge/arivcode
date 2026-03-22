import { describe, it, expect } from 'vitest';
import { wrapText, getBoxWidth } from '../../src/adapters/inquirer-presenter.js';

describe('wrapText', () => {
  it('returns single-element array for short text', () => {
    expect(wrapText('hello world', 20)).toEqual(['hello world']);
  });

  it('wraps long text at word boundaries', () => {
    const text = 'What is the purpose of the some method used with p.keywords in handleQuizError';
    const result = wrapText(text, 48);
    for (const line of result) {
      expect(line.length).toBeLessThanOrEqual(48);
    }
    expect(result.join(' ')).toBe(text);
  });

  it('keeps a single long word unbroken on its own line', () => {
    const text = 'short superlongwordthatexceedsmaxwidth end';
    const result = wrapText(text, 15);
    expect(result).toEqual(['short', 'superlongwordthatexceedsmaxwidth', 'end']);
  });

  it('returns single-element array for empty string', () => {
    expect(wrapText('', 20)).toEqual(['']);
  });

  it('handles text exactly at max width', () => {
    const text = 'exact fit here';
    expect(wrapText(text, text.length)).toEqual([text]);
  });
});

describe('getBoxWidth', () => {
  it('returns value between 40 and 80', () => {
    const width = getBoxWidth();
    expect(width).toBeGreaterThanOrEqual(40);
    expect(width).toBeLessThanOrEqual(80);
  });

  it('clamps narrow terminals to minimum 40', () => {
    const original = process.stdout.columns;
    Object.defineProperty(process.stdout, 'columns', { value: 30, configurable: true });
    expect(getBoxWidth()).toBe(40);
    Object.defineProperty(process.stdout, 'columns', { value: original, configurable: true });
  });

  it('clamps wide terminals to maximum 80', () => {
    const original = process.stdout.columns;
    Object.defineProperty(process.stdout, 'columns', { value: 200, configurable: true });
    expect(getBoxWidth()).toBe(80);
    Object.defineProperty(process.stdout, 'columns', { value: original, configurable: true });
  });
});
