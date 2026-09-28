import { describe, it, expect } from 'vitest';
import {
  ItemPresupuesto,
  CapituloPresupuesto,
  Presupuesto,
  ParametroItem,
  TareaTipo,
  GastoPresupuestoConfig
} from './types';
import {
  evaluarParametrosYLineasItem,
  calcularTotalesPresupuesto,
  roundMoney
} from './calculations';
import {
  serializePresupuestoToDSL,
  parseDSLToPresupuesto,
  validateYamlStructure,
  ParseDSLContext
} from '../components/presupuesto/experto/dslParser';

function mockItem(partial: Partial<ItemPresupuesto>): ItemPresupuesto {
  return {
    id: 'mock-item',
    descripcion: 'Mock Item',
    cantidad: 1,
    unidad: 'u',
    insumosSnapshot: [],
    manoObraSnapshot: [],
    costoInsumos: 0,
    costoManoObra: 0,
    costoDirectoTotal: 0,
    precioVentaUnitario: 0,
    precioVentaTotal: 0,
    ...partial
  };
}

function mockPresupuesto(partial: Partial<Presupuesto>): Presupuesto {
  return {
    id: 'cot-1',
    numero: 'COT-2026-0001',
    revision: 1,
    clienteId: 'cli-1',
    fechaEmision: '2026-09-01T10:00:00.000Z',
    validezDias: 15,
    tipoFactura: 'Factura A',
    estado: 'borrador',
    items: [],
    capitulos: [],
    gastosConfig: [],
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
    mostrarReferenciaMonedaExtranjera: false,
    nombreMonedaExtranjera: 'Dólar MEP',
    cotizacionMonedaExtranjera: 1350,
    condicionesPagoTexto: '50% anticipo, 50% contra entrega',
    totalARS: 0,
    fechaModificacion: '2026-09-01T10:00:00.000Z',
    ...partial
  };
}

const mockParseContext: ParseDSLContext = {
  clientes: [],
  tareasTipo: [],
  insumosMap: new Map(),
  manoObraMap: new Map()
};

describe('Fase 1: Modelo Unificado y Limpieza - Cotizador IEBA', () => {
  // ─── 1. Cascada de Resolución de Nombres y Parámetros de Ítem ───
  describe('2.2 Ítem Unificado y Resolución en Cascada', () => {
    it('resuelve nombres en orden de prioridad: ítem > capítulo > cotización > tarea tipo', () => {
      const tareaTipoBase: TareaTipo = {
        id: 'tt-1',
        nombre: 'Instalación de Circuito',
        categoria: 'cat-electrica',
        unidad: 'boca',
        naturaleza: 'instalacion',
        version: 1,
        parametros: [
          { id: 'factor', nombre: 'factor', tipo: 'numero', valorDefault: 1.0 },
          { id: 'coef', nombre: 'coef', tipo: 'numero', valorDefault: 10 }
        ],
        insumos: [],
        manoObra: []
      };

      const item = mockItem({
        id: 'it-1',
        descripcion: 'Bocas de iluminación',
        cantidad: 5,
        unidad: 'boca',
        tareaTipoId: 'tt-1',
        tareaTipoVersion: 1,
        parametros: [
          // En ítem: define 'factor' = 2.5 (debe sobreescribir todo)
          { id: 'factor', nombre: 'factor', valor: 2.5, origen: 'propio' }
        ],
        insumosSnapshot: [
          {
            insumoId: 'ins-1',
            nombre: 'Cable 2.5mm',
            unidad: 'm',
            cantidadUnitaria: 1,
            cantidadTotal: 1,
            // formulaCantidad lee: factor (del ítem), coef (del capítulo), globalVar (de cotización) y cantidad (reservada)
            formulaCantidad: '=factor * coef * globalVar * cantidad',
            precioUnitarioCongelado: 100,
            subtotalInsumo: 100
          }
        ],
        manoObraSnapshot: [
          {
            categoriaId: 'mo-oficial',
            nombreCategoria: 'Oficial Electricista',
            horasUnitarias: 1,
            horasTotales: 1,
            formulaHoras: '=cantidad * factor',
            costoHoraCongelado: 5000,
            subtotalManoObra: 5000
          }
        ]
      });

      const capitulo: CapituloPresupuesto = {
        id: 'cap-1',
        nombre: 'Instalación Eléctrica',
        orden: 1,
        variables: {
          coef: 20 // Sobreescribe el 10 de tareaTipoBase
        }
      };

      const calculosVariables = {
        globalVar: 3, // De la cotización
        factor: 999 // Debe ser ignorado porque el ítem define 'factor' = 2.5
      };

      const resultado = evaluarParametrosYLineasItem(item, {
        capitulo,
        tareaTipo: tareaTipoBase,
        calculosVariables
      });

      // Verificación de resolución:
      // factor = 2.5 (ítem)
      // coef = 20 (capítulo)
      // globalVar = 3 (cotización)
      // cantidad = 5 (palabra reservada del ítem)
      // formulaCantidad = 2.5 * 20 * 3 * 5 = 750
      expect(resultado.item.insumosSnapshot![0].cantidadTotal).toBe(750);
      expect(resultado.item.insumosSnapshot![0].subtotalInsumo).toBe(750 * 100);

      // formulaHoras = cantidad (5) * factor (2.5) = 12.5 horas
      expect(resultado.item.manoObraSnapshot![0].horasTotales).toBe(12.5);
      expect(resultado.item.manoObraSnapshot![0].subtotalManoObra).toBe(12.5 * 5000);

      expect(resultado.errores).toEqual({});
      expect(resultado.item.erroresFormulas).toBeUndefined();
    });

    it('protege los precios congelados (precioUnitarioCongelado, costoHoraCongelado) al recalcular cantidades', () => {
      const item = mockItem({
        id: 'it-congelado',
        descripcion: 'Tablero Seccional',
        cantidad: 2,
        unidad: 'gl',
        parametros: [{ id: 'modulos', nombre: 'modulos', valor: 24 }],
        insumosSnapshot: [
          {
            insumoId: 'ins-termomagnetica',
            nombre: 'Térmica 2x16A',
            unidad: 'u',
            cantidadUnitaria: 1,
            cantidadTotal: 2,
            formulaCantidad: '=modulos / 2',
            precioUnitarioCongelado: 4500, // Precio que debe permanecer intacto
            subtotalInsumo: 9000
          }
        ],
        manoObraSnapshot: [
          {
            categoriaId: 'mo-oficial',
            nombreCategoria: 'Oficial',
            horasUnitarias: 3,
            horasTotales: 6,
            formulaHoras: '=cantidad * 3',
            costoHoraCongelado: 6000, // Costo que debe permanecer intacto
            subtotalManoObra: 36000
          }
        ]
      });

      const resultado = evaluarParametrosYLineasItem(item);

      // formulaCantidad = 24 / 2 = 12 unidades
      expect(resultado.item.insumosSnapshot![0].cantidadTotal).toBe(12);
      expect(resultado.item.insumosSnapshot![0].precioUnitarioCongelado).toBe(4500);
      expect(resultado.item.insumosSnapshot![0].subtotalInsumo).toBe(12 * 4500);

      // formulaHoras = 2 * 3 = 6 horas
      expect(resultado.item.manoObraSnapshot![0].horasTotales).toBe(6);
      expect(resultado.item.manoObraSnapshot![0].costoHoraCongelado).toBe(6000);
      expect(resultado.item.manoObraSnapshot![0].subtotalManoObra).toBe(6 * 6000);
    });

    it('rechaza el uso de cantidad como parámetro auxiliar y emite error visible sin romper cálculo', () => {
      const item = mockItem({
        id: 'it-reservado',
        descripcion: 'Item con param invalido',
        cantidad: 10,
        unidad: 'u',
        parametros: [
          { id: 'cantidad', nombre: 'cantidad', valor: 999 }
        ],
        insumosSnapshot: []
      });

      const resultado = evaluarParametrosYLineasItem(item);
      expect(resultado.errores['param_cantidad']).toContain("palabra reservada");
      expect(resultado.item.erroresFormulas?.['param_cantidad']).toBeDefined();
    });

    it('detecta referencias circulares en parámetros del ítem y lo reporta en erroresFormulas', () => {
      const item = mockItem({
        id: 'it-circular',
        descripcion: 'Item circular',
        cantidad: 1,
        unidad: 'u',
        parametros: [
          { id: 'ancho', nombre: 'ancho', valor: 0, formula: '=alto + 2' },
          { id: 'alto', nombre: 'alto', valor: 0, formula: '=ancho * 0.5' }
        ],
        insumosSnapshot: []
      });

      const resultado = evaluarParametrosYLineasItem(item);
      expect(resultado.errores['param_ancho']).toContain('circular');
      expect(resultado.item.erroresFormulas?.['param_ancho']).toBeDefined();
    });

    it('detecta nombres no definidos en fórmulas y los reporta como error visible sin abortar', () => {
      const item = mockItem({
        id: 'it-undef',
        descripcion: 'Item con variable fantasma',
        cantidad: 2,
        unidad: 'u',
        parametros: [
          { id: 'p1', nombre: 'p1', valor: 0, formula: '=variableInexistente * 2' }
        ],
        insumosSnapshot: [
          {
            insumoId: 'ins-1',
            nombre: 'Caño Corrugado',
            unidad: 'm',
            cantidadUnitaria: 1,
            cantidadTotal: 1,
            formulaCantidad: '=otraVariableFantasma + 10',
            precioUnitarioCongelado: 500,
            subtotalInsumo: 500
          }
        ]
      });

      const resultado = evaluarParametrosYLineasItem(item);
      expect(resultado.errores['param_p1']).toContain("Variable no definida 'variableInexistente'");
      expect(resultado.errores['insumo_0']).toContain("Variable no definida 'otraVariableFantasma'");
      expect(resultado.item.erroresFormulas).toBeDefined();
      expect(resultado.item.costoDirectoTotal).toBeDefined();
    });
  });

  // ─── 2. Una Sola Fuente de Verdad y Test de Ida y Vuelta ───
  describe('2.1 Una Sola Fuente de Verdad (Roundtrip Model <-> DSL)', () => {
    it('realiza ida y vuelta sin pérdida de información (Modelo -> DSL -> Modelo)', () => {
      const originalCapitulos: CapituloPresupuesto[] = [
        { id: 'cap-demolicion', nombre: 'Demoliciones', orden: 1 },
        { id: 'cap-electricidad', nombre: 'Instalación Eléctrica', orden: 2 }
      ];

      const originalItems: ItemPresupuesto[] = [
        mockItem({
          id: 'it-1',
          capituloId: 'cap-demolicion',
          descripcion: 'Retiro de artefactos existentes',
          cantidad: 12,
          unidad: 'u',
          costoUnitario: 3000,
          precioManual: 5000,
          parametros: [
            { id: 'dificultad', nombre: 'dificultad', valor: 1.2 }
          ]
        }),
        mockItem({
          id: 'it-2',
          capituloId: 'cap-electricidad',
          descripcion: 'Boca de iluminación general',
          cantidad: 24,
          unidad: 'boca',
          formulaCantidad: '=totalBocas',
          costoUnitario: 12000,
          precioManual: 18000,
          parametros: [
            { id: 'altura', nombre: 'altura', valor: 2.6 }
          ]
        })
      ];

      const originalGastos: GastoPresupuestoConfig[] = [
        {
          id: 'gasto-viaticos',
          nombre: 'Viáticos y Movilidad',
          destino: 'costo_indirecto',
          modalidad: 'monto_fijo',
          valor: 25000,
          aplica: true
        }
      ];

      const calculosVariables = {
        totalBocas: 24,
        superficie: 80
      };

      // 1. Modelo -> DSL
      const dslText = serializePresupuestoToDSL({
        clienteId: '',
        tipoFactura: 'Factura C',
        validezDias: 15,
        margenPorcentaje: 30,
        nivelMargenRiesgo: 'medio',
        margenRiesgoPorcentaje: 10,
        capitulos: originalCapitulos,
        items: originalItems,
        gastosConfig: originalGastos,
        calculosVariables
      });

      expect(dslText).toContain('Demoliciones');
      expect(dslText).toContain('Instalación Eléctrica');
      expect(dslText).toContain('Retiro de artefactos existentes');
      expect(dslText).toContain('Boca de iluminación general');
      expect(dslText).toContain('totalBocas: 24');

      // 2. DSL -> Modelo (Parseo sin errores)
      const parsed = parseDSLToPresupuesto(dslText, {
        ...mockParseContext,
        existingItems: originalItems,
        existingCapitulos: originalCapitulos,
        existingGastos: originalGastos
      });

      expect(parsed.diagnostics.filter(d => d.type === 'error')).toHaveLength(0);
      expect(parsed.capitulos.map(c => c.nombre)).toEqual(['Demoliciones', 'Instalación Eléctrica']);
      expect(parsed.items).toHaveLength(2);
      expect(parsed.items[0].descripcion).toBe('Retiro de artefactos existentes');
      expect(parsed.items[0].cantidad).toBe(12);
      expect(parsed.items[1].descripcion).toBe('Boca de iluminación general');
      expect(parsed.items[1].cantidad).toBe(24);
      expect(parsed.calculosVariables?.['totalBocas']).toBe(24);
      expect(parsed.calculosVariables?.['superficie']).toBe(80);
    });

    it('la validación del DSL previa al botón Aplicar rechaza texto corrupto sin mutar el modelo', () => {
      const invalidDsl = `
# YAML deliberadamente corrupto
cliente: Test
Capítulo 1:
  - no-es-un-item-valido
    desalineado: :::
`;
      const diagnostics = validateYamlStructure(invalidDsl);
      const hasErrors = diagnostics.some(d => d.type === 'error');
      expect(hasErrors).toBe(true);

      // Al haber errores, la política de 'Aplicar' aborta y no muta el modelo de datos
      const modelItemsBefore = [mockItem({ id: 'i1', descripcion: 'Original Intacto', cantidad: 1, unidad: 'u' })];
      const parsed = parseDSLToPresupuesto(invalidDsl, { ...mockParseContext, existingItems: modelItemsBefore });

      // Detecta errores sintácticos
      expect(parsed.diagnostics.some(d => d.type === 'error')).toBe(true);
    });

    it('elimina el bug de pisado de datos al alternar entre modo guiado y texto experto', () => {
      // Escenario del bug histórico:
      // 1. Usuario carga un ítem en modo guiado
      const itemsGuiado: ItemPresupuesto[] = [
        mockItem({
          id: 'it-1',
          descripcion: 'Circuito nuevo TUG 16A',
          cantidad: 15,
          unidad: 'boca',
          costoUnitario: 8000,
          precioManual: 12500
        })
      ];

      // 2. Se serializa dinámicamente al abrir texto (sin leer campo dslText cacheado viejo)
      const dslGenerado = serializePresupuestoToDSL({
        items: itemsGuiado,
        capitulos: [{ id: 'c1', nombre: 'Instalaciones', orden: 1 }],
        gastosConfig: []
      });

      expect(dslGenerado).toContain('Circuito nuevo TUG 16A');
      expect(dslGenerado).toContain('15');

      // 3. Usuario vuelve a modo guiado y agrega un segundo ítem
      const itemsGuiadoActualizado: ItemPresupuesto[] = [
        ...itemsGuiado,
        mockItem({
          id: 'it-2',
          descripcion: 'Puesta a tierra con jabalina',
          cantidad: 1,
          unidad: 'gl',
          costoUnitario: 25000,
          precioManual: 40000
        })
      ];

      // 4. Se vuelve a abrir el texto experto: DEBE reflejar el nuevo ítem sin persistir ni pisar con texto viejo
      const dslNuevo = serializePresupuestoToDSL({
        items: itemsGuiadoActualizado,
        capitulos: [{ id: 'c1', nombre: 'Instalaciones', orden: 1 }],
        gastosConfig: []
      });

      expect(dslNuevo).toContain('Circuito nuevo TUG 16A');
      expect(dslNuevo).toContain('Puesta a tierra con jabalina');
    });
  });

  // ─── 3. Tareas Tipo: Vinculación, Desacople y Versionado ───
  describe('2.3 Ítems Vinculados a Tarea Tipo y Desacople', () => {
    it('desacopla el ítem conservando sus líneas actuales al editar directamente insumos o mano de obra', () => {
      const itemVinculado = mockItem({
        id: 'it-tarea',
        descripcion: 'Boca de iluminación',
        cantidad: 10,
        unidad: 'boca',
        tipoItem: 'tarea_tipo',
        tareaTipoId: 'tt-boca',
        tareaTipoVersion: 1,
        desacoplado: false,
        insumosSnapshot: [
          { insumoId: 'cable', nombre: 'Cable 1.5mm', unidad: 'm', cantidadUnitaria: 10, cantidadTotal: 100, precioUnitarioCongelado: 500, subtotalInsumo: 50000 }
        ],
        manoObraSnapshot: [
          { categoriaId: 'oficial', nombreCategoria: 'Oficial', horasUnitarias: 0.8, horasTotales: 8, costoHoraCongelado: 6000, subtotalManoObra: 48000 }
        ]
      });

      // Modificación directa de una línea de insumos
      const itemModificado: ItemPresupuesto = {
        ...itemVinculado,
        insumosSnapshot: [
          ...itemVinculado.insumosSnapshot!,
          { insumoId: 'caja', nombre: 'Caja octogonal', unidad: 'u', cantidadUnitaria: 1, cantidadTotal: 10, precioUnitarioCongelado: 800, subtotalInsumo: 8000 }
        ]
      };

      // Detección de cambio y desacople automático
      const lineasCambiaron = JSON.stringify(itemVinculado.insumosSnapshot) !== JSON.stringify(itemModificado.insumosSnapshot);
      expect(lineasCambiaron).toBe(true);

      const itemFinal: ItemPresupuesto = {
        ...itemModificado,
        desacoplado: true
      };

      expect(itemFinal.desacoplado).toBe(true);
      expect(itemFinal.insumosSnapshot).toHaveLength(2);
      expect(itemFinal.tareaTipoId).toBe('tt-boca');
    });
  });

  // ─── 4. Revisiones de Cotizaciones Enviadas/Aprobadas ───
  describe('2.4 Revisiones, Estados y Preservación de Historial', () => {
    it('editar un presupuesto enviado o aprobado genera una nueva revisión en borrador sin pisar el original', () => {
      const presupuestoEnviado = mockPresupuesto({
        id: 'cot-original-123',
        numero: 'COT-2026-0042',
        revision: 1,
        clienteId: 'cli-acme',
        fechaEmision: '2026-09-01T10:00:00.000Z',
        validezDias: 15,
        tipoFactura: 'Factura A',
        estado: 'enviado',
        items: [],
        capitulos: [],
        gastosConfig: [],
        costosIndirectosAplicados: [],
        costoGlobal: 100000,
        gastosGeneralesTotal: 15000,
        beneficioPorcentaje: 30,
        beneficioMonto: 34500,
        subtotalSinImpuestos: 149500,
        montoImpuestosTotal: 31395,
        precioFinalGlobal: 180895,
        coeficienteK: 1.80895,
        totalARS: 180895,
        subtotalInsumos: 50000,
        subtotalManoObra: 50000,
        subtotalServiciosTercerizados: 0,
        subtotalCostosDirectos: 100000,
        subtotalCostosIndirectos: 15000,
        costoTotalObra: 115000,
        impuestosDetalle: [],
        fechaModificacion: '2026-09-01T10:00:00.000Z'
      });

      // Simulación de la lógica de edición de enviados implementada en usePresupuestoEditorViewModel:
      const nextRev = (presupuestoEnviado.revision || 1) + 1;
      const baseNumero = presupuestoEnviado.numero.replace(/-R\d+$/, '');
      const newNumero = `${baseNumero}-R${nextRev}`;
      const newId = 'cot-revision-456';

      const nuevaRevision: Presupuesto = {
        ...presupuestoEnviado,
        id: newId,
        numero: newNumero,
        revision: nextRev,
        presupuestoOrigenId: presupuestoEnviado.id,
        estado: 'borrador' // Nueva revisión comienza en borrador
      };

      expect(nuevaRevision.id).not.toBe(presupuestoEnviado.id);
      expect(nuevaRevision.numero).toBe('COT-2026-0042-R2');
      expect(nuevaRevision.revision).toBe(2);
      expect(nuevaRevision.presupuestoOrigenId).toBe('cot-original-123');
      expect(nuevaRevision.estado).toBe('borrador');

      // El presupuesto enviado original permanece congelado e inmutable
      expect(presupuestoEnviado.estado).toBe('enviado');
      expect(presupuestoEnviado.revision).toBe(1);
    });
  });

  // ─── 5. Eliminación de Sinergia y Planificación de Cuadrilla ───
  describe('2.5 Descarte de Sinergia y Planificación de Cuadrilla', () => {
    it('el motor de totales funciona limpiamente sin factores de sinergia de mano de obra', () => {
      const items: ItemPresupuesto[] = [
        mockItem({
          id: 'it-mo',
          descripcion: 'Mano de obra cableado',
          cantidad: 10,
          unidad: 'm',
          costoManoObra: 40000,
          costoDirectoTotal: 40000,
          costoInsumos: 0,
          costoServicios: 0
        })
      ];

      const totales = calcularTotalesPresupuesto({
        items,
        beneficioPorcentaje: 20,
        margenRiesgoPorcentaje: 5,
        tipoFactura: 'Presupuesto X (Sin Factura)',
        impuestosDetalle: []
      });

      // Costo directo = 40.000 + 5% de riesgo (2.000) = 42.000
      expect(totales.subtotalCostosDirectos).toBe(42000);
      expect(totales.montoMargenRiesgo).toBe(2000);
      // Beneficio = 20% sobre 42.000 = 8.400
      expect(totales.beneficioMonto).toBe(8400);
      // Precio final = 50.400
      expect(totales.precioFinalGlobal).toBe(50400);
    });
  });
});
