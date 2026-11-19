/**
 * unitAlgebra.ts - Motor puro y pragmático de unidades opcionales para el Notebook de Cotizaciones.
 *
 * Filosofía (no bloqueante):
 * - Conversiones seguras dentro de la misma familia física: mm ↔ cm ↔ m ↔ km, mm² ↔ cm² ↔ m², min ↔ h, litro ↔ m³.
 * - Geometría básica: m * m → m², m² / m → m, m / m → adimensional, sqrt(m²) → m, (m)^2 → m².
 * - Escalares sin unidad conservan la unidad del otro operando (bocas * 1.1 → bocas, tramo + 2 → m).
 * - Incompatibilidades (ej. 10 m + 3 hs) NUNCA bloquean el cálculo: devuelven el resultado numérico + advertencia suave.
 * - NUNCA utiliza eval() ni Function().
 */

import { RESERVED_KEYWORDS, SUPPORTED_FUNCTIONS } from './mathEvaluator';

export interface DimensionVector {
  length: number;
  time: number;
  mass: number;
  power: number;
  custom?: string;
}

export interface UnitDef {
  canonical: string;
  dim: DimensionVector;
  toBaseFactor: number;
}

export interface UnitScopedValue {
  value: number;
  unit?: string;
}

export interface UnitEvalResult {
  value: number | null;
  unit?: string;
  isValid: boolean;
  warning?: string;
  error?: string;
}

export interface UnitConversionResult {
  converted: boolean;
  value: number;
  fromUnit?: string;
  toUnit?: string;
  incompatible?: boolean;
  note?: string;
  warning?: string;
}

const DIM_NONE: DimensionVector = { length: 0, time: 0, mass: 0, power: 0 };

function makeDim(partial: Partial<DimensionVector>): DimensionVector {
  return {
    length: partial.length ?? 0,
    time: partial.time ?? 0,
    mass: partial.mass ?? 0,
    power: partial.power ?? 0,
    ...(partial.custom ? { custom: partial.custom } : {}),
  };
}

function isDimensionless(d: DimensionVector): boolean {
  return d.length === 0 && d.time === 0 && d.mass === 0 && d.power === 0 && !d.custom;
}

function isPhysical(d: DimensionVector): boolean {
  return (d.length !== 0 || d.time !== 0 || d.mass !== 0 || d.power !== 0) && !d.custom;
}

function sameDimension(a: DimensionVector, b: DimensionVector): boolean {
  return (
    a.length === b.length &&
    a.time === b.time &&
    a.mass === b.mass &&
    a.power === b.power &&
    (a.custom ?? '') === (b.custom ?? '')
  );
}

const UNIT_REGISTRY: Record<string, UnitDef> = {
  // Longitud (base: m)
  mm: { canonical: 'mm', dim: makeDim({ length: 1 }), toBaseFactor: 0.001 },
  cm: { canonical: 'cm', dim: makeDim({ length: 1 }), toBaseFactor: 0.01 },
  m: { canonical: 'm', dim: makeDim({ length: 1 }), toBaseFactor: 1 },
  ml: { canonical: 'm', dim: makeDim({ length: 1 }), toBaseFactor: 1 },
  km: { canonical: 'km', dim: makeDim({ length: 1 }), toBaseFactor: 1000 },

  // Área (base: m²)
  mm2: { canonical: 'mm²', dim: makeDim({ length: 2 }), toBaseFactor: 1e-6 },
  'mm²': { canonical: 'mm²', dim: makeDim({ length: 2 }), toBaseFactor: 1e-6 },
  cm2: { canonical: 'cm²', dim: makeDim({ length: 2 }), toBaseFactor: 1e-4 },
  'cm²': { canonical: 'cm²', dim: makeDim({ length: 2 }), toBaseFactor: 1e-4 },
  m2: { canonical: 'm²', dim: makeDim({ length: 2 }), toBaseFactor: 1 },
  'm²': { canonical: 'm²', dim: makeDim({ length: 2 }), toBaseFactor: 1 },

  // Volumen (base: m³)
  m3: { canonical: 'm³', dim: makeDim({ length: 3 }), toBaseFactor: 1 },
  'm³': { canonical: 'm³', dim: makeDim({ length: 3 }), toBaseFactor: 1 },
  litro: { canonical: 'litro', dim: makeDim({ length: 3 }), toBaseFactor: 0.001 },

  // Tiempo (base: h)
  min: { canonical: 'min', dim: makeDim({ time: 1 }), toBaseFactor: 1 / 60 },
  h: { canonical: 'h', dim: makeDim({ time: 1 }), toBaseFactor: 1 },
  hs: { canonical: 'hs', dim: makeDim({ time: 1 }), toBaseFactor: 1 },

  // Masa (base: kg)
  kg: { canonical: 'kg', dim: makeDim({ mass: 1 }), toBaseFactor: 1 },

  // Potencia
  kw: { canonical: 'kW', dim: makeDim({ power: 1 }), toBaseFactor: 1 },
  kva: { canonical: 'kVA', dim: makeDim({ custom: 'kva' }), toBaseFactor: 1 },

  // Unidades discretas / comerciales
  u: { canonical: 'u', dim: makeDim({ custom: 'u' }), toBaseFactor: 1 },
  gl: { canonical: 'gl', dim: makeDim({ custom: 'gl' }), toBaseFactor: 1 },
  rollo: { canonical: 'rollo', dim: makeDim({ custom: 'rollo' }), toBaseFactor: 1 },
  caja: { canonical: 'caja', dim: makeDim({ custom: 'caja' }), toBaseFactor: 1 },
  par: { canonical: 'par', dim: makeDim({ custom: 'par' }), toBaseFactor: 1 },
  juego: { canonical: 'juego', dim: makeDim({ custom: 'juego' }), toBaseFactor: 1 },
  tramo: { canonical: 'tramo', dim: makeDim({ custom: 'tramo' }), toBaseFactor: 1 },
  boca: { canonical: 'boca', dim: makeDim({ custom: 'boca' }), toBaseFactor: 1 },
  bocas: { canonical: 'bocas', dim: makeDim({ custom: 'boca' }), toBaseFactor: 1 },
  circuito: { canonical: 'circuito', dim: makeDim({ custom: 'circuito' }), toBaseFactor: 1 },
  circuitos: { canonical: 'circuitos', dim: makeDim({ custom: 'circuito' }), toBaseFactor: 1 },
  servicio: { canonical: 'servicio', dim: makeDim({ custom: 'servicio' }), toBaseFactor: 1 },
};

export function lookupUnitDef(rawUnit?: string): UnitDef | null {
  if (!rawUnit) return null;
  const key = rawUnit.trim().toLowerCase();
  if (!key) return null;
  return UNIT_REGISTRY[key] ?? null;
}

export function isKnownUnitToken(rawToken: string): boolean {
  return lookupUnitDef(rawToken) !== null;
}

function canonicalUnitForDimension(dim: DimensionVector, preferredUnit?: string): string | undefined {
  if (isDimensionless(dim)) return undefined;
  if (preferredUnit) {
    const pref = lookupUnitDef(preferredUnit);
    if (pref && sameDimension(pref.dim, dim)) return pref.canonical;
  }
  if (!dim.custom) {
    if (dim.length === 1 && dim.time === 0 && dim.mass === 0 && dim.power === 0) return 'm';
    if (dim.length === 2 && dim.time === 0 && dim.mass === 0 && dim.power === 0) return 'm²';
    if (dim.length === 3 && dim.time === 0 && dim.mass === 0 && dim.power === 0) return 'm³';
    if (dim.time === 1 && dim.length === 0 && dim.mass === 0 && dim.power === 0) return 'h';
    if (dim.mass === 1 && dim.length === 0 && dim.time === 0 && dim.power === 0) return 'kg';
    if (dim.power === 1 && dim.length === 0 && dim.time === 0 && dim.mass === 0) return 'kW';
  }
  return dim.custom;
}

function cleanFloat(n: number): number {
  const rounded = Math.round(n * 1e10) / 1e10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Convierte un valor desde `fromUnit` hacia `toUnit` si pertenecen a la misma familia física.
 */
export function convertUnitValue(
  value: number,
  fromUnit?: string,
  toUnit?: string
): UnitConversionResult {
  if (!fromUnit || !toUnit) {
    return { converted: false, value, fromUnit, toUnit };
  }
  const fromDef = lookupUnitDef(fromUnit);
  const toDef = lookupUnitDef(toUnit);
  if (!fromDef || !toDef) {
    return { converted: false, value, fromUnit, toUnit };
  }

  if (sameDimension(fromDef.dim, toDef.dim)) {
    if (fromDef.toBaseFactor === toDef.toBaseFactor) {
      return { converted: false, value, fromUnit: fromDef.canonical, toUnit: toDef.canonical };
    }
    const convertedVal = cleanFloat((value * fromDef.toBaseFactor) / toDef.toBaseFactor);
    const fmtOrig = Number.isInteger(value)
      ? String(value)
      : String(Math.round(value * 100) / 100);
    return {
      converted: true,
      value: convertedVal,
      fromUnit: fromDef.canonical,
      toUnit: toDef.canonical,
      note: `← ${fmtOrig} ${fromDef.canonical}`,
    };
  }

  return {
    converted: false,
    value,
    fromUnit: fromDef.canonical,
    toUnit: toDef.canonical,
    incompatible: true,
    warning: `Se usó un valor en '${fromDef.canonical}' donde se esperaba '${toDef.canonical}'.`,
  };
}

// ─── Tokenizador y Parser con soporte de unidades inline ─────────────────────

interface Quantity {
  value: number;
  dim: DimensionVector;
  unit?: string; // unidad legible ej: 'm', 'cm', 'h', 'bocas'
}

type TokenType =
  | 'QUANTITY'
  | 'IDENT'
  | 'OP_ADD'
  | 'OP_MUL'
  | 'OP_POW'
  | 'OP_REL'
  | 'OP_EQ'
  | 'OP_AND'
  | 'OP_OR'
  | 'OP_NOT'
  | 'QUESTION'
  | 'COLON'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'FUNC';

interface Token {
  type: TokenType;
  value: string | number;
  unit?: string;
}

function sanitizeExpr(raw: string): string {
  let str = (raw || '').trim();
  if (str.startsWith('=')) str = str.slice(1).trim();
  str = str.replace(/^\$\s*/, '');
  // Comas decimales tipo "12,5" -> "12.5" (sin tocar separadores de argumentos en funciones)
  str = str.replace(/(\d+),(\d+)(?!\s*[,;a-zA-Z\d])/g, '$1.$2');
  str = str.replace(/(^|[+\-*/^%?<>!=&(,:|])\s*,(\d+)/g, '$10.$2');
  return str;
}

const LOGICAL_OR_BOOL_KEYWORDS = new Set(['and', 'or', 'not', 'true', 'false']);
const UNIT_SUFFIX_REGEX = /^((?:mm|cm|m)[23]|[a-zA-Z²³_]+)/;

function tokenizeUnitExpression(input: string): Token[] | null {
  const s = sanitizeExpr(input);
  const tokens: Token[] = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }
    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'COMMA', value: ',' });
      i++;
      continue;
    }
    if (ch === '?') {
      tokens.push({ type: 'QUESTION', value: '?' });
      i++;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'COLON', value: ':' });
      i++;
      continue;
    }

    if (s.startsWith('||', i)) {
      tokens.push({ type: 'OP_OR', value: '||' });
      i += 2;
      continue;
    }
    if (s.startsWith('&&', i)) {
      tokens.push({ type: 'OP_AND', value: '&&' });
      i += 2;
      continue;
    }
    if (s.startsWith('===', i)) {
      tokens.push({ type: 'OP_EQ', value: '==' });
      i += 3;
      continue;
    }
    if (s.startsWith('!==', i)) {
      tokens.push({ type: 'OP_EQ', value: '!=' });
      i += 3;
      continue;
    }
    if (s.startsWith('==', i)) {
      tokens.push({ type: 'OP_EQ', value: '==' });
      i += 2;
      continue;
    }
    if (s.startsWith('!=', i) || s.startsWith('<>', i)) {
      tokens.push({ type: 'OP_EQ', value: '!=' });
      i += 2;
      continue;
    }
    if (s.startsWith('<=', i) || s.startsWith('>=', i)) {
      tokens.push({ type: 'OP_REL', value: s.slice(i, i + 2) });
      i += 2;
      continue;
    }
    if (ch === '<' || ch === '>') {
      tokens.push({ type: 'OP_REL', value: ch });
      i++;
      continue;
    }
    if (ch === '=') {
      tokens.push({ type: 'OP_EQ', value: '==' });
      i++;
      continue;
    }
    if (ch === '!') {
      tokens.push({ type: 'OP_NOT', value: '!' });
      i++;
      continue;
    }
    if (ch === '+' || ch === '-') {
      tokens.push({ type: 'OP_ADD', value: ch });
      i++;
      continue;
    }
    if (s.startsWith('**', i)) {
      tokens.push({ type: 'OP_POW', value: '**' });
      i += 2;
      continue;
    }
    if (ch === '*' || ch === '/' || ch === '%') {
      tokens.push({ type: 'OP_MUL', value: ch });
      i++;
      continue;
    }
    if (ch === '^') {
      tokens.push({ type: 'OP_POW', value: '^' });
      i++;
      continue;
    }

    // Número (opcionalmente seguido de unidad pegada o separada por espacio: `10m`, `10 m`, `80 cm`, `45 min`)
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(s[i + 1] ?? ''))) {
      let numStr = '';
      let hasDot = false;
      while (i < s.length && (/\d/.test(s[i]) || s[i] === '.')) {
        if (s[i] === '.') {
          if (hasDot) return null;
          hasDot = true;
        }
        numStr += s[i];
        i++;
      }
      const numVal = parseFloat(numStr);
      if (Number.isNaN(numVal)) return null;

      // Buscar unidad pegada o tras espacios horizontales (no tras operadores lógicos)
      let unit: string | undefined;
      const savedIdx = i;
      while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
      const rest = s.slice(i);
      const uMatch = rest.match(UNIT_SUFFIX_REGEX);
      if (uMatch) {
        const cand = uMatch[1];
        const afterCand = rest.slice(cand.length);
        const lower = cand.toLowerCase();
        // No consumir operadores lógicos (and/or/not/true/false) ni llamadas a función ej: min(...)
        if (
          !LOGICAL_OR_BOOL_KEYWORDS.has(lower) &&
          afterCand.trimStart()[0] !== '(' &&
          isKnownUnitToken(cand)
        ) {
          unit = lookupUnitDef(cand)!.canonical;
          i += cand.length;
        } else {
          i = savedIdx;
        }
      } else {
        i = savedIdx;
      }

      tokens.push({ type: 'QUANTITY', value: numVal, unit });
      continue;
    }

    // Identificadores y funciones
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) {
        ident += s[i];
        i++;
      }
      const lower = ident.toLowerCase();
      if (lower === 'true') {
        tokens.push({ type: 'QUANTITY', value: 1 });
      } else if (lower === 'false') {
        tokens.push({ type: 'QUANTITY', value: 0 });
      } else if (lower === 'and') {
        tokens.push({ type: 'OP_AND', value: '&&' });
      } else if (lower === 'or') {
        tokens.push({ type: 'OP_OR', value: '||' });
      } else if (lower === 'not') {
        tokens.push({ type: 'OP_NOT', value: '!' });
      } else if (SUPPORTED_FUNCTIONS.has(lower)) {
        tokens.push({ type: 'FUNC', value: lower });
      } else {
        tokens.push({ type: 'IDENT', value: ident });
      }
      continue;
    }

    return null;
  }

  return tokens;
}

/**
 * Extrae los identificadores de variables reales de una expresión, ignorando
 * las unidades inline que acompañan a literales numéricos (`10 m + 80 cm` -> `[]`).
 */
export function extractUnitExpressionDependencies(expresion: string): string[] {
  if (!expresion || typeof expresion !== 'string') return [];
  const tokens = tokenizeUnitExpression(expresion);
  if (!tokens) {
    // Fallback defensivo si la expresión está incompleta o tiene sintaxis inválida
    const clean = expresion.trim().startsWith('=') ? expresion.trim().slice(1) : expresion;
    const matches = clean.match(/[a-zA-Z_]\w*/g) || [];
    const deps = new Set<string>();
    for (const id of matches) {
      if (!RESERVED_KEYWORDS.has(id.toLowerCase())) deps.add(id);
    }
    return Array.from(deps);
  }
  const deps = new Set<string>();
  for (const tok of tokens) {
    if (tok.type === 'IDENT') {
      deps.add(String(tok.value));
    }
  }
  return Array.from(deps);
}

// ─── AST y Evaluador Dimensional Pragmático ──────────────────────────────────

type ASTNode =
  | { type: 'Quantity'; value: number; unit?: string }
  | { type: 'Ident'; name: string }
  | { type: 'Unary'; op: string; arg: ASTNode }
  | { type: 'Binary'; op: string; left: ASTNode; right: ASTNode }
  | { type: 'Ternary'; cond: ASTNode; consequent: ASTNode; alternate: ASTNode }
  | { type: 'Call'; name: string; args: ASTNode[] };

class UnitExprParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  public parse(): ASTNode | null {
    if (this.tokens.length === 0) return null;
    const ast = this.parseTernary();
    if (!ast || this.pos < this.tokens.length) return null;
    return ast;
  }

  private parseTernary(): ASTNode | null {
    const cond = this.parseLogicalOr();
    if (!cond) return null;
    if (this.peek()?.type === 'QUESTION') {
      this.next();
      const consequent = this.parseTernary();
      if (!consequent) return null;
      if (this.next()?.type !== 'COLON') return null;
      const alternate = this.parseTernary();
      if (!alternate) return null;
      return { type: 'Ternary', cond, consequent, alternate };
    }
    return cond;
  }

  private parseLogicalOr(): ASTNode | null {
    let left = this.parseLogicalAnd();
    if (!left) return null;
    while (this.peek()?.type === 'OP_OR') {
      const op = String(this.next()!.value);
      const right = this.parseLogicalAnd();
      if (!right) return null;
      left = { type: 'Binary', op, left, right };
    }
    return left;
  }

  private parseLogicalAnd(): ASTNode | null {
    let left = this.parseEquality();
    if (!left) return null;
    while (this.peek()?.type === 'OP_AND') {
      const op = String(this.next()!.value);
      const right = this.parseEquality();
      if (!right) return null;
      left = { type: 'Binary', op, left, right };
    }
    return left;
  }

  private parseEquality(): ASTNode | null {
    let left = this.parseRelational();
    if (!left) return null;
    while (this.peek()?.type === 'OP_EQ') {
      const op = String(this.next()!.value);
      const right = this.parseRelational();
      if (!right) return null;
      left = { type: 'Binary', op, left, right };
    }
    return left;
  }

  private parseRelational(): ASTNode | null {
    let left = this.parseAdditive();
    if (!left) return null;
    while (this.peek()?.type === 'OP_REL') {
      const op = String(this.next()!.value);
      const right = this.parseAdditive();
      if (!right) return null;
      left = { type: 'Binary', op, left, right };
    }
    return left;
  }

  private parseAdditive(): ASTNode | null {
    let left = this.parseMultiplicative();
    if (!left) return null;
    while (this.peek()?.type === 'OP_ADD') {
      const op = String(this.next()!.value);
      const right = this.parseMultiplicative();
      if (!right) return null;
      left = { type: 'Binary', op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): ASTNode | null {
    let left = this.parsePower();
    if (!left) return null;
    while (this.peek()?.type === 'OP_MUL') {
      const op = String(this.next()!.value);
      const right = this.parsePower();
      if (!right) return null;
      left = { type: 'Binary', op, left, right };
    }
    return left;
  }

  private parsePower(): ASTNode | null {
    const base = this.parseUnary();
    if (!base) return null;
    if (this.peek()?.type === 'OP_POW') {
      const op = String(this.next()!.value);
      const exp = this.parsePower();
      if (!exp) return null;
      return { type: 'Binary', op, left: base, right: exp };
    }
    return base;
  }

  private parseUnary(): ASTNode | null {
    const t = this.peek();
    if (!t) return null;

    if (t.type === 'OP_ADD' || t.type === 'OP_NOT') {
      const op = String(this.next()!.value);
      const arg = this.parseUnary();
      if (!arg) return null;
      return { type: 'Unary', op, arg };
    }

    if (t.type === 'FUNC') {
      const name = String(this.next()!.value).toLowerCase();
      if (this.next()?.type !== 'LPAREN') return null;
      const args: ASTNode[] = [];
      if (this.peek() && this.peek()!.type !== 'RPAREN') {
        const first = this.parseTernary();
        if (!first) return null;
        args.push(first);
        while (this.peek()?.type === 'COMMA') {
          this.next();
          const arg = this.parseTernary();
          if (!arg) return null;
          args.push(arg);
        }
      }
      if (this.next()?.type !== 'RPAREN') return null;
      return { type: 'Call', name, args };
    }

    if (t.type === 'QUANTITY') {
      const tok = this.next()!;
      return { type: 'Quantity', value: Number(tok.value), unit: tok.unit };
    }

    if (t.type === 'IDENT') {
      const tok = this.next()!;
      return { type: 'Ident', name: String(tok.value) };
    }

    if (t.type === 'LPAREN') {
      this.next();
      const inner = this.parseTernary();
      if (!inner) return null;
      if (this.next()?.type !== 'RPAREN') return null;
      return inner;
    }

    return null;
  }
}

function quantityFromScoped(val: number, unit?: string): Quantity {
  const def = lookupUnitDef(unit);
  if (!def) {
    return { value: val, dim: DIM_NONE, unit: unit?.trim() || undefined };
  }
  return { value: val, dim: def.dim, unit: def.canonical };
}

function alignSameDimension(left: Quantity, right: Quantity): { rightVal: number } | null {
  if (!sameDimension(left.dim, right.dim)) return null;
  const lDef = lookupUnitDef(left.unit);
  const rDef = lookupUnitDef(right.unit);
  if (!lDef || !rDef || lDef.toBaseFactor === rDef.toBaseFactor) {
    return { rightVal: right.value };
  }
  return { rightVal: cleanFloat((right.value * rDef.toBaseFactor) / lDef.toBaseFactor) };
}

function evalAdditive(
  op: '+' | '-',
  left: Quantity,
  right: Quantity,
  warnings: string[]
): Quantity {
  const apply = (a: number, b: number) => cleanFloat(op === '+' ? a + b : a - b);

  if (isDimensionless(left.dim) && isDimensionless(right.dim)) {
    return { value: apply(left.value, right.value), dim: DIM_NONE };
  }
  if (isDimensionless(left.dim)) {
    return { value: apply(left.value, right.value), dim: right.dim, unit: right.unit };
  }
  if (isDimensionless(right.dim)) {
    return { value: apply(left.value, right.value), dim: left.dim, unit: left.unit };
  }

  const aligned = alignSameDimension(left, right);
  if (aligned) {
    return { value: apply(left.value, aligned.rightVal), dim: left.dim, unit: left.unit };
  }

  warnings.push(
    `Unidades incompatibles en ${op === '+' ? 'suma' : 'resta'}: '${left.unit}' y '${right.unit}'.`
  );
  return { value: apply(left.value, right.value), dim: left.dim, unit: left.unit };
}

function evalMultiply(left: Quantity, right: Quantity): Quantity {
  if (isDimensionless(left.dim)) {
    return { value: cleanFloat(left.value * right.value), dim: right.dim, unit: right.unit };
  }
  if (isDimensionless(right.dim)) {
    return { value: cleanFloat(left.value * right.value), dim: left.dim, unit: left.unit };
  }

  // Geometría física: longitud * longitud -> área (m²), longitud * área -> volumen (m³)
  if (
    isPhysical(left.dim) &&
    isPhysical(right.dim) &&
    left.dim.time === 0 &&
    right.dim.time === 0 &&
    left.dim.mass === 0 &&
    right.dim.mass === 0 &&
    left.dim.power === 0 &&
    right.dim.power === 0 &&
    left.dim.length > 0 &&
    right.dim.length > 0 &&
    left.dim.length + right.dim.length <= 3
  ) {
    const lDef = lookupUnitDef(left.unit);
    const rDef = lookupUnitDef(right.unit);
    const newLen = left.dim.length + right.dim.length;
    const baseVal = cleanFloat(
      left.value * (lDef?.toBaseFactor ?? 1) * (right.value * (rDef?.toBaseFactor ?? 1))
    );
    const newDim = makeDim({ length: newLen });
    return {
      value: baseVal,
      dim: newDim,
      unit: canonicalUnitForDimension(newDim),
    };
  }

  // Pragmático: discreta * física (ej. bocas * distancia_m) -> conserva la física
  if (left.dim.custom && isPhysical(right.dim)) {
    return { value: cleanFloat(left.value * right.value), dim: right.dim, unit: right.unit };
  }
  if (isPhysical(left.dim) && right.dim.custom) {
    return { value: cleanFloat(left.value * right.value), dim: left.dim, unit: left.unit };
  }

  // Producto de unidades heterogéneas sin unidad compuesta inventada
  return { value: cleanFloat(left.value * right.value), dim: DIM_NONE };
}

function evalDivide(left: Quantity, right: Quantity): Quantity | null {
  if (Math.abs(right.value) < 1e-12) return null;

  if (isDimensionless(right.dim)) {
    return { value: cleanFloat(left.value / right.value), dim: left.dim, unit: left.unit };
  }

  // Misma dimensión -> cancelación exacta a adimensional (ej. 150 cm / 1 m = 1.5)
  const aligned = alignSameDimension(left, right);
  if (aligned) {
    if (Math.abs(aligned.rightVal) < 1e-12) return null;
    return { value: cleanFloat(left.value / aligned.rightVal), dim: DIM_NONE };
  }

  // Geometría: área / longitud -> longitud (m), volumen / longitud -> área (m²), volumen / área -> longitud (m)
  if (
    isPhysical(left.dim) &&
    isPhysical(right.dim) &&
    left.dim.time === 0 &&
    right.dim.time === 0 &&
    left.dim.mass === 0 &&
    right.dim.mass === 0 &&
    left.dim.power === 0 &&
    right.dim.power === 0 &&
    left.dim.length > right.dim.length &&
    right.dim.length > 0
  ) {
    const lDef = lookupUnitDef(left.unit);
    const rDef = lookupUnitDef(right.unit);
    const lBase = left.value * (lDef?.toBaseFactor ?? 1);
    const rBase = right.value * (rDef?.toBaseFactor ?? 1);
    if (Math.abs(rBase) < 1e-12) return null;
    const newDim = makeDim({ length: left.dim.length - right.dim.length });
    return {
      value: cleanFloat(lBase / rBase),
      dim: newDim,
      unit: canonicalUnitForDimension(newDim),
    };
  }

  // Pragmático: física / discreta (ej. metros / circuitos) -> conserva física
  if (isPhysical(left.dim) && right.dim.custom) {
    return { value: cleanFloat(left.value / right.value), dim: left.dim, unit: left.unit };
  }

  return { value: cleanFloat(left.value / right.value), dim: DIM_NONE };
}

function evalAST(
  node: ASTNode,
  scopeLower: Map<string, UnitScopedValue>,
  warnings: string[]
): Quantity | null {
  switch (node.type) {
    case 'Quantity':
      return quantityFromScoped(node.value, node.unit);

    case 'Ident': {
      const found = scopeLower.get(node.name.toLowerCase());
      if (!found || !Number.isFinite(found.value)) return null;
      return quantityFromScoped(found.value, found.unit);
    }

    case 'Unary': {
      const arg = evalAST(node.arg, scopeLower, warnings);
      if (!arg) return null;
      if (node.op === '-') return { ...arg, value: -arg.value };
      if (node.op === '+') return arg;
      if (node.op === '!') return { value: arg.value === 0 ? 1 : 0, dim: DIM_NONE };
      return null;
    }

    case 'Ternary': {
      const cond = evalAST(node.cond, scopeLower, warnings);
      if (!cond) return null;
      return cond.value !== 0
        ? evalAST(node.consequent, scopeLower, warnings)
        : evalAST(node.alternate, scopeLower, warnings);
    }

    case 'Binary': {
      if (node.op === '&&') {
        const l = evalAST(node.left, scopeLower, warnings);
        if (!l) return null;
        if (l.value === 0) return { value: 0, dim: DIM_NONE };
        const r = evalAST(node.right, scopeLower, warnings);
        if (!r) return null;
        return { value: r.value !== 0 ? 1 : 0, dim: DIM_NONE };
      }
      if (node.op === '||') {
        const l = evalAST(node.left, scopeLower, warnings);
        if (!l) return null;
        if (l.value !== 0) return { value: 1, dim: DIM_NONE };
        const r = evalAST(node.right, scopeLower, warnings);
        if (!r) return null;
        return { value: r.value !== 0 ? 1 : 0, dim: DIM_NONE };
      }

      const left = evalAST(node.left, scopeLower, warnings);
      const right = evalAST(node.right, scopeLower, warnings);
      if (!left || !right) return null;

      if (node.op === '+' || node.op === '-') {
        return evalAdditive(node.op, left, right, warnings);
      }
      if (node.op === '*') {
        return evalMultiply(left, right);
      }
      if (node.op === '/') {
        return evalDivide(left, right);
      }
      if (node.op === '%') {
        if (Math.abs(right.value) < 1e-12) return null;
        return { value: cleanFloat(left.value % right.value), dim: left.dim, unit: left.unit };
      }
      if (node.op === '^' || node.op === '**') {
        const exp = right.value;
        if (
          isPhysical(left.dim) &&
          left.dim.length === 1 &&
          left.dim.time === 0 &&
          left.dim.mass === 0 &&
          left.dim.power === 0 &&
          (exp === 2 || exp === 3)
        ) {
          const lDef = lookupUnitDef(left.unit);
          const baseVal = left.value * (lDef?.toBaseFactor ?? 1);
          const newDim = makeDim({ length: exp });
          return {
            value: cleanFloat(Math.pow(baseVal, exp)),
            dim: newDim,
            unit: canonicalUnitForDimension(newDim),
          };
        }
        return { value: cleanFloat(Math.pow(left.value, exp)), dim: DIM_NONE };
      }

      // Relacionales e igualdad (con conversión automática si comparten dimensión)
      const aligned = alignSameDimension(left, right);
      const rComp = aligned ? aligned.rightVal : right.value;
      switch (node.op) {
        case '<':
          return { value: left.value < rComp ? 1 : 0, dim: DIM_NONE };
        case '<=':
          return { value: left.value <= rComp ? 1 : 0, dim: DIM_NONE };
        case '>':
          return { value: left.value > rComp ? 1 : 0, dim: DIM_NONE };
        case '>=':
          return { value: left.value >= rComp ? 1 : 0, dim: DIM_NONE };
        case '==':
          return { value: Math.abs(left.value - rComp) < 1e-9 ? 1 : 0, dim: DIM_NONE };
        case '!=':
          return { value: Math.abs(left.value - rComp) >= 1e-9 ? 1 : 0, dim: DIM_NONE };
        default:
          return null;
      }
    }

    case 'Call': {
      const name = node.name.toLowerCase();
      if (name === 'si' || name === 'if') {
        if (node.args.length < 2) return null;
        const cond = evalAST(node.args[0], scopeLower, warnings);
        if (!cond) return null;
        if (cond.value !== 0) return evalAST(node.args[1], scopeLower, warnings);
        return node.args.length >= 3
          ? evalAST(node.args[2], scopeLower, warnings)
          : { value: 0, dim: DIM_NONE };
      }

      const evaluated: Quantity[] = [];
      for (const arg of node.args) {
        const res = evalAST(arg, scopeLower, warnings);
        if (!res) return null;
        evaluated.push(res);
      }
      if (evaluated.length === 0) return null;
      const first = evaluated[0];

      switch (name) {
        case 'ceil':
        case 'techo':
          return { ...first, value: Math.ceil(first.value) };
        case 'floor':
        case 'piso':
          return { ...first, value: Math.floor(first.value) };
        case 'trunc':
        case 'int':
        case 'entero':
          return { ...first, value: Math.trunc(first.value) };
        case 'abs':
        case 'absoluto':
          return { ...first, value: Math.abs(first.value) };
        case 'round':
        case 'redondear': {
          if (evaluated.length >= 2) {
            const dec = Math.max(0, Math.round(evaluated[1].value));
            const factor = Math.pow(10, dec);
            return { ...first, value: Math.round(first.value * factor) / factor };
          }
          return { ...first, value: Math.round(first.value) };
        }
        case 'sqrt':
        case 'raiz': {
          if (first.value < 0) return null;
          if (
            isPhysical(first.dim) &&
            first.dim.length === 2 &&
            first.dim.time === 0 &&
            first.dim.mass === 0 &&
            first.dim.power === 0
          ) {
            const def = lookupUnitDef(first.unit);
            const baseVal = first.value * (def?.toBaseFactor ?? 1);
            const newDim = makeDim({ length: 1 });
            return {
              value: cleanFloat(Math.sqrt(baseVal)),
              dim: newDim,
              unit: canonicalUnitForDimension(newDim),
            };
          }
          return { value: cleanFloat(Math.sqrt(first.value)), dim: DIM_NONE };
        }
        case 'min':
        case 'minimo':
        case 'max':
        case 'maximo': {
          const isMin = name === 'min' || name === 'minimo';
          let best = first.value;
          for (let i = 1; i < evaluated.length; i++) {
            const aligned = alignSameDimension(first, evaluated[i]);
            const v = aligned ? aligned.rightVal : evaluated[i].value;
            if (isMin ? v < best : v > best) best = v;
          }
          return { ...first, value: best };
        }
        default:
          return null;
      }
    }
  }
}

/**
 * Evalúa una expresión matemática con soporte pragmático de unidades opcionales.
 */
export function evaluateUnitExpression(
  input: string | number,
  scope?: Record<string, number | UnitScopedValue>
): UnitEvalResult {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return { value: null, isValid: false };
    return { value: input, isValid: true };
  }

  if (!input || typeof input !== 'string' || !input.trim()) {
    return { value: null, isValid: false, error: 'Expresión vacía.' };
  }

  const tokens = tokenizeUnitExpression(input);
  if (!tokens || tokens.length === 0) {
    return { value: null, isValid: false, error: 'Sintaxis matemática inválida.' };
  }

  const ast = new UnitExprParser(tokens).parse();
  if (!ast) {
    return { value: null, isValid: false, error: 'Sintaxis matemática inválida.' };
  }

  const scopeLower = new Map<string, UnitScopedValue>();
  if (scope) {
    for (const [k, raw] of Object.entries(scope)) {
      if (typeof raw === 'number') {
        scopeLower.set(k.toLowerCase(), { value: raw });
      } else if (raw && typeof raw === 'object') {
        scopeLower.set(k.toLowerCase(), raw);
      }
    }
  }

  const warnings: string[] = [];
  const res = evalAST(ast, scopeLower, warnings);
  if (!res || !Number.isFinite(res.value)) {
    return {
      value: null,
      isValid: false,
      error: 'Error de evaluación o división por cero',
    };
  }

  return {
    value: res.value,
    ...(res.unit ? { unit: res.unit } : {}),
    isValid: true,
    ...(warnings.length > 0 ? { warning: warnings[0] } : {}),
  };
}
