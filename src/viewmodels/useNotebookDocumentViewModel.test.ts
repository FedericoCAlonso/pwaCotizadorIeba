import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DEFAULT_APP_CONFIG } from '../core/sampleData';
import { CategoriaManoDeObra, Material, Oferta, Producto, TareaTipo } from '../core/types';
import { useNotebookDocumentViewModel } from './useNotebookDocumentViewModel';
import { db } from '../db/database';

const {
  mockPutPresupuesto,
  mockPutTareaTipo
} = vi.hoisted(() => ({
  mockPutPresupuesto: vi.fn().mockResolvedValue('pres-1'),
  mockPutTareaTipo: vi.fn().mockResolvedValue('tt-new')
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => undefined
}));

vi.mock('../db/database', () => ({
  db: {
    presupuestos: {
      put: mockPutPresupuesto,
      where: () => ({ toArray: vi.fn().mockResolvedValue([]) })
    },
    tareasTipo: {
      put: mockPutTareaTipo,
      toArray: vi.fn().mockResolvedValue([])
    },
    materiales: { toArray: vi.fn().mockResolvedValue([]) },
    productos: { toArray: vi.fn().mockResolvedValue([]) },
    ofertas: { toArray: vi.fn().mockResolvedValue([]) },
    insumos: { toArray: vi.fn().mockResolvedValue([]) },
    manoObra: { toArray: vi.fn().mockResolvedValue([]) },
    costosIndirectos: { toArray: vi.fn().mockResolvedValue([]) }
  }
}));

const catalogMateriales: Material[] = [
  {
    id: 'mat-cable-25',
    nombre: 'Cable 2.5mm Celeste',
    categoriaId: 'cables',
    unidadVenta: 'm',
    atributos: [],
    activo: true,
    frecuenciaUso: 30
  }
];

const catalogProductos: Producto[] = [
  { id: 'prod-1', materialId: 'mat-cable-25', marca: 'Prysmian', modelo: 'Superastic', esPreferido: true }
];

const catalogOfertas: Oferta[] = [
  {
    id: 'of-1',
    materialId: 'mat-cable-25',
    productoId: 'prod-1',
    proveedorNombre: 'Casa Eléctrica',
    precio: 1000,
    fecha: '2026-03-01T00:00:00Z',
    fuente: 'manual'
  }
];

const catalogMo: CategoriaManoDeObra[] = [
  { id: 'mo-oficial', nombre: 'Oficial', costoHora: 6000, fechaActualizacion: '2026-03-01' }
];

const catalogTareas: TareaTipo[] = [
  {
    id: 'tt-recableado',
    nombre: 'Recableado Completo',
    slug: 'recableado-completo',
    categoria: 'Instalaciones',
    unidad: 'm2',
    frecuenciaUso: 25,
    parametros: [
      { id: 'sup', nombre: 'Superficie', tipo: 'numero', valorDefault: 50 },
      { id: 'bocas', nombre: 'Bocas', tipo: 'numero', valorDefault: 10 }
    ],
    insumos: [{ materialId: 'mat-cable-25', cantidad: 1, formula: 'bocas * 2' }],
    manoObra: [{ categoriaId: 'mo-oficial', horas: 1, formula: 'bocas * 0.5' }],
    supuestos: [
      {
        id: 'caneria',
        nombre: 'Estado de cañería',
        opciones: ['original', 'verificada', 'no_verificada'],
        valorDefault: 'no_verificada'
      }
    ],
    advertenciasCondicionales: [
      {
        id: 'adv-1',
        supuestoId: 'caneria',
        valoresActivacion: ['no_verificada'],
        textoPlantilla: 'Si aparece caño embutido directo, se recarga {precio} por metro.',
        precioUnitarioContingencia: 7000,
        unidadContingencia: 'm',
        tema: 'caneria'
      }
    ]
  }
];

describe('useNotebookDocumentViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseCatalog = {
    tareasTipo: catalogTareas,
    materiales: catalogMateriales,
    productos: catalogProductos,
    ofertas: catalogOfertas,
    manoObra: catalogMo
  };

  it('recalcula variables, subtotales y errores del parser de forma reactiva', () => {
    const { result } = renderHook(() =>
      useNotebookDocumentViewModel({
        config: { ...DEFAULT_APP_CONFIG, margenPorDefectoPct: 20 },
        catalogOverride: baseCatalog
      })
    );

    act(() => {
      result.current.setTexto(
        ['bocas = 12', '/tt recableado-completo  sup=60  bocas=bocas'].join('\n')
      );
      result.current.setCursor(2, 10);
    });

    expect(result.current.esValido).toBe(true);
    expect(result.current.activeBlock?.tipo).toBe('tarea_tipo');
    // Cable: 12*2=24m * 1000 * 1.21 (IVA Factura C) = 29040; MO: 12*0.5=6h * 6000 = 36000 => Directo = 65040
    expect(result.current.activeSubtotalInfo?.costoDirecto).toBe(65040);
    expect(result.current.totales.precioFinalGlobal).toBeGreaterThan(65040);

    // Introducimos error sintáctico y ciclo para verificar reporte visible
    act(() => {
      result.current.setTexto(['a = b', 'b = a', '/tt inexistente'].join('\n'));
    });

    expect(result.current.esValido).toBe(false);
    expect(result.current.errores.some(e => e.codigo === 'ciclo_variable')).toBe(true);
    expect(result.current.errores.some(e => e.codigo === 'referencia_inexistente')).toBe(true);
  });

  it('gestiona flujo de dos pasadas, siguiente sin valorizar y total parcial', () => {
    const { result } = renderHook(() =>
      useNotebookDocumentViewModel({
        config: DEFAULT_APP_CONFIG,
        initialPassMode: 'esqueleto',
        catalogOverride: baseCatalog
      })
    );

    act(() => {
      result.current.setTexto(
        [
          '# Circuito 1',
          '/tt recableado-completo  sup=40  bocas=10',
          '/tt recableado-completo  sup=80  bocas=20'
        ].join('\n')
      );
      result.current.setCursor(1, 1);
    });

    expect(result.current.esTotalParcial).toBe(true);
    expect(result.current.cantidadSinValorizar).toBe(2);
    expect(result.current.siguienteSinValorizar?.linea).toBe(2);

    // Saltar a la primera tarea pendiente y valorizarla
    let jumpedLinea: number | undefined;
    act(() => {
      const jumped = result.current.irASiguienteSinValorizar();
      jumpedLinea = jumped?.linea;
    });
    expect(jumpedLinea).toBe(2);
    expect(result.current.cursor.linea).toBe(2);

    act(() => {
      if (result.current.activeItemId) {
        result.current.valorizarItem(result.current.activeItemId);
      }
    });

    expect(result.current.cantidadSinValorizar).toBe(1);
    expect(result.current.esTotalParcial).toBe(true);
    expect(result.current.siguienteSinValorizar?.linea).toBe(3);

    // Valorizar todas las pendientes quita el indicador de total parcial
    act(() => {
      result.current.valorizarTodasPendientes();
    });
    expect(result.current.cantidadSinValorizar).toBe(0);
    expect(result.current.esTotalParcial).toBe(false);
  });

  it('maneja autocompletado con ghost text, salto Tab entre parámetros y paleta de comandos', async () => {
    const { result } = renderHook(() =>
      useNotebookDocumentViewModel({
        config: DEFAULT_APP_CONFIG,
        catalogOverride: baseCatalog
      })
    );

    // Ghost text / autocompletado al escribir /tt recab
    act(() => {
      result.current.setTexto('/tt recab');
      result.current.setCursor(1, 10);
    });

    expect(result.current.autocomplete.isOpen).toBe(true);
    expect(result.current.autocomplete.suggestions[0].label).toBe('recableado-completo');

    act(() => {
      result.current.acceptAutocomplete(0);
    });
    expect(result.current.texto).toBe('/tt recableado-completo\n  sup = 50\n  bocas = 10');
    expect(result.current.cursor.linea).toBe(2);

    // Tab salta entre parámetros indentados sup -> bocas y Shift+Tab vuelve a sup
    act(() => {
      result.current.setCursor(1, 10);
    });
    act(() => {
      const tab1 = result.current.handleTabKey();
      expect(tab1.handled).toBe(true);
      expect(tab1.linea).toBe(2);
      expect(tab1.paramId).toBe('sup');
    });
    act(() => {
      const tab2 = result.current.handleTabKey();
      expect(tab2.handled).toBe(true);
      expect(tab2.linea).toBe(3);
      expect(tab2.paramId).toBe('bocas');
    });
    act(() => {
      const tabBack = result.current.handleTabKey(true);
      expect(tabBack.handled).toBe(true);
      expect(tabBack.linea).toBe(2);
      expect(tabBack.paramId).toBe('sup');
    });

    // Paleta de comandos Ctrl+K
    act(() => {
      result.current.openCommandPalette('nota');
    });
    expect(result.current.commandPalette.isOpen).toBe(true);
    expect(result.current.commandPalette.commands.some(c => c.id === 'cmd-new-nota')).toBe(true);

    await act(async () => {
      await result.current.executeCommandPaletteItem('cmd-new-nota');
    });
    expect(result.current.commandPalette.isOpen).toBe(false);
    expect(result.current.texto).toContain('nota: ');
  });

  it('persiste la cotización como single source of truth en Dexie y convierte tareas repetidas en TareaTipo', async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      useNotebookDocumentViewModel({
        config: DEFAULT_APP_CONFIG,
        catalogOverride: baseCatalog,
        onSaved
      })
    );

    act(() => {
      result.current.setTexto(
        [
          'item: Instalar fotocontrol  1 u  15000',
          'item: Instalar fotocontrol  2 u  15000'
        ].join('\n')
      );
    });

    expect(result.current.sugerenciasConversion).toHaveLength(1);

    await act(async () => {
      const saved = await result.current.guardar();
      expect(saved?.items).toHaveLength(2);
    });
    expect(db.presupuestos.put).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);

    await act(async () => {
      const created = await result.current.convertirTareaLibreATareaTipo('instalar fotocontrol');
      expect(created?.slug).toBe('instalar-fotocontrol');
    });
    expect(db.tareasTipo.put).toHaveBeenCalledTimes(1);
    expect(result.current.texto).toContain('/tt instalar-fotocontrol');
  });

  it('soporta undo/redo completo, dismiss/forceOpen de autocompletado y acciones de editor', () => {
    const { result } = renderHook(() =>
      useNotebookDocumentViewModel({
        config: DEFAULT_APP_CONFIG,
        catalogOverride: baseCatalog
      })
    );

    // Undo / Redo tras edición programática y manual
    act(() => {
      result.current.setTexto('tarea: Armado tablero');
      result.current.setCursor(1, 22);
    });
    act(() => {
      expect(result.current.handleEnterKey()).toBe(true);
    });
    expect(result.current.texto).toBe('tarea: Armado tablero\n  ');
    expect(result.current.canUndo).toBe(true);

    act(() => {
      expect(result.current.undo()).toBe(true);
    });
    expect(result.current.texto).toBe('tarea: Armado tablero');
    expect(result.current.canRedo).toBe(true);

    act(() => {
      expect(result.current.redo()).toBe(true);
    });
    expect(result.current.texto).toBe('tarea: Armado tablero\n  ');

    // Acciones de línea (duplicar, comentar, mover, eliminar)
    act(() => {
      result.current.setTexto('linea 1\nlinea 2');
      result.current.setCursor(1, 3);
    });
    act(() => {
      result.current.duplicateCurrentLine();
    });
    expect(result.current.texto).toBe('linea 1\nlinea 1\nlinea 2');

    act(() => {
      result.current.toggleCommentCurrentLine();
    });
    expect(result.current.texto).toBe('linea 1\n// linea 1\nlinea 2');

    act(() => {
      result.current.moveCurrentLine(-1);
    });
    expect(result.current.texto).toBe('// linea 1\nlinea 1\nlinea 2');

    // Dismiss & forceOpen + setCursor no resetea selección si la posición no cambia
    act(() => {
      result.current.setTexto('/');
      result.current.setCursor(1, 2);
    });
    expect(result.current.autocomplete.isOpen).toBe(true);
    act(() => {
      result.current.moveAutocompleteSelection(1);
    });
    const selectedAfterArrow = result.current.autocompleteSelectedIndex;
    expect(selectedAfterArrow).toBe(1);
    act(() => {
      result.current.setCursor(1, 2);
    });
    expect(result.current.autocompleteSelectedIndex).toBe(selectedAfterArrow);

    act(() => {
      result.current.dismissAutocomplete();
    });
    expect(result.current.autocomplete.isOpen).toBe(false);

    act(() => {
      result.current.forceOpenAutocomplete();
    });
    expect(result.current.autocomplete.isOpen).toBe(true);
  });

  it('permite declarar, editar, eliminar e insertar variables y bloques rápidos desde la cinta interactiva', () => {
    const { result } = renderHook(() =>
      useNotebookDocumentViewModel({
        config: DEFAULT_APP_CONFIG,
        catalogOverride: baseCatalog
      })
    );

    act(() => {
      result.current.setTexto('/tt recableado-completo\n  sup = 60\n  bocas = 10');
    });

    // Declarar nueva variable la ubica arriba con separador y la evalúa en scopeVariables
    act(() => {
      expect(result.current.upsertVariable('largo', '12', 'm')).toBe(true);
    });
    expect(result.current.texto.startsWith('largo = 12 m\n\n/tt recableado-completo')).toBe(true);
    expect(result.current.scopeVariables.largo).toBe(12);
    expect(result.current.variablesCotizacion[0]).toMatchObject({
      id: 'largo',
      valorEvaluado: 12,
      unidad: 'm'
    });

    // Segunda variable derivada queda agrupada junto a la primera
    act(() => {
      expect(result.current.upsertVariable('doble', 'largo * 2', 'm')).toBe(true);
    });
    expect(result.current.scopeVariables.doble).toBe(24);

    // Editar variable existente en su lugar
    act(() => {
      expect(result.current.upsertVariable('largo', '15', 'm', 'largo')).toBe(true);
    });
    expect(result.current.scopeVariables.largo).toBe(15);
    expect(result.current.scopeVariables.doble).toBe(30);

    // Insertar texto/función en el cursor con posicionamiento dentro de ()
    act(() => {
      result.current.setCursor(2, 19);
    });
    act(() => {
      result.current.insertTextAtCursor('ceil()', 5);
    });
    expect(result.current.texto).toContain('ceil()');

    // Eliminar variable
    act(() => {
      expect(result.current.deleteVariable('doble')).toBe(true);
    });
    expect(result.current.variablesCotizacion.map(v => v.id)).toEqual(['largo']);

    // Bloque rápido /tt abre autocompletado de trabajos tipo
    act(() => {
      result.current.setTexto('');
      result.current.setCursor(1, 1);
    });
    act(() => {
      result.current.insertQuickBlock('tt');
    });
    expect(result.current.texto).toBe('/tt ');
    expect(result.current.autocomplete.isOpen).toBe(true);
  });
});
