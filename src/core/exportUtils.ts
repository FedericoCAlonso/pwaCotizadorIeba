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

  // ─── Estructuración Jerárquica WBS (Work Breakdown Structure) ───
  const capitulosList = (presupuesto.capitulos && presupuesto.capitulos.length > 0)
    ? presupuesto.capitulos
    : [{ id: 'sin_capitulo', nombre: 'Partidas Generales' }];

  const allCapitulos = [...capitulosList];
  const orphanItems = (presupuesto.items || []).filter(
    (it) => !it.capituloId || !allCapitulos.some((c) => c.id === it.capituloId)
  );
  if (orphanItems.length > 0 && !allCapitulos.some((c) => c.id === 'sin_capitulo')) {
    allCapitulos.push({ id: 'sin_capitulo', nombre: 'Partidas Generales' } as any);
  }

  // Pre-computar mapa de numeración WBS: itemId -> { wbs: string, capIndex: number, itemIndex: number, capNombre: string }
  const itemWBSMap = new Map<string, { wbs: string; capIndex: number; itemIndex: number; capNombre: string }>();
  const capituloItemsMap = new Map<string, typeof presupuesto.items>();
  let capCounter = 1;
  allCapitulos.forEach((cap) => {
    const capItems = (presupuesto.items || []).filter((it) => (it.capituloId || 'sin_capitulo') === cap.id);
    if (capItems.length > 0) {
      capituloItemsMap.set(cap.id, capItems);
      const cIdx = capCounter++;
      capItems.forEach((it, iIdx) => {
        itemWBSMap.set(it.id, {
          wbs: `${cIdx}.${iIdx + 1}`,
          capIndex: cIdx,
          itemIndex: iIdx + 1,
          capNombre: cap.nombre
        });
      });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 1: PRESUPUESTO COMERCIAL (PRESENTACIÓN AL CLIENTE)
  // ══════════════════════════════════════════════════════════════════════════
  const wsComercial = wb.addWorksheet('Presupuesto Comercial');
  wsComercial.views = [{ showGridLines: true }];

  wsComercial.columns = [
    { width: 8 },  // A: # WBS
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

  wsComercial.addRow([]); // Blank

  // Encabezados de Tabla Comercial
  const tableHeaderRow = wsComercial.addRow([
    '#',
    'Descripción / Partida a Ejecutar',
    'Unidad',
    'Cantidad',
    'Precio Unitario ARS',
    'Subtotal ARS'
  ]);
  tableHeaderRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR_HEADER_TEXT } };
  tableHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  tableHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
  tableHeaderRow.height = 24;

  // Filas de Partidas agrupadas por Rubro con WBS
  if (mostrarItemizado) {
    allCapitulos.forEach((cap) => {
      const capItems = capituloItemsMap.get(cap.id);
      if (!capItems || capItems.length === 0) return;

      const firstItemWBS = itemWBSMap.get(capItems[0].id);
      const capIdx = firstItemWBS ? firstItemWBS.capIndex : 1;
      const chapterSubtotal = capItems.reduce((acc, it) => {
        const pTotal = it.precioVentaClienteTotal ?? it.precioVentaTotal ?? ((it.cantidad || 1) * (it.precioVentaClienteUnitario ?? it.precioVentaUnitario ?? 0));
        return acc + pTotal;
      }, 0);

      // Fila de Encabezado de Rubro
      const chapterRow = wsComercial.addRow([
        capIdx,
        cap.nombre.toUpperCase(),
        '',
        '',
        '',
        chapterSubtotal
      ]);
      chapterRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      chapterRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SECTION_BG } };
      chapterRow.getCell(1).alignment = { horizontal: 'center' };
      chapterRow.getCell(6).alignment = { horizontal: 'right' };
      chapterRow.getCell(6).numFmt = '"$"#,##0.00';
      for (let c = 1; c <= 6; c++) chapterRow.getCell(c).border = BORDER_THIN;

      // Filas de Ítems del Rubro
      capItems.forEach((item) => {
        const wbsInfo = itemWBSMap.get(item.id);
        const wbsCode = wbsInfo ? wbsInfo.wbs : '';
        const pUnit = item.precioVentaClienteUnitario ?? item.precioVentaUnitario ?? 0;
        const pTotal = item.precioVentaClienteTotal ?? item.precioVentaTotal ?? ((item.cantidad || 1) * pUnit);
        const desc = item.notasTecnicas ? `${item.descripcion}\nNotas: ${item.notasTecnicas}` : item.descripcion;

        const itemRow = wsComercial.addRow([
          wbsCode,
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
    if (presupuesto.montoImpuestosTotal && presupuesto.montoImpuestosTotal > 0) {
      addTotalRow('Subtotal ARS:', presupuesto.subtotalSinImpuestos || (presupuesto.totalARS - presupuesto.montoImpuestosTotal));
      addTotalRow('Total Impuestos / IVA ARS:', presupuesto.montoImpuestosTotal);
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
  // HOJA 2: ESTRUCTURA DE PRECIOS Y CASCADA FINANCIERA (APU COMPLETO)
  // ══════════════════════════════════════════════════════════════════════════
  const wsAPU = wb.addWorksheet('Estructura de Precios (APU)');
  wsAPU.views = [{ showGridLines: true }];

  wsAPU.columns = [
    { width: 8 },  // A: # WBS
    { width: 44 }, // B: Partida / Rubro
    { width: 10 }, // C: Cantidad
    { width: 10 }, // D: Unidad
    { width: 20 }, // E: Costo Directo Unit. ARS
    { width: 22 }, // F: Costo Directo Total ARS
    { width: 12 }, // G: Incidencia %
    { width: 20 }, // H: C. Indirectos ARS
    { width: 20 }, // I: Beneficio ARS
    { width: 20 }, // J: Impuestos ARS
    { width: 24 }  // K: Precio Venta Final ARS
  ];

  const apuMainTitle = wsAPU.addRow(['ESTRUCTURA DE PRECIOS Y CASCADA FINANCIERA (APU)']);
  apuMainTitle.font = { name: 'Arial', size: 13, bold: true, color: { argb: COLOR_HEADER_TEXT } };
  apuMainTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  apuMainTitle.height = 24;

  const apuSubTitle = wsAPU.addRow([`Cotización Nº ${presupuesto.numero} - Cliente: ${cliente?.nombre || 'General'}`]);
  apuSubTitle.font = { name: 'Arial', size: 10, italic: true };
  wsAPU.addRow([]);

  const apuHeaderRow = wsAPU.addRow([
    '#',
    'Descripción / Partida',
    'Cantidad',
    'Unidad',
    'Costo Directo Unit. ARS',
    'Costo Directo Total ARS',
    'Incidencia %',
    'C. Indirectos ARS',
    'Beneficio ARS',
    'Impuestos ARS',
    'Precio Venta Final ARS'
  ]);
  apuHeaderRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR_HEADER_TEXT } };
  apuHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  apuHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
  apuHeaderRow.height = 24;

  allCapitulos.forEach((cap) => {
    const capItems = capituloItemsMap.get(cap.id);
    if (!capItems || capItems.length === 0) return;

    const firstItemWBS = itemWBSMap.get(capItems[0].id);
    const capIdx = firstItemWBS ? firstItemWBS.capIndex : 1;

    const capCDirecto = capItems.reduce((acc, it) => acc + (it.costoDirectoTotal ?? it.costoTotal ?? 0), 0);
    const capInc = capItems.reduce((acc, it) => acc + (it.incidencia ?? 0), 0);
    const capIndirectos = capItems.reduce((acc, it) => acc + (it.ggAbsolutoProrrateado ?? 0) + (it.ggPorcentualItem ?? 0), 0);
    const capBeneficio = capItems.reduce((acc, it) => acc + (it.beneficioItem ?? 0), 0);
    const capImpuestos = capItems.reduce((acc, it) => acc + (it.impuestosItem ?? 0), 0);
    const capPrecioFinal = capItems.reduce((acc, it) => acc + (it.precioFinalItem ?? it.precioVentaTotal ?? 0), 0);

    // Rubro Header Row
    const capRow = wsAPU.addRow([
      capIdx,
      cap.nombre.toUpperCase(),
      '',
      '',
      '',
      capCDirecto,
      capInc,
      capIndirectos,
      capBeneficio,
      capImpuestos,
      capPrecioFinal
    ]);
    capRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    capRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SECTION_BG } };
    capRow.getCell(1).alignment = { horizontal: 'center' };
    capRow.getCell(6).numFmt = '"$"#,##0.00';
    capRow.getCell(7).numFmt = '0.0%';
    capRow.getCell(8).numFmt = '"$"#,##0.00';
    capRow.getCell(9).numFmt = '"$"#,##0.00';
    capRow.getCell(10).numFmt = '"$"#,##0.00';
    capRow.getCell(11).numFmt = '"$"#,##0.00';
    for (let c = 1; c <= 11; c++) capRow.getCell(c).border = BORDER_THIN;

    // Items
    capItems.forEach((it) => {
      const wbs = itemWBSMap.get(it.id)?.wbs || '';
      const cant = it.cantidad || 1;
      const cDirecto = it.costoDirectoTotal ?? it.costoTotal ?? 0;
      const cUnit = it.costoUnitario !== undefined && it.costoUnitario > 0 ? it.costoUnitario : (cDirecto / cant);
      const inc = it.incidencia ?? 0;
      const ind = (it.ggAbsolutoProrrateado ?? 0) + (it.ggPorcentualItem ?? 0);
      const ben = it.beneficioItem ?? 0;
      const imp = it.impuestosItem ?? 0;
      const pFinal = it.precioFinalItem ?? it.precioVentaTotal ?? 0;

      const iRow = wsAPU.addRow([
        wbs,
        it.descripcion,
        cant,
        it.unidad || 'u',
        cUnit,
        cDirecto,
        inc,
        ind,
        ben,
        imp,
        pFinal
      ]);
      iRow.font = { name: 'Arial', size: 9 };
      iRow.getCell(1).alignment = { horizontal: 'center' };
      iRow.getCell(3).alignment = { horizontal: 'right' };
      iRow.getCell(3).numFmt = '#,##0.00';
      iRow.getCell(4).alignment = { horizontal: 'center' };
      iRow.getCell(5).numFmt = '"$"#,##0.00';
      iRow.getCell(6).numFmt = '"$"#,##0.00';
      iRow.getCell(7).numFmt = '0.0%';
      iRow.getCell(8).numFmt = '"$"#,##0.00';
      iRow.getCell(9).numFmt = '"$"#,##0.00';
      iRow.getCell(10).numFmt = '"$"#,##0.00';
      iRow.getCell(11).numFmt = '"$"#,##0.00';
      for (let c = 1; c <= 11; c++) iRow.getCell(c).border = BORDER_THIN;
    });
  });

  // Total General Row
  const totalAPURow = wsAPU.addRow([
    '',
    'TOTAL GENERAL DE LA COTIZACIÓN:',
    '',
    '',
    '',
    presupuesto.subtotalCostosDirectos ?? presupuesto.costoGlobal ?? 0,
    1,
    presupuesto.gastosGeneralesTotal ?? presupuesto.subtotalCostosIndirectos ?? 0,
    presupuesto.beneficioMonto ?? presupuesto.montoGanancia ?? 0,
    presupuesto.montoImpuestosTotal ?? presupuesto.montoImpuestos ?? 0,
    presupuesto.totalARS ?? 0
  ]);
  totalAPURow.font = { name: 'Arial', size: 10, bold: true };
  totalAPURow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
  totalAPURow.getCell(6).numFmt = '"$"#,##0.00';
  totalAPURow.getCell(7).numFmt = '0.0%';
  totalAPURow.getCell(8).numFmt = '"$"#,##0.00';
  totalAPURow.getCell(9).numFmt = '"$"#,##0.00';
  totalAPURow.getCell(10).numFmt = '"$"#,##0.00';
  totalAPURow.getCell(11).numFmt = '"$"#,##0.00';
  for (let c = 1; c <= 11; c++) totalAPURow.getCell(c).border = BORDER_HEADER;

  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 3: MANO DE OBRA (POR RUBRO E ÍTEM)
  // ══════════════════════════════════════════════════════════════════════════
  const wsMO = wb.addWorksheet('Mano de Obra');
  wsMO.views = [{ showGridLines: true }];

  wsMO.columns = [
    { width: 8 },  // A: # WBS
    { width: 36 }, // B: Partida / Rubro
    { width: 30 }, // C: Categoría Laboral
    { width: 14 }, // D: Hs. Unitarias
    { width: 14 }, // E: Hs. Totales
    { width: 20 }, // F: Tarifa / Hora ARS
    { width: 22 }  // G: Subtotal MO ARS
  ];

  const moTitle = wsMO.addRow(['DETALLE DE MANO DE OBRA Y TIEMPOS DE EJECUCIÓN']);
  moTitle.font = { name: 'Arial', size: 13, bold: true, color: { argb: COLOR_HEADER_TEXT } };
  moTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  moTitle.height = 24;

  const moSubTitle = wsMO.addRow([`Cotización Nº ${presupuesto.numero} - Cliente: ${cliente?.nombre || 'General'}`]);
  moSubTitle.font = { name: 'Arial', size: 10, italic: true };
  wsMO.addRow([]);

  const moHeaderRow = wsMO.addRow([
    '# Ítem',
    'Partida Presupuestaria',
    'Categoría Laboral',
    'Hs. Unitarias',
    'Hs. Totales',
    'Tarifa / Hora ARS',
    'Subtotal MO ARS'
  ]);
  moHeaderRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR_HEADER_TEXT } };
  moHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  moHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
  moHeaderRow.height = 24;

  let totalHsGlobal = 0;
  let totalMOCostGlobal = 0;

  allCapitulos.forEach((cap) => {
    const capItems = capituloItemsMap.get(cap.id);
    if (!capItems || capItems.length === 0) return;

    let capHs = 0;
    let capMOCost = 0;

    const capHeader = wsMO.addRow([
      itemWBSMap.get(capItems[0].id)?.capIndex || '',
      cap.nombre.toUpperCase(),
      '',
      '',
      '',
      '',
      ''
    ]);
    capHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    capHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SECTION_BG } };
    for (let c = 1; c <= 7; c++) capHeader.getCell(c).border = BORDER_THIN;

    capItems.forEach((it) => {
      const wbs = itemWBSMap.get(it.id)?.wbs || '';
      const moLines = it.manoObraSnapshot || [];

      if (moLines.length === 0) {
        if ((it.costoManoObra || 0) > 0) {
          const r = wsMO.addRow([
            wbs,
            it.descripcion,
            'Mano de Obra Global de Partida',
            '-',
            '-',
            '-',
            it.costoManoObra
          ]);
          r.font = { name: 'Arial', size: 9 };
          r.getCell(1).alignment = { horizontal: 'center' };
          r.getCell(7).numFmt = '"$"#,##0.00';
          for (let c = 1; c <= 7; c++) r.getCell(c).border = BORDER_THIN;
          capMOCost += it.costoManoObra || 0;
        }
      } else {
        moLines.forEach((mo) => {
          const hsU = mo.horasUnitarias ?? (it.cantidad > 0 ? mo.horasTotales / it.cantidad : mo.horasTotales);
          const hsTot = mo.horasTotales;
          const sub = mo.subtotalManoObra;
          capHs += hsTot;
          capMOCost += sub;

          const r = wsMO.addRow([
            wbs,
            it.descripcion,
            mo.nombreCategoria,
            hsU,
            hsTot,
            mo.costoHoraCongelado,
            sub
          ]);
          r.font = { name: 'Arial', size: 9 };
          r.getCell(1).alignment = { horizontal: 'center' };
          r.getCell(4).numFmt = '#,##0.00';
          r.getCell(5).numFmt = '#,##0.00';
          r.getCell(6).numFmt = '"$"#,##0.00';
          r.getCell(7).numFmt = '"$"#,##0.00';
          for (let c = 1; c <= 7; c++) r.getCell(c).border = BORDER_THIN;
        });
      }
    });

    totalHsGlobal += capHs;
    totalMOCostGlobal += capMOCost;
  });

  const moTotalRow = wsMO.addRow(['', 'TOTAL GENERAL MANO DE OBRA:', '', '', totalHsGlobal, '', totalMOCostGlobal]);
  moTotalRow.font = { name: 'Arial', size: 10, bold: true };
  moTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
  moTotalRow.getCell(5).numFmt = '#,##0.00';
  moTotalRow.getCell(7).numFmt = '"$"#,##0.00';
  for (let c = 1; c <= 7; c++) moTotalRow.getCell(c).border = BORDER_HEADER;

  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 4: MATERIALES (POR RUBRO E ÍTEM)
  // ══════════════════════════════════════════════════════════════════════════
  const wsMateriales = wb.addWorksheet('Materiales por Partida');
  wsMateriales.views = [{ showGridLines: true }];

  wsMateriales.columns = [
    { width: 8 },  // A: # WBS
    { width: 34 }, // B: Partida
    { width: 34 }, // C: Material / Insumo
    { width: 14 }, // D: Cant. Unitaria
    { width: 14 }, // E: Cant. Total
    { width: 10 }, // F: Unidad
    { width: 20 }, // G: Costo Unit. ARS
    { width: 22 }  // H: Subtotal Insumo ARS
  ];

  const matTitle = wsMateriales.addRow(['DETALLE DE MATERIALES ASIGNADOS POR PARTIDA']);
  matTitle.font = { name: 'Arial', size: 13, bold: true, color: { argb: COLOR_HEADER_TEXT } };
  matTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  matTitle.height = 24;

  const matSubTitle = wsMateriales.addRow([`Cotización Nº ${presupuesto.numero} - Cliente: ${cliente?.nombre || 'General'}`]);
  matSubTitle.font = { name: 'Arial', size: 10, italic: true };
  wsMateriales.addRow([]);

  const matHeaderRow = wsMateriales.addRow([
    '# Ítem',
    'Partida Presupuestaria',
    'Material / Insumo Requerido',
    'Cant. Unitaria',
    'Cant. Total',
    'Unidad',
    'Costo Unit. ARS',
    'Subtotal Insumo ARS'
  ]);
  matHeaderRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR_HEADER_TEXT } };
  matHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  matHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
  matHeaderRow.height = 24;

  let totalMatCostGlobal = 0;

  allCapitulos.forEach((cap) => {
    const capItems = capituloItemsMap.get(cap.id);
    if (!capItems || capItems.length === 0) return;

    let capMatCost = 0;

    const capHeader = wsMateriales.addRow([
      itemWBSMap.get(capItems[0].id)?.capIndex || '',
      cap.nombre.toUpperCase(),
      '',
      '',
      '',
      '',
      '',
      ''
    ]);
    capHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    capHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SECTION_BG } };
    for (let c = 1; c <= 8; c++) capHeader.getCell(c).border = BORDER_THIN;

    capItems.forEach((it) => {
      const wbs = itemWBSMap.get(it.id)?.wbs || '';
      const insLines = it.insumosSnapshot || [];

      if (insLines.length === 0) {
        if ((it.costoInsumos || 0) > 0) {
          const r = wsMateriales.addRow([
            wbs,
            it.descripcion,
            'Materiales Consolidados de Partida',
            '-',
            '-',
            'gl',
            it.costoInsumos,
            it.costoInsumos
          ]);
          r.font = { name: 'Arial', size: 9 };
          r.getCell(1).alignment = { horizontal: 'center' };
          r.getCell(8).numFmt = '"$"#,##0.00';
          for (let c = 1; c <= 8; c++) r.getCell(c).border = BORDER_THIN;
          capMatCost += it.costoInsumos || 0;
        }
      } else {
        insLines.forEach((ins) => {
          const uCant = ins.cantidadUnitaria !== undefined ? ins.cantidadUnitaria : (it.cantidad > 0 ? ins.cantidadTotal / it.cantidad : ins.cantidadTotal);
          const sub = ins.subtotalInsumo;
          capMatCost += sub;

          const r = wsMateriales.addRow([
            wbs,
            it.descripcion,
            ins.nombre,
            uCant,
            ins.cantidadTotal,
            ins.unidad || 'u',
            ins.precioUnitarioCongelado,
            sub
          ]);
          r.font = { name: 'Arial', size: 9 };
          r.getCell(1).alignment = { horizontal: 'center' };
          r.getCell(4).numFmt = '#,##0.00';
          r.getCell(5).numFmt = '#,##0.00';
          r.getCell(6).alignment = { horizontal: 'center' };
          r.getCell(7).numFmt = '"$"#,##0.00';
          r.getCell(8).numFmt = '"$"#,##0.00';
          for (let c = 1; c <= 8; c++) r.getCell(c).border = BORDER_THIN;
        });
      }
    });

    totalMatCostGlobal += capMatCost;
  });

  const matTotalRow = wsMateriales.addRow(['', 'TOTAL GENERAL MATERIALES POR PARTIDA:', '', '', '', '', '', totalMatCostGlobal]);
  matTotalRow.font = { name: 'Arial', size: 10, bold: true };
  matTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
  matTotalRow.getCell(8).numFmt = '"$"#,##0.00';
  for (let c = 1; c <= 8; c++) matTotalRow.getCell(c).border = BORDER_HEADER;


  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 5: LISTA CONSOLIDADA DE MATERIALES (BOM / COMPRA PARA DISTRIBUIDOR)
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
  // HOJA 6: COSTOS INDIRECTOS, MARGEN Y RESUMEN ECONÓMICO
  // ══════════════════════════════════════════════════════════════════════════
  const wsGG = wb.addWorksheet('Costos Indirectos y Gastos');
  wsGG.views = [{ showGridLines: true }];

  wsGG.columns = [
    { width: 6 },  // A: #
    { width: 44 }, // B: Concepto / Parámetro
    { width: 24 }, // C: Tipo / Modalidad
    { width: 20 }, // D: % Base / Factor
    { width: 24 }  // E: Monto ARS
  ];

  const ggTitle = wsGG.addRow(['RESUMEN ECONÓMICO-FINANCIERO Y COSTOS INDIRECTOS']);
  ggTitle.font = { name: 'Arial', size: 13, bold: true, color: { argb: COLOR_HEADER_TEXT } };
  ggTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  ggTitle.height = 24;

  const ggSub = wsGG.addRow([`Cotización Nº ${presupuesto.numero} - Cliente: ${cliente?.nombre || 'General'}`]);
  ggSub.font = { name: 'Arial', size: 10, italic: true };
  wsGG.addRow([]);

  // Bloque 1: Resumen de Cascada Financiera Global
  const sumHeader = wsGG.addRow(['', 'CASCADA FINANCIERA (C → GG → B → S → IMPUESTOS → FINAL)', '', '', '']);
  sumHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: COLOR_HEADER_TEXT } };
  sumHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ACCENT_BG } };

  const addSummaryRow = (label: string, tipo: string, pctStr: string, monto: number, bold: boolean = false, bgArg?: string) => {
    const row = wsGG.addRow(['•', label, tipo, pctStr, monto]);
    row.font = { name: 'Arial', size: 10, bold };
    if (bgArg) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArg } };
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(3).alignment = { horizontal: 'left' };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(5).alignment = { horizontal: 'right' };
    row.getCell(5).numFmt = '"$"#,##0.00';
    for (let c = 1; c <= 5; c++) row.getCell(c).border = BORDER_THIN;
    return row;
  };

  const matDirecto = presupuesto.subtotalInsumos || 0;
  const moDirecto = presupuesto.subtotalManoObra || 0;
  const servDirecto = presupuesto.subtotalServiciosTercerizados || 0;
  const riesgoMonto = presupuesto.montoMargenRiesgo || 0;
  const riesgoPct = presupuesto.margenRiesgoPorcentaje ? `${presupuesto.margenRiesgoPorcentaje}%` : '-';
  const costoGlobal = presupuesto.costoGlobal ?? (matDirecto + moDirecto + servDirecto + riesgoMonto);

  const ggTotal = presupuesto.gastosGeneralesTotal ?? (presupuesto.subtotalCostosIndirectos || 0);
  const benMonto = presupuesto.beneficioMonto ?? (presupuesto.montoGanancia || 0);
  const benPct = presupuesto.beneficioPorcentaje !== undefined ? `${presupuesto.beneficioPorcentaje}%` : (presupuesto.margenPorcentaje ? `${presupuesto.margenPorcentaje}%` : '-');
  const subSinImp = presupuesto.subtotalSinImpuestos ?? (costoGlobal + ggTotal + benMonto);
  const impTotal = presupuesto.montoImpuestosTotal ?? (presupuesto.montoImpuestos || 0);
  const pFinalTot = presupuesto.precioFinalGlobal ?? (presupuesto.totalARS || (subSinImp + impTotal));
  const coefK = presupuesto.coeficienteK ?? (costoGlobal > 0 ? pFinalTot / costoGlobal : 1);

  addSummaryRow('Costo Directo: Materiales e Insumos', 'Directo', '-', matDirecto);
  addSummaryRow('Costo Directo: Mano de Obra Propia', 'Directo', '-', moDirecto);
  if (servDirecto > 0) {
    addSummaryRow('Costo Directo: Servicios Tercerizados / Equipos', 'Directo', '-', servDirecto);
  }
  if (riesgoMonto > 0) {
    addSummaryRow('Margen de Riesgo / Contingencias', 'Sobre Costo Directo', riesgoPct, riesgoMonto);
  }
  addSummaryRow('COSTO GLOBAL DIRECTO DE LA OBRA (C)', 'Base Costo Directo', '100.0%', costoGlobal, true, COLOR_SECTION_BG);

  addSummaryRow('Gastos Generales y Costos Indirectos (GG)', 'Prorrateo / Fijos', '-', ggTotal);
  addSummaryRow('Beneficio / Utilidad Neta Estimada (B)', 'Sobre (C + GG)', benPct, benMonto);
  addSummaryRow('SUBTOTAL NETO SIN IMPUESTOS (S = C + GG + B)', 'Base Imponible Neta', '-', subSinImp, true, COLOR_SECTION_BG);

  addSummaryRow('Impuestos y Cargas Fiscales Totales', 'Sobre Subtotal S', '-', impTotal);
  addSummaryRow('PRECIO DE VENTA FINAL TOTAL CON IMPUESTOS', 'Precio Comercial Definitivo', `K = ${coefK.toFixed(4)}`, pFinalTot, true, COLOR_TOTAL_BG);

  wsGG.addRow([]);

  // Bloque 2: Detalle de Costos Indirectos Aplicados
  const activeIndirects = (presupuesto.costosIndirectosAplicados || []).filter(
    (c) => c.montoCalculado > 0
  );
  if (activeIndirects.length > 0) {
    const gHeader = wsGG.addRow(['#', 'Concepto de Costo Indirecto / Gasto General', 'Modalidad', 'Tasa / Valor Base', 'Monto en Cotización ARS']);
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
      row.font = { name: 'Arial', size: 9 };
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).numFmt = '"$"#,##0.00';
      for (let c = 1; c <= 5; c++) row.getCell(c).border = BORDER_THIN;
    });

    const totalGGRow = wsGG.addRow(['', 'Total Costos Indirectos (GG):', '', '', ggTotal]);
    totalGGRow.font = { name: 'Arial', size: 10, bold: true };
    totalGGRow.getCell(5).numFmt = '"$"#,##0.00';
    for (let c = 1; c <= 5; c++) totalGGRow.getCell(c).border = BORDER_HEADER;
    wsGG.addRow([]);
  }

  // Bloque 3: Detalle de Impuestos Aplicados
  const activeTaxes = (presupuesto.impuestosDetalle || []).filter((t) => t.aplica && t.montoCalculado > 0);
  if (activeTaxes.length > 0) {
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
      row.font = { name: 'Arial', size: 9 };
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(5).numFmt = '"$"#,##0.00';
      for (let c = 1; c <= 5; c++) row.getCell(c).border = BORDER_THIN;
    });

    const totalTaxRow = wsGG.addRow(['', 'Total Impuestos Aplicados:', '', '', impTotal]);
    totalTaxRow.font = { name: 'Arial', size: 10, bold: true };
    totalTaxRow.getCell(5).numFmt = '"$"#,##0.00';
    for (let c = 1; c <= 5; c++) totalTaxRow.getCell(c).border = BORDER_HEADER;
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

export const exportListaMaterialesToXLSX = async (
  presupuesto: Presupuesto,
  cliente?: Cliente | Contacto | null,
  config?: AppConfig | null,
  incluirPrecios: boolean = true
) => {
  const ExcelModule = await import('exceljs');
  const ExcelJS = ExcelModule.default || ExcelModule;
  const wb = new ExcelJS.Workbook();
  wb.creator = config?.nombreEmpresa || 'Cotizador Eléctrico IEBA';
  wb.created = new Date();

  const COLOR_HEADER_BG = 'FF0F172A';
  const COLOR_HEADER_TEXT = 'FFFFFFFF';
  const COLOR_ACCENT_BG = 'FFF59E0B';
  const COLOR_TOTAL_BG = 'FFFEF3C7';
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

  const ws = wb.addWorksheet('Lista de Materiales');
  ws.views = [{ showGridLines: true }];

  ws.columns = [
    { width: 6 },  // A: #
    { width: 45 }, // B: Material / Insumo
    { width: 15 }, // C: Cantidad
    { width: 12 }, // D: Unidad
    { width: 22 }, // E: Precio Unit. ARS
    { width: 24 }  // F: Subtotal Estimado ARS
  ];

  // Membrete
  const emisorNombre = config?.nombreEmpresa || 'IEBA - INSTALACIONES ELÉCTRICAS';
  const r1 = ws.addRow([emisorNombre]);
  r1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFD97706' } };

  const r2 = ws.addRow([`LISTA CONSOLIDADA DE MATERIALES / INSUMOS PARA COMPRA`]);
  r2.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };

  ws.addRow([
    `Cotización Ref.: ${presupuesto.numero}`,
    '',
    `Cliente: ${cliente?.nombre || 'General'}`,
    '',
    `Fecha: ${new Date(presupuesto.fechaEmision).toLocaleDateString('es-AR')}`
  ]);
  ws.addRow([]);

  const headerRow = ws.addRow([
    '#',
    'Descripción del Material / Insumo',
    'Cantidad Total',
    'Unidad',
    incluirPrecios ? 'Costo Unitario Ref. ARS' : '',
    incluirPrecios ? 'Subtotal Estimado ARS' : ''
  ]);
  headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR_HEADER_TEXT } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ACCENT_BG } };
  headerRow.height = 22;

  // Consolidar insumos
  const map = new Map<string, {
    nombre: string;
    unidad: string;
    cantidadTotal: number;
    costoUnitario: number;
    subtotal: number;
  }>();

  (presupuesto.items || []).forEach((it) => {
    (it.insumosSnapshot || []).forEach((ins) => {
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

  const materialsList = Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));

  let idx = 1;
  let totalCost = 0;
  materialsList.forEach((mat) => {
    totalCost += mat.subtotal;
    const row = ws.addRow([
      idx++,
      mat.nombre,
      mat.cantidadTotal,
      mat.unidad,
      incluirPrecios ? mat.costoUnitario : '',
      incluirPrecios ? mat.subtotal : ''
    ]);
    row.font = { name: 'Arial', size: 10 };
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(3).alignment = { horizontal: 'right' };
    row.getCell(3).numFmt = '#,##0.00';
    row.getCell(4).alignment = { horizontal: 'center' };
    if (incluirPrecios) {
      row.getCell(5).alignment = { horizontal: 'right' };
      row.getCell(5).numFmt = '"$"#,##0.00';
      row.getCell(6).alignment = { horizontal: 'right' };
      row.getCell(6).numFmt = '"$"#,##0.00';
    }
    for (let c = 1; c <= 6; c++) row.getCell(c).border = BORDER_THIN;
  });

  if (materialsList.length === 0) {
    const empty = ws.addRow(['-', 'No se especificaron materiales detallados en esta cotización', 0, 'gl', '', '']);
    empty.font = { name: 'Arial', size: 10, italic: true };
  } else if (incluirPrecios) {
    const totRow = ws.addRow(['', 'TOTAL GENERAL DE MATERIALES:', '', '', '', totalCost]);
    totRow.font = { name: 'Arial', size: 11, bold: true };
    totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
    totRow.getCell(6).numFmt = '"$"#,##0.00';
    totRow.getCell(5).border = BORDER_HEADER;
    totRow.getCell(6).border = BORDER_HEADER;
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeNum = (presupuesto.numero || 'cotizacion').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `Materiales_${safeNum}_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

export interface ExportCatalogItemRow {
  id: string;
  categoria: string;
  nombre: string;
  unidad: string;
  marca: string;
  modelo: string;
  precio: number;
  proveedor: string;
  fecha: string;
}

/**
 * Exporta el catálogo de materiales a un archivo Excel (.xlsx).
 * Cumple con SRP (Single Responsibility Principle) encapsulando la generación del documento
 * y utiliza importación dinámica para preservar el code-splitting.
 */
export async function exportMaterialesCatalogToExcel(rows: ExportCatalogItemRow[]): Promise<void> {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Catálogo Materiales');

  worksheet.columns = [
    { header: 'ID Material', key: 'id', width: 25 },
    { header: 'Categoría', key: 'categoria', width: 25 },
    { header: 'Nombre del Material', key: 'nombre', width: 40 },
    { header: 'Unidad de Venta', key: 'unidad', width: 15 },
    { header: 'Marca Preferida', key: 'marca', width: 20 },
    { header: 'Modelo', key: 'modelo', width: 20 },
    { header: 'Precio Vigente ARS', key: 'precio', width: 20 },
    { header: 'Proveedor', key: 'proveedor', width: 25 },
    { header: 'Fecha de Cotización', key: 'fecha', width: 20 }
  ];

  for (const row of rows) {
    worksheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `catalogo_materiales_${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
