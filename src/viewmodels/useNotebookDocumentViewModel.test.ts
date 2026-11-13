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
    expect(result.current.texto).toBe('/tt recableado-completo  sup=50  bocas=10');

    // Tab salta entre parámetros sup -> bocas
    act(() => {
      result.current.setCursor(1, 10);
    });
    act(() => {
      const tab1 = result.current.handleTabKey();
      expect(tab1.handled).toBe(true);
      expect(tab1.paramId).toBe('sup');
    });
    act(() => {
      const tab2 = result.current.handleTabKey();
      expect(tab2.handled).toBe(true);
      expect(tab2.paramId).toBe('bocas');
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
});
