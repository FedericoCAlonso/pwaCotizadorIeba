import { Presupuesto, Contacto, AppConfig } from './types';
import { formatARS, formatUSD, roundMoney, safeNum } from './calculations';

export const DEFAULT_WHATSAPP_TEMPLATE_GENERIC = `⚡ *PRESUPUESTO ELÉCTRICO*
👤 *Cliente:* {{cliente_nombre}}
📅 *Fecha:* {{fecha}} (Validez: {{validez_dias}} días)

🔧 *TRABAJOS A REALIZAR:*
{{lista_items}}

💰 *TOTAL:* *{{total_ars}}*
💳 *Condiciones:* {{condiciones_pago}}

*{{prestador_nombre}}*
📞 {{prestador_telefono}}`;

export const DEFAULT_WHATSAPP_TEMPLATE_VAITTY = `*COTIZACIÓN DE SERVICIO - VAITTY*
*ID SERVICIO:* [Pegar ID]
*PRESTADOR:* {{prestador_nombre}}
*CLIENTE:* [Nombre]
*DIRECCIÓN:* [Dirección]

*DETALLE DEL TRABAJO:*
{{lista_items}}

*OBSERVACIONES:*
{{observaciones}}

*PRESUPUESTO:*
• Costo de Materiales: {{precio_materiales}}
• Costo de Mano de Obra: {{precio_mano_obra}}
• Subtotal: {{total_ars}}
*TOTAL FINAL:* {{total_ars}}

*GARANTÍA:* {{garantia}}
*DISPONIBILIDAD:* A coordinar con el cliente.`;

export interface VariablePlantillaWhatsApp {
  tag: string;
  etiqueta: string;
  descripcion: string;
  ejemplo: string;
}

export const VARIABLES_WHATSAPP_DISPONIBLES: VariablePlantillaWhatsApp[] = [
  { tag: '{{cliente_nombre}}', etiqueta: 'Nombre Cliente', descripcion: 'Nombre o razón social del cliente', ejemplo: 'Juan Pérez' },
  { tag: '{{cliente_direccion}}', etiqueta: 'Dirección Cliente / Obra', descripcion: 'Dirección o ubicación de la obra', ejemplo: 'Av. Corrientes 1234' },
  { tag: '{{obra_direccion}}', etiqueta: 'Ubicación Obra', descripcion: 'Dirección específica de la obra presupuestada', ejemplo: 'Thames 1850, Palermo' },
  { tag: '{{cliente_telefono}}', etiqueta: 'Teléfono Cliente', descripcion: 'Teléfono del cliente', ejemplo: '11 5555-1234' },
  { tag: '{{numero_presupuesto}}', etiqueta: 'N° Cotización', descripcion: 'Identificador correlativo del presupuesto', ejemplo: 'IEBA-2026-1001' },
  { tag: '{{id_servicio}}', etiqueta: 'ID Servicio', descripcion: 'Número de cotización o ID de servicio de plataforma', ejemplo: 'IEBA-2026-1001' },
  { tag: '{{fecha}}', etiqueta: 'Fecha', descripcion: 'Fecha de emisión formateada', ejemplo: '28/08/2026' },
  { tag: '{{validez_dias}}', etiqueta: 'Validez (Días)', descripcion: 'Días de validez de la oferta', ejemplo: '15' },
  { tag: '{{prestador_nombre}}', etiqueta: 'Prestador / Empresa', descripcion: 'Nombre de la empresa o electricista emisor', ejemplo: 'IEBA — Instalaciones Eléctricas' },
  { tag: '{{prestador_matricula}}', etiqueta: 'CUIT / Matrícula', descripcion: 'CUIT o matrícula profesional', ejemplo: '20-34567890-9' },
  { tag: '{{prestador_telefono}}', etiqueta: 'Teléfono Prestador', descripcion: 'Teléfono del electricista/empresa', ejemplo: '+54 9 11 5555-1234' },
  { tag: '{{prestador_email}}', etiqueta: 'Email Prestador', descripcion: 'Email de contacto', ejemplo: 'contacto@ieba.com.ar' },
  { tag: '{{lista_items}}', etiqueta: 'Partidas (Viñetas)', descripcion: 'Lista simple de partidas con cantidad y descripción', ejemplo: '• 1 u - Reemplazo de disyuntor' },
  { tag: '{{lista_items_con_precio}}', etiqueta: 'Partidas con Precio', descripcion: 'Lista de partidas con precio de venta al cliente', ejemplo: '• 1 u - Reemplazo de disyuntor: $ 45.000' },
  { tag: '{{precio_materiales}}', etiqueta: 'Precio Materiales ($)', descripcion: 'Total de insumos con coeficiente K (GG, beneficio e impuestos distribuidos)', ejemplo: '$ 45.000' },
  { tag: '{{precio_mano_obra}}', etiqueta: 'Precio Mano Obra ($)', descripcion: 'Total de mano de obra con coeficiente K distribuido', ejemplo: '$ 60.000' },
  { tag: '{{precio_servicios}}', etiqueta: 'Precio Servicios ($)', descripcion: 'Total de servicios tercerizados con coeficiente K distribuido', ejemplo: '$ 15.000' },
  { tag: '{{subtotal_neto}}', etiqueta: 'Subtotal sin IVA ($)', descripcion: 'Subtotal antes de impuestos para Factura A', ejemplo: '$ 86.776,86' },
  { tag: '{{monto_iva}}', etiqueta: 'Monto IVA ($)', descripcion: 'Monto de IVA discriminado si aplica', ejemplo: '$ 18.223,14' },
  { tag: '{{total_ars}}', etiqueta: 'Total Final ($)', descripcion: 'Monto total final en pesos argentinos', ejemplo: '$ 105.000' },
  { tag: '{{total_usd}}', etiqueta: 'Total en USD (u$s)', descripcion: 'Total expresado en dólares estadounidenses si está activo', ejemplo: 'u$s 77,78' },
  { tag: '{{condiciones_pago}}', etiqueta: 'Condiciones de Pago', descripcion: 'Notas y modalidades de pago', ejemplo: '50% anticipo y 50% al finalizar' },
  { tag: '{{observaciones}}', etiqueta: 'Observaciones / Notas', descripcion: 'Aclaraciones técnicas o de alcance de obra', ejemplo: 'Instalación ejecutada bajo normas AEA 90364' },
  { tag: '{{garantia}}', etiqueta: 'Garantía', descripcion: 'Plazo y alcance de la garantía', ejemplo: '90 días sobre mano de obra instalada' },
  { tag: '{{anticipo_sugerido}}', etiqueta: 'Anticipo Sugerido ($)', descripcion: 'Monto equivalente al 100% de insumos para congelar precio', ejemplo: '$ 45.000' }
];

/**
 * Limpia y normaliza un número de teléfono para enlaces de WhatsApp (wa.me).
 */
export function limpiarNumeroTelefonoWhatsApp(tel?: string): string {
  if (!tel) return '';
  let clean = tel.replace(/[^0-9]/g, '');
  if (!clean) return '';
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  // Formato Argentina si no tiene código de país
  if (!clean.startsWith('54')) {
    if (clean.length === 10) {
      clean = `549${clean}`;
    } else if (clean.length === 8) {
      clean = `54911${clean}`;
    }
  }
  return clean;
}

/**
 * Normaliza y limpia emojis con Selectores de Variación (Variation Selector-16 \\uFE0F)
 * y combinaciones compuestas que causan que WhatsApp Web o navegadores en Windows/Linux
 * muestren cuadros vacíos, signos de interrogación o dobles glifos rotos.
 */
export function sanitizarEmojisWhatsApp(texto: string): string {
  if (!texto) return '';

  return texto
    // Reemplazar emojis compuestos/con selector de variación por variantes atómicas universales
    .replace(/🗓️|🗓/g, '📅')
    .replace(/🛠️|🛠/g, '🔧')
    .replace(/⚡️/g, '⚡')
    .replace(/✏️|✏/g, '📝')
    .replace(/⚙️|⚙/g, '⚙')
    .replace(/✂️|✂/g, '✂')
    .replace(/✉️|✉/g, '📧')
    .replace(/▶️/g, '▶')
    .replace(/◀️/g, '◀')
    .replace(/✔️/g, '✅')
    .replace(/▪️|▫️/g, '•')
    // Eliminar cualquier Variation Selector (U+FE0E y U+FE0F) huérfano
    .replace(/[\uFE0E\uFE0F]/g, '');
}

/**
 * Genera un enlace directo https://wa.me/... con el texto pre-cargado y sanitizado.
 */
export function generarEnlaceWhatsApp(telefono: string | undefined, mensaje: string): string {
  const cleanPhone = limpiarNumeroTelefonoWhatsApp(telefono);
  const cleanMessage = sanitizarEmojisWhatsApp(mensaje);
  const encodedText = encodeURIComponent(cleanMessage);
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Genera el texto final del mensaje de WhatsApp para una cotización,
 * resolviendo la jerarquía de plantillas (Custom -> Cliente -> Config Global -> Default Generic)
 * y sustituyendo todas las variables con cálculo matemático exacto.
 */
export function generarMensajeWhatsAppCotizacion(
  presupuesto: Presupuesto,
  cliente?: Contacto | null,
  config?: AppConfig | null,
  templateOverride?: string
): string {
  // 1. Resolver la plantilla adecuada
  const rawTemplate =
    templateOverride?.trim() ||
    cliente?.plantillaWhatsAppPersonalizada?.trim() ||
    config?.plantillaWhatsAppDefault?.trim() ||
    DEFAULT_WHATSAPP_TEMPLATE_GENERIC;

  // 2. Cálculos económicos con distribución por coeficiente K
  const totalARS = safeNum(presupuesto.totalARS);
  const k = safeNum(presupuesto.coeficienteK) || 1;
  const costoInsumos = safeNum(presupuesto.subtotalInsumos);
  const costoMO = safeNum(presupuesto.subtotalManoObra);
  const costoServicios = safeNum(presupuesto.subtotalServiciosTercerizados);

  const precioMaterialesNum = roundMoney(costoInsumos * k);
  const precioManoObraNum = roundMoney(costoMO * k);
  const precioServiciosNum = roundMoney(costoServicios * k);

  const precioMaterialesStr = formatARS(precioMaterialesNum);
  const precioManoObraStr = formatARS(precioManoObraNum);
  const precioServiciosStr = formatARS(precioServiciosNum);
  const totalArsStr = formatARS(totalARS);

  // 3. Detalle de partidas
  const items = presupuesto.items || [];
  const listaItemsStr = items
    .map(it => `• ${it.cantidad || 1} ${it.unidad || 'u'} - ${it.descripcion}`)
    .join('\n');

  const listaItemsConPrecioStr = items
    .map(it => {
      const pUnit = it.precioVentaClienteUnitario ?? it.precioVentaUnitario ?? 0;
      const pTotal = it.precioVentaClienteTotal ?? it.precioVentaTotal ?? ((it.cantidad || 1) * pUnit);
      return `• ${it.cantidad || 1} ${it.unidad || 'u'} - ${it.descripcion}: ${formatARS(pTotal)}`;
    })
    .join('\n');

  // 4. Fechas y plazos
  const fechaStr = presupuesto.fechaEmision
    ? new Date(presupuesto.fechaEmision).toLocaleDateString('es-AR')
    : new Date().toLocaleDateString('es-AR');
  const validezDiasStr = String(presupuesto.validezDias || config?.validezDiasPorDefecto || 15);

  // 5. Datos de empresa y cliente
  const prestadorNombre = config?.nombreEmpresa || 'IEBA — Instalaciones Eléctricas';
  const prestadorMatricula = config?.cuit || '';
  const prestadorTelefono = config?.telefono || '';
  const prestadorEmail = config?.email || '';

  const clienteNombre = cliente?.razonSocial || cliente?.nombre || 'Cliente';
  const clienteDireccion = presupuesto.direccionObra || cliente?.direccion || '';
  const clienteTelefono = cliente?.telefono || '';

  const condicionesPago =
    presupuesto.opcionesEmision?.condicionesComerciales ||
    presupuesto.condicionesPagoTexto ||
    '50% anticipo para inicio y compra de materiales, 50% saldo contra entrega de obra.';

  const observaciones =
    presupuesto.opcionesEmision?.condicionesComerciales ||
    presupuesto.condicionesPagoTexto ||
    'Trabajos realizados bajo reglamentación AEA 90364 con materiales normalizados IRAM.';

  const garantia = '90 días sobre mano de obra instalada.';
  const anticipoSugerido = formatARS(costoInsumos > 0 ? precioMaterialesNum : roundMoney(totalARS * 0.5));

  // USD Reference
  let totalUsdStr = '';
  if (presupuesto.mostrarReferenciaMonedaExtranjera && presupuesto.cotizacionMonedaExtranjera) {
    const usdVal = presupuesto.totalMonedaExtranjera || (totalARS / presupuesto.cotizacionMonedaExtranjera);
    totalUsdStr = `u$s ${usdVal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (config?.mostrarDolarPorDefecto && config.dolarReferenciaValor) {
    const usdVal = totalARS / config.dolarReferenciaValor;
    totalUsdStr = `u$s ${usdVal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const subtotalNetoStr = formatARS(presupuesto.subtotalSinImpuestos || totalARS);
  const montoIvaStr = presupuesto.montoImpuestosTotal ? formatARS(presupuesto.montoImpuestosTotal) : '';

  // 6. Diccionario de reemplazo de tags
  const replacements: Record<string, string> = {
    '{{cliente_nombre}}': clienteNombre,
    '{{cliente_direccion}}': clienteDireccion,
    '{{obra_direccion}}': clienteDireccion,
    '{{cliente_telefono}}': clienteTelefono,
    '{{numero_presupuesto}}': presupuesto.numero || '',
    '{{id_servicio}}': presupuesto.numero || '',
    '{{fecha}}': fechaStr,
    '{{validez_dias}}': validezDiasStr,
    '{{prestador_nombre}}': prestadorNombre,
    '{{prestador_matricula}}': prestadorMatricula,
    '{{prestador_telefono}}': prestadorTelefono,
    '{{prestador_email}}': prestadorEmail,
    '{{lista_items}}': listaItemsStr,
    '{{lista_items_con_precio}}': listaItemsConPrecioStr,
    '{{precio_materiales}}': precioMaterialesStr,
    '{{precio_mano_obra}}': precioManoObraStr,
    '{{precio_servicios}}': precioServiciosStr,
    '{{subtotal_neto}}': subtotalNetoStr,
    '{{monto_iva}}': montoIvaStr,
    '{{total_ars}}': totalArsStr,
    '{{total_usd}}': totalUsdStr,
    '{{condiciones_pago}}': condicionesPago =="" ? 'Contado' : condicionesPago,
    '{{observaciones}}': observaciones,
    '{{garantia}}': garantia,
    '{{anticipo_sugerido}}': anticipoSugerido
  };

  let rendered = rawTemplate;
  for (const [tag, value] of Object.entries(replacements)) {
    const regex = new RegExp(tag.replace(/[{}]/g, '\\$&'), 'gi');
    rendered = rendered.replace(regex, value);
  }

  return sanitizarEmojisWhatsApp(rendered.trim());
}

export interface MaterialConsolidadoItem {
  nombre: string;
  unidad: string;
  cantidadTotal: number;
  costoUnitario: number;
  subtotal: number;
}

/**
 * Agrupa y consolida todos los insumos de todas las partidas de un presupuesto.
 */
export function consolidarMaterialesPresupuesto(items: any[]): MaterialConsolidadoItem[] {
  const map = new Map<string, MaterialConsolidadoItem>();
  (items || []).forEach((it) => {
    (it.insumosSnapshot || []).forEach((ins: any) => {
      const key = `${ins.materialId || ins.insumoId || ins.nombre}_${ins.unidad || 'u'}`;
      const existing = map.get(key);
      const cant = ins.cantidadTotal || 1;
      const sub = ins.subtotalInsumo || 0;
      if (existing) {
        existing.cantidadTotal += cant;
        existing.subtotal += sub;
        if (existing.cantidadTotal > 0) {
          existing.costoUnitario = existing.subtotal / existing.cantidadTotal;
        }
      } else {
        map.set(key, {
          nombre: ins.nombre,
          unidad: ins.unidad || 'u',
          cantidadTotal: cant,
          costoUnitario: ins.precioUnitarioCongelado || (cant > 0 ? sub / cant : 0),
          subtotal: sub
        });
      }
    });
  });
  return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Genera el texto para enviar la lista consolidada de compras a un proveedor / distribuidor por WhatsApp.
 */
export function generarMensajeWhatsAppListaMateriales(
  presupuesto: Presupuesto,
  cliente?: Contacto | null,
  config?: AppConfig | null,
  incluirPrecios: boolean = false
): string {
  const materiales = consolidarMaterialesPresupuesto(presupuesto.items || []);
  const fechaStr = presupuesto.fechaEmision
    ? new Date(presupuesto.fechaEmision).toLocaleDateString('es-AR')
    : new Date().toLocaleDateString('es-AR');
  const clienteNombre = cliente?.razonSocial || cliente?.nombre || 'General';
  const prestadorNombre = config?.nombreEmpresa || 'IEBA — Instalaciones Eléctricas';

  let listado = '';
  if (materiales.length === 0) {
    listado = '• No se registraron materiales detallados.';
  } else {
    listado = materiales
      .map(
        (m) =>
          `• ${m.cantidadTotal} ${m.unidad} - ${m.nombre}${
            incluirPrecios ? ` (${formatARS(m.costoUnitario)} c/u = ${formatARS(m.subtotal)})` : ''
          }`
      )
      .join('\n');
  }

  let text = `📦 *PEDIDO / LISTA DE MATERIALES*\n` +
    `📋 *Cotización Ref.:* ${presupuesto.numero}\n` +
    `👤 *Cliente / Obra:* ${clienteNombre}\n` +
    `📅 *Fecha:* ${fechaStr}\n\n` +
    `🔧 *DETALLE DE INSUMOS A COTIZAR/ADQUIRIR:*\n` +
    `${listado}\n\n`;

  if (incluirPrecios) {
    text += `💰 *Total Estimado Materiales:* *${formatARS(presupuesto.subtotalInsumos || 0)}*\n\n`;
  }

  text += `*${prestadorNombre}*\n` +
    (config?.telefono ? `📞 ${config.telefono}` : '');

  return sanitizarEmojisWhatsApp(text.trim());
}
