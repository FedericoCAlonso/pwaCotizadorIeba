import { describe, it, expect } from 'vitest';
import {
  convertUnitValue,
  evaluateUnitExpression,
  extractUnitExpressionDependencies,
} from './unitAlgebra';

describe('unitAlgebra (Fase 2.5 - Unidades Pragmáticas)', () => {
  it('convierte automáticamente sumas y restas dentro de la misma familia (cm/m, min/h)', () => {
    const rLen = evaluateUnitExpression('10 m + 80 cm');
    expect(rLen.isValid).toBe(true);
    expect(rLen.value).toBeCloseTo(10.8, 5);
    expect(rLen.unit).toBe('m');
    expect(rLen.warning).toBeUndefined();

    const rTime = evaluateUnitExpression('2 h + 45 min');
    expect(rTime.isValid).toBe(true);
    expect(rTime.value).toBeCloseTo(2.75, 5);
    expect(rTime.unit).toBe('h');

    const rSub = evaluateUnitExpression('3 m - 50 cm');
    expect(rSub.value).toBeCloseTo(2.5, 5);
    expect(rSub.unit).toBe('m');
  });

  it('resuelve geometría básica: m * m -> m², m² / m -> m, m / m -> adimensional, sqrt(m²) -> m', () => {
    const scope = {
      largo: { value: 12, unit: 'm' },
      ancho: { value: 5, unit: 'm' },
      tramo_cm: { value: 50, unit: 'cm' },
    };

    const area = evaluateUnitExpression('largo * ancho', scope);
    expect(area.isValid).toBe(true);
    expect(area.value).toBe(60);
    expect(area.unit).toBe('m²');

    const areaMix = evaluateUnitExpression('largo * tramo_cm', scope);
    expect(areaMix.value).toBe(6);
    expect(areaMix.unit).toBe('m²');

    const backLen = evaluateUnitExpression('60 m2 / 5 m');
    expect(backLen.value).toBe(12);
    expect(backLen.unit).toBe('m');

    const ratio = evaluateUnitExpression('150 cm / 1 m');
    expect(ratio.value).toBe(1.5);
    expect(ratio.unit).toBeUndefined();

    const root = evaluateUnitExpression('sqrt(64 m²)');
    expect(root.value).toBe(8);
    expect(root.unit).toBe('m');
  });

  it('conserva la unidad al operar con escalares y soporta funciones y comparaciones con conversión', () => {
    const scope = {
      tramo: { value: 10, unit: 'm' },
      bocas: { value: 12, unit: 'u' },
    };

    expect(evaluateUnitExpression('tramo * 1.15', scope)).toMatchObject({
      isValid: true,
      value: 11.5,
      unit: 'm',
    });

    expect(evaluateUnitExpression('bocas + 2', scope)).toMatchObject({
      isValid: true,
      value: 14,
      unit: 'u',
    });

    expect(evaluateUnitExpression('ceil(tramo * 1.15)', scope)).toMatchObject({
      isValid: true,
      value: 12,
      unit: 'm',
    });

    expect(evaluateUnitExpression('min(10 m, 800 cm)')).toMatchObject({
      isValid: true,
      value: 8,
      unit: 'm',
    });

    // Comparación convirtiendo 150 cm -> 1.5 m > 1 m => verdadero (1)
    expect(evaluateUnitExpression('150 cm > 1 m ? 100 : 50')).toMatchObject({
      isValid: true,
      value: 100,
    });
  });

  it('emite advertencia suave (no bloqueante) al sumar unidades incompatibles', () => {
    const res = evaluateUnitExpression('10 m + 3 hs');
    expect(res.isValid).toBe(true);
    expect(res.value).toBe(13);
    expect(res.unit).toBe('m');
    expect(res.warning).toContain('incompatibles');
  });

  it('convierte unidades compatibles con nota y avisa si son incompatibles en convertUnitValue', () => {
    const ok = convertUnitValue(150, 'cm', 'm');
    expect(ok.converted).toBe(true);
    expect(ok.value).toBe(1.5);
    expect(ok.note).toBe('← 150 cm');

    const bad = convertUnitValue(2, 'h', 'm');
    expect(bad.converted).toBe(false);
    expect(bad.incompatible).toBe(true);
    expect(bad.warning).toContain("'h'");
  });

  it('extrae dependencias reales ignorando unidades inline tras literales numéricos', () => {
    expect(extractUnitExpressionDependencies('10 m + 80 cm')).toEqual([]);
    expect(extractUnitExpressionDependencies('largo + 50 cm')).toEqual(['largo']);
    expect(extractUnitExpressionDependencies('bocas + m')).toEqual(['bocas', 'm']);
    expect(extractUnitExpressionDependencies('ceil(sup * 0.4)')).toEqual(['sup']);
  });
});
