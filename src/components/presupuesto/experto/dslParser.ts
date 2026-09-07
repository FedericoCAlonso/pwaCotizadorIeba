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
  AppConfig
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
 * Parsea un número en formato ARS o estándar (ej: "1.250,50" o "1250.50" o "45")
 */
export function parseLocalizedNumber(valStr: string): number {
  if (!valStr) return 0;
  const cleaned = valStr.trim().replace(/[^0-9,\.]/g, '');
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
 * Serializa el estado completo de una cotización en formato DSL texto estructurado
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
  const lines: string[] = [];

  // 1. Directivas de Cabecera
  const cliente = data.clientes.find((c) => c.id === data.clienteId);
  if (cliente) {
    lines.push(`@cliente: ${cliente.razonSocial || cliente.nombre}`);
  }
  if (data.direccionObra?.trim()) {
    lines.push(`@obra: ${data.direccionObra.trim()}`);
  }
  if (data.tipoFactura) {
    lines.push(`@factura: ${data.tipoFactura}`);
  }
  if (data.validezDias) {
    lines.push(`@validez: ${data.validezDias} dias`);
  }
  if (data.margenPorcentaje !== null && data.margenPorcentaje !== undefined) {
    lines.push(`@margen: ${data.margenPorcentaje}%`);
  }
  if (data.nivelMargenRiesgo) {
    lines.push(`@riesgo: ${data.nivelMargenRiesgo}`);
  }
  if (data.mostrarDolar) {
    lines.push(`@dolar: ${data.nombreDolar || 'Dólar Blue'} = ${data.cotizacionDolar || 1200}`);
  }

  lines.push(''); // Salto de línea

  // 2. Partidas agrupadas por capítulos
  const chaptersMap = new Map<string, CapituloPresupuesto>();
  data.capitulos.forEach((c) => chaptersMap.set(c.id, c));

  // Ítems sin capítulo al inicio
  const orphanItems = data.items.filter((it) => !it.capituloId);
  orphanItems.forEach((it) => {
    let itemLine = `- ${it.cantidad || 1} ${it.unidad || 'u'} * "${it.descripcion}"`;
    if (it.condicionTrabajo && it.condicionTrabajo !== 'normal') {
      itemLine += ` @condicion: ${it.condicionTrabajo}`;
    }
    if (it.precioManual && it.precioManual > 0) {
      itemLine += ` = $ ${Math.round(it.precioManual).toLocaleString('es-AR')}`;
    } else if (!it.tareaTipoId && it.costoUnitario && it.costoUnitario > 0) {
      itemLine += ` = $ ${Math.round(it.costoUnitario).toLocaleString('es-AR')}`;
    }
    lines.push(itemLine);
  });

  if (orphanItems.length > 0 && data.capitulos.length > 0) {
    lines.push('');
  }

  // Ítems por capítulo
  data.capitulos.forEach((cap) => {
    lines.push(`# ${cap.nombre}`);
    const capItems = data.items.filter((it) => it.capituloId === cap.id);
    capItems.forEach((it) => {
      let itemLine = `- ${it.cantidad || 1} ${it.unidad || 'u'} * "${it.descripcion}"`;
      if (it.condicionTrabajo && it.condicionTrabajo !== 'normal') {
        itemLine += ` @condicion: ${it.condicionTrabajo}`;
      }
      if (it.precioManual && it.precioManual > 0) {
        itemLine += ` = $ ${Math.round(it.precioManual).toLocaleString('es-AR')}`;
      } else if (!it.tareaTipoId && it.costoUnitario && it.costoUnitario > 0) {
        itemLine += ` = $ ${Math.round(it.costoUnitario).toLocaleString('es-AR')}`;
      }
      lines.push(itemLine);
    });
    lines.push('');
  });

  // 3. Gastos operativos
  if (data.gastosConfig && data.gastosConfig.length > 0) {
    const activeGastos = data.gastosConfig.filter((g) => g.aplica !== false && g.valor > 0);
    if (activeGastos.length > 0) {
      lines.push('// Gastos Operativos y Logística');
      activeGastos.forEach((g) => {
        if (g.modalidad === 'porcentual') {
          lines.push(`@gasto: ${g.nombre} = ${g.valor}%`);
        } else {
          lines.push(`@gasto: ${g.nombre} = $ ${Math.round(g.valor).toLocaleString('es-AR')}`);
        }
      });
    }
  }

  return lines.join('\n').trim();
}

/**
 * Parsea un documento DSL y devuelve el estado completo estructurado para el presupuesto
 */
export function parseDSLToPresupuesto(
  text: string,
  context: ParseDSLContext
): ParseDSLResult {
  const lines = text.split('\n');
  const diagnostics: DSLDiagnostic[] = [];

  let clienteId = '';
  let clienteMatched: Cliente | undefined = undefined;
  let direccionObra = '';
  let tipoFactura: TipoFactura = context.config?.tipoFacturaPorDefecto || 'Factura C';
  let validezDias = context.config?.validezDiasPorDefecto || 15;
  let margenPorcentaje = context.config?.margenPorDefectoPct ?? 30;
  let nivelMargenRiesgo: NivelMargenRiesgo = 'bajo';
  let margenRiesgoPorcentaje = context.config?.margenRiesgoDefaultPct ?? 0;
  let mostrarDolar = context.config?.mostrarDolarPorDefecto ?? false;
  let nombreDolar = context.config?.dolarReferenciaNombre || 'Dólar Blue';
  let cotizacionDolar = context.config?.dolarReferenciaValor || 1200;

  const capitulos: CapituloPresupuesto[] = [];
  const items: ItemPresupuesto[] = [];
  const gastosConfig: GastoPresupuestoConfig[] = [...(context.existingGastos || [])];

  let currentCapituloId: string | undefined = undefined;

  // Mapa de tareas por nombre normalizado para búsqueda ultra rápida O(1)
  const tareasMap = new Map<string, TareaTipo>();
  context.tareasTipo.forEach((t) => {
    tareasMap.set(normalizeString(t.nombre), t);
  });

  lines.forEach((rawLine, index) => {
    const lineNum = index + 1;
    const line = rawLine.trim();

    if (!line || line.startsWith('//') || line.startsWith(';')) {
      return; // Comentario o línea vacía
    }

    // ─── 1. DIRECTIVAS (@directiva) ─────────────────────────────────────────
    if (line.startsWith('@')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) {
        diagnostics.push({
          line: lineNum,
          type: 'warning',
          message: `Directiva mal formada "${line}". Usa el formato "@nombre: valor".`
        });
        return;
      }

      const directiveKey = line.slice(1, colonIdx).trim().toLowerCase();
      const directiveVal = line.slice(colonIdx + 1).trim();

      switch (directiveKey) {
        case 'cliente': {
          if (!directiveVal) break;
          const cleanQ = normalizeString(directiveVal);
          const found = context.clientes.find((c) => {
            const name = normalizeString(c.razonSocial || c.nombre || '');
            const cuit = (c.cuitDni || '').replace(/[^0-9]/g, '');
            return name.includes(cleanQ) || (cleanQ.length >= 6 && cuit.includes(cleanQ));
          });

          if (found) {
            clienteId = found.id;
            clienteMatched = found;
            diagnostics.push({
              line: lineNum,
              type: 'info',
              message: `Cliente asignado: "${found.razonSocial || found.nombre}"`
            });
          } else {
            diagnostics.push({
              line: lineNum,
              type: 'warning',
              message: `No se encontró el cliente "${directiveVal}" en la base de datos.`
            });
          }
          break;
        }

        case 'obra':
        case 'direccion':
        case 'ubicacion': {
          direccionObra = directiveVal;
          break;
        }

        case 'factura': {
          const valLower = directiveVal.toLowerCase().trim();
          if (valLower.includes('factura a') || /\ba\b/.test(valLower)) tipoFactura = 'Factura A';
          else if (valLower.includes('factura b') || /\bb\b/.test(valLower)) tipoFactura = 'Factura B';
          else if (valLower.includes('x') || valLower.includes('sin')) tipoFactura = 'Presupuesto X (Sin Factura)';
          else tipoFactura = 'Factura C';
          break;
        }

        case 'validez': {
          const num = parseInt(directiveVal.replace(/[^0-9]/g, ''), 10);
          if (num > 0) validezDias = num;
          break;
        }

        case 'margen': {
          const num = parseLocalizedNumber(directiveVal.replace('%', ''));
          if (num >= 0) margenPorcentaje = num;
          break;
        }

        case 'riesgo': {
          const valLower = directiveVal.toLowerCase();
          if (valLower.includes('alto')) {
            nivelMargenRiesgo = 'alto';
            margenRiesgoPorcentaje = 35;
          } else if (valLower.includes('medio')) {
            nivelMargenRiesgo = 'medio';
            margenRiesgoPorcentaje = 20;
          } else if (valLower.includes('bajo')) {
            nivelMargenRiesgo = 'bajo';
            margenRiesgoPorcentaje = 10;
          } else {
            const num = parseLocalizedNumber(directiveVal.replace('%', ''));
            nivelMargenRiesgo = 'personalizado';
            margenRiesgoPorcentaje = num;
          }
          break;
        }

        case 'dolar':
        case 'usd': {
          const valLower = directiveVal.toLowerCase();
          if (valLower === 'no' || valLower === 'false' || valLower === 'off') {
            mostrarDolar = false;
            break;
          }
          mostrarDolar = true;
          if (directiveVal.includes('=')) {
            const [namePart, ratePart] = directiveVal.split('=');
            if (namePart?.trim()) nombreDolar = namePart.trim();
            const rate = parseLocalizedNumber(ratePart || '');
            if (rate > 0) cotizacionDolar = rate;
          } else {
            const rate = parseLocalizedNumber(directiveVal);
            if (rate > 0) cotizacionDolar = rate;
          }
          break;
        }

        case 'gasto': {
          if (!directiveVal.includes('=')) {
            diagnostics.push({
              line: lineNum,
              type: 'warning',
              message: `El gasto debe tener formato "@gasto: Nombre = $ Monto".`
            });
            break;
          }
          const [namePart, valPart] = directiveVal.split('=');
          const gastoNombre = namePart.trim();
          const isPct = valPart.includes('%');
          const gastoVal = parseLocalizedNumber(valPart);

          const existingGastoIdx = gastosConfig.findIndex(
            (g) => normalizeString(g.nombre) === normalizeString(gNombre(gastoNombre))
          );

          if (existingGastoIdx >= 0) {
            gastosConfig[existingGastoIdx] = {
              ...gastosConfig[existingGastoIdx],
              valor: gastoVal,
              modalidad: isPct ? 'porcentual' : 'monto_fijo',
              aplica: true
            };
          } else {
            gastosConfig.push({
              id: `gasto-dsl-${crypto.randomUUID().slice(0, 8)}`,
              costoIndirectoId: `custom-dsl-${crypto.randomUUID().slice(0, 8)}`,
              nombre: gNombre(gastoNombre),
              destino: 'costo_indirecto',
              modalidad: isPct ? 'porcentual' : 'monto_fijo',
              valor: gastoVal,
              aplica: true
            });
          }
          break;
        }

        default:
          diagnostics.push({
            line: lineNum,
            type: 'warning',
            message: `Directiva desconocida "@${directiveKey}".`
          });
          break;
      }
      return;
    }

    // ─── 2. CAPÍTULOS (# o ##) ───────────────────────────────────────────────
    if (line.startsWith('#')) {
      const title = line.replace(/^#+/, '').trim();
      if (!title) {
        diagnostics.push({
          line: lineNum,
          type: 'warning',
          message: 'Capítulo sin nombre especificado.'
        });
        return;
      }

      // Buscar si existía ya un capítulo con este nombre para reusar ID
      const existing = context.existingCapitulos?.find(
        (c) => normalizeString(c.nombre) === normalizeString(title)
      );
      const capId = existing?.id || `cap-${crypto.randomUUID().slice(0, 8)}`;
      currentCapituloId = capId;
      capitulos.push({ id: capId, nombre: title });
      diagnostics.push({
        line: lineNum,
        type: 'info',
        message: `Capítulo "${title}" registrado.`
      });
      return;
    }

    // ─── 3. ÍTEMS / PARTIDAS (- Cantidad Unidad * Descripción) ───────────────
    if (line.startsWith('-') || line.startsWith('*') || /^\d/.test(line)) {
      const cleanItemLine = line.replace(/^[-*]\s*/, '').trim();

      // Regex para extraer: [cantidad] [unidad] [*] ["descripción"] [@condicion: c] [= $ precio]
      // Ejemplo: 25 u * "Boca de Iluminación" @condicion: dificultosa = $ 45.000
      const match = cleanItemLine.match(
        /^(\d+(?:[\.,]\d+)?)\s*([a-zA-ZáéíóúÁÉÍÓÚ°/²³]+)?\s*(?:\*|x)?\s*["']?([^@=\n\r]+?)["']?\s*(?:@condicion:\s*(\w+))?\s*(?:=\s*(?:(?:\$|\$ARS|ARS)?\s*([\d\.,]+)))?$/
      );

      if (!match) {
        diagnostics.push({
          line: lineNum,
          type: 'error',
          message: `Sintaxis de partida no reconocida. Usa: "- 10 u * Boca de Iluminación"`
        });
        return;
      }

      const rawQty = match[1];
      const rawUnit = match[2] || 'u';
      const rawDesc = match[3].trim();
      const rawCond = match[4]?.trim().toLowerCase();
      const rawPrice = match[5];

      const cantidad = parseLocalizedNumber(rawQty) || 1;
      const precioManual = rawPrice ? parseLocalizedNumber(rawPrice) : undefined;
      const condicion = (rawCond === 'favorable' || rawCond === 'dificultosa') ? rawCond : 'normal';

      // Matching con TareaTipo
      const normalizedDesc = normalizeString(rawDesc);
      let matchedTarea: TareaTipo | undefined = tareasMap.get(normalizedDesc);

      if (!matchedTarea) {
        // Búsqueda aproximada si contiene la palabra clave
        matchedTarea = context.tareasTipo.find((t) => {
          const tNorm = normalizeString(t.nombre);
          return tNorm.includes(normalizedDesc) || normalizedDesc.includes(tNorm);
        });
      }

      if (matchedTarea) {
        // Encontró trabajo tipo en catálogo
        const costData = calcularCostoTareaTipo(matchedTarea, context.insumosMap, context.manoObraMap, {
          tipoFactura,
          alicuotaIVADefault: context.config?.alicuotaIVAPorDefecto ?? 21
        });

        const costoUnitarioDirecto = costData.costoDirectoUnitario;
        const costoInsumos = costData.costoInsumosUnitario;
        const costoMO = costData.costoManoObraUnitario;
        const costoServicios = costData.costoServiciosUnitario ?? (matchedTarea.honorarioBase || matchedTarea.costoServicioDirecto || 0);

        // Reusar ID si ya existía este ítem en el estado previo
        const existingItem = context.existingItems?.find(
          (it) => it.tareaTipoId === matchedTarea?.id && it.capituloId === currentCapituloId
        );

        const newItem: ItemPresupuesto = {
          id: existingItem?.id || `item-dsl-${crypto.randomUUID().slice(0, 8)}`,
          capituloId: currentCapituloId,
          tareaTipoId: matchedTarea.id,
          descripcion: matchedTarea.nombre,
          cantidad,
          unidad: rawUnit || matchedTarea.unidad || 'u',
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
          line: lineNum,
          type: 'info',
          message: `✓ Vinculado con catálogo: "${matchedTarea.nombre}" (${cantidad} ${newItem.unidad})`
        });
      } else {
        // Tarea directa no encontrada en catálogo -> Ítem personalizado
        const directCost = precioManual || 0;
        const newItem: ItemPresupuesto = {
          id: `item-dsl-${crypto.randomUUID().slice(0, 8)}`,
          capituloId: currentCapituloId,
          descripcion: rawDesc,
          cantidad,
          unidad: rawUnit || 'u',
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
          line: lineNum,
          type: 'info',
          message: `Partida personalizada: "${rawDesc}" (${cantidad} ${rawUnit})`
        });
      }
      return;
    }

    // Línea no procesable
    diagnostics.push({
      line: lineNum,
      type: 'warning',
      message: `Línea ignorada: "${line}". Prefija partidas con "-" o capítulos con "#".`
    });
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

function gNombre(raw: string): string {
  return raw.replace(/["']/g, '').trim();
}

/**
 * Plantilla de ejemplo precargada para que el usuario aprenda la sintaxis en un clic
 */
export function generateExampleDSL(clienteDemo?: Cliente): string {
  const clienteName = clienteDemo?.razonSocial || clienteDemo?.nombre || 'Estudio Arq. Federico Gómez';
  return [
    `@cliente: ${clienteName}`,
    `@obra: Thames 1850, Piso 4 - Palermo`,
    `@factura: Factura A`,
    `@validez: 15 dias`,
    `@margen: 35%`,
    `@riesgo: medio`,
    `@dolar: Dólar MEP = 1250`,
    ``,
    `# 1. Acometida y Tablero Principal`,
    `- 1 u * Gabinete Modular Embutir 24 Polos`,
    `- 2 u * Disyuntor Diferencial 2x40A 30mA`,
    `- 8 u * Termomagnética Bipolar 16A`,
    ``,
    `# 2. Distribución y Bocas`,
    `- 32 u * Boca de Iluminación Techo / Pared`,
    `- 24 u * Tomacorriente Doble con Tierra`,
    `- 1 u * Medición de Puesta a Tierra con Telurímetro`,
    ``,
    `// Gastos y Logística`,
    `@gasto: Flete y Logística de Materiales = $ 45.000`
  ].join('\n');
}
