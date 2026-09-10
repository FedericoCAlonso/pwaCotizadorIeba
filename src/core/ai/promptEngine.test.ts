import { describe, it, expect } from 'vitest';
import {
  generateSystemPrompt,
  findRelevantInsumos,
  buildUserPrompt
} from './promptEngine';
import { Insumo, CategoriaManoDeObra } from '../types';

describe('promptEngine', () => {
  const mockInsumosMap = new Map<string, Insumo>([
    [
      'c-25',
      {
        id: 'c-25',
        categoriaId: 'cables',
        nombre: 'Cable Unipolar 2.5mm² Celeste Prysmian',
        unidadVenta: 'm',
        atributos: [],
        activo: true,
        precioActual: 1200,
        marca: 'Prysmian',
      },
    ],
    [
      'term-16',
      {
        id: 'term-16',
        categoriaId: 'termicas',
        nombre: 'Termomagnética Bipolar 16A Curva C Schneider',
        unidadVenta: 'u',
        atributos: [],
        activo: true,
        precioActual: 18500,
        marca: 'Schneider',
      },
    ],
    [
      'jabalina',
      {
        id: 'jabalina',
        categoriaId: 'pat',
        nombre: 'Jabalina Acero Cobre 1/2" x 1.5m con Tomacable',
        unidadVenta: 'u',
        atributos: [],
        activo: true,
        precioActual: 24000,
        marca: 'Facompa',
      },
    ],
  ]);

  const mockManoObraMap = new Map<string, CategoriaManoDeObra>([
    [
      'mo_oficial',
      { id: 'mo_oficial', nombre: 'Oficial Electricista', costoHora: 9000, fechaActualizacion: '2026-09-10' },
    ],
    [
      'mo_ayudante',
      { id: 'mo_ayudante', nombre: 'Ayudante', costoHora: 6000, fechaActualizacion: '2026-09-10' },
    ],
  ]);

  it('genera un System Prompt que contiene estructura de costos, normas AEA y formato YAML', () => {
    const sysPrompt = generateSystemPrompt();

    expect(sysPrompt).toContain('Cotizador IEBA');
    expect(sysPrompt).toContain('Costo Directo (CD)');
    expect(sysPrompt).toContain('NORMAS AEA 90364');
    expect(sysPrompt).toContain('FORMATO DE SALIDA (YAML ESTRICTO)');
    expect(sysPrompt).toContain('parametros:');
    expect(sysPrompt).toContain('calculos:');
    expect(sysPrompt).toContain('materiales:');
    expect(sysPrompt).toContain('mano_obra:');
    expect(sysPrompt).toContain('clausulas:');
  });

  it('filtra insumos relevantes según palabras clave del usuario', () => {
    const termicaMatches = findRelevantInsumos('necesito una termica de 16a', mockInsumosMap);
    expect(termicaMatches).toHaveLength(1);
    expect(termicaMatches[0].id).toBe('term-16');

    const jabalinaMatches = findRelevantInsumos('puesta a tierra jabalina', mockInsumosMap);
    expect(jabalinaMatches).toHaveLength(1);
    expect(jabalinaMatches[0].id).toBe('jabalina');
  });

  it('ensambla el prompt del usuario inyectando el catálogo local relevante', () => {
    const userPrompt = buildUserPrompt({
      userPrompt: 'Instalación de jabalina para protocolo SRT',
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap,
    });

    expect(userPrompt).toContain('Instalación de jabalina para protocolo SRT');
    expect(userPrompt).toContain('CATÁLOGO LOCAL DISPONIBLE DEL USUARIO');
    expect(userPrompt).toContain('Jabalina Acero Cobre');
    expect(userPrompt).toContain('Oficial Electricista');
    expect(userPrompt).toContain('Ayudante');
  });
});
