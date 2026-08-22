import { Presupuesto, Cliente, Contacto, AppConfig } from './types';
import { formatARS } from './calculations';

export const exportPresupuestoToXLSX = async (
  presupuesto: Presupuesto,
  cliente?: Cliente | Contacto | null,
  config?: AppConfig | null
) => {
  const ExcelModule = await import('exceljs');
  const ExcelJS = ExcelModule.default || ExcelModule;
  const wb = new ExcelJS.Workbook();
  wb.creator = config?.nombreEmpresa || 'Cotizador Eléctrico IEBA';
  wb.created = new Date();

  const isFacturaA = presupuesto.tipoFactura === 'Factura A';
  const mostrarDetalle = presupuesto.opcionesEmision?.mostrarDetalleCostos ?? false;
  const mostrarItemizado = presupuesto.opcionesEmision?.mostrarItemizado ?? true;

  // Corporate styling colors
  const COLOR_HEADER_BG = 'FF0F172A'; // Slate 900
  const COLOR_HEADER_TEXT = 'FFFFFFFF'; // White
  const COLOR_ACCENT_BG = 'FFF59E0B'; // Amber 500
  const COLOR_ACCENT_TEXT = 'FFFFFFFF';
  const COLOR_SECTION_BG = 'FFE2E8F0'; // Slate 200
  const COLOR_SUBSECTION_BG = 'FFF1F5F9'; // Slate 100
  const COLOR_TOTAL_BG = 'FFFEF3C7'; // Amber 100
  const BORDER_THIN = {
    top: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } }
  };
  const BORDER_HEADER = {
    top: { style: 'medium' as const, color: { argb: 'FF0F172A' } },
    left: { style: 'thin' as const, color: { argb: 'FF0F172A' } },
    bottom: { style: 'medium' as const, color: { argb: 'FF0F172A' } },
    right: { style: 'thin' as const, color: { argb: 'FF0F172A' } }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 1: PRESUPUESTO COMERCIAL (PRESENTACIÓN AL CLIENTE)
  // ══════════════════════════════════════════════════════════════════════════
  const wsComercial = wb.addWorksheet('Presupuesto Comercial');
  wsComercial.views = [{ showGridLines: true }];

  wsComercial.columns = [
    { width: 6 },  // A: #
    { width: 48 }, // B: Descripción / Partida
    { width: 12 }, // C: Unidad
    { width: 14 }, // D: Cantidad
    { width: 24 }, // E: Precio Unitario
    { width: 24 }  // F: Subtotal
  ];

  // Membrete Emisor
  const emisorNombre = config?.nombreEmpresa || 'IEBA - INSTALACIONES ELÉCTRICAS';
  const emisorSubtitulo = config?.subtituloEmpresa || 'Soluciones e Ingeniería Eléctrica';
  
  const r1 = wsComercial.addRow([emisorNombre]);
  r1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFD97706' } };

  const r2 = wsComercial.addRow([emisorSubtitulo]);
  r2.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };

  if (config?.cuit || config?.telefono || config?.email) {
    const datosEmisor = [
      config.cuit ? `CUIT: ${config.cuit}` : '',
      config.telefono ? `Tel/WA: ${config.telefono}` : '',
      config.email ? `Email: ${config.email}` : '',
      config.direccion ? `Dir: ${config.direccion}` : ''
    ].filter(Boolean).join(' | ');
    const r3 = wsComercial.addRow([datosEmisor]);
    r3.font = { name: 'Arial', size: 9, color: { argb: 'FF64748B' } };
  }

  wsComercial.addRow([]); // Blank

  // Cuadro Datos Cotización & Cliente
  const titleRow = wsComercial.addRow([
    `PRESUPUESTO Nº: ${presupuesto.numero}`, '', '',
    'FECHA EMISIÓN:', new Date(presupuesto.fechaEmision).toLocaleDateString('es-AR')
  ]);
  titleRow.font = { name: 'Arial', size: 11, bold: true };

  const clientRow1 = wsComercial.addRow([
    'Cliente:', cliente?.nombre || 'General / Consumidor Final', '',
    'CUIT / DNI:', cliente?.cuitDni || 'S/D'
  ]);
  clientRow1.font = { name: 'Arial', size: 10 };

  const clientRow2 = wsComercial.addRow([
    'Condición IVA:', cliente?.condicionIVA || 'Consumidor Final', '',
    'Validez de la Oferta:', `${presupuesto.validezDias || 15} días`
  ]);
  clientRow2.font = { name: 'Arial', size: 10 };

  if (presupuesto.tipoFactura) {
    const facturaRow = wsComercial.addRow([
      'Tipo de Comprobante:', presupuesto.tipoFactura, '',
      'Estado:', (presupuesto.estado || 'borrador').toUpperCase()
    ]);
    facturaRow.font = { name: 'Arial', size: 10 };
  }

  wsComercial.addRow([]); // Blank

  // Encabezados de Tabla Comercial
  const tableHeaderRow = wsComercial.addRow([
    '#',
    'Descripción / Partida a Ejecutar',
    'Unidad',
    'Cantidad',
    isFacturaA ? 'Precio Unitario Neto ARS' : 'Precio Unitario ARS',
    isFacturaA ? 'Subtotal Neto ARS' : 'Subtotal ARS'
  ]);
  tableHeaderRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR_HEADER_TEXT } };
  tableHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  tableHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
  tableHeaderRow.height = 24;

  // Filas de Partidas
  if (mostrarItemizado) {
    presupuesto.items.forEach((item, idx) => {
      const pUnit = isFacturaA
        ? (item.subtotalItem && item.cantidad ? item.subtotalItem / item.cantidad : (item.precioVentaClienteUnitario ?? item.precioVentaUnitario ?? 0))
        : (item.precioVentaClienteUnitario ?? item.precioVentaUnitario ?? 0);
      const pTotal = isFacturaA
        ? (item.subtotalItem ?? item.precioVentaClienteTotal ?? item.precioVentaTotal ?? ((item.cantidad || 1) * pUnit))
        : (item.precioVentaClienteTotal ?? item.precioVentaTotal ?? ((item.cantidad || 1) * pUnit));

      const desc = item.notasTecnicas ? `${item.descripcion}\nNotas: ${item.notasTecnicas}` : item.descripcion;

      const itemRow = wsComercial.addRow([
        idx + 1,
        desc,
        item.unidad || 'u',
        item.cantidad,
        pUnit,
        pTotal
      ]);
      itemRow.font = { name: 'Arial', size: 10 };
      itemRow.getCell(1).alignment = { horizontal: 'center' };
      itemRow.getCell(3).alignment = { horizontal: 'center' };
      itemRow.getCell(4).alignment = { horizontal: 'right' };
      itemRow.getCell(4).numFmt = '#,##0.00';
      itemRow.getCell(5).alignment = { horizontal: 'right' };
      itemRow.getCell(5).numFmt = '"$"#,##0.00';
      itemRow.getCell(6).alignment = { horizontal: 'right' };
      itemRow.getCell(6).numFmt = '"$"#,##0.00';

      for (let c = 1; c <= 6; c++) {
        itemRow.getCell(c).border = BORDER_THIN;
      }
    });
  } else {
    const globalRow = wsComercial.addRow([
      1,
      'Provisión de materiales y mano de obra para instalaciones eléctricas según relevamiento',
      'gl',
      1,
      presupuesto.subtotalSinImpuestos || presupuesto.totalARS,
      presupuesto.subtotalSinImpuestos || presupuesto.totalARS
    ]);
    globalRow.font = { name: 'Arial', size: 10 };
    globalRow.getCell(1).alignment = { horizontal: 'center' };
    globalRow.getCell(3).alignment = { horizontal: 'center' };
    globalRow.getCell(4).numFmt = '#,##0.00';
    globalRow.getCell(5).numFmt = '"$"#,##0.00';
    globalRow.getCell(6).numFmt = '"$"#,##0.00';
    for (let c = 1; c <= 6; c++) {
      globalRow.getCell(c).border = BORDER_THIN;
    }
  }

  wsComercial.addRow([]); // Blank

  // Totales Comerciales
  const addTotalRow = (label: string, value: number, isBold = false, isAccent = false) => {
    const row = wsComercial.addRow(['', '', '', '', label, value]);
    row.font = { name: 'Arial', size: isBold ? 11 : 10, bold: isBold };
    row.getCell(5).alignment = { horizontal: 'right' };
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(6).numFmt = '"$"#,##0.00';
    if (isAccent) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
      row.getCell(5).border = BORDER_HEADER;
      row.getCell(6).border = BORDER_HEADER;
    } else {
      row.getCell(5).border = BORDER_THIN;
      row.getCell(6).border = BORDER_THIN;
    }
  };

  if (mostrarDetalle) {
    addTotalRow('1. Subtotal Insumos ARS:', presupuesto.subtotalInsumos || 0);
    addTotalRow('1. Subtotal Mano de Obra ARS:', presupuesto.subtotalManoObra || 0);
    if (presupuesto.subtotalServiciosTercerizados) {
      addTotalRow('1. Servicios Tercerizados ARS:', presupuesto.subtotalServiciosTercerizados);
    }
    addTotalRow('Costo Directo Total (C) ARS:', presupuesto.costoGlobal || presupuesto.subtotalCostosDirectos || 0, true);
    
    // Solo mostrar Gastos Generales si son mayores a 0
    const ggTotal = presupuesto.gastosGeneralesTotal || presupuesto.subtotalCostosIndirectos || 0;
    if (ggTotal > 0) {
      addTotalRow('2. Gastos Generales (GG) ARS:', ggTotal);
    }
    
    addTotalRow(`3. Beneficio (${presupuesto.beneficioPorcentaje ?? presupuesto.margenPorcentaje}%) ARS:`, presupuesto.beneficioMonto || presupuesto.montoGanancia || 0);
    addTotalRow('4. Subtotal sin Impuestos (S) ARS:', presupuesto.subtotalSinImpuestos || (presupuesto.totalARS - (presupuesto.montoImpuestos || 0)), true);
    
    if (presupuesto.montoImpuestosTotal || presupuesto.montoImpuestos) {
      addTotalRow('5. Total Impuestos ARS:', presupuesto.montoImpuestosTotal || presupuesto.montoImpuestos || 0);
    }
  } else {
    if (isFacturaA) {
      addTotalRow('Subtotal Neto Gravado ARS:', presupuesto.subtotalSinImpuestos || (presupuesto.totalARS - (presupuesto.montoImpuestosTotal || 0)));
      addTotalRow('IVA Discriminado ARS:', presupuesto.montoImpuestosTotal || 0);
    } else {
      addTotalRow('Subtotal Trabajos ARS:', presupuesto.totalARS || 0);
    }
  }

  addTotalRow('TOTAL FINAL ARS:', presupuesto.totalARS || 0, true, true);

  if (presupuesto.mostrarReferenciaMonedaExtranjera && presupuesto.cotizacionMonedaExtranjera) {
    const totalUSD = presupuesto.totalMonedaExtranjera || (presupuesto.totalARS / presupuesto.cotizacionMonedaExtranjera);
    const rowUSD = wsComercial.addRow(['', '', '', '', `Ref. ${presupuesto.nombreMonedaExtranjera || 'USD'} (T/C $${presupuesto.cotizacionMonedaExtranjera}):`, totalUSD]);
    rowUSD.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0284C7' } };
    rowUSD.getCell(5).alignment = { horizontal: 'right' };
    rowUSD.getCell(6).alignment = { horizontal: 'right' };
    rowUSD.getCell(6).numFmt = '"u$s"#,##0.00';
  }

  // Esquema de Pagos e Hitos
  if (presupuesto.esquemaPago?.hitos && presupuesto.esquemaPago.hitos.length > 0) {
    wsComercial.addRow([]);
    const hitoHeader = wsComercial.addRow(['ESQUEMA Y CONDICIONES DE PAGO']);
    hitoHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    
    presupuesto.esquemaPago.hitos.forEach((hito) => {
      const hRow = wsComercial.addRow([
        '•',
        `${hito.descripcion} (${hito.porcentaje}%)`,
        hito.medioPagoEsperado || 'Transferencia',
        '',
        'Monto:',
        hito.montoCalculado
      ]);
      hRow.font = { name: 'Arial', size: 9 };
      hRow.getCell(6).numFmt = '"$"#,##0.00';
    });
  }

  // Condiciones Comerciales y Cláusulas Técnicas
  const condiciones = presupuesto.opcionesEmision?.condicionesComerciales || presupuesto.condicionesPagoTexto;
  if (condiciones) {
    wsComercial.addRow([]);
    const condTitle = wsComercial.addRow(['Condiciones Comerciales:']);
    condTitle.font = { name: 'Arial', size: 10, bold: true };
    const condText = wsComercial.addRow([condiciones]);
    condText.font = { name: 'Arial', size: 9, italic: true };
  }

  const clausulas = Array.from(
    new Set(
      presupuesto.items
        .map((i) => i.clausulaExclusiones || i.clausulaTecnica)
        .filter((c): c is string => Boolean(c && c.trim().length > 0))
    )
  );

  if (clausulas.length > 0) {
    wsComercial.addRow([]);
    const cTitle = wsComercial.addRow(['Condiciones Técnicas & Resguardo Constructivo:']);
    cTitle.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF92400E' } };
    clausulas.forEach((c) => {
      const cRow = wsComercial.addRow([`• ${c}`]);
      cRow.font = { name: 'Arial', size: 9, italic: true };
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 2: APU Y DESGLOSE TÉCNICO DETALLADO (ANÁLISIS DE PRECIOS UNITARIOS)
  // ══════════════════════════════════════════════════════════════════════════
  const wsAPU = wb.addWorksheet('APU Detallado');
  wsAPU.views = [{ showGridLines: true }];

  wsAPU.columns = [
    { width: 6 },  // A: #
    { width: 44 }, // B: Insumo / Mano de Obra / Concepto
    { width: 14 }, // C: Cantidad Unit.
    { width: 14 }, // D: Cantidad Total
    { width: 12 }, // E: Unidad
    { width: 20 }, // F: Costo Unitario ARS
    { width: 22 }  // G: Subtotal Costo ARS
  ];

  const apuMainTitle = wsAPU.addRow(['ANÁLISIS DE PRECIOS UNITARIOS (APU) Y CÓMPUTO TÉCNICO']);
  apuMainTitle.font = { name: 'Arial', size: 13, bold: true, color: { argb: COLOR_HEADER_TEXT } };
  apuMainTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  apuMainTitle.height = 24;

  const apuSubTitle = wsAPU.addRow([`Cotización Nº ${presupuesto.numero} - Cliente: ${cliente?.nombre || 'General'}`]);
  apuSubTitle.font = { name: 'Arial', size: 10, italic: true };
  wsAPU.addRow([]);

  presupuesto.items.forEach((item, itemIdx) => {
    // Partida Header
    const itemHeader = wsAPU.addRow([
      `PARTIDA #${itemIdx + 1}: ${item.descripcion}`, '', '', '',
      `Cantidad: ${item.cantidad} ${item.unidad}`, '',
      `Precio Venta Final: ${formatARS(item.precioVentaClienteTotal ?? item.precioVentaTotal)}`
    ]);
    itemHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    itemHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SECTION_BG } };
    itemHeader.height = 22;

    if (item.parametrosTrabajoTipo) {
      const kComp = item.parametrosTrabajoTipo.coeficienteComplejidadTotal;
      const kRow = wsAPU.addRow([
        `Parámetros Complejidad: K_comp = ${kComp.toFixed(2)}x (${item.parametrosTrabajoTipo.estadoAntiguedad} | ${item.parametrosTrabajoTipo.accesibilidad} | ${item.parametrosTrabajoTipo.altura})`
      ]);
      kRow.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
    }

    // Insumos Subtable
    if (item.insumosSnapshot && item.insumosSnapshot.length > 0) {
      const insHeader = wsAPU.addRow(['', '1. Insumos / Materiales Requeridos', 'Cant. Unit.', 'Cant. Total', 'Unidad', 'Costo Unit. ARS', 'Subtotal Insumo ARS']);
      insHeader.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
      insHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SUBSECTION_BG } };

      item.insumosSnapshot.forEach((ins, insIdx) => {
        const insRow = wsAPU.addRow([
          `${itemIdx + 1}.${insIdx + 1}`,
          ins.nombre,
          ins.cantidadUnitaria,
          ins.cantidadTotal,
          ins.unidad || 'u',
          ins.precioUnitarioCongelado,
          ins.subtotalInsumo
        ]);
        insRow.font = { name: 'Arial', size: 9 };
        insRow.getCell(3).numFmt = '#,##0.00';
        insRow.getCell(4).numFmt = '#,##0.00';
        insRow.getCell(6).numFmt = '"$"#,##0.00';
        insRow.getCell(7).numFmt = '"$"#,##0.00';
        for (let c = 1; c <= 7; c++) insRow.getCell(c).border = BORDER_THIN;
      });

      const totalInsRow = wsAPU.addRow(['', 'Subtotal Materiales Partida:', '', '', '', '', item.costoInsumos]);
      totalInsRow.font = { name: 'Arial', size: 9, bold: true };
      totalInsRow.getCell(7).numFmt = '"$"#,##0.00';
      totalInsRow.getCell(7).border = BORDER_THIN;
    }

    // Mano de Obra Subtable
    if (item.manoObraSnapshot && item.manoObraSnapshot.length > 0) {
      const moHeader = wsAPU.addRow(['', '2. Mano de Obra / Categorías Laborales', 'Hs. Unit.', 'Hs. Totales', 'Unidad', 'Tarifa / Hora ARS', 'Subtotal MO ARS']);
      moHeader.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
      moHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SUBSECTION_BG } };

      item.manoObraSnapshot.forEach((mo, moIdx) => {
        const moRow = wsAPU.addRow([
          `${itemIdx + 1}.${moIdx + 1}`,
          mo.nombreCategoria,
          mo.horasUnitarias ?? (item.cantidad > 0 ? mo.horasTotales / item.cantidad : mo.horasTotales),
          mo.horasTotales,
          'hs',
          mo.costoHoraCongelado,
          mo.subtotalManoObra
        ]);
        moRow.font = { name: 'Arial', size: 9 };
        moRow.getCell(3).numFmt = '#,##0.00';
        moRow.getCell(4).numFmt = '#,##0.00';
        moRow.getCell(6).numFmt = '"$"#,##0.00';
        moRow.getCell(7).numFmt = '"$"#,##0.00';
        for (let c = 1; c <= 7; c++) moRow.getCell(c).border = BORDER_THIN;
      });

      const totalMoRow = wsAPU.addRow(['', 'Subtotal Mano de Obra Partida:', '', '', '', '', item.costoManoObra]);
      totalMoRow.font = { name: 'Arial', size: 9, bold: true };
      totalMoRow.getCell(7).numFmt = '"$"#,##0.00';
      totalMoRow.getCell(7).border = BORDER_THIN;
    }

    // Servicios Tercerizados
    if (item.serviciosTercerizados && item.serviciosTercerizados.length > 0) {
      item.serviciosTercerizados.forEach((srv) => {
        const srvRow = wsAPU.addRow(['', `Servicio: ${srv.descripcion} (${srv.nombreProveedor || 'Tercerizado'})`, '', '', 'gl', srv.costo, srv.costo]);
        srvRow.font = { name: 'Arial', size: 9 };
        srvRow.getCell(7).numFmt = '"$"#,##0.00';
      });
    }

    // Resumen APU del Renglón
    const summaryAPU = wsAPU.addRow([
      '',
      `Costo Directo: ${formatARS(item.costoDirectoTotal)} | GG Prorr.: ${formatARS(item.ggAbsolutoProrrateado || 0)} | Margen: ${formatARS(item.beneficioItem || 0)}`,
      '', '', '',
      'Precio de Venta Partida:',
      item.precioVentaClienteTotal ?? item.precioVentaTotal
    ]);
    summaryAPU.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
    summaryAPU.getCell(7).numFmt = '"$"#,##0.00';
    summaryAPU.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };

    wsAPU.addRow([]); // Blank between partidas
  });


  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 3: LISTA CONSOLIDADA DE MATERIALES (BOM / COMPRA PARA DISTRIBUIDOR)
  // ══════════════════════════════════════════════════════════════════════════
  const wsBOM = wb.addWorksheet('Lista de Materiales BOM');
  wsBOM.views = [{ showGridLines: true }];

  wsBOM.columns = [
    { width: 6 },  // A: #
    { width: 45 }, // B: Material / Insumo
    { width: 14 }, // C: Cantidad Total Requerida
    { width: 12 }, // D: Unidad
    { width: 22 }, // E: Costo Unitario Ref. ARS
    { width: 24 }  // F: Subtotal Estimado ARS
  ];

  const bomTitle = wsBOM.addRow(['LISTA CONSOLIDADA DE MATERIALES E INSUMOS (BOM COMPRAS)']);
  bomTitle.font = { name: 'Arial', size: 13, bold: true, color: { argb: COLOR_HEADER_TEXT } };
  bomTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  bomTitle.height = 24;

  const bomSub = wsBOM.addRow([`Materiales necesarios para la ejecución de la Cotización Nº ${presupuesto.numero}`]);
  bomSub.font = { name: 'Arial', size: 10, italic: true };
  wsBOM.addRow([]);

  const bomHeader = wsBOM.addRow([
    '#',
    'Descripción del Material / Insumo',
    'Cantidad Total Requerida',
    'Unidad',
    'Costo Unitario Ref. ARS',
    'Subtotal Estimado ARS'
  ]);
  bomHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR_HEADER_TEXT } };
  bomHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ACCENT_BG } };
  bomHeader.alignment = { vertical: 'middle', horizontal: 'center' };
  bomHeader.height = 22;

  // Consolidar insumos de todas las partidas
  const consolidatedMap = new Map<string, {
    nombre: string;
    unidad: string;
    cantidadTotal: number;
    costoUnitario: number;
    subtotal: number;
  }>();

  presupuesto.items.forEach((it) => {
    (it.insumosSnapshot || []).forEach((ins) => {
      const key = `${ins.materialId || ins.insumoId || ins.nombre}_${ins.unidad || 'u'}`;
      const existing = consolidatedMap.get(key);
      if (existing) {
        existing.cantidadTotal += ins.cantidadTotal;
        existing.subtotal += ins.subtotalInsumo;
        if (existing.cantidadTotal > 0) {
          existing.costoUnitario = existing.subtotal / existing.cantidadTotal;
        }
      } else {
        consolidatedMap.set(key, {
          nombre: ins.nombre,
          unidad: ins.unidad || 'u',
          cantidadTotal: ins.cantidadTotal,
          costoUnitario: ins.precioUnitarioCongelado,
          subtotal: ins.subtotalInsumo
        });
      }
    });
  });

  let bomIdx = 1;
  let totalBOMCost = 0;
  consolidatedMap.forEach((mat) => {
    totalBOMCost += mat.subtotal;
    const bRow = wsBOM.addRow([
      bomIdx++,
      mat.nombre,
      mat.cantidadTotal,
      mat.unidad,
      mat.costoUnitario,
      mat.subtotal
    ]);
    bRow.font = { name: 'Arial', size: 10 };
    bRow.getCell(1).alignment = { horizontal: 'center' };
    bRow.getCell(3).alignment = { horizontal: 'right' };
    bRow.getCell(3).numFmt = '#,##0.00';
    bRow.getCell(4).alignment = { horizontal: 'center' };
    bRow.getCell(5).alignment = { horizontal: 'right' };
    bRow.getCell(5).numFmt = '"$"#,##0.00';
    bRow.getCell(6).alignment = { horizontal: 'right' };
    bRow.getCell(6).numFmt = '"$"#,##0.00';

    for (let c = 1; c <= 6; c++) bRow.getCell(c).border = BORDER_THIN;
  });

  if (consolidatedMap.size === 0) {
    const emptyRow = wsBOM.addRow(['-', 'No se especificaron materiales detallados en esta cotización', 0, 'gl', 0, 0]);
    emptyRow.font = { name: 'Arial', size: 10, italic: true };
  } else {
    const totalBOMRow = wsBOM.addRow(['', 'TOTAL GENERAL DE MATERIALES A ADQUIRIR:', '', '', '', totalBOMCost]);
    totalBOMRow.font = { name: 'Arial', size: 11, bold: true };
    totalBOMRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
    totalBOMRow.getCell(6).numFmt = '"$"#,##0.00';
    totalBOMRow.getCell(5).border = BORDER_HEADER;
    totalBOMRow.getCell(6).border = BORDER_HEADER;
  }


  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 4: GASTOS GENERALES E IMPUESTOS APLICADOS (SOLO LOS ACTIVOS)
  // ══════════════════════════════════════════════════════════════════════════
  const activeIndirects = (presupuesto.costosIndirectosAplicados || []).filter(
    (c) => c.montoCalculado > 0
  );
  const activeTaxes = (presupuesto.impuestosDetalle || []).filter((t) => t.aplica && t.montoCalculado > 0);

  if (activeIndirects.length > 0 || activeTaxes.length > 0) {
    const wsGG = wb.addWorksheet('Gastos e Impuestos');
    wsGG.views = [{ showGridLines: true }];

    wsGG.columns = [
      { width: 6 },  // #
      { width: 42 }, // Concepto
      { width: 20 }, // Tipo / Modalidad
      { width: 18 }, // Valor Aplicado
      { width: 24 }  // Monto Calculado ARS
    ];

    const ggTitle = wsGG.addRow(['GASTOS GENERALES E IMPUESTOS EFECTIVAMENTE APLICADOS']);
    ggTitle.font = { name: 'Arial', size: 13, bold: true, color: { argb: COLOR_HEADER_TEXT } };
    ggTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
    ggTitle.height = 24;

    wsGG.addRow([]);

    if (activeIndirects.length > 0) {
      const gHeader = wsGG.addRow(['#', 'Concepto de Gasto General / Indirecto', 'Tipo', 'Valor Base', 'Monto en Cotización ARS']);
      gHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR_HEADER_TEXT } };
      gHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };

      activeIndirects.forEach((ci, idx) => {
        const row = wsGG.addRow([
          idx + 1,
          ci.nombre,
          ci.tipo === 'porcentual_sobre_costo' ? 'Porcentual sobre Costo (C)' : 'Monto Fijo Asignado',
          ci.tipo === 'porcentual_sobre_costo' ? `${ci.valorAplicado}%` : formatARS(ci.valorAplicado),
          ci.montoCalculado
        ]);
        row.font = { name: 'Arial', size: 10 };
        row.getCell(5).numFmt = '"$"#,##0.00';
        for (let c = 1; c <= 5; c++) row.getCell(c).border = BORDER_THIN;
      });

      const totalGGRow = wsGG.addRow(['', 'Total Gastos Generales (GG):', '', '', presupuesto.gastosGeneralesTotal || 0]);
      totalGGRow.font = { name: 'Arial', size: 10, bold: true };
      totalGGRow.getCell(5).numFmt = '"$"#,##0.00';
    }

    if (activeTaxes.length > 0) {
      wsGG.addRow([]);
      const tHeader = wsGG.addRow(['#', 'Gravamen / Impuesto Aplicado', 'Alicuota', 'Base Imponible', 'Monto Impuesto ARS']);
      tHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR_HEADER_TEXT } };
      tHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };

      activeTaxes.forEach((tx, idx) => {
        const row = wsGG.addRow([
          idx + 1,
          tx.nombre,
          `${tx.porcentaje}%`,
          'Subtotal sin Impuestos (S)',
          tx.montoCalculado
        ]);
        row.font = { name: 'Arial', size: 10 };
        row.getCell(5).numFmt = '"$"#,##0.00';
        for (let c = 1; c <= 5; c++) row.getCell(c).border = BORDER_THIN;
      });

      const totalTaxRow = wsGG.addRow(['', 'Total Impuestos Aplicados:', '', '', presupuesto.montoImpuestosTotal || presupuesto.montoImpuestos || 0]);
      totalTaxRow.font = { name: 'Arial', size: 10, bold: true };
      totalTaxRow.getCell(5).numFmt = '"$"#,##0.00';
    }
  }

  // Generar buffer y disparar descarga
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeNum = (presupuesto.numero || 'cotizacion').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Presupuesto_IEBA_${safeNum}_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const sharePresupuesto = async (presupuesto: Presupuesto, cliente?: Cliente | Contacto | null) => {
  const shareTitle = `Presupuesto IEBA Nº ${presupuesto.numero}`;
  const shareText = `📋 *COTIZACIÓN ELÉCTRICA - IEBA*\n` +
    `Presupuesto Nº: *${presupuesto.numero}*\n` +
    `Cliente: ${cliente?.nombre || 'General'}\n` +
    `Monto Total: *${formatARS(presupuesto.totalARS)}*\n` +
    `Validez: ${presupuesto.validezDias || 15} días.\n\n` +
    `Por favor confirmar aprobación para inicio de obra. ¡Muchas gracias!`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText
      });
      return;
    } catch (err) {
      console.log('Share cancelado o no soportado:', err);
    }
  }

  // Fallback to Clipboard & WhatsApp
  navigator.clipboard.writeText(shareText);
  const waPhone = cliente?.telefono ? cliente.telefono.replace(/[^0-9]/g, '') : '';
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(shareText)}` : `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  window.open(waUrl, '_blank');
};
