/**
 * smartSheetPasteParser.ts — Parser puro para pegado de texto tabulado o multilínea
 * en la Planilla Inteligente (Fase 3 - Inciso c).
 *
 * Soporta renglones copiados desde hojas de cálculo (Excel, Google Sheets),
 * tablas web, WhatsApp o editores de texto con separadores por tabulador (\t), punto y coma o comas.
 */

import { MaterialCatalogSuggestion } from './materialSuggestions';
import { normalizeStr } from './materialMatching';

export interface ParsedLineDraft {
  tipo: 'material' | 'mano_obra' | 'servicio';
  funcion: string;
  marcaModelo: string;
  cantidad: number;
  formula?: string;
  unidad: string;
  precioUnitario: number;
  catalogMatch?: boolean;
}

/**
 * Helper para verificar si un string representa un valor numérico o fórmula matemática.
 */
function isNumericOrFormula(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('=')) return true;
  const num = Number(trimmed.replace(',', '.'));
  return !isNaN(num);
}

/**
 * Parsea un string numérico o fórmula a número y fórmula limpia.
 */
function parseQuantity(val: string): { cantidad: number; formula?: string } {
  const trimmed = val.trim();
  if (trimmed.startsWith('=')) {
    return { cantidad: 1, formula: trimmed };
  }
  const num = Number(trimmed.replace(',', '.'));
  return {
    cantidad: !isNaN(num) && num > 0 ? num : 1,
    formula: undefined
  };
}

/**
 * Parsea un precio numérico.
 */
function parsePrice(val: string): number {
  const clean = val.replace(/[$€\s]/g, '').replace(',', '.');
  const num = Number(clean);
  return !isNaN(num) && num >= 0 ? num : 0;
}

/**
 * Normaliza y divide una línea por delimitador (\t preferido, fallback a ;).
 */
function splitLineColumns(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map((c) => c.trim());
  }
  if (line.includes(';')) {
    return line.split(';').map((c) => c.trim());
  }
  return [line.trim()];
}

/**
 * Detecta si el primer valor es un indicador de tipo.
 */
function detectTipo(val: string): 'material' | 'mano_obra' | 'servicio' | null {
  const lower = val.toLowerCase().trim();
  if (lower === 'mo' || lower === 'mano de obra' || lower === 'labor') return 'mano_obra';
  if (lower === 'serv' || lower === 'servicio' || lower === 'service') return 'servicio';
  if (lower === 'mat' || lower === 'material') return 'material';
  return null;
}

/**
 * Parsea un texto con múltiples renglones pegados y genera un borrador de líneas editables.
 *
 * @param rawText Texto copiado por el usuario (desde portapapeles o área de texto)
 * @param catalogSuggestions Catálogo de sugerencias para completar automáticamente unidad y precio de mejor oferta
 */
export function parsePastedLines(
  rawText: string,
  catalogSuggestions: MaterialCatalogSuggestion[] = []
): ParsedLineDraft[] {
  if (!rawText || !rawText.trim()) return [];

  // Mapa de búsqueda rápida por nombre normalizado de material
  const catalogMap = new Map<string, MaterialCatalogSuggestion>();
  catalogSuggestions.forEach((sug) => {
    const norm = normalizeStr(sug.nombre);
    if (!catalogMap.has(norm)) {
      catalogMap.set(norm, sug);
    }
  });

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: ParsedLineDraft[] = [];

  for (const line of lines) {
    const cols = splitLineColumns(line);
    if (cols.length === 0 || !cols[0]) continue;

    let tipo: 'material' | 'mano_obra' | 'servicio' = 'material';
    let funcion = '';
    let marcaModelo = '';
    let cantidad = 1;
    let formula: string | undefined = undefined;
    let precioUnitario = 0;
    let unidad = 'u';

    // Chequear si la primera columna es un indicador explícito de tipo
    let startIdx = 0;
    const explicitTipo = detectTipo(cols[0]);
    if (explicitTipo && cols.length > 1) {
      tipo = explicitTipo;
      startIdx = 1;
    }

    const remainingCols = cols.slice(startIdx);

    if (remainingCols.length === 1) {
      // 1 Columna: [Función]
      funcion = remainingCols[0];
    } else if (remainingCols.length === 2) {
      // 2 Columnas: [Función, Cantidad] o [Función, Marca]
      funcion = remainingCols[0];
      if (isNumericOrFormula(remainingCols[1])) {
        const qty = parseQuantity(remainingCols[1]);
        cantidad = qty.cantidad;
        formula = qty.formula;
      } else {
        marcaModelo = remainingCols[1];
      }
    } else if (remainingCols.length === 3) {
      // 3 Columnas:
      // Caso A: [Función, Cantidad, Precio]
      // Caso B: [Función, Marca, Cantidad]
      funcion = remainingCols[0];
      if (isNumericOrFormula(remainingCols[1])) {
        const qty = parseQuantity(remainingCols[1]);
        cantidad = qty.cantidad;
        formula = qty.formula;
        precioUnitario = parsePrice(remainingCols[2]);
      } else {
        marcaModelo = remainingCols[1];
        const qty = parseQuantity(remainingCols[2]);
        cantidad = qty.cantidad;
        formula = qty.formula;
      }
    } else {
      // 4 o más Columnas: [Función, Marca, Cantidad, Precio, ...]
      funcion = remainingCols[0];
      marcaModelo = remainingCols[1];
      const qty = parseQuantity(remainingCols[2]);
      cantidad = qty.cantidad;
      formula = qty.formula;
      precioUnitario = parsePrice(remainingCols[3]);
    }

    // Match con el catálogo existente (por función, sin marca)
    let catalogMatch = false;
    const normFunc = normalizeStr(funcion);
    const matchedMat = catalogMap.get(normFunc) || catalogSuggestions.find(s => normalizeStr(s.nombre) === normFunc);

    if (matchedMat && tipo === 'material') {
      catalogMatch = true;
      unidad = matchedMat.unidad || 'u';
      if (precioUnitario === 0 && matchedMat.precioVigente > 0) {
        precioUnitario = matchedMat.precioVigente;
      }
      if (!marcaModelo || marcaModelo.toLowerCase() === 'sin definir') {
        marcaModelo = matchedMat.marcaModelo || 'sin definir';
      }
    }

    // Si aún no hay marca definida, dejarla explícitamente "sin definir"
    if (!marcaModelo) {
      marcaModelo = tipo === 'mano_obra' ? '' : 'sin definir';
    }

    results.push({
      tipo,
      funcion,
      marcaModelo,
      cantidad,
      formula,
      unidad: tipo === 'mano_obra' ? 'hs' : tipo === 'servicio' ? 'gl' : unidad,
      precioUnitario,
      catalogMatch
    });
  }

  return results;
}
