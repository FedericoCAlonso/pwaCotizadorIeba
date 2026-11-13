import {
  AjustesInstanciaTrabajoTipo,
  AppConfig,
  CapituloPresupuesto,
  CategoriaManoDeObra,
  CostoIndirecto,
  EstadoValorizacion,
  GastoPresupuestoConfig,
  ImpuestoItem,
  Insumo,
  InsumoSnapshot,
  ItemPresupuesto,
  ManoObraSnapshot,
  Material,
  NotaInterna,
  Oferta,
  ParametroItem,
  ParametroTrabajoTipo,
  Presupuesto,
  Producto,
  TareaTipo,
  TipoFactura,
  VariableCotizacion
} from './types';
import {
  calcularConsumosTareaTipo,
  calcularTotalesPresupuesto,
  generarImpuestosPorDefecto,
  safeNum,
  TotalesPresupuestoResultado
} from './calculations';
import { evaluateCondition, evaluateMathExpression } from './mathEvaluator';
import { buildInsumosMap } from './materialMatching';
import {
  detectarCiclosComposicionTareaTipo,
  evaluarAlcanceYAdvertencias,
  evaluarVariablesCotizacion,
  PRESUPUESTO_MAXIMO_ADVERTENCIAS_VISIBLES,
  ResultadoAlcanceYAdvertencias,
  slugifyIdentificador
} from './notebookDomain';
import {
  NotebookBlock,
  NotebookCapituloBlock,
  NotebookErrorCode,
  NotebookItemLibreBlock,
  NotebookItemLinea,
  NotebookNotaInternaBlock,
  NotebookParseContext,
  NotebookParseResult,
  NotebookSupuestoBlock,
  NotebookTareaTipoBlock,
  NotebookVariableBlock,
  parse
} from './notebookParser';
import { TERMINOLOGY } from '../config/terminology';

// ─── Contexto y Tipos de Documento ────────────────────────────────────────────

export type ModoPasadaCotizacion = 'esqueleto' | 'valorizacion';

export interface NotebookDocumentContext {
  config: AppConfig;
  tareasTipo: TareaTipo[];
  materiales: Material[];
  productos?: Producto[];
  ofertas?: Oferta[];
  legacyInsumos?: Insumo[];
  manoObra: CategoriaManoDeObra[];
  costosIndirectosCatalog?: CostoIndirecto[];
  unidadesValidas?: string[];
}

export interface NotebookErrorDocumento {
  linea: number;
  columna: number;
  longitud: number;
  codigo: NotebookErrorCode | 'ciclo_variable' | 'ciclo_composicion' | 'exceso_advertencias';
  mensaje: string;
  textoLinea?: string;
  candidatos?: string[];
}

export interface SubtotalBloqueInfo {
  itemId: string;
  estadoValorizacion: EstadoValorizacion;
  costoDirecto: number;
  precioVenta: number;
}

export interface SugerenciaConversionTareaTipo {
  descripcionNormalizada: string;
  descripcionEjemplo: string;
  cantidadRepeticiones: number;
  itemIds: string[];
  slugSugerido: string;
}

export interface ResultadoAplicacionNotebook {
  presupuesto: Presupuesto;
  totales: TotalesPresupuestoResultado;
  alcanceYAdvertencias: ResultadoAlcanceYAdvertencias;
  erroresVariables: NotebookErrorDocumento[];
  erroresComposicion: NotebookErrorDocumento[];
  subtotalesPorBloque: Record<number, SubtotalBloqueInfo>;
  subtotalesPorItemId: Record<string, SubtotalBloqueInfo>;
  blockLineNumbers: number[];
  tareasSinValorizar: ItemPresupuesto[];
  esTotalParcial: boolean;
  sugerenciasConversion: SugerenciaConversionTareaTipo[];
}

export interface ApplyNotebookOptions {
  modoPasada?: ModoPasadaCotizacion;
  valorizarItemIds?: string[];
  forzarValorizarTodos?: boolean;
  blockLineNumbers?: number[];
}

export type AutocompleteKind =
  | 'comando'
  | 'tarea_tipo'
  | 'parametro'
  | 'ajuste_quitar'
  | 'ajuste_agregar'
  | 'material'
  | 'producto'
  | 'mano_obra'
  | 'supuesto_clave'
  | 'supuesto_estado'
  | 'variable';

export interface NotebookAutocompleteSuggestion {
  id: string;
  kind: AutocompleteKind;
  label: string;
  detail?: string;
  insertText: string;
  replaceStartCol: number;
  replaceEndCol: number;
  /** Selección relativa dentro de `insertText` (base 0) tras aceptar la sugerencia. */
  selectionStartOffset?: number;
  selectionEndOffset?: number;
  /** Si es true, inserta en una nueva sub-línea indentada debajo de la línea actual. */
  insertOnNewIndentedLine?: boolean;
  ghostText?: string;
  frecuenciaUso: number;
  score: number;
}

export interface AutocompleteOptions {
  forceOpen?: boolean;
}

export interface NotebookAutocompleteResult {
  isOpen: boolean;
  suggestions: NotebookAutocompleteSuggestion[];
  ghostText: string;
  kind?: AutocompleteKind;
}

export type CommandPaletteCategory = 'estructura' | 'trabajo_tipo' | 'flujo' | 'documento';

export interface NotebookCommandPaletteItem {
  id: string;
  label: string;
  description: string;
  category: CommandPaletteCategory;
  shortcut?: string;
  keywords: string[];
  insertLine?: string;
  actionType:
    | 'insert_line'
    | 'next_unvalorized'
    | 'valorize_current'
    | 'valorize_all'
    | 'toggle_pass_mode'
    | 'toggle_preview'
    | 'toggle_shortcuts_help'
    | 'undo'
    | 'redo'
    | 'open_suggestions'
    | 'save';
}

export interface TabJumpResult {
  handled: boolean;
  linea: number;
  columna: number;
  selectionStartCol?: number;
  selectionEndCol?: number;
  paramId?: string;
}

const MAX_COMPOSICION_DEPTH = 4;

// ─── Helpers internos ─────────────────────────────────────────────────────────

function roundMoney(n: number): number {
  return Math.round((safeNum(n) + Number.EPSILON) * 100) / 100;
}

function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Calcula puntaje fuzzy simple: coincidencia exacta > prefijo > subcadena > subsecuencia.
 * Devuelve null si no hay coincidencia.
 */
export function fuzzyMatchScore(query: string, target: string): number | null {
  const q = normalizeSearch(query);
  const t = normalizeSearch(target);
  if (!q) return 10;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - (t.length - q.length);
  const idx = t.indexOf(q);
  if (idx >= 0) return 600 - idx * 2 - (t.length - q.length);

  let qi = 0;
  let gapPenalty = 0;
  let lastMatch = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (lastMatch >= 0) {
        gapPenalty += ti - lastMatch - 1;
      }
      lastMatch = ti;
      qi++;
    }
  }
  if (qi === q.length) {
    return Math.max(50, 350 - gapPenalty * 5 - (t.length - q.length));
  }
  return null;
}

export function buildParseContext(ctx: NotebookDocumentContext): NotebookParseContext {
  return {
    tareasTipo: ctx.tareasTipo,
    materiales: ctx.materiales,
    productos: ctx.productos,
    manoObra: ctx.manoObra,
    unidadesValidas: ctx.unidadesValidas
  };
}

function buildMaps(ctx: NotebookDocumentContext): {
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  tareasMap: Map<string, TareaTipo>;
} {
  const insumosMap = buildInsumosMap(
    ctx.legacyInsumos || [],
    ctx.materiales,
    ctx.productos || [],
    ctx.ofertas || []
  );
  const manoObraMap = new Map<string, CategoriaManoDeObra>();
  for (const mo of ctx.manoObra) {
    manoObraMap.set(mo.id, mo);
  }
  const tareasMap = new Map<string, TareaTipo>();
  for (const t of ctx.tareasTipo) {
    tareasMap.set(t.id, t);
  }
  return { insumosMap, manoObraMap, tareasMap };
}

function resolveMaterialName(insumosMap: Map<string, Insumo>, materialId: string): string {
  return insumosMap.get(materialId)?.nombre || materialId;
}

function resolveManoObraName(manoObraMap: Map<string, CategoriaManoDeObra>, catId: string): string {
  return manoObraMap.get(catId)?.nombre || catId;
}

function calcularCostoDirectoPorSnapshots(
  insumos: InsumoSnapshot[],
  mo: ManoObraSnapshot[],
  servicios: number,
  gastoFijo = 0
): {
  costoInsumos: number;
  costoManoObra: number;
  costoDirectoTotal: number;
} {
  const costoInsumos = roundMoney(insumos.reduce((acc, s) => acc + safeNum(s.subtotalInsumo), 0));
  const costoManoObra = roundMoney(mo.reduce((acc, s) => acc + safeNum(s.subtotalManoObra), 0));
  const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + safeNum(servicios) + safeNum(gastoFijo));
  return { costoInsumos, costoManoObra, costoDirectoTotal };
}

/**
 * Calcula los números de línea (base 1) correspondientes a cada bloque en `parseResult.bloques`
 * sin modificar el contrato puro de `notebookParser.ts`.
 */
export function computeBlockStartLines(
  texto: string,
  bloques: NotebookBlock[],
  errores: Array<{ linea: number }> = []
): number[] {
  const errorLines = new Set(errores.map(e => e.linea));
  const rawLines = texto.split(/\r?\n/);
  const candidateLines: Array<{ lineNum: number; kind: NotebookBlock['tipo'] }> = [];

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    if (errorLines.has(lineNum)) continue;
    const raw = rawLines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('<!--')) continue;

    // Las líneas indentadas son sub-líneas de un ítem contenedor (no inician bloque propio)
    if (/^[ \t]+/.test(raw)) continue;

    if (trimmed.startsWith('#')) {
      candidateLines.push({ lineNum, kind: 'capitulo' });
    } else if (/^\/tt\b/i.test(trimmed)) {
      candidateLines.push({ lineNum, kind: 'tarea_tipo' });
    } else if (/^(tarea|item):/i.test(trimmed)) {
      candidateLines.push({ lineNum, kind: 'item_libre' });
    } else if (/^supuesto:/i.test(trimmed)) {
      candidateLines.push({ lineNum, kind: 'supuesto' });
    } else if (/^nota:/i.test(trimmed)) {
      candidateLines.push({ lineNum, kind: 'nota_interna' });
    } else if (/^[a-zA-Z_]\w*\s*=/.test(trimmed)) {
      candidateLines.push({ lineNum, kind: 'variable' });
    }
  }

  let cursorCand = 0;
  return bloques.map((b, idx) => {
    while (cursorCand < candidateLines.length) {
      const cand = candidateLines[cursorCand];
      cursorCand++;
      if (cand.kind === b.tipo) {
        return cand.lineNum;
      }
    }
    return idx + 1;
  });
}

// ─── Composición y Ajustes de Trabajos Tipo ──────────────────────────────────

interface ConsumoCompuestoResultado {
  insumosSnapshot: InsumoSnapshot[];
  manoObraSnapshot: ManoObraSnapshot[];
  costoServiciosTotal: number;
  costoFijoOperativo: number;
  valoresParametros: Record<string, number>;
  clausulaExclusiones?: string;
}

function combinarConsumosTareaCompuesta(
  tarea: TareaTipo,
  parametrosOverrides: Record<string, number>,
  scopeVariables: Record<string, number>,
  insumosMap: Map<string, Insumo>,
  manoObraMap: Map<string, CategoriaManoDeObra>,
  tareasMap: Map<string, TareaTipo>,
  options: { tipoFactura?: TipoFactura; alicuotaIVADefault?: number },
  depth = 0,
  visited = new Set<string>()
): ConsumoCompuestoResultado {
  const nextVisited = new Set(visited);
  nextVisited.add(tarea.id);

  const scopeCombinado: Record<string, number> = {
    ...scopeVariables,
    ...parametrosOverrides
  };

  const base = calcularConsumosTareaTipo(
    tarea,
    scopeCombinado,
    insumosMap,
    manoObraMap,
    options
  );

  const insumos = [...base.insumosSnapshot];
  const manoObra = [...base.manoObraSnapshot];
  let costoServiciosTotal = safeNum(base.costoServiciosTotal);
  let costoFijoOperativo = safeNum(base.costoFijoOperativo);

  if (depth < MAX_COMPOSICION_DEPTH && Array.isArray(tarea.subTrabajos)) {
    const scopeConLocales = { ...scopeCombinado, ...base.scope };
    for (const sub of tarea.subTrabajos) {
      if (nextVisited.has(sub.tareaTipoId)) continue;
      if (sub.condicion && sub.condicion.trim() && !evaluateCondition(sub.condicion, scopeConLocales)) {
        continue;
      }
      const subTarea = tareasMap.get(sub.tareaTipoId);
      if (!subTarea) continue;

      let factor = sub.cantidadDefault !== undefined ? safeNum(sub.cantidadDefault) : 1;
      if (sub.cantidadFormula && sub.cantidadFormula.trim()) {
        const resF = evaluateMathExpression(sub.cantidadFormula, scopeConLocales);
        if (resF.isValid && resF.value !== null) {
          factor = resF.value;
        }
      }
      if (factor <= 0) continue;

      const subParams: Record<string, number> = {};
      if (sub.parametrosOverrides) {
        for (const [k, rawVal] of Object.entries(sub.parametrosOverrides)) {
          if (typeof rawVal === 'number') {
            subParams[k] = rawVal;
          } else {
            const evalOverride = evaluateMathExpression(String(rawVal), scopeConLocales);
            if (evalOverride.isValid && evalOverride.value !== null) {
              subParams[k] = evalOverride.value;
            }
          }
        }
      }

      const subRes = combinarConsumosTareaCompuesta(
        subTarea,
        subParams,
        scopeCombinado,
        insumosMap,
        manoObraMap,
        tareasMap,
        options,
        depth + 1,
        nextVisited
      );

      for (const s of subRes.insumosSnapshot) {
        insumos.push({
          ...s,
          cantidadUnitaria: safeNum(s.cantidadUnitaria ?? s.cantidadTotal) * factor,
          cantidadTotal: safeNum(s.cantidadTotal) * factor,
          subtotalInsumo: roundMoney(s.subtotalInsumo * factor),
          subtotalInsumoFinal: s.subtotalInsumoFinal !== undefined
            ? roundMoney(s.subtotalInsumoFinal * factor)
            : undefined
        });
      }
      for (const m of subRes.manoObraSnapshot) {
        manoObra.push({
          ...m,
          horasUnitarias: safeNum(m.horasUnitarias ?? m.horasTotales) * factor,
          horasTotales: safeNum(m.horasTotales) * factor,
          subtotalManoObra: roundMoney(m.subtotalManoObra * factor)
        });
      }
      costoServiciosTotal = roundMoney(costoServiciosTotal + subRes.costoServiciosTotal * factor);
      costoFijoOperativo = roundMoney(costoFijoOperativo + subRes.costoFijoOperativo * factor);
    }
  }

  return {
    insumosSnapshot: insumos,
    manoObraSnapshot: manoObra,
    costoServiciosTotal,
    costoFijoOperativo,
    valoresParametros: base.valoresParametros,
    clausulaExclusiones: base.clausulaExclusiones
  };
}

function evalScalarOrFormula(
  num: number | undefined,
  formula: string | undefined,
  scope: Record<string, number>,
  fallback = 1
): number {
  if (formula && formula.trim()) {
    const res = evaluateMathExpression(formula, scope);
    if (res.isValid && res.value !== null && Number.isFinite(res.value)) {
      return Math.max(0, res.value);
    }
  }
  return num !== undefined ? Math.max(0, safeNum(num)) : fallback;
}

function construirSnapshotsDesdeItemLineas(
  lineas: NotebookItemLinea[],
  scope: Record<string, number>,
  insumosMap: Map<string, Insumo>,
  manoObraMap: Map<string, CategoriaManoDeObra>,
  tipoFactura: TipoFactura | undefined,
  aliDefault: number
): {
  insumosSnapshot: InsumoSnapshot[];
  manoObraSnapshot: ManoObraSnapshot[];
  costoServiciosTotal: number;
} {
  const isFacturaC_or_X =
    !tipoFactura || tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
  const insumosSnapshot: InsumoSnapshot[] = [];
  const manoObraSnapshot: ManoObraSnapshot[] = [];
  let costoServiciosTotal = 0;

  for (const line of lineas) {
    if (line.tipo === 'material') {
      const mat = line.materialId ? insumosMap.get(line.materialId) : undefined;
      const ali = mat?.alicuotaIVA ?? aliDefault;
      const precioNeto = roundMoney(safeNum(mat?.precioActual));
      const precioFinal = roundMoney(precioNeto * (1 + ali / 100));
      const unitComputable = isFacturaC_or_X ? precioFinal : precioNeto;
      const cant = evalScalarOrFormula(line.cantidad, line.formulaCantidad, scope, 1);
      const subtotal = roundMoney(unitComputable * cant);
      insumosSnapshot.push({
        materialId: line.materialId || mat?.id,
        insumoId: line.materialId || mat?.id || slugifyIdentificador(line.referencia),
        nombre: mat?.nombre || line.referencia,
        marca: mat?.marca,
        productoId: line.productoId || mat?.productoId,
        unidad: line.unidad || mat?.unidad || 'u',
        cantidadUnitaria: cant,
        cantidadTotal: cant,
        precioUnitarioCongelado: precioNeto,
        alicuotaIVA: ali,
        precioFinalUnitarioCongelado: precioFinal,
        subtotalInsumo: subtotal,
        subtotalInsumoFinal: roundMoney(precioFinal * cant),
        esAdHoc: !line.materialId,
        requiereCotizacionDirecta: mat?.requiereCotizacionDirecta ?? false
      });
    } else if (line.tipo === 'mano_obra') {
      const cat = line.categoriaId ? manoObraMap.get(line.categoriaId) : undefined;
      const costoHora = roundMoney(safeNum(cat?.costoHora));
      const horas = evalScalarOrFormula(line.horas, line.formulaHoras, scope, 1);
      manoObraSnapshot.push({
        categoriaId: line.categoriaId || cat?.id || slugifyIdentificador(line.referencia),
        nombreCategoria: cat?.nombre || line.referencia,
        horasUnitarias: horas,
        horasTotales: horas,
        costoHoraCongelado: costoHora,
        subtotalManoObra: roundMoney(costoHora * horas)
      });
    } else if (line.tipo === 'servicio') {
      const cant = evalScalarOrFormula(line.cantidad, line.formulaCantidad, scope, 1);
      const unitPrecio = roundMoney(evalScalarOrFormula(line.costoUnitario, line.formulaCosto, scope, 0));
      costoServiciosTotal = roundMoney(costoServiciosTotal + unitPrecio * cant);
    }
  }

  return { insumosSnapshot, manoObraSnapshot, costoServiciosTotal };
}

function aplicarAjustesYLineasInstancia(
  consumo: ConsumoCompuestoResultado,
  block: NotebookTareaTipoBlock,
  scope: Record<string, number>,
  insumosMap: Map<string, Insumo>,
  manoObraMap: Map<string, CategoriaManoDeObra>,
  tipoFactura: TipoFactura | undefined,
  aliDefault: number
): {
  insumosSnapshot: InsumoSnapshot[];
  manoObraSnapshot: ManoObraSnapshot[];
  costoServiciosTotal: number;
  ajustesInstancia?: AjustesInstanciaTrabajoTipo;
} {
  let insumosSnapshot = [...consumo.insumosSnapshot];
  let manoObraSnapshot = [...consumo.manoObraSnapshot];
  let costoServiciosTotal = consumo.costoServiciosTotal;

  const quitadosSet = new Set(block.quitados.map(q => slugifyIdentificador(q)));
  if (quitadosSet.size > 0) {
    insumosSnapshot = insumosSnapshot.filter(s => {
      const slugNombre = slugifyIdentificador(s.nombre);
      const slugMat = s.materialId ? slugifyIdentificador(s.materialId) : '';
      return !quitadosSet.has(slugNombre) && (!slugMat || !quitadosSet.has(slugMat));
    });
    manoObraSnapshot = manoObraSnapshot.filter(m => {
      const slugNombre = slugifyIdentificador(m.nombreCategoria);
      const slugCat = slugifyIdentificador(m.categoriaId);
      return !quitadosSet.has(slugNombre) && !quitadosSet.has(slugCat);
    });
  }

  const extraLineas: NotebookItemLinea[] = [
    ...block.agregados.map<NotebookItemLinea>(ag => ({
      tipo: 'material',
      referencia: ag.referencia,
      materialId: ag.materialId,
      productoId: ag.productoId,
      productoReferencia: ag.productoReferencia,
      cantidad: ag.cantidad,
      formulaCantidad: ag.formulaCantidad,
      unidad: ag.unidad
    })),
    ...block.lineas
  ];

  if (extraLineas.length > 0) {
    const extra = construirSnapshotsDesdeItemLineas(
      extraLineas,
      scope,
      insumosMap,
      manoObraMap,
      tipoFactura,
      aliDefault
    );
    insumosSnapshot = [...insumosSnapshot, ...extra.insumosSnapshot];
    manoObraSnapshot = [...manoObraSnapshot, ...extra.manoObraSnapshot];
    costoServiciosTotal = roundMoney(costoServiciosTotal + extra.costoServiciosTotal);
  }

  const ajustesInstancia: AjustesInstanciaTrabajoTipo | undefined =
    block.quitados.length > 0 || block.agregados.length > 0
      ? {
          quitados: [...block.quitados],
          agregados: block.agregados.map((ag, idx) => ({
            id: `aj-${idx + 1}-${slugifyIdentificador(ag.referencia)}`,
            tipo: 'material',
            referenciaId: ag.materialId,
            descripcion: ag.referencia,
            cantidad: evalScalarOrFormula(ag.cantidad, ag.formulaCantidad, scope, 1),
            formulaCantidad: ag.formulaCantidad,
            unidad: ag.unidad
          }))
        }
      : undefined;

  return { insumosSnapshot, manoObraSnapshot, costoServiciosTotal, ajustesInstancia };
}

// ─── Proyección Presupuesto -> Bloques de Notebook ────────────────────────────

function itemPresupuestoToNotebookBlock(
  item: ItemPresupuesto,
  insumosMap: Map<string, Insumo>,
  manoObraMap: Map<string, CategoriaManoDeObra>,
  tareasMap: Map<string, TareaTipo>
): NotebookBlock {
  if (item.tareaTipoId && tareasMap.has(item.tareaTipoId)) {
    const tarea = tareasMap.get(item.tareaTipoId)!;
    const overrides: Record<string, number | string> = {};
    if (item.overridesParametros !== undefined) {
      Object.assign(overrides, item.overridesParametros);
    } else if (item.valoresParametros && Object.keys(item.valoresParametros).length > 0) {
      for (const p of tarea.parametros || []) {
        if (
          p.id !== 'cantidad' &&
          item.valoresParametros[p.id] !== undefined &&
          item.valoresParametros[p.id] !== p.valorDefault
        ) {
          overrides[p.id] = item.valoresParametros[p.id];
        }
      }
    }

    const block: NotebookTareaTipoBlock = {
      tipo: 'tarea_tipo',
      referencia: tarea.slug || slugifyIdentificador(tarea.nombre),
      tareaTipoId: tarea.id,
      cantidad: safeNum(item.cantidad) > 1 && overrides['cantidad'] === undefined ? item.cantidad : undefined,
      overridesParametros: overrides,
      quitados: [...(item.ajustesInstancia?.quitados || [])],
      agregados: (item.ajustesInstancia?.agregados || []).map(ag => ({
        referencia: ag.descripcion,
        materialId: ag.referenciaId,
        cantidad: ag.cantidad,
        formulaCantidad: ag.formulaCantidad,
        unidad: ag.unidad
      })),
      lineas: []
    };
    return block;
  }

  const lineas: NotebookItemLinea[] = [];
  for (const ins of item.insumosSnapshot || []) {
    lineas.push({
      tipo: 'material',
      materialId: ins.materialId || ins.insumoId,
      productoId: ins.productoId,
      referencia: ins.materialId ? resolveMaterialName(insumosMap, ins.materialId) : ins.nombre,
      cantidad: safeNum(ins.cantidadTotal || ins.cantidadUnitaria || 1),
      unidad: ins.unidad || 'u'
    });
  }
  for (const mo of item.manoObraSnapshot || []) {
    lineas.push({
      tipo: 'mano_obra',
      categoriaId: mo.categoriaId,
      referencia: mo.categoriaId ? resolveManoObraName(manoObraMap, mo.categoriaId) : mo.nombreCategoria,
      horas: safeNum(mo.horasTotales || mo.horasUnitarias || 1),
      unidad: 'hs'
    });
  }
  if (safeNum(item.costoServiciosTercerizados) > 0) {
    lineas.push({
      tipo: 'servicio',
      descripcion: 'Servicio técnico',
      cantidad: 1,
      unidad: 'gl',
      costoUnitario: roundMoney(safeNum(item.costoServiciosTercerizados))
    });
  }

  const esCompacto = lineas.length === 0;
  const parametros: Record<string, number | string> = {};
  for (const p of item.parametros || []) {
    if (p.id !== 'cantidad') parametros[p.id] = p.valor;
  }

  const block: NotebookItemLibreBlock = {
    tipo: 'item_libre',
    modo: esCompacto ? 'item' : 'tarea',
    descripcion: item.descripcion,
    cantidad: safeNum(item.cantidad) > 0 ? item.cantidad : 1,
    formulaCantidad: item.formulaCantidad,
    unidad: item.unidad || 'gl',
    precioUnitario: esCompacto
      ? roundMoney(item.precioManual ?? item.costoDirectoTotal ?? 0)
      : undefined,
    formulaPrecio: item.formulaPrecio,
    parametros,
    lineas
  };
  return block;
}

/**
 * Proyecta un `Presupuesto` (única fuente de verdad en Dexie) a una lista ordenada
 * de `NotebookBlock` lista para `serialize()`.
 */
export function presupuestoToNotebookBlocks(
  presupuesto: Presupuesto,
  ctx: NotebookDocumentContext
): NotebookBlock[] {
  const { insumosMap, manoObraMap, tareasMap } = buildMaps(ctx);
  const blocks: NotebookBlock[] = [];

  // 1. Variables de cotización
  const varsSource: VariableCotizacion[] =
    presupuesto.variablesCotizacion && presupuesto.variablesCotizacion.length > 0
      ? presupuesto.variablesCotizacion
      : Object.entries(presupuesto.calculosVariables || {}).map(([id, val]) => ({
          id,
          expresion: String(val),
          valorEvaluado: typeof val === 'number' ? val : safeNum(parseFloat(String(val)))
        }));

  for (const v of varsSource) {
    const vb: NotebookVariableBlock = {
      tipo: 'variable',
      id: v.id,
      expresion: v.expresion
    };
    blocks.push(vb);
  }

  // 2. Supuestos activos (Record<string, string>)
  for (const [clave, valor] of Object.entries(presupuesto.supuestos || {})) {
    const sb: NotebookSupuestoBlock = {
      tipo: 'supuesto',
      clave,
      valor
    };
    blocks.push(sb);
  }

  // 3. Notas internas
  if (presupuesto.notasInternasLista && presupuesto.notasInternasLista.length > 0) {
    for (const n of presupuesto.notasInternasLista) {
      const nb: NotebookNotaInternaBlock = {
        tipo: 'nota_interna',
        texto: n.texto
      };
      blocks.push(nb);
    }
  } else if (presupuesto.notasInternas && presupuesto.notasInternas.trim()) {
    for (const part of presupuesto.notasInternas.split(/\r?\n/)) {
      if (part.trim()) {
        blocks.push({ tipo: 'nota_interna', texto: part.trim() });
      }
    }
  }

  // 4. Ítems sin capítulo
  const itemsSinCapitulo = (presupuesto.items || []).filter(
    it => !it.capituloId || it.capituloId === 'sin_capitulo'
  );
  for (const it of itemsSinCapitulo) {
    blocks.push(itemPresupuestoToNotebookBlock(it, insumosMap, manoObraMap, tareasMap));
  }

  // 5. Capítulos y sus ítems
  for (const cap of presupuesto.capitulos || []) {
    if (cap.id === 'sin_capitulo') continue;
    const cb: NotebookCapituloBlock = {
      tipo: 'capitulo',
      nombre: cap.nombre
    };
    blocks.push(cb);

    const capItems = (presupuesto.items || []).filter(it => it.capituloId === cap.id);
    for (const it of capItems) {
      blocks.push(itemPresupuestoToNotebookBlock(it, insumosMap, manoObraMap, tareasMap));
    }
  }

  return blocks;
}

// ─── Aplicación Bloques -> Presupuesto (Single Source of Truth) ───────────────

function itemSignature(item: ItemPresupuesto, capituloNombre?: string): string {
  if (item.tareaTipoId) {
    const params = Object.entries(item.overridesParametros || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    const quitados = (item.ajustesInstancia?.quitados || []).join(',');
    const agregados = (item.ajustesInstancia?.agregados || [])
      .map(a => `${a.descripcion}:${a.cantidad ?? a.formulaCantidad ?? 1}${a.unidad}`)
      .join(',');
    return `tt:${item.tareaTipoId}:${capituloNombre || ''}:${params}:${quitados}:${agregados}`;
  }
  return `lib:${capituloNombre || ''}:${normalizeSearch(item.descripcion)}:${item.cantidad}:${item.unidad}:${item.precioManual ?? item.formulaPrecio ?? ''}`;
}

function findMatchingExistingItem(
  existingItems: ItemPresupuesto[],
  usedIds: Set<string>,
  signatureKey: string,
  fallbackDescripcion: string,
  capitulosById: Map<string, CapituloPresupuesto>
): { item?: ItemPresupuesto; signatureMatched: boolean } {
  for (const it of existingItems) {
    if (usedIds.has(it.id)) continue;
    const capName = it.capituloId ? capitulosById.get(it.capituloId)?.nombre : undefined;
    if (itemSignature(it, capName) === signatureKey) {
      return { item: it, signatureMatched: true };
    }
  }

  const byDesc = existingItems.find(
    it => !usedIds.has(it.id) && normalizeSearch(it.descripcion) === normalizeSearch(fallbackDescripcion)
  );
  return { item: byDesc, signatureMatched: false };
}

function signatureForBlock(
  block: NotebookTareaTipoBlock | NotebookItemLibreBlock,
  capituloNombre?: string
): string {
  if (block.tipo === 'tarea_tipo') {
    const params = Object.entries(block.overridesParametros || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    const quitados = block.quitados.join(',');
    const agregados = block.agregados
      .map(a => `${a.referencia}:${a.cantidad ?? a.formulaCantidad ?? 1}${a.unidad}`)
      .join(',');
    return `tt:${block.tareaTipoId || block.referencia}:${capituloNombre || ''}:${params}:${quitados}:${agregados}`;
  }
  return `lib:${capituloNombre || ''}:${normalizeSearch(block.descripcion)}:${block.cantidad ?? block.formulaCantidad ?? 1}:${block.unidad || 'gl'}:${block.precioUnitario ?? block.formulaPrecio ?? ''}`;
}

function evaluateOverridesAgainstScope(
  overrides: Record<string, number | string>,
  scopeVariables: Record<string, number>
): Record<string, number> {
  const resolved: Record<string, number> = {};
  for (const [k, rawVal] of Object.entries(overrides)) {
    if (typeof rawVal === 'number') {
      resolved[k] = rawVal;
    } else {
      const exprRes = evaluateMathExpression(String(rawVal), scopeVariables);
      if (exprRes.isValid && exprRes.value !== null && Number.isFinite(exprRes.value)) {
        resolved[k] = exprRes.value;
      }
    }
  }
  return resolved;
}

function buildNewPresupuestoDefaults(
  config: AppConfig,
  base?: Partial<Presupuesto>
): Presupuesto {
  const now = new Date().toISOString();
  const tipoFactura: TipoFactura =
    base?.tipoFactura || config.tipoFacturaPorDefecto || 'Factura C';
  const aliDefault = config.alicuotaIVAPorDefecto ?? config.porcentajeIVAPorDefecto ?? 21;
  const impuestosDetalle: ImpuestoItem[] =
    base?.impuestosDetalle && base.impuestosDetalle.length > 0
      ? base.impuestosDetalle
      : generarImpuestosPorDefecto(tipoFactura, aliDefault);
  const gastosConfig: GastoPresupuestoConfig[] = base?.gastosConfig || [];

  return {
    id: base?.id || `pres-${Date.now()}`,
    numero:
      base?.numero ||
      `${config.prefijoPresupuesto || 'IEBA-'}${String(config.siguienteNumeroCorrelativo || 1).padStart(4, '0')}`,
    revision: base?.revision ?? 1,
    fechaEmision: base?.fechaEmision || now.slice(0, 10),
    validezDias: base?.validezDias ?? config.validezDiasPorDefecto ?? 15,
    tipoFactura,
    clienteId: base?.clienteId || '',
    direccionObra: base?.direccionObra || '',
    capitulos: base?.capitulos || [],
    items: base?.items || [],
    costosIndirectosConfig: base?.costosIndirectosConfig || [],
    costosIndirectosAplicados: base?.costosIndirectosAplicados || [],
    gastosConfig,
    costoGlobal: base?.costoGlobal || 0,
    gastosGeneralesTotal: base?.gastosGeneralesTotal || 0,
    beneficioPorcentaje: base?.beneficioPorcentaje ?? config.margenPorDefectoPct ?? 20,
    beneficioMonto: base?.beneficioMonto || 0,
    subtotalSinImpuestos: base?.subtotalSinImpuestos || 0,
    impuestosDetalle,
    montoImpuestosTotal: base?.montoImpuestosTotal || 0,
    precioFinalGlobal: base?.precioFinalGlobal || 0,
    coeficienteK: base?.coeficienteK || 1,
    margenRiesgoPorcentaje: base?.margenRiesgoPorcentaje ?? config.margenRiesgoDefaultPct ?? 0,
    subtotalInsumos: base?.subtotalInsumos || 0,
    subtotalManoObra: base?.subtotalManoObra || 0,
    subtotalCostosDirectos: base?.subtotalCostosDirectos || 0,
    subtotalCostosIndirectos: base?.subtotalCostosIndirectos || 0,
    costoTotalObra: base?.costoTotalObra || 0,
    margenPorcentaje: base?.margenPorcentaje ?? config.margenPorDefectoPct ?? 20,
    montoGanancia: base?.montoGanancia || 0,
    impuestosPorcentaje: base?.impuestosPorcentaje || 0,
    montoImpuestos: base?.montoImpuestos || 0,
    totalARS: base?.totalARS || 0,
    mostrarReferenciaMonedaExtranjera: base?.mostrarReferenciaMonedaExtranjera ?? config.mostrarDolarPorDefecto ?? false,
    nombreMonedaExtranjera: base?.nombreMonedaExtranjera || config.dolarReferenciaNombre || 'USD',
    cotizacionMonedaExtranjera: base?.cotizacionMonedaExtranjera || config.dolarReferenciaValor || 1200,
    condicionesPagoTexto: base?.condicionesPagoTexto || '',
    estado: base?.estado || 'borrador',
    fechaModificacion: now,
    createdAt: base?.createdAt || now,
    updatedAt: now,
    deleted: false,
    ...base
  };
}

/**
 * Detecta tareas libres con la misma descripción normalizada repetidas `umbral` o más veces
 * para sugerir al usuario convertirlas en un `TareaTipo` reutilizable.
 */
export function detectarTareasLibresRepetidas(
  items: ItemPresupuesto[],
  tareasTipo: TareaTipo[],
  umbral = 2
): SugerenciaConversionTareaTipo[] {
  const existentes = new Set(tareasTipo.map(t => normalizeSearch(t.nombre)));
  const grupos = new Map<string, { ejemplo: string; ids: string[] }>();

  for (const it of items) {
    if (it.tareaTipoId) continue;
    const norm = normalizeSearch(it.descripcion);
    if (!norm || existentes.has(norm)) continue;
    const curr = grupos.get(norm);
    if (curr) {
      curr.ids.push(it.id);
    } else {
      grupos.set(norm, { ejemplo: it.descripcion.trim(), ids: [it.id] });
    }
  }

  const sugerencias: SugerenciaConversionTareaTipo[] = [];
  for (const [norm, data] of grupos.entries()) {
    if (data.ids.length >= umbral) {
      sugerencias.push({
        descripcionNormalizada: norm,
        descripcionEjemplo: data.ejemplo,
        cantidadRepeticiones: data.ids.length,
        itemIds: data.ids,
        slugSugerido: slugifyIdentificador(data.ejemplo)
      });
    }
  }
  return sugerencias;
}

/**
 * Construye una nueva `TareaTipo` reutilizable a partir de un ítem libre existente.
 */
export function construirTareaTipoDesdeItemLibre(
  item: ItemPresupuesto,
  id: string,
  nombrePersonalizado?: string
): TareaTipo {
  const nombre = (nombrePersonalizado || item.descripcion).trim();
  const slug = slugifyIdentificador(nombre);
  const insumos = (item.insumosSnapshot || [])
    .filter(s => Boolean(s.materialId || s.insumoId))
    .map(s => ({
      materialId: s.materialId || s.insumoId,
      cantidad: safeNum(s.cantidadUnitaria || s.cantidadTotal || 1)
    }));
  const manoObra = (item.manoObraSnapshot || []).map(m => ({
    categoriaId: m.categoriaId,
    horas: safeNum(m.horasUnitarias || m.horasTotales || 1)
  }));

  return {
    id,
    nombre,
    slug,
    categoria: 'General',
    unidad: item.unidad || 'gl',
    parametros: [
      {
        id: 'cantidad',
        nombre: 'Cantidad',
        tipo: 'numero',
        unidad: item.unidad || 'gl',
        valorDefault: safeNum(item.cantidad) > 0 ? item.cantidad : 1
      }
    ],
    insumos,
    manoObra,
    costoServicioDirecto:
      safeNum(item.costoServiciosTercerizados) > 0
        ? roundMoney(safeNum(item.costoServiciosTercerizados))
        : undefined,
    costoFijoOperativo:
      insumos.length === 0 && manoObra.length === 0 && safeNum(item.costoDirectoTotal) > 0
        ? roundMoney(safeNum(item.costoDirectoTotal))
        : undefined,
    frecuenciaUso: 1,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Aplica los bloques parseados del notebook sobre un `Presupuesto` manteniendo
 * la single source of truth y calculando cascada de costos + alcance y advertencias.
 */
export function applyNotebookBlocksToPresupuesto(
  presupuestoBase: Partial<Presupuesto>,
  bloques: NotebookBlock[],
  ctx: NotebookDocumentContext,
  options: ApplyNotebookOptions = {}
): ResultadoAplicacionNotebook {
  const base = buildNewPresupuestoDefaults(ctx.config, presupuestoBase);
  const { insumosMap, manoObraMap, tareasMap } = buildMaps(ctx);
  const aliDefault = ctx.config.alicuotaIVAPorDefecto ?? ctx.config.porcentajeIVAPorDefecto ?? 21;
  const blockLineNumbers = options.blockLineNumbers || bloques.map((_, idx) => idx + 1);

  // 1. Evaluar variables de cotización
  const varEntries: Array<{ block: NotebookVariableBlock; linea: number }> = [];
  bloques.forEach((b, idx) => {
    if (b.tipo === 'variable') {
      varEntries.push({ block: b, linea: blockLineNumbers[idx] ?? idx + 1 });
    }
  });

  const variablesRaw: VariableCotizacion[] = varEntries.map((v, idx) => ({
    id: v.block.id,
    expresion: v.block.expresion,
    orden: idx + 1
  }));
  const evalVars = evaluarVariablesCotizacion(variablesRaw);

  const erroresVariables: NotebookErrorDocumento[] = [];
  for (const v of evalVars.variables) {
    if (v.error) {
      const entry = varEntries.find(e => e.block.id === v.id);
      erroresVariables.push({
        linea: entry?.linea ?? 1,
        columna: 1,
        longitud: v.id.length,
        codigo: 'ciclo_variable',
        mensaje: v.error
      });
    }
  }

  const calculosVariables: Record<string, number | string> = {};
  for (const v of evalVars.variables) {
    if (v.valorEvaluado !== undefined) {
      calculosVariables[v.id] = v.valorEvaluado;
    }
  }

  // 2. Supuestos y notas internas
  const supuestosRecord: Record<string, string> = {};
  for (const b of bloques) {
    if (b.tipo === 'supuesto') {
      supuestosRecord[b.clave] = b.valor;
    }
  }

  const notasInternasLista: NotaInterna[] = bloques
    .filter((b): b is NotebookNotaInternaBlock => b.tipo === 'nota_interna')
    .map((nb, idx) => ({
      id: `nota-${idx + 1}`,
      texto: nb.texto,
      createdAt: new Date().toISOString()
    }));

  // 3. Capítulos e ítems recorriendo secuencialmente los bloques
  const capitulosMap = new Map<string, CapituloPresupuesto>();
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    if (b.tipo === 'capitulo') {
      const existingCap = (base.capitulos || []).find(
        c => normalizeSearch(c.nombre) === normalizeSearch(b.nombre)
      );
      const id = existingCap?.id || `cap-${slugifyIdentificador(b.nombre) || i + 1}`;
      if (!capitulosMap.has(id)) {
        capitulosMap.set(id, {
          ...(existingCap || {}),
          id,
          nombre: b.nombre,
          orden: capitulosMap.size + 1
        });
      }
    }
  }

  const erroresComposicion: NotebookErrorDocumento[] = [];
  const usedIds = new Set<string>();
  const valorizarSet = new Set(options.valorizarItemIds || []);
  const modoPasada: ModoPasadaCotizacion = options.modoPasada || 'valorizacion';
  const itemsConstruidos: ItemPresupuesto[] = [];
  const blockLineaPorItemId = new Map<string, number>();

  let currentCapituloId: string | undefined;
  let currentCapituloNombre: string | undefined;

  const baseCapitulosById = new Map((base.capitulos || []).map(c => [c.id, c]));

  for (let idx = 0; idx < bloques.length; idx++) {
    const b = bloques[idx];
    const lineaNum = blockLineNumbers[idx] ?? idx + 1;

    if (b.tipo === 'capitulo') {
      const matched = Array.from(capitulosMap.values()).find(
        c => normalizeSearch(c.nombre) === normalizeSearch(b.nombre)
      );
      currentCapituloId = matched?.id;
      currentCapituloNombre = b.nombre;
      continue;
    }

    if (b.tipo !== 'tarea_tipo' && b.tipo !== 'item_libre') continue;

    if (b.tipo === 'tarea_tipo') {
      const tarea = b.tareaTipoId
        ? tareasMap.get(b.tareaTipoId)
        : ctx.tareasTipo.find(
            t =>
              (t.slug && normalizeSearch(t.slug) === normalizeSearch(b.referencia)) ||
              normalizeSearch(t.nombre) === normalizeSearch(b.referencia)
          );
      if (!tarea) continue;

      const ciclo = detectarCiclosComposicionTareaTipo(tarea.id, tareasMap);
      if (ciclo) {
        erroresComposicion.push({
          linea: lineaNum,
          columna: 1,
          longitud: b.referencia.length + 4,
          codigo: 'ciclo_composicion',
          mensaje: `Ciclo de composición detectado en trabajo tipo "${tarea.nombre}": ${ciclo.join(' -> ')}`
        });
      }

      const sig = signatureForBlock(b, currentCapituloNombre);
      const { item: existing, signatureMatched } = findMatchingExistingItem(
        base.items,
        usedIds,
        sig,
        tarea.nombre,
        baseCapitulosById
      );
      const itemId = existing?.id || `item-${idx + 1}-${slugifyIdentificador(tarea.nombre)}`;
      usedIds.add(itemId);
      blockLineaPorItemId.set(itemId, lineaNum);

      let estadoValorizacion: EstadoValorizacion;
      if (options.forzarValorizarTodos || valorizarSet.has(itemId)) {
        estadoValorizacion = 'valorizada';
      } else if (existing && signatureMatched && existing.estadoValorizacion) {
        estadoValorizacion = existing.estadoValorizacion;
      } else {
        estadoValorizacion = modoPasada === 'esqueleto' ? 'sin_valorizar' : 'valorizada';
      }

      const overridesEvaluados = evaluateOverridesAgainstScope(
        b.overridesParametros,
        evalVars.scope
      );
      if (b.cantidad !== undefined && overridesEvaluados['cantidad'] === undefined) {
        overridesEvaluados['cantidad'] = b.cantidad;
      }

      let insumosSnapshot: InsumoSnapshot[] = [];
      let manoObraSnapshot: ManoObraSnapshot[] = [];
      let costoServiciosTotal = 0;
      let costoFijo = 0;
      let cantidadPrincipal = Math.max(1, safeNum(b.cantidad ?? 1));
      let valoresParametros: Record<string, number> = { ...overridesEvaluados };
      let clausulaExclusiones = tarea.clausulaExclusiones || tarea.clausulaTecnicaDefault;
      let ajustesInstancia: AjustesInstanciaTrabajoTipo | undefined;

      if (estadoValorizacion === 'valorizada' && !ciclo) {
        const consumoBase = combinarConsumosTareaCompuesta(
          tarea,
          overridesEvaluados,
          evalVars.scope,
          insumosMap,
          manoObraMap,
          tareasMap,
          { tipoFactura: base.tipoFactura, alicuotaIVADefault: aliDefault }
        );
        const scopeItem = { ...evalVars.scope, ...consumoBase.valoresParametros };
        const ajustado = aplicarAjustesYLineasInstancia(
          consumoBase,
          b,
          scopeItem,
          insumosMap,
          manoObraMap,
          base.tipoFactura,
          aliDefault
        );
        insumosSnapshot = ajustado.insumosSnapshot;
        manoObraSnapshot = ajustado.manoObraSnapshot;
        costoServiciosTotal = ajustado.costoServiciosTotal;
        ajustesInstancia = ajustado.ajustesInstancia;
        costoFijo = consumoBase.costoFijoOperativo;
        valoresParametros = consumoBase.valoresParametros;
        clausulaExclusiones = consumoBase.clausulaExclusiones;

        const primerParam = tarea.parametros?.[0];
        if (b.cantidad !== undefined) {
          cantidadPrincipal = Math.max(1, safeNum(b.cantidad));
        } else if (primerParam && valoresParametros[primerParam.id] !== undefined) {
          cantidadPrincipal = Math.max(1, safeNum(valoresParametros[primerParam.id]));
        }
      } else {
        const primerParam = tarea.parametros?.[0];
        const rawCant =
          b.cantidad ??
          (primerParam && overridesEvaluados[primerParam.id] !== undefined
            ? overridesEvaluados[primerParam.id]
            : primerParam?.valorDefault ?? 1);
        cantidadPrincipal = Math.max(1, safeNum(rawCant));
      }

      const { costoInsumos, costoManoObra, costoDirectoTotal } = calcularCostoDirectoPorSnapshots(
        insumosSnapshot,
        manoObraSnapshot,
        costoServiciosTotal,
        costoFijo
      );

      const parametrosItem: ParametroItem[] = Object.entries(valoresParametros).map(([id, val]) => ({
        id,
        nombre: id,
        valor: val,
        origen: 'propio'
      }));

      itemsConstruidos.push({
        id: itemId,
        capituloId: currentCapituloId,
        tipoItem: 'tarea_tipo',
        tareaTipoId: tarea.id,
        tareaTipoVersion: tarea.version,
        descripcion: tarea.nombre,
        unidad: tarea.unidad || 'u',
        cantidad: cantidadPrincipal,
        valoresParametros,
        parametros: parametrosItem,
        overridesParametros: { ...b.overridesParametros },
        ajustesInstancia,
        estadoValorizacion,
        insumosSnapshot,
        manoObraSnapshot,
        costoInsumos: estadoValorizacion === 'valorizada' ? costoInsumos : 0,
        costoManoObra: estadoValorizacion === 'valorizada' ? costoManoObra : 0,
        costoServiciosTercerizados: estadoValorizacion === 'valorizada' ? costoServiciosTotal : 0,
        costoDirectoTotal: estadoValorizacion === 'valorizada' ? costoDirectoTotal : 0,
        costoUnitario:
          estadoValorizacion === 'valorizada' && cantidadPrincipal > 0
            ? roundMoney(costoDirectoTotal / cantidadPrincipal)
            : 0,
        precioVentaUnitario: 0,
        precioVentaTotal: 0,
        clausulaExclusiones
      });
    } else {
      const sig = signatureForBlock(b, currentCapituloNombre);
      const { item: existing, signatureMatched } = findMatchingExistingItem(
        base.items,
        usedIds,
        sig,
        b.descripcion,
        baseCapitulosById
      );
      const itemId = existing?.id || `item-${idx + 1}-${slugifyIdentificador(b.descripcion)}`;
      usedIds.add(itemId);
      blockLineaPorItemId.set(itemId, lineaNum);

      const itemParamsEvaluados = evaluateOverridesAgainstScope(b.parametros, evalVars.scope);
      const scopeItem = { ...evalVars.scope, ...itemParamsEvaluados };
      const cantidad = Math.max(
        0,
        evalScalarOrFormula(b.cantidad, b.formulaCantidad, scopeItem, 1)
      );
      const precioEval = evalScalarOrFormula(b.precioUnitario, b.formulaPrecio, scopeItem, 0);

      const tieneDatosEconomicos = precioEval > 0 || b.lineas.length > 0;

      let estadoValorizacion: EstadoValorizacion;
      if (options.forzarValorizarTodos || valorizarSet.has(itemId)) {
        estadoValorizacion = 'valorizada';
      } else if (existing && signatureMatched && existing.estadoValorizacion) {
        estadoValorizacion = existing.estadoValorizacion;
      } else if (!tieneDatosEconomicos || modoPasada === 'esqueleto') {
        estadoValorizacion = tieneDatosEconomicos && modoPasada !== 'esqueleto' ? 'valorizada' : 'sin_valorizar';
      } else {
        estadoValorizacion = 'valorizada';
      }

      let insumosSnapshot: InsumoSnapshot[] = [];
      let manoObraSnapshot: ManoObraSnapshot[] = [];
      let costoServiciosTotal = 0;
      let costoFijo = 0;

      if (estadoValorizacion === 'valorizada') {
        if (b.lineas.length > 0) {
          const snap = construirSnapshotsDesdeItemLineas(
            b.lineas,
            { ...scopeItem, cantidad },
            insumosMap,
            manoObraMap,
            base.tipoFactura,
            aliDefault
          );
          insumosSnapshot = snap.insumosSnapshot;
          manoObraSnapshot = snap.manoObraSnapshot;
          costoServiciosTotal = snap.costoServiciosTotal;
        } else if (precioEval > 0) {
          costoFijo = roundMoney(precioEval * (cantidad > 0 ? cantidad : 1));
        }
      }

      const { costoInsumos, costoManoObra, costoDirectoTotal } = calcularCostoDirectoPorSnapshots(
        insumosSnapshot,
        manoObraSnapshot,
        costoServiciosTotal,
        costoFijo
      );

      const parametros: ParametroItem[] = Object.entries(itemParamsEvaluados).map(([id, valor]) => ({
        id,
        nombre: id,
        valor,
        origen: 'propio'
      }));

      itemsConstruidos.push({
        id: itemId,
        capituloId: currentCapituloId,
        tipoItem: 'item_libre',
        descripcion: b.descripcion,
        unidad: b.unidad || 'gl',
        cantidad: cantidad > 0 ? cantidad : 1,
        formulaCantidad: b.formulaCantidad,
        precioManual: b.precioUnitario !== undefined ? b.precioUnitario : precioEval > 0 ? precioEval : undefined,
        formulaPrecio: b.formulaPrecio,
        parametros,
        estadoValorizacion,
        insumosSnapshot,
        manoObraSnapshot,
        costoInsumos: estadoValorizacion === 'valorizada' ? costoInsumos : 0,
        costoManoObra: estadoValorizacion === 'valorizada' ? costoManoObra : 0,
        costoServiciosTercerizados: estadoValorizacion === 'valorizada' ? costoServiciosTotal : 0,
        costoDirectoTotal: estadoValorizacion === 'valorizada' ? costoDirectoTotal : 0,
        costoUnitario:
          estadoValorizacion === 'valorizada' && cantidad > 0
            ? roundMoney(costoDirectoTotal / cantidad)
            : 0,
        precioVentaUnitario: 0,
        precioVentaTotal: 0
      });
    }
  }

  const capitulosFinales = Array.from(capitulosMap.values());
  const beneficioPct = safeNum(base.beneficioPorcentaje ?? base.margenPorcentaje ?? 20);
  const totales = calcularTotalesPresupuesto({
    items: itemsConstruidos,
    capitulos: capitulosFinales,
    costosIndirectosCatalog: ctx.costosIndirectosCatalog,
    costosIndirectosConfig: base.costosIndirectosConfig,
    gastosConfig: base.gastosConfig,
    margenPorcentaje: beneficioPct,
    beneficioPorcentaje: beneficioPct,
    margenRiesgoPorcentaje: base.margenRiesgoPorcentaje,
    impuestosDetalle: base.impuestosDetalle,
    tipoFactura: base.tipoFactura,
    cotizacionMonedaExtranjera: base.cotizacionMonedaExtranjera
  });

  const subtotalesPorBloque: Record<number, SubtotalBloqueInfo> = {};
  const subtotalesPorItemId: Record<string, SubtotalBloqueInfo> = {};
  const itemsFinales: ItemPresupuesto[] = totales.itemsCalculados.map(it => {
    const info: SubtotalBloqueInfo = {
      itemId: it.id,
      estadoValorizacion: it.estadoValorizacion || 'valorizada',
      costoDirecto: safeNum(it.costoDirectoTotal),
      precioVenta:
        it.estadoValorizacion === 'sin_valorizar'
          ? 0
          : roundMoney(safeNum(it.precioFinalItem ?? it.precioVentaTotal ?? it.costoDirectoTotal))
    };
    subtotalesPorItemId[it.id] = info;
    const linea = blockLineaPorItemId.get(it.id);
    if (linea !== undefined) {
      subtotalesPorBloque[linea] = info;
    }
    return it;
  });

  const now = new Date().toISOString();
  const presupuestoActualizado: Presupuesto = {
    ...base,
    capitulos: capitulosFinales,
    items: itemsFinales,
    variablesCotizacion: evalVars.variables,
    calculosVariables,
    supuestos: supuestosRecord,
    notasInternasLista,
    notasInternas: notasInternasLista.map(n => n.texto).join('\n'),
    costoGlobal: totales.costoGlobal,
    gastosGeneralesTotal: totales.gastosGeneralesTotal,
    beneficioPorcentaje: totales.beneficioPorcentaje,
    beneficioMonto: totales.beneficioMonto,
    subtotalSinImpuestos: totales.subtotalSinImpuestos,
    impuestosDetalle: totales.impuestosCalculados,
    montoImpuestosTotal: totales.montoImpuestosTotal,
    precioFinalGlobal: totales.precioFinalGlobal,
    coeficienteK: totales.coeficienteK,
    subtotalInsumos: totales.subtotalInsumos,
    subtotalManoObra: totales.subtotalManoObra,
    subtotalServiciosTercerizados: totales.subtotalServiciosTercerizados,
    subtotalCostosDirectos: totales.costoGlobal,
    subtotalCostosIndirectos: totales.gastosGeneralesTotal,
    costoTotalObra: totales.costoTotalObra,
    margenPorcentaje: totales.beneficioPorcentaje,
    montoGanancia: totales.beneficioMonto,
    impuestosPorcentaje: totales.impuestosPorcentajeTotal,
    montoImpuestos: totales.montoImpuestosTotal,
    totalARS: totales.precioFinalGlobal,
    totalMonedaExtranjera: totales.totalMonedaExtranjera,
    fechaModificacion: now,
    updatedAt: now
  };

  const alcanceYAdvertencias = evaluarAlcanceYAdvertencias(
    presupuestoActualizado,
    tareasMap,
    PRESUPUESTO_MAXIMO_ADVERTENCIAS_VISIBLES
  );
  presupuestoActualizado.advertenciasCliente = alcanceYAdvertencias.todasLasAdvertencias;

  const tareasSinValorizar = itemsFinales.filter(it => it.estadoValorizacion === 'sin_valorizar');
  const sugerenciasConversion = detectarTareasLibresRepetidas(itemsFinales, ctx.tareasTipo);

  return {
    presupuesto: presupuestoActualizado,
    totales,
    alcanceYAdvertencias,
    erroresVariables,
    erroresComposicion,
    subtotalesPorBloque,
    subtotalesPorItemId,
    blockLineNumbers,
    tareasSinValorizar,
    esTotalParcial: tareasSinValorizar.length > 0,
    sugerenciasConversion
  };
}

// ─── Autocompletado Contextual y Ghost Text ──────────────────────────────────

function resolveTokenAtCursor(line: string, columna: number): {
  beforeCursor: string;
  tokenStart: number;
  currentToken: string;
} {
  const safeCol = Math.max(0, Math.min(columna, line.length));
  const beforeCursor = line.slice(0, safeCol);
  const lastSpace = Math.max(beforeCursor.lastIndexOf(' '), beforeCursor.lastIndexOf('\t'));
  const tokenStart = lastSpace + 1;
  const currentToken = beforeCursor.slice(tokenStart);
  return { beforeCursor, tokenStart, currentToken };
}

function findEnclosingItemBlockInfo(
  lines: string[],
  linea1Based: number
): { kind: 'tarea' | 'item' | 'tt'; startIdx: number; headerLine: string } | null {
  for (let i = linea1Based - 2; i >= 0; i--) {
    const raw = lines[i];
    if (!raw.trim()) return null;
    if (!/^[ \t]+/.test(raw)) {
      const t = raw.trim();
      if (/^tarea:/i.test(t)) return { kind: 'tarea', startIdx: i, headerLine: t };
      if (/^item:/i.test(t)) return { kind: 'item', startIdx: i, headerLine: t };
      if (/^\/tt\b/i.test(t)) return { kind: 'tt', startIdx: i, headerLine: t };
      return null;
    }
  }
  return null;
}

function tokenizeSmartSearch(str: string): string[] {
  const norm = normalizeSearch(str);
  const rawTokens = norm.split(/[^a-z0-9.,²]+/).filter(Boolean);
  const out = new Set<string>();
  for (const raw of rawTokens) {
    const clean = raw.replace(/,/g, '.');
    out.add(clean);
    const numUnit = clean.match(/^(\d+(?:\.\d+)?)([a-z²]+)$/);
    if (numUnit) {
      out.add(numUnit[1]);
      out.add(numUnit[2]);
    }
  }
  return Array.from(out);
}

function extractInlineQuantityHint(rawQuery: string): { qty?: string; unitHint?: string; cleanQuery: string } {
  const trimmed = rawQuery.trim();
  const leading = trimmed.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (leading) {
    return { qty: leading[1].replace(',', '.'), cleanQuery: leading[2].trim() };
  }
  const trailing = trimmed.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)([a-zA-Z²]*)$/);
  if (trailing && trailing[1].trim().length >= 2) {
    // No confundir sección de cable tipo "cable 2.5" con cantidad si no tiene unidad y es decimal típico o corto
    const numStr = trailing[2].replace(',', '.');
    const unitHint = trailing[3] || undefined;
    if (unitHint) {
      return { qty: numStr, unitHint, cleanQuery: trailing[1].trim() };
    }
  }
  return { cleanQuery: trimmed };
}

function scoreMaterialSmart(
  query: string,
  material: Material,
  productosDelMaterial: Producto[]
): number | null {
  const q = normalizeSearch(query);
  if (!q) return 10 + (material.frecuenciaUso ?? 0) * 5;

  const directScore = fuzzyMatchScore(q, material.nombre);
  const attrText = (material.atributos ?? []).map(a => `${a.clave} ${a.valor}`).join(' ');
  const prodText = productosDelMaterial
    .map(p => `${p.marca} ${p.modelo} ${p.codigoFabricante ?? ''}`)
    .join(' ');
  const corpus = `${material.nombre} ${attrText} ${material.categoriaId || ''} ${prodText}`;
  const corpusNorm = normalizeSearch(corpus);
  const corpusTokens = tokenizeSmartSearch(corpus);
  const qTokens = tokenizeSmartSearch(q);

  if (qTokens.length === 0) return directScore;

  let tokenScore = 0;
  for (const qt of qTokens) {
    if (corpusTokens.includes(qt)) {
      tokenScore += 180;
    } else if (corpusTokens.some(ct => ct.startsWith(qt))) {
      tokenScore += 130;
    } else if (corpusNorm.includes(qt)) {
      tokenScore += 90;
    } else {
      return null;
    }
  }

  return Math.max(directScore ?? 0, tokenScore) + (material.frecuenciaUso ?? 0) * 5;
}

function resolveMaterialDetailPreview(
  material: Material,
  productosDelMaterial: Producto[],
  insumosMap: Map<string, Insumo>
): string {
  const unidad = material.unidadVenta || 'u';
  const resolved = insumosMap.get(material.id);
  const preferido = productosDelMaterial.find(p => p.esPreferido) || productosDelMaterial[0];
  const marcaStr = resolved?.marca || (preferido ? `${preferido.marca} ${preferido.modelo}`.trim() : '');
  const precio = safeNum(resolved?.precioActual);
  const parts = [unidad];
  if (marcaStr) parts.push(marcaStr);
  if (precio > 0) parts.push(`$${Math.round(precio).toLocaleString('es-AR')}/${unidad}`);
  return parts.join(' · ');
}

function buildSmartMaterialSuggestions(
  rawQuery: string,
  replaceStart: number,
  safeCol: number,
  ctx: NotebookDocumentContext,
  options: { prefixPlus?: boolean; insertOnNewIndentedLine?: boolean } = {}
): NotebookAutocompleteSuggestion[] {
  const { insumosMap } = buildMaps(ctx);
  const { qty, unitHint, cleanQuery } = extractInlineQuantityHint(rawQuery);
  const productosByMat = new Map<string, Producto[]>();
  for (const p of ctx.productos ?? []) {
    if (p.deleted || p.activo === false) continue;
    const list = productosByMat.get(p.materialId) ?? [];
    list.push(p);
    productosByMat.set(p.materialId, list);
  }

  const out: NotebookAutocompleteSuggestion[] = [];
  for (const m of ctx.materiales) {
    if (m.deleted || m.activo === false) continue;
    const prods = productosByMat.get(m.id) ?? [];
    const sc = scoreMaterialSmart(cleanQuery, m, prods);
    if (sc === null) continue;

    const unidad = unitHint || m.unidadVenta || 'u';
    const qtyText = qty || '1';
    const prefix = options.prefixPlus ? '+' : '';
    const baseName = `${prefix}${m.nombre}  `;
    const insertText = `${baseName}${qtyText}${unidad}`;
    const hasExplicitQty = qty !== undefined;
    const selStart = hasExplicitQty ? insertText.length : baseName.length;
    const selEnd = hasExplicitQty ? insertText.length : baseName.length + qtyText.length;

    const matchesPrefix =
      !options.prefixPlus &&
      cleanQuery.length > 0 &&
      m.nombre.toLowerCase().startsWith(cleanQuery.toLowerCase());

    out.push({
      id: `${options.prefixPlus ? 'add' : 'mat'}-${m.id}`,
      kind: options.prefixPlus ? 'ajuste_agregar' : 'material',
      label: options.prefixPlus ? `+${m.nombre}` : m.nombre,
      detail: resolveMaterialDetailPreview(m, prods, insumosMap),
      insertText,
      replaceStartCol: replaceStart + 1,
      replaceEndCol: safeCol + 1,
      selectionStartOffset: selStart,
      selectionEndOffset: selEnd,
      insertOnNewIndentedLine: options.insertOnNewIndentedLine,
      ghostText: matchesPrefix ? `${m.nombre.slice(cleanQuery.length)}  ${qtyText}${unidad}` : undefined,
      frecuenciaUso: m.frecuenciaUso ?? 0,
      score: sc
    });
  }
  return out;
}

function buildTopLevelSuggestions(
  query: string,
  tokenStart: number,
  safeCol: number
): NotebookAutocompleteSuggestion[] {
  const comandos = [
    { id: 'cmd-tt', label: '/tt ', detail: 'Insertar trabajo tipo parametrizado', freq: 100 },
    { id: 'cmd-cap', label: '# ', detail: `Nuevo ${TERMINOLOGY.agrupadorSingular}`, freq: 90 },
    { id: 'cmd-tarea', label: 'tarea: ', detail: 'Nueva tarea libre compuesta', freq: 80 },
    { id: 'cmd-item', label: 'item: ', detail: 'Nuevo ítem libre compacto', freq: 75 },
    { id: 'cmd-supuesto', label: 'supuesto: ', detail: 'Declarar supuesto técnico', freq: 60 },
    { id: 'cmd-nota', label: 'nota: ', detail: 'Nota interna (no visible al cliente)', freq: 50 }
  ];
  const out: NotebookAutocompleteSuggestion[] = [];
  const effectiveQuery =
    query === '/'
      ? ''
      : query.startsWith('/') && !query.toLowerCase().startsWith('/tt')
        ? query.slice(1)
        : query;

  for (const c of comandos) {
    const sc =
      fuzzyMatchScore(query, c.label) ??
      (effectiveQuery !== query ? fuzzyMatchScore(effectiveQuery, c.label) : null);
    if (sc !== null) {
      out.push({
        id: c.id,
        kind: 'comando',
        label: c.label.trim(),
        detail: c.detail,
        insertText: c.label,
        replaceStartCol: tokenStart + 1,
        replaceEndCol: safeCol + 1,
        ghostText: c.label.startsWith(query) ? c.label.slice(query.length) : undefined,
        frecuenciaUso: c.freq,
        score: sc + c.freq + (query === '/' && c.label.startsWith('/') ? 50 : 0)
      });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

function findTareaTipoFromLine(headerLine: string, tareasTipo: TareaTipo[]): TareaTipo | undefined {
  const m = headerLine.match(/^\/tt\s+([^\s]+)/i);
  if (!m) return undefined;
  const ref = m[1];
  return tareasTipo.find(
    t => (t.slug || slugifyIdentificador(t.nombre)) === ref || normalizeSearch(t.nombre) === normalizeSearch(ref)
  );
}

function collectPresentKeysInBlock(lines: string[], startIdx: number): Set<string> {
  const present = new Set<string>();
  const rootTokens = (lines[startIdx] || '').trim().split(/\s+/).slice(2);
  for (const tok of rootTokens) {
    if (tok.includes('=')) present.add(tok.split('=')[0].trim());
    if (tok.startsWith('-')) present.add(tok.slice(1).trim());
  }
  for (let i = startIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) break;
    if (!/^[ \t]+/.test(raw)) break;
    const t = raw.trim();
    const pm = t.match(/^([a-zA-Z_][\w-]*)\s*=/);
    if (pm) present.add(pm[1]);
    if (t.startsWith('-')) present.add(t.slice(1).trim());
  }
  return present;
}

/**
 * Calcula sugerencias de autocompletado contextual según el nivel del cursor.
 * No invasivo por defecto: no se despliega en líneas vacías salvo que `forceOpen` sea true (Ctrl+Space).
 */
export function getContextualAutocompleteSuggestions(
  texto: string,
  linea1Based: number,
  columna1Based: number,
  ctx: NotebookDocumentContext,
  variablesExistentes: string[] = [],
  options: AutocompleteOptions = {}
): NotebookAutocompleteResult {
  const forceOpen = options.forceOpen === true;
  const lines = texto.split(/\r?\n/);
  const lineIdx = Math.max(0, Math.min(linea1Based - 1, lines.length - 1));
  const rawLine = lines[lineIdx] || '';
  const safeCol = Math.max(0, Math.min(columna1Based - 1, rawLine.length));
  const atTokenEnd = safeCol >= rawLine.length || /\s/.test(rawLine[safeCol]);
  const { beforeCursor, tokenStart, currentToken } = resolveTokenAtCursor(rawLine, safeCol);
  const trimmedBefore = beforeCursor.trimStart();
  const indentLen = rawLine.length - rawLine.trimStart().length;

  let suggestions: NotebookAutocompleteSuggestion[] = [];
  const enclosingBlock = /^[ \t]+/.test(rawLine)
    ? findEnclosingItemBlockInfo(lines, linea1Based)
    : null;

  // Nivel 1: sub-línea indentada dentro de un ítem (`tarea:`, `/tt`, `item:`)
  if (enclosingBlock !== null) {
    const inner = trimmedBefore.toLowerCase();
    const tareaEnclosing =
      enclosingBlock.kind === 'tt' ? findTareaTipoFromLine(enclosingBlock.headerLine, ctx.tareasTipo) : undefined;

    if (inner.startsWith('mo:')) {
      const q = trimmedBefore.slice(3).trim();
      const replaceStart = beforeCursor.toLowerCase().indexOf('mo:') + 3;
      suggestions = ctx.manoObra
        .map(m => {
          const sc = fuzzyMatchScore(q, m.nombre);
          if (sc === null) return null;
          const base = ` ${m.nombre}  `;
          const insertText = `${base}2hs`;
          return {
            id: `mo-${m.id}`,
            kind: 'mano_obra' as AutocompleteKind,
            label: m.nombre,
            detail: `$${safeNum(m.costoHora).toLocaleString('es-AR')}/h`,
            insertText,
            replaceStartCol: replaceStart + 1,
            replaceEndCol: safeCol + 1,
            selectionStartOffset: base.length,
            selectionEndOffset: base.length + 1,
            ghostText: m.nombre.toLowerCase().startsWith(q.toLowerCase())
              ? `${m.nombre.slice(q.length)}  2hs`
              : undefined,
            frecuenciaUso: 0,
            score: sc
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    } else if (/^[a-zA-Z_][\w-]*\s*=\s*/.test(trimmedBefore)) {
      const eqIdx = beforeCursor.indexOf('=');
      const valQuery = beforeCursor.slice(eqIdx + 1).trimStart();
      const valStart = beforeCursor.length - valQuery.length;
      suggestions = variablesExistentes
        .map(v => {
          const sc = fuzzyMatchScore(valQuery, v);
          if (sc === null) return null;
          return {
            id: `var-sub-${v}`,
            kind: 'variable' as AutocompleteKind,
            label: v,
            detail: 'Variable de cotización',
            insertText: v,
            replaceStartCol: valStart + 1,
            replaceEndCol: safeCol + 1,
            ghostText: v.startsWith(valQuery) ? v.slice(valQuery.length) : undefined,
            frecuenciaUso: 5,
            score: sc
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    } else if (trimmedBefore.includes('[') && !trimmedBefore.slice(trimmedBefore.lastIndexOf('[')).includes(']')) {
      // Autocompletado de [Marca Modelo] para un material ya escrito
      const openBracketCol = beforeCursor.lastIndexOf('[');
      const prodQuery = beforeCursor.slice(openBracketCol + 1).trimStart();
      const matNamePart = trimmedBefore.slice(0, trimmedBefore.lastIndexOf('[')).replace(/^(?:mat:|\+)\s*/i, '').trim();
      const matMatches = buildSmartMaterialSuggestions(matNamePart, indentLen, safeCol, ctx);
      const topMatId = matMatches[0]?.id.replace(/^(mat|add)-/, '');
      const matObj = ctx.materiales.find(m => m.id === topMatId);
      const unidad = matObj?.unidadVenta || 'u';
      const prods = (ctx.productos ?? []).filter(
        p => !p.deleted && p.activo !== false && (!topMatId || p.materialId === topMatId)
      );
      suggestions = prods
        .map(p => {
          const label = `${p.marca} ${p.modelo}`.trim();
          const sc = fuzzyMatchScore(prodQuery, label);
          if (sc === null) return null;
          const insertText = `${label}]  1${unidad}`;
          const numStart = `${label}]  `.length;
          const prodOffer = (ctx.ofertas ?? [])
            .filter(o => o.productoId === p.id)
            .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
          const detailParts = [p.esPreferido ? 'Preferido' : 'Producto'];
          if (prodOffer) detailParts.push(`$${Math.round(prodOffer.precio).toLocaleString('es-AR')}/${unidad}`);
          return {
            id: `prod-${p.id}`,
            kind: 'producto' as AutocompleteKind,
            label,
            detail: detailParts.join(' · '),
            insertText,
            replaceStartCol: openBracketCol + 2,
            replaceEndCol: safeCol + 1,
            selectionStartOffset: numStart,
            selectionEndOffset: numStart + 1,
            ghostText: label.toLowerCase().startsWith(prodQuery.toLowerCase())
              ? `${label.slice(prodQuery.length)}]  1${unidad}`
              : undefined,
            frecuenciaUso: p.esPreferido ? 10 : 1,
            score: sc + (p.esPreferido ? 150 : 0)
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    } else if (enclosingBlock.kind === 'tt' && trimmedBefore.startsWith('-')) {
      const q = trimmedBefore.slice(1).trim();
      const candidates = new Set<string>();
      if (tareaEnclosing) {
        for (const ins of tareaEnclosing.insumos || []) {
          if (ins.claveAjuste) candidates.add(ins.claveAjuste);
          const mat = ctx.materiales.find(m => m.id === (ins.materialId || ins.insumoId));
          if (mat) candidates.add(slugifyIdentificador(mat.nombre));
        }
        for (const sub of tareaEnclosing.subTrabajos || []) {
          if (sub.claveAjuste) candidates.add(sub.claveAjuste);
        }
      }
      suggestions = Array.from(candidates)
        .map(slug => {
          const sc = fuzzyMatchScore(q, slug);
          if (sc === null) return null;
          return {
            id: `quit-${slug}`,
            kind: 'ajuste_quitar' as AutocompleteKind,
            label: `-${slug}`,
            detail: 'Quitar componente del trabajo tipo',
            insertText: `-${slug}`,
            replaceStartCol: indentLen + 1,
            replaceEndCol: safeCol + 1,
            ghostText: slug.startsWith(q) ? slug.slice(q.length) : undefined,
            frecuenciaUso: 1,
            score: sc
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    } else if (enclosingBlock.kind === 'tt' && trimmedBefore.startsWith('+')) {
      const q = trimmedBefore.slice(1).trim();
      suggestions = buildSmartMaterialSuggestions(q, indentLen, safeCol, ctx, { prefixPlus: true });
    } else if (trimmedBefore.length >= 1 || forceOpen) {
      const q = trimmedBefore.replace(/^mat:\s*/i, '');
      const matSugs = buildSmartMaterialSuggestions(q, indentLen, safeCol, ctx);
      suggestions.push(...matSugs);

      // En /tt también sugerimos parámetros faltantes en sub-línea indentada
      if (tareaEnclosing) {
        const yaPresentes = collectPresentKeysInBlock(lines, enclosingBlock.startIdx);
        for (const p of tareaEnclosing.parametros || []) {
          if (yaPresentes.has(p.id)) continue;
          const sc = fuzzyMatchScore(trimmedBefore, p.id);
          if (sc === null) continue;
          const defVal = String(p.valorDefault ?? 1);
          const insertText = `${p.id} = ${defVal}`;
          suggestions.push({
            id: `param-${p.id}`,
            kind: 'parametro',
            label: insertText,
            detail: p.unidad ? `${p.nombre} (${p.unidad})` : p.nombre,
            insertText,
            replaceStartCol: indentLen + 1,
            replaceEndCol: safeCol + 1,
            selectionStartOffset: `${p.id} = `.length,
            selectionEndOffset: insertText.length,
            ghostText: insertText.startsWith(trimmedBefore) ? insertText.slice(trimmedBefore.length) : undefined,
            frecuenciaUso: 5,
            score: sc + 120
          });
        }
      }

      // También sugerir prefijo mo: cuando empieza a escribir "mo" o en forceOpen
      if (trimmedBefore === '' || 'mo:'.startsWith(inner)) {
        suggestions.push({
          id: 'sub-cmd-mo',
          kind: 'comando',
          label: 'mo: ',
          detail: 'Agregar mano de obra (horas)',
          insertText: 'mo: ',
          replaceStartCol: indentLen + 1,
          replaceEndCol: safeCol + 1,
          frecuenciaUso: 4,
          score: trimmedBefore ? 700 : 30
        });
      }
    }
  } else if (/^\/tt\s+/i.test(trimmedBefore)) {
    const afterTt = trimmedBefore.replace(/^\/tt\s+/i, '');
    const parts = afterTt.split(/\s+/);
    const slugQuery = parts[0] || '';
    const tareasMapBySlug = new Map<string, TareaTipo>();
    for (const t of ctx.tareasTipo) {
      tareasMapBySlug.set(t.slug || slugifyIdentificador(t.nombre), t);
    }

    if (parts.length === 1 && !/\s$/.test(afterTt)) {
      suggestions = ctx.tareasTipo
        .map(t => {
          const slug = t.slug || slugifyIdentificador(t.nombre);
          const scSlug = fuzzyMatchScore(slugQuery, slug);
          const scNom = fuzzyMatchScore(slugQuery, t.nombre);
          const sc = Math.max(scSlug ?? -1, scNom ?? -1);
          if (sc < 0) return null;

          const paramLines = (t.parametros || []).map(p => `  ${p.id} = ${p.valorDefault ?? 1}`);
          const fullInsert = paramLines.length > 0 ? `${slug}\n${paramLines.join('\n')}` : slug;
          let selStart = fullInsert.length;
          let selEnd = fullInsert.length;
          if (paramLines.length > 0) {
            const firstLine = paramLines[0];
            const eqPos = firstLine.indexOf('= ');
            if (eqPos >= 0) {
              const baseOffset = slug.length + 1;
              selStart = baseOffset + eqPos + 2;
              selEnd = baseOffset + firstLine.length;
            }
          }

          return {
            id: `tt-${t.id}`,
            kind: 'tarea_tipo' as AutocompleteKind,
            label: slug,
            detail: t.nombre,
            insertText: fullInsert,
            replaceStartCol: tokenStart + 1,
            replaceEndCol: safeCol + 1,
            selectionStartOffset: selStart,
            selectionEndOffset: selEnd,
            ghostText: slug.startsWith(slugQuery.toLowerCase()) ? slug.slice(slugQuery.length) : undefined,
            frecuenciaUso: t.frecuenciaUso ?? 0,
            score: sc + (t.frecuenciaUso ?? 0) * 10
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    } else {
      const tarea = tareasMapBySlug.get(slugQuery);
      if (currentToken.startsWith('-')) {
        const q = currentToken.slice(1);
        const candidates = new Set<string>();
        if (tarea) {
          for (const ins of tarea.insumos || []) {
            if (ins.claveAjuste) candidates.add(ins.claveAjuste);
            const mat = ctx.materiales.find(m => m.id === (ins.materialId || ins.insumoId));
            if (mat) candidates.add(slugifyIdentificador(mat.nombre));
          }
          for (const sub of tarea.subTrabajos || []) {
            if (sub.claveAjuste) candidates.add(sub.claveAjuste);
          }
        }
        suggestions = Array.from(candidates)
          .map(slug => {
            const sc = fuzzyMatchScore(q, slug);
            if (sc === null) return null;
            return {
              id: `quit-${slug}`,
              kind: 'ajuste_quitar' as AutocompleteKind,
              label: `-${slug}`,
              detail: 'Quitar componente en línea indentada',
              insertText: `-${slug}`,
              replaceStartCol: tokenStart + 1,
              replaceEndCol: safeCol + 1,
              insertOnNewIndentedLine: true,
              ghostText: slug.startsWith(q) ? slug.slice(q.length) : undefined,
              frecuenciaUso: 1,
              score: sc
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
      } else if (currentToken.startsWith('+')) {
        const q = currentToken.slice(1);
        suggestions = buildSmartMaterialSuggestions(q, tokenStart, safeCol, ctx, {
          prefixPlus: true,
          insertOnNewIndentedLine: true
        });
      } else if (currentToken.includes('=')) {
        const eqIdx = currentToken.indexOf('=');
        const valQuery = currentToken.slice(eqIdx + 1);
        suggestions = variablesExistentes
          .map(v => {
            const sc = fuzzyMatchScore(valQuery, v);
            if (sc === null) return null;
            return {
              id: `var-${v}`,
              kind: 'variable' as AutocompleteKind,
              label: v,
              detail: 'Variable de cotización',
              insertText: v,
              replaceStartCol: tokenStart + eqIdx + 2,
              replaceEndCol: safeCol + 1,
              ghostText: v.startsWith(valQuery) ? v.slice(valQuery.length) : undefined,
              frecuenciaUso: 5,
              score: sc
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
      } else if (tarea && (currentToken.length > 0 || forceOpen)) {
        const yaPresentes = collectPresentKeysInBlock(lines, lineIdx);
        suggestions = (tarea.parametros || [])
          .filter(p => !yaPresentes.has(p.id))
          .map(p => {
            const sc = fuzzyMatchScore(currentToken, p.id);
            if (sc === null) return null;
            const defVal = String(p.valorDefault ?? 1);
            const text = `${p.id} = ${defVal}`;
            return {
              id: `param-${p.id}`,
              kind: 'parametro' as AutocompleteKind,
              label: text,
              detail: p.unidad ? `${p.nombre} (${p.unidad})` : p.nombre,
              insertText: text,
              replaceStartCol: tokenStart + 1,
              replaceEndCol: safeCol + 1,
              selectionStartOffset: `${p.id} = `.length,
              selectionEndOffset: text.length,
              insertOnNewIndentedLine: true,
              ghostText: text.startsWith(currentToken) ? text.slice(currentToken.length) : undefined,
              frecuenciaUso: 5,
              score: sc
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
      }
    }
  } else if (/^supuesto:\s*/i.test(trimmedBefore)) {
    const rest = trimmedBefore.replace(/^supuesto:\s*/i, '');
    const supuestosDeclarados = new Map<string, { nombre: string; opciones: string[]; valorDefault: string }>();
    for (const t of ctx.tareasTipo) {
      for (const sup of t.supuestos || []) {
        supuestosDeclarados.set(sup.id, {
          nombre: sup.nombre,
          opciones: sup.opciones || ['no_verificada', 'verificada', 'original'],
          valorDefault: sup.valorDefault || 'no_verificada'
        });
      }
    }

    if (rest.includes('=')) {
      const [rawKey, rawVal = ''] = rest.split('=');
      const clave = rawKey.trim();
      const valQuery = rawVal.trim();
      const opciones = supuestosDeclarados.get(clave)?.opciones || ['verificada', 'no_verificada', 'original'];
      suggestions = opciones
        .map(opt => {
          const sc = fuzzyMatchScore(valQuery, opt);
          if (sc === null) return null;
          const valStart = beforeCursor.indexOf('=') + 1 + (beforeCursor.slice(beforeCursor.indexOf('=') + 1).length - valQuery.length);
          return {
            id: `sup-v-${opt}`,
            kind: 'supuesto_estado' as AutocompleteKind,
            label: opt,
            detail: `Valor para supuesto '${clave}'`,
            insertText: valQuery ? opt : ` ${opt}`,
            replaceStartCol: valQuery ? valStart + 1 : safeCol + 1,
            replaceEndCol: safeCol + 1,
            ghostText: opt.startsWith(valQuery) ? opt.slice(valQuery.length) : undefined,
            frecuenciaUso: 1,
            score: sc
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    } else if (rest.trim().length > 0 || forceOpen) {
      suggestions = Array.from(supuestosDeclarados.entries())
        .map(([id, sup]) => {
          const sc = fuzzyMatchScore(rest.trim(), id);
          if (sc === null) return null;
          return {
            id: `sup-k-${id}`,
            kind: 'supuesto_clave' as AutocompleteKind,
            label: id,
            detail: sup.nombre,
            insertText: `${id} = ${sup.valorDefault}`,
            replaceStartCol: beforeCursor.toLowerCase().indexOf('supuesto:') + 10,
            replaceEndCol: safeCol + 1,
            ghostText: id.startsWith(rest.trim())
              ? `${id.slice(rest.trim().length)} = ${sup.valorDefault}`
              : undefined,
            frecuenciaUso: 1,
            score: sc
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    }
  } else if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*/.test(trimmedBefore)) {
    const rhsToken = currentToken.replace(/^=/, '');
    if (variablesExistentes.length > 0 && (rhsToken.length > 0 || forceOpen)) {
      suggestions = variablesExistentes
        .map(v => {
          const sc = fuzzyMatchScore(rhsToken, v);
          if (sc === null) return null;
          return {
            id: `var-rhs-${v}`,
            kind: 'variable' as AutocompleteKind,
            label: v,
            detail: 'Variable existente',
            insertText: v,
            replaceStartCol: tokenStart + 1,
            replaceEndCol: safeCol + 1,
            ghostText: v.startsWith(rhsToken) ? v.slice(rhsToken.length) : undefined,
            frecuenciaUso: 5,
            score: sc
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    }
  } else if (/^\/[^\s]*$/.test(trimmedBefore) || forceOpen) {
    // Solo abrir menú de comandos al escribir `/` o con Ctrl+Space explícito (no en línea vacía)
    suggestions = buildTopLevelSuggestions(trimmedBefore, indentLen, safeCol);
  }

  suggestions.sort((a, b) => b.score - a.score || b.frecuenciaUso - a.frecuenciaUso);
  const top = suggestions.slice(0, 7);
  return {
    isOpen: (atTokenEnd || forceOpen) && top.length > 0,
    suggestions: top,
    ghostText: atTokenEnd ? top[0]?.ghostText || '' : '',
    kind: top[0]?.kind
  };
}

// ─── Navegación Tab entre parámetros y cantidades del bloque ─────────────────

interface EditableSlot {
  linea: number;
  valStart1Based: number;
  valEnd1Based: number;
  paramId?: string;
}

function collectBlockEditableSlots(lines: string[], rootIdx: number, endIdx: number): EditableSlot[] {
  const slots: EditableSlot[] = [];

  for (let i = rootIdx; i <= endIdx; i++) {
    const line = lines[i] ?? '';
    const lineNum = i + 1;
    const isRoot = i === rootIdx;
    const trimmed = line.trim();

    if (isRoot && /^\s*\/tt\b/i.test(line)) {
      const regex = /([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*([^\s]+)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        const valStr = match[2];
        const valIdx = match.index + match[0].lastIndexOf(valStr);
        slots.push({
          linea: lineNum,
          valStart1Based: valIdx + 1,
          valEnd1Based: valIdx + 1 + valStr.length,
          paramId: match[1]
        });
      }
      continue;
    }

    if (!isRoot && /^[ \t]+/.test(line)) {
      // 1. Sub-línea parámetro: `  sup = 60`
      const paramMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*(.+?)\s*$/);
      if (paramMatch) {
        const valStr = paramMatch[2];
        const valIdx = line.lastIndexOf(valStr);
        slots.push({
          linea: lineNum,
          valStart1Based: valIdx + 1,
          valEnd1Based: valIdx + 1 + valStr.length,
          paramId: paramMatch[1]
        });
        continue;
      }

      // 2. Sub-línea material / +material / mo: con cantidad al final
      const qtyMatch = line.match(/^(.*?\s)(\d+(?:[.,]\d+)?|\([^)]+\))([a-zA-Z²]+)\s*$/);
      if (qtyMatch && !trimmed.startsWith('-')) {
        const valStr = qtyMatch[2];
        const valStart0 = qtyMatch[1].length;
        slots.push({
          linea: lineNum,
          valStart1Based: valStart0 + 1,
          valEnd1Based: valStart0 + 1 + valStr.length
        });
      }
    }
  }

  return slots;
}

/**
 * Encuentra el siguiente (o anterior con `direction = -1`) slot editable (parámetro o cantidad)
 * dentro del bloque del cursor, soportando bloques `/tt`, `tarea:` e `item:` multilínea indentados.
 */
export function findNextParameterSlotInDocument(
  texto: string,
  linea1Based: number,
  columna1Based: number,
  direction: 1 | -1 = 1
): TabJumpResult {
  const lines = texto.split(/\r?\n/);
  const curIdx = Math.max(0, Math.min(linea1Based - 1, lines.length - 1));
  const curRaw = lines[curIdx] ?? '';
  if (!curRaw.trim()) {
    return { handled: false, linea: linea1Based, columna: columna1Based };
  }

  // Encontrar inicio del bloque
  let rootIdx = curIdx;
  if (/^[ \t]+/.test(curRaw)) {
    const info = findEnclosingItemBlockInfo(lines, linea1Based);
    if (!info) return { handled: false, linea: linea1Based, columna: columna1Based };
    rootIdx = info.startIdx;
  } else if (!/^\s*(\/tt\b|tarea:|item:)/i.test(curRaw)) {
    return { handled: false, linea: linea1Based, columna: columna1Based };
  }

  // Encontrar fin del bloque
  let endIdx = rootIdx;
  for (let i = rootIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || !/^[ \t]+/.test(raw)) break;
    endIdx = i;
  }

  const slots = collectBlockEditableSlots(lines, rootIdx, endIdx);
  if (slots.length === 0) {
    return { handled: false, linea: linea1Based, columna: columna1Based };
  }

  let chosen: EditableSlot | undefined;
  if (direction === 1) {
    chosen =
      slots.find(
        s => s.linea > linea1Based || (s.linea === linea1Based && s.valStart1Based > columna1Based)
      ) || slots[0];
  } else {
    for (let i = slots.length - 1; i >= 0; i--) {
      const s = slots[i];
      if (s.linea < linea1Based || (s.linea === linea1Based && s.valEnd1Based < columna1Based)) {
        chosen = s;
        break;
      }
    }
    if (!chosen) chosen = slots[slots.length - 1];
  }

  return {
    handled: true,
    linea: chosen.linea,
    columna: chosen.valEnd1Based,
    selectionStartCol: chosen.valStart1Based,
    selectionEndCol: chosen.valEnd1Based,
    paramId: chosen.paramId
  };
}

/**
 * Encuentra el siguiente slot `param=valor` dentro de una línea `/tt` a partir de la columna actual
 * para permitir saltar rápidamente con `Tab` en escritorio.
 */
export function findNextParameterSlot(
  line: string,
  linea1Based: number,
  columna1Based: number
): TabJumpResult {
  return findNextParameterSlotInDocument(line, linea1Based, columna1Based, 1);
}

// ─── Paleta de Comandos (Ctrl+K / /) ─────────────────────────────────────────

/**
 * Construye el catálogo de acciones de la paleta de comandos (`Ctrl+K` / `/`),
 * combinando comandos fijos del flujo con trabajos tipo ordenados por frecuencia de uso.
 */
export function buildNotebookCommandPalette(
  ctx: NotebookDocumentContext
): NotebookCommandPaletteItem[] {
  const baseCommands: NotebookCommandPaletteItem[] = [
    {
      id: 'cmd-next-unvalorized',
      label: 'Ir a siguiente tarea sin valorizar',
      description: 'Salta a la próxima partida pendiente de valorización (Pasada 2)',
      category: 'flujo',
      shortcut: 'Ctrl+↓',
      keywords: ['siguiente', 'pendiente', 'valorizar', 'pasada'],
      actionType: 'next_unvalorized'
    },
    {
      id: 'cmd-valorize-current',
      label: 'Valorizar tarea actual',
      description: 'Resuelve precios vigentes Material → Producto → Oferta para el bloque activo',
      category: 'flujo',
      shortcut: 'Ctrl+Enter',
      keywords: ['valorizar', 'precio', 'resolver', 'confirmar'],
      actionType: 'valorize_current'
    },
    {
      id: 'cmd-valorize-all',
      label: 'Valorizar todas las pendientes',
      description: 'Aplica precios vigentes por defecto a todas las tareas sin valorizar',
      category: 'flujo',
      shortcut: 'Ctrl+Shift+Enter',
      keywords: ['valorizar', 'todas', 'pasada 2', 'precios'],
      actionType: 'valorize_all'
    },
    {
      id: 'cmd-toggle-pass',
      label: 'Alternar Pasada 1 (Esqueleto) / Pasada 2 (Valorización)',
      description: 'Cambia el modo por defecto al agregar nuevos ítems',
      category: 'flujo',
      keywords: ['pasada', 'esqueleto', 'modo'],
      actionType: 'toggle_pass_mode'
    },
    {
      id: 'cmd-new-capitulo',
      label: `Nuevo ${TERMINOLOGY.agrupadorSingular}`,
      description: 'Inserta un encabezado de agrupación (# Nombre)',
      category: 'estructura',
      keywords: ['capitulo', 'seccion', 'grupo', '#'],
      insertLine: '# Instalaciones eléctricas',
      actionType: 'insert_line'
    },
    {
      id: 'cmd-new-tarea-libre',
      label: 'Nueva tarea libre compuesta',
      description: 'Inserta un bloque tarea: con insumos y mano de obra',
      category: 'estructura',
      keywords: ['tarea', 'libre', 'compuesta'],
      insertLine: 'tarea: ',
      actionType: 'insert_line'
    },
    {
      id: 'cmd-new-item-libre',
      label: 'Nuevo ítem libre compacto',
      description: 'Inserta item: descripción cantidad unidad precio',
      category: 'estructura',
      keywords: ['item', 'libre', 'rapido'],
      insertLine: 'item: ',
      actionType: 'insert_line'
    },
    {
      id: 'cmd-new-supuesto',
      label: 'Declarar supuesto técnico',
      description: 'Inserta supuesto: clave = estado',
      category: 'estructura',
      keywords: ['supuesto', 'alcance', 'advertencia'],
      insertLine: 'supuesto: ',
      actionType: 'insert_line'
    },
    {
      id: 'cmd-new-nota',
      label: 'Nueva nota interna',
      description: 'Nota interna (se guarda en Dexie y nunca sale al cliente)',
      category: 'estructura',
      keywords: ['nota', 'interna', 'privada'],
      insertLine: 'nota: ',
      actionType: 'insert_line'
    },
    {
      id: 'cmd-toggle-preview',
      label: 'Vista previa documento cliente',
      description: 'Muestra el documento con Alcance y supuestos antes del total',
      category: 'documento',
      shortcut: 'Ctrl+P',
      keywords: ['vista previa', 'cliente', 'alcance', 'documento'],
      actionType: 'toggle_preview'
    },
    {
      id: 'cmd-shortcuts-help',
      label: 'Ayuda de atajos de teclado',
      description: 'Muestra la guía rápida de teclado del notebook',
      category: 'documento',
      shortcut: '?',
      keywords: ['atajos', 'ayuda', 'teclado', 'help'],
      actionType: 'toggle_shortcuts_help'
    },
    {
      id: 'cmd-open-suggestions',
      label: 'Mostrar sugerencias contextuales',
      description: 'Abre el autocompletado en la posición actual del cursor',
      category: 'flujo',
      shortcut: 'Ctrl+Space',
      keywords: ['sugerencias', 'autocompletar', 'materiales', 'parametros'],
      actionType: 'open_suggestions'
    },
    {
      id: 'cmd-undo',
      label: 'Deshacer último cambio',
      description: 'Revierte la última edición del documento',
      category: 'documento',
      shortcut: 'Ctrl+Z',
      keywords: ['deshacer', 'undo', 'atras'],
      actionType: 'undo'
    },
    {
      id: 'cmd-redo',
      label: 'Rehacer cambio',
      description: 'Reaplica el cambio deshecho',
      category: 'documento',
      shortcut: 'Ctrl+Y',
      keywords: ['rehacer', 'redo', 'adelante'],
      actionType: 'redo'
    },
    {
      id: 'cmd-save',
      label: 'Guardar cotización ahora',
      description: 'Persiste el presupuesto actual en IndexedDB',
      category: 'documento',
      shortcut: 'Ctrl+S',
      keywords: ['guardar', 'save'],
      actionType: 'save'
    }
  ];

  const sortedTareas = [...ctx.tareasTipo].sort(
    (a, b) => (b.frecuenciaUso ?? 0) - (a.frecuenciaUso ?? 0)
  );
  const ttCommands: NotebookCommandPaletteItem[] = sortedTareas.map(t => {
    const slug = t.slug || slugifyIdentificador(t.nombre);
    const paramLines = (t.parametros || []).map(p => `  ${p.id} = ${p.valorDefault ?? 1}`);
    return {
      id: `cmd-tt-${t.id}`,
      label: `Insertar /tt ${slug}`,
      description: t.nombre,
      category: 'trabajo_tipo',
      keywords: ['tt', 'trabajo tipo', slug, t.nombre, t.categoria],
      insertLine: paramLines.length > 0 ? `/tt ${slug}\n${paramLines.join('\n')}` : `/tt ${slug}`,
      actionType: 'insert_line'
    };
  });

  return [...baseCommands, ...ttCommands];
}

export function filterNotebookCommandPalette(
  commands: NotebookCommandPaletteItem[],
  query: string
): NotebookCommandPaletteItem[] {
  const q = query.trim();
  if (!q) return commands;
  return commands
    .map(cmd => {
      const candidates = [cmd.label, cmd.description, ...cmd.keywords];
      let best = -1;
      for (const c of candidates) {
        const sc = fuzzyMatchScore(q, c);
        if (sc !== null && sc > best) best = sc;
      }
      return best >= 0 ? { cmd, best } : null;
    })
    .filter((x): x is { cmd: NotebookCommandPaletteItem; best: number } => x !== null)
    .sort((a, b) => b.best - a.best)
    .map(x => x.cmd);
}

/**
 * Ejecuta parseo + cálculo de líneas de bloque + aplicación en una sola llamada pura.
 */
export function evaluateNotebookText(
  texto: string,
  presupuestoBase: Partial<Presupuesto>,
  ctx: NotebookDocumentContext,
  options: ApplyNotebookOptions = {}
): {
  parseResult: NotebookParseResult;
  aplicacion: ResultadoAplicacionNotebook;
} {
  const parseResult = parse(texto, buildParseContext(ctx));
  const blockLineNumbers = computeBlockStartLines(texto, parseResult.bloques, parseResult.errores);
  const aplicacion = applyNotebookBlocksToPresupuesto(
    presupuestoBase,
    parseResult.bloques,
    ctx,
    { ...options, blockLineNumbers }
  );
  return { parseResult, aplicacion };
}

// ─── Helpers para Modo Móvil ("Ejecutar") ────────────────────────────────────

/**
 * Ordena los Trabajos Tipo para el buscador móvil:
 * 1) Recientes arriba (`ultimoUsoFecha` descendente)
 * 2) Más frecuentes (`frecuenciaUso` descendente)
 * 3) Alfabético; cuando hay consulta, filtra por coincidencia difusa.
 */
export function ordenarTareasTipoParaMovil(
  tareasTipo: TareaTipo[],
  query = ''
): TareaTipo[] {
  const q = query.trim();

  const compareRecienteYFrecuencia = (a: TareaTipo, b: TareaTipo): number => {
    const timeA = a.ultimoUsoFecha ? new Date(a.ultimoUsoFecha).getTime() : 0;
    const timeB = b.ultimoUsoFecha ? new Date(b.ultimoUsoFecha).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    const freqDiff = (b.frecuenciaUso ?? 0) - (a.frecuenciaUso ?? 0);
    if (freqDiff !== 0) return freqDiff;
    return a.nombre.localeCompare(b.nombre);
  };

  if (!q) {
    return [...tareasTipo].sort(compareRecienteYFrecuencia);
  }

  return tareasTipo
    .map(t => {
      const slug = t.slug || slugifyIdentificador(t.nombre);
      const best = Math.max(
        fuzzyMatchScore(q, t.nombre) ?? -1,
        fuzzyMatchScore(q, slug) ?? -1,
        fuzzyMatchScore(q, t.categoria) ?? -1
      );
      return best >= 0 ? { t, best } : null;
    })
    .filter((x): x is { t: TareaTipo; best: number } => x !== null)
    .sort((a, b) => b.best - a.best || compareRecienteYFrecuencia(a.t, b.t))
    .map(x => x.t);
}

/**
 * Evalúa si un parámetro del esquema del Trabajo Tipo debe mostrarse según su condición opcional.
 */
export function evaluarVisibilidadParametroEnEsquema(
  param: ParametroTrabajoTipo,
  valoresActuales: Record<string, number>,
  scopeGlobal: Record<string, number> = {}
): boolean {
  if (!param.condicion || !param.condicion.trim()) {
    return true;
  }
  return evaluateCondition(param.condicion, { ...scopeGlobal, ...valoresActuales });
}

/**
 * Construye un bloque canónico `/tt` multilínea indentado desde un `TareaTipo` y valores iniciales opcionales.
 */
export function construirLineaTareaTipoDesdeEsquema(
  tarea: TareaTipo,
  valoresParametros?: Record<string, number>
): string {
  const slug = tarea.slug || slugifyIdentificador(tarea.nombre);
  const params = tarea.parametros || [];
  if (params.length === 0) {
    const cant = valoresParametros?.cantidad;
    return cant !== undefined && cant !== 1 ? `/tt ${slug}\n  cantidad = ${cant}` : `/tt ${slug}`;
  }
  const paramLines = params.map(p => {
    const val = valoresParametros?.[p.id] ?? p.valorDefault ?? 1;
    return `  ${p.id} = ${val}`;
  });
  return `/tt ${slug}\n${paramLines.join('\n')}`;
}

/**
 * Construye una línea canónica de ítem libre rápido desde el atajo móvil de 3 campos
 * (descripción, cantidad, precio unitario).
 */
export function construirLineaItemLibreRapido(
  descripcion: string,
  cantidad: number,
  precioUnitario: number
): string {
  const descLimpia = descripcion.trim().replace(/\s+/g, ' ');
  const cantVal = Math.max(0.01, safeNum(cantidad) || 1);
  const precioVal = Math.max(0, safeNum(precioUnitario));
  return `item: ${descLimpia}  ${cantVal} u  ${precioVal}`;
}

/**
 * Actualiza o inserta `paramId=valor` en una línea `/tt` existente sin perder ajustes `-`/`+`.
 */
export function actualizarParametroEnLineaTt(
  line: string,
  paramId: string,
  valor: number
): string {
  const escaped = paramId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const paramRegex = new RegExp(`(^|\\s)${escaped}\\s*=\\s*[^\\s]+`);
  if (paramRegex.test(line)) {
    return line.replace(paramRegex, `$1${paramId}=${valor}`);
  }
  return `${line.trimEnd()}  ${paramId}=${valor}`;
}

/**
 * Actualiza o inserta `  paramId = valor` dentro de un bloque `/tt` multilínea indentado.
 */
export function actualizarParametroEnBloque(
  texto: string,
  startLinea1Based: number,
  paramId: string,
  valor: number
): string {
  const lines = texto.split(/\r?\n/);
  const startIdx = startLinea1Based - 1;
  if (startIdx < 0 || startIdx >= lines.length) return texto;

  const escaped = paramId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const subRegex = new RegExp(`^([ \\t]+)${escaped}\\s*=\\s*.*$`);
  let endIdx = startIdx;

  for (let i = startIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim() || !/^[ \t]+/.test(lines[i])) break;
    endIdx = i;
    if (subRegex.test(lines[i])) {
      lines[i] = lines[i].replace(subRegex, `$1${paramId} = ${valor}`);
      return lines.join('\n');
    }
  }

  // Fallback si estaba inline en la línea raíz /tt
  const inlineRegex = new RegExp(`(^|\\s)${escaped}\\s*=\\s*[^\\s]+`);
  if (inlineRegex.test(lines[startIdx])) {
    lines[startIdx] = lines[startIdx].replace(inlineRegex, `$1${paramId}=${valor}`);
    return lines.join('\n');
  }

  lines.splice(endIdx + 1, 0, `  ${paramId} = ${valor}`);
  return lines.join('\n');
}

/**
 * Elimina de `texto` el bloque cuya línea inicial es `startLinea1Based` y cualquier sub-línea indentada.
 */
export function eliminarBloqueEnLinea(texto: string, startLinea1Based: number): string {
  const lines = texto.split(/\r?\n/);
  const startIdx = startLinea1Based - 1;
  if (startIdx < 0 || startIdx >= lines.length) return texto;

  let endIdx = startIdx + 1;
  while (endIdx < lines.length && /^[ \t]+/.test(lines[endIdx])) {
    endIdx++;
  }
  lines.splice(startIdx, endIdx - startIdx);
  return lines.join('\n').replace(/^\n+|\n+$/g, '');
}

