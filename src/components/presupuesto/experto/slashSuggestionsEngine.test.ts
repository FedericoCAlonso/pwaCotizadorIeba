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
});
