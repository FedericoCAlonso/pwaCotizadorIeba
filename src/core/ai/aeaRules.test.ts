import { describe, it, expect } from 'vitest';
import {
  REGLAS_CIRCUITOS_AEA,
  COORDINACION_CONDUCTOR_TERMICA,
  REGLAS_PUESTA_A_TIERRA,
  generateAeaRulesDigest
} from './aeaRules';

describe('aeaRules', () => {
  it('contiene definiciones correctas para circuitos IUG, TUG y TUE según AEA', () => {
    expect(REGLAS_CIRCUITOS_AEA.IUG.seccionMinimaFaseMm2).toBe(1.5);
    expect(REGLAS_CIRCUITOS_AEA.IUG.calibreTermicaMaxA).toBe(10);

    expect(REGLAS_CIRCUITOS_AEA.TUG.seccionMinimaFaseMm2).toBe(2.5);
    expect(REGLAS_CIRCUITOS_AEA.TUG.calibreTermicaMaxA).toBe(16);

    expect(REGLAS_CIRCUITOS_AEA.TUE.seccionMinimaFaseMm2).toBe(2.5);
    expect(REGLAS_CIRCUITOS_AEA.TUE.calibreTermicaMaxA).toBe(20);
  });

  it('verifica coordinación entre sección de conductor y calibre de termomagnética', () => {
    const coord15 = COORDINACION_CONDUCTOR_TERMICA.find(c => c.seccionMm2 === 1.5);
    expect(coord15?.termicaRecomendadaA).toBe(10);

    const coord25 = COORDINACION_CONDUCTOR_TERMICA.find(c => c.seccionMm2 === 2.5);
    expect(coord25?.termicaRecomendadaA).toBe(16);

    const coord40 = COORDINACION_CONDUCTOR_TERMICA.find(c => c.seccionMm2 === 4.0);
    expect(coord40?.termicaRecomendadaA).toBe(20);
  });

  it('define parámetros normativos de puesta a tierra', () => {
    expect(REGLAS_PUESTA_A_TIERRA.resistenciaMaximaOhm).toBe(40);
    expect(REGLAS_PUESTA_A_TIERRA.sensibilidadDiferencialMa).toBe(30);
    expect(REGLAS_PUESTA_A_TIERRA.normaJabalina).toContain('IRAM 2309');
  });

  it('genera un digest textual conciso para ser inyectado en el prompt de IA', () => {
    const digest = generateAeaRulesDigest();
    expect(digest).toContain('NORMAS AEA 90364');
    expect(digest).toContain('1.5 mm²');
    expect(digest).toContain('2.5 mm²');
    expect(digest).toContain('30mA');
    expect(digest.length).toBeGreaterThan(100);
    expect(digest.length).toBeLessThan(3000); // Conciso para no saturar tokens
  });
});
