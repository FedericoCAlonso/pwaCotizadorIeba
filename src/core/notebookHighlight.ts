/**
 * notebookHighlight.ts - Tokenizador puro de resaltado de sintaxis para el Notebook de Cotizaciones.
 *
 * Invariante garantizada:
 *   tokenizeNotebookLine(line, ...).map(s => s.text).join('') === line
 * Esto asegura alineación exacta carácter por carácter entre el overlay visual y el <textarea>.
 */

import { SUPPORTED_FUNCTIONS } from './mathEvaluator';
import { NotebookErrorDocumento } from './notebookDocument';

export type HighlightTokenKind =
  | 'plain'
  | 'comment'
  | 'heading'
  | 'directive'
  | 'variable_def'
  | 'variable_ref'
  | 'param_key'
  | 'operator'
  | 'function'
  | 'number'
  | 'unit'
  | 'adjustment'
  | 'brand';

export interface HighlightSpan {
  text: string;
  kind: HighlightTokenKind;
  isError?: boolean;
}

export interface HighlightLineContext {
  variableNames?: ReadonlySet<string>;
  error?: NotebookErrorDocumento;
}

const KNOWN_UNITS = new Set([
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
]);

const LOGICAL_WORDS = new Set(['and', 'or', 'not', 'true', 'false']);

function pushSpan(spans: HighlightSpan[], text: string, kind: HighlightTokenKind) {
  if (!text) return;
  const last = spans[spans.length - 1];
  if (last && last.kind === kind && !last.isError) {
    last.text += text;
  } else {
    spans.push({ text, kind });
  }
}

function tokenizeExpressionSegment(
  segment: string,
  spans: HighlightSpan[],
  variableNames?: ReadonlySet<string>
) {
  let i = 0;
  let lastSignificantKind: HighlightTokenKind | null = null;

  while (i < segment.length) {
    const ch = segment[i];

    // Espacios
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < segment.length && /\s/.test(segment[j])) j++;
      pushSpan(spans, segment.slice(i, j), 'plain');
      i = j;
      continue;
    }

    // Números (opcionalmente con unidad pegada ej: 120m, 60m2, 4.5hs)
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(segment[i + 1] ?? ''))) {
      let j = i;
      while (j < segment.length && /[\d.,]/.test(segment[j])) j++;
      pushSpan(spans, segment.slice(i, j), 'number');
      lastSignificantKind = 'number';
      i = j;

      // Unidad pegada inmediatamente después del número
      const rest = segment.slice(i);
      const unitMatch = rest.match(/^((?:mm|cm|m)[23]|[a-zA-Z²³_]+)/);
      if (unitMatch && KNOWN_UNITS.has(unitMatch[1].toLowerCase())) {
        pushSpan(spans, unitMatch[1], 'unit');
        lastSignificantKind = 'unit';
        i += unitMatch[1].length;
      }
      continue;
    }

    // Operadores y puntuación
    if (/[+\-*/^%?:<>=!&|(),;]/.test(ch)) {
      pushSpan(spans, ch, 'operator');
      lastSignificantKind = ch === ')' ? 'plain' : 'operator';
      i++;
      continue;
    }

    // Identificadores (funciones, variables, operadores lógicos o unidad final separada por espacio)
    if (/[a-zA-Z²³_]/.test(ch)) {
      let j = i + 1;
      while (j < segment.length && /[a-zA-Z0-9²³_]/.test(segment[j])) j++;
      const word = segment.slice(i, j);
      const lower = word.toLowerCase();
      const nextNonSpace = segment.slice(j).trimStart()[0];
      const isAtEnd = segment.slice(j).trim() === '';

      if (SUPPORTED_FUNCTIONS.has(lower) && nextNonSpace === '(') {
        pushSpan(spans, word, 'function');
        lastSignificantKind = 'function';
      } else if (LOGICAL_WORDS.has(lower)) {
        pushSpan(spans, word, 'operator');
        lastSignificantKind = 'operator';
      } else if (
        isAtEnd &&
        lastSignificantKind !== null &&
        lastSignificantKind !== 'operator' &&
        KNOWN_UNITS.has(lower)
      ) {
        pushSpan(spans, word, 'unit');
        lastSignificantKind = 'unit';
      } else if (variableNames?.has(word) || variableNames?.has(lower)) {
        pushSpan(spans, word, 'variable_ref');
        lastSignificantKind = 'variable_ref';
      } else {
        pushSpan(spans, word, 'plain');
        lastSignificantKind = 'plain';
      }
      i = j;
      continue;
    }

    pushSpan(spans, ch, 'plain');
    i++;
  }
}

function applyErrorRange(spans: HighlightSpan[], error?: NotebookErrorDocumento): HighlightSpan[] {
  if (!error || error.codigo === 'exceso_advertencias') return spans;
  const errStart = Math.max(0, (error.columna || 1) - 1);
  const errEnd = errStart + Math.max(1, error.longitud || 1);

  const out: HighlightSpan[] = [];
  let offset = 0;

  for (const span of spans) {
    const spanStart = offset;
    const spanEnd = offset + span.text.length;
    offset = spanEnd;

    if (spanEnd <= errStart || spanStart >= errEnd) {
      out.push(span);
      continue;
    }

    const localStart = Math.max(0, errStart - spanStart);
    const localEnd = Math.min(span.text.length, errEnd - spanStart);

    if (localStart > 0) {
      out.push({ text: span.text.slice(0, localStart), kind: span.kind });
    }
    if (localEnd > localStart) {
      out.push({
        text: span.text.slice(localStart, localEnd),
        kind: span.kind,
        isError: true,
      });
    }
    if (localEnd < span.text.length) {
      out.push({ text: span.text.slice(localEnd), kind: span.kind });
    }
  }

  return out;
}

/**
 * Tokeniza una línea del Notebook en spans coloreables preservando cada carácter exacto.
 */
export function tokenizeNotebookLine(
  line: string,
  context: HighlightLineContext = {}
): HighlightSpan[] {
  if (!line) return [];

  const spans: HighlightSpan[] = [];
  const leadingMatch = line.match(/^(\s*)(.*)$/);
  const indent = leadingMatch?.[1] ?? '';
  const body = leadingMatch?.[2] ?? '';

  if (indent) {
    pushSpan(spans, indent, 'plain');
  }

  if (!body) {
    return applyErrorRange(spans, context.error);
  }

  // 1. Comentarios //
  if (body.startsWith('//')) {
    pushSpan(spans, body, 'comment');
    return applyErrorRange(spans, context.error);
  }

  // 2. Capítulos #
  if (body.startsWith('#')) {
    pushSpan(spans, body, 'heading');
    return applyErrorRange(spans, context.error);
  }

  // 3. Comando /tt
  const ttMatch = body.match(/^(\/tt)(\s+)([^\s]+)(.*)$/i);
  if (ttMatch) {
    pushSpan(spans, ttMatch[1], 'directive');
    pushSpan(spans, ttMatch[2], 'plain');
    pushSpan(spans, ttMatch[3], 'heading');
    if (ttMatch[4]) {
      // Tokens inline de /tt (param=valor, -quitado, +agregado)
      const rest = ttMatch[4];
      const tokenRegex = /(\s+|[+-][^\s]+|[a-zA-Z_][\w-]*=[^\s]+|[^\s]+)/g;
      let m: RegExpExecArray | null;
      while ((m = tokenRegex.exec(rest)) !== null) {
        const tok = m[0];
        if (/^\s+$/.test(tok)) {
          pushSpan(spans, tok, 'plain');
        } else if (tok.startsWith('+') || tok.startsWith('-')) {
          pushSpan(spans, tok, 'adjustment');
        } else if (tok.includes('=')) {
          const eqIdx = tok.indexOf('=');
          pushSpan(spans, tok.slice(0, eqIdx), 'param_key');
          pushSpan(spans, '=', 'operator');
          tokenizeExpressionSegment(tok.slice(eqIdx + 1), spans, context.variableNames);
        } else {
          tokenizeExpressionSegment(tok, spans, context.variableNames);
        }
      }
    }
    return applyErrorRange(spans, context.error);
  }

  // 4. Directivas con dos puntos (tarea:, item:, supuesto:, nota:, mat:, mo:, serv:)
  const dirMatch = body.match(/^([a-zA-Z_]\w*\s*:)(.*)$/);
  if (dirMatch) {
    const dirToken = dirMatch[1];
    const dirName = dirToken.replace(':', '').trim().toLowerCase();
    const rest = dirMatch[2];
    pushSpan(spans, dirToken, 'directive');

    if (dirName === 'nota') {
      pushSpan(spans, rest, 'comment');
    } else if (dirName === 'supuesto') {
      const supEq = rest.match(/^(\s*)([a-zA-Z_][\w-]*)(\s*=\s*)(.*)$/);
      if (supEq) {
        pushSpan(spans, supEq[1], 'plain');
        pushSpan(spans, supEq[2], 'param_key');
        pushSpan(spans, supEq[3], 'operator');
        pushSpan(spans, supEq[4], 'unit');
      } else {
        pushSpan(spans, rest, 'plain');
      }
    } else if (rest.includes('[')) {
      const bracketMatch = rest.match(/^(.*?)(\[[^\]]*\])(.*)$/);
      if (bracketMatch) {
        pushSpan(spans, bracketMatch[1], 'plain');
        pushSpan(spans, bracketMatch[2], 'brand');
        tokenizeExpressionSegment(bracketMatch[3], spans, context.variableNames);
      } else {
        pushSpan(spans, rest, 'plain');
      }
    } else {
      pushSpan(spans, rest, 'plain');
    }
    return applyErrorRange(spans, context.error);
  }

  // 5. Ajustes indentados (-clave o +material)
  if (indent.length > 0 && (body.startsWith('-') || body.startsWith('+'))) {
    pushSpan(spans, body[0], 'adjustment');
    pushSpan(spans, body.slice(1), 'plain');
    return applyErrorRange(spans, context.error);
  }

  // 6. Variable global (indent = 0) o parámetro/atributo indentado (`clave = expr`)
  const assignMatch = body.match(/^([a-zA-Z_][\w-]*)(\s*=\s*)(.*)$/);
  if (assignMatch) {
    const key = assignMatch[1];
    const eqPart = assignMatch[2];
    const rhs = assignMatch[3];
    pushSpan(spans, key, indent.length === 0 ? 'variable_def' : 'param_key');
    pushSpan(spans, eqPart, 'operator');

    const keyLower = key.toLowerCase();
    if (indent.length > 0 && (keyLower === 'marca' || keyLower === 'producto')) {
      pushSpan(spans, rhs, 'brand');
    } else {
      tokenizeExpressionSegment(rhs, spans, context.variableNames);
    }
    return applyErrorRange(spans, context.error);
  }

  // 7. Línea genérica (ej. material abreviado con [Marca] y cantidad)
  const bracketMatch = body.match(/^(.*?)(\[[^\]]*\])(.*)$/);
  if (bracketMatch) {
    pushSpan(spans, bracketMatch[1], 'plain');
    pushSpan(spans, bracketMatch[2], 'brand');
    tokenizeExpressionSegment(bracketMatch[3], spans, context.variableNames);
  } else {
    pushSpan(spans, body, 'plain');
  }

  return applyErrorRange(spans, context.error);
}
