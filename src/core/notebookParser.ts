/**
 * notebookParser.ts - Parser y serializador puro (sin estado ni dependencias de UI)
 * para el Notebook de Cotizaciones.
 *
 * Gramática determinista:
 * - Variable:        <ident> = <expresión> [<unidad>]
 * - Supuesto:        supuesto: <clave> = <valor>
 * - Nota interna:    nota: <texto>
 * - Capítulo:        # <nombre>
 * - Trabajo tipo:    /tt <ref> [cantidad=<n_o_expr>] [param=valor ...] [-quitado ...] [+matRef <cant><unidad> ...]
 * - Tarea contenedor: tarea: <descripción>  (acepta sub-líneas indentadas: cantidad, parámetros, mat:, mo:, serv:)
 * - Ítem libre:      item: <descripción>  [<cant><unidad>] [<precio>] [param=valor ...]
 * - Sub-líneas dentro de un ítem (/tt, tarea:, item:):
 *   - Material:      [mat:] <ref_material> [[Marca/Producto]]  [<cant_o_formula><unidad>]
 *   - Mano de obra:  mo: <ref_categoria>  [<horas_o_formula>h]
 *   - Servicio:      serv: <descripción>  [<cant_o_formula> <unidad>  <costo_o_formula>]
 *   - Atributos indentados: cantidad = <expr> [<unidad>], horas = <expr> [h|hs], precio/costo = <expr>, <param> = <expr>
 */

import {
  CategoriaManoDeObra,
  Material,
  Producto,
  TareaTipo,
} from './types';
import { RESERVED_KEYWORDS } from './mathEvaluator';
import { evaluateUnitExpression, isKnownUnitToken } from './unitAlgebra';
import {
  extraerDependenciasExpresion,
  slugifyIdentificador,
} from './notebookDomain';

export const UNIDADES_CONOCIDAS_DEFAULT = [
  'm',
  'mm',
  'cm',
  'km',
  'u',
  'gl',
  'kg',
  'rollo',
  'caja',
  'par',
  'juego',
  'litro',
  'ml',
  'tramo',
  'h',
  'hs',
  'min',
  'boca',
  'bocas',
  'circuito',
  'circuitos',
  'cm2',
  'cm²',
  'm2',
  'm²',
  'm3',
  'm³',
  'kw',
  'kva',
  'servicio',
] as const;

export type NotebookErrorCode =
  | 'directiva_desconocida'
  | 'sintaxis_invalida'
  | 'nombre_reservado'
  | 'expresion_invalida'
  | 'cantidad_invalida'
  | 'unidad_desconocida'
  | 'referencia_inexistente'
  | 'ambiguo'
  | 'parametro_desconocido'
  | 'valor_supuesto_invalido'
  | 'linea_fuera_de_item'
  | 'producto_inexistente'
  | 'producto_ambiguo';

export interface NotebookParseError {
  linea: number; // Base 1
  columna: number; // Base 1
  longitud: number;
  codigo: NotebookErrorCode;
  mensaje: string;
  textoLinea: string;
  candidatos?: string[];
}

export interface NotebookMaterialLinea {
  tipo: 'material';
  referencia: string;
  materialId?: string;
  productoId?: string;
  productoReferencia?: string;
  cantidad?: number;
  formulaCantidad?: string;
  unidad: string;
}

export interface NotebookManoObraLinea {
  tipo: 'mano_obra';
  referencia: string;
  categoriaId?: string;
  horas?: number;
  formulaHoras?: string;
  unidad: 'h' | 'hs';
}

export interface NotebookServicioLinea {
  tipo: 'servicio';
  descripcion: string;
  cantidad?: number;
  formulaCantidad?: string;
  unidad: string;
  costoUnitario?: number;
  formulaCosto?: string;
}

export type NotebookItemLinea =
  | NotebookMaterialLinea
  | NotebookManoObraLinea
  | NotebookServicioLinea;

export interface NotebookAjusteAgregado {
  referencia: string;
  materialId?: string;
  productoId?: string;
  productoReferencia?: string;
  cantidad?: number;
  formulaCantidad?: string;
  unidad: string;
}

export interface NotebookVariableBlock {
  tipo: 'variable';
  id: string;
  expresion: string;
  unidad?: string;
}

export interface NotebookSupuestoBlock {
  tipo: 'supuesto';
  clave: string;
  valor: string;
}

export interface NotebookNotaInternaBlock {
  tipo: 'nota_interna';
  texto: string;
}

export interface NotebookCapituloBlock {
  tipo: 'capitulo';
  nombre: string;
}

export interface NotebookTareaTipoBlock {
  tipo: 'tarea_tipo';
  referencia: string;
  tareaTipoId?: string;
  cantidad?: number;
  formulaCantidad?: string;
  overridesParametros: Record<string, number | string>;
  quitados: string[];
  agregados: NotebookAjusteAgregado[];
  lineas: NotebookItemLinea[];
}

export interface NotebookItemLibreBlock {
  tipo: 'item_libre';
  modo: 'tarea' | 'item';
  descripcion: string;
  cantidad?: number;
  formulaCantidad?: string;
  unidad?: string;
  precioUnitario?: number;
  formulaPrecio?: string;
  parametros: Record<string, number | string>;
  lineas: NotebookItemLinea[];
}

export type NotebookBlock =
  | NotebookVariableBlock
  | NotebookSupuestoBlock
  | NotebookNotaInternaBlock
  | NotebookCapituloBlock
  | NotebookTareaTipoBlock
  | NotebookItemLibreBlock;

export interface NotebookParseContext {
  tareasTipo: TareaTipo[];
  materiales: Material[];
  productos?: Producto[];
  manoObra?: CategoriaManoDeObra[];
  unidadesValidas?: string[];
}

export interface NotebookParseResult {
  bloques: NotebookBlock[];
  errores: NotebookParseError[];
  valido: boolean;
}

const DIRECTIVAS_CON_DOS_PUNTOS = new Set([
  'supuesto',
  'nota',
  'tarea',
  'item',
  'mat',
  'mo',
  'serv',
]);

function normalizeText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokenizeCatalogText(str: string): string[] {
  const norm = normalizeText(str);
  const rawTokens = norm.split(/[^a-z0-9.,²]+/).filter(Boolean);
  const out = new Set<string>();
  for (const raw of rawTokens) {
    const clean = raw.replace(/,/g, '.');
    out.add(clean);
    // Separa número seguido de unidad (ej: "2.5mm²" -> "2.5" y "mm²")
    const numUnit = clean.match(/^(\d+(?:\.\d+)?)([a-z²]+)$/);
    if (numUnit) {
      out.add(numUnit[1]);
      out.add(numUnit[2]);
    }
  }
  return Array.from(out);
}

function buildValidUnitsMap(contexto: NotebookParseContext): Map<string, string> {
  const map = new Map<string, string>();
  const add = (u: string) => {
    const clean = (u || '').trim();
    if (!clean) return;
    map.set(normalizeText(clean), clean);
  };
  UNIDADES_CONOCIDAS_DEFAULT.forEach(add);
  (contexto.unidadesValidas ?? []).forEach(add);
  for (const m of contexto.materiales) {
    if (m.unidadVenta) {
      const firstWord = m.unidadVenta.trim().split(/\s+/)[0];
      if (firstWord) add(firstWord);
    }
  }
  return map;
}

function validateMathSyntax(expr: string): { valid: boolean; error?: string } {
  const trimmed = (expr || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Expresión vacía.' };
  }
  const deps = extraerDependenciasExpresion(trimmed);
  const dummyScope: Record<string, number> = {};
  for (const d of deps) {
    dummyScope[d] = 1.137;
  }
  const res = evaluateUnitExpression(trimmed, dummyScope);
  if (res.isValid) {
    return { valid: true };
  }
  if (res.error === 'Error de evaluación o división por cero') {
    return { valid: true };
  }
  return { valid: false, error: res.error || 'Sintaxis matemática inválida.' };
}

/**
 * Detecta si una expresión ya contiene literales numéricos con unidad inline (ej: `10 m + 80`, `2 h + 45`, `12m * 5`).
 * Evita separar la última unidad de una operación dimensional como si fuera sufijo de toda la expresión.
 */
function containsInlineUnitLiteral(expr: string): boolean {
  const regex = /\d+(?:[.,]\d+)?\s*((?:mm|cm|m)[23]|[a-zA-Z²³_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(expr)) !== null) {
    const unitCand = m[1];
    const lower = unitCand.toLowerCase();
    if (lower !== 'and' && lower !== 'or' && lower !== 'not' && isKnownUnitToken(unitCand)) {
      return true;
    }
  }
  return false;
}

interface ParsedQuantityUnit {
  cantidad?: number;
  formulaCantidad?: string;
  unidad: string;
}

function parseQuantityUnitPair(
  qtyRaw: string,
  unitRaw: string,
  validUnits: Map<string, string>
): { ok: true; value: ParsedQuantityUnit } | { ok: false; codigo: NotebookErrorCode; mensaje: string } {
  const unitKey = normalizeText(unitRaw);
  const canonicalUnit = validUnits.get(unitKey);
  if (!canonicalUnit) {
    return {
      ok: false,
      codigo: 'unidad_desconocida',
      mensaje: `Unidad desconocida '${unitRaw}'.`,
    };
  }

  const trimmedQty = qtyRaw.trim();
  if (/^-?\d+(?:[.,]\d+)?$/.test(trimmedQty)) {
    const num = Number(trimmedQty.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) {
      return {
        ok: false,
        codigo: 'cantidad_invalida',
        mensaje: `Cantidad inválida '${qtyRaw}': debe ser mayor a cero.`,
      };
    }
    return { ok: true, value: { cantidad: num, unidad: canonicalUnit } };
  }

  // Fórmulas explícitas: =expr o (expr)
  if (trimmedQty.startsWith('=') || (trimmedQty.startsWith('(') && trimmedQty.endsWith(')'))) {
    const expr = trimmedQty.startsWith('=') ? trimmedQty.slice(1).trim() : trimmedQty.slice(1, -1).trim();
    const syntax = validateMathSyntax(expr);
    if (!syntax.valid) {
      return {
        ok: false,
        codigo: 'expresion_invalida',
        mensaje: `Fórmula de cantidad inválida '${qtyRaw}': ${syntax.error}`,
      };
    }
    return { ok: true, value: { formulaCantidad: expr, unidad: canonicalUnit } };
  }

  return {
    ok: false,
    codigo: 'cantidad_invalida',
    mensaje: `Cantidad inválida '${qtyRaw}'.`,
  };
}

const ATTACHED_UNIT_PATTERN = '(?:(?:mm|cm|m)[23]|[a-zA-Z²³_]+)';
const ATTACHED_NUM_UNIT_REGEX = new RegExp(`^(-?\\d+(?:[.,]\\d+)?)(${ATTACHED_UNIT_PATTERN})$`);
const PURE_UNIT_TOKEN_REGEX = new RegExp(`^${ATTACHED_UNIT_PATTERN}$`);

function splitAttachedQuantityUnit(token: string): { qty: string; unit: string } | null {
  const mNum = token.match(ATTACHED_NUM_UNIT_REGEX);
  if (mNum) {
    return { qty: mNum[1], unit: mNum[2] };
  }
  if (token.startsWith('(')) {
    let depth = 0;
    for (let i = 0; i < token.length; i++) {
      if (token[i] === '(') depth++;
      else if (token[i] === ')') {
        depth--;
        if (depth === 0) {
          const qty = token.slice(0, i + 1);
          const unit = token.slice(i + 1);
          if (PURE_UNIT_TOKEN_REGEX.test(unit)) {
            return { qty, unit };
          }
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Desenvuelve paréntesis externos redundantes únicamente si el '(' inicial cierra al final.
 * Ej: '(bocas * 2)' -> 'bocas * 2', pero '(a + b) * (c + d)' se mantiene intacto.
 */
function unwrapOuterParens(expr: string): string {
  let current = expr.trim();
  while (current.startsWith('(') && current.endsWith(')')) {
    let depth = 0;
    let wrapsEntire = true;
    for (let i = 0; i < current.length; i++) {
      if (current[i] === '(') depth++;
      else if (current[i] === ')') {
        depth--;
        if (depth === 0 && i < current.length - 1) {
          wrapsEntire = false;
          break;
        }
      }
    }
    if (!wrapsEntire || depth !== 0) break;
    current = current.slice(1, -1).trim();
  }
  return current;
}

function endsWithMathOperator(head: string): boolean {
  const t = head.trimEnd();
  if (!t) return true;
  if (/[+\-*/^%?:<>=!&|,;(]$/.test(t)) return true;
  if (/\b(?:and|or|not)$/i.test(t)) return true;
  return false;
}

/**
 * Divide una cadena en (prefijo, último token) en el último espacio fuera de paréntesis.
 */
function splitTrailingTopLevelToken(input: string): { head: string; tail: string } | null {
  const trimmed = input.trim();
  let depth = 0;
  let lastSpaceIdx = -1;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    else if (/\s/.test(ch) && depth === 0) {
      lastSpaceIdx = i;
    }
  }
  if (lastSpaceIdx < 0) return null;
  const head = trimmed.slice(0, lastSpaceIdx).trim();
  const tail = trimmed.slice(lastSpaceIdx + 1).trim();
  if (!head || !tail) return null;
  return { head, tail };
}

/**
 * Parsea una asignación flexible de cantidad/horas con soporte de expresiones naturales
 * sin paréntesis obligatorios (`bocas`, `bocas * 2 m`, `ceil(sup * 0.4) u`, `120m`, `(bocas * 2)m`, `=bocas * 2`).
 */
function parseFlexibleQuantityExpression(
  rawVal: string,
  defaultUnit: string,
  validUnits: Map<string, string>
): { ok: true; value: ParsedQuantityUnit } | { ok: false; codigo: NotebookErrorCode; mensaje: string } {
  let working = (rawVal || '').trim();
  if (!working) {
    return {
      ok: false,
      codigo: 'cantidad_invalida',
      mensaje: 'Falta valor numérico o fórmula.',
    };
  }

  const hadLeadingEq = working.startsWith('=');
  if (hadLeadingEq) {
    working = working.slice(1).trim();
    if (!working) {
      return {
        ok: false,
        codigo: 'expresion_invalida',
        mensaje: "Expresión vacía después de '='.",
      };
    }
  }

  // 1. Caso pegado sin espacios en nivel 0 (ej: `120m`, `(bocas * 2)m`, `120metros_raros`)
  const attached = splitAttachedQuantityUnit(working);
  if (attached) {
    return parseQuantityUnitPair(attached.qty, attached.unit, validUnits);
  }

  // 2. Caso expresión + posible unidad separada por espacio al final (ej: `bocas * 2 m`, `120 m`)
  // Si la expresión ya incluye unidades inline (ej. `10 m + 80 cm`, `2 h + 45 min`), no arrancamos la unidad final.
  let exprPart = working;
  let unit = defaultUnit;
  const split = splitTrailingTopLevelToken(working);
  if (
    split &&
    !containsInlineUnitLiteral(split.head) &&
    !endsWithMathOperator(split.head) &&
    PURE_UNIT_TOKEN_REGEX.test(split.tail)
  ) {
    const canonicalUnit = validUnits.get(normalizeText(split.tail));
    if (canonicalUnit) {
      exprPart = split.head;
      unit = canonicalUnit;
    } else {
      const wholeIsMath = validateMathSyntax(working).valid;
      if (!wholeIsMath) {
        const headClean = unwrapOuterParens(split.head);
        const headIsNumOrMath =
          /^-?\d+(?:[.,]\d+)?$/.test(headClean) || validateMathSyntax(headClean).valid;
        if (headIsNumOrMath) {
          return {
            ok: false,
            codigo: 'unidad_desconocida',
            mensaje: `Unidad desconocida '${split.tail}'.`,
          };
        }
      }
    }
  }

  const cleanExpr = unwrapOuterParens(exprPart);
  if (!cleanExpr) {
    return {
      ok: false,
      codigo: 'expresion_invalida',
      mensaje: `Expresión vacía en '${rawVal}'.`,
    };
  }

  // 3. Literal numérico puro (sin prefijo `=` ni fórmula)
  if (!hadLeadingEq && /^-?\d+(?:[.,]\d+)?$/.test(cleanExpr)) {
    const num = Number(cleanExpr.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) {
      return {
        ok: false,
        codigo: 'cantidad_invalida',
        mensaje: `Cantidad inválida '${rawVal}': debe ser mayor a cero.`,
      };
    }
    return { ok: true, value: { cantidad: num, unidad: unit } };
  }

  // 4. Fórmula matemática o variable (sin paréntesis obligatorios)
  const syntax = validateMathSyntax(cleanExpr);
  if (!syntax.valid) {
    return {
      ok: false,
      codigo: 'expresion_invalida',
      mensaje: `Fórmula inválida '${rawVal}': ${syntax.error}`,
    };
  }

  return { ok: true, value: { formulaCantidad: cleanExpr, unidad: unit } };
}

/**
 * Parsea una asignación flexible de precio o costo (`precio = tarifa * 1.2`, `costo = 15000`, `precio = (base + 500)`).
 */
function parseFlexibleScalarOrFormula(raw: string): {
  num?: number;
  formula?: string;
  valid: boolean;
  error?: string;
} {
  let working = (raw || '').trim();
  if (!working) {
    return { valid: false, error: 'Falta valor numérico o fórmula.' };
  }
  const hadLeadingEq = working.startsWith('=');
  if (hadLeadingEq) {
    working = working.slice(1).trim();
  }
  const clean = unwrapOuterParens(working);
  if (!clean) {
    return { valid: false, error: `Expresión vacía en '${raw}'.` };
  }
  if (!hadLeadingEq && /^-?\d+(?:[.,]\d+)?$/.test(clean)) {
    const num = Number(clean.replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) {
      return { valid: false, error: `Valor numérico inválido '${raw}'.` };
    }
    return { num, valid: true };
  }
  const syntax = validateMathSyntax(clean);
  if (!syntax.valid) {
    return { valid: false, error: syntax.error || `Expresión inválida '${raw}'.` };
  }
  return { formula: clean, valid: true };
}

/**
 * Parsea la expresión de una variable global admitiendo una unidad opcional al final
 * (ej: `largo = 12 m`, `largo = 12m`, `sup = largo * ancho m2`, `bocas = ceil(sup * 0.4) u`).
 */
function parseVariableExpressionWithOptionalUnit(
  rawExpr: string,
  validUnits: Map<string, string>
): { valid: true; expresion: string; unidad?: string } | { valid: false; error: string } {
  const trimmed = (rawExpr || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Expresión vacía.' };
  }

  // 1. Caso pegado: `12m`, `60m2`, `(a * b)m` si la unidad es reconocida
  const attached = splitAttachedQuantityUnit(trimmed);
  if (attached) {
    const canonical = validUnits.get(normalizeText(attached.unit));
    if (canonical) {
      const cleanExpr = unwrapOuterParens(attached.qty);
      const syntax = validateMathSyntax(cleanExpr);
      if (syntax.valid) {
        return { valid: true, expresion: cleanExpr, unidad: canonical };
      }
    }
  }

  // 2. Caso expresión + unidad separada por espacio: `largo * ancho m2`, `12 m`, `ceil(sup * 0.4) u`
  // Si `head` ya contiene unidades inline (ej. `10 m + 80 cm`, `2 h + 45 min`), se conserva como expresión dimensional completa.
  const split = splitTrailingTopLevelToken(trimmed);
  if (
    split &&
    !containsInlineUnitLiteral(split.head) &&
    !endsWithMathOperator(split.head) &&
    PURE_UNIT_TOKEN_REGEX.test(split.tail)
  ) {
    const canonical = validUnits.get(normalizeText(split.tail));
    if (canonical) {
      const headClean = unwrapOuterParens(split.head);
      const headSyntax = validateMathSyntax(headClean);
      if (headSyntax.valid) {
        return { valid: true, expresion: headClean, unidad: canonical };
      }
    }
  }

  // 3. Expresión matemática pura sin unidad
  const syntax = validateMathSyntax(trimmed);
  if (!syntax.valid) {
    return { valid: false, error: syntax.error || 'Sintaxis matemática inválida.' };
  }
  return { valid: true, expresion: trimmed };
}

type LookupResult<T> =
  | { status: 'resolved'; item: T }
  | { status: 'ambiguous'; candidatos: T[] }
  | { status: 'not_found' };

function resolveCatalogItem<T extends { id: string; nombre: string }>(
  query: string,
  items: T[],
  extraTextFn?: (item: T) => string,
  slugFn?: (item: T) => string | undefined
): LookupResult<T> {
  const qNorm = normalizeText(query);
  if (!qNorm) return { status: 'not_found' };

  // 1. Coincidencia exacta determinista por id, slug o nombre normalizado
  const exact = items.filter((item) => {
    if (item.id === query || normalizeText(item.id) === qNorm) return true;
    const itemSlug = slugFn ? slugFn(item) : undefined;
    if (itemSlug && normalizeText(itemSlug) === qNorm) return true;
    if (slugifyIdentificador(item.nombre) === slugifyIdentificador(query) && slugifyIdentificador(query) !== '') {
      return normalizeText(item.nombre) === qNorm || itemSlug === qNorm || qNorm === slugifyIdentificador(item.nombre);
    }
    return normalizeText(item.nombre) === qNorm;
  });

  if (exact.length === 1) return { status: 'resolved', item: exact[0] };
  if (exact.length > 1) return { status: 'ambiguous', candidatos: exact };

  // 2. Coincidencia exacta por conjunto completo de tokens (sin heurísticas difusas)
  const queryTokens = tokenizeCatalogText(query);
  if (queryTokens.length === 0) return { status: 'not_found' };

  const tokenMatches = items.filter((item) => {
    const fullText = extraTextFn ? `${item.nombre} ${extraTextFn(item)}` : item.nombre;
    const itemTokens = new Set(tokenizeCatalogText(fullText));
    return queryTokens.every((qt) => itemTokens.has(qt));
  });

  if (tokenMatches.length === 1) return { status: 'resolved', item: tokenMatches[0] };
  if (tokenMatches.length > 1) return { status: 'ambiguous', candidatos: tokenMatches };
  return { status: 'not_found' };
}

function resolverTrabajoTipo(ref: string, tareasTipo: TareaTipo[]): LookupResult<TareaTipo> {
  const qNorm = normalizeText(ref);
  if (!qNorm) return { status: 'not_found' };

  const activos = tareasTipo.filter((t) => !t.deleted);
  const matches = activos.filter((t) => {
    if (t.id === ref || normalizeText(t.id) === qNorm) return true;
    if (t.slug && normalizeText(t.slug) === qNorm) return true;
    if (slugifyIdentificador(t.nombre) === qNorm) return true;
    return normalizeText(t.nombre) === qNorm;
  });

  if (matches.length === 1) return { status: 'resolved', item: matches[0] };
  if (matches.length > 1) return { status: 'ambiguous', candidatos: matches };
  return { status: 'not_found' };
}

function resolverMaterial(ref: string, materiales: Material[]): LookupResult<Material> {
  const activos = materiales.filter((m) => !m.deleted && m.activo !== false);
  return resolveCatalogItem(
    ref,
    activos,
    (m) => (m.atributos ?? []).map((a) => `${a.clave} ${a.valor}`).join(' ')
  );
}

function resolverProducto(
  prodRef: string,
  materialId: string,
  productos: Producto[]
): LookupResult<Producto> {
  const qNorm = normalizeText(prodRef);
  const delMaterial = productos.filter((p) => !p.deleted && p.activo !== false && p.materialId === materialId);

  const exact = delMaterial.filter(
    (p) =>
      p.id === prodRef ||
      normalizeText(`${p.marca} ${p.modelo}`.trim()) === qNorm ||
      normalizeText(p.marca) === qNorm ||
      (p.codigoFabricante && normalizeText(p.codigoFabricante) === qNorm)
  );
  if (exact.length === 1) return { status: 'resolved', item: exact[0] };
  if (exact.length > 1) return { status: 'ambiguous', candidatos: exact };

  const queryTokens = tokenizeCatalogText(prodRef);
  const tokenMatches = delMaterial.filter((p) => {
    const tokens = new Set(tokenizeCatalogText(`${p.marca} ${p.modelo} ${p.codigoFabricante ?? ''}`));
    return queryTokens.length > 0 && queryTokens.every((qt) => tokens.has(qt));
  });
  if (tokenMatches.length === 1) return { status: 'resolved', item: tokenMatches[0] };
  if (tokenMatches.length > 1) return { status: 'ambiguous', candidatos: tokenMatches };
  return { status: 'not_found' };
}

function resolverManoObra(ref: string, manoObra: CategoriaManoDeObra[]): LookupResult<CategoriaManoDeObra> {
  const activos = manoObra.filter((m) => !m.deleted);
  return resolveCatalogItem(ref, activos);
}

interface TokenWithPos {
  text: string;
  quoted: boolean;
  col: number;
}

function tokenizeLineWithPos(line: string, startOffset: number): TokenWithPos[] {
  const tokens: TokenWithPos[] = [];
  let i = startOffset;
  while (i < line.length) {
    while (i < line.length && /\s/.test(line[i])) i++;
    if (i >= line.length) break;

    const col = i + 1;
    // Soporta +"Texto con espacios"
    if ((line[i] === '+' || line[i] === '-') && line[i + 1] === '"') {
      const sign = line[i];
      let j = i + 2;
      while (j < line.length && line[j] !== '"') j++;
      const inner = line.slice(i + 2, j);
      tokens.push({ text: `${sign}${inner}`, quoted: true, col });
      i = j < line.length ? j + 1 : j;
      continue;
    }

    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') j++;
      const inner = line.slice(i + 1, j);
      tokens.push({ text: inner, quoted: true, col });
      i = j < line.length ? j + 1 : j;
      continue;
    }

    let j = i;
    let parenDepth = 0;
    while (j < line.length) {
      const ch = line[j];
      if (ch === '(') parenDepth++;
      else if (ch === ')' && parenDepth > 0) parenDepth--;
      else if (/\s/.test(ch) && parenDepth === 0) break;
      j++;
    }
    tokens.push({ text: line.slice(i, j), quoted: false, col });
    i = j;
  }
  return tokens;
}

function collectAllowedSupuestos(contexto: NotebookParseContext): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const tt of contexto.tareasTipo) {
    for (const s of tt.supuestos ?? []) {
      const set = map.get(s.id) ?? new Set<string>();
      for (const opt of s.opciones) {
        set.add(opt);
      }
      map.set(s.id, set);
    }
  }
  return map;
}

function extractTrailingQuantityUnit(
  tokens: TokenWithPos[],
  validUnits: Map<string, string>,
  lineNum: number,
  colOffset: number,
  rawLine: string,
  missingMessage: string
):
  | { ok: true; value: ParsedQuantityUnit; prefixTokens: TokenWithPos[] }
  | { ok: false; error: NotebookParseError } {
  const last = tokens[tokens.length - 1];
  const attached = splitAttachedQuantityUnit(last.text);
  let parsedQtyUnit: ReturnType<typeof parseQuantityUnitPair>;
  let prefixTokens: TokenWithPos[];
  let qtyCol = last.col + colOffset - 1;

  if (attached) {
    parsedQtyUnit = parseQuantityUnitPair(attached.qty, attached.unit, validUnits);
    prefixTokens = tokens.slice(0, -1);
  } else if (tokens.length >= 3) {
    const prev = tokens[tokens.length - 2];
    qtyCol = prev.col + colOffset - 1;
    parsedQtyUnit = parseQuantityUnitPair(prev.text, last.text, validUnits);
    prefixTokens = tokens.slice(0, -2);
  } else {
    return {
      ok: false,
      error: {
        linea: lineNum,
        columna: last.col + colOffset - 1,
        longitud: last.text.length,
        codigo: 'cantidad_invalida',
        mensaje: missingMessage,
        textoLinea: rawLine,
      },
    };
  }

  if (!parsedQtyUnit.ok) {
    return {
      ok: false,
      error: {
        linea: lineNum,
        columna: qtyCol,
        longitud: last.text.length,
        codigo: parsedQtyUnit.codigo,
        mensaje: parsedQtyUnit.mensaje,
        textoLinea: rawLine,
      },
    };
  }

  return { ok: true, value: parsedQtyUnit.value, prefixTokens };
}

function looksLikeTrailingQtyAttempt(tokens: TokenWithPos[], validUnits: Map<string, string>): boolean {
  if (tokens.length === 0) return false;
  const last = tokens[tokens.length - 1].text;
  if (splitAttachedQuantityUnit(last)) return true;
  if (tokens.length >= 2) {
    const prev = tokens[tokens.length - 2].text;
    const prevIsNumOrFormula =
      /^-?\d+(?:[.,]\d+)?$/.test(prev) || (prev.startsWith('(') && prev.endsWith(')'));
    if (prevIsNumOrFormula && (/^[a-zA-Z²_]+$/.test(last) || validUnits.has(normalizeText(last)))) {
      return true;
    }
  }
  return false;
}

function resolveProductAttachment(
  productoRef: string,
  materialId: string,
  materialNombre: string,
  productos: Producto[],
  lineNum: number,
  colOffset: number,
  longitud: number,
  rawLine: string
): { productoId?: string; productoReferencia?: string; error?: NotebookParseError } {
  const prodLookup = resolverProducto(productoRef, materialId, productos);
  if (prodLookup.status === 'not_found') {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud,
        codigo: 'producto_inexistente',
        mensaje: `Producto/marca '${productoRef}' no encontrado para '${materialNombre}'.`,
        textoLinea: rawLine,
      },
    };
  }
  if (prodLookup.status === 'ambiguous') {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud,
        codigo: 'producto_ambiguo',
        mensaje: `Producto ambiguo '${productoRef}' para '${materialNombre}'.`,
        textoLinea: rawLine,
        candidatos: prodLookup.candidatos.map((p) => `${p.marca} ${p.modelo}`.trim()),
      },
    };
  }
  return {
    productoId: prodLookup.item.id,
    productoReferencia: `${prodLookup.item.marca} ${prodLookup.item.modelo}`.trim(),
  };
}

function parseMaterialLineContent(
  rawContent: string,
  lineNum: number,
  colOffset: number,
  rawLine: string,
  contexto: NotebookParseContext,
  validUnits: Map<string, string>
): { linea?: NotebookMaterialLinea; error?: NotebookParseError } {
  const tokens = tokenizeLineWithPos(rawContent, 0);
  if (tokens.length === 0) {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud: Math.max(1, rawContent.length),
        codigo: 'sintaxis_invalida',
        mensaje: 'Falta especificar el nombre o referencia del material.',
        textoLinea: rawLine,
      },
    };
  }

  let parsedQty: ParsedQuantityUnit | undefined;
  let refTokens = tokens;

  if (looksLikeTrailingQtyAttempt(tokens, validUnits)) {
    const qtyRes = extractTrailingQuantityUnit(
      tokens,
      validUnits,
      lineNum,
      colOffset,
      rawLine,
      `Falta cantidad y unidad válidas al final de la línea '${rawContent}'.`
    );
    if (!qtyRes.ok) return { error: qtyRes.error };
    parsedQty = qtyRes.value;
    refTokens = qtyRes.prefixTokens;
  }

  let refText = refTokens.map((t) => t.text).join(' ').trim();
  let productoRef: string | undefined;
  const prodMatch = refText.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  if (prodMatch) {
    refText = prodMatch[1].trim();
    productoRef = prodMatch[2].trim();
  }

  if (!refText) {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud: rawContent.length,
        codigo: 'referencia_inexistente',
        mensaje: 'Falta especificar el nombre o referencia del material.',
        textoLinea: rawLine,
      },
    };
  }

  const matLookup = resolverMaterial(refText, contexto.materiales);
  if (matLookup.status === 'not_found') {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud: refText.length,
        codigo: 'referencia_inexistente',
        mensaje: `Material no encontrado en el catálogo: '${refText}'.`,
        textoLinea: rawLine,
      },
    };
  }
  if (matLookup.status === 'ambiguous') {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud: refText.length,
        codigo: 'ambiguo',
        mensaje: `Referencia ambigua '${refText}': coincide con ${matLookup.candidatos.map((c) => c.nombre).join(', ')}.`,
        textoLinea: rawLine,
        candidatos: matLookup.candidatos.map((c) => c.nombre),
      },
    };
  }

  let productoId: string | undefined;
  let productoNombre: string | undefined;
  if (productoRef) {
    const prodRes = resolveProductAttachment(
      productoRef,
      matLookup.item.id,
      matLookup.item.nombre,
      contexto.productos ?? [],
      lineNum,
      colOffset,
      refText.length,
      rawLine
    );
    if (prodRes.error) return { error: prodRes.error };
    productoId = prodRes.productoId;
    productoNombre = prodRes.productoReferencia;
  }

  const finalQty: ParsedQuantityUnit = parsedQty ?? {
    cantidad: 1,
    unidad: matLookup.item.unidadVenta || 'u',
  };

  return {
    linea: {
      tipo: 'material',
      referencia: matLookup.item.nombre,
      materialId: matLookup.item.id,
      ...(productoId ? { productoId, productoReferencia: productoNombre } : {}),
      ...(finalQty.cantidad !== undefined ? { cantidad: finalQty.cantidad } : {}),
      ...(finalQty.formulaCantidad !== undefined
        ? { formulaCantidad: finalQty.formulaCantidad }
        : {}),
      unidad: finalQty.unidad,
    },
  };
}

function parseManoObraLineContent(
  rawContent: string,
  lineNum: number,
  colOffset: number,
  rawLine: string,
  contexto: NotebookParseContext
): { linea?: NotebookManoObraLinea; error?: NotebookParseError } {
  const tokens = tokenizeLineWithPos(rawContent, 0);
  if (tokens.length === 0) {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud: Math.max(1, rawContent.length),
        codigo: 'sintaxis_invalida',
        mensaje: 'Falta especificar la categoría de mano de obra después de mo:.',
        textoLinea: rawLine,
      },
    };
  }

  const moUnits = new Map<string, string>([
    ['h', 'h'],
    ['hs', 'hs'],
  ]);

  let parsedQty: ParsedQuantityUnit | undefined;
  let refTokens = tokens;

  if (looksLikeTrailingQtyAttempt(tokens, moUnits)) {
    const qtyRes = extractTrailingQuantityUnit(
      tokens,
      moUnits,
      lineNum,
      colOffset,
      rawLine,
      `Se esperaba duración en horas ('h' o 'hs') al final de '${rawContent}'.`
    );
    if (!qtyRes.ok) {
      return {
        error:
          tokens.length < 3 && !splitAttachedQuantityUnit(tokens[tokens.length - 1].text)
            ? { ...qtyRes.error, codigo: 'unidad_desconocida' }
            : qtyRes.error,
      };
    }
    parsedQty = qtyRes.value;
    refTokens = qtyRes.prefixTokens;
  }

  const refText = refTokens.map((t) => t.text).join(' ').trim();
  const lookup = resolverManoObra(refText, contexto.manoObra ?? []);
  if (lookup.status === 'not_found') {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud: refText.length || 1,
        codigo: 'referencia_inexistente',
        mensaje: `Categoría de mano de obra no encontrada: '${refText}'.`,
        textoLinea: rawLine,
      },
    };
  }
  if (lookup.status === 'ambiguous') {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud: refText.length,
        codigo: 'ambiguo',
        mensaje: `Categoría de mano de obra ambigua '${refText}': coincide con ${lookup.candidatos.map((c) => c.nombre).join(', ')}.`,
        textoLinea: rawLine,
        candidatos: lookup.candidatos.map((c) => c.nombre),
      },
    };
  }

  const finalQty: ParsedQuantityUnit = parsedQty ?? { cantidad: 1, unidad: 'hs' };

  return {
    linea: {
      tipo: 'mano_obra',
      referencia: lookup.item.nombre,
      categoriaId: lookup.item.id,
      ...(finalQty.cantidad !== undefined ? { horas: finalQty.cantidad } : {}),
      ...(finalQty.formulaCantidad !== undefined
        ? { formulaHoras: finalQty.formulaCantidad }
        : {}),
      unidad: finalQty.unidad as 'h' | 'hs',
    },
  };
}

function parseScalarOrFormula(raw: string): { num?: number; formula?: string; valid: boolean; error?: string } {
  const trimmed = raw.trim();
  if (/^-?\d+(?:[.,]\d+)?$/.test(trimmed)) {
    const num = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) {
      return { valid: false, error: `Valor numérico inválido '${raw}'.` };
    }
    return { num, valid: true };
  }
  if (trimmed.startsWith('=') || (trimmed.startsWith('(') && trimmed.endsWith(')'))) {
    const expr = trimmed.startsWith('=') ? trimmed.slice(1).trim() : trimmed.slice(1, -1).trim();
    const syntax = validateMathSyntax(expr);
    if (!syntax.valid) return { valid: false, error: syntax.error };
    return { formula: expr, valid: true };
  }
  return { valid: false, error: `Se esperaba número positivo o fórmula entre paréntesis en '${raw}'.` };
}

function parseServicioLineContent(
  rawContent: string,
  lineNum: number,
  colOffset: number,
  rawLine: string,
  validUnits: Map<string, string>
): { linea?: NotebookServicioLinea; error?: NotebookParseError } {
  const tokens = tokenizeLineWithPos(rawContent, 0);
  if (tokens.length === 0) {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud: Math.max(1, rawContent.length),
        codigo: 'sintaxis_invalida',
        mensaje: 'Falta descripción en serv:.',
        textoLinea: rawLine,
      },
    };
  }

  const lastTok = tokens[tokens.length - 1];
  const lastIsScalarOrFormula =
    !splitAttachedQuantityUnit(lastTok.text) && parseScalarOrFormula(lastTok.text).valid;

  if (!lastIsScalarOrFormula && !looksLikeTrailingQtyAttempt(tokens, validUnits)) {
    return {
      linea: {
        tipo: 'servicio',
        descripcion: rawContent.trim(),
        cantidad: 1,
        unidad: 'gl',
        costoUnitario: 0,
      },
    };
  }

  if (tokens.length < 3) {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud: rawContent.length,
        codigo: 'sintaxis_invalida',
        mensaje: 'Formato inválido en serv:. Esperado: serv: <descripción>  <cantidad> <unidad>  <costo>',
        textoLinea: rawLine,
      },
    };
  }

  const costToken = lastTok;
  const costParsed = parseScalarOrFormula(costToken.text);
  if (!costParsed.valid) {
    return {
      error: {
        linea: lineNum,
        columna: costToken.col + colOffset - 1,
        longitud: costToken.text.length,
        codigo: 'cantidad_invalida',
        mensaje: costParsed.error || `Costo inválido '${costToken.text}'.`,
        textoLinea: rawLine,
      },
    };
  }

  const beforeCost = tokens.slice(0, -1);
  const qtyRes = extractTrailingQuantityUnit(
    beforeCost,
    validUnits,
    lineNum,
    colOffset,
    rawLine,
    'Falta cantidad y unidad en serv:.'
  );
  if (!qtyRes.ok) return { error: qtyRes.error };

  const parsedQtyUnit = { value: qtyRes.value };
  const descTokens = qtyRes.prefixTokens;

  const descripcion = descTokens.map((t) => t.text).join(' ').trim();
  if (!descripcion) {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud: rawContent.length,
        codigo: 'sintaxis_invalida',
        mensaje: 'Falta descripción en serv:.',
        textoLinea: rawLine,
      },
    };
  }

  return {
    linea: {
      tipo: 'servicio',
      descripcion,
      ...(parsedQtyUnit.value.cantidad !== undefined ? { cantidad: parsedQtyUnit.value.cantidad } : {}),
      ...(parsedQtyUnit.value.formulaCantidad !== undefined
        ? { formulaCantidad: parsedQtyUnit.value.formulaCantidad }
        : {}),
      unidad: parsedQtyUnit.value.unidad,
      ...(costParsed.num !== undefined ? { costoUnitario: costParsed.num } : {}),
      ...(costParsed.formula !== undefined ? { formulaCosto: costParsed.formula } : {}),
    },
  };
}

function parseTrabajoTipoLine(
  rawLine: string,
  lineNum: number,
  leadingSpaces: number,
  contexto: NotebookParseContext,
  validUnits: Map<string, string>
): { block?: NotebookTareaTipoBlock; errores: NotebookParseError[] } {
  const errores: NotebookParseError[] = [];
  const afterSlash = rawLine.slice(leadingSpaces);
  const tokens = tokenizeLineWithPos(afterSlash, 0);
  const cmd = tokens[0];

  if (cmd.text !== '/tt') {
    errores.push({
      linea: lineNum,
      columna: leadingSpaces + cmd.col,
      longitud: cmd.text.length,
      codigo: 'directiva_desconocida',
      mensaje: `Directiva desconocida '${cmd.text}'. ¿Quisiste decir '/tt'?`,
      textoLinea: rawLine,
    });
    return { errores };
  }

  if (tokens.length < 2) {
    errores.push({
      linea: lineNum,
      columna: leadingSpaces + 1,
      longitud: cmd.text.length,
      codigo: 'sintaxis_invalida',
      mensaje: "Falta el identificador del trabajo tipo después de '/tt'.",
      textoLinea: rawLine,
    });
    return { errores };
  }

  const refTok = tokens[1];
  const ttLookup = resolverTrabajoTipo(refTok.text, contexto.tareasTipo);
  if (ttLookup.status === 'not_found') {
    errores.push({
      linea: lineNum,
      columna: leadingSpaces + refTok.col,
      longitud: refTok.text.length,
      codigo: 'referencia_inexistente',
      mensaje: `Trabajo tipo no encontrado en catálogo: '${refTok.text}'.`,
      textoLinea: rawLine,
    });
    return { errores };
  }
  if (ttLookup.status === 'ambiguous') {
    errores.push({
      linea: lineNum,
      columna: leadingSpaces + refTok.col,
      longitud: refTok.text.length,
      codigo: 'ambiguo',
      mensaje: `Trabajo tipo ambiguo '${refTok.text}': coincide con ${ttLookup.candidatos.map((c) => c.nombre).join(', ')}.`,
      textoLinea: rawLine,
      candidatos: ttLookup.candidatos.map((c) => c.slug || c.nombre),
    });
    return { errores };
  }

  const tareaTipo = ttLookup.item;
  const declaredParams = new Set((tareaTipo.parametros ?? []).map((p) => p.id));
  const overridesParametros: Record<string, number | string> = {};
  const quitados: string[] = [];
  const agregados: NotebookAjusteAgregado[] = [];
  let cantidad: number | undefined;
  let formulaCantidad: string | undefined;

  let i = 2;
  while (i < tokens.length) {
    const tok = tokens[i];
    const col = leadingSpaces + tok.col;

    if (tok.text.startsWith('-')) {
      const clave = tok.text.slice(1).trim();
      if (!clave) {
        errores.push({
          linea: lineNum,
          columna: col,
          longitud: tok.text.length,
          codigo: 'sintaxis_invalida',
          mensaje: "Falta identificador después de '-'.",
          textoLinea: rawLine,
        });
      } else {
        quitados.push(clave);
      }
      i++;
      continue;
    }

    if (tok.text.startsWith('+')) {
      const matRef = tok.text.slice(1).trim();
      if (!matRef) {
        errores.push({
          linea: lineNum,
          columna: col,
          longitud: tok.text.length,
          codigo: 'sintaxis_invalida',
          mensaje: "Falta referencia de material después de '+'.",
          textoLinea: rawLine,
        });
        i++;
        continue;
      }

      if (i + 1 >= tokens.length) {
        errores.push({
          linea: lineNum,
          columna: col,
          longitud: tok.text.length,
          codigo: 'cantidad_invalida',
          mensaje: `Falta cantidad y unidad para el agregado '+${matRef}'.`,
          textoLinea: rawLine,
        });
        i++;
        continue;
      }

      const nextTok = tokens[i + 1];
      const attached = splitAttachedQuantityUnit(nextTok.text);
      let parsedQtyUnit: ReturnType<typeof parseQuantityUnitPair>;
      let consumed = 2;

      if (attached) {
        parsedQtyUnit = parseQuantityUnitPair(attached.qty, attached.unit, validUnits);
      } else if (i + 2 < tokens.length) {
        const unitTok = tokens[i + 2];
        parsedQtyUnit = parseQuantityUnitPair(nextTok.text, unitTok.text, validUnits);
        consumed = 3;
      } else {
        errores.push({
          linea: lineNum,
          columna: leadingSpaces + nextTok.col,
          longitud: nextTok.text.length,
          codigo: 'unidad_desconocida',
          mensaje: `Falta unidad válida en agregado '+${matRef} ${nextTok.text}'.`,
          textoLinea: rawLine,
        });
        i += 2;
        continue;
      }

      if (!parsedQtyUnit.ok) {
        errores.push({
          linea: lineNum,
          columna: leadingSpaces + nextTok.col,
          longitud: nextTok.text.length,
          codigo: parsedQtyUnit.codigo,
          mensaje: parsedQtyUnit.mensaje,
          textoLinea: rawLine,
        });
        i += consumed;
        continue;
      }

      const matLookup = resolverMaterial(matRef, contexto.materiales);
      if (matLookup.status === 'not_found') {
        errores.push({
          linea: lineNum,
          columna: col,
          longitud: tok.text.length,
          codigo: 'referencia_inexistente',
          mensaje: `Material agregado no encontrado en catálogo: '${matRef}'.`,
          textoLinea: rawLine,
        });
      } else if (matLookup.status === 'ambiguous') {
        errores.push({
          linea: lineNum,
          columna: col,
          longitud: tok.text.length,
          codigo: 'ambiguo',
          mensaje: `Referencia ambigua '+${matRef}': coincide con ${matLookup.candidatos.map((c) => c.nombre).join(', ')}.`,
          textoLinea: rawLine,
          candidatos: matLookup.candidatos.map((c) => c.nombre),
        });
      } else {
        agregados.push({
          referencia: matLookup.item.nombre,
          materialId: matLookup.item.id,
          ...(parsedQtyUnit.value.cantidad !== undefined ? { cantidad: parsedQtyUnit.value.cantidad } : {}),
          ...(parsedQtyUnit.value.formulaCantidad !== undefined
            ? { formulaCantidad: parsedQtyUnit.value.formulaCantidad }
            : {}),
          unidad: parsedQtyUnit.value.unidad,
        });
      }

      i += consumed;
      continue;
    }

    const eqIdx = tok.text.indexOf('=');
    if (eqIdx > 0) {
      const key = tok.text.slice(0, eqIdx).trim();
      const rawVal = tok.text.slice(eqIdx + 1).trim();

      if (!rawVal) {
        errores.push({
          linea: lineNum,
          columna: col,
          longitud: tok.text.length,
          codigo: 'sintaxis_invalida',
          mensaje: `Falta valor para el parámetro '${key}'.`,
          textoLinea: rawLine,
        });
        i++;
        continue;
      }

      if (key === 'cantidad') {
        const cleanRaw = unwrapOuterParens(rawVal.startsWith('=') ? rawVal.slice(1).trim() : rawVal);
        if (!rawVal.startsWith('=') && /^-?\d+(?:[.,]\d+)?$/.test(cleanRaw)) {
          const num = Number(cleanRaw.replace(',', '.'));
          if (!Number.isFinite(num) || num <= 0) {
            errores.push({
              linea: lineNum,
              columna: col,
              longitud: tok.text.length,
              codigo: 'cantidad_invalida',
              mensaje: `Cantidad inválida '${rawVal}' en trabajo tipo.`,
              textoLinea: rawLine,
            });
          } else {
            cantidad = num;
            formulaCantidad = undefined;
          }
        } else {
          const syntax = validateMathSyntax(cleanRaw);
          if (!syntax.valid) {
            errores.push({
              linea: lineNum,
              columna: col,
              longitud: tok.text.length,
              codigo: 'cantidad_invalida',
              mensaje: `Cantidad inválida '${rawVal}' en trabajo tipo: ${syntax.error}`,
              textoLinea: rawLine,
            });
          } else {
            formulaCantidad = cleanRaw;
            cantidad = undefined;
          }
        }
        i++;
        continue;
      }

      if (declaredParams.size > 0 && !declaredParams.has(key)) {
        errores.push({
          linea: lineNum,
          columna: col,
          longitud: key.length,
          codigo: 'parametro_desconocido',
          mensaje: `Parámetro desconocido '${key}' para el trabajo tipo '${tareaTipo.slug || tareaTipo.nombre}'.`,
          textoLinea: rawLine,
        });
        i++;
        continue;
      }

      if (/^-?\d+(?:[.,]\d+)?$/.test(rawVal)) {
        overridesParametros[key] = Number(rawVal.replace(',', '.'));
      } else {
        const syntax = validateMathSyntax(rawVal);
        if (!syntax.valid) {
          errores.push({
            linea: lineNum,
            columna: col,
            longitud: tok.text.length,
            codigo: 'expresion_invalida',
            mensaje: `Expresión inválida en parámetro '${key}': ${syntax.error}`,
            textoLinea: rawLine,
          });
        } else {
          overridesParametros[key] = rawVal;
        }
      }

      i++;
      continue;
    }

    errores.push({
      linea: lineNum,
      columna: col,
      longitud: tok.text.length,
      codigo: 'sintaxis_invalida',
      mensaje: `Token inesperado '${tok.text}' en línea /tt.`,
      textoLinea: rawLine,
    });
    i++;
  }

  return {
    block: {
      tipo: 'tarea_tipo',
      referencia: tareaTipo.slug || slugifyIdentificador(tareaTipo.nombre) || tareaTipo.id,
      tareaTipoId: tareaTipo.id,
      ...(cantidad !== undefined ? { cantidad } : {}),
      ...(formulaCantidad !== undefined ? { formulaCantidad } : {}),
      overridesParametros,
      quitados,
      agregados,
      lineas: [],
    },
    errores,
  };
}

function parseItemLine(
  rawContent: string,
  lineNum: number,
  colOffset: number,
  rawLine: string,
  validUnits: Map<string, string>
): { block?: NotebookItemLibreBlock; error?: NotebookParseError } {
  const tokens = tokenizeLineWithPos(rawContent, 0);
  if (tokens.length === 0) {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud: 1,
        codigo: 'sintaxis_invalida',
        mensaje: "Falta descripción, cantidad y unidad después de 'item:'.",
        textoLinea: rawLine,
      },
    };
  }

  // Extrae parámetros opcionales key=val al final
  const parametros: Record<string, number | string> = {};
  let endIdx = tokens.length;
  while (endIdx > 0) {
    const tok = tokens[endIdx - 1];
    const eqIdx = tok.text.indexOf('=');
    if (eqIdx > 0 && /^[a-zA-Z_]\w*$/.test(tok.text.slice(0, eqIdx))) {
      const k = tok.text.slice(0, eqIdx);
      const v = tok.text.slice(eqIdx + 1);
      if (!v) {
        return {
          error: {
            linea: lineNum,
            columna: tok.col + colOffset - 1,
            longitud: tok.text.length,
            codigo: 'sintaxis_invalida',
            mensaje: `Falta valor para parámetro '${k}' en item:.`,
            textoLinea: rawLine,
          },
        };
      }
      if (/^-?\d+(?:[.,]\d+)?$/.test(v)) {
        parametros[k] = Number(v.replace(',', '.'));
      } else {
        const syntax = validateMathSyntax(v);
        if (!syntax.valid) {
          return {
            error: {
              linea: lineNum,
              columna: tok.col + colOffset - 1,
              longitud: tok.text.length,
              codigo: 'expresion_invalida',
              mensaje: `Expresión inválida en parámetro '${k}': ${syntax.error}`,
              textoLinea: rawLine,
            },
          };
        }
        parametros[k] = v;
      }
      endIdx--;
    } else {
      break;
    }
  }

  const coreTokens = tokens.slice(0, endIdx);
  if (coreTokens.length === 0) {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud: rawContent.length,
        codigo: 'sintaxis_invalida',
        mensaje: "Falta descripción después de 'item:'.",
        textoLinea: rawLine,
      },
    };
  }

  let precioUnitario: number | undefined;
  let formulaPrecio: string | undefined;
  let qtyEndIdx = coreTokens.length;

  const maybePrice = coreTokens[coreTokens.length - 1];
  const maybePriceParsed = parseScalarOrFormula(maybePrice.text);
  // Si el último token es número o fórmula explícita (= / (...)) y no tiene unidad pegada, lo tratamos como precio siempre que antes haya una unidad válida
  if (maybePriceParsed.valid && !splitAttachedQuantityUnit(maybePrice.text) && coreTokens.length >= 3) {
    const prevTok = coreTokens[coreTokens.length - 2];
    const prevAttached = splitAttachedQuantityUnit(prevTok.text);
    const prevIsUnit = validUnits.has(normalizeText(prevTok.text));
    if (prevAttached || prevIsUnit) {
      precioUnitario = maybePriceParsed.num;
      formulaPrecio = maybePriceParsed.formula;
      qtyEndIdx = coreTokens.length - 1;
    }
  }

  const qtySlice = coreTokens.slice(0, qtyEndIdx);
  const hasInlineQty =
    precioUnitario !== undefined ||
    formulaPrecio !== undefined ||
    looksLikeTrailingQtyAttempt(qtySlice, validUnits);

  if (!hasInlineQty) {
    const descripcion = coreTokens.map((t) => t.text).join(' ').trim();
    return {
      block: {
        tipo: 'item_libre',
        modo: 'item',
        descripcion,
        cantidad: 1,
        unidad: 'u',
        parametros,
        lineas: [],
      },
    };
  }

  if (qtySlice.length < 2) {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud: rawContent.length,
        codigo: 'cantidad_invalida',
        mensaje: "Falta cantidad y unidad en 'item:'.",
        textoLinea: rawLine,
      },
    };
  }

  const qtyRes = extractTrailingQuantityUnit(
    qtySlice,
    validUnits,
    lineNum,
    colOffset,
    rawLine,
    `Falta cantidad y unidad válidas en '${rawContent}'.`
  );
  if (!qtyRes.ok) return { error: qtyRes.error };

  const parsedQtyUnit = { value: qtyRes.value };
  const descTokens = qtyRes.prefixTokens;

  const descripcion = descTokens.map((t) => t.text).join(' ').trim();
  if (!descripcion) {
    return {
      error: {
        linea: lineNum,
        columna: colOffset,
        longitud: rawContent.length,
        codigo: 'sintaxis_invalida',
        mensaje: "Falta descripción antes de la cantidad en 'item:'.",
        textoLinea: rawLine,
      },
    };
  }

  return {
    block: {
      tipo: 'item_libre',
      modo: 'item',
      descripcion,
      ...(parsedQtyUnit.value.cantidad !== undefined ? { cantidad: parsedQtyUnit.value.cantidad } : {}),
      ...(parsedQtyUnit.value.formulaCantidad !== undefined
        ? { formulaCantidad: parsedQtyUnit.value.formulaCantidad }
        : {}),
      unidad: parsedQtyUnit.value.unidad,
      ...(precioUnitario !== undefined ? { precioUnitario } : {}),
      ...(formulaPrecio !== undefined ? { formulaPrecio } : {}),
      parametros,
      lineas: [],
    },
  };
}

function assignParameterValue(
  key: string,
  rawVal: string,
  lineNum: number,
  col: number,
  tokLen: number,
  rawLine: string,
  targetOverrides: Record<string, number | string>,
  errores: NotebookParseError[],
  declaredParams?: Set<string>
): { isCantidad?: number; isFormulaCantidad?: string } {
  if (!rawVal) {
    errores.push({
      linea: lineNum,
      columna: col,
      longitud: tokLen,
      codigo: 'sintaxis_invalida',
      mensaje: `Falta valor para el parámetro '${key}'.`,
      textoLinea: rawLine,
    });
    return {};
  }

  if (key === 'cantidad' && declaredParams !== undefined) {
    const cleanRaw = unwrapOuterParens(rawVal.startsWith('=') ? rawVal.slice(1).trim() : rawVal);
    if (!rawVal.startsWith('=') && /^-?\d+(?:[.,]\d+)?$/.test(cleanRaw)) {
      const num = Number(cleanRaw.replace(',', '.'));
      if (!Number.isFinite(num) || num <= 0) {
        errores.push({
          linea: lineNum,
          columna: col,
          longitud: tokLen,
          codigo: 'cantidad_invalida',
          mensaje: `Cantidad inválida '${rawVal}' en trabajo tipo.`,
          textoLinea: rawLine,
        });
        return {};
      }
      return { isCantidad: num };
    }
    const syntax = validateMathSyntax(cleanRaw);
    if (!syntax.valid) {
      errores.push({
        linea: lineNum,
        columna: col,
        longitud: tokLen,
        codigo: 'cantidad_invalida',
        mensaje: `Cantidad inválida '${rawVal}' en trabajo tipo: ${syntax.error}`,
        textoLinea: rawLine,
      });
      return {};
    }
    return { isFormulaCantidad: cleanRaw };
  }

  if (declaredParams && declaredParams.size > 0 && !declaredParams.has(key)) {
    errores.push({
      linea: lineNum,
      columna: col,
      longitud: key.length,
      codigo: 'parametro_desconocido',
      mensaje: `Parámetro desconocido '${key}'.`,
      textoLinea: rawLine,
    });
    return {};
  }

  if (/^-?\d+(?:[.,]\d+)?$/.test(rawVal)) {
    targetOverrides[key] = Number(rawVal.replace(',', '.'));
  } else {
    const cleanExpr = unwrapOuterParens(rawVal.startsWith('=') ? rawVal.slice(1).trim() : rawVal);
    const syntax = validateMathSyntax(cleanExpr);
    if (!syntax.valid) {
      errores.push({
        linea: lineNum,
        columna: col,
        longitud: tokLen,
        codigo: 'expresion_invalida',
        mensaje: `Expresión inválida en parámetro '${key}': ${syntax.error}`,
        textoLinea: rawLine,
      });
    } else {
      targetOverrides[key] = cleanExpr;
    }
  }
  return {};
}

type SubItemParseContext =
  | { kind: 'linea'; ref: NotebookItemLinea; indent: number }
  | { kind: 'agregado'; ref: NotebookAjusteAgregado; indent: number };

function parseValueWithOptionalUnit(
  rawVal: string,
  defaultUnit: string,
  validUnits: Map<string, string>,
  lineNum: number,
  col: number,
  rawLine: string
): { value?: ParsedQuantityUnit; error?: NotebookParseError } {
  const res = parseFlexibleQuantityExpression(rawVal, defaultUnit, validUnits);
  if (!res.ok) {
    return {
      error: {
        linea: lineNum,
        columna: col,
        longitud: Math.max(1, rawVal.length),
        codigo: res.codigo,
        mensaje: res.mensaje,
        textoLinea: rawLine,
      },
    };
  }
  return { value: res.value };
}

function parseChildSubItemLine(
  trimmed: string,
  subCtx: SubItemParseContext,
  lineNum: number,
  colStart: number,
  rawLine: string,
  contexto: NotebookParseContext,
  validUnits: Map<string, string>,
  errores: NotebookParseError[]
): boolean {
  const m = trimmed.match(/^([a-zA-Z_][\w-]*)\s*=\s*(.*)$/);
  if (!m) return false;
  const key = m[1].toLowerCase();
  const rawVal = m[2].trim();

  const matRef =
    subCtx.kind === 'agregado' ? subCtx.ref : subCtx.ref.tipo === 'material' ? subCtx.ref : null;
  if (matRef) {
    if (key === 'marca' || key === 'producto') {
      if (!rawVal) {
        errores.push({
          linea: lineNum,
          columna: colStart,
          longitud: trimmed.length,
          codigo: 'sintaxis_invalida',
          mensaje: `Falta especificar marca/producto después de '${key} ='.`,
          textoLinea: rawLine,
        });
        return true;
      }
      if (!matRef.materialId) return true;
      const prodRes = resolveProductAttachment(
        rawVal,
        matRef.materialId,
        matRef.referencia,
        contexto.productos ?? [],
        lineNum,
        colStart,
        rawVal.length,
        rawLine
      );
      if (prodRes.error) {
        errores.push(prodRes.error);
      } else {
        matRef.productoId = prodRes.productoId;
        matRef.productoReferencia = prodRes.productoReferencia;
      }
      return true;
    }

    if (key === 'cantidad') {
      const parsed = parseValueWithOptionalUnit(rawVal, matRef.unidad || 'u', validUnits, lineNum, colStart, rawLine);
      if (parsed.error) {
        errores.push(parsed.error);
      } else if (parsed.value) {
        delete matRef.cantidad;
        delete matRef.formulaCantidad;
        if (parsed.value.cantidad !== undefined) matRef.cantidad = parsed.value.cantidad;
        if (parsed.value.formulaCantidad !== undefined) matRef.formulaCantidad = parsed.value.formulaCantidad;
        matRef.unidad = parsed.value.unidad;
      }
      return true;
    }
    return false;
  }

  if (subCtx.kind === 'linea' && subCtx.ref.tipo === 'mano_obra') {
    const moRef = subCtx.ref;
    if (key === 'horas' || key === 'cantidad') {
      const moUnits = new Map<string, string>([
        ['h', 'h'],
        ['hs', 'hs'],
      ]);
      const parsed = parseValueWithOptionalUnit(rawVal, moRef.unidad || 'hs', moUnits, lineNum, colStart, rawLine);
      if (parsed.error) {
        errores.push(parsed.error);
      } else if (parsed.value) {
        delete moRef.horas;
        delete moRef.formulaHoras;
        if (parsed.value.cantidad !== undefined) moRef.horas = parsed.value.cantidad;
        if (parsed.value.formulaCantidad !== undefined) moRef.formulaHoras = parsed.value.formulaCantidad;
        moRef.unidad = parsed.value.unidad as 'h' | 'hs';
      }
      return true;
    }
    return false;
  }

  if (subCtx.kind === 'linea' && subCtx.ref.tipo === 'servicio') {
    const servRef = subCtx.ref;
    if (key === 'cantidad') {
      const parsed = parseValueWithOptionalUnit(rawVal, servRef.unidad || 'gl', validUnits, lineNum, colStart, rawLine);
      if (parsed.error) {
        errores.push(parsed.error);
      } else if (parsed.value) {
        delete servRef.cantidad;
        delete servRef.formulaCantidad;
        if (parsed.value.cantidad !== undefined) servRef.cantidad = parsed.value.cantidad;
        if (parsed.value.formulaCantidad !== undefined) servRef.formulaCantidad = parsed.value.formulaCantidad;
        servRef.unidad = parsed.value.unidad;
      }
      return true;
    }
    if (key === 'costo' || key === 'precio') {
      const scalar = parseFlexibleScalarOrFormula(rawVal);
      if (!scalar.valid) {
        errores.push({
          linea: lineNum,
          columna: colStart,
          longitud: trimmed.length,
          codigo: 'cantidad_invalida',
          mensaje: scalar.error || `Costo inválido '${rawVal}'.`,
          textoLinea: rawLine,
        });
      } else {
        delete servRef.costoUnitario;
        delete servRef.formulaCosto;
        if (scalar.num !== undefined) servRef.costoUnitario = scalar.num;
        if (scalar.formula !== undefined) servRef.formulaCosto = scalar.formula;
      }
      return true;
    }
    return false;
  }

  return false;
}

function parseIndentedAdjustmentOrParam(
  trimmed: string,
  lineNum: number,
  leadingSpaces: number,
  colStart: number,
  rawLine: string,
  currentItem: NotebookTareaTipoBlock | NotebookItemLibreBlock,
  contexto: NotebookParseContext,
  validUnits: Map<string, string>,
  errores: NotebookParseError[]
): { handled: boolean; createdSubItem?: SubItemParseContext } {
  // 1. Quitado (-clave) en /tt
  if (trimmed.startsWith('-')) {
    if (currentItem.tipo !== 'tarea_tipo') return { handled: false };
    const clave = trimmed.slice(1).trim();
    if (!clave) {
      errores.push({
        linea: lineNum,
        columna: colStart,
        longitud: trimmed.length,
        codigo: 'sintaxis_invalida',
        mensaje: "Falta identificador después de '-'.",
        textoLinea: rawLine,
      });
    } else {
      currentItem.quitados.push(clave);
    }
    return { handled: true };
  }

  // 2. Agregado (+material [Marca] [cantUnidad]) en /tt
  if (trimmed.startsWith('+')) {
    if (currentItem.tipo !== 'tarea_tipo') return { handled: false };
    const content = trimmed.slice(1).trim();
    if (!content) {
      errores.push({
        linea: lineNum,
        columna: colStart,
        longitud: trimmed.length,
        codigo: 'sintaxis_invalida',
        mensaje: "Falta referencia de material después de '+'.",
        textoLinea: rawLine,
      });
      return { handled: true };
    }
    const res = parseMaterialLineContent(content, lineNum, colStart + 1, rawLine, contexto, validUnits);
    if (res.error) {
      errores.push(res.error);
      return { handled: true };
    }
    if (res.linea) {
      const agRef: NotebookAjusteAgregado = {
        referencia: res.linea.referencia,
        materialId: res.linea.materialId,
        ...(res.linea.productoId
          ? { productoId: res.linea.productoId, productoReferencia: res.linea.productoReferencia }
          : {}),
        ...(res.linea.cantidad !== undefined ? { cantidad: res.linea.cantidad } : {}),
        ...(res.linea.formulaCantidad !== undefined ? { formulaCantidad: res.linea.formulaCantidad } : {}),
        unidad: res.linea.unidad,
      };
      currentItem.agregados.push(agRef);
      return {
        handled: true,
        createdSubItem: { kind: 'agregado', ref: agRef, indent: leadingSpaces },
      };
    }
    return { handled: true };
  }

  // 3. Parámetro o propiedad indentada en bloque raíz (<param> = <valor_o_expr>)
  const paramMatch = trimmed.match(/^([a-zA-Z_][\w-]*)\s*=\s*(.*)$/);
  if (paramMatch) {
    const key = paramMatch[1].trim();
    const rawVal = paramMatch[2].trim();
    if (currentItem.tipo === 'tarea_tipo') {
      const tt = currentItem.tareaTipoId
        ? contexto.tareasTipo.find((t) => t.id === currentItem.tareaTipoId)
        : undefined;
      const declaredParams = new Set((tt?.parametros ?? []).map((p) => p.id));
      const res = assignParameterValue(
        key,
        rawVal,
        lineNum,
        colStart,
        trimmed.length,
        rawLine,
        currentItem.overridesParametros,
        errores,
        declaredParams
      );
      if (res.isCantidad !== undefined) {
        currentItem.cantidad = res.isCantidad;
        delete currentItem.formulaCantidad;
      } else if (res.isFormulaCantidad !== undefined) {
        currentItem.formulaCantidad = res.isFormulaCantidad;
        delete currentItem.cantidad;
      }
      return { handled: true };
    }

    const lowerKey = key.toLowerCase();
    if (lowerKey === 'cantidad') {
      const parsed = parseValueWithOptionalUnit(
        rawVal,
        currentItem.unidad || (currentItem.modo === 'item' ? 'u' : 'gl'),
        validUnits,
        lineNum,
        colStart,
        rawLine
      );
      if (parsed.error) {
        errores.push(parsed.error);
      } else if (parsed.value) {
        delete currentItem.cantidad;
        delete currentItem.formulaCantidad;
        if (parsed.value.cantidad !== undefined) currentItem.cantidad = parsed.value.cantidad;
        if (parsed.value.formulaCantidad !== undefined) currentItem.formulaCantidad = parsed.value.formulaCantidad;
        currentItem.unidad = parsed.value.unidad;
      }
      return { handled: true };
    }
    if (currentItem.modo === 'item' && (lowerKey === 'precio' || lowerKey === 'costo')) {
      const scalar = parseFlexibleScalarOrFormula(rawVal);
      if (!scalar.valid) {
        errores.push({
          linea: lineNum,
          columna: colStart,
          longitud: trimmed.length,
          codigo: 'cantidad_invalida',
          mensaje: scalar.error || `Precio inválido '${rawVal}'.`,
          textoLinea: rawLine,
        });
      } else {
        delete currentItem.precioUnitario;
        delete currentItem.formulaPrecio;
        if (scalar.num !== undefined) currentItem.precioUnitario = scalar.num;
        if (scalar.formula !== undefined) currentItem.formulaPrecio = scalar.formula;
      }
      return { handled: true };
    }

    assignParameterValue(
      key,
      rawVal,
      lineNum,
      colStart,
      trimmed.length,
      rawLine,
      currentItem.parametros,
      errores
    );
    return { handled: true };
  }

  return { handled: false };
}

/**
 * Parsea texto del notebook a bloques tipados y errores deterministas con línea y columna.
 * Función pura sin estado ni acceso a UI.
 */
export function parse(texto: string, contexto: NotebookParseContext): NotebookParseResult {
  const bloques: NotebookBlock[] = [];
  const errores: NotebookParseError[] = [];
  const validUnits = buildValidUnitsMap(contexto);
  const allowedSupuestos = collectAllowedSupuestos(contexto);

  const lines = (texto || '').split(/\r?\n/);
  let currentItem: NotebookTareaTipoBlock | NotebookItemLibreBlock | null = null;
  let currentSubItem: SubItemParseContext | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const lineNum = idx + 1;
    const trimmed = rawLine.trim();

    if (!trimmed) {
      currentItem = null;
      currentSubItem = null;
      continue;
    }

    if (trimmed.startsWith('//')) {
      continue;
    }

    const leadingSpaces = rawLine.length - rawLine.trimStart().length;
    const colStart = leadingSpaces + 1;

    // 1. Capítulo: # Nombre
    if (trimmed.startsWith('#')) {
      currentItem = null;
      currentSubItem = null;
      const nombre = trimmed.slice(1).trim();
      if (!nombre) {
        errores.push({
          linea: lineNum,
          columna: colStart,
          longitud: trimmed.length,
          codigo: 'sintaxis_invalida',
          mensaje: "El título del capítulo después de '#' no puede estar vacío.",
          textoLinea: rawLine,
        });
      } else {
        bloques.push({ tipo: 'capitulo', nombre });
      }
      continue;
    }

    // 2. Comando con barra (/tt ...)
    if (trimmed.startsWith('/')) {
      currentItem = null;
      currentSubItem = null;
      const res = parseTrabajoTipoLine(rawLine, lineNum, leadingSpaces, contexto, validUnits);
      errores.push(...res.errores);
      if (res.block) {
        bloques.push(res.block);
        currentItem = res.block;
      }
      continue;
    }

    // 3. Directivas con dos puntos (<palabra>: ...)
    const directiveMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*:(.*)$/);
    if (directiveMatch) {
      const directive = directiveMatch[1].toLowerCase();
      const rest = directiveMatch[2].trim();
      const colonIdx = rawLine.indexOf(':');
      const contentCol = colonIdx + 2;

      if (!DIRECTIVAS_CON_DOS_PUNTOS.has(directive)) {
        errores.push({
          linea: lineNum,
          columna: colStart,
          longitud: directiveMatch[1].length,
          codigo: 'directiva_desconocida',
          mensaje: `Directiva desconocida '${directiveMatch[1]}:'. Válidas: tarea, item, supuesto, nota, mat, mo, serv.`,
          textoLinea: rawLine,
        });
        continue;
      }

      if (directive === 'nota') {
        currentItem = null;
        currentSubItem = null;
        if (!rest) {
          errores.push({
            linea: lineNum,
            columna: colStart,
            longitud: trimmed.length,
            codigo: 'sintaxis_invalida',
            mensaje: "La nota interna después de 'nota:' no puede estar vacía.",
            textoLinea: rawLine,
          });
        } else {
          bloques.push({ tipo: 'nota_interna', texto: rest });
        }
        continue;
      }

      if (directive === 'supuesto') {
        currentItem = null;
        currentSubItem = null;
        const supMatch = rest.match(/^([a-zA-Z_][\w-]*)\s*=\s*(.+)$/);
        if (!supMatch) {
          errores.push({
            linea: lineNum,
            columna: contentCol,
            longitud: Math.max(1, rest.length),
            codigo: 'sintaxis_invalida',
            mensaje: "Formato inválido en supuesto:. Esperado: supuesto: <clave> = <valor>",
            textoLinea: rawLine,
          });
          continue;
        }
        const clave = supMatch[1].trim();
        const valor = supMatch[2].trim();
        const allowed = allowedSupuestos.get(clave);
        if (allowed && !allowed.has(valor)) {
          errores.push({
            linea: lineNum,
            columna: contentCol,
            longitud: rest.length,
            codigo: 'valor_supuesto_invalido',
            mensaje: `Valor '${valor}' inválido para supuesto '${clave}'. Opciones: ${Array.from(allowed).join(', ')}.`,
            textoLinea: rawLine,
            candidatos: Array.from(allowed),
          });
          continue;
        }
        bloques.push({ tipo: 'supuesto', clave, valor });
        continue;
      }

      if (directive === 'tarea') {
        currentSubItem = null;
        if (!rest) {
          errores.push({
            linea: lineNum,
            columna: colStart,
            longitud: trimmed.length,
            codigo: 'sintaxis_invalida',
            mensaje: "Falta la descripción después de 'tarea:'.",
            textoLinea: rawLine,
          });
          currentItem = null;
          continue;
        }
        const block: NotebookItemLibreBlock = {
          tipo: 'item_libre',
          modo: 'tarea',
          descripcion: rest,
          parametros: {},
          lineas: [],
        };
        bloques.push(block);
        currentItem = block;
        continue;
      }

      if (directive === 'item') {
        currentSubItem = null;
        const res = parseItemLine(rest, lineNum, contentCol, rawLine, validUnits);
        if (res.error) {
          errores.push(res.error);
          currentItem = null;
        } else if (res.block) {
          bloques.push(res.block);
          currentItem = res.block;
        }
        continue;
      }

      // Sub-líneas explícitas: mat:, mo:, serv:
      if (!currentItem) {
        errores.push({
          linea: lineNum,
          columna: colStart,
          longitud: trimmed.length,
          codigo: 'linea_fuera_de_item',
          mensaje: `La línea '${directive}:' debe estar dentro de un ítem ('tarea:', 'item:' o '/tt').`,
          textoLinea: rawLine,
        });
        continue;
      }

      currentSubItem = null;
      if (directive === 'mat') {
        const res = parseMaterialLineContent(rest, lineNum, contentCol, rawLine, contexto, validUnits);
        if (res.error) errores.push(res.error);
        else if (res.linea) {
          currentItem.lineas.push(res.linea);
          currentSubItem = { kind: 'linea', ref: res.linea, indent: leadingSpaces };
        }
      } else if (directive === 'mo') {
        const res = parseManoObraLineContent(rest, lineNum, contentCol, rawLine, contexto);
        if (res.error) errores.push(res.error);
        else if (res.linea) {
          currentItem.lineas.push(res.linea);
          currentSubItem = { kind: 'linea', ref: res.linea, indent: leadingSpaces };
        }
      } else if (directive === 'serv') {
        const res = parseServicioLineContent(rest, lineNum, contentCol, rawLine, validUnits);
        if (res.error) errores.push(res.error);
        else if (res.linea) {
          currentItem.lineas.push(res.linea);
          currentSubItem = { kind: 'linea', ref: res.linea, indent: leadingSpaces };
        }
      }
      continue;
    }

    // 4. Variable global: ident = expr (no puede estar indentada como sub-línea)
    const varMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*=\s*(.*)$/);
    if (varMatch && leadingSpaces === 0) {
      currentItem = null;
      currentSubItem = null;
      const id = varMatch[1];
      const expr = varMatch[2].trim();

      if (id === 'cantidad' || RESERVED_KEYWORDS.has(id.toLowerCase())) {
        errores.push({
          linea: lineNum,
          columna: colStart,
          longitud: id.length,
          codigo: 'nombre_reservado',
          mensaje: `'${id}' es una palabra reservada y no puede usarse como variable.`,
          textoLinea: rawLine,
        });
        continue;
      }

      if (!expr) {
        errores.push({
          linea: lineNum,
          columna: colStart,
          longitud: trimmed.length,
          codigo: 'sintaxis_invalida',
          mensaje: `Falta expresión o valor a la derecha de '${id} ='.`,
          textoLinea: rawLine,
        });
        continue;
      }

      const varParsed = parseVariableExpressionWithOptionalUnit(expr, validUnits);
      if (!varParsed.valid) {
        errores.push({
          linea: lineNum,
          columna: rawLine.indexOf('=') + 2,
          longitud: expr.length,
          codigo: 'expresion_invalida',
          mensaje: `Expresión inválida en variable '${id}': ${varParsed.error}`,
          textoLinea: rawLine,
        });
        continue;
      }

      bloques.push({
        tipo: 'variable',
        id,
        expresion: varParsed.expresion,
        ...(varParsed.unidad ? { unidad: varParsed.unidad } : {}),
      });
      continue;
    }

    // 5. Sub-líneas indentadas de sub-ítem, parámetro / ajuste (-/+), o línea de material dentro del ítem activo
    if (currentItem) {
      if (currentSubItem && leadingSpaces > currentSubItem.indent) {
        const handledChild = parseChildSubItemLine(
          trimmed,
          currentSubItem,
          lineNum,
          colStart,
          rawLine,
          contexto,
          validUnits,
          errores
        );
        if (handledChild) {
          continue;
        }
      } else if (currentSubItem && leadingSpaces <= currentSubItem.indent) {
        currentSubItem = null;
      }

      if (leadingSpaces > 0) {
        const adj = parseIndentedAdjustmentOrParam(
          trimmed,
          lineNum,
          leadingSpaces,
          colStart,
          rawLine,
          currentItem,
          contexto,
          validUnits,
          errores
        );
        if (adj.handled) {
          currentSubItem = adj.createdSubItem ?? null;
          continue;
        }
      }

      currentSubItem = null;
      const res = parseMaterialLineContent(trimmed, lineNum, colStart, rawLine, contexto, validUnits);
      if (res.error) {
        errores.push(res.error);
      } else if (res.linea) {
        currentItem.lineas.push(res.linea);
        currentSubItem = { kind: 'linea', ref: res.linea, indent: leadingSpaces };
      }
      continue;
    }

    // 6. Verificar si es una línea de material huérfana fuera de ítem; si no, reportar sintaxis inválida
    const orphanMat = parseMaterialLineContent(trimmed, lineNum, colStart, rawLine, contexto, validUnits);
    if (orphanMat.linea) {
      errores.push({
        linea: lineNum,
        columna: colStart,
        longitud: trimmed.length,
        codigo: 'linea_fuera_de_item',
        mensaje: `El material '${orphanMat.linea.referencia}' debe ir dentro de un ítem ('tarea:', 'item:' o '/tt').`,
        textoLinea: rawLine,
      });
      continue;
    }

    errores.push({
      linea: lineNum,
      columna: colStart,
      longitud: trimmed.length,
      codigo: 'sintaxis_invalida',
      mensaje: `Línea no reconocida o fuera de contexto: '${trimmed}'.`,
      textoLinea: rawLine,
    });
  }

  return {
    bloques,
    errores,
    valido: errores.length === 0,
  };
}

function formatQtyUnit(cantidad?: number, formula?: string, unidad?: string): string {
  if (formula !== undefined) {
    return unidad ? `${formula} ${unidad}` : formula;
  }
  return `${String(cantidad ?? 1)}${unidad ?? ''}`;
}

function serializeLinea(
  linea: NotebookItemLinea,
  materialesById: Map<string, Material>,
  productosById: Map<string, Producto>,
  manoObraById: Map<string, CategoriaManoDeObra>
): string[] {
  if (linea.tipo === 'material') {
    const matNombre = (linea.materialId && materialesById.get(linea.materialId)?.nombre) || linea.referencia;
    const prod = linea.productoId ? productosById.get(linea.productoId) : undefined;
    const prodNombre = prod ? `${prod.marca} ${prod.modelo}`.trim() : linea.productoReferencia;
    const out = [`  mat: ${matNombre}`];
    if (prodNombre) {
      out.push(`    marca = ${prodNombre}`);
    }
    out.push(`    cantidad = ${formatQtyUnit(linea.cantidad, linea.formulaCantidad, linea.unidad)}`);
    return out;
  }
  if (linea.tipo === 'mano_obra') {
    const moNombre = (linea.categoriaId && manoObraById.get(linea.categoriaId)?.nombre) || linea.referencia;
    const qtyStr =
      linea.formulaHoras !== undefined
        ? `${linea.formulaHoras} ${linea.unidad}`
        : `${String(linea.horas ?? 1)}${linea.unidad}`;
    return [`  mo: ${moNombre}`, `    horas = ${qtyStr}`];
  }
  const qtyStr = formatQtyUnit(linea.cantidad, linea.formulaCantidad, linea.unidad);
  const costStr = linea.formulaCosto !== undefined ? linea.formulaCosto : String(linea.costoUnitario ?? 0);
  return [
    `  serv: ${linea.descripcion}`,
    `    cantidad = ${qtyStr}`,
    `    costo = ${costStr}`,
  ];
}

/**
 * Serializa bloques tipados del notebook a su representación textual canónica.
 * Garantiza round-trip determinista: parse(serialize(x, ctx), ctx) equivale a x.
 */
export function serialize(
  bloques: NotebookBlock[],
  contexto?: Partial<NotebookParseContext>
): string {
  const tareasById = new Map((contexto?.tareasTipo ?? []).map((t) => [t.id, t]));
  const materialesById = new Map((contexto?.materiales ?? []).map((m) => [m.id, m]));
  const productosById = new Map((contexto?.productos ?? []).map((p) => [p.id, p]));
  const manoObraById = new Map((contexto?.manoObra ?? []).map((mo) => [mo.id, mo]));

  const lines: string[] = [];

  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];

    if (b.tipo === 'variable') {
      lines.push(b.unidad ? `${b.id} = ${b.expresion} ${b.unidad}` : `${b.id} = ${b.expresion}`);
      continue;
    }

    if (b.tipo === 'supuesto') {
      lines.push(`supuesto: ${b.clave} = ${b.valor}`);
      continue;
    }

    if (b.tipo === 'nota_interna') {
      lines.push(`nota: ${b.texto}`);
      continue;
    }

    if (b.tipo === 'capitulo') {
      if (lines.length > 0 && lines[lines.length - 1] !== '') {
        lines.push('');
      }
      lines.push(`# ${b.nombre}`);
      continue;
    }

    if (b.tipo === 'tarea_tipo') {
      const tt = b.tareaTipoId ? tareasById.get(b.tareaTipoId) : undefined;
      const ref = tt?.slug || (tt ? slugifyIdentificador(tt.nombre) : '') || b.referencia;
      lines.push(`/tt ${ref}`);

      if (b.formulaCantidad !== undefined) {
        lines.push(`  cantidad = ${b.formulaCantidad}`);
      } else if (b.cantidad !== undefined && b.cantidad !== 1) {
        lines.push(`  cantidad = ${b.cantidad}`);
      }
      for (const [k, v] of Object.entries(b.overridesParametros)) {
        lines.push(`  ${k} = ${v}`);
      }
      for (const q of b.quitados) {
        lines.push(`  -${q}`);
      }
      for (const ag of b.agregados) {
        const matName = (ag.materialId && materialesById.get(ag.materialId)?.nombre) || ag.referencia;
        const prod = ag.productoId ? productosById.get(ag.productoId) : undefined;
        const prodNombre = prod ? `${prod.marca} ${prod.modelo}`.trim() : ag.productoReferencia;
        lines.push(`  +${matName}`);
        if (prodNombre) {
          lines.push(`    marca = ${prodNombre}`);
        }
        lines.push(`    cantidad = ${formatQtyUnit(ag.cantidad, ag.formulaCantidad, ag.unidad)}`);
      }
      for (const l of b.lineas) {
        lines.push(...serializeLinea(l, materialesById, productosById, manoObraById));
      }
      continue;
    }

    if (b.tipo === 'item_libre') {
      if (b.modo === 'tarea') {
        lines.push(`tarea: ${b.descripcion}`);
        if (b.formulaCantidad !== undefined || (b.cantidad !== undefined && b.cantidad !== 1) || b.unidad !== undefined) {
          lines.push(`  cantidad = ${formatQtyUnit(b.cantidad, b.formulaCantidad, b.unidad ?? 'gl')}`);
        }
      } else {
        lines.push(`item: ${b.descripcion}`);
        lines.push(`  cantidad = ${formatQtyUnit(b.cantidad, b.formulaCantidad, b.unidad ?? 'u')}`);
        if (b.formulaPrecio !== undefined) {
          lines.push(`  precio = ${b.formulaPrecio}`);
        } else if (b.precioUnitario !== undefined) {
          lines.push(`  precio = ${b.precioUnitario}`);
        }
      }
      for (const [k, v] of Object.entries(b.parametros)) {
        lines.push(`  ${k} = ${v}`);
      }
      for (const l of b.lineas) {
        lines.push(...serializeLinea(l, materialesById, productosById, manoObraById));
      }
    }
  }

  return lines.join('\n');
}
