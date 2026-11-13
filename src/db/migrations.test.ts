import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dexie from 'dexie';
import {
  inferEstadoValorizacion,
  migratePresupuestoToV9,
  migrateTareaTipoToV9,
} from './migrations';
import { db, exportDatabaseJSON, importDatabaseJSON } from './database';
import { ItemPresupuesto, Presupuesto, TareaTipo } from '../core/types';

describe('Migración Dexie v8 -> v9 (Fase 1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  it('mantiene el esquema de Dexie en versión 9', () => {
    expect(db.verno).toBe(9);
  });

  it('migra TareaTipo v8 sin pérdida de datos y genera slug + alcance estructurado', () => {
    const legacyTarea: TareaTipo = {
      id: 'tt-tablero-v8',
      nombre: 'Cambio de Tablero Seccional',
      categoria: 'Tableros',
      unidad: 'u',
      naturaleza: 'instalacion',
      clausulaExclusiones: 'No incluye adecuación de acometida exterior.',
      parametros: [
        { id: 'circuitos', nombre: 'Circuitos', tipo: 'numero', valorDefault: 8 },
      ],
      insumos: [
        { materialId: 'mat-gabinete-12', cantidad: 1 },
      ],
      manoObra: [
        { categoriaId: 'mo-oficial', horas: 4 },
      ],
    };

    const migrated = migrateTareaTipoToV9(legacyTarea);

    expect(migrated.id).toBe('tt-tablero-v8');
    expect(migrated.nombre).toBe('Cambio de Tablero Seccional');
    expect(migrated.slug).toBe('cambio-de-tablero-seccional');
    expect(migrated.version).toBe(1);
    expect(migrated.clausulaExclusiones).toBe('No incluye adecuación de acometida exterior.');
    expect(migrated.alcance?.exclusiones).toHaveLength(1);
    expect(migrated.alcance?.exclusiones[0].texto).toBe('No incluye adecuación de acometida exterior.');
    expect(migrated.parametros).toEqual(legacyTarea.parametros);
    expect(migrated.insumos).toEqual(legacyTarea.insumos);
    expect(migrated.manoObra).toEqual(legacyTarea.manoObra);
    expect(migrated.supuestos).toEqual([]);
    expect(migrated.advertenciasCondicionales).toEqual([]);
    expect(migrated.subTrabajos).toEqual([]);
  });

  it('infiere estadoValorizacion correctamente para ítems v8 valorizados y sin valorizar', () => {
    const base: ItemPresupuesto = {
      id: 'i-1',
      descripcion: 'Tarea',
      cantidad: 1,
      unidad: 'u',
      insumosSnapshot: [],
      manoObraSnapshot: [],
      costoInsumos: 0,
      costoManoObra: 0,
      costoDirectoTotal: 0,
      precioVentaUnitario: 0,
      precioVentaTotal: 0,
    };

    expect(inferEstadoValorizacion(base)).toBe('sin_valorizar');
    expect(inferEstadoValorizacion({ ...base, precioManual: 45000 })).toBe('valorizada');
    expect(
      inferEstadoValorizacion({
        ...base,
        insumosSnapshot: [
          {
            materialId: 'm1',
            nombre: 'Cable',
            unidad: 'm',
            cantidadTotal: 10,
            precioUnitarioCongelado: 500,
            subtotalInsumo: 5000,
          },
        ],
        costoInsumos: 5000,
        costoDirectoTotal: 5000,
      })
    ).toBe('valorizada');
  });

  it('migra Presupuesto v8 completo preservando snapshots, variables y notas internas', () => {
    const legacyPresupuesto: Presupuesto = {
      id: 'pres-v8-1',
      numero: 'IEBA-2026-0010',
      revision: 1,
      clienteId: 'cli-1',
      fechaEmision: '2026-09-10T12:00:00.000Z',
      validezDias: 15,
      tipoFactura: 'Factura B',
      calculosVariables: {
        sup: 60,
        bocas: 24,
      },
      calculatedCells: [
        { name: 'sup', rawExpression: '60', evaluatedValue: 60, isFormula: false },
        { name: 'bocas', rawExpression: 'ceil(sup * 0.4)', evaluatedValue: 24, isFormula: true },
      ],
      notasInternas: 'Margen ajustado por acceso complejo en techo.',
      notasCliente: 'Validez 15 días.',
      items: [
        {
          id: 'it-valorizado',
          tipoItem: 'tarea_tipo',
          tareaTipoId: 'tt-tablero-v8',
          valoresParametros: { circuitos: 8 },
          descripcion: 'Tablero seccional 8 circuitos',
          cantidad: 1,
          unidad: 'u',
          insumosSnapshot: [
            {
              materialId: 'mat-gabinete-12',
              nombre: 'Gabinete 12 bocas',
              unidad: 'u',
              cantidadTotal: 1,
              precioUnitarioCongelado: 25000,
              subtotalInsumo: 25000,
            },
          ],
          manoObraSnapshot: [],
          costoInsumos: 25000,
          costoManoObra: 0,
          costoDirectoTotal: 25000,
          precioVentaUnitario: 40000,
          precioVentaTotal: 40000,
        },
        {
          id: 'it-esqueleto',
          tipoItem: 'item_libre',
          descripcion: 'Reubicar medidor (a definir)',
          cantidad: 1,
          unidad: 'gl',
          insumosSnapshot: [],
          manoObraSnapshot: [],
          costoInsumos: 0,
          costoManoObra: 0,
          costoDirectoTotal: 0,
          precioVentaUnitario: 0,
          precioVentaTotal: 0,
        },
      ],
      costosIndirectosAplicados: [],
      subtotalInsumos: 25000,
      subtotalManoObra: 0,
      subtotalCostosDirectos: 25000,
      subtotalCostosIndirectos: 0,
      costoTotalObra: 25000,
      margenPorcentaje: 30,
      montoGanancia: 7500,
      impuestosDetalle: [],
      impuestosPorcentaje: 21,
      montoImpuestos: 0,
      totalARS: 40000,
      mostrarReferenciaMonedaExtranjera: false,
      nombreMonedaExtranjera: 'USD',
      cotizacionMonedaExtranjera: 1200,
      condicionesPagoTexto: '50% adelanto',
      estado: 'borrador',
      fechaModificacion: '2026-09-10T12:00:00.000Z',
    };

    const migrated = migratePresupuestoToV9(legacyPresupuesto);

    // Snapshots y totales intactos
    expect(migrated.totalARS).toBe(40000);
    expect(migrated.items[0].insumosSnapshot).toHaveLength(1);
    expect(migrated.items[0].insumosSnapshot[0].precioUnitarioCongelado).toBe(25000);

    // Estados de valorización inferidos
    expect(migrated.items[0].estadoValorizacion).toBe('valorizada');
    expect(migrated.items[1].estadoValorizacion).toBe('sin_valorizar');

    // Overrides de parámetros preservados
    expect(migrated.items[0].overridesParametros).toEqual({ circuitos: 8 });

    // Variables de cotización convertidas desde legacy
    expect(migrated.variablesCotizacion).toHaveLength(2);
    expect(migrated.variablesCotizacion?.find((v) => v.id === 'sup')?.valorEvaluado).toBe(60);
    expect(migrated.variablesCotizacion?.find((v) => v.id === 'bocas')?.valorEvaluado).toBe(24);
    expect(migrated.calculosVariables).toEqual({ sup: 60, bocas: 24 });

    // Nota interna separada y preservada
    expect(migrated.notasInternas).toBe('Margen ajustado por acceso complejo en techo.');
    expect(migrated.notasInternasLista).toHaveLength(1);
    expect(migrated.notasInternasLista?.[0].texto).toBe('Margen ajustado por acceso complejo en techo.');
  });

  it('exportDatabaseJSON incluye schemaVersion 9 e importDatabaseJSON migra backups v8 al restaurar', async () => {
    const tableNames = [
      'categoriasMaterial',
      'materiales',
      'productos',
      'ofertas',
      'solicitudesCotizacion',
      'insumos',
      'manoObra',
      'costosIndirectos',
      'tareasTipo',
      'contactos',
      'clientes',
      'proveedores',
      'proyectos',
      'presupuestos',
      'registrosTrabajo',
      'config',
      'convenios',
    ] as const;

    for (const name of tableNames) {
      vi.spyOn(db[name], 'toArray').mockResolvedValue([] as any);
      vi.spyOn(db[name], 'clear').mockResolvedValue(undefined as any);
      vi.spyOn(db[name], 'bulkPut').mockResolvedValue([] as any);
    }

    const jsonStr = await exportDatabaseJSON();
    const parsed = JSON.parse(jsonStr);
    expect(parsed.schemaVersion).toBe(9);
    expect(typeof parsed.exportDate).toBe('string');

    vi.spyOn(Dexie.prototype, 'transaction').mockImplementation(async (...args: any[]) => {
      const fn = args[args.length - 1];
      if (typeof fn === 'function') return fn();
    });

    const v8Backup = JSON.stringify({
      tareasTipo: [
        {
          id: 'tt-legacy',
          nombre: 'Boca de Toma',
          categoria: 'Bocas',
          unidad: 'u',
          insumos: [],
          manoObra: [],
        },
      ],
      presupuestos: [
        {
          id: 'pres-legacy',
          numero: 'COT-1',
          revision: 1,
          clienteId: 'cli-1',
          fechaEmision: '2026-08-01T00:00:00.000Z',
          validezDias: 15,
          tipoFactura: 'Factura A',
          calculosVariables: { bocas: 12 },
          items: [
            {
              id: 'it-1',
              descripcion: 'Boca',
              cantidad: 12,
              unidad: 'u',
              insumosSnapshot: [],
              manoObraSnapshot: [],
              costoInsumos: 0,
              costoManoObra: 0,
              costoDirectoTotal: 0,
              precioVentaUnitario: 0,
              precioVentaTotal: 0,
            },
          ],
          costosIndirectosAplicados: [],
          subtotalInsumos: 0,
          subtotalManoObra: 0,
          subtotalCostosDirectos: 0,
          subtotalCostosIndirectos: 0,
          costoTotalObra: 0,
          margenPorcentaje: 30,
          montoGanancia: 0,
          impuestosDetalle: [],
          impuestosPorcentaje: 21,
          montoImpuestos: 0,
          totalARS: 0,
          mostrarReferenciaMonedaExtranjera: false,
          nombreMonedaExtranjera: 'USD',
          cotizacionMonedaExtranjera: 1200,
          condicionesPagoTexto: 'Contado',
          estado: 'borrador',
          fechaModificacion: '2026-08-01T00:00:00.000Z',
        },
      ],
    });

    await importDatabaseJSON(v8Backup);

    const putTareas = vi.mocked(db.tareasTipo.bulkPut).mock.calls[0][0] as TareaTipo[];
    expect(putTareas[0].slug).toBe('boca-de-toma');

    const putPres = vi.mocked(db.presupuestos.bulkPut).mock.calls[0][0] as Presupuesto[];
    expect(putPres[0].variablesCotizacion?.[0].id).toBe('bocas');
    expect(putPres[0].items[0].estadoValorizacion).toBe('sin_valorizar');
  });
});
