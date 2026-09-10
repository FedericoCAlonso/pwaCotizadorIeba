import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cleanAiYamlResponse,
  generateHeuristicTareaTipo,
  generateTareaTipoWithAI,
  checkOllamaAvailability
} from './aiAssistantService';
import { Insumo, CategoriaManoDeObra } from '../types';

describe('aiAssistantService', () => {
  const mockInsumosMap = new Map<string, Insumo>([
    [
      'c-25',
      {
        id: 'c-25',
        categoriaId: 'cables',
        nombre: 'Cable 2.5mm² Normalizado',
        unidadVenta: 'm',
        atributos: [],
        activo: true,
        precioActual: 1200,
      },
    ],
    [
      'jabalina',
      {
        id: 'jabalina',
        categoriaId: 'pat',
        nombre: 'Jabalina Cobre 1/2" 1.5m',
        unidadVenta: 'u',
        atributos: [],
        activo: true,
        precioActual: 25000,
      },
    ],
    [
      'boca-luz',
      {
        id: 'boca-luz',
        categoriaId: 'iluminacion',
        nombre: 'Portalámparas y Boca de Iluminación',
        unidadVenta: 'boca',
        atributos: [],
        activo: true,
        precioActual: 3500,
      },
    ],
  ]);

  const mockManoObraMap = new Map<string, CategoriaManoDeObra>([
    [
      'mo_oficial',
      { id: 'mo_oficial', nombre: 'Oficial Electricista', costoHora: 9000, fechaActualizacion: '2026-09-10' },
    ],
  ]);

  it('limpia bloques de markdown generados por LLMs', () => {
    const raw = '```yaml\nnombre: Tarea de Prueba\ncategoria: General\n```';
    expect(cleanAiYamlResponse(raw)).toBe('nombre: Tarea de Prueba\ncategoria: General');
  });

  it('genera plantilla heurística de aire acondicionado con circuito TUE según AEA', () => {
    const yaml = generateHeuristicTareaTipo(
      'Instalación eléctrica de aire acondicionado split',
      mockInsumosMap,
      mockManoObraMap
    );

    expect(yaml).toContain('Fuerza Motriz');
    expect(yaml).toContain('TUE');
    expect(yaml).toContain('AEA 90364-7-770');
    expect(yaml).toContain('Oficial Electricista');
  });

  it('genera plantilla heurística de puesta a tierra con norma IRAM 2309', () => {
    const yaml = generateHeuristicTareaTipo(
      'Hincado de jabalina y protocolo SRT 900/15',
      mockInsumosMap,
      mockManoObraMap
    );

    expect(yaml).toContain('Puesta a Tierra');
    expect(yaml).toContain('IRAM 2309');
    expect(yaml).toContain('SRT 900/15');
    expect(yaml).toContain('Jabalina Cobre 1/2" 1.5m');
  });

  it('resuelve mediante fallback heurístico cuando Ollama no responde', async () => {
    // Mock fetch que falla para simular Ollama offline
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'));

    const result = await generateTareaTipoWithAI(
      'Bocas de iluminación living',
      mockInsumosMap,
      mockManoObraMap,
      { host: 'http://127.0.0.1:99999' }
    );

    expect(result.source).toBe('heuristic_fallback');
    expect(result.yaml).toContain('Iluminación');
    expect(result.yaml).toContain('bocas');
    expect(result.diagnosticsCount).toBe(0);

    fetchSpy.mockRestore();
  });
});
