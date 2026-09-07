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
  roundMoney,
  safeNum
} from '../../../core/calculations';

export interface DSLDiagnostic {
  line: number;
  type: 'info' | 'warning' | 'error';
  message: string;
}

export interface ParseDSLResult {
  clienteId: string;
  clienteMatched?: Cliente;
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
    .normalize('NFD')
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
 * Genera una plantilla inicial en formato YAML para comenzar una cotización desde cero
 */
export function getDefaultPresupuestoYAMLTemplate(context?: {
  clientes?: Cliente[];
  clienteId?: string;
  direccionObra?: string;
}): string {
  const cliente = context?.clientes?.find((c) => c.id === context?.clienteId) || context?.clientes?.[0];
  const clienteNombre = cliente ? (cliente.razonSocial || cliente.nombre) : 'Nombre o Estudio del Cliente';
  const obra = context?.direccionObra || 'Dirección de la Obra';

  return `# ============================================================
# COTIZACIÓN INTELIGENTE - MODO EXPERTO (YAML)
# Podés escribir directamente, usar comentarios '#' y comandos '/'
# ============================================================

# Datos Principales de la Cotización
cliente: ${clienteNombre}
obra: ${obra}
factura: Factura A          # Opciones: Factura A, Factura B, Factura C o Presupuesto X
validez: 15 dias
margen: 35%                 # Margen de beneficio sobre costos
riesgo: normal              # Opciones: bajo, normal, alto
dolar: MEP 1350             # Opcional (ej: Blue 1400)

# ------------------------------------------------------------
# CAPÍTULOS Y PARTIDAS
# Podés listar Tareas del catálogo o Partidas a medida con despiece
# ------------------------------------------------------------
Instalación Eléctrica:
  - 10 u Boca de Iluminación
  - 4 u Tomacorriente Doble

Tableros y Automatización:
  # Partida a medida: despiece con cómputo automático de insumos y mano de obra
  - Tablero Seccional Bombeo:
      materiales:
        - 1 u Gabinete DIN 24 módulos
        - 2 u Disyuntor Diferencial 2x40A
        - 1 u Dispositivo especial a medida: $ 45.000  # Si no está en catálogo, poné ': $ precio'
      mano_obra:
        - 6 h Oficial
        - 4 h Ayudante
      condicion: normal      # Opciones: normal, dificultosa, favorable

# ------------------------------------------------------------
# GASTOS OPERATIVOS E INDIRECTOS (Opcional)
# ------------------------------------------------------------
gastos:
  - Viáticos: $ 15.000
  - Flete y Logística: $ 10.000
`;
}

export function generateExampleDSL(cliente?: Cliente): string {
  return getDefaultPresupuestoYAMLTemplate({
    clientes: cliente ? [cliente] : undefined,
    clienteId: cliente?.id
  });
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
  const cliente = data.clientes.find((c) => c.id === data.clienteId);
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
        lines.push(`${indent}      - ${cantUnit} ${ins.nombre}${priceStr}`);
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
function parseQuantityAndName(raw: string): {
  cantidad: number;
  unidad: string;
  nombre: string;
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

  // 2. Precio manual (: $ 15.000 o = $ 15.000 o : 15000)
  let precioManual: number | undefined = undefined;
  const priceMatch = str.match(/(?:[:=]\s*\$?\s*)([0-9.,]+)\s*$/);
  if (priceMatch) {
    precioManual = parseLocalizedNumber(priceMatch[1]);
    str = str.slice(0, priceMatch.index).trim();
  }

  // Quitar asteriscos o comillas sobrantes si venía del DSL viejo
  str = str.replace(/^\*\s*/, '').replace(/^"|"$/g, '').trim();

  // 3. Cantidad y Unidad al inicio (ej: "10 u ...", "25m ...", "4 ...")
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
        condicion,
        precioManual
      };
    }
  }

  // Si no tiene número al inicio, cantidad = 1
  return {
    cantidad: 1,
    unidad: 'u',
    nombre: str.replace(/^"|"$/g, ''),
    condicion,
    precioManual
  };
}

/**
 * Parsea el texto YAML completo y construye el estado del Presupuesto
 */
export function parseDSLToPresupuesto(
  yamlText: string,
  context: ParseDSLContext
): ParseDSLResult {
  const diagnostics: DSLDiagnostic[] = [];

  let parsed: any = null;
  try {
    parsed = YAML.parse(yamlText);
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
  if (parsed.cliente) {
    const rawCli = String(parsed.cliente).trim();
    const normCli = normalizeString(rawCli);
    if (normCli) {
      // 1.1 Match exacto
      clienteMatched = context.clientes.find(
        (c) => normalizeString(c.nombre || '') === normCli || normalizeString(c.razonSocial || '') === normCli
      );
      // 1.2 Match parcial
      if (!clienteMatched) {
        clienteMatched = context.clientes.find(
          (c) =>
            normalizeString(c.nombre || '').includes(normCli) ||
            normCli.includes(normalizeString(c.nombre || '')) ||
            (c.razonSocial && normalizeString(c.razonSocial).includes(normCli))
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
  let nombreDolar = 'Dólar MEP';
  let cotizacionDolar = 1350;
  if (parsed.dolar) {
    const dStr = String(parsed.dolar);
    const dNum = parseLocalizedNumber(dStr);
    if (dNum > 0) {
      mostrarDolar = true;
      cotizacionDolar = dNum;
      const cleanName = dStr.replace(/[0-9.,$:=]/g, '').trim();
      if (cleanName) nombreDolar = cleanName;
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
    'capitulos'
  ]);

  // Si hay partidas sin capítulo explícito bajo "partidas:"
  if (Array.isArray(parsed.partidas)) {
    parsed.partidas.forEach((rawItem: any) => {
      parseAndAddItem(rawItem, undefined, items, context, diagnostics);
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
            parseAndAddItem(rawItem, capId, items, context, diagnostics);
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
        parseAndAddItem(rawItem, capId, items, context, diagnostics);
      });
    }
  });

  return {
    clienteId,
    clienteMatched,
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
    diagnostics
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
  diagnostics: DSLDiagnostic[]
) {
  if (!rawItem) return;

  // CASO 1: Ítem simple como string (ej: "- 10 u Boca de Iluminación")
  if (typeof rawItem === 'string') {
    const { cantidad, unidad, nombre, condicion, precioManual } = parseQuantityAndName(rawItem);
    buildAndPushItem({
      nombre,
      cantidad,
      unidad,
      condicion: condicion || 'normal',
      precioManual,
      capituloId,
      items,
      context,
      diagnostics
    });
    return;
  }

  // CASO 2: Ítem como objeto
  if (typeof rawItem === 'object' && rawItem !== null) {
    const keys = Object.keys(rawItem);
    if (keys.length === 0) return;

    const taskTitleKey = keys[0];
    const taskContent = rawItem[taskTitleKey];

    // 2.1 Si el contenido es un valor primitivo (ej: { "10 u Boca": "$ 15.000" } o { "Boca": "dicroica" })
    if (typeof taskContent === 'string' || typeof taskContent === 'number') {
      const isPrice = /^\s*\$?\s*[0-9.,]+$/.test(String(taskContent));
      if (isPrice) {
        const { cantidad, unidad, nombre, condicion } = parseQuantityAndName(taskTitleKey);
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
          diagnostics
        });
      } else {
        // String combinado
        const combined = `${taskTitleKey}: ${taskContent}`;
        const { cantidad, unidad, nombre, condicion, precioManual } = parseQuantityAndName(combined);
        buildAndPushItem({
          nombre,
          cantidad,
          unidad,
          condicion: condicion || 'normal',
          precioManual,
          capituloId,
          items,
          context,
          diagnostics
        });
      }
      return;
    }

    // 2.2 Si el contenido es un objeto (Partida a medida compuesta con materiales y/o mano de obra)
    if (typeof taskContent === 'object' && taskContent !== null) {
      const { cantidad: parsedQty, unidad: parsedUnit, nombre: cleanName } = parseQuantityAndName(taskTitleKey);
      const cantidad = taskContent.cantidad ? parseLocalizedNumber(taskContent.cantidad) : parsedQty;
      const unidad = taskContent.unidad ? String(taskContent.unidad).trim() : parsedUnit;
      const condicion: 'normal' | 'dificultosa' | 'favorable' =
        (taskContent.condicion || taskContent.condicionTrabajo || 'normal').toLowerCase();
      const precioManual = taskContent.precio ? parseLocalizedNumber(taskContent.precio) : undefined;

      const materialesList = taskContent.materiales || taskContent.insumos || [];
      const manoObraList = taskContent.mano_obra || taskContent.manoObra || taskContent.mo || [];

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
          diagnostics
        });
      } else {
        // Objeto sin despiece pero con configuración directa
        buildAndPushItem({
          nombre: cleanName,
          cantidad,
          unidad,
          condicion,
          precioManual,
          capituloId,
          items,
          context,
          diagnostics
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
    diagnostics
  } = params;

  const insumosSnapshot: InsumoSnapshot[] = [];
  const allInsumos = Array.from(context.insumosMap.values());

  // 1. Procesar Materiales
  materialesList.forEach((mItem: any) => {
    let mCant = 1;
    let mUn = 'u';
    let mNombre = '';
    let mPrecio: number | undefined = undefined;

    if (typeof mItem === 'string') {
      const parsedM = parseQuantityAndName(mItem);
      mCant = parsedM.cantidad;
      mUn = parsedM.unidad;
      mNombre = parsedM.nombre;
      mPrecio = parsedM.precioManual;
    } else if (typeof mItem === 'object' && mItem !== null) {
      const mKey = Object.keys(mItem)[0];
      const parsedM = parseQuantityAndName(mKey);
      mCant = parsedM.cantidad;
      mUn = parsedM.unidad;
      mNombre = parsedM.nombre;
      mPrecio = parseLocalizedNumber(mItem[mKey]);
    }

    if (!mNombre) return;

    // Buscar insumo en el catálogo
    const normMat = normalizeString(mNombre);
    const matchedInsumo = allInsumos.find(
      (ins) => normalizeString(ins.nombre) === normMat || normalizeString(ins.nombre).includes(normMat)
    );

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
          message: `⚠️ Material "${mNombre}" no está en catálogo ni tiene precio (ej: ": $ 4.500").`
        });
      }
    }

    const totalQty = roundMoney(mCant * cantidad);
    const subtotal = roundMoney(totalQty * unitCost);

    insumosSnapshot.push({
      insumoId,
      nombre: finalNombre,
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
      const parsedMo = parseQuantityAndName(moItem);
      moHoras = parsedMo.cantidad;
      moCatNombre = parsedMo.nombre;
      moPrecio = parsedMo.precioManual;
    } else if (typeof moItem === 'object' && moItem !== null) {
      const moKey = Object.keys(moItem)[0];
      const parsedMo = parseQuantityAndName(moKey);
      moHoras = parsedMo.cantidad;
      moCatNombre = parsedMo.nombre;
      moPrecio = parseLocalizedNumber(moItem[moKey]);
    }

    if (!moCatNombre) return;

    const normCat = normalizeString(moCatNombre);
    const matchedMo = allMo.find(
      (m) => normalizeString(m.nombre) === normCat || normalizeString(m.nombre).includes(normCat)
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

  const newItem: ItemPresupuesto = {
    id: `item-yaml-${crypto.randomUUID().slice(0, 8)}`,
    capituloId,
    descripcion: nombre,
    cantidad,
    unidad: unidad || 'u',
    naturaleza: 'instalacion',
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
    diagnostics
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
    // Cálculo APU desde el motor de cálculo
    const costData = calcularCostoTareaTipo(
      matchedTarea,
      context.insumosMap,
      context.manoObraMap
    );

    let multMO = 1.0;
    if (condicion === 'dificultosa') multMO = 1.2;
    if (condicion === 'favorable') multMO = 0.9;

    const costoInsumos = costData.costoInsumosUnitario || 0;
    const costoMO = roundMoney((costData.costoManoObraUnitario || 0) * multMO);
    const costoServicios = costData.costoServiciosUnitario || 0;
    const costoUnitarioDirecto = roundMoney(costoInsumos + costoMO + costoServicios);

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
      formulaHonorarios: matchedTarea.formulaHonorarios,
      costoDirectoTotal: roundMoney(costoUnitarioDirecto * cantidad),
      costoTotal: roundMoney(costoUnitarioDirecto * cantidad),
      precioManual,
      precioVentaUnitario: precioManual || 0,
      precioVentaTotal: precioManual ? roundMoney(precioManual * cantidad) : 0,
      insumosSnapshot: costData.insumosSnapshotUnitario.map((i) => ({
        ...i,
        cantidadTotal: roundMoney(i.cantidadTotal * cantidad),
        subtotalInsumo: roundMoney(i.subtotalInsumo * cantidad),
        subtotalInsumoFinal: roundMoney((i.subtotalInsumoFinal ?? i.subtotalInsumo) * cantidad)
      })),
      manoObraSnapshot: costData.manoObraSnapshotUnitario.map((m) => ({
        ...m,
        horasTotales: roundMoney(m.horasTotales * cantidad),
        subtotalManoObra: roundMoney(m.subtotalManoObra * cantidad)
      }))
    };

    items.push(newItem);
    diagnostics.push({
      line: 1,
      type: 'info',
      message: `✓ Catálogo vinculado: "${matchedTarea.nombre}" (${cantidad} ${newItem.unidad})`
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
