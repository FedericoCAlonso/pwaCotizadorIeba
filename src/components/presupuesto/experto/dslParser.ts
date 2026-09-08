import YAML from 'yaml';
import {
  ItemPresupuesto,
  CapituloPresupuesto,
  GastoPresupuestoConfig,
  TipoFactura,
  NivelMargenRiesgo,
  Cliente,
  TareaTipo,
  Insumo,
  CategoriaManoDeObra,
  AppConfig,
  InsumoSnapshot,
  ManoObraSnapshot,
  CostoIndirecto,
  DestinoGasto,
  ModalidadGasto
} from '../../../core/types';
import {
  calcularCostoTareaTipo,
  calcularConsumosTareaTipo,
  roundMoney,
  safeNum
} from '../../../core/calculations';
import { evaluateMathExpression, isFormulaString } from '../../../core/mathEvaluator';

export interface DSLDiagnostic {
  line: number;
  type: 'info' | 'warning' | 'error';
  message: string;
}

export interface CalculatedCell {
  name: string;
  rawExpression: string;
  evaluatedValue: number;
  isFormula: boolean;
  error?: string;
  scope?: 'global' | 'local';
}

export interface ParseDSLResult {
  clienteId: string;
  clienteMatched?: Cliente;
  clienteQuery?: string;
  direccionObra: string;
  tipoFactura: TipoFactura;
  validezDias: number;
  margenPorcentaje: number;
  nivelMargenRiesgo: NivelMargenRiesgo;
  margenRiesgoPorcentaje: number;
  mostrarDolar: boolean;
  nombreDolar: string;
  cotizacionDolar: number;
  capitulos: CapituloPresupuesto[];
  items: ItemPresupuesto[];
  gastosConfig: GastoPresupuestoConfig[];
  diagnostics: DSLDiagnostic[];
  calculatedCells?: CalculatedCell[];
  calculosVariables?: Record<string, number | string>;
}

export interface ParseDSLContext {
  clientes: Cliente[];
  tareasTipo: TareaTipo[];
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  config?: AppConfig;
  existingItems?: ItemPresupuesto[];
  existingCapitulos?: CapituloPresupuesto[];
  existingGastos?: GastoPresupuestoConfig[];
  costosIndirectosCatalog?: CostoIndirecto[];
}

const KNOWN_UNITS = new Set([
  'u', 'un', 'uni', 'unidad', 'unidades',
  'm', 'mt', 'mts', 'metro', 'metros', 'ml',
  'm2', 'm²', 'mt2',
  'm3', 'm³',
  'gl', 'glb', 'global',
  'hs', 'h', 'hr', 'hrs', 'hora', 'horas',
  'kg', 'kilo', 'kilos',
  'l', 'lt', 'lts', 'litro', 'litros',
  'rollo', 'rollos', 'pack', 'juego', 'boca', 'bocas'
]);

/**
 * Normaliza cadenas removiendo tildes y caracteres especiales para matching difuso
 */
export function normalizeString(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Parsea un número en formato ARS o estándar (ej: "1.250,50" o "1250.50" o "45" o "$ 35.000")
 */
export function parseLocalizedNumber(valStr: string | number): number {
  if (typeof valStr === 'number') return isNaN(valStr) ? 0 : valStr;
  if (!valStr) return 0;
  const cleaned = String(valStr).trim().replace(/[^0-9,\.]/g, '');
  if (!cleaned) return 0;

  // Si tiene coma y punto (ej: "1.200,50" o "1,200.50")
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Formato es-AR: 1.200,50
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else {
      // Formato en-US: 1,200.50
      return parseFloat(cleaned.replace(/,/g, ''));
    }
  }

  // Si tiene solo coma (ej: "12,5" o "12,50" o "35,000")
  if (cleaned.includes(',')) {
    if (/^\d{1,3}(,\d{3})+$/.test(cleaned)) {
      return parseFloat(cleaned.replace(/,/g, ''));
    }
    return parseFloat(cleaned.replace(',', '.'));
  }

  // Si tiene solo puntos (ej: "35.000" o "1.250.000" o "12.5")
  if (cleaned.includes('.')) {
    if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
      return parseFloat(cleaned.replace(/\./g, ''));
    }
  }

  return parseFloat(cleaned) || 0;
}

/**
 * Calcula la distancia Levenshtein entre dos cadenas de texto (insensible a mayúsculas)
 */
export function levenshteinDistance(a: string, b: string): number {
  const s1 = (a || '').toLowerCase();
  const s2 = (b || '').toLowerCase();
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * Encuentra la coincidencia más cercana en una lista de candidatos según distancia Levenshtein
 */
export function findClosestMatch(target: string, candidates: string[], maxDistance = 3): string | undefined {
  const normTarget = (target || '').trim().toLowerCase();
  let bestMatch: string | undefined = undefined;
  let bestDist = maxDistance + 1;

  for (const cand of candidates) {
    const dist = levenshteinDistance(normTarget, cand.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = cand;
    }
  }

  return bestDist <= maxDistance ? bestMatch : undefined;
}

/**
 * Escapa caracteres especiales para usar un string dentro de un RegExp
 */
export function escapeRegex(str: string): string {
  return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Encuentra el número de línea (1-indexado) en el texto YAML donde aparece una clave o expresión regular.
 * Inicia la búsqueda a partir de startLine para resolver contextos anidados o repetidos.
 */
export function findLineNumberInYaml(
  yamlText: string,
  matcher: string | RegExp,
  startLine: number = 1
): number {
  if (!yamlText) return 1;
  const lines = yamlText.split('\n');
  const startIndex = Math.max(0, startLine - 1);

  if (typeof matcher === 'string') {
    const trimmed = matcher.trim();
    for (let i = startIndex; i < lines.length; i++) {
      if (lines[i].includes(trimmed)) {
        return i + 1;
      }
    }
    // Fallback buscando desde el principio si no se encontró hacia adelante
    if (startIndex > 0) {
      for (let i = 0; i < startIndex; i++) {
        if (lines[i].includes(trimmed)) {
          return i + 1;
        }
      }
    }
  } else {
    for (let i = startIndex; i < lines.length; i++) {
      if (matcher.test(lines[i])) {
        return i + 1;
      }
    }
    // Fallback buscando desde el principio si no se encontró hacia adelante
    if (startIndex > 0) {
      for (let i = 0; i < startIndex; i++) {
        if (matcher.test(lines[i])) {
          return i + 1;
        }
      }
    }
  }

  return startLine > 0 ? startLine : 1;
}

/**
 * Determina si un valor de cantidad u horas provisto por el usuario no es numérico (ej: "muchas", "varias").
 * Retorna false si es un número válido, un valor numérico o una fórmula evaluable (inicia con '=').
 */
export function isNonNumericValue(val: any): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === 'number') return isNaN(val);
  const s = String(val).trim();
  if (!s) return false;
  if (s.startsWith('=')) return false; // Expresión o fórmula
  const cleaned = s.replace(/[$]/g, '').trim();
  const hasDigit = /\d/.test(cleaned);
  return !hasDigit;
}

/**
 * Evalúa una expresión aritmética/fórmula o número localizado utilizando el scope de celdas de cálculo
 */
export function evaluateExpressionOrNumber(
  expr: string | number,
  scope?: Record<string, number>
): number {
  if (typeof expr === 'number') return isNaN(expr) ? 0 : expr;
  if (!expr) return 0;
  const str = String(expr).trim();
  const cleanExpr = str.startsWith('=') ? str.substring(1).trim() : str;
  if (!cleanExpr) return 0;

  // Si no tiene caracteres de fórmula ni variables en scope, parsear directamente como número
  const hasScopeMatch = scope && Object.keys(scope).some((k) => new RegExp(`\\b${k}\\b`, 'i').test(cleanExpr));
  if (!isFormulaString(str) && !hasScopeMatch && !str.startsWith('=')) {
    return parseLocalizedNumber(str);
  }

  const evalRes = evaluateMathExpression(cleanExpr, scope);
  if (evalRes.isValid && evalRes.value !== null) {
    return roundMoney(evalRes.value);
  }
  return parseLocalizedNumber(str);
}

/**
 * Busca de forma flexible la clave de cálculos o variables en un objeto sin importar mayúsculas, acentos o singular/plural
 */
export function findCalculosKey(obj: any): any {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of Object.keys(obj)) {
    if (/^(calculos|calculo|c[aá]lculos|c[aá]lculo|variables|variable|parametros|par[aá]metros|parametro|par[aá]metro|params|param)$/i.test(k.trim())) {
      return obj[k];
    }
  }
  return undefined;
}

/**
 * Extrae pares [variable, valor] desde cualquier estructura (objeto, array, string o número)
 */
export function extractCalculationEntries(rawBlock: any): [string, any][] {
  const entries: [string, any][] = [];
  if (rawBlock === undefined || rawBlock === null) return entries;

  if (Array.isArray(rawBlock)) {
    rawBlock.forEach((item) => {
      if (typeof item === 'object' && item !== null) {
        Object.entries(item).forEach(([k, v]) => entries.push([k, v]));
      } else if (typeof item === 'string') {
        const colonIdx = item.indexOf(':');
        const eqIdx = item.indexOf('=');
        if (colonIdx > 0 && (eqIdx < 0 || colonIdx < eqIdx)) {
          entries.push([item.slice(0, colonIdx).trim(), item.slice(colonIdx + 1).trim()]);
        } else if (eqIdx > 0) {
          entries.push([item.slice(0, eqIdx).trim(), item.slice(eqIdx + 1).trim()]);
        }
      }
    });
  } else if (typeof rawBlock === 'object' && rawBlock !== null) {
    Object.entries(rawBlock).forEach(([k, v]) => entries.push([k, v]));
  } else if (typeof rawBlock === 'string') {
    const lines = rawBlock.split(/[\r\n]+/);
    lines.forEach((l) => {
      const trimmed = l.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const colonIdx = trimmed.indexOf(':');
      const eqIdx = trimmed.indexOf('=');
      if (colonIdx > 0 && (eqIdx < 0 || colonIdx < eqIdx)) {
        entries.push([trimmed.slice(0, colonIdx).trim(), trimmed.slice(colonIdx + 1).trim()]);
      } else if (eqIdx > 0) {
        entries.push([trimmed.slice(0, eqIdx).trim(), trimmed.slice(eqIdx + 1).trim()]);
      } else {
        entries.push(['calculo', trimmed]);
      }
    });
  } else if (typeof rawBlock === 'number' || typeof rawBlock === 'boolean') {
    entries.push(['calculo', rawBlock]);
  }

  return entries;
}

/**
 * Procesa un bloque de cálculo (`calculos:` o `variables:`) resolviendo fórmulas en cascada
 */
export function processCalculationBlock(
  rawBlock: any,
  scope: Record<string, number>,
  scopeType: 'global' | 'local' = 'global'
): CalculatedCell[] {
  const cells: CalculatedCell[] = [];
  if (!rawBlock) return cells;

  const entries = extractCalculationEntries(rawBlock);

  for (const [varName, rawVal] of entries) {
    const cleanName = varName.trim();
    if (!cleanName) continue;

    const rawStr = String(rawVal ?? '').trim();
    let evalValue = 0;
    let isFormula = false;
    let errorMsg: string | undefined = undefined;

    if (typeof rawVal === 'number') {
      evalValue = isNaN(rawVal) ? 0 : rawVal;
      scope[cleanName] = evalValue;
    } else if (typeof rawVal === 'boolean') {
      evalValue = rawVal ? 1 : 0;
      scope[cleanName] = evalValue;
    } else {
      const cleanExpr = rawStr.startsWith('=') ? rawStr.substring(1).trim() : rawStr;
      const evalRes = evaluateMathExpression(cleanExpr, scope);
      if (evalRes.isValid && evalRes.value !== null) {
        evalValue = roundMoney(evalRes.value);
        isFormula = evalRes.isFormula || rawStr.startsWith('=');
        scope[cleanName] = evalValue;
      } else {
        const parsedNum = parseLocalizedNumber(rawStr);
        evalValue = parsedNum;
        scope[cleanName] = evalValue;
        if (evalRes.error && (rawStr.startsWith('=') || isFormulaString(rawStr))) {
          errorMsg = evalRes.error;
        }
      }
    }

    cells.push({
      name: cleanName,
      rawExpression: rawStr,
      evaluatedValue: evalValue,
      isFormula,
      error: errorMsg,
      scope: scopeType
    });
  }

  return cells;
}

/**
 * Genera una plantilla inicial en formato YAML para comenzar una cotización desde cero (limpia, sin datos de relleno)
 */
export function getDefaultPresupuestoYAMLTemplate(context?: {
  clientes?: Cliente[];
  clienteId?: string;
  direccionObra?: string;
}): string {
  const cliente = context?.clientes?.find((c) => c.id === context?.clienteId) || context?.clientes?.[0];
  const clienteNombre = cliente ? (cliente.razonSocial || cliente.nombre) : '';
  const obra = context?.direccionObra || '';

  return `# ============================================================
# COTIZACIÓN INTELIGENTE - MODO EXPERTO (YAML)
# ============================================================

cliente: ${clienteNombre}
obra: ${obra}
factura: Factura C
validez: 15 dias
margen: 35%
riesgo: normal
dolar: no

Capítulo 1:
  - 1 u 
`;
}

/**
 * Genera un ejemplo rico y completo con materiales, mano de obra y variables para aprender la sintaxis
 */
export function generateExampleDSL(cliente?: Cliente): string {
  const clienteNombre = cliente ? (cliente.razonSocial || cliente.nombre) : 'Federico';

  return `# ============================================================
# COTIZACIÓN INTELIGENTE - MODO EXPERTO (YAML)
# Podés escribir directamente, usar comentarios '#' y comandos '/'
# ============================================================

# Datos Principales de la Cotización
cliente: ${clienteNombre}
obra: Av. Corrientes 1234, CABA
factura: Factura C          # Opciones: Factura A, Factura B, Factura C o Presupuesto X
validez: 15 dias
margen: 35%                 # Margen de beneficio sobre costos
riesgo: bajo                # Opciones: bajo, normal, alto
dolar: USD Blue             # Opcional (ej: USD Blue, USD MEP, USD Oficial o cotización)

# Celdas de cálculo y variables reactivas
calculos:
  superficie: 120
  bocas: =ceil(superficie / 6)
  cable_m: =bocas * 12

# ------------------------------------------------------------
# CAPÍTULOS Y PARTIDAS
# ------------------------------------------------------------
Instalación Eléctrica:
  - =bocas u Boca de Iluminación: $ 12.500
  - 4 u Tomacorriente Doble: $ 9.800

Tableros y Automatización:
  # Partida a medida: despiece con cómputo automático de insumos y mano de obra
  - 1 u Reparación y Armado de Tablero:
      materiales:
        - Tablero Modular DIN 24 Módulos Superficie Chapa Metálica Puerta Ciega IP40:
            cantidad: 1
            marca: Gabexel
        - Interruptor Diferencial 2P 40A Sensibilidad 30mA:
            cantidad: 1
            precio: 45000
        - Cable Unipolar 4 mm² Marrón (Fase) IRAM 247-3:
            cantidad: 10
            precio: 1510
      mano_obra:
        - 4 h Oficial Electricista
        - 4 h Ayudante Electricista
      condicion: normal      # Opciones: normal, dificultosa, favorable

# ------------------------------------------------------------
# GASTOS OPERATIVOS E INDIRECTOS (Opcional)
# ------------------------------------------------------------
gastos:
  - Viáticos: $ 15.000
  - Flete y Logística: $ 10.000
`;
}

/**
 * Serializa el estado completo de una cotización en formato YAML limpio y estructurado
/**
 * Extrae el bloque textual "calculos:" (o variables:) de un texto DSL,
 * preservando todas sus líneas, indentación, comentarios y fórmulas.
 */
export function extractCalculosBlockFromDsl(dslText?: string): string | null {
  if (!dslText) return null;
  const lines = dslText.split('\n');
  let inCalculos = false;
  const calculosLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^(calculos|variables|parametros)\s*:/i.test(trimmed) && (line.match(/^\s*/)?.[0] || '').length === 0) {
      inCalculos = true;
      calculosLines.push(line);
      continue;
    }
    if (inCalculos) {
      if (trimmed === '' || trimmed.startsWith('#')) {
        calculosLines.push(line);
        continue;
      }
      const indent = (line.match(/^\s*/)?.[0] || '').length;
      if (indent === 0) {
        // Fin del bloque calculos a nivel raíz
        break;
      }
      calculosLines.push(line);
    }
  }

  while (calculosLines.length > 0 && calculosLines[calculosLines.length - 1].trim() === '') {
    calculosLines.pop();
  }

  return calculosLines.length > 0 ? calculosLines.join('\n') : null;
}

/**
 * Serializa los datos estructurados del Presupuesto a formato YAML legible para el Modo Experto.
 * Si data.dslText existe y data.forceRegenerate no es true, retorna el texto original para no pisar comentarios.
 * Si se regenera, preserva cualquier bloque calculos: previamente definido.
 */
export function serializePresupuestoToDSL(data: {
  clienteId?: string;
  direccionObra?: string;
  tipoFactura?: TipoFactura;
  validezDias?: number;
  margenPorcentaje?: number | null;
  nivelMargenRiesgo?: NivelMargenRiesgo;
  margenRiesgoPorcentaje?: number;
  mostrarDolar?: boolean;
  nombreDolar?: string;
  cotizacionDolar?: number;
  capitulos?: CapituloPresupuesto[];
  items?: ItemPresupuesto[];
  gastosConfig?: GastoPresupuestoConfig[];
  clientes?: Cliente[];
  dslText?: string;
  calculosVariables?: Record<string, number | string>;
  calculatedCells?: CalculatedCell[];
  forceRegenerate?: boolean;
  preserveCalculosFromDsl?: string;
}): string {
  // Si la cotización tiene un dslText persistido original y NO se pidió regeneración forzada, retornarlo directamente
  if (!data.forceRegenerate && data.dslText && data.dslText.trim()) {
    return data.dslText;
  }

  const items = data.items || [];
  const capitulos = data.capitulos || [];

  // Si la cotización está totalmente vacía, retornar plantilla por defecto comentada
  if (
    items.length === 0 &&
    (!data.gastosConfig || data.gastosConfig.length === 0) &&
    !data.clienteId &&
    !data.direccionObra &&
    !data.calculosVariables &&
    !data.calculatedCells &&
    !data.preserveCalculosFromDsl
  ) {
    return getDefaultPresupuestoYAMLTemplate({
      clientes: data.clientes,
      clienteId: data.clienteId,
      direccionObra: data.direccionObra
    });
  }

  const lines: string[] = [];

  lines.push('# ============================================================');
  lines.push('# COTIZACIÓN INTELIGENTE - MODO EXPERTO (YAML)');
  lines.push('# ============================================================');
  lines.push('');

  // 1. Directivas de Cabecera
  const cliente = data.clientes?.find((c) => c.id === data.clienteId);
  lines.push(`cliente: ${cliente ? (cliente.razonSocial || cliente.nombre) : ''}`);
  lines.push(`obra: ${data.direccionObra?.trim() || ''}`);
  lines.push(`factura: ${data.tipoFactura || 'Factura A'}`);
  lines.push(`validez: ${data.validezDias || 15} dias`);
  lines.push(`margen: ${data.margenPorcentaje ?? 35}%`);
  lines.push(`riesgo: ${data.nivelMargenRiesgo || 'normal'}`);

  if (data.mostrarDolar) {
    lines.push(`dolar: ${data.nombreDolar || 'Dólar MEP'} = ${data.cotizacionDolar || 1350}`);
  }

  // 1b. Bloque de Celdas de Cálculo y Variables reactivas persistidas
  const preservedCalculos = extractCalculosBlockFromDsl(data.preserveCalculosFromDsl || (data.forceRegenerate ? data.dslText : undefined));
  if (preservedCalculos) {
    lines.push('');
    lines.push(preservedCalculos);
  } else if (data.calculosVariables && Object.keys(data.calculosVariables).length > 0) {
    lines.push('');
    lines.push('# Celdas de cálculo y variables reactivas');
    lines.push('calculos:');
    Object.entries(data.calculosVariables).forEach(([k, v]) => {
      lines.push(`  ${k}: ${v}`);
    });
  } else if (data.calculatedCells && data.calculatedCells.length > 0) {
    const globalCells = data.calculatedCells.filter((c) => c.scope === 'global');
    if (globalCells.length > 0) {
      lines.push('');
      lines.push('# Celdas de cálculo y variables reactivas');
      lines.push('calculos:');
      globalCells.forEach((c) => {
        lines.push(`  ${c.name}: ${c.rawExpression}`);
      });
    }
  }

  lines.push('');

  // 2. Partidas agrupadas por capítulos
  // Ítems huérfanos sin capítulo
  const orphanItems = items.filter((it) => !it.capituloId);
  if (orphanItems.length > 0) {
    lines.push('Partidas Generales:');
    orphanItems.forEach((it) => serializeSingleItem(it, lines, '  '));
    lines.push('');
  }

  // Capítulos con sus ítems
  capitulos.forEach((cap) => {
    lines.push(`# ------------------------------------------------------------`);
    lines.push(`# CAPÍTULO: ${cap.nombre}`);
    lines.push(`# ------------------------------------------------------------`);
    lines.push(`${cap.nombre}:`);
    const capItems = items.filter((it) => it.capituloId === cap.id);
    if (capItems.length === 0) {
      lines.push('  # (Sin partidas aún - escribí una con / o -)');
    } else {
      capItems.forEach((it) => serializeSingleItem(it, lines, '  '));
    }
    lines.push('');
  });

  // 3. Gastos operativos
  if (data.gastosConfig && data.gastosConfig.length > 0) {
    const activeGastos = data.gastosConfig.filter((g) => g.aplica !== false && (g.valor > 0 || g.modalidad === 'parametrico'));
    if (activeGastos.length > 0) {
      lines.push('# ------------------------------------------------------------');
      lines.push('# GASTOS OPERATIVOS E INDIRECTOS');
      lines.push('# ------------------------------------------------------------');
      lines.push('gastos:');
      activeGastos.forEach((g) => {
        const mod = g.modalidad || (g.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo');
        if (mod === 'porcentual') {
          const destSuffix =
            g.destino === 'mano_obra' ? ' sobre mano_obra' :
            g.destino === 'materiales' ? ' sobre materiales' :
            g.destino === 'servicios' ? ' sobre servicios' :
            g.destino === 'costo_indirecto' ? ' sobre costo_directo' :
            (g.destino ? ` sobre ${g.destino}` : ' sobre costo_directo');
          lines.push(`  - ${g.nombre}: ${g.valor}%${destSuffix}`);
        } else if (mod === 'parametrico' && g.formula) {
          lines.push(`  - ${g.nombre}: =${g.formula}`);
        } else {
          lines.push(`  - ${g.nombre}: $ ${Math.round(g.valor).toLocaleString('es-AR')}`);
        }
      });
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Serializa un ítem individual en YAML (como simple o como compuesto con materiales y MO)
 */
function serializeSingleItem(it: ItemPresupuesto, lines: string[], indent: string) {
  const hasCustomSnapshots =
    (it.esAdHoc || !it.tareaTipoId) &&
    ((it.insumosSnapshot && it.insumosSnapshot.length > 0) ||
     (it.manoObraSnapshot && it.manoObraSnapshot.length > 0));

  if (hasCustomSnapshots) {
    // Tarea compuesta con despiece a medida
    lines.push(`${indent}- ${it.descripcion}:`);
    const qtyDisplay = it.formulaCantidad || it.cantidad;
    if (qtyDisplay && (it.formulaCantidad || it.cantidad !== 1)) {
      lines.push(`${indent}  cantidad: ${qtyDisplay}`);
    }
    if (it.unidad && it.unidad !== 'u') {
      lines.push(`${indent}  unidad: ${it.unidad}`);
    }

    if (it.insumosSnapshot && it.insumosSnapshot.length > 0) {
      lines.push(`${indent}  materiales:`);
      it.insumosSnapshot.forEach((ins) => {
        const cantDisplay = ins.formulaCantidad || ins.cantidadTotal;
        const cantUnit = `${cantDisplay} ${ins.unidad || 'u'}`;
        const priceStr = (ins.precioUnitarioCongelado || 0) > 0 ? `: $ ${Math.round(ins.precioUnitarioCongelado).toLocaleString('es-AR')}` : '';
        const brandStr = ins.marca ? ` [${ins.marca}]` : '';
        lines.push(`${indent}    - ${cantUnit} ${ins.nombre}${brandStr}${priceStr ? ' ' + priceStr : ''}`);
      });
    }

    if (it.manoObraSnapshot && it.manoObraSnapshot.length > 0) {
      lines.push(`${indent}  mano_obra:`);
      it.manoObraSnapshot.forEach((mo) => {
        const hsDisplay = mo.formulaHoras || mo.horasTotales;
        const moPriceStr = (mo.costoHoraCongelado || 0) > 0 ? `: $ ${Math.round(mo.costoHoraCongelado).toLocaleString('es-AR')}` : '';
        lines.push(`${indent}    - ${hsDisplay} h ${mo.nombreCategoria}${moPriceStr ? ' ' + moPriceStr : ''}`);
      });
    }

    if (it.condicionTrabajo && it.condicionTrabajo !== 'normal') {
      lines.push(`${indent}  condicion: ${it.condicionTrabajo}`);
    }

    if (it.precioManual && it.precioManual > 0) {
      lines.push(`${indent}  precio: $ ${Math.round(it.precioManual).toLocaleString('es-AR')}`);
    }
  } else {
    // Tarea simple o directa
    const qtyDisplay = it.formulaCantidad || (it.cantidad || 1);
    let line = `${indent}- ${qtyDisplay} ${it.unidad || 'u'} ${it.descripcion}`;
    if (it.condicionTrabajo && it.condicionTrabajo !== 'normal') {
      line += ` @condicion: ${it.condicionTrabajo}`;
    }
    if (it.precioManual && it.precioManual > 0) {
      line += `: $ ${Math.round(it.precioManual).toLocaleString('es-AR')}`;
    } else if (!it.tareaTipoId && it.costoUnitario && it.costoUnitario > 0) {
      line += `: $ ${Math.round(it.costoUnitario).toLocaleString('es-AR')}`;
    }
    lines.push(line);
  }
}

/**
 * Parsea una línea de texto de ítem o insumo para extraer cantidad, unidad, nombre y precio
 * Ej: "10 u Boca de Iluminación" o "25 m Cable Sintenax 4x4 : $ 4.800"
 */
function parseQuantityAndName(
  raw: string,
  scope?: Record<string, number>
): {
  cantidad: number;
  formulaCantidad?: string;
  unidad: string;
  nombre: string;
  marca?: string;
  condicion?: 'normal' | 'dificultosa' | 'favorable';
  precioManual?: number;
} {
  let str = (raw || '').trim();

  // 1. Condición
  let condicion: 'normal' | 'dificultosa' | 'favorable' | undefined = undefined;
  const condMatch = str.match(/@condicion:\s*(normal|dificultosa|favorable)/i);
  if (condMatch) {
    condicion = condMatch[1].toLowerCase() as any;
    str = str.replace(condMatch[0], '').trim();
  }

  // 2. Precio manual (: $ 15.000 o : $ =precio o : =precio o = $ 15.000 o : 15000)
  let precioManual: number | undefined = undefined;
  const priceMatch = str.match(/(?:[:=]\s*\$?\s*)(=(?:[^\n\r]+)|[0-9.,]+)\s*$/);
  if (priceMatch) {
    const rawPrice = priceMatch[1].trim();
    precioManual = evaluateExpressionOrNumber(rawPrice, scope);
    str = str.slice(0, priceMatch.index).trim();
  }

  // 2b. Marca o Producto comercial entre corchetes (ej: "[Prysmian]", "[Schneider]")
  let marca: string | undefined = undefined;
  const brandMatch = str.match(/\[([^\]]+)\]/);
  if (brandMatch) {
    marca = brandMatch[1].trim();
    str = str.replace(brandMatch[0], '').trim();
  }

  // Quitar asteriscos o comillas sobrantes si venía del DSL viejo
  str = str.replace(/^\*\s*/, '').replace(/^"|"$/g, '').trim();

  // 3a. Cantidad definida mediante celda o fórmula (=bocas, =(sup / 6), etc.)
  if (str.startsWith('=')) {
    const cleanStr = str.substring(1).trim();

    // Comprobar si tiene paréntesis envolvente ej: "(sup / 6) u Boca"
    if (cleanStr.startsWith('(')) {
      let depth = 0;
      let closeIdx = -1;
      for (let i = 0; i < cleanStr.length; i++) {
        if (cleanStr[i] === '(') depth++;
        else if (cleanStr[i] === ')') {
          depth--;
          if (depth === 0) {
            closeIdx = i;
            break;
          }
        }
      }
      if (closeIdx > 0) {
        const formulaPart = cleanStr.substring(1, closeIdx);
        const rest = cleanStr.substring(closeIdx + 1).trim();
        const evalQty = evaluateExpressionOrNumber(formulaPart, scope);
        const formulaCantidad = `=(${formulaPart})`;

        const restMatch = rest.match(/^([a-zA-ZáéíóúÁÉÍÓÚ²³]+)\s+(.+)$/);
        if (restMatch && KNOWN_UNITS.has(restMatch[1].toLowerCase())) {
          return {
            cantidad: evalQty >= 0 ? evalQty : 0,
            formulaCantidad,
            unidad: restMatch[1].toLowerCase(),
            nombre: restMatch[2].trim(),
            marca,
            condicion,
            precioManual
          };
        } else if (rest && KNOWN_UNITS.has(rest.toLowerCase())) {
          return {
            cantidad: evalQty >= 0 ? evalQty : 0,
            formulaCantidad,
            unidad: rest.toLowerCase(),
            nombre: '',
            marca,
            condicion,
            precioManual
          };
        } else {
          return {
            cantidad: evalQty >= 0 ? evalQty : 0,
            formulaCantidad,
            unidad: 'u',
            nombre: rest,
            marca,
            condicion,
            precioManual
          };
        }
      }
    }

    // Sin paréntesis envolvente: buscar unidad conocida separada por espacio
    const tokens = cleanStr.split(/\s+/);
    let unitIdx = -1;
    for (let i = 1; i < tokens.length; i++) {
      if (KNOWN_UNITS.has(tokens[i].toLowerCase())) {
        unitIdx = i;
        break;
      }
    }

    if (unitIdx > 0) {
      const formulaPart = tokens.slice(0, unitIdx).join(' ');
      const unitPart = tokens[unitIdx].toLowerCase();
      const namePart = tokens.slice(unitIdx + 1).join(' ');
      const evalQty = evaluateExpressionOrNumber(formulaPart, scope);
      return {
        cantidad: evalQty >= 0 ? evalQty : 0,
        formulaCantidad: `=${formulaPart}`,
        unidad: unitPart,
        nombre: namePart,
        marca,
        condicion,
        precioManual
      };
    } else {
      // Expresión directa de cantidad (ej: en propiedad cantidad: "=bocas * 12")
      const evalQty = evaluateExpressionOrNumber(cleanStr, scope);
      return {
        cantidad: evalQty >= 0 ? evalQty : 0,
        formulaCantidad: `=${cleanStr}`,
        unidad: 'u',
        nombre: '',
        marca,
        condicion,
        precioManual
      };
    }
  }

  // 3b. Cantidad y Unidad pura sin nombre (ej: "75 m", "50", "4 u", "1.5 hs")
  const pureQtyMatch = str.match(/^([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-ZáéíóúÁÉÍÓÚ²³]+)?$/);
  if (pureQtyMatch) {
    const parsedQty = parseLocalizedNumber(pureQtyMatch[1]);
    const candidateUnit = (pureQtyMatch[2] || '').toLowerCase();
    const unitToUse = candidateUnit && KNOWN_UNITS.has(candidateUnit) ? candidateUnit : (candidateUnit || 'u');
    return {
      cantidad: parsedQty >= 0 ? parsedQty : 0,
      unidad: unitToUse,
      nombre: '',
      marca,
      condicion,
      precioManual
    };
  }

  // 3c. Cantidad y Unidad al inicio seguido de nombre (ej: "10 u ...", "25m ...", "4 ...")
  const match = str.match(/^([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-ZáéíóúÁÉÍÓÚ²³]+)?\s+(.+)$/);
  if (match) {
    const parsedQty = parseLocalizedNumber(match[1]);
    const candidateUnit = (match[2] || '').toLowerCase();
    const restName = match[3].trim().replace(/^"|"$/g, '');

    if (candidateUnit && KNOWN_UNITS.has(candidateUnit)) {
      return {
        cantidad: parsedQty >= 0 ? parsedQty : 0,
        unidad: candidateUnit,
        nombre: restName,
        marca,
        condicion,
        precioManual
      };
    } else {
      // La palabra siguiente no es una unidad conocida -> es parte del nombre
      const fullDesc = (match[2] ? `${match[2]} ` : '') + restName;
      return {
        cantidad: parsedQty >= 0 ? parsedQty : 0,
        unidad: 'u',
        nombre: fullDesc,
        marca,
        condicion,
        precioManual
      };
    }
  }

  // Si no tiene número ni fórmula al inicio, cantidad = 1
  return {
    cantidad: 1,
    unidad: 'u',
    nombre: str.replace(/^"|"$/g, ''),
    marca,
    condicion,
    precioManual
  };
}

/**
 * Preprocesa el texto YAML antes de enviarlo al parser oficial:
 * - Detecta ítems de lista (ej: "- Cable 2.5 mm²" o "- 1 u Cable...") que tienen renglones de propiedades
 *   indentadas debajo (ej: "cantidad: 20", "precio: 500", "producto: ...") pero a los que el usuario
 *   olvidó colocarles los dos puntos ':' al final.
 * - Les añade el ':' final sin alterar el número de renglones ni desfasar los números de línea para diagnósticos.
 */
export function preprocessYamlText(yamlText: string): string {
  const lines = yamlText.split('\n');

  // 1. Normalizar sangría de ítems de despiece dentro de materiales o mano_obra
  // Si un ítem de lista "- " está al mismo nivel de sangría que la cabecera "materiales:" o "mano_obra:"
  // (ej: 6 espacios en vez de 8 espacios), re-indentarlo a (sectionIndent + 2) junto con sus propiedades anidadas.
  let currentSubSection: {
    name: string;
    sectionIndent: number;
    expectedItemIndent: number;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = (line.match(/^\s*/)?.[0] || '').length;

    const secMatch = trimmed.match(/^(materiales|insumos|mano_obra|manoobra|mo)\s*:/i);
    if (secMatch) {
      currentSubSection = {
        name: secMatch[1].toLowerCase(),
        sectionIndent: indent,
        expectedItemIndent: indent + 2
      };
      continue;
    }

    if (currentSubSection) {
      // Si la línea tiene sangría menor o igual a la sección y NO es un ítem de lista (- ), la subsección terminó
      if (indent <= currentSubSection.sectionIndent && !trimmed.startsWith('- ')) {
        currentSubSection = null;
        const nextSecMatch = trimmed.match(/^(materiales|insumos|mano_obra|manoobra|mo)\s*:/i);
        if (nextSecMatch) {
          currentSubSection = {
            name: nextSecMatch[1].toLowerCase(),
            sectionIndent: indent,
            expectedItemIndent: indent + 2
          };
        }
        continue;
      }

      // Si encontramos un ítem de lista con sangría igual o menor a la sección (ej: 6 espacios)
      if (trimmed.startsWith('- ') && indent <= currentSubSection.sectionIndent) {
        const delta = currentSubSection.expectedItemIndent - indent;
        lines[i] = ' '.repeat(currentSubSection.expectedItemIndent) + trimmed;

        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j];
          const nextTrimmed = nextLine.trim();
          if (!nextTrimmed || nextTrimmed.startsWith('#')) {
            j++;
            continue;
          }
          const nextIndent = (nextLine.match(/^\s*/)?.[0] || '').length;
          // Si encontramos una línea con sangría <= sección, ya no pertenece a este ítem
          if (nextIndent <= currentSubSection.sectionIndent) break;
          // Si encontramos otro ítem de lista con sangría <= expectedItemIndent, es el siguiente ítem
          if (nextTrimmed.startsWith('- ') && nextIndent <= currentSubSection.expectedItemIndent) break;

          lines[j] = ' '.repeat(nextIndent + delta) + nextTrimmed;
          j++;
        }
      }
    }
  }

  // 2. Agregar ':' a ítems de lista con propiedades anidadas si el usuario lo olvidó y proteger fórmulas
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (i < lines.length - 1 && trimmed.startsWith('- ') && !trimmed.includes(':')) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length) {
        const nextLine = lines[j];
        const nextTrimmed = nextLine.trim();
        const nextIndent = (nextLine.match(/^\s*/)?.[0] || '').length;
        const currentIndent = (line.match(/^\s*/)?.[0] || '').length;
        if (nextIndent > currentIndent && /^(cantidad|cant|precio|costo|producto|marca|unidad|horas|notas|calculo|calculos):\s*/i.test(nextTrimmed)) {
          lines[i] = line + ':';
        }
      }
    }

    // 2b. Proteger fórmulas no entrecomilladas que comiencen con '=' (ej: 'tue_qty: =incluir_tue ? 5 : 0')
    // para evitar que ':' y '?' provoquen errores de mapeo anidado en YAML
    const formulaMatch = line.match(/^(\s*(?:-\s*)?[-\w\.\sáéíóúÁÉÍÓÚñÑüÜ]+:\s*)(=.+)$/);
    if (formulaMatch) {
      const prefix = formulaMatch[1];
      let val = formulaMatch[2].trim();
      let comment = '';
      const commentIdx = val.indexOf('#');
      if (commentIdx > 0) {
        comment = ' ' + val.substring(commentIdx);
        val = val.substring(0, commentIdx).trim();
      }
      if (!val.startsWith('"') && !val.startsWith("'")) {
        const escapedVal = val.replace(/"/g, '\\"');
        lines[i] = `${prefix}"${escapedVal}"${comment}`;
      }
    }
  }

  // 2c. Normalizar asignaciones 'variable = expresion' dentro de bloques de cálculo a 'variable: "=expresion"'
  let inCalculosBlock = false;
  let calculosBlockIndent = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const currentIndent = (line.match(/^\s*/)?.[0] || '').length;

    if (currentIndent === 0 && /^(calculos|calculo|c[aá]lculos|c[aá]lculo|variables|variable|parametros|par[aá]metros|parametro|par[aá]metro|params|param)\s*:?$/i.test(trimmed)) {
      inCalculosBlock = true;
      calculosBlockIndent = 0;
      if (!trimmed.endsWith(':')) {
        lines[i] = trimmed + ':';
      }
      continue;
    }

    if (inCalculosBlock) {
      if (currentIndent <= calculosBlockIndent && !trimmed.startsWith('-')) {
        inCalculosBlock = false;
      } else {
        // Si tiene formato "nombre = expresion" sin ':'
        const assignMatch = line.match(/^(\s*(?:-\s*)?)([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
        if (assignMatch && !line.includes(':')) {
          const indentAndDash = assignMatch[1];
          const varName = assignMatch[2];
          const expr = assignMatch[3].trim().replace(/^=\s*/, '');
          lines[i] = `${indentAndDash}${varName}: "=${expr}"`;
        }
      }
    }
  }

  // 3. Detectar si hay ítems de lista (- ) huérfanos antes de cualquier capítulo o sin encabezado de capítulo
  const isReservedRootKeyLoose = (k: string): boolean =>
    /^(cliente|obra|factura|validez|margen|riesgo|dolar|totales|gastos|condiciones_pago|partidas|capitulos|calculos|calculo|c[aá]lculos|c[aá]lculo|variables|variable|parametros|par[aá]metros|parametro|par[aá]metro|params|param)$/i.test(k.trim());

  let firstOrphanItemIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ')) {
      let hasParentChapter = false;
      for (let k = i - 1; k >= 0; k--) {
        const rawPrev = lines[k];
        const trPrev = rawPrev.trim();
        if (!trPrev || trPrev.startsWith('#')) continue;
        const indPrev = (rawPrev.match(/^\s*/)?.[0] || '').length;
        if (indPrev === 0 && trPrev.endsWith(':') && !trPrev.startsWith('-')) {
          const key = trPrev.replace(/:$/, '').trim().toLowerCase();
          if (isReservedRootKeyLoose(key)) {
            if (/^(gastos|capitulos|calculos|calculo|c[aá]lculos|c[aá]lculo|variables|variable|parametros|par[aá]metros|parametro|par[aá]metro|params|param)$/i.test(key)) {
              hasParentChapter = true;
              break;
            }
            hasParentChapter = false;
            break;
          }
          hasParentChapter = true;
          break;
        }
      }

      if (!hasParentChapter) {
        firstOrphanItemIndex = i;
        break;
      }
    }
  }

  if (firstOrphanItemIndex !== -1) {
    // Si hay una línea en blanco previa, reemplazarla por "Trabajos:" para no alterar los números de línea
    let replacedBlank = false;
    for (let k = firstOrphanItemIndex - 1; k >= 0; k--) {
      if (lines[k].trim() === '') {
        lines[k] = 'Trabajos:';
        replacedBlank = true;
        break;
      }
    }
    if (!replacedBlank) {
      lines.splice(firstOrphanItemIndex, 0, 'Trabajos:');
    }
  }

  return lines.join('\n');
}

/**
 * Normaliza el destino de un gasto al tipo estándar de la aplicación
 */
export function normalizeGastoDestino(rawDestino: string | undefined): DestinoGasto | undefined {
  if (!rawDestino) return undefined;
  const d = rawDestino.trim().toLowerCase().replace(/[-_]/g, ' ');
  if (d.includes('mano') || d.includes('obra') || d === 'mo' || d === 'labor') {
    return 'mano_obra';
  }
  if (d.includes('material') || d.includes('insumo') || d === 'mat') {
    return 'materiales';
  }
  if (d.includes('servicio') || d.includes('subcontrat') || d === 'serv' || d.includes('alquiler')) {
    return 'servicios';
  }
  if (
    d.includes('direct') ||
    d.includes('total') ||
    d.includes('indirect') ||
    d.includes('general') ||
    d === 'costo directo' ||
    d === 'costos directos' ||
    d === 'costo indirecto'
  ) {
    return 'costo_indirecto';
  }
  return undefined;
}

/**
 * Parsea el valor o expresión asignada a un gasto (porcentual, monto fijo, o paramétrico)
 */
export function parseGastoValueString(
  rawVal: string | number,
  globalScope?: Record<string, number>
): {
  modalidad: ModalidadGasto;
  valor: number;
  destino?: DestinoGasto;
  formula?: string;
} {
  if (typeof rawVal === 'number') {
    return { modalidad: 'monto_fijo', valor: rawVal };
  }

  const str = String(rawVal || '').trim();
  if (!str) {
    return { modalidad: 'monto_fijo', valor: 0 };
  }

  // Si es una fórmula o expresión matemática que empieza con "="
  if (str.startsWith('=')) {
    const expr = str.slice(1).trim();
    let numVal = 0;
    if (globalScope) {
      numVal = evaluateExpressionOrNumber(str, globalScope);
    }
    return {
      modalidad: 'parametrico',
      formula: expr,
      valor: numVal
    };
  }

  // Si contiene porcentaje "%": ej "8% sobre mano_obra", "5 % materiales", "10%", "12.5% s/ costo_directo"
  const pctRegex = /([0-9.,]+)\s*%\s*(?:sobre|s\/|de|en|a)?\s*([a-zA-Z_ ]+)?/i;
  const pctMatch = str.match(pctRegex);
  if (pctMatch) {
    const num = parseLocalizedNumber(pctMatch[1]);
    const rawDest = pctMatch[2];
    const destino = normalizeGastoDestino(rawDest) || 'costo_indirecto';
    return {
      modalidad: 'porcentual',
      valor: num,
      destino
    };
  }

  // Si es un monto fijo en pesos o numérico
  let numVal = 0;
  if (globalScope && (str.includes('+') || str.includes('-') || str.includes('*') || str.includes('/'))) {
    numVal = evaluateExpressionOrNumber(str, globalScope);
  } else {
    numVal = parseLocalizedNumber(str);
  }

  // Verificar si se especificó destino después de un monto
  const destAfter = str.match(/(?:sobre|s\/|de|en|a)\s+([a-zA-Z_ ]+)/i);
  const destino = destAfter ? normalizeGastoDestino(destAfter[1]) : undefined;

  return {
    modalidad: 'monto_fijo',
    valor: numVal,
    destino
  };
}

/**
 * Parsea un renglón o bloque de gasto del YAML vinculándolo al catálogo de CostosIndirectos
 */
export function parseGastoItem(
  g: any,
  gIdx: number,
  context: ParseDSLContext,
  globalScope?: Record<string, number>
): GastoPresupuestoConfig | null {
  if (!g) return null;

  let nombre = `Gasto ${gIdx + 1}`;
  let modalidad: ModalidadGasto | undefined = undefined;
  let valor: number | undefined = undefined;
  let destino: DestinoGasto | undefined = undefined;
  let formula: string | undefined = undefined;
  let parametros: any[] | undefined = undefined;
  let valoresParametros: Record<string, number> | undefined = undefined;
  let aplica = true;

  if (typeof g === 'string') {
    const clean = g.replace(/^-\s*/, '').trim();
    const colonIdx = clean.indexOf(':');
    if (colonIdx > 0) {
      nombre = clean.slice(0, colonIdx).trim();
      const valStr = clean.slice(colonIdx + 1).trim();
      const parsedVal = parseGastoValueString(valStr, globalScope);
      modalidad = parsedVal.modalidad;
      valor = parsedVal.valor;
      destino = parsedVal.destino;
      formula = parsedVal.formula;
    } else {
      nombre = clean;
    }
  } else if (typeof g === 'object' && g !== null) {
    if (typeof g.nombre === 'string') {
      nombre = g.nombre.trim();
      if (g.aplica !== undefined) aplica = Boolean(g.aplica);
      if (g.activo !== undefined) aplica = Boolean(g.activo);
      if (g.formula) {
        formula = String(g.formula);
        modalidad = 'parametrico';
      }
      if (g.destino || g.aplica_a || g.sobre) {
        destino = normalizeGastoDestino(g.destino || g.aplica_a || g.sobre);
      }
      if (g.porcentaje !== undefined || g.pct !== undefined) {
        modalidad = 'porcentual';
        valor = parseLocalizedNumber(g.porcentaje ?? g.pct);
      } else if (g.monto !== undefined || g.precio !== undefined) {
        modalidad = 'monto_fijo';
        valor = parseLocalizedNumber(g.monto ?? g.precio);
      } else if (g.valor !== undefined) {
        const parsedVal = parseGastoValueString(g.valor, globalScope);
        modalidad = parsedVal.modalidad;
        valor = parsedVal.valor;
        if (parsedVal.destino && !destino) destino = parsedVal.destino;
        if (parsedVal.formula && !formula) formula = parsedVal.formula;
      }
      if (g.modalidad) modalidad = g.modalidad;
      if (g.parametros) parametros = g.parametros;
      if (g.valoresParametros) valoresParametros = g.valoresParametros;
    } else {
      const gKey = Object.keys(g)[0];
      if (gKey) {
        nombre = gKey.trim();
        const gVal = g[gKey];
        if (typeof gVal === 'string' || typeof gVal === 'number') {
          const parsedVal = parseGastoValueString(gVal, globalScope);
          modalidad = parsedVal.modalidad;
          valor = parsedVal.valor;
          destino = parsedVal.destino;
          formula = parsedVal.formula;
        } else if (typeof gVal === 'object' && gVal !== null) {
          if (gVal.aplica !== undefined) aplica = Boolean(gVal.aplica);
          if (gVal.activo !== undefined) aplica = Boolean(gVal.activo);
          if (gVal.formula) {
            formula = String(gVal.formula);
            modalidad = 'parametrico';
          }
          if (gVal.destino || gVal.aplica_a || gVal.sobre) {
            destino = normalizeGastoDestino(gVal.destino || gVal.aplica_a || gVal.sobre);
          }
          if (gVal.porcentaje !== undefined || gVal.pct !== undefined) {
            modalidad = 'porcentual';
            valor = parseLocalizedNumber(gVal.porcentaje ?? gVal.pct);
          } else if (gVal.monto !== undefined || gVal.precio !== undefined) {
            modalidad = 'monto_fijo';
            valor = parseLocalizedNumber(gVal.monto ?? gVal.precio);
          } else if (gVal.valor !== undefined) {
            const parsedVal = parseGastoValueString(gVal.valor, globalScope);
            modalidad = parsedVal.modalidad;
            valor = parsedVal.valor;
            if (parsedVal.destino && !destino) destino = parsedVal.destino;
            if (parsedVal.formula && !formula) formula = parsedVal.formula;
          }
          if (gVal.modalidad) modalidad = gVal.modalidad;
          if (gVal.parametros) parametros = gVal.parametros;
          if (gVal.valoresParametros) valoresParametros = gVal.valoresParametros;
        }
      }
    }
  }

  // Matching con catálogo de CostosIndirectos
  const cleanName = normalizeString(nombre);
  const catCI = context.costosIndirectosCatalog?.find((c) => {
    if (c.deleted) return false;
    const cNorm = normalizeString(c.nombre);
    return cNorm === cleanName || (cleanName.length > 4 && cNorm.includes(cleanName));
  });

  const costoIndirectoId = catCI?.id;
  if (catCI) {
    if (modalidad === undefined) {
      modalidad = catCI.modalidad || (catCI.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo');
    }
    if (valor === undefined || valor === 0) {
      valor = catCI.valor || 0;
    }
    if (destino === undefined) {
      destino = catCI.destino || (modalidad === 'porcentual' ? 'costo_indirecto' : undefined);
    }
    if (!formula && catCI.formula) {
      formula = catCI.formula;
    }
    if (!parametros && catCI.parametros) {
      parametros = catCI.parametros;
    }
    if (!valoresParametros && catCI.valoresParametrosDefault) {
      valoresParametros = catCI.valoresParametrosDefault;
    }
  }

  // Defaults finales para gastos libres/manuales
  if (modalidad === undefined) {
    modalidad = 'monto_fijo';
  }
  if (modalidad === 'porcentual' && !destino) {
    destino = 'costo_indirecto';
  }
  if (valor === undefined) {
    valor = 0;
  }

  // Preservar ID existente si ya existía en la cotización
  const existing = context.existingGastos?.find((eg) =>
    (costoIndirectoId && eg.costoIndirectoId === costoIndirectoId) ||
    normalizeString(eg.nombre) === cleanName
  );

  const id = existing?.id || (costoIndirectoId ? `gasto-${costoIndirectoId}` : `gasto-yaml-${gIdx}`);
  if (existing?.valoresParametros && !valoresParametros) {
    valoresParametros = existing.valoresParametros;
  }

  // Si no tiene valor y no es paramétrico ni del catálogo, ignorar
  if (valor <= 0 && modalidad !== 'parametrico' && !costoIndirectoId) {
    return null;
  }

  return {
    id,
    costoIndirectoId,
    nombre,
    modalidad,
    destino,
    valor,
    formula,
    parametros,
    valoresParametros,
    aplica
  };
}

/**
 * Valida la integridad estructural de la jerarquía YAML:
 * - Detecta bloques huérfanos (ej: "materiales:", "mano_obra:", "servicios:" sin ítem de partida padre)
 * - Detecta atributos huérfanos a nivel raíz o directamente bajo capítulo (ej: "cantidad:", "precio:")
 * - Detecta indentaciones impares (no múltiplos de 2)
 */
export function validateYamlStructure(yamlText: string): DSLDiagnostic[] {
  const diagnostics: DSLDiagnostic[] = [];
  if (!yamlText) return diagnostics;

  const lines = yamlText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const lineNum = i + 1;
    const indent = (rawLine.match(/^\s*/)?.[0] || '').length;

    // 1. Verificación de indentación impar
    if (indent % 2 !== 0) {
      diagnostics.push({
        line: lineNum,
        type: 'warning',
        message: `Indentación impar (${indent} espacios) en línea ${lineNum}. La estructura YAML requiere múltiplos de 2 espacios (2, 4, 6, 8).`
      });
    }

    // 2. Bloques de despiece huérfanos (materiales:, mano_obra:, servicios:)
    const secMatch = trimmed.match(/^(materiales|insumos|mano_obra|manoobra|mo|servicios|servicio|subcontratos)\s*:/i);
    if (secMatch) {
      const secName = secMatch[1];
      if (indent === 0) {
        diagnostics.push({
          line: lineNum,
          type: 'error',
          message: `Bloque huérfano "${secName}:" a nivel raíz. Debe estar anidado dentro de una partida (4 espacios de sangría).`
        });
      } else {
        // Buscar hacia arriba el ítem de partida padre (línea previa no vacía con menor sangría)
        let hasParentItem = false;
        for (let j = i - 1; j >= 0; j--) {
          const prevRaw = lines[j];
          const prevTrim = prevRaw.trim();
          if (!prevTrim || prevTrim.startsWith('#')) continue;
          const prevIndent = (prevRaw.match(/^\s*/)?.[0] || '').length;
          if (prevIndent < indent) {
            // El contenedor inmediato debe ser un ítem con viñeta "- "
            if (prevTrim.startsWith('- ')) {
              hasParentItem = true;
            }
            break;
          }
        }
        if (!hasParentItem) {
          diagnostics.push({
            line: lineNum,
            type: 'error',
            message: `Bloque huérfano "${secName}:" sin partida padre. Debe pertenecer a una partida previa con viñeta "- ".`
          });
        }
      }
      continue;
    }

    // 3. Atributos huérfanos a nivel raíz o directamente bajo capítulo
    const attrMatch = trimmed.match(/^(cantidad|cant|qty|precio|costo|price|producto|marca|horas|unidad)\s*:/i);
    if (attrMatch) {
      const attrName = attrMatch[1];
      if (indent === 0) {
        diagnostics.push({
          line: lineNum,
          type: 'error',
          message: `Atributo huérfano "${attrName}:" a nivel raíz. Debe pertenecer a un ítem de partida o material.`
        });
      } else if (indent === 2 && !trimmed.startsWith('- ')) {
        // Verificar si está bajo calculos: o gastos:
        let isInsideCalculosOrGastos = false;
        for (let j = i - 1; j >= 0; j--) {
          const prevRaw = lines[j];
          const prevTrim = prevRaw.trim();
          if (!prevTrim || prevTrim.startsWith('#')) continue;
          const prevIndent = (prevRaw.match(/^\s*/)?.[0] || '').length;
          if (prevIndent === 0) {
            if (/^(calculos|calculo|c[aá]lculos|c[aá]lculo|variables|parametros|gastos)\s*:/i.test(prevTrim)) {
              isInsideCalculosOrGastos = true;
            }
            break;
          }
        }
        if (!isInsideCalculosOrGastos) {
          diagnostics.push({
            line: lineNum,
            type: 'error',
            message: `Atributo huérfano "${attrName}:" directamente bajo capítulo. Debe estar dentro de una partida con viñeta "- ".`
          });
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Parsea el texto YAML completo y construye el estado del Presupuesto
 */
export function parseDSLToPresupuesto(
  yamlText: string,
  context: ParseDSLContext
): ParseDSLResult {
  const diagnostics: DSLDiagnostic[] = [];

  // Validación de Integridad Estructural (huérfanos, indentaciones impares)
  const structuralDiagnostics = validateYamlStructure(yamlText);
  diagnostics.push(...structuralDiagnostics);

  const preprocessed = preprocessYamlText(yamlText);

  let parsed: any = null;
  try {
    parsed = YAML.parse(preprocessed);
  } catch (err: any) {
    const lineNum = err.linePos?.[0]?.line || 1;
    const errMsg = err.message ? err.message.split('\n')[0] : 'Error de sintaxis en el archivo YAML';
    diagnostics.push({
      line: lineNum,
      type: 'error',
      message: `Error de sintaxis YAML (línea ${lineNum}): ${errMsg}`
    });
  }

  // Si el archivo está vacío o sólo tenía comentarios
  if (!parsed || typeof parsed !== 'object') {
    return {
      clienteId: '',
      direccionObra: '',
      tipoFactura: 'Factura A',
      validezDias: 15,
      margenPorcentaje: 35,
      nivelMargenRiesgo: 'medio',
      margenRiesgoPorcentaje: 5,
      mostrarDolar: false,
      nombreDolar: 'Dólar MEP',
      cotizacionDolar: 1350,
      capitulos: [],
      items: [],
      gastosConfig: [],
      diagnostics
    };
  }

  // 1. Directivas Principales
  const VALID_ROOT_DIRECTIVES = [
    'cliente',
    'obra',
    'factura',
    'validez',
    'margen',
    'riesgo',
    'dolar',
    'gastos',
    'calculos',
    'variables',
    'parametros',
    'partidas',
    'capitulos',
    'condiciones_pago',
    'totales'
  ];

  const isReservedRootKey = (k: string): boolean => {
    return /^(cliente|obra|factura|validez|margen|riesgo|dolar|totales|gastos|condiciones_pago|partidas|capitulos|calculos|calculo|c[aá]lculos|c[aá]lculo|variables|variable|parametros|par[aá]metros|parametro|par[aá]metro|params|param)$/i.test(k.trim());
  };

  // Detección de claves raíz desconocidas o con typos
  Object.keys(parsed).forEach((key) => {
    if (isReservedRootKey(key)) return;

    if (Array.isArray(parsed[key])) {
      const normKey = key.trim().toLowerCase();
      if (normKey === 'partida' || normKey === 'capitulo' || normKey === 'gasto') {
        const bestMatch = normKey === 'partida' ? 'partidas' : normKey === 'capitulo' ? 'capitulos' : 'gastos';
        const line = findLineNumberInYaml(yamlText, new RegExp(`^\\s*${escapeRegex(key)}\\s*:`, 'm'));
        diagnostics.push({
          line,
          type: 'warning',
          message: `Propiedad desconocida '${key}' — ¿quisiste decir '${bestMatch}'?`
        });
      }
      return;
    }

    // No es clave reservada y no es un array -> Propiedad raíz desconocida
    const line = findLineNumberInYaml(yamlText, new RegExp(`^\\s*${escapeRegex(key)}\\s*:`, 'm'));
    const closest = findClosestMatch(key, VALID_ROOT_DIRECTIVES, 3);
    if (closest) {
      diagnostics.push({
        line,
        type: 'warning',
        message: `Propiedad desconocida '${key}' — ¿quisiste decir '${closest}'?`
      });
    } else {
      diagnostics.push({
        line,
        type: 'warning',
        message: `Propiedad desconocida '${key}'. Directivas válidas: ${VALID_ROOT_DIRECTIVES.join(', ')}.`
      });
    }
  });

  // Cliente
  let clienteId = '';
  let clienteMatched: Cliente | undefined = undefined;
  let clienteQuery: string | undefined = undefined;
  const clienteLine = findLineNumberInYaml(yamlText, /^\s*cliente\s*:/m);
  if (parsed.cliente !== undefined && parsed.cliente !== null) {
    const rawCli = String(parsed.cliente).trim();
    clienteQuery = rawCli;
    const normCli = normalizeString(rawCli);
    if (normCli && normCli !== 'nombre o estudio del cliente') {
      // 1.1 Match exacto por nombre o razón social
      clienteMatched = context.clientes.find(
        (c) => normalizeString(c.nombre || '') === normCli || normalizeString(c.razonSocial || '') === normCli
      );

      // 1.2 Match por CUIT / DNI si se ingresaron números (7+ dígitos)
      const rawDigits = rawCli.replace(/\D/g, '');
      if (!clienteMatched && rawDigits.length >= 7) {
        clienteMatched = context.clientes.find((c) => {
          const cDigits = (c.cuitDni || c.cuit || '').replace(/\D/g, '');
          return cDigits && (cDigits === rawDigits || cDigits.includes(rawDigits));
        });
      }

      // 1.3 Match parcial por nombre, razón social o nombre de fantasía
      if (!clienteMatched) {
        clienteMatched = context.clientes.find(
          (c) =>
            normalizeString(c.nombre || '').includes(normCli) ||
            normCli.includes(normalizeString(c.nombre || '')) ||
            (c.razonSocial && normalizeString(c.razonSocial).includes(normCli)) ||
            (c.nombreFantasia && normalizeString(c.nombreFantasia).includes(normCli))
        );
      }

      if (clienteMatched) {
        clienteId = clienteMatched.id;
        diagnostics.push({
          line: clienteLine,
          type: 'info',
          message: `✓ Cliente vinculado: "${clienteMatched.razonSocial || clienteMatched.nombre}"`
        });
      } else {
        diagnostics.push({
          line: clienteLine,
          type: 'warning',
          message: `⚠️ Cliente "${rawCli}" no se encontró en la base de contactos.`
        });
      }
    }
  }

  // Obra
  const direccionObra = parsed.obra ? String(parsed.obra).trim() : '';

  // Factura
  let tipoFactura: TipoFactura = 'Factura A';
  const facturaLine = findLineNumberInYaml(yamlText, /^\s*factura\s*:/m);
  if (parsed.factura !== undefined && parsed.factura !== null) {
    const rawFactura = String(parsed.factura).trim();
    const fStr = normalizeString(rawFactura);
    if (/\ba\b/.test(fStr) || fStr.includes('factura a')) {
      tipoFactura = 'Factura A';
    } else if (/\bb\b/.test(fStr) || fStr.includes('factura b')) {
      tipoFactura = 'Factura B';
    } else if (/\bc\b/.test(fStr) || fStr.includes('factura c')) {
      tipoFactura = 'Factura C';
    } else if (fStr.includes('presupuesto') || /\bx\b/.test(fStr) || fStr.includes('sin factura')) {
      tipoFactura = 'Presupuesto X (Sin Factura)';
    } else if (rawFactura) {
      diagnostics.push({
        line: facturaLine,
        type: 'warning',
        message: `Tipo de factura inválido "${rawFactura}". Opciones válidas: Factura A, Factura B, Factura C, Presupuesto X. Se aplicó el valor por defecto "Factura A".`
      });
    }
  }

  // Validez
  let validezDias = 15;
  const validezLine = findLineNumberInYaml(yamlText, /^\s*validez\s*:/m);
  if (parsed.validez !== undefined && parsed.validez !== null) {
    const rawValidez = String(parsed.validez).trim();
    const num = safeNum(parseInt(rawValidez.replace(/\D/g, ''), 10));
    if (num > 0) {
      validezDias = num;
    } else if (rawValidez) {
      diagnostics.push({
        line: validezLine,
        type: 'warning',
        message: `Validez inválida "${rawValidez}". Debe ser una cantidad de días numérica (ej: 15). Se aplicó el valor por defecto 15 días.`
      });
    }
  }

  // Margen
  let margenPorcentaje = 35;
  if (parsed.margen !== undefined && parsed.margen !== null) {
    const mNum = parseLocalizedNumber(parsed.margen);
    if (mNum >= 0) margenPorcentaje = mNum;
  }

  // Riesgo
  let nivelMargenRiesgo: NivelMargenRiesgo = 'medio';
  let margenRiesgoPorcentaje = 5;
  const riesgoLine = findLineNumberInYaml(yamlText, /^\s*riesgo\s*:/m);
  if (parsed.riesgo !== undefined && parsed.riesgo !== null) {
    const rawRiesgo = String(parsed.riesgo).trim();
    const rStr = normalizeString(rawRiesgo);
    if (rStr.includes('alto')) {
      nivelMargenRiesgo = 'alto';
      margenRiesgoPorcentaje = 10;
    } else if (rStr.includes('bajo')) {
      nivelMargenRiesgo = 'bajo';
      margenRiesgoPorcentaje = 0;
    } else if (rStr.includes('medio') || rStr.includes('normal')) {
      nivelMargenRiesgo = 'medio';
      margenRiesgoPorcentaje = 5;
    } else if (rawRiesgo) {
      diagnostics.push({
        line: riesgoLine,
        type: 'warning',
        message: `Nivel de riesgo inválido "${rawRiesgo}". Opciones válidas: alto, medio, bajo. Se aplicó el valor por defecto "medio" (5%).`
      });
    }
  }

  // Dólar
  let mostrarDolar = false;
  let nombreDolar = context.config?.dolarReferenciaNombre || 'USD Blue';
  let cotizacionDolar = context.config?.dolarReferenciaValor || 1400;
  if (parsed.dolar !== undefined && parsed.dolar !== null) {
    const dStr = String(parsed.dolar).trim();
    const dLower = dStr.toLowerCase();
    if (dStr && dLower !== 'no' && dLower !== 'false') {
      mostrarDolar = true;
      const dNum = parseLocalizedNumber(dStr);
      if (dNum > 0) {
        cotizacionDolar = dNum;
      }
      const cleanName = dStr.replace(/[0-9.,$:=]/g, '').trim();
      if (cleanName) {
        nombreDolar = cleanName;
      }
    }
  }

  // Gastos
  const gastosConfig: GastoPresupuestoConfig[] = [];
  if (Array.isArray(parsed.gastos)) {
    parsed.gastos.forEach((g: any, gIdx: number) => {
      const gasto = parseGastoItem(g, gIdx, context);
      if (gasto) {
        gastosConfig.push(gasto);
      }
    });
  }

  // Celdas de cálculo y variables globales
  const globalScope: Record<string, number> = {};
  const rawCalculos = findCalculosKey(parsed);
  const calculatedCells: CalculatedCell[] = [];
  const calculosVariables: Record<string, number | string> = {};

  if (rawCalculos) {
    const calculosLine = findLineNumberInYaml(yamlText, /^\s*c[aá]lculos\s*:/im);
    const entries = extractCalculationEntries(rawCalculos);
    entries.forEach(([k, v]) => {
      calculosVariables[k.trim()] = v as any;
    });

    const cells = processCalculationBlock(rawCalculos, globalScope, 'global');
    calculatedCells.push(...cells);
    if (cells.length > 0) {
      diagnostics.push({
        line: calculosLine,
        type: 'info',
        message: `✓ Celdas de cálculo evaluadas: ${cells.map((c) => `${c.name} = ${c.evaluatedValue}`).join(', ')}`
      });
      cells.forEach((c) => {
        if (c.error) {
          const cellLine = findLineNumberInYaml(yamlText, new RegExp(`^\\s*${escapeRegex(c.name)}\\s*:`, 'm'), calculosLine);
          diagnostics.push({
            line: cellLine,
            type: 'warning',
            message: `Cálculo '${c.name}': ${c.error}`
          });
        }
      });
    }
  }

  // Si los gastos usaban variables o fórmulas de cálculo, re-evaluar con globalScope
  if (Array.isArray(parsed.gastos) && Object.keys(globalScope).length > 0) {
    gastosConfig.length = 0;
    parsed.gastos.forEach((g: any, gIdx: number) => {
      const gasto = parseGastoItem(g, gIdx, context, globalScope);
      if (gasto) {
        gastosConfig.push(gasto);
      }
    });
  }

  // 2. Capítulos y Partidas
  const capitulos: CapituloPresupuesto[] = [];
  const items: ItemPresupuesto[] = [];
  const lineTracker = { currentLine: 1 };

  // Si hay partidas sin capítulo explícito bajo "partidas:"
  if (Array.isArray(parsed.partidas)) {
    parsed.partidas.forEach((rawItem: any) => {
      parseAndAddItem(rawItem, undefined, items, context, diagnostics, globalScope, calculatedCells, yamlText, lineTracker);
    });
  }

  // Si hay lista explícita de "capitulos:"
  if (Array.isArray(parsed.capitulos)) {
    parsed.capitulos.forEach((capObj: any, cIdx: number) => {
      if (capObj && typeof capObj === 'object') {
        const capNombre = capObj.nombre || `Capítulo ${cIdx + 1}`;
        const capId = `cap-${cIdx + 1}-${normalizeString(capNombre).slice(0, 15)}`;
        capitulos.push({ id: capId, nombre: capNombre });
        if (Array.isArray(capObj.partidas)) {
          capObj.partidas.forEach((rawItem: any) => {
            parseAndAddItem(rawItem, capId, items, context, diagnostics, globalScope, calculatedCells, yamlText, lineTracker);
          });
        }
      }
    });
  }

  // Cada clave no reservada que contenga un Array es un Capítulo
  let capIndex = capitulos.length;
  Object.keys(parsed).forEach((key) => {
    if (!isReservedRootKey(key) && Array.isArray(parsed[key])) {
      capIndex++;
      const capNombre = key.trim();
      const capId = `cap-${capIndex}-${normalizeString(capNombre).slice(0, 15).replace(/\s+/g, '-')}`;
      capitulos.push({ id: capId, nombre: capNombre });

      parsed[key].forEach((rawItem: any) => {
        parseAndAddItem(rawItem, capId, items, context, diagnostics, globalScope, calculatedCells, yamlText, lineTracker);
      });
    }
  });

  return {
    clienteId,
    clienteMatched,
    clienteQuery,
    direccionObra,
    tipoFactura,
    validezDias,
    margenPorcentaje,
    nivelMargenRiesgo,
    margenRiesgoPorcentaje,
    mostrarDolar,
    nombreDolar,
    cotizacionDolar,
    capitulos,
    items,
    gastosConfig,
    diagnostics,
    calculatedCells,
    calculosVariables
  };
}

/**
 * Parsea un ítem (simple o compuesto con despiece de materiales y mano de obra) y lo agrega al listado
 */
/**
 * Parsea un ítem (simple o compuesto con despiece de materiales y mano de obra) y lo agrega al listado
 */
function parseAndAddItem(
  rawItem: any,
  capituloId: string | undefined,
  items: ItemPresupuesto[],
  context: ParseDSLContext,
  diagnostics: DSLDiagnostic[],
  scope: Record<string, number> = {},
  calculatedCellsCollector?: CalculatedCell[],
  yamlText: string = '',
  lineTracker: { currentLine: number } = { currentLine: 1 }
) {
  if (!rawItem) return;

  // CASO 1: Ítem simple como string (ej: "- 10 u Boca de Iluminación" o "- =bocas u Boca...")
  if (typeof rawItem === 'string') {
    const itemLine = findLineNumberInYaml(yamlText, new RegExp(`-\\s*${escapeRegex(rawItem.slice(0, 25))}`, 'i'), lineTracker.currentLine);
    lineTracker.currentLine = Math.max(lineTracker.currentLine, itemLine);

    const { cantidad, formulaCantidad, unidad, nombre, condicion, precioManual } = parseQuantityAndName(rawItem, scope);
    if (!nombre.trim() && !precioManual) return;
    if (formulaCantidad && cantidad <= 0) return; // Exclusión condicional reactiva por fórmula
    if (cantidad <= 0) {
      diagnostics.push({
        line: itemLine,
        type: 'error',
        message: `Cantidad inválida (${cantidad}) en la partida "${nombre}". Debe ser mayor a 0.`
      });
    }
    buildAndPushItem({
      nombre,
      cantidad,
      formulaCantidad,
      unidad,
      condicion: condicion || 'normal',
      precioManual,
      capituloId,
      items,
      context,
      diagnostics,
      parametros: scope,
      itemLine
    });
    return;
  }

  // CASO 2: Ítem como objeto
  if (typeof rawItem === 'object' && rawItem !== null) {
    const keys = Object.keys(rawItem);
    if (keys.length === 0) return;

    const taskTitleKey = keys[0];
    const taskContent = rawItem[taskTitleKey];

    const itemLine = findLineNumberInYaml(
      yamlText,
      new RegExp(`-\\s*(?:[0-9]+[\\s\\w]*\\s+)?${escapeRegex(taskTitleKey.slice(0, 25))}`, 'i'),
      lineTracker.currentLine
    );
    lineTracker.currentLine = Math.max(lineTracker.currentLine, itemLine);

    // Ámbito local de cálculo para la tarea (hereda el globalScope)
    const taskScope: Record<string, number> = { ...scope };
    const rawTaskCalculos =
      typeof taskContent === 'object' && taskContent !== null
        ? findCalculosKey(taskContent)
        : undefined;

    if (rawTaskCalculos) {
      const localCells = processCalculationBlock(rawTaskCalculos, taskScope, 'local');
      if (calculatedCellsCollector) {
        calculatedCellsCollector.push(...localCells);
      }
    }

    // 2.1 Si el contenido es un valor primitivo (ej: { "10 u Boca": "$ 15.000" } o { "Boca": "dicroica" })
    if (typeof taskContent === 'string' || typeof taskContent === 'number') {
      const isPrice = /^\s*\$?\s*[0-9.,]+$/.test(String(taskContent));
      if (isPrice) {
        const { cantidad, formulaCantidad, unidad, nombre, condicion } = parseQuantityAndName(taskTitleKey, taskScope);
        const precio = parseLocalizedNumber(taskContent);
        if (!nombre.trim() && !precio) return;
        if (cantidad <= 0) {
          diagnostics.push({
            line: itemLine,
            type: 'error',
            message: `Cantidad inválida (${cantidad}) en la partida "${nombre || taskTitleKey}". Debe ser mayor a 0.`
          });
        }
        buildAndPushItem({
          nombre: nombre.trim() || 'Ítem',
          cantidad,
          formulaCantidad,
          unidad,
          condicion: condicion || 'normal',
          precioManual: precio,
          capituloId,
          items,
          context,
          diagnostics,
          parametros: taskScope,
          itemLine
        });
      } else {
        // String combinado
        const combined = `${taskTitleKey}: ${taskContent}`;
        const { cantidad, formulaCantidad, unidad, nombre, condicion, precioManual } = parseQuantityAndName(combined, taskScope);
        if (!nombre.trim() && !precioManual) return;
        if (cantidad <= 0) {
          diagnostics.push({
            line: itemLine,
            type: 'error',
            message: `Cantidad inválida (${cantidad}) en la partida "${nombre || taskTitleKey}". Debe ser mayor a 0.`
          });
        }
        buildAndPushItem({
          nombre,
          cantidad,
          formulaCantidad,
          unidad,
          condicion: condicion || 'normal',
          precioManual,
          capituloId,
          items,
          context,
          diagnostics,
          parametros: taskScope,
          itemLine
        });
      }
      return;
    }

    // 2.2 Si el contenido es un objeto (Partida a medida compuesta con materiales y/o mano de obra)
    if (typeof taskContent === 'object' && taskContent !== null) {
      const { cantidad: parsedQty, formulaCantidad: parsedQtyFormula, unidad: parsedUnit, nombre: cleanName } = parseQuantityAndName(taskTitleKey, taskScope);

      // Soportar 'cantidad', 'cant', 'qty', o 'calculo' directo cuando es string o número
      const taskQtyRaw =
        taskContent.cantidad !== undefined
          ? taskContent.cantidad
          : taskContent.cant !== undefined
          ? taskContent.cant
          : taskContent.qty !== undefined
          ? taskContent.qty
          : (typeof taskContent.calculo === 'string' || typeof taskContent.calculo === 'number')
          ? taskContent.calculo
          : (typeof taskContent.calculos === 'string' || typeof taskContent.calculos === 'number')
          ? taskContent.calculos
          : undefined;

      let isInvalidQty = false;
      if (taskQtyRaw !== undefined) {
        if (isNonNumericValue(taskQtyRaw)) {
          isInvalidQty = true;
          const qtyLine = findLineNumberInYaml(yamlText, /^\s*(cantidad|cant|qty)\s*:/m, itemLine);
          diagnostics.push({
            line: qtyLine,
            type: 'error',
            message: `Cantidad no numérica "${taskQtyRaw}" en la partida "${cleanName}". Debe ser un número.`
          });
        }
      }

      const rawQtyStr = taskQtyRaw !== undefined ? String(taskQtyRaw).trim() : undefined;
      const formulaCantidad = (rawQtyStr && rawQtyStr.startsWith('=')) ? rawQtyStr : parsedQtyFormula;
      const cantidad = isInvalidQty
        ? 0
        : (taskQtyRaw !== undefined
            ? evaluateExpressionOrNumber(taskQtyRaw, taskScope)
            : parsedQty);

      if (formulaCantidad && cantidad <= 0) {
        return; // Exclusión condicional reactiva por fórmula
      }

      if (cantidad <= 0 && !isInvalidQty && (cleanName.trim() || taskQtyRaw !== undefined)) {
        const qtyLine = findLineNumberInYaml(yamlText, /^\s*(cantidad|cant|qty)\s*:/m, itemLine);
        diagnostics.push({
          line: qtyLine,
          type: 'error',
          message: `Cantidad inválida (${cantidad}) en la partida "${cleanName}". Debe ser mayor a 0.`
        });
      }

      const unidad = (taskContent.unidad || taskContent.unit) ? String(taskContent.unidad || taskContent.unit).trim() : parsedUnit;
      const condicion: 'normal' | 'dificultosa' | 'favorable' =
        (taskContent.condicion || taskContent.condicionTrabajo || 'normal').toLowerCase();

      const taskPrecioRaw =
        taskContent.precio !== undefined
          ? taskContent.precio
          : taskContent.costo !== undefined
          ? taskContent.costo
          : taskContent.price !== undefined
          ? taskContent.price
          : undefined;

      const precioManual = taskPrecioRaw !== undefined
        ? evaluateExpressionOrNumber(taskPrecioRaw, taskScope)
        : undefined;

      const rawMateriales = taskContent.materiales || taskContent.insumos || [];
      const materialesList: any[] = [];
      if (Array.isArray(rawMateriales)) {
        rawMateriales.forEach((item) => {
          if (typeof item === 'object' && item !== null) {
            const firstK = Object.keys(item)[0];
            if (Array.isArray(item[firstK])) {
              const arr = item[firstK];
              const isPropertyArray = arr.some(
                (el: any) =>
                  typeof el === 'object' &&
                  el !== null &&
                  (el.cantidad !== undefined ||
                    el.precio !== undefined ||
                    el.producto !== undefined ||
                    el.marca !== undefined ||
                    el.unidad !== undefined)
              );
              if (isPropertyArray) {
                const mergedProps: any = {};
                arr.forEach((el: any) => {
                  if (typeof el === 'object' && el !== null) {
                    Object.assign(mergedProps, el);
                  }
                });
                materialesList.push({ [firstK]: mergedProps });
              } else {
                materialesList.push(...arr);
              }
            } else {
              materialesList.push(item);
            }
          } else {
            materialesList.push(item);
          }
        });
      } else if (typeof rawMateriales === 'object' && rawMateriales !== null) {
        Object.values(rawMateriales).forEach((val) => {
          if (Array.isArray(val)) {
            materialesList.push(...val);
          } else if (val) {
            materialesList.push(val);
          }
        });
      }

      const rawMo = taskContent.mano_obra || taskContent.manoObra || taskContent.mo || [];
      const manoObraList: any[] = [];
      if (Array.isArray(rawMo)) {
        rawMo.forEach((item) => {
          if (typeof item === 'object' && item !== null) {
            const firstK = Object.keys(item)[0];
            if (Array.isArray(item[firstK])) {
              const arr = item[firstK];
              const isPropertyArray = arr.some(
                (el: any) =>
                  typeof el === 'object' &&
                  el !== null &&
                  (el.cantidad !== undefined ||
                    el.horas !== undefined ||
                    el.precio !== undefined)
              );
              if (isPropertyArray) {
                const mergedProps: any = {};
                arr.forEach((el: any) => {
                  if (typeof el === 'object' && el !== null) {
                    Object.assign(mergedProps, el);
                  }
                });
                manoObraList.push({ [firstK]: mergedProps });
              } else {
                manoObraList.push(...arr);
              }
            } else {
              manoObraList.push(item);
            }
          } else {
            manoObraList.push(item);
          }
        });
      } else if (typeof rawMo === 'object' && rawMo !== null) {
        Object.values(rawMo).forEach((val) => {
          if (Array.isArray(val)) {
            manoObraList.push(...val);
          } else if (val) {
            manoObraList.push(val);
          }
        });
      }

      // Extraer servicios / subcontratos / alquileres si existen
      const rawServicios = taskContent.servicios || taskContent.servicio || taskContent.subcontratos || taskContent.costo_servicios || taskContent.costoServicios;
      const serviciosList: any[] = [];
      if (Array.isArray(rawServicios)) {
        rawServicios.forEach((item) => {
          if (item) serviciosList.push(item);
        });
      } else if (typeof rawServicios === 'object' && rawServicios !== null) {
        Object.entries(rawServicios).forEach(([k, val]) => {
          serviciosList.push({ [k]: val });
        });
      } else if (typeof rawServicios === 'number' || typeof rawServicios === 'string') {
        serviciosList.push({ 'Servicio': rawServicios });
      }

      // Extraer parámetros personalizados para Tareas Tipo paramétricas
      const rawParametros = taskContent.parametros || taskContent.params;
      const parametrosMap: Record<string, number> = { ...taskScope };
      if (typeof rawParametros === 'object' && rawParametros !== null) {
        if (Array.isArray(rawParametros)) {
          rawParametros.forEach((p) => {
            if (typeof p === 'object' && p !== null) {
              Object.entries(p).forEach(([k, v]) => {
                parametrosMap[k] = evaluateExpressionOrNumber(v as any, taskScope);
              });
            }
          });
        } else {
          Object.entries(rawParametros).forEach(([k, v]) => {
            parametrosMap[k] = evaluateExpressionOrNumber(v as any, taskScope);
          });
        }
      }

      // Además, capturar cualquier clave numérica directa en taskContent que no sea directiva reservada
      const reservedTaskKeys = new Set([
        'cantidad', 'unidad', 'condicion', 'condicionTrabajo', 'precio',
        'materiales', 'insumos', 'mano_obra', 'manoObra', 'mo',
        'servicios', 'servicio', 'subcontratos', 'costo_servicios', 'costoServicios',
        'parametros', 'params', 'tipo', 'descripcion', 'producto', 'marca', 'calculos', 'variables'
      ]);
      Object.entries(taskContent).forEach(([k, v]) => {
        if (!reservedTaskKeys.has(k) && (typeof v === 'number' || (typeof v === 'string' && (v.startsWith('=') || /^-?\s*\$?\s*[0-9.,]+$/.test(v))))) {
          parametrosMap[k] = evaluateExpressionOrNumber(v as any, taskScope);
        }
      });

      // Si tiene desglose de materiales, mano de obra o servicios -> Construir APU a medida
      if (materialesList.length > 0 || manoObraList.length > 0 || serviciosList.length > 0) {
        if (!cleanName.trim()) return;
        buildCompositeItem({
          nombre: cleanName,
          cantidad,
          formulaCantidad,
          unidad,
          condicion,
          precioManual,
          materialesList,
          manoObraList,
          serviciosList,
          capituloId,
          items,
          context,
          diagnostics,
          scope: taskScope,
          yamlText,
          itemLine
        });
      } else {
        // Objeto sin despiece pero con configuración directa o paramétrica
        if (!cleanName.trim() && !precioManual) return;
        buildAndPushItem({
          nombre: cleanName,
          cantidad,
          formulaCantidad,
          unidad,
          condicion,
          precioManual,
          capituloId,
          items,
          context,
          diagnostics,
          parametros: Object.keys(parametrosMap).length > 0 ? parametrosMap : undefined,
          itemLine
        });
      }
    }
  }
}

const VALID_MATERIAL_KEYS = new Set([
  'cantidad', 'cant', 'qty', 'c',
  'precio', 'costo', 'price', 'cost',
  'producto', 'prod', 'marca', 'brand', 'modelo',
  'unidad', 'un', 'unit',
  'formula', 'calculo', 'calculos',
  'nombre', 'descripcion', 'notas', 'detalle'
]);

const VALID_MO_KEYS = new Set([
  'horas', 'hora', 'cantidad', 'cant', 'qty',
  'precio', 'costo', 'price', 'cost',
  'categoria', 'nombre', 'descripcion', 'notas',
  'formula', 'calculo', 'calculos'
]);

/**
 * Construye una partida a medida (In Situ) con despiece de materiales y categorías de mano de obra
 */
function buildCompositeItem(params: {
  nombre: string;
  cantidad: number;
  formulaCantidad?: string;
  unidad: string;
  condicion: 'normal' | 'dificultosa' | 'favorable';
  precioManual?: number;
  materialesList: any[];
  manoObraList: any[];
  serviciosList?: any[];
  capituloId?: string;
  items: ItemPresupuesto[];
  context: ParseDSLContext;
  diagnostics: DSLDiagnostic[];
  scope?: Record<string, number>;
  yamlText?: string;
  itemLine?: number;
}) {
  const {
    nombre,
    cantidad,
    formulaCantidad,
    unidad,
    condicion,
    precioManual,
    materialesList,
    manoObraList,
    serviciosList,
    capituloId,
    items,
    context,
    diagnostics,
    scope,
    yamlText,
    itemLine
  } = params;

  const insumosSnapshot: InsumoSnapshot[] = [];
  const allInsumos = Array.from(context.insumosMap.values());

  // 1. Procesar Materiales
  materialesList.forEach((mItem: any) => {
    let mCant = 1;
    let mFormula: string | undefined = undefined;
    let mUn = 'u';
    let mNombre = '';
    let mMarca: string | undefined = undefined;
    let mPrecio: number | undefined = undefined;

    if (typeof mItem === 'string') {
      const parsedM = parseQuantityAndName(mItem, scope);
      mCant = parsedM.cantidad;
      mFormula = parsedM.formulaCantidad;
      mUn = parsedM.unidad;
      mNombre = parsedM.nombre;
      mMarca = parsedM.marca;
      mPrecio = parsedM.precioManual;
    } else if (typeof mItem === 'object' && mItem !== null) {
      if (mItem.nombre) {
        // Formato estructurado explícito: { nombre: "...", cantidad: 2, marca: "...", precio: 1000 }
        mNombre = String(mItem.nombre).trim();
        mMarca = mItem.producto ? String(mItem.producto).trim() : (mItem.marca ? String(mItem.marca).trim() : undefined);
        const mItemPrecioRaw = mItem.precio !== undefined ? mItem.precio : (mItem.costo !== undefined ? mItem.costo : mItem.price);
        mPrecio = mItemPrecioRaw !== undefined ? evaluateExpressionOrNumber(mItemPrecioRaw, scope) : undefined;
        const mItemQty = mItem.cantidad !== undefined ? mItem.cantidad : (mItem.cant !== undefined ? mItem.cant : mItem.qty);
        if (mItemQty !== undefined) {
          if (typeof mItemQty === 'string') {
            const parsedQ = parseQuantityAndName(mItemQty, scope);
            mCant = parsedQ.cantidad;
            mFormula = parsedQ.formulaCantidad;
            if (parsedQ.unidad && parsedQ.unidad !== 'u') mUn = parsedQ.unidad;
          } else {
            mCant = evaluateExpressionOrNumber(mItemQty, scope);
          }
        }
        if (mItem.unidad || mItem.unit) mUn = String(mItem.unidad || mItem.unit).trim();
      } else {
        // Formato clave-valor: { "Cable Unipolar": { cantidad: 25, marca: "Prysmian", precio: 1250 } } o { "Cable": 1250 }
        const mKey = Object.keys(mItem)[0];
        const val = mItem[mKey];
        const parsedM = parseQuantityAndName(mKey, scope);
        mNombre = parsedM.nombre;
        mMarca = parsedM.marca;
        mCant = parsedM.cantidad;
        mFormula = parsedM.formulaCantidad;
        mUn = parsedM.unidad;
        mPrecio = parsedM.precioManual;

        const propSource = (typeof val === 'object' && val !== null) ? val : mItem;
        const propSourceQty = propSource.cantidad !== undefined ? propSource.cantidad : (propSource.cant !== undefined ? propSource.cant : propSource.qty);
        if (propSourceQty !== undefined) {
          if (typeof propSourceQty === 'string') {
            const parsedQ = parseQuantityAndName(propSourceQty, scope);
            mCant = parsedQ.cantidad;
            mFormula = parsedQ.formulaCantidad;
            if (parsedQ.unidad && parsedQ.unidad !== 'u') mUn = parsedQ.unidad;
          } else {
            mCant = evaluateExpressionOrNumber(propSourceQty, scope);
          }
        }
        if (propSource.unidad || propSource.unit) mUn = String(propSource.unidad || propSource.unit).trim();
        if (propSource.producto || propSource.marca) {
          mMarca = String(propSource.producto || propSource.marca).trim();
        }
        const propSourcePrecio = propSource.precio !== undefined ? propSource.precio : (propSource.costo !== undefined ? propSource.costo : propSource.price);
        if (propSourcePrecio !== undefined) {
          mPrecio = evaluateExpressionOrNumber(propSourcePrecio, scope);
        } else if (val !== undefined && val !== null && typeof val !== 'object') {
          mPrecio = evaluateExpressionOrNumber(val, scope);
        }
      }
    }

    const matLine = findLineNumberInYaml(
      yamlText || '',
      escapeRegex(mNombre || (typeof mItem === 'string' ? mItem : Object.keys(mItem || {})[0] || '')),
      itemLine || 1
    );

    // Validación de typos en propiedades de material
    const propSourceObj = typeof mItem === 'object' && mItem !== null
      ? (mItem.nombre ? mItem : (typeof mItem[Object.keys(mItem)[0]] === 'object' && mItem[Object.keys(mItem)[0]] !== null ? mItem[Object.keys(mItem)[0]] : mItem))
      : null;

    if (propSourceObj && typeof propSourceObj === 'object') {
      Object.keys(propSourceObj).forEach((pKey) => {
        const normPKey = pKey.trim().toLowerCase();
        if (normPKey === (mNombre || '').trim().toLowerCase()) return;
        if (!VALID_MATERIAL_KEYS.has(normPKey)) {
          const propLine = findLineNumberInYaml(yamlText || '', new RegExp(`^\\s*${escapeRegex(pKey)}\\s*:`, 'm'), matLine);
          const closest = findClosestMatch(pKey, ['cantidad', 'precio', 'marca', 'producto', 'unidad', 'costo'], 3);
          const fallbackMsg = closest === 'cantidad'
            ? 'Se utilizó la cantidad por defecto (1).'
            : closest === 'precio' || closest === 'costo'
            ? 'Se utilizó el precio del catálogo o $0.'
            : 'Se ignoró la propiedad y se utilizó el valor por defecto.';
          diagnostics.push({
            line: propLine,
            type: 'warning',
            message: closest
              ? `Propiedad no reconocida '${pKey}' en el material "${mNombre || 'Material'}" — ¿quisiste decir '${closest}'? ${fallbackMsg}`
              : `Propiedad no reconocida '${pKey}' en el material "${mNombre || 'Material'}". Se ignoró.`
          });
        }
      });
    }

    // Validación de cantidad no numérica en material
    let isInvalidMatQty = false;
    const rawMatQty = typeof mItem === 'object' && mItem !== null
      ? (mItem.cantidad ?? mItem.cant ?? mItem.qty ?? (typeof mItem[Object.keys(mItem)[0]] === 'object' && mItem[Object.keys(mItem)[0]] !== null ? (mItem[Object.keys(mItem)[0]].cantidad ?? mItem[Object.keys(mItem)[0]].cant ?? mItem[Object.keys(mItem)[0]].qty) : undefined))
      : undefined;

    if (rawMatQty !== undefined && isNonNumericValue(rawMatQty)) {
      isInvalidMatQty = true;
      mCant = 0;
      const qtyLine = findLineNumberInYaml(yamlText || '', /^\s*(cantidad|cant|qty)\s*:/m, matLine);
      diagnostics.push({
        line: qtyLine,
        type: 'error',
        message: `Cantidad no numérica "${rawMatQty}" en el material "${mNombre || 'Material'}". Debe ser un número.`
      });
    }

    if (!mNombre || !mNombre.trim()) return;
    if (mCant <= 0 && !isInvalidMatQty) return; // Si la cantidad calculada es <= 0 y no es error de formato, se omite

    // Buscar insumo en el catálogo (priorizando coincidencia por marca si se indicó)
    const normMat = normalizeString(mNombre);
    if (!normMat) return;
    const normMarca = mMarca ? normalizeString(mMarca) : '';

    let matchedInsumo = allInsumos.find((ins) => {
      const insNorm = normalizeString(ins.nombre);
      const matchName =
        insNorm === normMat ||
        (normMat.length >= 3 && (insNorm.includes(normMat) || normMat.includes(insNorm)));
      if (!matchName) return false;
      if (normMarca) {
        const insMarca = normalizeString(ins.marca || '');
        return insMarca.includes(normMarca) || normMarca.includes(insMarca);
      }
      return true;
    });

    if (!matchedInsumo && normMarca) {
      // Fallback a coincidencia sólo por nombre técnico
      matchedInsumo = allInsumos.find((ins) => {
        const insNorm = normalizeString(ins.nombre);
        return insNorm === normMat || (normMat.length >= 3 && (insNorm.includes(normMat) || normMat.includes(insNorm)));
      });
    }

    let unitCost = 0;
    let insumoId = `mat-adhoc-${crypto.randomUUID().slice(0, 8)}`;
    let finalNombre = mNombre;

    if (matchedInsumo) {
      insumoId = matchedInsumo.id;
      finalNombre = matchedInsumo.nombre;
      unitCost = mPrecio !== undefined && mPrecio > 0 ? mPrecio : (matchedInsumo.precioActual || 0);
    } else {
      unitCost = mPrecio || 0;
      if (unitCost === 0) {
        diagnostics.push({
          line: matLine,
          type: 'warning',
          message: `⚠️ Material "${mNombre}" no está en catálogo ni tiene precio (ej: ": $ 4.500" o "precio: 4500").`
        });
      }
    }

    const totalQty = roundMoney(mCant * cantidad);
    const subtotal = roundMoney(totalQty * unitCost);

    insumosSnapshot.push({
      materialId: matchedInsumo?.id,
      insumoId,
      productoId: matchedInsumo?.productoId,
      nombre: finalNombre,
      marca: mMarca || matchedInsumo?.marca,
      unidad: mUn || matchedInsumo?.unidad || 'u',
      cantidadTotal: totalQty,
      formulaCantidad: mFormula,
      precioUnitarioCongelado: unitCost,
      subtotalInsumo: subtotal,
      subtotalInsumoFinal: subtotal
    });
  });

  // 2. Procesar Mano de Obra
  const manoObraSnapshot: ManoObraSnapshot[] = [];
  const allMo = Array.from(context.manoObraMap.values());

  manoObraList.forEach((moItem: any) => {
    let moHoras = 1;
    let moFormula: string | undefined = undefined;
    let moCatNombre = '';
    let moPrecio: number | undefined = undefined;

    if (typeof moItem === 'string') {
      const parsedMo = parseQuantityAndName(moItem, scope);
      moHoras = parsedMo.cantidad;
      moFormula = parsedMo.formulaCantidad;
      moCatNombre = parsedMo.nombre;
      moPrecio = parsedMo.precioManual;
    } else if (typeof moItem === 'object' && moItem !== null) {
      const moKey = Object.keys(moItem)[0];
      const parsedMo = parseQuantityAndName(moKey, scope);
      moHoras = parsedMo.cantidad;
      moFormula = parsedMo.formulaCantidad;
      moCatNombre = parsedMo.nombre;
      moPrecio = parsedMo.precioManual;
      const val = moItem[moKey];
      const propSource = (typeof val === 'object' && val !== null) ? val : moItem;
      if (propSource.cantidad !== undefined || propSource.horas !== undefined) {
        const rawHours = propSource.cantidad ?? propSource.horas;
        if (typeof rawHours === 'string') {
          const p = parseQuantityAndName(rawHours, scope);
          moHoras = p.cantidad;
          moFormula = p.formulaCantidad;
        } else {
          moHoras = evaluateExpressionOrNumber(rawHours, scope);
        }
      }
      if (propSource.precio !== undefined) {
        moPrecio = evaluateExpressionOrNumber(propSource.precio, scope);
      } else if (val !== undefined && val !== null && typeof val !== 'object') {
        moPrecio = evaluateExpressionOrNumber(val, scope);
      }
    }

    const moLine = findLineNumberInYaml(
      yamlText || '',
      escapeRegex(moCatNombre || (typeof moItem === 'string' ? moItem : Object.keys(moItem || {})[0] || '')),
      itemLine || 1
    );

    // Validación de typos en propiedades de mano de obra
    const moPropSource = typeof moItem === 'object' && moItem !== null
      ? (typeof moItem[Object.keys(moItem)[0]] === 'object' && moItem[Object.keys(moItem)[0]] !== null ? moItem[Object.keys(moItem)[0]] : moItem)
      : null;

    if (moPropSource && typeof moPropSource === 'object') {
      Object.keys(moPropSource).forEach((pKey) => {
        const normPKey = pKey.trim().toLowerCase();
        if (normPKey === (moCatNombre || '').trim().toLowerCase()) return;
        if (!VALID_MO_KEYS.has(normPKey)) {
          const propLine = findLineNumberInYaml(yamlText || '', new RegExp(`^\\s*${escapeRegex(pKey)}\\s*:`, 'm'), moLine);
          const closest = findClosestMatch(pKey, ['horas', 'precio', 'costo', 'categoria'], 3);
          const fallbackMsg = closest === 'horas'
            ? 'Se utilizó la cantidad de horas por defecto (1).'
            : 'Se ignoró la propiedad y se utilizó el valor por defecto.';
          diagnostics.push({
            line: propLine,
            type: 'warning',
            message: closest
              ? `Propiedad no reconocida '${pKey}' en la mano de obra "${moCatNombre || 'Mano de Obra'}" — ¿quisiste decir '${closest}'? ${fallbackMsg}`
              : `Propiedad no reconocida '${pKey}' en la mano de obra "${moCatNombre || 'Mano de Obra'}". Se ignoró.`
          });
        }
      });
    }

    // Validación de horas no numéricas en mano de obra
    let isInvalidMoHours = false;
    const rawMoH = moPropSource ? (moPropSource.cantidad ?? moPropSource.horas) : undefined;
    if (rawMoH !== undefined && isNonNumericValue(rawMoH)) {
      isInvalidMoHours = true;
      moHoras = 0;
      const hLine = findLineNumberInYaml(yamlText || '', /^\s*(horas|hora|cantidad|cant|qty)\s*:/m, moLine);
      diagnostics.push({
        line: hLine,
        type: 'error',
        message: `Horas no numéricas "${rawMoH}" en la mano de obra "${moCatNombre || 'Mano de Obra'}". Debe ser un número.`
      });
    }

    if (!moCatNombre || !moCatNombre.trim()) return;
    if (moHoras <= 0 && !isInvalidMoHours) return; // Si las horas calculadas son <= 0 y no es error de formato, se omite

    const normCat = normalizeString(moCatNombre);
    if (!normCat) return;
    const matchedMo = allMo.find(
      (m) => {
        const mNorm = normalizeString(m.nombre);
        return mNorm === normCat || (normCat.length >= 3 && (mNorm.includes(normCat) || normCat.includes(mNorm)));
      }
    );

    let costoHora = 0;
    let categoriaId = `mo-adhoc-${crypto.randomUUID().slice(0, 8)}`;
    let finalCatName = moCatNombre;

    if (matchedMo) {
      categoriaId = matchedMo.id;
      finalCatName = matchedMo.nombre;
      costoHora = moPrecio !== undefined && moPrecio > 0 ? moPrecio : (matchedMo.costoHora || 0);
    } else {
      costoHora = moPrecio || 0;
      if (costoHora === 0) {
        diagnostics.push({
          line: moLine,
          type: 'warning',
          message: `⚠️ Categoría de Mano de Obra "${moCatNombre}" no encontrada en el sistema ni tiene costo asignado.`
        });
      }
    }

    const totalHoras = roundMoney(moHoras * cantidad);
    const subtotalMo = roundMoney(totalHoras * costoHora);

    manoObraSnapshot.push({
      categoriaId,
      nombreCategoria: finalCatName,
      horasTotales: totalHoras,
      formulaHoras: moFormula,
      costoHoraCongelado: costoHora,
      subtotalManoObra: subtotalMo
    });
  });

  // 3. Procesar Servicios y Subcontratos
  let costoServicios = 0;
  (serviciosList || []).forEach((sItem: any) => {
    let sCant = 1;
    let sPrecio = 0;
    let sNombre = '';
    if (typeof sItem === 'string') {
      const parsedS = parseQuantityAndName(sItem, scope);
      sCant = parsedS.cantidad;
      sNombre = parsedS.nombre;
      sPrecio = parsedS.precioManual || 0;
    } else if (typeof sItem === 'object' && sItem !== null) {
      const sKey = Object.keys(sItem)[0];
      const parsedS = parseQuantityAndName(sKey, scope);
      sNombre = parsedS.nombre;
      sCant = parsedS.cantidad;
      sPrecio = parsedS.precioManual || 0;
      const val = sItem[sKey];
      const propSource = (typeof val === 'object' && val !== null) ? val : sItem;
      if (propSource.cantidad !== undefined) {
        sCant = evaluateExpressionOrNumber(propSource.cantidad, scope);
      }
      const rawPrice = propSource.precio !== undefined ? propSource.precio : (propSource.costo !== undefined ? propSource.costo : val);
      if (rawPrice !== undefined && typeof rawPrice !== 'object') {
        sPrecio = evaluateExpressionOrNumber(rawPrice, scope);
      }
    } else if (typeof sItem === 'number') {
      sPrecio = sItem;
      sNombre = 'Servicio';
    }
    if (sPrecio > 0) {
      costoServicios += roundMoney(sCant * sPrecio * cantidad);
    }
  });

  // 4. Totales de Costo Directo de la Partida a Medida
  const costoInsumos = roundMoney(insumosSnapshot.reduce((acc, i) => acc + (i.subtotalInsumoFinal ?? i.subtotalInsumo), 0));
  const rawMo = manoObraSnapshot.reduce((acc, m) => acc + m.subtotalManoObra, 0);
  const moMultiplier = condicion === 'dificultosa' ? 1.2 : condicion === 'favorable' ? 0.9 : 1.0;
  const costoManoObra = roundMoney(rawMo * moMultiplier);

  const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + costoServicios);
  const costoUnitario = cantidad > 0 ? roundMoney(costoDirectoTotal / cantidad) : costoDirectoTotal;

  const normTarget = normalizeString(nombre);
  let matchedTarea = normTarget
    ? context.tareasTipo.find((t) => normalizeString(t.nombre) === normTarget || t.id === normTarget)
    : undefined;

  const newItem: ItemPresupuesto = {
    id: `item-yaml-${crypto.randomUUID().slice(0, 8)}`,
    capituloId,
    tareaTipoId: matchedTarea?.id,
    descripcion: nombre,
    cantidad,
    formulaCantidad,
    unidad: unidad || matchedTarea?.unidad || 'u',
    naturaleza: matchedTarea?.naturaleza || 'instalacion',
    condicionTrabajo: condicion,
    costoUnitario,
    costoInsumos,
    costoManoObra,
    costoServicios,
    costoDirectoTotal,
    costoTotal: costoDirectoTotal,
    precioManual,
    precioVentaUnitario: precioManual || 0,
    precioVentaTotal: precioManual ? roundMoney(precioManual * cantidad) : 0,
    insumosSnapshot,
    manoObraSnapshot,
    formulaHonorarios: matchedTarea?.formulaHonorarios,
    esAdHoc: true
  };

  items.push(newItem);
  const detailsParts: string[] = [];
  if (insumosSnapshot.length > 0) detailsParts.push(`${insumosSnapshot.length} insumos`);
  if (manoObraSnapshot.length > 0) detailsParts.push(`${manoObraSnapshot.length} cat. MO`);
  if (costoServicios > 0) detailsParts.push(`$ ${costoServicios.toLocaleString('es-AR')} servicios`);
  diagnostics.push({
    line: itemLine || 1,
    type: 'info',
    message: `✓ Partida a medida "${nombre}": ${detailsParts.length > 0 ? detailsParts.join(', ') : 'desglose'} ($ ${costoDirectoTotal.toLocaleString('es-AR')})`
  });
}

/**
 * Construye una partida simple vinculándola al catálogo de Tareas Tipo o como ítem directo
 */
function buildAndPushItem(params: {
  nombre: string;
  cantidad: number;
  formulaCantidad?: string;
  unidad: string;
  condicion: 'normal' | 'dificultosa' | 'favorable';
  precioManual?: number;
  capituloId?: string;
  items: ItemPresupuesto[];
  context: ParseDSLContext;
  diagnostics: DSLDiagnostic[];
  parametros?: Record<string, number>;
  itemLine?: number;
}) {
  const {
    nombre,
    cantidad,
    formulaCantidad,
    unidad,
    condicion,
    precioManual,
    capituloId,
    items,
    context,
    diagnostics,
    parametros,
    itemLine
  } = params;

  // Si el nombre está vacío y no hay precio manual, ignorar viñeta vacía
  if (!nombre.trim() && !precioManual) return;

  const normTarget = normalizeString(nombre);

  // 1. Buscar coincidencia en Catálogo de Tareas Tipo (exacta por nombre o ID)
  let matchedTarea = normTarget
    ? context.tareasTipo.find((t) => normalizeString(t.nombre) === normTarget || t.id === normTarget)
    : undefined;

  if (matchedTarea) {
    // Si tiene parámetros personalizados o definidos en la tarea:
    const paramsMap: Record<string, number> = {};
    if (matchedTarea.parametros) {
      matchedTarea.parametros.forEach((p) => {
        paramsMap[p.id] = p.valorDefault ?? 1;
      });
    }
    if (parametros) {
      Object.entries(parametros).forEach(([k, v]) => {
        paramsMap[k] = safeNum(v);
      });
    }

    const options = {
      tipoFactura: context.config?.tipoFacturaPorDefecto || 'Factura A',
      alicuotaIVADefault: context.config?.alicuotaIVAPorDefecto || context.config?.porcentajeIVAPorDefecto || 21
    };

    const consumos = calcularConsumosTareaTipo(
      matchedTarea,
      paramsMap,
      context.insumosMap,
      context.manoObraMap,
      options
    );

    let multMO = 1.0;
    if (condicion === 'dificultosa') multMO = 1.2;
    if (condicion === 'favorable') multMO = 0.9;

    const costoInsumos = consumos.costoInsumosTotal || 0;
    const costoMO = roundMoney((consumos.costoManoObraTotal || 0) * multMO);
    const costoServicios = consumos.costoServiciosTotal || 0;
    const costoFijo = consumos.costoFijoOperativo || 0;
    const costoUnitarioDirecto = roundMoney(costoInsumos + costoMO + costoServicios + costoFijo);

    const newItem: ItemPresupuesto = {
      id: `item-yaml-${crypto.randomUUID().slice(0, 8)}`,
      capituloId,
      tareaTipoId: matchedTarea.id,
      descripcion: matchedTarea.nombre,
      cantidad,
      formulaCantidad,
      unidad: unidad || matchedTarea.unidad || 'u',
      naturaleza: matchedTarea.naturaleza || 'instalacion',
      condicionTrabajo: condicion,
      costoUnitario: costoUnitarioDirecto,
      costoInsumos: roundMoney(costoInsumos * cantidad),
      costoManoObra: roundMoney(costoMO * cantidad),
      costoServicios: roundMoney(costoServicios * cantidad),
      costoFijoOperativo: costoFijo,
      formulaHonorarios: matchedTarea.formulaHonorarios,
      costoDirectoTotal: roundMoney(costoUnitarioDirecto * cantidad),
      costoTotal: roundMoney(costoUnitarioDirecto * cantidad),
      precioManual,
      precioVentaUnitario: precioManual || 0,
      precioVentaTotal: precioManual ? roundMoney(precioManual * cantidad) : 0,
      valoresParametros: consumos.valoresParametros,
      valoresVariables: consumos.valoresVariables,
      clausulaExclusiones: consumos.clausulaExclusiones,
      insumosSnapshot: consumos.insumosSnapshot.map((i) => ({
        ...i,
        cantidadTotal: roundMoney(i.cantidadTotal * cantidad),
        subtotalInsumo: roundMoney(i.subtotalInsumo * cantidad),
        subtotalInsumoFinal: roundMoney((i.subtotalInsumoFinal ?? i.subtotalInsumo) * cantidad)
      })),
      manoObraSnapshot: consumos.manoObraSnapshot.map((m) => ({
        ...m,
        horasTotales: roundMoney(m.horasTotales * cantidad),
        subtotalManoObra: roundMoney(m.subtotalManoObra * cantidad)
      }))
    };

    items.push(newItem);
    const isParametric = (matchedTarea.parametros && matchedTarea.parametros.length > 0) || (parametros && Object.keys(parametros).length > 0);
    diagnostics.push({
      line: itemLine || 1,
      type: 'info',
      message: isParametric
        ? `✓ Tarea paramétrica calculada: "${matchedTarea.nombre}" (${cantidad} ${newItem.unidad})`
        : `✓ Catálogo vinculado: "${matchedTarea.nombre}" (${cantidad} ${newItem.unidad})`
    });
  } else {
    // Ítem directo o libre
    const directCost = precioManual || 0;
    const newItem: ItemPresupuesto = {
      id: `item-yaml-${crypto.randomUUID().slice(0, 8)}`,
      capituloId,
      descripcion: nombre,
      cantidad,
      formulaCantidad,
      unidad: unidad || 'u',
      naturaleza: 'instalacion',
      condicionTrabajo: condicion,
      costoUnitario: directCost,
      costoInsumos: 0,
      costoManoObra: 0,
      costoServicios: 0,
      costoDirectoTotal: roundMoney(directCost * cantidad),
      costoTotal: roundMoney(directCost * cantidad),
      precioManual,
      precioVentaUnitario: directCost,
      precioVentaTotal: roundMoney(directCost * cantidad),
      insumosSnapshot: [],
      manoObraSnapshot: []
    };

    items.push(newItem);
    diagnostics.push({
      line: itemLine || 1,
      type: 'info',
      message: `Partida directa: "${nombre}" (${cantidad} ${newItem.unidad})`
    });
  }
}

export type CursorContextType = 'materiales' | 'mano_obra' | 'servicios' | 'tareas' | 'item' | 'gastos' | 'calculos' | 'general';

export interface CursorContextResult {
  contextType: CursorContextType;
  currentIndent: string;
  activeCategory?: string;
  parentHeader?: string;
}

/**
 * Analiza el texto previo a la posición del cursor para inferir el contexto semántico YAML actual
 * (materiales, mano de obra, servicios, ítems de partida, tareas tipo, gastos, cálculos o directivas generales).
 * Tolera comentarios (#), líneas intermedias y respeta la jerarquía de indentación.
 */
export function detectCursorContext(textBeforeCursor: string): CursorContextResult {
  const lines = textBeforeCursor.split('\n');
  const currentLine = lines[lines.length - 1] || '';
  const currentIndent = currentLine.match(/^\s*/)?.[0] || '';
  const trimmedCurrent = currentLine.trim();
  const currentIndentLen = currentIndent.length;

  const reservedRootKeys = new Set(['cliente', 'obra', 'factura', 'validez', 'margen', 'riesgo', 'dolar', 'gastos', 'totales', 'calculos', 'variables']);

  // Si estamos en nivel raíz (indent 0) y no es viñeta:
  if (currentIndentLen === 0 && !trimmedCurrent.startsWith('-')) {
    const currentKey = trimmedCurrent.replace(/:.*$/, '').trim().toLowerCase();
    if (reservedRootKeys.has(currentKey)) {
      return { contextType: 'general', currentIndent };
    }
    // Si la última línea no vacía anterior es una clave raíz reservada, seguimos en contexto general
    for (let i = lines.length - 2; i >= 0; i--) {
      const tr = lines[i].trim();
      if (!tr || tr.startsWith('#')) continue;
      const ind = (lines[i].match(/^\s*/)?.[0] || '').length;
      if (ind === 0) {
        const k = tr.replace(/:.*$/, '').trim().toLowerCase();
        if (reservedRootKeys.has(k)) {
          return { contextType: 'general', currentIndent };
        }
      }
      break;
    }
    return { contextType: 'general', currentIndent };
  }

  // Escanear hacia arriba para encontrar la sección contenedora activa
  // En la jerarquía:
  // - Nivel 1 (indent 0): Capítulo / Directivas generales / gastos: / calculos:
  // - Nivel 2 (indent 2-4): Partidas ("- 1 u Boca...", "- Partida...")
  // - Nivel 3 (indent 4-6): Secciones de partida ("materiales:", "mano_obra:", "servicios:", "condicion:", etc.)
  // - Nivel 4 (indent 6-10): Ítems de despiece ("- Cable...", "- 4h Oficial...", "- Alquiler...")
  // - Nivel 5 (indent >= 10): Propiedades de ítems ("cantidad:", "precio:", etc.)

  for (let i = lines.length - 2; i >= 0; i--) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const lineIndent = (rawLine.match(/^\s*/)?.[0] || '').length;

    // 1. Detectar si cruzamos una sección de partida ("materiales:", "mano_obra:", "servicios:")
    const secMatch = trimmed.match(/^(materiales|insumos|mano_obra|manoobra|mo|servicios|servicio|subcontratos)\s*:/i);
    if (secMatch) {
      let secType: CursorContextType = 'materiales';
      if (/^(mano_obra|manoobra|mo)/i.test(secMatch[1])) {
        secType = 'mano_obra';
      } else if (/^(servicios|servicio|subcontratos)/i.test(secMatch[1])) {
        secType = 'servicios';
      }

      // Si la línea actual está indentada más que la cabecera de sección (ej: 8 o 12 > 6),
      // o está a la misma sangría pero empieza con "-" (usuario tipeando ítem de despiece)
      if (currentIndentLen > lineIndent || (currentIndentLen === lineIndent && trimmedCurrent.startsWith('-'))) {
        return { contextType: secType, currentIndent, parentHeader: secType };
      }
      // Si la línea actual tiene sangría menor o igual a la sección y no empieza con "-",
      // la sección ya cerró. Continuamos buscando el contenedor superior (partida o capítulo).
    }

    // 2. Subcategoría bajo materiales (ej: "cables:" o "protecciones:" dentro de materiales:)
    if (trimmed.endsWith(':') && !trimmed.startsWith('-') && lineIndent > 4) {
      for (let j = i - 1; j >= 0; j--) {
        const ancRaw = lines[j];
        const ancTr = ancRaw.trim();
        if (!ancTr || ancTr.startsWith('#')) continue;
        const ancInd = (ancRaw.match(/^\s*/)?.[0] || '').length;
        if (ancInd < lineIndent && /^(materiales|insumos):/i.test(ancTr)) {
          if (currentIndentLen > lineIndent || (currentIndentLen === lineIndent && trimmedCurrent.startsWith('-'))) {
            return {
              contextType: 'materiales',
              currentIndent,
              activeCategory: trimmed.replace(/:$/, '').trim(),
              parentHeader: 'materiales'
            };
          }
          break;
        }
      }
    }

    // 3. Detectar si cruzamos una partida (línea que empieza con "- " con sangría <= 4)
    if (trimmed.startsWith('- ') && lineIndent <= 4) {
      if (currentIndentLen > lineIndent && !trimmedCurrent.startsWith('- ')) {
        // Indentado dentro de una partida (ej: escribiendo propiedades o subsecciones)
        return { contextType: 'item', currentIndent, parentHeader: 'partida' };
      }
      if (currentIndentLen === lineIndent && trimmedCurrent.startsWith('- ')) {
        // En el mismo nivel de partida (otra partida en el capítulo)
        return { contextType: 'tareas', currentIndent, parentHeader: 'capitulo' };
      }
    }

    // 4. Encabezados especiales a nivel raíz (indent === 0): "gastos:", "calculos:", "variables:", "parametros:"
    if (lineIndent === 0) {
      if (/^gastos\s*:?/i.test(trimmed)) {
        if (currentIndentLen > 0) {
          return { contextType: 'gastos', currentIndent, parentHeader: 'gastos' };
        }
      }
      if (/^(calculos|calculo|c[aá]lculos|c[aá]lculo|variables|variable|parametros|par[aá]metros|parametro|par[aá]metro|params|param)\s*:?/i.test(trimmed)) {
        if (currentIndentLen > 0) {
          return { contextType: 'calculos', currentIndent, parentHeader: 'calculos' };
        }
      }
    }

    // 5. Encabezado a nivel raíz (indent 0) con ":" que no sea clave reservada (Capítulo)
    if (lineIndent === 0 && trimmed.endsWith(':') && !trimmed.startsWith('-')) {
      const rootKey = trimmed.replace(/:$/, '').trim().toLowerCase();
      if (!reservedRootKeys.has(rootKey)) {
        return { contextType: 'tareas', currentIndent, parentHeader: trimmed.replace(/:$/, '').trim() };
      }
      break;
    }
  }

  // Si la línea actual es un ítem de lista ("- ") y no fue capturada por una subsección
  if (trimmedCurrent.startsWith('- ')) {
    return { contextType: 'tareas', currentIndent };
  }

  return { contextType: 'general', currentIndent };
}

export interface SuggestTriggerResult {
  triggerChar?: string;
  query: string;
  queryIndexInLine: number;
  isExplicit: boolean;
  directiveType?: 'cliente' | 'obra' | 'factura' | 'validez' | 'margen' | 'riesgo' | 'dolar';
}

export const COMMON_UNITS = new Set([
  'u', 'un', 'm', 'ml', 'm2', 'm²', 'm3', 'm³', 'h', 'hs', 'hora', 'horas',
  'kg', 'l', 'lt', 'boca', 'bocas', 'puntos', 'punto', 'jgo', 'paq', 'caja',
  'cajas', 'bolsa', 'bolsas', 'tira', 'tiras', 'rollo', 'rollos', 'sn', 'servicio', 'locales'
]);

/**
 * Detecta si en la línea actual (hasta la posición del cursor) se debe abrir el menú de sugerencias.
 * Soporta:
 * 1. Disparadores explícitos ("/" o "@"), asegurando que no colisionen con fracciones como "3/4".
 * 2. Directivas de cabecera raíz ("cliente:", "obra:", "factura:", "validez:", "margen:", "riesgo:", "dolar:").
 * 3. IntelliSense automático en ítems de lista ("- ") al escribir nombres de materiales,
 *    incluyendo números con decimales (ej: "cabl 1.5", "cable unipolar 1.5", "3x2.5", "caño 3/4").
 */
export function detectSuggestTrigger(
  currentLineBeforeCursor: string,
  contextType?: CursorContextType
): SuggestTriggerResult | null {
  // Ignorar si el usuario está escribiendo un comentario directo (#)
  if (currentLineBeforeCursor.trim().startsWith('#')) {
    return null;
  }

  // 1. Detección explícita de "/", "@" o "="
  // Debe estar al inicio de línea, precedido de espacio en blanco, o tras dos puntos/guión
  const explicitMatch = currentLineBeforeCursor.match(/(?:^|[\s\-:=])([\/@=])([^\r\n]*)$/);
  if (explicitMatch) {
    const triggerChar = explicitMatch[1];
    const query = explicitMatch[2];
    const sepOffset = explicitMatch[0].length - (triggerChar.length + query.length);
    const queryIndexInLine = (explicitMatch.index ?? 0) + sepOffset;
    return {
      triggerChar,
      query,
      queryIndexInLine,
      isExplicit: true
    };
  }

  // 1.5 Detección contextual en bloque "gastos:"
  // Si estamos dentro del bloque gastos:, sugerir inmediatamente en ítem de lista o línea indentada
  if (contextType === 'gastos') {
    // Caso A: Línea con guión "- " o "-" con o sin texto
    const gastosItemMatch = currentLineBeforeCursor.match(/^(\s{2,4}-\s*)([^\r\n]*)$/);
    if (gastosItemMatch) {
      const prefix = gastosItemMatch[1];
      const rawQuery = gastosItemMatch[2] || '';
      return {
        triggerChar: '-',
        query: rawQuery,
        queryIndexInLine: prefix.length,
        isExplicit: false
      };
    }

    // Caso B: Línea con sangría (2 a 4 espacios) vacía tras presionar Enter
    const emptyGastosLineMatch = currentLineBeforeCursor.match(/^(\s{2,4})$/);
    if (emptyGastosLineMatch) {
      return {
        triggerChar: '',
        query: '',
        queryIndexInLine: currentLineBeforeCursor.length,
        isExplicit: false
      };
    }

    // Caso C: Tipeo sin guión bajo gastos (ej: "  flet" o "    seguro")
    const gastosWordMatch = currentLineBeforeCursor.match(/^(\s{2,4})([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9].*)$/);
    if (gastosWordMatch && !gastosWordMatch[2].includes(':')) {
      return {
        triggerChar: '',
        query: gastosWordMatch[2],
        queryIndexInLine: gastosWordMatch[1].length,
        isExplicit: false
      };
    }
  }

  // 2. Detección de directivas de cabecera raíz (cliente:, obra:, factura:, validez:, margen:, riesgo:, dolar:, calculos:, variables:)
  // Solo a nivel raíz (sangría de 0 a 3 espacios, no dentro de despieces de partidas)
  const rootDirectiveMatch = currentLineBeforeCursor.match(/^(\s{0,3})(cliente|obra|factura|validez|margen|riesgo|dolar|calculos|calculo|c[aá]lculos|c[aá]lculo|variables|variable|parametros|par[aá]metros|parametro|par[aá]metro|params|param)\s*:\s*([^\r\n]*)$/i);
  if (rootDirectiveMatch) {
    const rawDirective = rootDirectiveMatch[2].toLowerCase();
    const isCalculos = /^(calculos|calculo|c[aá]lculos|c[aá]lculo|variables|variable|parametros|par[aá]metros|parametro|par[aá]metro|params|param)$/i.test(rawDirective);
    const directive = isCalculos ? 'calculos' : (rawDirective as
      | 'cliente'
      | 'obra'
      | 'factura'
      | 'validez'
      | 'margen'
      | 'riesgo'
      | 'dolar'
      | 'calculos');
    const query = rootDirectiveMatch[3];
    // Si el usuario ya está escribiendo un comentario '#', no disparar autocompletado
    if (!query.includes('#')) {
      const queryIndexInLine = currentLineBeforeCursor.lastIndexOf(query);
      return {
        triggerChar: directive === 'cliente' ? '@' : (isCalculos ? '/' : ':'),
        query: isCalculos ? 'calc' : query,
        queryIndexInLine: queryIndexInLine >= 0 ? queryIndexInLine : currentLineBeforeCursor.length,
        isExplicit: false,
        directiveType: isCalculos ? undefined : (directive as any)
      };
    }
  }

  // 2.5 Detección de palabras clave raíz al tipear al inicio de línea sin slash (ej: "calc", "var", "gasto", "cliente", "obra")
  const rootKeywordMatch = currentLineBeforeCursor.match(/^(\s{0,3})([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]{2,})$/);
  if (rootKeywordMatch) {
    const rawWord = rootKeywordMatch[2].toLowerCase();
    const isRootCandidate = /^(cal|calc|calculo|calculos|cálculo|cálculos|var|variable|variables|par|param|params|parametro|parametros|parámetro|parámetros|gas|gastos|cli|client|cliente|obr|obra|fac|factura|val|validez|mar|margen|rie|riesgo|dol|dolar|tra|trabajo)$/i.test(rawWord);
    if (isRootCandidate) {
      return {
        triggerChar: '/',
        query: rawWord,
        queryIndexInLine: rootKeywordMatch[1].length,
        isExplicit: false
      };
    }
  }

  // 3. IntelliSense automático en renglón de lista (-)
  // Detecta palabras de 1+ letras o dimensiones como 3x2.5, 2x16, permitiendo caracteres técnicos
  // (. , / " ' - + etc.) para medidas y secciones
  const autoMatch = currentLineBeforeCursor.match(/-\s*(?:[0-9.,]+\s*[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ²³]*\s+)?((?:[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]{1,}|\d+[xX][0-9.,]*)[^\r\n]*)$/);
  if (autoMatch) {
    const rawQuery = autoMatch[1];
    const isKeyword = /^(materiales|insumos|mano_obra|manoobra|mo|servicios|servicio|subcontratos):?$/i.test(rawQuery.trim());
    if (!isKeyword) {
      const queryIndexInLine = currentLineBeforeCursor.lastIndexOf(rawQuery);
      return {
        query: rawQuery,
        queryIndexInLine,
        isExplicit: false
      };
    }
  }

  // 4. IntelliSense automático en línea indentada de propiedades (ej: "            can", "            pre", "            prod")
  // Detecta palabras escritas tras una sangría de al menos 4 espacios sin guión
  const propMatch = currentLineBeforeCursor.match(/^(\s{4,})([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]{1,}[^\r\n]*)$/);
  if (propMatch) {
    const rawQuery = propMatch[2];
    const isKeyword = /^(materiales|insumos|mano_obra|manoobra|mo|servicios|servicio|subcontratos):?$/i.test(rawQuery.trim());
    if (!isKeyword && !rawQuery.includes(':')) {
      return {
        query: rawQuery,
        queryIndexInLine: propMatch[1].length,
        isExplicit: false
      };
    }
  }

  return null;
}

export interface FormatReplacementResult {
  replacementLine: string;
  newCursorOffset: number;
  selectionRange?: { start: number; end: number };
}

/**
 * Reemplaza de forma segura la línea de edición al seleccionar una sugerencia o comando slash,
 * evitando duplicación de guiones (- -), preservando cantidades escritas por el usuario,
 * y manteniendo el nivel de indentación YAML intacto.
 */
export function formatSlashCommandReplacement(params: {
  currentLineBeforeCursor: string;
  snippet: string;
  contextType?: CursorContextType | 'capitulo';
  directiveType?: 'cliente' | 'obra' | 'factura' | 'validez' | 'margen' | 'riesgo' | 'dolar';
}): FormatReplacementResult {
  const { currentLineBeforeCursor, snippet, contextType, directiveType } = params;
  let lineIndent = currentLineBeforeCursor.match(/^\s*/)?.[0] || '';

  // 0. Detección de directivas de cabecera raíz (cliente:, obra:, factura:, validez:, margen:, riesgo:, dolar:)
  const rootDirectiveMatch = currentLineBeforeCursor.match(/^(\s{0,3})(cliente|obra|factura|validez|margen|riesgo|dolar)\s*:/i);
  if (rootDirectiveMatch || (directiveType && directiveType !== 'obra' && currentLineBeforeCursor.trim().startsWith('@'))) {
    const indent = rootDirectiveMatch ? rootDirectiveMatch[1] : '';
    const dir = rootDirectiveMatch ? rootDirectiveMatch[2].toLowerCase() : (directiveType || 'cliente');

    let cleanVal = snippet.trim();
    // Si el snippet ya contiene la directiva prefijada (ej: "cliente: Juan Pérez\n"), extraer solo el valor
    const prefixRegex = new RegExp(`^${dir}\\s*:\\s*`, 'i');
    if (prefixRegex.test(cleanVal)) {
      cleanVal = cleanVal.replace(prefixRegex, '');
    }
    // Asegurar que no empiece con / o @ y limpiar saltos de línea finales sobrantes
    cleanVal = cleanVal.replace(/^[\/@]/, '').replace(/[\r\n]+$/, '');

    const replacementLine = `${indent}${dir}: ${cleanVal}\n`;
    return {
      replacementLine,
      newCursorOffset: replacementLine.length,
      selectionRange: undefined
    };
  }

  // Detección de completado de variable de cálculo (ej: "=bocas")
  if (snippet.startsWith('=')) {
    const cleanVar = snippet.trim();
    let baseLine = currentLineBeforeCursor;
    const eqIdx = baseLine.lastIndexOf('=');
    if (eqIdx >= 0) {
      baseLine = baseLine.slice(0, eqIdx);
    }
    const replacementLine = `${baseLine}${cleanVar} `;
    return {
      replacementLine,
      newCursorOffset: replacementLine.length,
      selectionRange: undefined
    };
  }

  // Garantizar sangría técnica según el tipo de elemento y el contexto
  if (/^(materiales|mano_obra|servicios|condicion|precio|cantidad|unidad|parametros|calculos):/i.test(snippet.trim())) {
    lineIndent = '      ';
  } else if (contextType === 'materiales' || contextType === 'mano_obra' || contextType === 'servicios') {
    if (snippet.trim().startsWith('- ') && lineIndent.length < 8) {
      lineIndent = '        ';
    } else if (/^(cantidad|precio|producto|marca|unidad|horas|notas):\s*/i.test(snippet.trim()) && lineIndent.length < 12) {
      lineIndent = '            ';
    }
  } else if (contextType === 'gastos') {
    if (snippet.trim().startsWith('- ') && lineIndent.length < 2) {
      lineIndent = '  ';
    } else if (/^(porcentaje|pct|monto|precio|aplica_a|destino|formula):\s*/i.test(snippet.trim()) && lineIndent.length < 4) {
      lineIndent = '    ';
    } else if (lineIndent.length < 2) {
      lineIndent = '  ';
    }
  } else if (contextType === 'calculos') {
    if (snippet.trim().startsWith('- ') && lineIndent.length < 2) {
      lineIndent = '  ';
    } else if (lineIndent.length < 2) {
      lineIndent = '  ';
    }
  } else if (contextType === 'tareas') {
    if (snippet.trim().startsWith('- ') && lineIndent.length < 2) {
      lineIndent = '  ';
    }
  }

  // Detectar si el usuario ya escribió cantidad / unidad antes de la query
  // Ejemplos: "        - 25 m ", "        - 10 ", "        - 1.5 hs ", "        - 25 cabl" (solo cantidad 25)
  const userQtyMatch = currentLineBeforeCursor.match(/^\s*-\s*([0-9.,]+)(?:\s+([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ²³]+))?\s+/);
  let userQtyUnit: string | null = null;
  if (userQtyMatch) {
    const num = userQtyMatch[1];
    const possibleUnit = userQtyMatch[2];
    if (possibleUnit) {
      if (COMMON_UNITS.has(possibleUnit.toLowerCase())) {
        userQtyUnit = `${num} ${possibleUnit}`;
      } else {
        // La palabra era parte del término buscado (ej: "- 25 cabl 1.5"), preservamos solo el número
        userQtyUnit = num;
      }
    } else {
      userQtyUnit = num;
    }
  }

  let replacementLine = '';
  let selectionRange: { start: number; end: number } | undefined = undefined;
  let newCursorOffset: number | undefined = undefined;

  const isMultiLine = snippet.trim().includes('\n');

  if (isMultiLine) {
    let processedSnippet = snippet;

    // Si el usuario ya tipeó cantidad previa y el snippet tiene propiedad `cantidad:`, inyectarla
    if (userQtyUnit) {
      if (/cantidad:\s*(\n|$)/.test(processedSnippet)) {
        processedSnippet = processedSnippet.replace(/cantidad:\s*(\n|$)/, `cantidad: ${userQtyUnit}\n`);
      } else if (/cantidad:\s*([0-9.,]+)\s*([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ²³]+)?/.test(processedSnippet)) {
        processedSnippet = processedSnippet.replace(
          /cantidad:\s*([0-9.,]+)\s*([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ²³]+)?/,
          `cantidad: ${userQtyUnit}`
        );
      }
    }

    // Indentar línea por línea según la sangría actual
    const lines = processedSnippet.split('\n');
    const indented = lines.map((l, idx) => {
      if (!l.trim() && idx === lines.length - 1) return '';
      return `${lineIndent}${l}`;
    });
    replacementLine = indented.join('\n');

    // Ubicar el cursor: si hay `cantidad: `, colocarlo justo allí
    const cantMatch = replacementLine.match(/cantidad:\s*([^\n\r]*)/);
    const pctBlockMatch = replacementLine.match(/porcentaje:\s*([^\n\r]*)/);
    const montoBlockMatch = replacementLine.match(/monto:\s*([^\n\r]*)/);

    if (cantMatch && cantMatch.index !== undefined) {
      const matchIndex = cantMatch.index;
      const colonIndex = cantMatch[0].indexOf(':');
      const valPart = cantMatch[1].trim();

      if (!userQtyUnit && !valPart) {
        // Campo cantidad en blanco: cursor inmediatamente después de "cantidad: "
        const afterColon = matchIndex + colonIndex + (cantMatch[0].includes(': ') ? 2 : 1);
        newCursorOffset = afterColon;
        selectionRange = undefined;
      } else if (!userQtyUnit && valPart) {
        // Tiene un valor por defecto (ej: "1 u"): seleccionar el número inicial
        const numMatch = valPart.match(/^([0-9.,]+)/);
        if (numMatch) {
          const numStart = matchIndex + colonIndex + cantMatch[0].slice(colonIndex).indexOf(numMatch[1]);
          const numEnd = numStart + numMatch[1].length;
          selectionRange = { start: numStart, end: numEnd };
          newCursorOffset = numEnd;
        } else {
          newCursorOffset = matchIndex + colonIndex + 2;
        }
      } else {
        // Cantidad ya fue rellenada con userQtyUnit
        newCursorOffset = replacementLine.length;
      }
    } else if (pctBlockMatch && pctBlockMatch.index !== undefined) {
      const matchIndex = pctBlockMatch.index;
      const colonIndex = pctBlockMatch[0].indexOf(':');
      const valPart = pctBlockMatch[1].trim();
      const numMatch = valPart.match(/^([0-9.,]+)/);
      if (numMatch) {
        const numStart = matchIndex + colonIndex + pctBlockMatch[0].slice(colonIndex).indexOf(numMatch[1]);
        const numEnd = numStart + numMatch[1].length;
        selectionRange = { start: numStart, end: numEnd };
        newCursorOffset = numEnd;
      } else {
        newCursorOffset = matchIndex + colonIndex + 2;
      }
    } else if (montoBlockMatch && montoBlockMatch.index !== undefined) {
      const matchIndex = montoBlockMatch.index;
      const colonIndex = montoBlockMatch[0].indexOf(':');
      const valPart = montoBlockMatch[1].trim();
      const numMatch = valPart.match(/^([0-9.,]+)/);
      if (numMatch) {
        const numStart = matchIndex + colonIndex + montoBlockMatch[0].slice(colonIndex).indexOf(numMatch[1]);
        const numEnd = numStart + numMatch[1].length;
        selectionRange = { start: numStart, end: numEnd };
        newCursorOffset = numEnd;
      } else {
        newCursorOffset = matchIndex + colonIndex + 2;
      }
    } else {
      newCursorOffset = replacementLine.length;
    }
  } else if (snippet.startsWith('- ')) {
    // Snippet de ítem de lista de una sola línea
    const snippetMatch = snippet.match(/^-\s*([0-9.,]+)\s*([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ²³]+)\s+(.+?)(?:\n|$)/);
    if (snippetMatch) {
      const defaultQtyNum = snippetMatch[1];
      const defaultQtyUnit = `${defaultQtyNum} ${snippetMatch[2]}`;
      const defaultUnit = snippetMatch[2];
      const itemName = snippetMatch[3];
      let qtyUnitToUse = userQtyUnit || defaultQtyUnit;
      // Si el usuario solo puso número pero no unidad, añadir la unidad por defecto del catálogo
      if (userQtyUnit && /^[0-9.,]+$/.test(userQtyUnit)) {
        qtyUnitToUse = `${userQtyUnit} ${defaultUnit}`;
      }
      replacementLine = `${lineIndent}- ${qtyUnitToUse} ${itemName}\n`;

      // Si el usuario no había escrito cantidad previa, seleccionamos el número por defecto (ej: "1")
      // para que al tipear un número, lo reemplace inmediatamente
      if (!userQtyUnit) {
        const qtyNumStart = lineIndent.length + 2; // tras "- "
        const qtyNumEnd = qtyNumStart + defaultQtyNum.length;
        selectionRange = { start: qtyNumStart, end: qtyNumEnd };
      }
      newCursorOffset = replacementLine.length;
    } else {
      // Snippet simple sin cantidad inline (ej: "- Cable Unipolar [Prysmian]\n", "- Viáticos: $ 15.000\n", "- Seguro ART: 8% sobre mano_obra\n")
      const afterDash = snippet.slice(2).trim();
      if (userQtyUnit) {
        replacementLine = `${lineIndent}- ${userQtyUnit} ${afterDash}\n`;
      } else {
        replacementLine = `${lineIndent}- ${afterDash}\n`;
      }
      const pctMatch = replacementLine.match(/:\s*([0-9.,]+)\s*%/);
      const priceMatch = replacementLine.match(/:\s*\$?\s*([0-9.,]+)/);
      if (pctMatch && pctMatch.index !== undefined) {
        const numStart = pctMatch.index + pctMatch[0].indexOf(pctMatch[1]);
        const numEnd = numStart + pctMatch[1].length;
        selectionRange = { start: numStart, end: numEnd };
      } else if (priceMatch && priceMatch.index !== undefined) {
        const numStart = priceMatch.index + priceMatch[0].lastIndexOf(priceMatch[1]);
        const numEnd = numStart + priceMatch[1].length;
        selectionRange = { start: numStart, end: numEnd };
      }
      newCursorOffset = replacementLine.length;
    }
  } else {
    // Directiva o encabezado
    const cleanSnippet = snippet.replace(/^[\/@]/, '');
    replacementLine = `${lineIndent}${cleanSnippet}`;
    newCursorOffset = replacementLine.length;
  }

  return {
    replacementLine,
    newCursorOffset: newCursorOffset ?? replacementLine.length,
    selectionRange
  };
}

export interface SmartEnterResult {
  newText: string;
  newCursorPos: number;
}

/**
 * Maneja el comportamiento inteligente de la tecla Enter en el editor YAML experto.
 * 1. Si se escribe "materiales:", "mano_obra:" o "servicios:" debajo de un ítem:
 *    - Le agrega ':' al ítem superior si no lo tenía.
 *    - Quita el guión inicial y sangra la sección con 6 espacios bajo el ítem.
 *    - Genera en el nuevo renglón "        - " listo para listar insumos o servicios.
 * 2. Si el renglón actual es una viñeta vacía ("- "), desindenta y cancela la viñeta.
 * 3. Si el renglón es un ítem con dos puntos ("- Cable:"), abre bloque de propiedades anidadas ("cantidad: ").
 * 4. Si el renglón termina en ':', auto-indenta el siguiente renglón con viñeta de lista ("- ").
 * 5. Si el renglón es un ítem de lista ("- algo"), continúa la lista con la misma sangría.
 * 6. Si es un renglón vacío tras propiedades, desindenta para continuar con el siguiente ítem ("- ").
 */
export function handleYamlSmartEnter(params: {
  textBefore: string;
  textAfter: string;
}): SmartEnterResult {
  const { textBefore, textAfter } = params;
  const lastLineStart = textBefore.lastIndexOf('\n') + 1;
  const currentLine = textBefore.substring(lastLineStart);
  const leadingWhitespace = currentLine.match(/^\s*/)?.[0] || '';
  const trimmed = currentLine.trim();
  const linesBefore = textBefore.split('\n');

  // Caso 1: La línea actual es la palabra clave "materiales", "mano_obra" o "servicios" (con o sin guión, con o sin ':')
  const isMaterialesKeyword = /^-\s*(materiales|insumos)\s*:?$/i.test(trimmed) || /^(materiales|insumos)\s*:?$/i.test(trimmed);
  const isManoObraKeyword = /^-\s*(mano_obra|manoobra|mo)\s*:?$/i.test(trimmed) || /^(mano_obra|manoobra|mo)\s*:?$/i.test(trimmed);
  const isServiciosKeyword = /^-\s*(servicios|servicio|subcontratos)\s*:?$/i.test(trimmed) || /^(servicios|servicio|subcontratos)\s*:?$/i.test(trimmed);

  if (isMaterialesKeyword || isManoObraKeyword || isServiciosKeyword) {
    const keyword = isMaterialesKeyword ? 'materiales:' : (isManoObraKeyword ? 'mano_obra:' : 'servicios:');

    // Buscar hacia arriba el ítem de partida padre
    let parentItemIndent = '  ';

    for (let i = linesBefore.length - 2; i >= 0; i--) {
      const raw = linesBefore[i];
      const tr = raw.trim();
      if (!tr || tr.startsWith('#')) continue;
      const ind = raw.match(/^\s*/)?.[0] || '';

      // Si encontramos un ítem de partida (ej: "  - 10 u Bocas...")
      if (tr.startsWith('- ') && ind.length <= 4) {
        parentItemIndent = ind;
        if (!tr.endsWith(':')) {
          linesBefore[i] = raw.trimEnd() + ':';
        }
        break;
      }

      // O si encontramos una clave de sección previa (para alinear mano_obra o servicios)
      if (/^\s*(materiales|insumos|mano_obra|manoobra|mo|servicios|servicio|subcontratos):/i.test(raw)) {
        parentItemIndent = ind.length >= 2 ? ind.slice(0, ind.length - 2) : '';
        break;
      }
    }

    // Jerarquía semántica:
    // Partida: 2 espacios ("  - ") -> Sub-bloque: 4 espacios ("    materiales:") -> Despiece: 6 espacios ("      - ")
    const keywordIndent = parentItemIndent + '  ';
    linesBefore[linesBefore.length - 1] = keywordIndent + keyword;

    const childIndent = keywordIndent + '  ';
    const nextLine = childIndent + '- ';

    const updatedBefore = linesBefore.join('\n') + '\n' + nextLine;
    return {
      newText: updatedBefore + textAfter,
      newCursorPos: updatedBefore.length
    };
  }

  // Caso 1.1: Cabecera de bloque "gastos:" a nivel raíz
  const isGastosKeyword = /^-\s*gastos\s*:?$/i.test(trimmed) || /^gastos\s*:?$/i.test(trimmed);
  if (isGastosKeyword && leadingWhitespace.length === 0) {
    linesBefore[linesBefore.length - 1] = 'gastos:';
    const updatedBefore = linesBefore.join('\n') + '\n  - ';
    return {
      newText: updatedBefore + textAfter,
      newCursorPos: updatedBefore.length
    };
  }

  // Caso 1.2: Cabecera de bloque de cálculos / variables / parámetros
  // NO debe insertar viñeta "- ", sino sangría limpia de 2 espacios para definir pares "variable: valor"
  const isCalculosKeyword = /^-\s*(calculos|calculo|c[aá]lculos|c[aá]lculo|variables|variable|parametros|par[aá]metros|parametro|par[aá]metro|params|param)\s*:?$/i.test(trimmed) || /^(calculos|calculo|c[aá]lculos|c[aá]lculo|variables|variable|parametros|par[aá]metros|parametro|par[aá]metro|params|param)\s*:?$/i.test(trimmed);
  if (isCalculosKeyword) {
    const rawWord = trimmed.replace(/^-\s*/, '').replace(/:.*$/, '').trim();
    const keyword = `${rawWord}:`;
    linesBefore[linesBefore.length - 1] = leadingWhitespace + keyword;
    const nextIndent = leadingWhitespace + '  ';
    const updatedBefore = linesBefore.join('\n') + '\n' + nextIndent;
    return {
      newText: updatedBefore + textAfter,
      newCursorPos: updatedBefore.length
    };
  }

  // Caso 2: Renglón con ítem de lista vacío (ej: "        - " o "      - " o "  -")
  // Al presionar Enter, se cancela la viñeta y se desindenta un nivel hacia afuera
  if (/^-\s*$/.test(trimmed)) {
    let unindented = '';
    if (leadingWhitespace.length >= 8) {
      // De nivel legacy (8 espacios + "- ") a 6 espacios
      unindented = '      ';
    } else if (leadingWhitespace.length >= 6) {
      // De nivel 3 (6 espacios + "- ") a nivel 2 (4 espacios)
      unindented = '    ';
    } else if (leadingWhitespace.length >= 2) {
      // De nivel 1 (2 espacios + "- ") a nivel 0 (raíz/capítulo)
      unindented = '';
    } else {
      unindented = '';
    }

    const newText = textBefore.substring(0, lastLineStart) + unindented + textAfter;
    return {
      newText,
      newCursorPos: lastLineStart + unindented.length
    };
  }

  // Caso 2.5: Renglón vacío con sangría (ej: "            " o "        " o "    ")
  // Al presionar Enter en una línea vacía, desindenta un nivel hacia afuera en la jerarquía YAML
  if (trimmed === '' && leadingWhitespace.length >= 2) {
    let unindented = '';
    if (leadingWhitespace.length >= 10) {
      // De nivel legacy (10 o 12 espacios) a 8 espacios + viñeta
      unindented = '        - ';
    } else if (leadingWhitespace.length >= 8) {
      // De nivel 4 (8 espacios de atributos) a nivel 3 (6 espacios + "- ")
      unindented = '      - ';
    } else if (leadingWhitespace.length >= 4) {
      // De nivel 2 o 3 (4 o 6 espacios de sub-bloques) a nivel 1 (2 espacios + "- ")
      unindented = '  - ';
    } else {
      // De nivel 1 (2 espacios) a nivel 0 (raíz)
      unindented = '';
    }

    const newText = textBefore.substring(0, lastLineStart) + unindented + textAfter;
    return {
      newText,
      newCursorPos: lastLineStart + unindented.length
    };
  }

  // Caso 3: Renglón es un ítem de lista que termina con dos puntos ':' (ej: "  - 10 u Boca:" o "      - Cable:")
  if (trimmed.startsWith('- ') && trimmed.endsWith(':')) {
    const isGastosContext = detectCursorContext(textBefore).contextType === 'gastos';

    if (leadingWhitespace.length <= 2) {
      // Partida a nivel 1 (2 espacios)
      if (isGastosContext) {
        const propIndent = '    ';
        const nextLineContent = propIndent + 'porcentaje: ';
        const newText = textBefore + '\n' + nextLineContent + textAfter;
        return {
          newText,
          newCursorPos: textBefore.length + 1 + nextLineContent.length
        };
      }
      // Bajo una partida, abrir sub-bloque de materiales (4 espacios)
      const nextLineContent = '    materiales:';
      const newText = textBefore + '\n' + nextLineContent + textAfter;
      return {
        newText,
        newCursorPos: textBefore.length + 1 + nextLineContent.length
      };
    }

    // Ítem de despiece a nivel 3 (6 espacios o 8 legacy): abre bloque de propiedades
    const propIndent = leadingWhitespace.length >= 8 ? '            ' : '        ';
    const hasInlineQty = /-\s*[0-9.,]+\s*[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ²³]*/.test(trimmed);
    const nextLineContent = hasInlineQty ? propIndent : propIndent + 'cantidad: ';
    const newText = textBefore + '\n' + nextLineContent + textAfter;
    return {
      newText,
      newCursorPos: textBefore.length + 1 + nextLineContent.length
    };
  }

  // Caso 4: Encabezado general que termina con dos puntos ':' (ej: "Capítulo 1:", "    materiales:")
  if (trimmed.endsWith(':')) {
    if (leadingWhitespace.length === 0) {
      // Nivel 0 (Capítulo a nivel raíz) -> siguiente renglón es partida (2 espacios + "- ")
      const nextIndent = '  - ';
      const newText = textBefore + '\n' + nextIndent + textAfter;
      return {
        newText,
        newCursorPos: textBefore.length + 1 + nextIndent.length
      };
    }
    if (leadingWhitespace.length === 4) {
      // Nivel 2 (Sub-bloque materiales:/mano_obra:) -> siguiente renglón es ítem de despiece (6 espacios + "- ")
      const nextIndent = '      - ';
      const newText = textBefore + '\n' + nextIndent + textAfter;
      return {
        newText,
        newCursorPos: textBefore.length + 1 + nextIndent.length
      };
    }

    const nextIndent = leadingWhitespace + '  - ';
    const newText = textBefore + '\n' + nextIndent + textAfter;
    return {
      newText,
      newCursorPos: textBefore.length + 1 + nextIndent.length
    };
  }

  // Caso 5: Renglón es un ítem de lista con contenido que NO termina en ':' (ej: "  - 10 u Boca" o "      - 1 u Cable")
  // Continúa automáticamente la lista en el siguiente renglón con la misma sangría y viñeta.
  if (trimmed.startsWith('- ') && trimmed.length > 2) {
    const firstNewline = textAfter.indexOf('\n');
    const restOfCurrentLine = firstNewline >= 0 ? textAfter.slice(0, firstNewline) : textAfter;
    const followingDoc = firstNewline >= 0 ? textAfter.slice(firstNewline) : '';

    if (restOfCurrentLine.trim().length > 0) {
      const fullLine = currentLine + restOfCurrentLine;
      const nextListItem = leadingWhitespace + '- ';
      const newText = textBefore.substring(0, lastLineStart) + fullLine + '\n' + nextListItem + followingDoc;
      const newCursorPos = lastLineStart + fullLine.length + 1 + nextListItem.length;
      return {
        newText,
        newCursorPos
      };
    }

    const nextListItem = leadingWhitespace + '- ';
    const newText = textBefore + '\n' + nextListItem + textAfter;
    return {
      newText,
      newCursorPos: textBefore.length + 1 + nextListItem.length
    };
  }

  // Caso 5.5: Renglón de propiedad de ítem (ej: "cantidad: 25 u", "precio: 1500", "producto: Prysmian", "porcentaje: 10%")
  // Al presionar Enter tras completar la propiedad, desindenta automáticamente al nivel de viñeta del ítem
  const isPropertyLine = /^\s*(cantidad|precio|costo|producto|marca|unidad|horas|porcentaje|pct|monto|formula|aplica_a|destino)\s*:/i.test(trimmed);
  if (isPropertyLine && leadingWhitespace.length >= 4) {
    let nextBulletIndent = '  - ';
    if (leadingWhitespace.length >= 10) {
      // Propiedad legacy (12 espacios) -> ítem legacy (8 espacios + "- ")
      nextBulletIndent = '        - ';
    } else if (leadingWhitespace.length >= 6) {
      // Atributo estándar (8 espacios) -> ítem estándar (6 espacios + "- ")
      nextBulletIndent = '      - ';
    } else {
      // Atributo de partida (4 espacios) o gasto -> partida/gasto hermano (2 espacios + "- ")
      nextBulletIndent = '  - ';
    }

    const firstNewline = textAfter.indexOf('\n');
    const restOfCurrentLine = firstNewline >= 0 ? textAfter.slice(0, firstNewline) : textAfter;
    const followingDoc = firstNewline >= 0 ? textAfter.slice(firstNewline + 1) : '';

    const fullCurrentLine = currentLine + restOfCurrentLine;

    // Verificar si hay propiedades hermanas pertenecientes al mismo bloque en las siguientes líneas
    let skipLinesCount = 0;
    if (followingDoc) {
      const docLines = followingDoc.split('\n');
      for (let i = 0; i < docLines.length; i++) {
        const line = docLines[i];
        const tr = line.trim();
        if (!tr) break; // línea en blanco termina el bloque
        const ind = line.match(/^\s*/)?.[0] || '';
        if (ind.length >= leadingWhitespace.length) {
          skipLinesCount++;
        } else {
          break;
        }
      }

      if (skipLinesCount > 0) {
        const preservedLines = docLines.slice(0, skipLinesCount).join('\n');
        const remainingDoc = docLines.slice(skipLinesCount).join('\n');
        const beforeBlock = textBefore.substring(0, lastLineStart);
        const blockWithSiblings = fullCurrentLine + '\n' + preservedLines;
        const newText = beforeBlock + blockWithSiblings + '\n' + nextBulletIndent + (remainingDoc ? '\n' + remainingDoc : '');
        const newCursorPos = beforeBlock.length + blockWithSiblings.length + 1 + nextBulletIndent.length;
        return {
          newText,
          newCursorPos
        };
      }
    }

    const beforeBlock = textBefore.substring(0, lastLineStart);
    const newText = beforeBlock + fullCurrentLine + '\n' + nextBulletIndent + (followingDoc ? '\n' + followingDoc : '');
    const newCursorPos = beforeBlock.length + fullCurrentLine.length + 1 + nextBulletIndent.length;
    return {
      newText,
      newCursorPos
    };
  }

  // Caso 6: Renglón normal (ej: comentarios o texto sin propiedad específica) -> Mantiene la sangría actual
  const nextIndent = leadingWhitespace;
  const newText = textBefore + '\n' + nextIndent + textAfter;
  return {
    newText,
    newCursorPos: textBefore.length + 1 + nextIndent.length
  };
}

export interface SmartBackspaceResult {
  newText: string;
  newCursorPos: number;
}

/**
 * Manejo inteligente de la tecla Backspace para retroceder niveles jerárquicos
 * sin tener que borrar espacios uno a uno.
 * Retorna null si el cursor está dentro de texto real para permitir el borrado de caracteres estándar.
 */
export function handleYamlSmartBackspace(params: {
  textBefore: string;
  textAfter: string;
}): SmartBackspaceResult | null {
  const { textBefore, textAfter } = params;
  const lastLineStart = textBefore.lastIndexOf('\n') + 1;
  const currentLine = textBefore.substring(lastLineStart);
  const trimmed = currentLine.trim();
  const leadingWhitespace = currentLine.match(/^\s*/)?.[0] || '';

  // Solo intervenimos si la línea actual contiene únicamente espacios en blanco
  // o si es una viñeta vacía (ej: "        - " o "      - " o "  -")
  const isEmptyLine = trimmed === '';
  const isEmptyBullet = /^-\s*$/.test(trimmed);

  if (!isEmptyLine && !isEmptyBullet) {
    return null;
  }

  // 1. Si es una viñeta vacía ("- "):
  if (isEmptyBullet) {
    let targetIndent = '';
    if (leadingWhitespace.length >= 8) {
      // De nivel legacy (8 espacios + "- ") retrocede a 6 espacios
      targetIndent = '      ';
    } else if (leadingWhitespace.length >= 6) {
      // De nivel 3 (6 espacios + "- ") retrocede a nivel 2 (4 espacios)
      targetIndent = '    ';
    } else if (leadingWhitespace.length >= 2) {
      // De nivel 1 (2 espacios + "- ") retrocede a nivel 0 (raíz)
      targetIndent = '';
    } else {
      targetIndent = '';
    }

    const newText = textBefore.substring(0, lastLineStart) + targetIndent + textAfter;
    return {
      newText,
      newCursorPos: lastLineStart + targetIndent.length
    };
  }

  // 2. Si es una línea vacía con sangría ("            " o "        " o "      " o "    " o "  "):
  if (isEmptyLine) {
    let targetLine = '';
    if (leadingWhitespace.length >= 10) {
      // De nivel legacy (10-12 espacios) retrocede a 8 espacios + "- "
      targetLine = '        - ';
    } else if (leadingWhitespace.length >= 8) {
      // De nivel 4 (8 espacios de atributo) retrocede a nivel 3 (6 espacios + "- ")
      targetLine = '      - ';
    } else if (leadingWhitespace.length >= 4) {
      // De nivel 2 o 3 (4 a 6 espacios de sub-bloque) retrocede a nivel 1 (2 espacios + "- ")
      targetLine = '  - ';
    } else if (leadingWhitespace.length >= 2) {
      // De nivel 1 (2 espacios) retrocede a nivel 0 (raíz)
      targetLine = '';
    } else {
      // Sangría 0 o 1: dejar actuar al Backspace normal del navegador
      return null;
    }

    const newText = textBefore.substring(0, lastLineStart) + targetLine + textAfter;
    return {
      newText,
      newCursorPos: lastLineStart + targetLine.length
    };
  }

  return null;
}

export interface SmartTabResult {
  newText: string;
  newCursorPos: number;
}

/**
 * Manejo inteligente y contextual de la tecla Tab en el editor YAML.
 * Calcula los 5 niveles semánticos estándar:
 * - Nivel 0 (0 espacios): Raíz / Capítulos / Directivas
 * - Nivel 1 (2 espacios + "- "): Partidas
 * - Nivel 2 (4 espacios): Sub-bloques (materiales:, mano_obra:, servicios:)
 * - Nivel 3 (6 espacios + "- "): Ítems de despiece
 * - Nivel 4 (8 espacios): Atributos (cantidad:, precio:, etc.)
 *
 * Si se presiona en una línea vacía o inicio de línea: salta al nivel contextual o cicla 0 -> 2 -> 4 -> 6 -> 8 -> 0.
 * Shift+Tab cicla hacia atrás.
 */
export function handleYamlSmartTab(params: {
  textBefore: string;
  textAfter: string;
  shiftKey?: boolean;
}): SmartTabResult {
  const { textBefore, textAfter, shiftKey = false } = params;
  const lastLineStart = textBefore.lastIndexOf('\n') + 1;
  const currentLineBeforeCursor = textBefore.substring(lastLineStart);
  const firstNewlineAfter = textAfter.indexOf('\n');
  const currentLineAfterCursor = firstNewlineAfter === -1 ? textAfter : textAfter.substring(0, firstNewlineAfter);
  const followingDoc = firstNewlineAfter === -1 ? '' : textAfter.substring(firstNewlineAfter);
  const fullCurrentLine = currentLineBeforeCursor + currentLineAfterCursor;
  const trimmedFull = fullCurrentLine.trim();
  const leadingWhitespace = fullCurrentLine.match(/^\s*/)?.[0] || '';

  const SEMANTIC_LEVELS = [
    { indent: '', bullet: '' },          // Nivel 0: 0 espacios
    { indent: '  ', bullet: '- ' },      // Nivel 1: 2 espacios + viñeta
    { indent: '    ', bullet: '' },      // Nivel 2: 4 espacios
    { indent: '      ', bullet: '- ' },  // Nivel 3: 6 espacios + viñeta
    { indent: '        ', bullet: '' }   // Nivel 4: 8 espacios
  ];

  // Caso 1: La línea está vacía o contiene solo espacios / viñeta vacía
  const isEmptyOrBulletOnly = trimmedFull === '' || /^-\s*$/.test(trimmedFull);
  if (isEmptyOrBulletOnly) {
    const currentLen = leadingWhitespace.length;

    if (shiftKey) {
      // Retroceder un nivel semántico
      let targetIndex = 0;
      if (currentLen >= 8) targetIndex = 3;
      else if (currentLen >= 6) targetIndex = 2;
      else if (currentLen >= 4) targetIndex = 1;
      else if (currentLen >= 2) targetIndex = 0;
      else targetIndex = 4; // Ciclo desde 0 a 8

      const level = SEMANTIC_LEVELS[targetIndex];
      const newLine = level.indent + level.bullet;
      const beforeLine = textBefore.substring(0, lastLineStart);
      const newText = beforeLine + newLine + followingDoc;
      return {
        newText,
        newCursorPos: beforeLine.length + newLine.length
      };
    }

    // Tab hacia adelante:
    // Si la línea está en 0 espacios, determinar contexto de la línea anterior
    if (currentLen === 0 && trimmedFull === '') {
      const linesBefore = textBefore.split('\n');
      let prevTrim = '';
      let prevIndent = 0;
      for (let i = linesBefore.length - 2; i >= 0; i--) {
        const raw = linesBefore[i];
        const tr = raw.trim();
        if (tr && !tr.startsWith('#')) {
          prevTrim = tr;
          prevIndent = (raw.match(/^\s*/)?.[0] || '').length;
          break;
        }
      }

      let targetLevel = 1; // Default a nivel 1 (Partida: "  - ")
      if (prevTrim.endsWith(':') && prevIndent === 0) {
        // Debajo de capítulo -> nivel 1 ("  - ")
        targetLevel = 1;
      } else if (prevTrim.startsWith('- ') && prevIndent === 2) {
        // Debajo de partida -> nivel 2 ("    ")
        targetLevel = 2;
      } else if (prevTrim.endsWith(':') && prevIndent === 4) {
        // Debajo de materiales: -> nivel 3 ("      - ")
        targetLevel = 3;
      } else if (prevTrim.startsWith('- ') && prevIndent === 6) {
        // Debajo de ítem de despiece -> nivel 4 ("        ")
        targetLevel = 4;
      }

      const level = SEMANTIC_LEVELS[targetLevel];
      const newLine = level.indent + level.bullet;
      const beforeLine = textBefore.substring(0, lastLineStart);
      const newText = beforeLine + newLine + followingDoc;
      return {
        newText,
        newCursorPos: beforeLine.length + newLine.length
      };
    }

    // Si ya tiene sangría, ciclar hacia adelante: 0 -> 2 -> 4 -> 6 -> 8 -> 0
    let nextIndex = 1;
    if (currentLen < 2) nextIndex = 1;
    else if (currentLen < 4) nextIndex = 2;
    else if (currentLen < 6) nextIndex = 3;
    else if (currentLen < 8) nextIndex = 4;
    else nextIndex = 0; // Ciclar de 8 a 0

    const level = SEMANTIC_LEVELS[nextIndex];
    const newLine = level.indent + level.bullet;
    const beforeLine = textBefore.substring(0, lastLineStart);
    const newText = beforeLine + newLine + followingDoc;
    return {
      newText,
      newCursorPos: beforeLine.length + newLine.length
    };
  }

  // Caso 2: El cursor está al inicio de la línea antes del texto (en la zona de indentación)
  if (currentLineBeforeCursor.trim() === '') {
    const currentLen = leadingWhitespace.length;
    let targetSpaces = 0;

    if (shiftKey) {
      if (currentLen >= 8) targetSpaces = 6;
      else if (currentLen >= 6) targetSpaces = 4;
      else if (currentLen >= 4) targetSpaces = 2;
      else if (currentLen >= 2) targetSpaces = 0;
      else targetSpaces = 8;
    } else {
      if (currentLen < 2) targetSpaces = 2;
      else if (currentLen < 4) targetSpaces = 4;
      else if (currentLen < 6) targetSpaces = 6;
      else if (currentLen < 8) targetSpaces = 8;
      else targetSpaces = 0;
    }

    const newIndent = ' '.repeat(targetSpaces);
    const lineContent = fullCurrentLine.trimStart();
    const newLine = newIndent + lineContent;
    const beforeLine = textBefore.substring(0, lastLineStart);
    const newText = beforeLine + newLine + followingDoc;
    return {
      newText,
      newCursorPos: beforeLine.length + newIndent.length
    };
  }

  // Caso 3: El cursor está dentro del texto o al final de la línea
  // Si no es shiftKey, intenta saltar al siguiente campo a completar; si no hay, inserta 2 espacios
  if (!shiftKey) {
    const nextField = findNextFillableField({
      text: textBefore + textAfter,
      cursorPos: textBefore.length,
      direction: 'forward'
    });
    if (nextField && nextField.start > textBefore.length) {
      return {
        newText: textBefore + textAfter,
        newCursorPos: nextField.start
      };
    }
  }

  // Fallback: insertar 2 espacios en la posición del cursor
  const newText = textBefore + '  ' + textAfter;
  return {
    newText,
    newCursorPos: textBefore.length + 2
  };
}

/**
 * Sanitiza y normaliza texto pegado desde el portapapeles:
 * 1. Remueve caracteres de control invisibles (zero-width spaces, BOM, etc.).
 * 2. Convierte tabs (\t) a 2 espacios.
 * 3. Si es multi-línea y el cursor se encuentra en una línea con sangría,
 *    re-indenta el bloque preservando las sangrías relativas alineadas al nivel de destino.
 */
export function normalizePastedYaml(pastedText: string, textBeforeCursor: string): string {
  if (!pastedText) return '';

  // 1. Normalizar saltos de línea y limpiar caracteres de control invisibles y non-breaking spaces
  const cleaned = pastedText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/\t/g, '  ');

  const lines = cleaned.split('\n');
  if (lines.length <= 1) {
    return cleaned;
  }

  // 2. Re-indentar si es multi-línea según el nivel de destino
  const lastNewline = textBeforeCursor.lastIndexOf('\n');
  const lineBeforeCursor = lastNewline === -1 ? textBeforeCursor : textBeforeCursor.slice(lastNewline + 1);
  const isCursorOnWhitespaceOnly = lineBeforeCursor.trim() === '';

  if (isCursorOnWhitespaceOnly && lineBeforeCursor.length > 0) {
    const targetIndent = lineBeforeCursor;
    const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
    const minSourceIndent = nonEmptyLines.length > 0
      ? Math.min(...nonEmptyLines.map((l) => (l.match(/^\s*/)?.[0] || '').length))
      : 0;

    // Para la primera línea, removemos el minSourceIndent para que se acople al targetIndent ya presente
    lines[0] = lines[0].slice(minSourceIndent);

    // Para las líneas subsiguientes, anteponemos targetIndent + sangría relativa
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim().length > 0) {
        const lineIndent = (lines[i].match(/^\s*/)?.[0] || '').length;
        const relativeIndent = Math.max(0, lineIndent - minSourceIndent);
        lines[i] = targetIndent + ' '.repeat(relativeIndent) + lines[i].trimStart();
      } else {
        lines[i] = '';
      }
    }
    return lines.join('\n');
  }

  return cleaned;
}

export interface SearchMatchParams {
  query: string;
  title: string;
  category?: string;
  extraText?: string;
}

/**
 * Evalúa y puntúa la relevancia de un elemento para una búsqueda multi-término fuera de orden.
 * - Requiere que todos los términos de búsqueda estén presentes en el texto del elemento.
 * - Prioriza fuertemente coincidencias exactas de palabra sobre sub-cadenas internas (ej: "cable" prioriza "Cable Unipolar" sobre "portacable").
 * - Da bonus a elementos cuyo título o categoría comienza con el término buscado.
 * - Soporta términos en cualquier orden (ej: "cable iram 2.5" o "2.5 iram cable").
 * - Retorna -1 si no coincide, o un número >= 0 que representa el puntaje de relevancia.
 */
export function scoreSearchMatch(params: SearchMatchParams): number {
  const { query, title, category = '', extraText = '' } = params;
  const cleanQuery = query.replace(/^[\/@]/, '').trim();
  if (!cleanQuery) return 0;

  // Normalizar comas entre números para que "2,5" y "2.5" sean equivalentes
  const normalizeDecimals = (s: string) => s.replace(/(\d+),(\d+)/g, '$1.$2');

  const queryNorm = normalizeDecimals(normalizeString(cleanQuery));
  // Separar tokens por espacios y puntuación, manteniendo números con punto decimal intactos (ej: 2.5)
  const tokens = queryNorm
    .split(/[\s,+/;:!?"'()\[\]{}_-]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return 0;

  const titleNorm = normalizeDecimals(normalizeString(title));
  const catNorm = normalizeDecimals(normalizeString(category));
  const extraNorm = normalizeDecimals(normalizeString(extraText));
  const combined = `${titleNorm} ${catNorm} ${extraNorm}`;

  // 1. Todos los tokens deben estar presentes en algún lugar del texto combinado
  const allTokensMatch = tokens.every((token) => combined.includes(token));
  if (!allTokensMatch) {
    return -1;
  }

  let score = 0;
  const titleWords = titleNorm
    .split(/[\s,+/;:!?"'()\[\]{}_-]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);

  // 2. Coincidencia exacta del título completo con la query
  if (titleNorm === queryNorm) {
    score += 1000;
  } else if (titleNorm.startsWith(queryNorm)) {
    score += 500;
  }

  // 3. El título comienza con el primer término buscado (ej: "cable" -> "Cable unipolar...")
  if (tokens.length > 0 && (titleNorm.startsWith(tokens[0]) || (titleWords.length > 0 && titleWords[0] === tokens[0]))) {
    score += 250;
  }

  // 4. Categoría coincide con alguno de los términos o con la búsqueda
  if (catNorm) {
    if (catNorm === tokens[0] || catNorm === queryNorm) {
      score += 150;
    } else if (catNorm.startsWith(tokens[0])) {
      score += 100;
    } else if (tokens.some((t) => catNorm.includes(t))) {
      score += 40;
    }
  }

  // 5. Calidad de coincidencia de cada token dentro del título (clave para evitar que "portacable" gane a "cable")
  tokens.forEach((token) => {
    const isExactWord = titleWords.some((w) => w === token);
    const startsWord = titleWords.some((w) => w.startsWith(token));

    if (isExactWord) {
      score += 120; // Palabra exacta en el título
    } else if (startsWord) {
      score += 80;  // Comienza una palabra del título
    } else if (titleNorm.includes(token)) {
      score += 15;  // Está contenido dentro de otra palabra (ej: "portacable")
    } else if (catNorm.includes(token)) {
      score += 30;  // Está en la categoría
    } else {
      score += 10;  // Está en descripción/marca/atributos
    }
  });

  // 6. Bonus si los tokens aparecen en el mismo orden en el título
  let lastIndex = -1;
  let inOrder = true;
  for (const token of tokens) {
    const idx = titleNorm.indexOf(token, lastIndex + 1);
    if (idx === -1) {
      inOrder = false;
      break;
    }
    lastIndex = idx;
  }
  if (inOrder) {
    score += 40;
  }

  // 7. Penalización suave por longitud (títulos más directos y específicos puntúan mejor)
  score += Math.max(0, 30 - titleNorm.length * 0.15);

  return Math.round(score);
}

export interface FieldStop {
  start: number;
  end: number;
  label?: string;
}

/**
 * Identifica todos los puntos de parada semánticos editables en el documento YAML
 * (campos de cabecera, nombres de capítulos, cantidades, nombres de partidas y propiedades).
 */
export function getFieldStops(dslText: string): FieldStop[] {
  const stops: FieldStop[] = [];
  const lines = dslText.split('\n');
  let offset = 0;

  const reservedRootKeys = new Set([
    'cliente', 'obra', 'factura', 'validez', 'margen', 'riesgo', 'dolar', 'gastos', 'totales', 'calculos', 'variables', 'capitulos', 'partidas'
  ]);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed && !trimmed.startsWith('#')) {
      // 1. Directivas de cabecera (cliente:, obra:, factura:, validez:, margen:, riesgo:, dolar:)
      const headerMatch = line.match(/^(\s*)(cliente|obra|factura|validez|margen|riesgo|dolar)\s*:\s*(.*)$/i);
      if (headerMatch) {
        const colonIdx = line.indexOf(':');
        const valPart = line.slice(colonIdx + 1);
        const cleanVal = valPart.replace(/#.*$/, '').trim();

        if (!cleanVal) {
          const cursorStart = offset + colonIdx + 1 + (valPart.startsWith(' ') ? 1 : 0);
          stops.push({ start: cursorStart, end: cursorStart, label: headerMatch[2] });
        } else {
          const valStart = offset + line.indexOf(cleanVal, colonIdx + 1);
          stops.push({ start: valStart, end: valStart + cleanVal.length, label: headerMatch[2] });
        }
      }
      // 2. Capítulos a nivel raíz (ej: "Capítulo 1:")
      else if (/^[^\s\-#][^:]*:\s*(#.*)?$/.test(line)) {
        const colonIdx = line.indexOf(':');
        const capName = line.slice(0, colonIdx).trim();
        const lowerKey = capName.toLowerCase();
        if (!reservedRootKeys.has(lowerKey)) {
          const startIdx = offset + line.indexOf(capName);
          stops.push({ start: startIdx, end: startIdx + capName.length, label: 'capitulo' });
        }
      }
      // 3. Variables, cálculos o propiedades de ítems (ej: "  superficie: 120" o "            cantidad: 1")
      else if (/^\s{2,16}([a-zA-Z0-9_]+)\s*:\s*(.*)$/.test(line) && !line.trim().startsWith('-')) {
        const varMatch = line.match(/^(\s*)([a-zA-Z0-9_]+)\s*:\s*(.*)$/)!;
        const propName = varMatch[2].toLowerCase();
        const reservedTaskProps = new Set(['materiales', 'insumos', 'mano_obra', 'manoobra', 'mo', 'parametros', 'params', 'condicion']);
        if (!reservedTaskProps.has(propName)) {
          const colonIdx = line.indexOf(':');
          const valPart = line.slice(colonIdx + 1);
          const cleanVal = valPart.replace(/#.*$/, '').trim();
          if (!cleanVal) {
            const cursorStart = offset + colonIdx + 1 + (valPart.startsWith(' ') ? 1 : 0);
            stops.push({ start: cursorStart, end: cursorStart, label: varMatch[2] });
          } else {
            const valStart = offset + line.indexOf(cleanVal, colonIdx + 1);
            stops.push({ start: valStart, end: valStart + cleanVal.length, label: varMatch[2] });
          }
        }
      }
      // 4. Ítems de lista (ej: "  - 10 u Boca de Iluminación: $ 12.500" o "  - 1 u ")
      else if (/^\s*-\s+/.test(line)) {
        const dashIdx = line.indexOf('-');
        const afterDash = line.slice(dashIdx + 1);

        // Buscar cantidad y unidad al inicio: ej: " 10 u " o " =bocas u " o " 1 "
        const qtyUnitMatch = afterDash.match(/^\s*([0-9.,]+|\=[a-zA-Z0-9_]+)\s*([a-zA-ZáéíóúÁÉÍÓÚ²³]+)?\s*/);
        if (qtyUnitMatch) {
          const qtyStr = qtyUnitMatch[1];
          const qtyStart = offset + dashIdx + 1 + afterDash.indexOf(qtyStr);
          stops.push({ start: qtyStart, end: qtyStart + qtyStr.length, label: 'cantidad' });

          const afterQty = afterDash.slice(qtyUnitMatch[0].length);
          const namePricePart = afterQty.replace(/#.*$/, '').trim();

          if (namePricePart) {
            // Separar posible precio al final (ej: "Boca de Iluminación: $ 12.500")
            const priceMatch = namePricePart.match(/(?:[:=]\s*\$?\s*)([0-9.,]+|\=[a-zA-Z0-9_]+)\s*$/);
            if (priceMatch && priceMatch.index !== undefined) {
              const nameStr = namePricePart.slice(0, priceMatch.index).trim();
              if (nameStr) {
                const nameStart = offset + line.indexOf(nameStr, dashIdx + 1);
                stops.push({ start: nameStart, end: nameStart + nameStr.length, label: 'nombre_item' });
              }
              const priceStr = priceMatch[1];
              const priceStart = offset + line.indexOf(priceStr, dashIdx + 1 + qtyUnitMatch[0].length);
              stops.push({ start: priceStart, end: priceStart + priceStr.length, label: 'precio_item' });
            } else {
              const nameClean = namePricePart.replace(/:$/, '').trim();
              const nameStart = offset + line.indexOf(nameClean, dashIdx + 1);
              stops.push({ start: nameStart, end: nameStart + nameClean.length, label: 'nombre_item' });
            }
          } else {
            // Línea como "  - 1 u " donde aún no se escribió el nombre: cursor al final de la línea
            const endOfLine = offset + line.length;
            stops.push({ start: endOfLine, end: endOfLine, label: 'nombre_item_nuevo' });
          }
        } else {
          // Ítem sin número (ej: "  - Tablero:")
          const cleanName = afterDash.replace(/#.*$/, '').replace(/:$/, '').trim();
          if (cleanName) {
            const nameStart = offset + line.indexOf(cleanName, dashIdx + 1);
            stops.push({ start: nameStart, end: nameStart + cleanName.length, label: 'nombre_item' });
          }
        }
      }
    }

    offset += line.length + 1; // +1 por '\n'
  }

  // Ordenar y eliminar duplicados exactos
  stops.sort((a, b) => a.start - b.start || a.end - b.end);
  return stops.filter((s, idx) => idx === 0 || s.start !== stops[idx - 1].start || s.end !== stops[idx - 1].end);
}

/**
 * Encuentra el siguiente punto de parada semántico editable hacia adelante o atrás
 */
export function findNextFillableField(params: {
  text: string;
  cursorPos: number;
  direction?: 'forward' | 'backward';
}): FieldStop | null {
  const { text, cursorPos, direction = 'forward' } = params;
  const stops = getFieldStops(text);
  if (stops.length === 0) return null;

  if (direction === 'forward') {
    const next = stops.find((s) => s.start > cursorPos);
    return next || stops[0];
  } else {
    const prev = [...stops].reverse().find((s) => s.start < cursorPos);
    return prev || stops[stops.length - 1];
  }
}




