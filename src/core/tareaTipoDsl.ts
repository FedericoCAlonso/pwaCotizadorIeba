import YAML from 'yaml';
import {
  TareaFormData,
  TareaTipo,
  Insumo,
  CategoriaManoDeObra,
  InsumoEnTarea,
  ManoObraEnTarea,
  ParametroTrabajoTipo,
  VariableCalculadaTrabajoTipo,
  OpcionVariableTrabajo,
  CuadrillaRecomendada,
  NaturalezaTrabajo
} from './types';
import { DSLDiagnostic } from '../components/presupuesto/experto/dslParser';

/**
 * Normaliza cadenas para matching difuso (sin tildes, minúsculas)
 */
export function normalizeDslString(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Formatea un número o porcentaje de forma amigable en YAML
 */
function formatNumberOrFormula(val?: number, formula?: string): string | number | undefined {
  if (formula && formula.trim()) return formula.trim();
  if (typeof val === 'number') return val;
  return undefined;
}

/**
 * Serializa un TareaFormData a texto YAML limpio y legible para el usuario.
 * No muestra encabezados internos del sistema para mantener la experiencia limpia.
 */
export function serializeTareaTipoToDSL(
  data: TareaFormData,
  insumosMap: Map<string, Insumo>,
  manoObraMap: Map<string, CategoriaManoDeObra>
): string {
  const doc: Record<string, unknown> = {};

  // 1. Metadatos Generales
  doc.nombre = data.nombre || 'Nuevo Trabajo Tipo';
  if (data.categoria) doc.categoria = data.categoria;
  doc.unidad = data.unidad || 'u';
  if (data.naturaleza && data.naturaleza !== 'instalacion') {
    doc.naturaleza = data.naturaleza;
  }

  // Honorarios y servicios especiales (si aplican)
  if (data.honorarioBase && data.honorarioBase > 0) {
    doc.honorario_base = data.honorarioBase;
  }
  if (data.formulaHonorarios && data.formulaHonorarios.trim()) {
    doc.formula_honorarios = data.formulaHonorarios.trim();
  }
  if (data.costoServicioDirecto && data.costoServicioDirecto > 0) {
    doc.costo_servicio_directo = data.costoServicioDirecto;
  }

  // Costo Fijo y Setup
  if (data.costoFijoOperativo && data.costoFijoOperativo > 0) {
    doc.costo_fijo = data.costoFijoOperativo;
  }
  if (data.descripcionCostoFijo && data.descripcionCostoFijo.trim()) {
    doc.descripcion_costo_fijo = data.descripcionCostoFijo.trim();
  }
  if (data.horasSetupTotal && data.horasSetupTotal > 0) {
    doc.horas_setup = data.horasSetupTotal;
  }
  if (data.cuadrillaRecomendada && (data.cuadrillaRecomendada.oficiales > 0 || data.cuadrillaRecomendada.ayudantes > 0)) {
    doc.cuadrilla = {
      oficiales: data.cuadrillaRecomendada.oficiales || 0,
      ayudantes: data.cuadrillaRecomendada.ayudantes || 0,
    };
  }

  // 2. Parámetros de Entrada (Inputs)
  if (data.parametros && data.parametros.length > 0) {
    doc.parametros = data.parametros.map((p: ParametroTrabajoTipo) => {
      const pObj: Record<string, unknown> = {
        id: p.id,
        nombre: p.nombre,
      };
      if (p.tipo && p.tipo !== 'numero') pObj.tipo = p.tipo;
      pObj.default = p.valorDefault ?? 1;
      if (p.unidad) pObj.unidad = p.unidad;
      if (p.descripcion) pObj.descripcion = p.descripcion;
      if (p.condicion) pObj.condicion = p.condicion;
      if (p.opciones && p.opciones.length > 0) {
        pObj.opciones = p.opciones.map((o: OpcionVariableTrabajo) => ({
          id: o.id,
          label: o.label,
          valor: o.valor,
        }));
      }
      return pObj;
    });
  }

  // 3. Cálculos Intermedios (Variables Calculadas)
  if (data.variables && data.variables.length > 0) {
    doc.calculos = data.variables.map((v: VariableCalculadaTrabajoTipo) => {
      const vObj: Record<string, unknown> = {
        id: v.id,
        formula: v.formula,
      };
      if (v.nombre && v.nombre !== v.id) vObj.nombre = v.nombre;
      if (v.unidad) vObj.unidad = v.unidad;
      if (v.descripcion) vObj.descripcion = v.descripcion;
      return vObj;
    });
  }

  // 4. Materiales / Insumos
  if (data.insumos && data.insumos.length > 0) {
    doc.materiales = data.insumos.map((item: InsumoEnTarea) => {
      const insumo = item.materialId ? insumosMap.get(item.materialId) : undefined;
      const mObj: Record<string, unknown> = {
        material: insumo?.nombre || item.nombreSlot || item.materialId || 'Insumo sin nombre',
      };
      if (item.formula && item.formula.trim()) {
        mObj.formula = item.formula.trim();
      } else {
        mObj.cantidad = item.cantidad ?? 1;
      }
      if (item.condicion && item.condicion.trim()) {
        mObj.condicion = item.condicion.trim();
      }
      return mObj;
    });
  }

  // 5. Mano de Obra
  if (data.manoObra && data.manoObra.length > 0) {
    doc.mano_obra = data.manoObra.map((mo: ManoObraEnTarea) => {
      const cat = mo.categoriaId ? manoObraMap.get(mo.categoriaId) : undefined;
      const moObj: Record<string, unknown> = {
        categoria: cat?.nombre || mo.categoriaId || 'Oficial',
      };
      if (mo.formula && mo.formula.trim()) {
        moObj.formula = mo.formula.trim();
      } else {
        moObj.horas = mo.horas ?? 1;
      }
      if (mo.horasSetup && mo.horasSetup > 0) {
        moObj.horas_setup = mo.horasSetup;
      }
      if (mo.condicion && mo.condicion.trim()) {
        moObj.condicion = mo.condicion.trim();
      }
      return moObj;
    });
  }

  // 6. Cláusulas y Textos
  if (data.notasTecnicas || data.clausulaExclusiones) {
    const clausulasObj: Record<string, string> = {};
    if (data.notasTecnicas && data.notasTecnicas.trim()) {
      clausulasObj.notas = data.notasTecnicas.trim();
    }
    if (data.clausulaExclusiones && data.clausulaExclusiones.trim()) {
      clausulasObj.exclusiones = data.clausulaExclusiones.trim();
    }
    doc.clausulas = clausulasObj;
  }

  return YAML.stringify(doc, { indent: 2, lineWidth: 0 });
}

export interface ParseTareaTipoResult {
  data: TareaFormData;
  diagnostics: DSLDiagnostic[];
}

/**
 * Parsea texto YAML generado o editado por el usuario hacia TareaFormData.
 * Admite tanto formas abreviadas como completas y realiza matching difuso de insumos y mano de obra.
 */
export function parseTareaTipoFromDSL(
  yamlText: string,
  insumosMap: Map<string, Insumo>,
  manoObraMap: Map<string, CategoriaManoDeObra>,
  categoriasList: string[] = []
): ParseTareaTipoResult {
  const diagnostics: DSLDiagnostic[] = [];

  // Valores predeterminados seguros
  const data: TareaFormData = {
    nombre: '',
    categoria: categoriasList[0] || 'General',
    unidad: 'u',
    naturaleza: 'instalacion',
    honorarioBase: 0,
    formulaHonorarios: '',
    costoServicioDirecto: 0,
    notasTecnicas: '',
    clausulaExclusiones: '',
    costoFijoOperativo: 0,
    descripcionCostoFijo: '',
    horasSetupTotal: 0,
    cuadrillaRecomendada: { oficiales: 1, ayudantes: 0 },
    parametros: [],
    variables: [],
    insumos: [],
    manoObra: [],
  };

  if (!yamlText || !yamlText.trim()) {
    diagnostics.push({
      line: 1,
      type: 'warning',
      message: 'El documento está vacío. Escribe o pega la definición del trabajo tipo.',
    });
    return { data, diagnostics };
  }

  // Índices de búsqueda para matching difuso
  const insumosByName = new Map<string, Insumo>();
  for (const ins of insumosMap.values()) {
    insumosByName.set(normalizeDslString(ins.nombre), ins);
    if (ins.codigoProveedor) insumosByName.set(normalizeDslString(ins.codigoProveedor), ins);
  }

  const manoObraByName = new Map<string, CategoriaManoDeObra>();
  for (const mo of manoObraMap.values()) {
    manoObraByName.set(normalizeDslString(mo.nombre), mo);
    manoObraByName.set(normalizeDslString(mo.id), mo);
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlText);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Extraer número de línea del error de YAML si existe
    const lineMatch = errorMsg.match(/at line (\d+)/i) || errorMsg.match(/:(\d+):/);
    const line = lineMatch ? parseInt(lineMatch[1], 10) : 1;

    diagnostics.push({
      line,
      type: 'error',
      message: `Error de sintaxis YAML: ${errorMsg}`,
    });
    return { data, diagnostics };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    diagnostics.push({
      line: 1,
      type: 'error',
      message: 'El documento YAML debe ser un objeto con propiedades (nombre, categoria, parametros, etc.).',
    });
    return { data, diagnostics };
  }

  const root = parsed as Record<string, unknown>;

  // 1. Metadatos Generales
  if (typeof root.nombre === 'string' && root.nombre.trim()) {
    data.nombre = root.nombre.trim();
  } else {
    diagnostics.push({
      line: 1,
      type: 'warning',
      message: 'Falta la propiedad "nombre" del trabajo tipo.',
    });
  }

  if (typeof root.categoria === 'string' && root.categoria.trim()) {
    data.categoria = root.categoria.trim();
  }

  if (typeof root.unidad === 'string' && root.unidad.trim()) {
    data.unidad = root.unidad.trim();
  }

  if (typeof root.naturaleza === 'string') {
    const nat = root.naturaleza.trim().toLowerCase();
    if (nat === 'servicio_profesional' || nat === 'servicio_tercerizado' || nat === 'instalacion') {
      data.naturaleza = nat as NaturalezaTrabajo;
    }
  }

  if (typeof root.honorario_base === 'number') {
    data.honorarioBase = root.honorario_base;
  }
  if (typeof root.formula_honorarios === 'string') {
    data.formulaHonorarios = root.formula_honorarios.trim();
  }
  if (typeof root.costo_servicio_directo === 'number') {
    data.costoServicioDirecto = root.costo_servicio_directo;
  }

  if (typeof root.costo_fijo === 'number') {
    data.costoFijoOperativo = root.costo_fijo;
  }
  if (typeof root.descripcion_costo_fijo === 'string') {
    data.descripcionCostoFijo = root.descripcion_costo_fijo.trim();
  }
  if (typeof root.horas_setup === 'number') {
    data.horasSetupTotal = root.horas_setup;
  }

  if (root.cuadrilla && typeof root.cuadrilla === 'object') {
    const c = root.cuadrilla as Record<string, unknown>;
    data.cuadrillaRecomendada = {
      oficiales: typeof c.oficiales === 'number' ? c.oficiales : 1,
      ayudantes: typeof c.ayudantes === 'number' ? c.ayudantes : 0,
    };
  }

  // 2. Parámetros de Entrada
  const rawParams = root.parametros || root.params || root.variables_entrada;
  if (Array.isArray(rawParams)) {
    data.parametros = rawParams
      .map((p, idx): ParametroTrabajoTipo | null => {
        if (!p || typeof p !== 'object') return null;
        const pObj = p as Record<string, unknown>;
        const id = typeof pObj.id === 'string' ? pObj.id.trim() : `param_${idx + 1}`;
        const nombre = typeof pObj.nombre === 'string' ? pObj.nombre.trim() : id;
        const rawTipo = typeof pObj.tipo === 'string' ? pObj.tipo.trim().toLowerCase() : 'numero';
        const tipo: 'numero' | 'select' | 'boolean' =
          rawTipo === 'select' || rawTipo === 'boolean' ? rawTipo : 'numero';

        const valorDefault =
          typeof pObj.default === 'number'
            ? pObj.default
            : typeof pObj.valorDefault === 'number'
            ? pObj.valorDefault
            : typeof pObj.valor === 'number'
            ? pObj.valor
            : 1;

        const unidad = typeof pObj.unidad === 'string' ? pObj.unidad.trim() : undefined;
        const descripcion = typeof pObj.descripcion === 'string' ? pObj.descripcion.trim() : undefined;
        const condicion = typeof pObj.condicion === 'string' ? pObj.condicion.trim() : undefined;

        let opciones: ParametroTrabajoTipo['opciones'] = undefined;
        if (Array.isArray(pObj.opciones)) {
          opciones = pObj.opciones
            .filter((o): o is Record<string, unknown> => o && typeof o === 'object')
            .map((o, oIdx) => ({
              id: typeof o.id === 'string' ? o.id : `opc_${oIdx + 1}`,
              label: typeof o.label === 'string' ? o.label : String(o.id || oIdx + 1),
              valor: typeof o.valor === 'number' ? o.valor : oIdx + 1,
            }));
        }

        return {
          id,
          nombre,
          tipo,
          valorDefault,
          unidad,
          descripcion,
          opciones,
          condicion,
        };
      })
      .filter((p): p is ParametroTrabajoTipo => p !== null);
  }

  // 3. Cálculos Intermedios (Variables Calculadas)
  const rawCalculos = root.calculos || root.variables || root.formulas;
  if (Array.isArray(rawCalculos)) {
    data.variables = rawCalculos
      .map((v, idx): VariableCalculadaTrabajoTipo | null => {
        if (!v || typeof v !== 'object') return null;
        const vObj = v as Record<string, unknown>;
        const id = typeof vObj.id === 'string' ? vObj.id.trim() : `calc_${idx + 1}`;
        const formula =
          typeof vObj.formula === 'string'
            ? vObj.formula.trim()
            : typeof vObj.calculo === 'string'
            ? vObj.calculo.trim()
            : '';

        if (!formula) {
          diagnostics.push({
            line: 1,
            type: 'warning',
            message: `El cálculo "${id}" no tiene fórmula definida.`,
          });
        }

        return {
          id,
          nombre: typeof vObj.nombre === 'string' ? vObj.nombre.trim() : id,
          formula,
          unidad: typeof vObj.unidad === 'string' ? vObj.unidad.trim() : undefined,
          descripcion: typeof vObj.descripcion === 'string' ? vObj.descripcion.trim() : undefined,
        };
      })
      .filter((v): v is VariableCalculadaTrabajoTipo => v !== null);
  } else if (rawCalculos && typeof rawCalculos === 'object') {
    // Formato abreviado de diccionario: { metros_cable: "bocas * 8", horas: "bocas * 1.5" }
    data.variables = Object.entries(rawCalculos as Record<string, unknown>).map(([key, val]) => {
      const formula = typeof val === 'string' ? val.trim() : String(val);
      return {
        id: key.trim(),
        nombre: key.trim(),
        formula,
      };
    });
  }

  // 4. Materiales / Insumos
  const rawMateriales = root.materiales || root.insumos;
  if (Array.isArray(rawMateriales)) {
    data.insumos = rawMateriales
      .map((m): InsumoEnTarea | null => {
        if (!m || typeof m !== 'object') return null;
        const mObj = m as Record<string, unknown>;

        const materialName =
          typeof mObj.material === 'string'
            ? mObj.material.trim()
            : typeof mObj.insumo === 'string'
            ? mObj.insumo.trim()
            : typeof mObj.nombre === 'string'
            ? mObj.nombre.trim()
            : '';

        if (!materialName) {
          diagnostics.push({
            line: 1,
            type: 'error',
            message: 'Se encontró una partida de material sin nombre o especificación.',
          });
          return null;
        }

        // Búsqueda por ID directo o por nombre difuso
        const matchedInsumo =
          insumosMap.get(materialName) ||
          insumosByName.get(normalizeDslString(materialName));

        if (!matchedInsumo) {
          diagnostics.push({
            line: 1,
            type: 'warning',
            message: `Material no encontrado en el catálogo: "${materialName}". Se guardará como referencia libre.`,
          });
        }

        const formula = typeof mObj.formula === 'string' ? mObj.formula.trim() : undefined;
        const cantidad =
          typeof mObj.cantidad === 'number'
            ? mObj.cantidad
            : typeof mObj.cant === 'number'
            ? mObj.cant
            : 1;

        const condicion = typeof mObj.condicion === 'string' ? mObj.condicion.trim() : undefined;

        return {
          materialId: matchedInsumo ? matchedInsumo.id : undefined,
          nombreSlot: matchedInsumo ? matchedInsumo.nombre : materialName,
          cantidad: formula ? 1 : cantidad,
          formula,
          condicion,
        };
      })
      .filter((m): m is InsumoEnTarea => m !== null);
  }

  // 5. Mano de Obra
  const rawManoObra = root.mano_obra || root.manoObra || root.labor;
  if (Array.isArray(rawManoObra)) {
    data.manoObra = rawManoObra
      .map((mo): ManoObraEnTarea | null => {
        if (!mo || typeof mo !== 'object') return null;
        const moObj = mo as Record<string, unknown>;

        const catName =
          typeof moObj.categoria === 'string'
            ? moObj.categoria.trim()
            : typeof moObj.nombre === 'string'
            ? moObj.nombre.trim()
            : '';

        if (!catName) {
          diagnostics.push({
            line: 1,
            type: 'error',
            message: 'Se encontró una partida de mano de obra sin categoría.',
          });
          return null;
        }

        const matchedMo =
          manoObraMap.get(catName) ||
          manoObraByName.get(normalizeDslString(catName));

        if (!matchedMo) {
          diagnostics.push({
            line: 1,
            type: 'warning',
            message: `Categoría de mano de obra no encontrada: "${catName}".`,
          });
        }

        const formula = typeof moObj.formula === 'string' ? moObj.formula.trim() : undefined;
        const horas =
          typeof moObj.horas === 'number'
            ? moObj.horas
            : typeof moObj.hs === 'number'
            ? moObj.hs
            : 1;

        const horasSetup =
          typeof moObj.horas_setup === 'number'
            ? moObj.horas_setup
            : typeof moObj.setup === 'number'
            ? moObj.setup
            : undefined;

        const condicion = typeof moObj.condicion === 'string' ? moObj.condicion.trim() : undefined;

        const fallbackCatId = manoObraMap.keys().next().value || 'cat_oficial';

        return {
          categoriaId: matchedMo ? matchedMo.id : fallbackCatId,
          horas: formula ? 1 : horas,
          horasSetup,
          formula,
          condicion,
        };
      })
      .filter((mo): mo is ManoObraEnTarea => mo !== null);
  }

  // 6. Cláusulas y Textos
  const rawClausulas = root.clausulas || root.textos || root.notas;
  if (rawClausulas && typeof rawClausulas === 'object' && !Array.isArray(rawClausulas)) {
    const cObj = rawClausulas as Record<string, unknown>;
    if (typeof cObj.notas === 'string') data.notasTecnicas = cObj.notas.trim();
    if (typeof cObj.exclusiones === 'string') data.clausulaExclusiones = cObj.exclusiones.trim();
  } else if (typeof rawClausulas === 'string') {
    data.notasTecnicas = rawClausulas.trim();
  }

  return { data, diagnostics };
}
