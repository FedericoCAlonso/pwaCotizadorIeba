import { describe, it, expect } from 'vitest';
import { evaluateMathExpression, isFormulaString, evaluateCondition } from './mathEvaluator';

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

    it('detects comparisons, ternary and logical expressions', () => {
      expect(isFormulaString('bocas > 10 ? 5 : 2')).toBe(true);
      expect(isFormulaString('a == 1')).toBe(true);
      expect(isFormulaString('calibre <= 25')).toBe(true);
      expect(isFormulaString('si(bocas > 10, 5, 2)')).toBe(true);
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

    it('respects operator precedence (PEMDAS / K&R)', () => {
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

    describe('Operador Ternario (? :) y Comparaciones Lógicas', () => {
      it('evalúa operador ternario simple', () => {
        expect(evaluateMathExpression('10 > 5 ? 100 : 200').value).toBe(100);
        expect(evaluateMathExpression('10 < 5 ? 100 : 200').value).toBe(200);
        expect(evaluateMathExpression('bocas > 10 ? bocas * 1.2 : bocas * 1.0', { bocas: 15 }).value).toBe(18);
        expect(evaluateMathExpression('bocas > 10 ? bocas * 1.2 : bocas * 1.0', { bocas: 8 }).value).toBe(8);
      });

      it('soporta ternarios anidados / escalonamiento con asociatividad por derecha', () => {
        const formula = 'bocas >= 20 ? 1.3 : (bocas >= 10 ? 1.15 : 1.0)';
        expect(evaluateMathExpression(formula, { bocas: 25 }).value).toBe(1.3);
        expect(evaluateMathExpression(formula, { bocas: 15 }).value).toBe(1.15);
        expect(evaluateMathExpression(formula, { bocas: 5 }).value).toBe(1.0);

        // Sin paréntesis explícitos (asociatividad por derecha estándar)
        const formulaPlana = 'tipo == 1 ? 10 : tipo == 2 ? 20 : 30';
        expect(evaluateMathExpression(formulaPlana, { tipo: 1 }).value).toBe(10);
        expect(evaluateMathExpression(formulaPlana, { tipo: 2 }).value).toBe(20);
        expect(evaluateMathExpression(formulaPlana, { tipo: 3 }).value).toBe(30);
      });

      it('soporta operadores relacionales (<, <=, >, >=)', () => {
        expect(evaluateMathExpression('5 <= 5').value).toBe(1);
        expect(evaluateMathExpression('6 <= 5').value).toBe(0);
        expect(evaluateMathExpression('5 >= 5').value).toBe(1);
        expect(evaluateMathExpression('4 >= 5').value).toBe(0);
        expect(evaluateMathExpression('10 > 3').value).toBe(1);
        expect(evaluateMathExpression('2 < 8').value).toBe(1);
      });

      it('soporta operadores de igualdad y desigualdad (==, !=, =, <>, ===, !==)', () => {
        expect(evaluateMathExpression('10 == 10').value).toBe(1);
        expect(evaluateMathExpression('10 == 12').value).toBe(0);
        expect(evaluateMathExpression('10 != 12').value).toBe(1);
        expect(evaluateMathExpression('10 != 10').value).toBe(0);

        // Compatibilidad estilo Excel
        expect(evaluateMathExpression('10 = 10').value).toBe(1);
        expect(evaluateMathExpression('10 <> 5').value).toBe(1);
        expect(evaluateMathExpression('10 <> 10').value).toBe(0);
        expect(evaluateMathExpression('10 === 10').value).toBe(1);
        expect(evaluateMathExpression('10 !== 5').value).toBe(1);
      });

      it('soporta operadores lógicos booleanos (&&, ||, !, and, or, not)', () => {
        expect(evaluateMathExpression('1 && 1').value).toBe(1);
        expect(evaluateMathExpression('1 && 0').value).toBe(0);
        expect(evaluateMathExpression('0 || 1').value).toBe(1);
        expect(evaluateMathExpression('0 || 0').value).toBe(0);
        expect(evaluateMathExpression('!0').value).toBe(1);
        expect(evaluateMathExpression('!1').value).toBe(0);

        // Palabras clave textuales
        expect(evaluateMathExpression('1 and 1').value).toBe(1);
        expect(evaluateMathExpression('0 or 1').value).toBe(1);
        expect(evaluateMathExpression('not 0').value).toBe(1);
        expect(evaluateMathExpression('not 1').value).toBe(0);
      });

      it('permite usar expresiones booleanas en operaciones aritméticas directas', () => {
        expect(evaluateMathExpression('10 + (altura > 3) * 5', { altura: 4 }).value).toBe(15);
        expect(evaluateMathExpression('10 + (altura > 3) * 5', { altura: 2 }).value).toBe(10);
      });

      it('evalúa con cortocircuito (short-circuit) evitando errores en la rama inactiva', () => {
        // En x == 0, la rama x > 0 es falsa, por lo que 100 / x no debe provocar fallo
        expect(evaluateMathExpression('x > 0 ? 100 / x : 0', { x: 0 }).value).toBe(0);
        expect(evaluateMathExpression('x > 0 ? 100 / x : 0', { x: 5 }).value).toBe(20);
      });

      it('soporta funciones condicionales estilo Excel: si(...) e if(...)', () => {
        expect(evaluateMathExpression('si(bocas > 10, bocas * 1.2, bocas * 1.0)', { bocas: 15 }).value).toBe(18);
        expect(evaluateMathExpression('si(bocas > 10, bocas * 1.2, bocas * 1.0)', { bocas: 8 }).value).toBe(8);
        expect(evaluateMathExpression('if(potencia >= 5000, 6, 4)', { potencia: 6000 }).value).toBe(6);
        expect(evaluateMathExpression('if(potencia >= 5000, 6, 4)', { potencia: 3000 }).value).toBe(4);
      });

      it('soporta booleanos en scope', () => {
        expect(evaluateMathExpression('es_trifasica ? 380 : 220', { es_trifasica: true }).value).toBe(380);
        expect(evaluateMathExpression('es_trifasica ? 380 : 220', { es_trifasica: false }).value).toBe(220);
      });
    });
  });

  describe('evaluateCondition', () => {
    it('evalúa correctamente condiciones simples y compuestas', () => {
      expect(evaluateCondition('', {})).toBe(true);
      expect(evaluateCondition(undefined, {})).toBe(true);
      expect(evaluateCondition('calibre_principal <= 25', { calibre_principal: 25 })).toBe(true);
      expect(evaluateCondition('calibre_principal <= 25', { calibre_principal: 32 })).toBe(false);
      expect(evaluateCondition('calibre_principal > 25 && calibre_principal <= 40', { calibre_principal: 32 })).toBe(true);
      expect(evaluateCondition('calibre_principal > 25 && calibre_principal <= 40', { calibre_principal: 50 })).toBe(false);
      expect(evaluateCondition('requiere_certificacion == 1', { requiere_certificacion: 0 })).toBe(false);
      expect(evaluateCondition('requiere_certificacion == 1', { requiere_certificacion: 1 })).toBe(true);
      expect(evaluateCondition('requiere_certificacion', { requiere_certificacion: 1 })).toBe(true);
      expect(evaluateCondition('requiere_certificacion', { requiere_certificacion: 0 })).toBe(false);
      expect(evaluateCondition('true')).toBe(true);
      expect(evaluateCondition('false')).toBe(false);
    });
  });
});

