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
  ManoObraSnapshot
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
 * Procesa un bloque de cálculo (`calculos:` o `variables:`) resolviendo fórmulas en cascada
 */
export function processCalculationBlock(
  rawBlock: any,
  scope: Record<string, number>,
  scopeType: 'global' | 'local' = 'global'
): CalculatedCell[] {
  const cells: CalculatedCell[] = [];
  if (!rawBlock) return cells;

  const entries: [string, any][] = [];
  if (Array.isArray(rawBlock)) {
    rawBlock.forEach((item) => {
      if (typeof item === 'object' && item !== null) {
        Object.entries(item).forEach(([k, v]) => entries.push([k, v]));
      } else if (typeof item === 'string') {
        const colonIdx = item.indexOf(':');
        if (colonIdx > 0) {
          entries.push([item.slice(0, colonIdx).trim(), item.slice(colonIdx + 1).trim()]);
        }
      }
    });
  } else if (typeof rawBlock === 'object' && rawBlock !== null) {
    Object.entries(rawBlock).forEach(([k, v]) => entries.push([k, v]));
  }

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
 */
export function serializePresupuestoToDSL(data: {
  clienteId: string;
  direccionObra?: string;
  tipoFactura: TipoFactura;
  validezDias: number;
  margenPorcentaje: number | null;
  nivelMargenRiesgo?: NivelMargenRiesgo;
  margenRiesgoPorcentaje?: number;
  mostrarDolar?: boolean;
  nombreDolar?: string;
  cotizacionDolar?: number;
  capitulos: CapituloPresupuesto[];
  items: ItemPresupuesto[];
  gastosConfig?: GastoPresupuestoConfig[];
  clientes: Cliente[];
}): string {
  // Si la cotización está totalmente vacía, retornar plantilla por defecto comentada
  if (data.items.length === 0 && !data.clienteId && !data.direccionObra) {
    return getDefaultPresupuestoYAMLTemplate(data);
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

  lines.push('');

  // 2. Partidas agrupadas por capítulos
  // Ítems huérfanos sin capítulo
  const orphanItems = data.items.filter((it) => !it.capituloId);
  if (orphanItems.length > 0) {
    lines.push('Partidas Generales:');
    orphanItems.forEach((it) => serializeSingleItem(it, lines, '  '));
    lines.push('');
  }

  // Capítulos con sus ítems
  data.capitulos.forEach((cap) => {
    lines.push(`# ------------------------------------------------------------`);
    lines.push(`# CAPÍTULO: ${cap.nombre}`);
    lines.push(`# ------------------------------------------------------------`);
    lines.push(`${cap.nombre}:`);
    const capItems = data.items.filter((it) => it.capituloId === cap.id);
    if (capItems.length === 0) {
      lines.push('  # (Sin partidas aún - escribí una con / o -)');
    } else {
      capItems.forEach((it) => serializeSingleItem(it, lines, '  '));
    }
    lines.push('');
  });

  // 3. Gastos operativos
  if (data.gastosConfig && data.gastosConfig.length > 0) {
    const activeGastos = data.gastosConfig.filter((g) => g.aplica !== false && g.valor > 0);
    if (activeGastos.length > 0) {
      lines.push('# ------------------------------------------------------------');
      lines.push('# GASTOS OPERATIVOS E INDIRECTOS');
      lines.push('# ------------------------------------------------------------');
      lines.push('gastos:');
      activeGastos.forEach((g) => {
        lines.push(`  - ${g.nombre}: $ ${Math.round(g.valor).toLocaleString('es-AR')}`);
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
    if (it.cantidad && it.cantidad !== 1) {
      lines.push(`${indent}    cantidad: ${it.cantidad}`);
    }
    if (it.unidad && it.unidad !== 'u') {
      lines.push(`${indent}    unidad: ${it.unidad}`);
    }

    if (it.insumosSnapshot && it.insumosSnapshot.length > 0) {
      lines.push(`${indent}    materiales:`);
      it.insumosSnapshot.forEach((ins) => {
        const cantUnit = `${ins.cantidadTotal} ${ins.unidad || 'u'}`;
        const priceStr = (ins.precioUnitarioCongelado || 0) > 0 ? ` : $ ${Math.round(ins.precioUnitarioCongelado).toLocaleString('es-AR')}` : '';
        const brandStr = ins.marca ? ` [${ins.marca}]` : '';
        lines.push(`${indent}      - ${cantUnit} ${ins.nombre}${brandStr}${priceStr}`);
      });
    }

    if (it.manoObraSnapshot && it.manoObraSnapshot.length > 0) {
      lines.push(`${indent}    mano_obra:`);
      it.manoObraSnapshot.forEach((mo) => {
        const moPriceStr = (mo.costoHoraCongelado || 0) > 0 ? ` : $ ${Math.round(mo.costoHoraCongelado).toLocaleString('es-AR')}` : '';
        lines.push(`${indent}      - ${mo.horasTotales} h ${mo.nombreCategoria}${moPriceStr}`);
      });
    }

    if (it.condicionTrabajo && it.condicionTrabajo !== 'normal') {
      lines.push(`${indent}    condicion: ${it.condicionTrabajo}`);
    }

    if (it.precioManual && it.precioManual > 0) {
      lines.push(`${indent}    precio: $ ${Math.round(it.precioManual).toLocaleString('es-AR')}`);
    }
  } else {
    // Tarea simple o directa
    let line = `${indent}- ${it.cantidad || 1} ${it.unidad || 'u'} ${it.descripcion}`;
    if (it.condicionTrabajo && it.condicionTrabajo !== 'normal') {
      line += ` @condicion: ${it.condicionTrabajo}`;
    }
    if (it.precioManual && it.precioManual > 0) {
      line += ` : $ ${Math.round(it.precioManual).toLocaleString('es-AR')}`;
    } else if (!it.tareaTipoId && it.costoUnitario && it.costoUnitario > 0) {
      line += ` : $ ${Math.round(it.costoUnitario).toLocaleString('es-AR')}`;
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

        const restMatch = rest.match(/^([a-zA-ZáéíóúÁÉÍÓÚ²³]+)\s+(.+)$/);
        if (restMatch && KNOWN_UNITS.has(restMatch[1].toLowerCase())) {
          return {
            cantidad: evalQty >= 0 ? evalQty : 0,
            unidad: restMatch[1].toLowerCase(),
            nombre: restMatch[2].trim(),
            marca,
            condicion,
            precioManual
          };
        } else if (rest && KNOWN_UNITS.has(rest.toLowerCase())) {
          return {
            cantidad: evalQty >= 0 ? evalQty : 0,
            unidad: rest.toLowerCase(),
            nombre: '',
            marca,
            condicion,
            precioManual
          };
        } else {
          return {
            cantidad: evalQty >= 0 ? evalQty : 0,
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
      cantidad: parsedQty > 0 ? parsedQty : 1,
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
        cantidad: parsedQty > 0 ? parsedQty : 1,
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
        cantidad: parsedQty > 0 ? parsedQty : 1,
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

  // 2. Agregar ':' a ítems de lista con propiedades anidadas si el usuario lo olvidó
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') && !trimmed.includes(':')) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length) {
        const nextLine = lines[j];
        const nextTrimmed = nextLine.trim();
        const nextIndent = (nextLine.match(/^\s*/)?.[0] || '').length;
        const currentIndent = (line.match(/^\s*/)?.[0] || '').length;
        if (nextIndent > currentIndent && /^(cantidad|precio|producto|marca|unidad|horas|notas):\s*/i.test(nextTrimmed)) {
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

  // 3. Detectar si hay ítems de lista (- ) huérfanos antes de cualquier capítulo o sin encabezado de capítulo
  const reservedRootKeysWithItems = new Set(['gastos', 'capitulos', 'calculos', 'variables']);
  const reservedScalarRootKeys = new Set(['cliente', 'obra', 'factura', 'validez', 'margen', 'riesgo', 'dolar', 'totales', 'calculos', 'variables']);

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
          if (reservedRootKeysWithItems.has(key)) {
            hasParentChapter = true;
            break;
          }
          if (!reservedScalarRootKeys.has(key)) {
            hasParentChapter = true;
            break;
          }
          hasParentChapter = false;
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
 * Parsea el texto YAML completo y construye el estado del Presupuesto
 */
export function parseDSLToPresupuesto(
  yamlText: string,
  context: ParseDSLContext
): ParseDSLResult {
  const diagnostics: DSLDiagnostic[] = [];

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
  // Cliente
  let clienteId = '';
  let clienteMatched: Cliente | undefined = undefined;
  let clienteQuery: string | undefined = undefined;
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
          line: 1,
          type: 'info',
          message: `✓ Cliente vinculado: "${clienteMatched.razonSocial || clienteMatched.nombre}"`
        });
      } else {
        diagnostics.push({
          line: 1,
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
  if (parsed.factura) {
    const fStr = normalizeString(String(parsed.factura));
    if (/\ba\b/.test(fStr) || fStr.includes('factura a')) {
      tipoFactura = 'Factura A';
    } else if (/\bb\b/.test(fStr) || fStr.includes('factura b')) {
      tipoFactura = 'Factura B';
    } else if (/\bc\b/.test(fStr) || fStr.includes('factura c')) {
      tipoFactura = 'Factura C';
    } else if (fStr.includes('presupuesto') || /\bx\b/.test(fStr)) {
      tipoFactura = 'Presupuesto X (Sin Factura)';
    }
  }

  // Validez
  let validezDias = 15;
  if (parsed.validez !== undefined && parsed.validez !== null) {
    const num = safeNum(parseInt(String(parsed.validez).replace(/\D/g, ''), 10));
    if (num > 0) validezDias = num;
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
  if (parsed.riesgo) {
    const rStr = normalizeString(String(parsed.riesgo));
    if (rStr.includes('alto')) {
      nivelMargenRiesgo = 'alto';
      margenRiesgoPorcentaje = 10;
    } else if (rStr.includes('bajo')) {
      nivelMargenRiesgo = 'bajo';
      margenRiesgoPorcentaje = 0;
    } else {
      nivelMargenRiesgo = 'medio';
      margenRiesgoPorcentaje = 5;
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
      let gNombre = `Gasto ${gIdx + 1}`;
      let gMonto = 0;
      if (typeof g === 'string') {
        const parsedG = parseQuantityAndName(g);
        gNombre = parsedG.nombre;
        gMonto = parsedG.precioManual || 0;
      } else if (typeof g === 'object' && g !== null) {
        const gKey = Object.keys(g)[0];
        if (gKey) {
          gNombre = gKey;
          gMonto = parseLocalizedNumber(g[gKey]);
        }
      }
      if (gMonto > 0) {
        gastosConfig.push({
          id: `gasto-yaml-${gIdx}`,
          nombre: gNombre,
          modalidad: 'monto_fijo',
          valor: gMonto,
          aplica: true
        });
      }
    });
  }

  // Celdas de cálculo y variables globales
  const globalScope: Record<string, number> = {};
  const rawCalculos = parsed.calculos || parsed.variables;
  const calculatedCells: CalculatedCell[] = [];

  if (rawCalculos) {
    const cells = processCalculationBlock(rawCalculos, globalScope, 'global');
    calculatedCells.push(...cells);
    if (cells.length > 0) {
      diagnostics.push({
        line: 1,
        type: 'info',
        message: `✓ Celdas de cálculo evaluadas: ${cells.map((c) => `${c.name} = ${c.evaluatedValue}`).join(', ')}`
      });
    }
  }

  // Si los gastos usaban variables o fórmulas de cálculo, re-evaluar con globalScope
  if (Array.isArray(parsed.gastos) && Object.keys(globalScope).length > 0) {
    gastosConfig.length = 0;
    parsed.gastos.forEach((g: any, gIdx: number) => {
      let gNombre = `Gasto ${gIdx + 1}`;
      let gMonto = 0;
      if (typeof g === 'string') {
        const parsedG = parseQuantityAndName(g, globalScope);
        gNombre = parsedG.nombre;
        gMonto = parsedG.precioManual || 0;
      } else if (typeof g === 'object' && g !== null) {
        const gKey = Object.keys(g)[0];
        if (gKey) {
          gNombre = gKey;
          gMonto = evaluateExpressionOrNumber(g[gKey], globalScope);
        }
      }
      if (gMonto > 0) {
        gastosConfig.push({
          id: `gasto-yaml-${gIdx}`,
          nombre: gNombre,
          modalidad: 'monto_fijo',
          valor: gMonto,
          aplica: true
        });
      }
    });
  }

  // 2. Capítulos y Partidas
  const capitulos: CapituloPresupuesto[] = [];
  const items: ItemPresupuesto[] = [];

  const reservedKeys = new Set([
    'cliente',
    'obra',
    'factura',
    'validez',
    'margen',
    'riesgo',
    'dolar',
    'gastos',
    'condiciones_pago',
    'partidas',
    'capitulos',
    'calculos',
    'variables'
  ]);

  // Si hay partidas sin capítulo explícito bajo "partidas:"
  if (Array.isArray(parsed.partidas)) {
    parsed.partidas.forEach((rawItem: any) => {
      parseAndAddItem(rawItem, undefined, items, context, diagnostics, globalScope, calculatedCells);
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
            parseAndAddItem(rawItem, capId, items, context, diagnostics, globalScope, calculatedCells);
          });
        }
      }
    });
  }

  // Cada clave no reservada que contenga un Array es un Capítulo
  let capIndex = capitulos.length;
  Object.keys(parsed).forEach((key) => {
    if (!reservedKeys.has(key) && Array.isArray(parsed[key])) {
      capIndex++;
      const capNombre = key.trim();
      const capId = `cap-${capIndex}-${normalizeString(capNombre).slice(0, 15).replace(/\s+/g, '-')}`;
      capitulos.push({ id: capId, nombre: capNombre });

      parsed[key].forEach((rawItem: any) => {
        parseAndAddItem(rawItem, capId, items, context, diagnostics, globalScope, calculatedCells);
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
    calculatedCells
  };
}

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
  calculatedCellsCollector?: CalculatedCell[]
) {
  if (!rawItem) return;

  // CASO 1: Ítem simple como string (ej: "- 10 u Boca de Iluminación" o "- =bocas u Boca...")
  if (typeof rawItem === 'string') {
    const { cantidad, unidad, nombre, condicion, precioManual } = parseQuantityAndName(rawItem, scope);
    if (cantidad <= 0) return;
    buildAndPushItem({
      nombre,
      cantidad,
      unidad,
      condicion: condicion || 'normal',
      precioManual,
      capituloId,
      items,
      context,
      diagnostics,
      parametros: scope
    });
    return;
  }

  // CASO 2: Ítem como objeto
  if (typeof rawItem === 'object' && rawItem !== null) {
    const keys = Object.keys(rawItem);
    if (keys.length === 0) return;

    const taskTitleKey = keys[0];
    const taskContent = rawItem[taskTitleKey];

    // Ámbito local de cálculo para la tarea (hereda el globalScope)
    const taskScope: Record<string, number> = { ...scope };
    const rawTaskCalculos =
      typeof taskContent === 'object' && taskContent !== null
        ? (taskContent.calculos || taskContent.variables)
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
        const { cantidad, unidad, nombre, condicion } = parseQuantityAndName(taskTitleKey, taskScope);
        if (cantidad <= 0) return;
        const precio = parseLocalizedNumber(taskContent);
        buildAndPushItem({
          nombre,
          cantidad,
          unidad,
          condicion: condicion || 'normal',
          precioManual: precio,
          capituloId,
          items,
          context,
          diagnostics,
          parametros: taskScope
        });
      } else {
        // String combinado
        const combined = `${taskTitleKey}: ${taskContent}`;
        const { cantidad, unidad, nombre, condicion, precioManual } = parseQuantityAndName(combined, taskScope);
        if (cantidad <= 0) return;
        buildAndPushItem({
          nombre,
          cantidad,
          unidad,
          condicion: condicion || 'normal',
          precioManual,
          capituloId,
          items,
          context,
          diagnostics,
          parametros: taskScope
        });
      }
      return;
    }

    // 2.2 Si el contenido es un objeto (Partida a medida compuesta con materiales y/o mano de obra)
    if (typeof taskContent === 'object' && taskContent !== null) {
      const { cantidad: parsedQty, unidad: parsedUnit, nombre: cleanName } = parseQuantityAndName(taskTitleKey, taskScope);
      const cantidad = taskContent.cantidad !== undefined
        ? evaluateExpressionOrNumber(taskContent.cantidad, taskScope)
        : parsedQty;
      if (cantidad <= 0) return;

      const unidad = taskContent.unidad ? String(taskContent.unidad).trim() : parsedUnit;
      const condicion: 'normal' | 'dificultosa' | 'favorable' =
        (taskContent.condicion || taskContent.condicionTrabajo || 'normal').toLowerCase();
      const precioManual = taskContent.precio !== undefined
        ? evaluateExpressionOrNumber(taskContent.precio, taskScope)
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
        'materiales', 'insumos', 'mano_obra', 'manoObra', 'mo', 'parametros', 'params',
        'tipo', 'descripcion', 'producto', 'marca', 'calculos', 'variables'
      ]);
      Object.entries(taskContent).forEach(([k, v]) => {
        if (!reservedTaskKeys.has(k) && (typeof v === 'number' || (typeof v === 'string' && (v.startsWith('=') || /^-?\s*\$?\s*[0-9.,]+$/.test(v))))) {
          parametrosMap[k] = evaluateExpressionOrNumber(v as any, taskScope);
        }
      });

      // Si tiene desglose de materiales o mano de obra -> Construir APU a medida
      if (materialesList.length > 0 || manoObraList.length > 0) {
        buildCompositeItem({
          nombre: cleanName,
          cantidad,
          unidad,
          condicion,
          precioManual,
          materialesList,
          manoObraList,
          capituloId,
          items,
          context,
          diagnostics,
          scope: taskScope
        });
      } else {
        // Objeto sin despiece pero con configuración directa o paramétrica
        buildAndPushItem({
          nombre: cleanName,
          cantidad,
          unidad,
          condicion,
          precioManual,
          capituloId,
          items,
          context,
          diagnostics,
          parametros: Object.keys(parametrosMap).length > 0 ? parametrosMap : undefined
        });
      }
    }
  }
}

/**
 * Construye una partida a medida (In Situ) con despiece de materiales y categorías de mano de obra
 */
function buildCompositeItem(params: {
  nombre: string;
  cantidad: number;
  unidad: string;
  condicion: 'normal' | 'dificultosa' | 'favorable';
  precioManual?: number;
  materialesList: any[];
  manoObraList: any[];
  capituloId?: string;
  items: ItemPresupuesto[];
  context: ParseDSLContext;
  diagnostics: DSLDiagnostic[];
  scope?: Record<string, number>;
}) {
  const {
    nombre,
    cantidad,
    unidad,
    condicion,
    precioManual,
    materialesList,
    manoObraList,
    capituloId,
    items,
    context,
    diagnostics,
    scope
  } = params;

  const insumosSnapshot: InsumoSnapshot[] = [];
  const allInsumos = Array.from(context.insumosMap.values());

  // 1. Procesar Materiales
  materialesList.forEach((mItem: any) => {
    let mCant = 1;
    let mUn = 'u';
    let mNombre = '';
    let mMarca: string | undefined = undefined;
    let mPrecio: number | undefined = undefined;

    if (typeof mItem === 'string') {
      const parsedM = parseQuantityAndName(mItem, scope);
      mCant = parsedM.cantidad;
      mUn = parsedM.unidad;
      mNombre = parsedM.nombre;
      mMarca = parsedM.marca;
      mPrecio = parsedM.precioManual;
    } else if (typeof mItem === 'object' && mItem !== null) {
      if (mItem.nombre) {
        // Formato estructurado explícito: { nombre: "...", cantidad: 2, marca: "...", precio: 1000 }
        mNombre = String(mItem.nombre).trim();
        mMarca = mItem.producto ? String(mItem.producto).trim() : (mItem.marca ? String(mItem.marca).trim() : undefined);
        mPrecio = mItem.precio !== undefined ? evaluateExpressionOrNumber(mItem.precio, scope) : undefined;
        if (mItem.cantidad !== undefined) {
          if (typeof mItem.cantidad === 'string') {
            const parsedQ = parseQuantityAndName(mItem.cantidad, scope);
            mCant = parsedQ.cantidad;
            if (parsedQ.unidad && parsedQ.unidad !== 'u') mUn = parsedQ.unidad;
          } else {
            mCant = evaluateExpressionOrNumber(mItem.cantidad, scope);
          }
        }
        if (mItem.unidad) mUn = String(mItem.unidad).trim();
      } else {
        // Formato clave-valor: { "Cable Unipolar": { cantidad: 25, marca: "Prysmian", precio: 1250 } } o { "Cable": 1250 }
        const mKey = Object.keys(mItem)[0];
        const val = mItem[mKey];
        const parsedM = parseQuantityAndName(mKey, scope);
        mNombre = parsedM.nombre;
        mMarca = parsedM.marca;
        mCant = parsedM.cantidad;
        mUn = parsedM.unidad;
        mPrecio = parsedM.precioManual;

        const propSource = (typeof val === 'object' && val !== null) ? val : mItem;
        if (propSource.cantidad !== undefined) {
          if (typeof propSource.cantidad === 'string') {
            const parsedQ = parseQuantityAndName(propSource.cantidad, scope);
            mCant = parsedQ.cantidad;
            if (parsedQ.unidad && parsedQ.unidad !== 'u') mUn = parsedQ.unidad;
          } else {
            mCant = evaluateExpressionOrNumber(propSource.cantidad, scope);
          }
        }
        if (propSource.unidad) mUn = String(propSource.unidad).trim();
        if (propSource.producto || propSource.marca) {
          mMarca = String(propSource.producto || propSource.marca).trim();
        }
        if (propSource.precio !== undefined) {
          mPrecio = evaluateExpressionOrNumber(propSource.precio, scope);
        } else if (val !== undefined && val !== null && typeof val !== 'object') {
          mPrecio = evaluateExpressionOrNumber(val, scope);
        }
      }
    }

    if (!mNombre) return;
    if (mCant <= 0) return; // Si la cantidad calculada es <= 0, se omite el material

    // Buscar insumo en el catálogo (priorizando coincidencia por marca si se indicó)
    const normMat = normalizeString(mNombre);
    const normMarca = mMarca ? normalizeString(mMarca) : '';

    let matchedInsumo = allInsumos.find((ins) => {
      const matchName =
        normalizeString(ins.nombre) === normMat ||
        normalizeString(ins.nombre).includes(normMat) ||
        normMat.includes(normalizeString(ins.nombre));
      if (!matchName) return false;
      if (normMarca) {
        const insMarca = normalizeString(ins.marca || '');
        return insMarca.includes(normMarca) || normMarca.includes(insMarca);
      }
      return true;
    });

    if (!matchedInsumo && normMarca) {
      // Fallback a coincidencia sólo por nombre técnico
      matchedInsumo = allInsumos.find(
        (ins) =>
          normalizeString(ins.nombre) === normMat ||
          normalizeString(ins.nombre).includes(normMat) ||
          normMat.includes(normalizeString(ins.nombre))
      );
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
          line: 1,
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
    let moCatNombre = '';
    let moPrecio: number | undefined = undefined;

    if (typeof moItem === 'string') {
      const parsedMo = parseQuantityAndName(moItem, scope);
      moHoras = parsedMo.cantidad;
      moCatNombre = parsedMo.nombre;
      moPrecio = parsedMo.precioManual;
    } else if (typeof moItem === 'object' && moItem !== null) {
      const moKey = Object.keys(moItem)[0];
      const parsedMo = parseQuantityAndName(moKey, scope);
      moHoras = parsedMo.cantidad;
      moCatNombre = parsedMo.nombre;
      moPrecio = parsedMo.precioManual;
      const val = moItem[moKey];
      const propSource = (typeof val === 'object' && val !== null) ? val : moItem;
      if (propSource.cantidad !== undefined || propSource.horas !== undefined) {
        const rawHours = propSource.cantidad ?? propSource.horas;
        if (typeof rawHours === 'string') {
          const p = parseQuantityAndName(rawHours, scope);
          moHoras = p.cantidad;
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

    if (!moCatNombre) return;
    if (moHoras <= 0) return; // Si las horas calculadas son <= 0, se omite la mano de obra

    const normCat = normalizeString(moCatNombre);
    const matchedMo = allMo.find(
      (m) =>
        normalizeString(m.nombre) === normCat ||
        normalizeString(m.nombre).includes(normCat) ||
        normCat.includes(normalizeString(m.nombre))
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
          line: 1,
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
      costoHoraCongelado: costoHora,
      subtotalManoObra: subtotalMo
    });
  });

  // 3. Totales de Costo Directo de la Partida a Medida
  const costoInsumos = roundMoney(insumosSnapshot.reduce((acc, i) => acc + (i.subtotalInsumoFinal ?? i.subtotalInsumo), 0));
  const rawMo = manoObraSnapshot.reduce((acc, m) => acc + m.subtotalManoObra, 0);
  const moMultiplier = condicion === 'dificultosa' ? 1.2 : condicion === 'favorable' ? 0.9 : 1.0;
  const costoManoObra = roundMoney(rawMo * moMultiplier);

  const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra);
  const costoUnitario = cantidad > 0 ? roundMoney(costoDirectoTotal / cantidad) : costoDirectoTotal;

  const normTarget = normalizeString(nombre);
  let matchedTarea = context.tareasTipo.find((t) => normalizeString(t.nombre) === normTarget);
  if (!matchedTarea) {
    matchedTarea = context.tareasTipo.find(
      (t) => normalizeString(t.nombre).includes(normTarget) || normTarget.includes(normalizeString(t.nombre))
    );
  }

  const newItem: ItemPresupuesto = {
    id: `item-yaml-${crypto.randomUUID().slice(0, 8)}`,
    capituloId,
    tareaTipoId: matchedTarea?.id,
    descripcion: nombre,
    cantidad,
    unidad: unidad || matchedTarea?.unidad || 'u',
    naturaleza: matchedTarea?.naturaleza || 'instalacion',
    condicionTrabajo: condicion,
    costoUnitario,
    costoInsumos,
    costoManoObra,
    costoServicios: 0,
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
  diagnostics.push({
    line: 1,
    type: 'info',
    message: `✓ Partida a medida "${nombre}": ${insumosSnapshot.length} insumos, ${manoObraSnapshot.length} cat. MO ($ ${costoDirectoTotal.toLocaleString('es-AR')})`
  });
}

/**
 * Construye una partida simple vinculándola al catálogo de Tareas Tipo o como ítem directo
 */
function buildAndPushItem(params: {
  nombre: string;
  cantidad: number;
  unidad: string;
  condicion: 'normal' | 'dificultosa' | 'favorable';
  precioManual?: number;
  capituloId?: string;
  items: ItemPresupuesto[];
  context: ParseDSLContext;
  diagnostics: DSLDiagnostic[];
  parametros?: Record<string, number>;
}) {
  const {
    nombre,
    cantidad,
    unidad,
    condicion,
    precioManual,
    capituloId,
    items,
    context,
    diagnostics,
    parametros
  } = params;

  const normTarget = normalizeString(nombre);

  // 1. Buscar coincidencia en Catálogo de Tareas Tipo
  let matchedTarea = context.tareasTipo.find((t) => normalizeString(t.nombre) === normTarget);
  if (!matchedTarea) {
    matchedTarea = context.tareasTipo.find(
      (t) => normalizeString(t.nombre).includes(normTarget) || normTarget.includes(normalizeString(t.nombre))
    );
  }

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
      line: 1,
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
      line: 1,
      type: 'info',
      message: `Partida directa: "${nombre}" (${cantidad} ${newItem.unidad})`
    });
  }
}

export type CursorContextType = 'materiales' | 'mano_obra' | 'tareas' | 'general';

export interface CursorContextResult {
  contextType: CursorContextType;
  currentIndent: string;
  activeCategory?: string;
  parentHeader?: string;
}

/**
 * Analiza el texto previo a la posición del cursor para inferir el contexto semántico YAML actual
 * (materiales, mano de obra, tareas tipo / ítems de capítulo, o directivas generales).
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
  // - Nivel 1 (indent 0): Capítulo / Directivas generales
  // - Nivel 2 (indent 2-4): Partidas ("- 1 u Boca...", "- Partida...")
  // - Nivel 3 (indent 4-6): Secciones de partida ("materiales:", "mano_obra:", "condicion:", etc.)
  // - Nivel 4 (indent 6-10): Ítems de despiece ("- Cable...", "- 4h Oficial...")
  // - Nivel 5 (indent >= 10): Propiedades de ítems ("cantidad:", "precio:", etc.)

  for (let i = lines.length - 2; i >= 0; i--) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const lineIndent = (rawLine.match(/^\s*/)?.[0] || '').length;

    // 1. Detectar si cruzamos una sección de partida ("materiales:" o "mano_obra:")
    const secMatch = trimmed.match(/^(materiales|insumos|mano_obra|manoobra|mo)\s*:/i);
    if (secMatch) {
      const secType = /^(materiales|insumos)/i.test(secMatch[1]) ? 'materiales' : 'mano_obra';

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
      if (currentIndentLen > lineIndent) {
        return { contextType: 'tareas', currentIndent, parentHeader: 'partida' };
      }
    }

    // 4. Encabezados especiales: "gastos:", "calculos:", "variables:"
    if (/^(gastos|calculos|variables)\s*:?/i.test(trimmed) && lineIndent === 0) {
      return { contextType: 'general', currentIndent, parentHeader: trimmed.replace(/:$/, '').trim() };
    }

    // 5. Encabezado a nivel raíz (indent 0) con ":"
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
export function detectSuggestTrigger(currentLineBeforeCursor: string): SuggestTriggerResult | null {
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

  // 2. Detección de directivas de cabecera raíz (cliente:, obra:, factura:, validez:, margen:, riesgo:, dolar:)
  // Solo a nivel raíz (sangría de 0 a 3 espacios, no dentro de despieces de partidas)
  const rootDirectiveMatch = currentLineBeforeCursor.match(/^(\s{0,3})(cliente|obra|factura|validez|margen|riesgo|dolar)\s*:\s*([^\r\n]*)$/i);
  if (rootDirectiveMatch) {
    const directive = rootDirectiveMatch[2].toLowerCase() as
      | 'cliente'
      | 'obra'
      | 'factura'
      | 'validez'
      | 'margen'
      | 'riesgo'
      | 'dolar';
    const query = rootDirectiveMatch[3];
    // Si el usuario ya está escribiendo un comentario '#', no disparar autocompletado
    if (!query.includes('#')) {
      const queryIndexInLine = currentLineBeforeCursor.lastIndexOf(query);
      return {
        triggerChar: directive === 'cliente' ? '@' : ':',
        query,
        queryIndexInLine: queryIndexInLine >= 0 ? queryIndexInLine : currentLineBeforeCursor.length,
        isExplicit: false,
        directiveType: directive
      };
    }
  }

  // 3. IntelliSense automático en renglón de lista (-)
  // Detecta palabras de 2+ letras o dimensiones como 3x2.5, 2x16, permitiendo caracteres técnicos
  // (. , / " ' - + etc.) para medidas y secciones
  const autoMatch = currentLineBeforeCursor.match(/-\s*(?:[0-9.,]+\s*[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ²³]*\s+)?((?:[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]{2,}|\d+[xX][0-9.,]*)[^\r\n]*)$/);
  if (autoMatch) {
    const rawQuery = autoMatch[1];
    const isKeyword = /^(materiales|insumos|mano_obra|manoobra|mo):?$/i.test(rawQuery.trim());
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
    const isKeyword = /^(materiales|insumos|mano_obra|manoobra|mo):?$/i.test(rawQuery.trim());
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
  contextType?: 'general' | 'capitulo' | 'tareas' | 'materiales' | 'mano_obra';
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
  if (/^(materiales|mano_obra|condicion|precio|parametros):/i.test(snippet.trim())) {
    lineIndent = '      ';
  } else if (contextType === 'materiales' || contextType === 'mano_obra') {
    if (snippet.trim().startsWith('- ') && lineIndent.length < 8) {
      lineIndent = '        ';
    } else if (/^(cantidad|precio|producto|marca|unidad|horas|notas):\s*/i.test(snippet.trim()) && lineIndent.length < 12) {
      lineIndent = '            ';
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
      // Snippet simple sin cantidad inline (ej: "- Cable Unipolar [Prysmian]\n")
      const afterDash = snippet.slice(2).trim();
      if (userQtyUnit) {
        replacementLine = `${lineIndent}- ${userQtyUnit} ${afterDash}\n`;
      } else {
        replacementLine = `${lineIndent}- ${afterDash}\n`;
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
 * 1. Si se escribe "materiales:" o "mano_obra:" debajo de un ítem:
 *    - Le agrega ':' al ítem superior si no lo tenía.
 *    - Quita el guión inicial y sangra "materiales:" con 6 espacios bajo el ítem.
 *    - Genera en el nuevo renglón "        - " listo para listar insumos.
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

  // Caso 1: La línea actual es la palabra clave "materiales" o "mano_obra" (con o sin guión, con o sin ':')
  const isMaterialesKeyword = /^-\s*(materiales|insumos)\s*:?$/i.test(trimmed) || /^(materiales|insumos)\s*:?$/i.test(trimmed);
  const isManoObraKeyword = /^-\s*(mano_obra|manoobra|mo)\s*:?$/i.test(trimmed) || /^(mano_obra|manoobra|mo)\s*:?$/i.test(trimmed);

  if (isMaterialesKeyword || isManoObraKeyword) {
    const keyword = isMaterialesKeyword ? 'materiales:' : 'mano_obra:';

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

      // O si encontramos la clave "materiales:" previa (para alinear mano_obra)
      if (/^\s*materiales:/i.test(raw)) {
        parentItemIndent = ind.length >= 4 ? ind.slice(0, ind.length - 4) : '';
        break;
      }
    }

    const keywordIndent = parentItemIndent + '    ';
    linesBefore[linesBefore.length - 1] = keywordIndent + keyword;

    const childIndent = keywordIndent + '  ';
    const nextLine = childIndent + '- ';

    const updatedBefore = linesBefore.join('\n') + '\n' + nextLine;
    return {
      newText: updatedBefore + textAfter,
      newCursorPos: updatedBefore.length
    };
  }

  // Caso 2: Renglón con ítem de lista vacío (ej: "        - " o "  -")
  // Al presionar Enter, se cancela la viñeta y se desindenta un nivel hacia afuera
  if (/^-\s*$/.test(trimmed)) {
    let unindented = '';
    if (leadingWhitespace.length >= 7) {
      // De nivel 4 (8 espacios + "- ") a nivel 3 (6 espacios)
      unindented = '      ';
    } else if (leadingWhitespace.length >= 5) {
      // De nivel 3 (6 espacios + "- ") a nivel 2 (2 espacios + "- ")
      unindented = '  - ';
    } else {
      // De nivel 2 (2 espacios + "- ") a nivel 1 (raíz)
      unindented = '';
    }

    const newText = textBefore.substring(0, lastLineStart) + unindented + textAfter;
    return {
      newText,
      newCursorPos: lastLineStart + unindented.length
    };
  }

  // Caso 2.5: Renglón vacío con sangría (ej: "            " tras escribir propiedades o "      " tras una sección)
  // Al presionar Enter en una línea vacía, desindenta un nivel hacia afuera en la jerarquía YAML
  if (trimmed === '' && leadingWhitespace.length >= 2) {
    let unindented = '';
    if (leadingWhitespace.length >= 10) {
      // De nivel 5 (12 espacios de propiedades) a nivel 4 (8 espacios + viñeta "- ")
      unindented = '        - ';
    } else if (leadingWhitespace.length >= 7) {
      // De nivel 4 (8 espacios) a nivel 3 (6 espacios)
      unindented = '      ';
    } else if (leadingWhitespace.length >= 5) {
      // De nivel 3 (6 espacios) a nivel 2 (2 espacios + viñeta "- ")
      unindented = '  - ';
    } else {
      // De nivel 2 (2 a 4 espacios) a nivel 1 (raíz)
      unindented = '';
    }

    const newText = textBefore.substring(0, lastLineStart) + unindented + textAfter;
    return {
      newText,
      newCursorPos: lastLineStart + unindented.length
    };
  }

  // Caso 3: Renglón es un ítem de lista que termina con dos puntos ':' (ej: "        - Cable Unipolar 1.5 mm²:" o "        - 1 u Disyuntor 25A:")
  // Abre bloque de propiedades anidadas de ese ítem (como cantidad, producto, precio), NO una lista con viñetas "- "
  if (trimmed.startsWith('- ') && trimmed.endsWith(':')) {
    const propIndent = leadingWhitespace + '    ';
    // Si no tenía cantidad en línea, sugerir directamente "cantidad: "
    const hasInlineQty = /-\s*[0-9.,]+\s*[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ²³]*/.test(trimmed);
    const nextLineContent = hasInlineQty ? propIndent : propIndent + 'cantidad: ';
    const newText = textBefore + '\n' + nextLineContent + textAfter;
    return {
      newText,
      newCursorPos: textBefore.length + 1 + nextLineContent.length
    };
  }

  // Caso 4: Encabezado general que termina con dos puntos ':' (ej: "Tableros:", "cables:", "materiales:")
  // Si es un encabezado que espera una lista de ítems, auto-indenta con viñeta "- "
  if (trimmed.endsWith(':')) {
    const nextIndent = leadingWhitespace + '  - ';
    const newText = textBefore + '\n' + nextIndent + textAfter;
    return {
      newText,
      newCursorPos: textBefore.length + 1 + nextIndent.length
    };
  }

  // Caso 5: Renglón es un ítem de lista con contenido (ej: "  - 10 u Boca..." o "        - 1 u Cable...")
  // Continúa automáticamente la lista en el siguiente renglón con la misma sangría y viñeta
  if (trimmed.startsWith('- ') && trimmed.length > 2) {
    const nextListItem = leadingWhitespace + '- ';
    const newText = textBefore + '\n' + nextListItem + textAfter;
    return {
      newText,
      newCursorPos: textBefore.length + 1 + nextListItem.length
    };
  }

  // Caso 6: Renglón normal (ej: propiedad "cantidad: 20 m", "precio: 1000") -> Mantiene la sangría actual
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
  // o si es una viñeta vacía (ej: "        - " o "  -")
  const isEmptyLine = trimmed === '';
  const isEmptyBullet = /^-\s*$/.test(trimmed);

  if (!isEmptyLine && !isEmptyBullet) {
    return null;
  }

  // 1. Si es una viñeta vacía ("- "):
  if (isEmptyBullet) {
    let targetIndent = '';
    if (leadingWhitespace.length >= 7) {
      // De nivel 4 (8 espacios + "- ") retrocede a nivel 3 (6 espacios)
      targetIndent = '      ';
    } else if (leadingWhitespace.length >= 5) {
      // De nivel 3 (6 espacios + "- ") retrocede a nivel 2 (2 espacios + "- ")
      targetIndent = '  - ';
    } else {
      // De nivel 2 (2 espacios + "- ") retrocede a nivel 1 (raíz)
      targetIndent = '';
    }

    const newText = textBefore.substring(0, lastLineStart) + targetIndent + textAfter;
    return {
      newText,
      newCursorPos: lastLineStart + targetIndent.length
    };
  }

  // 2. Si es una línea vacía con sangría ("            " o "        " o "      " o "  "):
  if (isEmptyLine) {
    let targetLine = '';
    if (leadingWhitespace.length >= 10) {
      // De nivel 5 (12 espacios de propiedad) retrocede a nivel 4 (8 espacios + "- ")
      targetLine = '        - ';
    } else if (leadingWhitespace.length >= 7) {
      // De nivel 4 (8 espacios) retrocede a nivel 3 (6 espacios)
      targetLine = '      ';
    } else if (leadingWhitespace.length >= 5) {
      // De nivel 3 (6 espacios) retrocede a nivel 2 (2 espacios + "- ")
      targetLine = '  - ';
    } else if (leadingWhitespace.length >= 2) {
      // De nivel 2 (2 a 4 espacios) retrocede a nivel 1 (raíz)
      targetLine = '';
    } else {
      // Sangría 0 o 1: dejar actuar al Backspace normal del navegador (une con línea anterior)
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
      // 3. Variables o cálculos (ej: "  superficie: 120")
      else if (/^\s{2,4}([a-zA-Z0-9_]+)\s*:\s*(.*)$/.test(line) && !line.trim().startsWith('-')) {
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




