import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Presupuesto, Cliente, Contacto, AppConfig } from './types';
import { formatARS } from './calculations';

/**
 * Genera el documento PDF formal de cotización en formato A4 vectorial,
 * optimizado para impresión y envío digital por WhatsApp / Email.
 */
export const buildPresupuestoPDFDoc = (
  presupuesto: Presupuesto,
  cliente?: Cliente | Contacto | null,
  config?: AppConfig | null
): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const mostrarDetalle = presupuesto.opcionesEmision?.mostrarDetalleCostos ?? false;
  const mostrarItemizado = presupuesto.opcionesEmision?.mostrarItemizado ?? true;

  // ─── 1. Franja Superior de Acento Corporativo IEBA ─────────────────────────
  doc.setFillColor(217, 119, 6); // Amber 600
  doc.rect(0, 0, pageWidth, 4, 'F');

  let currentY = 13;

  // ─── 2. Membrete Emisor (Izquierda) ─────────────────────────────────────────
  const emisorNombre = config?.nombreEmpresa || 'IEBA - INSTALACIONES ELÉCTRICAS';
  const emisorSubtitulo = config?.subtituloEmpresa || 'Soluciones e Ingeniería Eléctrica';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(emisorNombre, margin, currentY);

  currentY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(emisorSubtitulo, margin, currentY);

  currentY += 4;
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105); // Slate 600

  const datosFiscales: string[] = [];
  if (config?.cuit) datosFiscales.push(`CUIT / Matrícula: ${config.cuit}`);
  if (config?.telefono) datosFiscales.push(`Tel / WA: ${config.telefono}`);
  if (config?.email) datosFiscales.push(`Email: ${config.email}`);
  if (config?.direccion) datosFiscales.push(`Dirección: ${config.direccion}`);

  datosFiscales.forEach((line) => {
    doc.text(line, margin, currentY);
    currentY += 3.5;
  });

  const leftHeaderEndY = currentY;

  // ─── 3. Recuadro de Metadatos de la Cotización (Derecha) ─────────────────────
  const boxW = 68;
  const boxH = 22;
  const boxX = pageWidth - margin - boxW;
  const boxY = 10;

  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PRESUPUESTO COMERCIAL', boxX + boxW / 2, boxY + 4.8, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(217, 119, 6); // Amber 600
  doc.text(`${presupuesto.numero}`, boxX + boxW / 2, boxY + 9.8, { align: 'center' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(boxX + 5, boxY + 12, boxX + boxW - 5, boxY + 12);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Fecha: ${new Date(presupuesto.fechaEmision).toLocaleDateString('es-AR')}`, boxX + 5, boxY + 16.5);
  doc.text(`Validez: ${presupuesto.validezDias || 15} días`, boxX + 5, boxY + 20);

  currentY = Math.max(leftHeaderEndY + 2.5, boxY + boxH + 3.5);

  // Línea divisoria
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 3.5;

  // ─── 4. Recuadro de Información del Cliente ────────────────────────────────
  const clientBoxH = 22;
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, clientBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('DATOS DEL CLIENTE / DESTINATARIO', margin + 4, currentY + 4.5);

  const clienteNombre = cliente?.nombre || (cliente as any)?.razonSocial || 'General / Consumidor Final';
  const col2X = margin + contentWidth * 0.44;
  const col3X = margin + contentWidth * 0.74;

  // Fila 1 datos cliente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(clienteNombre, margin + 4, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`CUIT / DNI: ${cliente?.cuitDni || 'S/D'}`, col2X, currentY + 10);
  doc.text(cliente?.telefono ? `Tel: ${cliente.telefono}` : 'Tel: S/D', col3X, currentY + 10);

  // Fila 2 datos cliente y obra
  const obraStr = (presupuesto.direccionObra || cliente?.direccion || 'Según relevamiento').slice(0, 48);
  doc.text(`Obra: ${obraStr}`, margin + 4, currentY + 16.5);
  doc.text(`Condición IVA: ${cliente?.condicionIVA || 'Consumidor Final'}`, col2X, currentY + 16.5);
  doc.text(cliente?.email ? `Email: ${cliente.email}` : 'Email: S/D', col3X, currentY + 16.5);

  currentY += clientBoxH + 4.5;

  // ─── 5. Tabla de Partidas / Ítems de Cotización ───────────────────────────
  const tableHeaders = [
    '#',
    'Descripción / Detalle de la Partida',
    'Unidad',
    'Cant.',
    'Precio Unitario',
    'Subtotal'
  ];

  const tableBody: any[][] = [];

  if (mostrarItemizado) {
    presupuesto.items.forEach((item, idx) => {
      const pUnit = item.precioVentaClienteUnitario ?? item.precioVentaUnitario ?? 0;
      const pTotal = item.precioVentaClienteTotal ?? item.precioVentaTotal ?? ((item.cantidad || 1) * pUnit);

      let desc = item.descripcion || 'Sin descripción';
      if (item.notasTecnicas) {
        desc += `\n${item.notasTecnicas}`;
      }

      tableBody.push([
        idx + 1,
        desc,
        item.unidad || 'u',
        item.cantidad,
        formatARS(pUnit),
        formatARS(pTotal)
      ]);
    });
  } else {
    tableBody.push([
      1,
      'Provisión de materiales y mano de obra para instalaciones eléctricas según relevamiento y especificaciones técnicas.',
      'gl',
      1,
      formatARS(presupuesto.subtotalSinImpuestos || presupuesto.totalARS),
      formatARS(presupuesto.subtotalSinImpuestos || presupuesto.totalARS)
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [tableHeaders],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 2.5
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.5
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'right', cellWidth: 15 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }
    },
    didDrawCell: (data) => {
      // Borde inferior fino en cada fila
      if (data.section === 'body') {
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    }
  });

  const lastTable = (doc as any).lastAutoTable;
  currentY = lastTable ? lastTable.finalY + 4 : currentY + 25;

  // ─── 6. Preparación de Totales y Columnas de Cierre ────────────────────────
  interface TotalRowItem {
    label: string;
    value: string;
    isBold?: boolean;
    isHighlight?: boolean;
    isSubtle?: boolean;
  }

  const totalRows: TotalRowItem[] = [];

  if (mostrarDetalle) {
    totalRows.push({ label: '1. Costo Materiales / Insumos:', value: formatARS(presupuesto.subtotalInsumos || 0) });
    totalRows.push({ label: '1. Costo Mano de Obra (MOD):', value: formatARS(presupuesto.subtotalManoObra || 0) });
    if (presupuesto.subtotalServiciosTercerizados) {
      totalRows.push({ label: '1. Servicios Tercerizados:', value: formatARS(presupuesto.subtotalServiciosTercerizados) });
    }
    totalRows.push({
      label: 'Costo Directo Total (C):',
      value: formatARS(presupuesto.costoGlobal || presupuesto.subtotalCostosDirectos || 0),
      isBold: true
    });

    const ggTotal = presupuesto.gastosGeneralesTotal || presupuesto.subtotalCostosIndirectos || 0;
    if (ggTotal > 0) {
      totalRows.push({ label: '2. Gastos Generales (GG):', value: formatARS(ggTotal) });
    }

    totalRows.push({
      label: `3. Beneficio (${presupuesto.beneficioPorcentaje ?? presupuesto.margenPorcentaje}%):`,
      value: formatARS(presupuesto.beneficioMonto || presupuesto.montoGanancia || 0)
    });
    totalRows.push({
      label: '4. Subtotal sin Impuestos:',
      value: formatARS(presupuesto.subtotalSinImpuestos || (presupuesto.totalARS - (presupuesto.montoImpuestos || 0))),
      isBold: true
    });

    if (presupuesto.montoImpuestosTotal || presupuesto.montoImpuestos) {
      totalRows.push({
        label: '5. Total Impuestos / Gravámenes:',
        value: formatARS(presupuesto.montoImpuestosTotal || presupuesto.montoImpuestos || 0)
      });
    }
  } else {
    if (presupuesto.montoImpuestosTotal && presupuesto.montoImpuestosTotal > 0) {
      totalRows.push({
        label: 'Subtotal:',
        value: formatARS(presupuesto.subtotalSinImpuestos || (presupuesto.totalARS - presupuesto.montoImpuestosTotal))
      });
      totalRows.push({
        label: 'Impuestos / IVA Aplicado:',
        value: formatARS(presupuesto.montoImpuestosTotal)
      });
    } else {
      totalRows.push({
        label: 'Subtotal Trabajos:',
        value: formatARS(presupuesto.totalARS || 0)
      });
    }
  }

  // Total Final ARS
  totalRows.push({
    label: 'TOTAL FINAL ARS:',
    value: formatARS(presupuesto.totalARS || 0),
    isBold: true,
    isHighlight: true
  });

  // Referencia Moneda Extranjera
  if (presupuesto.mostrarReferenciaMonedaExtranjera && presupuesto.cotizacionMonedaExtranjera) {
    const totalUSD = presupuesto.totalMonedaExtranjera || (presupuesto.totalARS / presupuesto.cotizacionMonedaExtranjera);
    totalRows.push({
      label: `Ref. ${presupuesto.nombreMonedaExtranjera || 'USD'} (T/C $${presupuesto.cotizacionMonedaExtranjera}):`,
      value: `u$s ${totalUSD.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      isSubtle: true
    });
  }

  // Cálculo dinámico de altura del recuadro de totales
  const totalsBoxH = totalRows.length * 4.0 + 8;
  const leftW = contentWidth * 0.48;
  const rightW = contentWidth * 0.48;
  const splitX = margin + contentWidth - rightW;

  // Verificación de salto de página
  if (currentY + Math.max(totalsBoxH, 42) > pageHeight - 16) {
    doc.addPage();
    currentY = 16;
  }

  // ── 6.A Columna Izquierda: Condiciones Comerciales, Resguardo y Pagos ──
  let leftY = currentY;

  const condiciones = presupuesto.opcionesEmision?.condicionesComerciales || presupuesto.condicionesPagoTexto;
  if (condiciones) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('CONDICIONES COMERCIALES Y FORMA DE PAGO', margin, leftY);
    leftY += 3.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const condLines = doc.splitTextToSize(condiciones, leftW - 2);
    doc.text(condLines, margin, leftY);
    leftY += condLines.length * 3.0 + 2;
  }

  // Cláusula de Resguardo Cambiario
  if (presupuesto.mostrarReferenciaMonedaExtranjera && presupuesto.cotizacionMonedaExtranjera) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const usdClause = `* Validez de precios sujeta a estabilidad cambiaria. Cotización calculada sobre la base de 1 ${presupuesto.nombreMonedaExtranjera || 'USD'} = ${formatARS(presupuesto.cotizacionMonedaExtranjera)}. Variaciones cambiarias superiores al 5% antes de la aceptación facultarán al reajuste de la partida de materiales.`;
    const usdLines = doc.splitTextToSize(usdClause, leftW - 2);
    doc.text(usdLines, margin, leftY);
    leftY += usdLines.length * 2.7 + 2;
  }

  // Esquema de Pagos e Hitos
  if (presupuesto.esquemaPago?.hitos && presupuesto.esquemaPago.hitos.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Hitos de Pago:', margin, leftY);
    leftY += 3;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    presupuesto.esquemaPago.hitos.forEach((h) => {
      doc.text(`• ${h.descripcion} (${h.porcentaje}%): ${formatARS(h.montoCalculado)} (${h.medioPagoEsperado})`, margin + 2, leftY);
      leftY += 2.8;
    });
    leftY += 2;
  }

  // Cláusulas de Resguardo / Exclusiones
  const clausulas = Array.from(
    new Set(
      presupuesto.items
        .map((i) => i.clausulaExclusiones || i.clausulaTecnica)
        .filter((c): c is string => Boolean(c && c.trim().length > 0))
    )
  );

  if (clausulas.length > 0) {
    let totalLinesCount = 0;
    const splitClausulas = clausulas.slice(0, 3).map((cl) => {
      const lines = doc.splitTextToSize(`• ${cl}`, leftW - 5);
      totalLinesCount += lines.length;
      return lines;
    });

    const clBoxH = Math.max(12, totalLinesCount * 2.8 + 6);
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.setDrawColor(251, 191, 36);  // Amber 400
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, leftY, leftW, clBoxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(146, 64, 14); // Amber 800
    doc.text('RESGUARDO CONSTRUCTIVO / EXCLUSIONES', margin + 2.5, leftY + 3.2);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.3);
    let clY = leftY + 6.2;
    splitClausulas.forEach((lines) => {
      doc.text(lines, margin + 2.5, clY);
      clY += lines.length * 2.7;
    });
    leftY += clBoxH + 3;
  }

  // ── 6.B Columna Derecha: Recuadro de Totales (Dinámico) ────────────────────
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(splitX, currentY, rightW, totalsBoxH, 2, 2, 'FD');

  let rY = currentY + 4.8;
  totalRows.forEach((row) => {
    if (row.isHighlight) {
      // Línea divisoria antes del total final
      doc.setDrawColor(217, 119, 6);
      doc.setLineWidth(0.3);
      doc.line(splitX + 3, rY - 1.2, splitX + rightW - 3, rY - 1.2);
      rY += 1.6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(217, 119, 6); // Amber 600
      doc.text(row.label, splitX + 4, rY);
      doc.text(row.value, splitX + rightW - 4, rY, { align: 'right' });
      rY += 5.0;
    } else if (row.isSubtle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(2, 132, 199); // Sky 600
      doc.text(row.label, splitX + 4, rY);
      doc.text(row.value, splitX + rightW - 4, rY, { align: 'right' });
      rY += 3.6;
    } else {
      doc.setFont('helvetica', row.isBold ? 'bold' : 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(row.isBold ? 15 : 71, row.isBold ? 23 : 85, row.isBold ? 42 : 105);
      doc.text(row.label, splitX + 4, rY);
      doc.text(row.value, splitX + rightW - 4, rY, { align: 'right' });
      rY += 3.8;
    }
  });

  // ─── 7. Pie de Página y Numeración de Páginas ─────────────────────────────
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate 400

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);

    doc.text(
      `Presupuesto Nº ${presupuesto.numero} | ${emisorNombre} | Emitido el ${new Date(presupuesto.fechaEmision).toLocaleDateString('es-AR')}`,
      margin,
      pageHeight - 5
    );
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin,
      pageHeight - 5,
      { align: 'right' }
    );
  }

  return doc;
};

/**
 * Dispara la descarga directa del archivo PDF en el navegador.
 */
export const exportPresupuestoToPDF = (
  presupuesto: Presupuesto,
  cliente?: Cliente | Contacto | null,
  config?: AppConfig | null
) => {
  const doc = buildPresupuestoPDFDoc(presupuesto, cliente, config);
  const safeNum = (presupuesto.numero || 'cotizacion').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Presupuesto_IEBA_${safeNum}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

/**
 * Genera el Blob del PDF para compartir vía Web Share API o adjuntar a WhatsApp.
 */
export const getPresupuestoPDFBlob = (
  presupuesto: Presupuesto,
  cliente?: Cliente | Contacto | null,
  config?: AppConfig | null
): Blob => {
  const doc = buildPresupuestoPDFDoc(presupuesto, cliente, config);
  return doc.output('blob');
};

/**
 * Generador de Código Fuente LaTeX (.tex)
 */
export const exportPresupuestoToLaTeX = (
  presupuesto: Presupuesto,
  cliente?: Cliente | Contacto | null,
  config?: AppConfig | null
) => {
  const emisorNombre = config?.nombreEmpresa || 'IEBA - Instalaciones Eléctricas';
  const emisorSubtitulo = config?.subtituloEmpresa || 'Soluciones e Ingeniería Eléctrica';

  const escapeLaTeX = (str: string = '') => {
    return str
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/{/g, '\\{')
      .replace(/}/g, '\\}')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  };

  const rowsLaTeX = presupuesto.items
    .map((item, idx) => {
      const pUnit = item.precioVentaClienteUnitario ?? item.precioVentaUnitario ?? 0;
      const pTotal = item.precioVentaClienteTotal ?? item.precioVentaTotal ?? ((item.cantidad || 1) * pUnit);

      return `    ${idx + 1} & ${escapeLaTeX(item.descripcion)} & ${item.cantidad} ${escapeLaTeX(item.unidad || 'u')} & ${formatARS(pUnit)} & ${formatARS(pTotal)} \\\\`;
    })
    .join('\n');

  const texContent = `\\documentclass[a4paper,10pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[spanish]{babel}
\\usepackage[margin=2cm]{geometry}
\\usepackage{booktabs}
\\usepackage{tabularx}
\\usepackage{xcolor}
\\usepackage{fancyhdr}
\\usepackage{tcolorbox}

\\definecolor{iebaamber}{RGB}{217, 119, 6}
\\definecolor{iebadark}{RGB}{15, 23, 42}
\\definecolor{iebagray}{RGB}{241, 245, 249}

\\pagestyle{fancy}
\\fancyhf{}
\\rhead{\\textcolor{iebadark}{\\textbf{Presupuesto Nº ${escapeLaTeX(presupuesto.numero)}}}}
\\lhead{\\textcolor{iebaamber}{\\textbf{${escapeLaTeX(emisorNombre)}}}}
\\rfoot{Página \\thepage}
\\lfoot{Emitido el ${new Date(presupuesto.fechaEmision).toLocaleDateString('es-AR')}}

\\begin{document}

% Membrete y Datos
\\begin{minipage}{0.55\\textwidth}
    {\\LARGE \\textbf{\\textcolor{iebaamber}{${escapeLaTeX(emisorNombre)}}}}\\\\
    {\\small \\textit{${escapeLaTeX(emisorSubtitulo)}}}\\\\
    ${config?.cuit ? `CUIT: ${escapeLaTeX(config.cuit)}\\\\` : ''}
    ${config?.telefono ? `Tel: ${escapeLaTeX(config.telefono)}\\\\` : ''}
    ${config?.email ? `Email: ${escapeLaTeX(config.email)}\\\\` : ''}
\\end{minipage}
\\hfill
\\begin{minipage}{0.4\\textwidth}
    \\begin{tcolorbox}[colback=iebagray,colframe=iebadark,title=Datos de la Cotización]
        \\textbf{Presupuesto Nº:} ${escapeLaTeX(presupuesto.numero)}\\\\
        \\textbf{Fecha:} ${new Date(presupuesto.fechaEmision).toLocaleDateString('es-AR')}\\\\
        \\textbf{Validez:} ${presupuesto.validezDias || 15} días
    \\end{tcolorbox}
\\end{minipage}

\\vspace{0.5cm}

% Datos del Cliente
\\begin{tcolorbox}[colback=white,colframe=gray!40,title=Destinatario]
    \\textbf{Cliente:} ${escapeLaTeX(cliente?.nombre || 'General')}\\\\
    \\textbf{CUIT / DNI:} ${escapeLaTeX(cliente?.cuitDni || 'S/D')} \\hfill \\textbf{Condición IVA:} ${escapeLaTeX(cliente?.condicionIVA || 'Consumidor Final')}
\\end{tcolorbox}

\\vspace{0.5cm}

% Tabla de Partidas
\\begin{table}[h!]
\\centering
\\begin{tabularx}{\\textwidth}{c X c r r}
\\toprule
\\textbf{\\#} & \\textbf{Descripción / Partida} & \\textbf{Cant.} & \\textbf{P. Unitario} & \\textbf{Subtotal} \\\\
\\midrule
${rowsLaTeX}
\\bottomrule
\\end{tabularx}
\\end{table}

\\vspace{0.3cm}

% Totales
\\hfill
\\begin{minipage}{0.45\\textwidth}
\\begin{tcolorbox}[colback=iebagray,colframe=iebaamber,title=\\textbf{TOTAL FINAL}]
    \\large \\textbf{Monto Total: ${formatARS(presupuesto.totalARS)}}
\\end{tcolorbox}
\\end{minipage}

\\vspace{0.8cm}

% Condiciones
\\section*{Condiciones Comerciales}
{\\small ${escapeLaTeX(presupuesto.opcionesEmision?.condicionesComerciales || presupuesto.condicionesPagoTexto || 'Pago: 50% anticipo y 50% contra entrega de obra.')}}

\\end{document}
`;

  const blob = new Blob([texContent], { type: 'text/x-tex;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeNum = (presupuesto.numero || 'cotizacion').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `Presupuesto_IEBA_${safeNum}.tex`;
  a.click();
  URL.revokeObjectURL(url);
};
