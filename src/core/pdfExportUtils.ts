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

  const isFacturaA = presupuesto.tipoFactura === 'Factura A';
  const mostrarDetalle = presupuesto.opcionesEmision?.mostrarDetalleCostos ?? false;
  const mostrarItemizado = presupuesto.opcionesEmision?.mostrarItemizado ?? true;

  // ─── 1. Franja Superior de Acento Corporativo IEBA ─────────────────────────
  doc.setFillColor(217, 119, 6); // Amber 600
  doc.rect(0, 0, pageWidth, 4, 'F');

  let currentY = 14;

  // ─── 2. Membrete Emisor (Izquierda) ─────────────────────────────────────────
  const emisorNombre = config?.nombreEmpresa || 'IEBA - INSTALACIONES ELÉCTRICAS';
  const emisorSubtitulo = config?.subtituloEmpresa || 'Soluciones e Ingeniería Eléctrica';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
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
  if (config?.cuit) datosFiscales.push(`CUIT: ${config.cuit}`);
  if (config?.telefono) datosFiscales.push(`Tel/WA: ${config.telefono}`);
  if (config?.email) datosFiscales.push(`Email: ${config.email}`);
  if (config?.direccion) datosFiscales.push(`Dirección: ${config.direccion}`);

  datosFiscales.forEach((line) => {
    doc.text(line, margin, currentY);
    currentY += 3.5;
  });

  // ─── 3. Recuadro de Metadatos de la Cotización (Derecha) ─────────────────────
  const boxX = pageWidth - margin - 65;
  const boxY = 10;
  const boxW = 65;
  const boxH = 28;

  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`PRESUPUESTO`, boxX + boxW / 2, boxY + 5.5, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(217, 119, 6);
  doc.text(`${presupuesto.numero}`, boxX + boxW / 2, boxY + 10.5, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Fecha: ${new Date(presupuesto.fechaEmision).toLocaleDateString('es-AR')}`, boxX + 4, boxY + 16);
  doc.text(`Validez: ${presupuesto.validezDias || 15} días`, boxX + 4, boxY + 20);
  doc.text(`Tipo: ${presupuesto.tipoFactura || 'Factura B'}`, boxX + 4, boxY + 24);

  currentY = Math.max(currentY + 2, boxY + boxH + 4);

  // Línea divisoria
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 4;

  // ─── 4. Recuadro de Información del Cliente ────────────────────────────────
  const clientBoxH = 18;
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, clientBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('DATOS DEL CLIENTE Y DESTINATARIO', margin + 3.5, currentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(cliente?.nombre || 'General / Consumidor Final', margin + 3.5, currentY + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const col2X = margin + contentWidth * 0.45;
  const col3X = margin + contentWidth * 0.75;

  doc.text(`CUIT/DNI: ${cliente?.cuitDni || 'S/D'}`, col2X, currentY + 9.5);
  doc.text(`Condición IVA: ${cliente?.condicionIVA || 'Consumidor Final'}`, col2X, currentY + 14);

  if (cliente?.telefono) doc.text(`Tel: ${cliente.telefono}`, col3X, currentY + 9.5);
  if (cliente?.email) doc.text(`Email: ${cliente.email}`, col3X, currentY + 14);

  currentY += clientBoxH + 5;

  // ─── 5. Tabla de Partidas / Ítems de Cotización ───────────────────────────
  const tableHeaders = [
    '#',
    'Descripción / Detalle de la Partida',
    'Unidad',
    'Cant.',
    isFacturaA ? 'P. Unit. Neto' : 'P. Unitario',
    isFacturaA ? 'Subtotal Neto' : 'Subtotal'
  ];

  const tableBody: any[][] = [];

  if (mostrarItemizado) {
    presupuesto.items.forEach((item, idx) => {
      const pUnit = isFacturaA
        ? (item.subtotalItem && item.cantidad ? item.subtotalItem / item.cantidad : (item.precioVentaClienteUnitario ?? item.precioVentaUnitario ?? 0))
        : (item.precioVentaClienteUnitario ?? item.precioVentaUnitario ?? 0);
      const pTotal = isFacturaA
        ? (item.subtotalItem ?? item.precioVentaClienteTotal ?? item.precioVentaTotal ?? ((item.cantidad || 1) * pUnit))
        : (item.precioVentaClienteTotal ?? item.precioVentaTotal ?? ((item.cantidad || 1) * pUnit));

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
      fontSize: 8.5,
      halign: 'center',
      cellPadding: 2.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2.5
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 32 },
      5: { halign: 'right', cellWidth: 34, fontStyle: 'bold' }
    },
    didDrawCell: (data) => {
      // Dibujar borde inferior fino en filas del cuerpo
      if (data.section === 'body') {
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    }
  });

  const lastTable = (doc as any).lastAutoTable;
  currentY = lastTable ? lastTable.finalY + 4 : currentY + 30;

  // ─── 6. Sección de Cierre: Condiciones (Izq) y Cuadro de Totales (Der) ────
  // Verificar si hay espacio suficiente para los totales o agregar página
  if (currentY > pageHeight - 65) {
    doc.addPage();
    currentY = 16;
  }

  const splitX = margin + contentWidth * 0.52;
  const leftW = contentWidth * 0.48;
  const rightW = contentWidth * 0.48;

  // ── 6.A Columna Izquierda: Condiciones Comerciales y Cláusulas Técnicas ──
  let leftY = currentY;

  const condiciones = presupuesto.opcionesEmision?.condicionesComerciales || presupuesto.condicionesPagoTexto;
  if (condiciones) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('CONDICIONES COMERCIALES Y DE PAGO', margin, leftY);
    leftY += 3.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const condLines = doc.splitTextToSize(condiciones, leftW - 2);
    doc.text(condLines, margin, leftY);
    leftY += condLines.length * 3.2 + 2;
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
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.setDrawColor(251, 191, 36); // Amber 400
    const clBoxH = Math.min(25, clausulas.length * 4 + 6);
    doc.roundedRect(margin, leftY, leftW, clBoxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(146, 64, 14); // Amber 800
    doc.text('RESGUARDO CONSTRUCTIVO / EXCLUSIONES', margin + 2.5, leftY + 3.5);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    let clY = leftY + 6.5;
    clausulas.slice(0, 3).forEach((cl) => {
      const splitCl = doc.splitTextToSize(`• ${cl}`, leftW - 5);
      doc.text(splitCl, margin + 2.5, clY);
      clY += splitCl.length * 2.8;
    });
    leftY += clBoxH + 3;
  }

  // ── 6.B Columna Derecha: Cuadro Resumen de Totales ─────────────────────────
  let rightY = currentY;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  const totalsBoxH = mostrarDetalle ? 48 : 32;
  doc.roundedRect(splitX, rightY, rightW, totalsBoxH, 2, 2, 'FD');

  let rowY = rightY + 5;
  const printTotalLine = (label: string, value: string, isBold = false, isHighlight = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isHighlight ? 10 : 7.5);
    doc.setTextColor(isHighlight ? 217 : (isBold ? 15 : 71), isHighlight ? 119 : (isBold ? 23 : 85), isHighlight ? 6 : (isBold ? 42 : 105));
    doc.text(label, splitX + 4, rowY);
    doc.text(value, splitX + rightW - 4, rowY, { align: 'right' });
    rowY += isHighlight ? 5.5 : 3.8;
  };

  if (mostrarDetalle) {
    printTotalLine('1. Costo Insumos:', formatARS(presupuesto.subtotalInsumos || 0));
    printTotalLine('1. Costo Mano de Obra:', formatARS(presupuesto.subtotalManoObra || 0));
    if (presupuesto.subtotalServiciosTercerizados) {
      printTotalLine('1. Servicios Tercerizados:', formatARS(presupuesto.subtotalServiciosTercerizados));
    }
    printTotalLine('Costo Directo Total (C):', formatARS(presupuesto.costoGlobal || presupuesto.subtotalCostosDirectos || 0), true);

    const ggTotal = presupuesto.gastosGeneralesTotal || presupuesto.subtotalCostosIndirectos || 0;
    if (ggTotal > 0) {
      printTotalLine('2. Gastos Generales (GG):', formatARS(ggTotal));
    }

    printTotalLine(`3. Beneficio (${presupuesto.beneficioPorcentaje ?? presupuesto.margenPorcentaje}%):`, formatARS(presupuesto.beneficioMonto || presupuesto.montoGanancia || 0));
    printTotalLine('4. Subtotal sin Impuestos (S):', formatARS(presupuesto.subtotalSinImpuestos || (presupuesto.totalARS - (presupuesto.montoImpuestos || 0))), true);

    if (presupuesto.montoImpuestosTotal || presupuesto.montoImpuestos) {
      printTotalLine('5. Total Impuestos:', formatARS(presupuesto.montoImpuestosTotal || presupuesto.montoImpuestos || 0));
    }
  } else {
    if (isFacturaA) {
      printTotalLine('Subtotal Neto Gravado:', formatARS(presupuesto.subtotalSinImpuestos || (presupuesto.totalARS - (presupuesto.montoImpuestosTotal || 0))));
      printTotalLine('IVA Discriminado (21%):', formatARS(presupuesto.montoImpuestosTotal || 0));
    } else {
      printTotalLine('Subtotal Trabajos:', formatARS(presupuesto.totalARS || 0));
    }
  }

  // Divisor de total final
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.4);
  doc.line(splitX + 3, rowY - 1, splitX + rightW - 3, rowY - 1);
  rowY += 2;

  printTotalLine('TOTAL FINAL ARS:', formatARS(presupuesto.totalARS || 0), true, true);

  if (presupuesto.mostrarReferenciaMonedaExtranjera && presupuesto.cotizacionMonedaExtranjera) {
    const totalUSD = presupuesto.totalMonedaExtranjera || (presupuesto.totalARS / presupuesto.cotizacionMonedaExtranjera);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(2, 132, 199);
    doc.text(`Ref. ${presupuesto.nombreMonedaExtranjera || 'USD'} (T/C $${presupuesto.cotizacionMonedaExtranjera}):`, splitX + 4, rowY);
    doc.text(`u$s ${totalUSD.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, splitX + rightW - 4, rowY, { align: 'right' });
  }

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
      `Presupuesto Nº ${presupuesto.numero} | ${emisorNombre} | Generado el ${new Date().toLocaleDateString('es-AR')}`,
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
 * Permite al usuario exportar el documento listo para compilar con pdflatex / xelatex / Overleaf.
 */
export const exportPresupuestoToLaTeX = (
  presupuesto: Presupuesto,
  cliente?: Cliente | Contacto | null,
  config?: AppConfig | null
) => {
  const emisorNombre = config?.nombreEmpresa || 'IEBA - Instalaciones Eléctricas';
  const emisorSubtitulo = config?.subtituloEmpresa || 'Soluciones e Ingeniería Eléctrica';
  const isFacturaA = presupuesto.tipoFactura === 'Factura A';

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
      const pUnit = isFacturaA
        ? (item.subtotalItem && item.cantidad ? item.subtotalItem / item.cantidad : (item.precioVentaClienteUnitario ?? item.precioVentaUnitario ?? 0))
        : (item.precioVentaClienteUnitario ?? item.precioVentaUnitario ?? 0);
      const pTotal = isFacturaA
        ? (item.subtotalItem ?? item.precioVentaClienteTotal ?? item.precioVentaTotal ?? ((item.cantidad || 1) * pUnit))
        : (item.precioVentaClienteTotal ?? item.precioVentaTotal ?? ((item.cantidad || 1) * pUnit));

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
        \\textbf{Validez:} ${presupuesto.validezDias || 15} días\\\\
        \\textbf{Tipo:} ${escapeLaTeX(presupuesto.tipoFactura || 'Factura B')}
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
