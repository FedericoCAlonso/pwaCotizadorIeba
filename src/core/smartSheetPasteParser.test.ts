import { describe, it, expect } from 'vitest';
import { parsePastedLines } from './smartSheetPasteParser';
import { MaterialCatalogSuggestion } from './materialSuggestions';

describe('smartSheetPasteParser', () => {
  const mockSuggestions: MaterialCatalogSuggestion[] = [
    {
      id: 'mat-1',
      nombre: 'Cable unipolar 2.5 mm²',
      unidad: 'm',
      precioVigente: 1250,
      marcaModelo: 'Prysmian'
    },
    {
      id: 'mat-2',
      nombre: 'Caja octogonal chica',
      unidad: 'u',
      precioVigente: 420,
      marcaModelo: 'sin definir'
    }
  ];

  it('retorna array vacío ante texto vacío o solo espacios', () => {
    expect(parsePastedLines('')).toEqual([]);
    expect(parsePastedLines('   \n\n  ')).toEqual([]);
  });

  it('parsea texto simple con un renglón por línea (1 columna) y aplica sugerencias de catálogo', () => {
    const raw = `Cable unipolar 2.5 mm²
Caja octogonal chica
Cinta aisladora 20m`;

    const parsed = parsePastedLines(raw, mockSuggestions);
    expect(parsed).toHaveLength(3);

    // Línea 1: coincidencia con catálogo
    expect(parsed[0].funcion).toBe('Cable unipolar 2.5 mm²');
    expect(parsed[0].unidad).toBe('m');
    expect(parsed[0].precioUnitario).toBe(1250);
    expect(parsed[0].marcaModelo).toBe('Prysmian');
    expect(parsed[0].cantidad).toBe(1);
    expect(parsed[0].catalogMatch).toBe(true);

    // Línea 2: coincidencia sin marca -> 'sin definir'
    expect(parsed[1].funcion).toBe('Caja octogonal chica');
    expect(parsed[1].unidad).toBe('u');
    expect(parsed[1].precioUnitario).toBe(420);
    expect(parsed[1].marcaModelo).toBe('sin definir');

    // Línea 3: sin coincidencia en catálogo -> defaults y 'sin definir'
    expect(parsed[2].funcion).toBe('Cinta aisladora 20m');
    expect(parsed[2].unidad).toBe('u');
    expect(parsed[2].precioUnitario).toBe(0);
    expect(parsed[2].marcaModelo).toBe('sin definir');
  });

  it('parsea texto copiado desde Excel con 4 columnas separadas por tabulador (TSV)', () => {
    const raw = `Cable unipolar 2.5 mm²\tPrysmian\t100\t1300
Disyuntor bipolar 25A\tSchneider\t2\t18500`;

    const parsed = parsePastedLines(raw, mockSuggestions);
    expect(parsed).toHaveLength(2);

    expect(parsed[0].funcion).toBe('Cable unipolar 2.5 mm²');
    expect(parsed[0].marcaModelo).toBe('Prysmian');
    expect(parsed[0].cantidad).toBe(100);
    expect(parsed[0].precioUnitario).toBe(1300);

    expect(parsed[1].funcion).toBe('Disyuntor bipolar 25A');
    expect(parsed[1].marcaModelo).toBe('Schneider');
    expect(parsed[1].cantidad).toBe(2);
    expect(parsed[1].precioUnitario).toBe(18500);
  });

  it('parsea 3 columnas cuando la segunda es cantidad [Función, Cantidad, Precio]', () => {
    const raw = `Térmica 2x16A\t4\t9200`;
    const parsed = parsePastedLines(raw);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].funcion).toBe('Térmica 2x16A');
    expect(parsed[0].marcaModelo).toBe('sin definir');
    expect(parsed[0].cantidad).toBe(4);
    expect(parsed[0].precioUnitario).toBe(9200);
  });

  it('parsea fórmulas matemáticas en cantidad', () => {
    const raw = `Cable unipolar 2.5 mm²\t=bocas * 12\t1500`;
    const parsed = parsePastedLines(raw);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].formula).toBe('=bocas * 12');
    expect(parsed[0].cantidad).toBe(1);
  });

  it('detecta prefijo de tipo explícito como "mo" o "serv"', () => {
    const raw = `mo\tOficial Electricista\t8\t5000
serv\tAlquiler de andamio\t1\t25000`;

    const parsed = parsePastedLines(raw);
    expect(parsed).toHaveLength(2);

    expect(parsed[0].tipo).toBe('mano_obra');
    expect(parsed[0].funcion).toBe('Oficial Electricista');
    expect(parsed[0].cantidad).toBe(8);
    expect(parsed[0].precioUnitario).toBe(5000);
    expect(parsed[0].unidad).toBe('hs');

    expect(parsed[1].tipo).toBe('servicio');
    expect(parsed[1].funcion).toBe('Alquiler de andamio');
    expect(parsed[1].precioUnitario).toBe(25000);
    expect(parsed[1].unidad).toBe('gl');
  });
});
