import { describe, it, expect } from 'vitest';
import {
  detectarCiclosComposicionTareaTipo,
  evaluarAlcanceYAdvertencias,
  evaluarVariablesCotizacion,
  slugifyIdentificador,
} from './notebookDomain';
import { Presupuesto, TareaTipo } from './types';

function makePresupuestoBase(partial: Partial<Presupuesto> = {}): Presupuesto {
  return {
    id: 'p-1',
    numero: 'COT-2026-0001',
    revision: 1,
    clienteId: 'cli-1',
    fechaEmision: '2026-11-13T10:00:00.000Z',
    validezDias: 15,
    tipoFactura: 'Factura A',
    items: [],
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
    fechaModificacion: '2026-11-13T10:00:00.000Z',
    ...partial,
  };
}

function makeTareaTipoBase(partial: Partial<TareaTipo> = {}): TareaTipo {
  return {
    id: 'tt-1',
    nombre: 'Recableado completo',
    categoria: 'Circuitos',
    unidad: 'gl',
    insumos: [],
    manoObra: [],
    ...partial,
  };
}

describe('notebookDomain (Fase 1)', () => {
  it('genera slugs deterministas sin tildes ni caracteres especiales', () => {
    expect(slugifyIdentificador('Recableado Completo (Cañería)')).toBe('recableado-completo-caneria');
    expect(slugifyIdentificador('Protocolo SRT 900/15')).toBe('protocolo-srt-900-15');
  });

  describe('evaluarVariablesCotizacion', () => {
    it('evalúa variables encadenadas en orden topológico incluso si están declaradas al revés', () => {
      const res = evaluarVariablesCotizacion([
        { id: 'bocas', expresion: 'ceil(sup * 0.4)' },
        { id: 'circuitos', expresion: 'ceil(bocas / 10)' },
        { id: 'sup', expresion: '60' },
      ]);

      expect(res.tieneErrores).toBe(false);
      expect(res.scope).toEqual({
        sup: 60,
        bocas: 24,
        circuitos: 3,
      });
    });

    it('detecta ciclos directos e indirectos entre variables y reporta error visible', () => {
      const res = evaluarVariablesCotizacion([
        { id: 'a', expresion: 'b + 1' },
        { id: 'b', expresion: 'a * 2' },
        { id: 'c', expresion: 'c + 5' },
        { id: 'ok', expresion: '10' },
      ]);

      expect(res.tieneErrores).toBe(true);
      expect(res.variables.find((v) => v.id === 'a')?.error).toContain('circular');
      expect(res.variables.find((v) => v.id === 'b')?.error).toContain('circular');
      expect(res.variables.find((v) => v.id === 'c')?.error).toContain('circular');
      expect(res.scope.ok).toBe(10);
    });

    it('reporta variables no definidas sin lanzar excepción', () => {
      const res = evaluarVariablesCotizacion([
        { id: 'total', expresion: 'inexistente * 2' },
      ]);

      expect(res.tieneErrores).toBe(true);
      expect(res.variables[0].error).toContain("Variable no definida 'inexistente'");
    });
  });

  describe('detectarCiclosComposicionTareaTipo', () => {
    it('retorna null para composición acíclica y camino del ciclo si existe recursión', () => {
      const ttA = makeTareaTipoBase({
        id: 'tt-a',
        subTrabajos: [{ tareaTipoId: 'tt-b' }],
      });
      const ttB = makeTareaTipoBase({
        id: 'tt-b',
        subTrabajos: [{ tareaTipoId: 'tt-c' }],
      });
      const ttC = makeTareaTipoBase({ id: 'tt-c' });

      const validCatalog = new Map([
        ['tt-a', ttA],
        ['tt-b', ttB],
        ['tt-c', ttC],
      ]);
      expect(detectarCiclosComposicionTareaTipo('tt-a', validCatalog)).toBeNull();

      const ttCConCiclo = makeTareaTipoBase({
        id: 'tt-c',
        subTrabajos: [{ tareaTipoId: 'tt-a' }],
      });
      const cyclicCatalog = new Map([
        ['tt-a', ttA],
        ['tt-b', ttB],
        ['tt-c', ttCConCiclo],
      ]);
      expect(detectarCiclosComposicionTareaTipo('tt-a', cyclicCatalog)).toEqual([
        'tt-a',
        'tt-b',
        'tt-c',
        'tt-a',
      ]);
    });
  });

  describe('evaluarAlcanceYAdvertencias (7 reglas)', () => {
    it('oculta advertencias si el supuesto está verificado o no aplica, y las muestra con precio si no está verificado', () => {
      const tt = makeTareaTipoBase({
        id: 'tt-recableado',
        supuestos: [
          {
            id: 'caneria',
            nombre: 'Estado de cañería',
            opciones: ['original', 'verificada', 'no_verificada', 'no_aplica'],
            valorDefault: 'no_verificada',
          },
        ],
        advertenciasCondicionales: [
          {
            id: 'adv-caneria',
            supuestoId: 'caneria',
            valoresActivacion: ['no_verificada', 'original'],
            tema: 'canalizacion',
            textoPlantilla: 'Si al abrir aparece cañería embutida directa, se repone a {precio} por metro.',
            precioUnitarioContingencia: 8500,
            unidadContingencia: 'm',
          },
        ],
      });
      const catalog = new Map([['tt-recableado', tt]]);

      const item = {
        id: 'it-1',
        tareaTipoId: 'tt-recableado',
        descripcion: 'Recableado',
        cantidad: 1,
        unidad: 'gl',
        insumosSnapshot: [],
        manoObraSnapshot: [],
        costoInsumos: 0,
        costoManoObra: 0,
        costoDirectoTotal: 0,
        precioVentaUnitario: 0,
        precioVentaTotal: 0,
      };

      // Caso 1: supuesto no_verificada (default) -> debe evaluarse y mostrarse
      const resActivo = evaluarAlcanceYAdvertencias(
        makePresupuestoBase({ items: [item], notasInternas: 'SECRETO INTERNO' }),
        catalog
      );
      expect(resActivo.advertenciasVisibles).toHaveLength(1);
      expect(resActivo.advertenciasVisibles[0].texto).toContain('$8.500');
      expect(JSON.stringify(resActivo)).not.toContain('SECRETO INTERNO');

      // Caso 2: supuesto verificada -> NO se evalúa ni muestra
      const resVerificada = evaluarAlcanceYAdvertencias(
        makePresupuestoBase({
          supuestos: { caneria: 'verificada' },
          items: [item],
        }),
        catalog
      );
      expect(resVerificada.todasLasAdvertencias).toHaveLength(0);

      // Caso 3: supuesto no_aplica -> NO se evalúa ni muestra
      const resNoAplica = evaluarAlcanceYAdvertencias(
        makePresupuestoBase({
          supuestos: { caneria: 'no_aplica' },
          items: [item],
        }),
        catalog
      );
      expect(resNoAplica.todasLasAdvertencias).toHaveLength(0);
    });

    it('deduplica inclusiones/exclusiones/advertencias entre tareas y respeta presupuesto máximo de 3 visibles', () => {
      const tt1 = makeTareaTipoBase({
        id: 'tt-1',
        alcance: {
          inclusiones: [
            { id: 'inc-cable', texto: 'Tendido de conductores normalizados', tema: 'canalizacion' },
            { id: 'puesta-a-tierra', texto: 'Medición de puesta a tierra', tema: 'seguridad' },
          ],
          exclusiones: [
            { id: 'exc-alba', texto: 'No incluye albañilería ni pintura', tema: 'obra_civil' },
          ],
        },
        supuestos: [
          { id: 's1', nombre: 'S1', opciones: ['no_verificada', 'verificada'], valorDefault: 'no_verificada' },
        ],
        advertenciasCondicionales: [
          { id: 'a1', supuestoId: 's1', valoresActivacion: ['no_verificada'], tema: 't1', textoPlantilla: 'Adv 1 a {precio}', precioUnitarioContingencia: 1000 },
          { id: 'a2', supuestoId: 's1', valoresActivacion: ['no_verificada'], tema: 't1', textoPlantilla: 'Adv 2 a {precio}', precioUnitarioContingencia: 2000 },
          { id: 'a3', supuestoId: 's1', valoresActivacion: ['no_verificada'], tema: 't2', textoPlantilla: 'Adv 3 a {precio}', precioUnitarioContingencia: 3000 },
          { id: 'a4', supuestoId: 's1', valoresActivacion: ['no_verificada'], tema: 't2', textoPlantilla: 'Adv 4 a {precio}', precioUnitarioContingencia: 4000 },
        ],
      });

      const tt2 = makeTareaTipoBase({
        id: 'tt-2',
        alcance: {
          inclusiones: [
            { id: 'inc-cable', texto: 'Tendido de conductores normalizados', tema: 'canalizacion' },
          ],
          exclusiones: [
            { id: 'exc-alba', texto: 'No incluye albañilería ni pintura', tema: 'obra_civil' },
          ],
        },
      });

      const catalog = new Map([
        ['tt-1', tt1],
        ['tt-2', tt2],
      ]);

      const presupuesto = makePresupuestoBase({
        items: [
          {
            id: 'it-1',
            tareaTipoId: 'tt-1',
            ajustesInstancia: { quitados: ['puesta-a-tierra'], agregados: [] },
            descripcion: 'T1',
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
          {
            id: 'it-2',
            tareaTipoId: 'tt-2',
            descripcion: 'T2',
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
      });

      const res = evaluarAlcanceYAdvertencias(presupuesto, catalog);

      // 'puesta-a-tierra' fue quitado y 'inc-cable' / 'exc-alba' deduplicados
      expect(res.inclusiones.map((i) => i.id)).toEqual(['inc-cable']);
      expect(res.exclusiones.map((e) => e.id)).toEqual(['exc-alba']);

      // Presupuesto de 3 visibles + 1 plegada + flag de lint
      expect(res.advertenciasVisibles).toHaveLength(3);
      expect(res.advertenciasPlegadas).toHaveLength(1);
      expect(res.excedePresupuestoAdvertencias).toBe(true);
      expect(res.gruposPorTema.map((g) => g.tema)).toContain('t1');
      expect(res.gruposPorTema.map((g) => g.tema)).toContain('t2');
    });
  });
});
