import { describe, it, expect } from 'vitest';
import { generateSlashSuggestions } from './slashSuggestionsEngine';
import { TareaTipo, Cliente, Insumo, CategoriaManoDeObra, CostoIndirecto } from '../../../core/types';

describe('slashSuggestionsEngine', () => {
  const mockClientes: Cliente[] = [
    { id: 'cli-1', razonSocial: 'Constructora Central', nombre: 'Constructora Central', cuitDni: '30-12345678-9', roles: ['cliente'] },
    { id: 'cli-2', razonSocial: 'Estudio Rossi', nombre: 'Estudio Rossi', roles: ['cliente'] }
  ];

  const mockTareasTipo: TareaTipo[] = [
    { id: 'tt-1', nombre: 'Instalación de Boca de Iluminación', categoria: 'bocas', unidad: 'u', insumos: [], manoObra: [] },
    { id: 'tt-2', nombre: 'Armado de Tablero Seccional', categoria: 'tableros', unidad: 'u', insumos: [], manoObra: [] }
  ];

  const mockInsumosMap = new Map<string, Insumo>([
    [
      'mat-cable-2.5',
      {
        id: 'mat-cable-2.5',
        nombre: 'Cable Unipolar 2.5 mm2',
        categoriaId: 'cat-conductores',
        categoria: 'Conductores',
        unidad: 'm',
        unidadVenta: 'm',
        precioActual: 850,
        atributos: [],
        activo: true
      }
    ]
  ]);

  const mockCostosIndirectos: CostoIndirecto[] = [
    {
      id: 'ci-art',
      nombre: 'Seguro ART Cuadrilla',
      tipo: 'porcentual_sobre_costo',
      modalidad: 'porcentual',
      destino: 'mano_obra',
      valor: 8.5
    }
  ];

  it('sugiere clientes cuando directiveType es "cliente"', () => {
    const results = generateSlashSuggestions({
      query: '@Constructora',
      effectiveQuery: 'Constructora',
      directiveType: 'cliente',
      clientes: mockClientes,
      tareasTipo: [],
      costosIndirectos: []
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Constructora Central');
    expect(results[0].snippet).toContain('cliente: Constructora Central');
  });

  it('sugiere opciones fiscales cuando directiveType es "factura"', () => {
    const results = generateSlashSuggestions({
      query: 'factura:',
      effectiveQuery: '',
      directiveType: 'factura',
      clientes: [],
      tareasTipo: [],
      costosIndirectos: []
    });

    expect(results.some((r) => r.title === 'Factura A')).toBe(true);
    expect(results.some((r) => r.title === 'Factura B')).toBe(true);
    expect(results.some((r) => r.title === 'Factura C')).toBe(true);
  });

  it('sugiere materiales cuando contextType es "materiales"', () => {
    const results = generateSlashSuggestions({
      query: 'cable',
      effectiveQuery: 'cable',
      contextType: 'materiales',
      insumosMap: mockInsumosMap,
      clientes: [],
      tareasTipo: [],
      costosIndirectos: []
    });

    expect(results.some((r) => r.title.includes('Cable Unipolar 2.5 mm2'))).toBe(true);
  });

  it('sugiere gastos indirectos cuando contextType es "gastos"', () => {
    const results = generateSlashSuggestions({
      query: 'art',
      effectiveQuery: 'art',
      contextType: 'gastos',
      costosIndirectos: mockCostosIndirectos,
      clientes: [],
      tareasTipo: []
    });

    expect(results.some((r) => r.title === 'Seguro ART Cuadrilla')).toBe(true);
  });

  it('sugiere tareas de catálogo en contexto general cuando hay profundidad de nivel', () => {
    const results = generateSlashSuggestions({
      query: 'tablero',
      effectiveQuery: 'tablero',
      contextType: 'general',
      currentIndent: '  ',
      tareasTipo: mockTareasTipo,
      clientes: [],
      costosIndirectos: []
    });

    expect(results.some((r) => r.title.includes('Armado de Tablero Seccional'))).toBe(true);
  });

  it('no ofrece trabajos tipo en nivel raíz cuando el cursor está en el nivel 0', () => {
    const results = generateSlashSuggestions({
      query: '',
      effectiveQuery: '',
      contextType: 'general',
      currentIndent: '',
      tareasTipo: mockTareasTipo,
      clientes: [],
      costosIndirectos: []
    });

    expect(results.some((r) => r.category === 'tarea')).toBe(false);
  });

  it('ofrece sólo Nuevo Capítulo genérico y no capítulos predeterminados', () => {
    const results = generateSlashSuggestions({
      query: '/cap',
      effectiveQuery: 'cap',
      contextType: 'general',
      clientes: [],
      tareasTipo: [],
      costosIndirectos: []
    });

    const chapterItems = results.filter((r) => r.category === 'capitulo');
    expect(chapterItems.length).toBe(1);
    expect(chapterItems[0].id).toBe('cmd-capitulo');
    expect(chapterItems[0].title).toBe('Nuevo Capítulo');
    expect(results.some((r) => r.title.includes('Iluminación'))).toBe(false);
    expect(results.some((r) => r.title.includes('Fuerza Motriz'))).toBe(false);
  });

  it('genera snippet paramétrico con todos los parámetros y subtotales estimados calculados', () => {
    const tareaParametrica: TareaTipo = {
      id: 'tt-bocas-param',
      nombre: 'Instalación de Bocas Completa',
      categoria: 'bocas',
      unidad: 'boca',
      parametros: [
        { id: 'bocas', nombre: 'Cantidad de Bocas', unidad: 'u', tipo: 'numero', valorDefault: 10 },
        { id: 'distancia', nombre: 'Distancia', unidad: 'm', tipo: 'numero', valorDefault: 5, condicion: 'bocas > 0' }
      ],
      insumos: [
        {
          materialId: 'mat-cable-2.5',
          formula: 'bocas * distancia',
          cantidad: 1
        }
      ],
      manoObra: [
        {
          categoriaId: 'cat-oficial',
          formula: 'bocas * 0.5',
          horas: 1
        }
      ]
    };

    const mockManoObraMap = new Map<string, CategoriaManoDeObra>([
      ['cat-oficial', { id: 'cat-oficial', nombre: 'Oficial Electricista', costoHora: 10000, fechaActualizacion: '2026-01-01' }]
    ]);

    const results = generateSlashSuggestions({
      query: 'bocas',
      effectiveQuery: 'bocas',
      contextType: 'general',
      currentIndent: '  ',
      tareasTipo: [tareaParametrica],
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap,
      clientes: [],
      costosIndirectos: []
    });

    const paramItem = results.find((r) => r.id === 'tarea-tt-bocas-param');
    expect(paramItem).toBeDefined();
    expect(paramItem?.snippet).toContain('bocas: 10');
    expect(paramItem?.snippet).toContain('distancia: 5');
    expect(paramItem?.snippet).toContain('condición: bocas > 0');
    expect(paramItem?.snippet).toContain('# Subtotales estimados:');
    expect(paramItem?.snippet).toContain('#   Materiales:');
    expect(paramItem?.snippet).toContain('#   Mano de Obra:');
    expect(paramItem?.snippet).toContain('#   Costo Unitario:');
    expect(paramItem?.subtitle).toContain('Costo est.');
  });
});
