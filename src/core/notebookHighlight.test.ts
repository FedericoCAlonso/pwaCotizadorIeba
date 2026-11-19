import { describe, it, expect } from 'vitest';
import { tokenizeNotebookLine } from './notebookHighlight';

describe('notebookHighlight', () => {
  it('mantiene la invariante exacta de texto (concatenación idéntica a la línea original)', () => {
    const muestras = [
      'largo = 12 m',
      'bocas = ceil(sup * 0.4) u',
      '# Instalaciones Eléctricas',
      '/tt recableado-completo  sup=largo*ancho  -puesta-a-tierra  +canaleta 10m',
      '  sup = largo * ancho',
      '  mat: Cable 2.5mm [Prysmian Superastic]',
      '    marca = Prysmian Superastic',
      '    cantidad = bocas * 2.5 m',
      '  // comentario interno',
      'supuesto: caneria = verificada',
      'nota: No mostrar al cliente',
    ];
    const vars = new Set(['largo', 'ancho', 'sup', 'bocas']);

    for (const line of muestras) {
      const spans = tokenizeNotebookLine(line, { variableNames: vars });
      expect(spans.map(s => s.text).join('')).toBe(line);
    }
  });

  it('clasifica definiciones de variables, referencias, funciones, números y unidades', () => {
    const spans = tokenizeNotebookLine('bocas = ceil(sup * 0.4) u', {
      variableNames: new Set(['sup', 'bocas']),
    });

    expect(spans.some(s => s.kind === 'variable_def' && s.text === 'bocas')).toBe(true);
    expect(spans.some(s => s.kind === 'function' && s.text === 'ceil')).toBe(true);
    expect(spans.some(s => s.kind === 'variable_ref' && s.text === 'sup')).toBe(true);
    expect(spans.some(s => s.kind === 'number' && s.text === '0.4')).toBe(true);
    expect(spans.some(s => s.kind === 'unit' && s.text === 'u')).toBe(true);
  });

  it('marca el rango exacto de error en la columna y longitud reportadas', () => {
    const line = '    cantidad = boca * 2 m';
    const spans = tokenizeNotebookLine(line, {
      variableNames: new Set(['bocas']),
      error: {
        linea: 3,
        columna: 16,
        longitud: 4,
        codigo: 'variable_no_definida',
        mensaje: "Variable no definida 'boca'.",
      },
    });

    expect(spans.map(s => s.text).join('')).toBe(line);
    const errSpans = spans.filter(s => s.isError);
    expect(errSpans.map(s => s.text).join('')).toBe('boca');
  });
});
