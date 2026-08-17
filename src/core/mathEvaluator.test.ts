import { describe, it, expect } from 'vitest';
import { evaluateMathExpression, isFormulaString } from './mathEvaluator';

describe('mathEvaluator', () => {
  describe('isFormulaString', () => {
    it('detects formula starting with =', () => {
      expect(isFormulaString('=10')).toBe(true);
      expect(isFormulaString('= 15 * 4')).toBe(true);
    });

    it('detects arithmetic expressions without =', () => {
      expect(isFormulaString('15 * 4')).toBe(true);
      expect(isFormulaString('10 + 2.5')).toBe(true);
      expect(isFormulaString('(10 + 5) / 2')).toBe(true);
    });

    it('returns false for plain numbers or text', () => {
      expect(isFormulaString('45')).toBe(false);
      expect(isFormulaString('120.50')).toBe(false);
      expect(isFormulaString('')).toBe(false);
    });
  });

  describe('evaluateMathExpression', () => {
    it('evaluates simple operations', () => {
      expect(evaluateMathExpression('10 + 5').value).toBe(15);
      expect(evaluateMathExpression('20 - 7').value).toBe(13);
      expect(evaluateMathExpression('6 * 8').value).toBe(48);
      expect(evaluateMathExpression('100 / 4').value).toBe(25);
    });

    it('respects operator precedence (PEMDAS)', () => {
      expect(evaluateMathExpression('10 + 2 * 3').value).toBe(16);
      expect(evaluateMathExpression('(10 + 2) * 3').value).toBe(36);
      expect(evaluateMathExpression('100 - 20 / 4 + 5 * 2').value).toBe(105);
    });

    it('handles commas as decimal separators gracefully', () => {
      expect(evaluateMathExpression('2,5 * 4').value).toBe(10);
      expect(evaluateMathExpression('10,5 + 4,25').value).toBe(14.75);
    });

    it('handles formula leading with =', () => {
      expect(evaluateMathExpression('= 15 * 4 + 10.5').value).toBe(70.5);
      expect(evaluateMathExpression('=(12 + 8) / 2').value).toBe(10);
    });

    it('handles exponentiation (^)', () => {
      expect(evaluateMathExpression('2 ^ 3').value).toBe(8);
      expect(evaluateMathExpression('3 ^ 2 + 1').value).toBe(10);
    });

    it('handles unary negative numbers', () => {
      expect(evaluateMathExpression('-5 + 15').value).toBe(10);
      expect(evaluateMathExpression('10 * -2').value).toBe(-20);
    });

    it('handles plain numbers without altering them', () => {
      expect(evaluateMathExpression('45').value).toBe(45);
      expect(evaluateMathExpression(78.5).value).toBe(78.5);
    });

    it('safely handles division by zero and invalid syntax', () => {
      expect(evaluateMathExpression('10 / 0').isValid).toBe(false);
      expect(evaluateMathExpression('10 / 0').value).toBeNull();
      expect(evaluateMathExpression('10 + * 2').isValid).toBe(false);
      expect(evaluateMathExpression('eval("hack")').isValid).toBe(false);
    });

    it('avoids floating point binary artifacts', () => {
      expect(evaluateMathExpression('0.1 + 0.2').value).toBe(0.3);
    });
  });
});
