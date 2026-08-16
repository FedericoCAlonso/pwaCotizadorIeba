import { Presupuesto, Cliente } from './types';
import { formatARS } from './calculations';

export const exportPresupuestoToXLSX = async (presupuesto: Presupuesto, cliente?: Cliente) => {
  const data: any[][] = [];
  const mostrarDetalle = presupuesto.opcionesEmision?.mostrarDetalleCostos ?? false;
  const mostrarItemizado = presupuesto.opcionesEmision?.mostrarItemizado ?? true;

  // Header
  data.push(['COTIZACIÓN DE INSTALACIONES ELÉCTRICAS - IEBA']);
  data.push(['Presupuesto Nº:', presupuesto.numero, '', 'Fecha Emisión:', new Date(presupuesto.fechaEmision).toLocaleDateString('es-AR')]);
  data.push(['Cliente:', cliente?.nombre || 'General', '', 'CUIT / DNI:', cliente?.cuitDni || 'S/D']);
  data.push(['Condición IVA:', cliente?.condicionIVA || 'Consumidor Final', '', 'Validez:', `${presupuesto.validezDias || 15} días`]);
  data.push([]); // Empty row

  // Table Headers
  const isFacturaA = presupuesto.tipoFactura === 'Factura A';
  data.push([
    '#',
    'Descripción / Partida a Ejecutar',
    'Unidad',
    'Cantidad',
    isFacturaA ? 'Precio Unitario Neto ARS' : 'Precio Venta Unitario ARS',
    isFacturaA ? 'Subtotal Neto ARS' : 'Subtotal ARS'
  ]);

  // Items
  if (mostrarItemizado) {
    presupuesto.items.forEach((item, idx) => {
      const pUnit = isFacturaA
        ? (item.subtotalItem && item.cantidad ? item.subtotalItem / item.cantidad : (item.precioVentaClienteUnitario ?? item.precioVentaUnitario ?? 0))
        : (item.precioVentaClienteUnitario ?? item.precioVentaUnitario ?? 0);
      const pTotal = isFacturaA
        ? (item.subtotalItem ?? item.precioVentaClienteTotal ?? item.precioVentaTotal ?? ((item.cantidad || 1) * pUnit))
        : (item.precioVentaClienteTotal ?? item.precioVentaTotal ?? ((item.cantidad || 1) * pUnit));
      data.push([
        idx + 1,
        item.descripcion,
        item.unidad || 'u',
        item.cantidad,
        pUnit,
        pTotal
      ]);
    });
  } else {
    data.push([
      1,
      'Provisión de materiales y mano de obra para instalaciones eléctricas según relevamiento',
      'gl',
      1,
      presupuesto.subtotalSinImpuestos || presupuesto.totalARS,
      presupuesto.subtotalSinImpuestos || presupuesto.totalARS
    ]);
  }

  data.push([]); // Empty row

  // Summary Totals
  if (mostrarDetalle) {
    data.push(['', '', '', '', '1. Subtotal Insumos ARS:', presupuesto.subtotalInsumos || 0]);
    data.push(['', '', '', '', '1. Subtotal Mano de Obra ARS:', presupuesto.subtotalManoObra || 0]);
    if (presupuesto.subtotalServiciosTercerizados) {
      data.push(['', '', '', '', '1. Servicios Tercerizados ARS:', presupuesto.subtotalServiciosTercerizados]);
    }
    data.push(['', '', '', '', 'Costo Directo Total (C) ARS:', presupuesto.costoGlobal || presupuesto.subtotalCostosDirectos || 0]);
    data.push(['', '', '', '', '2. Gastos Generales (GG) ARS:', presupuesto.gastosGeneralesTotal || presupuesto.subtotalCostosIndirectos || 0]);
    data.push(['', '', '', '', `3. Beneficio (${presupuesto.beneficioPorcentaje ?? presupuesto.margenPorcentaje}%) ARS:`, presupuesto.beneficioMonto || presupuesto.montoGanancia || 0]);
    data.push(['', '', '', '', '4. Subtotal sin Impuestos (S) ARS:', presupuesto.subtotalSinImpuestos || (presupuesto.totalARS - (presupuesto.montoImpuestos || 0))]);
    if (presupuesto.montoImpuestosTotal || presupuesto.montoImpuestos) {
      data.push(['', '', '', '', '5. Total Impuestos ARS:', presupuesto.montoImpuestosTotal || presupuesto.montoImpuestos || 0]);
    }
  } else {
    if (isFacturaA) {
      data.push(['', '', '', '', 'Subtotal Neto Gravado ARS:', presupuesto.subtotalSinImpuestos || (presupuesto.totalARS - (presupuesto.montoImpuestosTotal || 0))]);
      data.push(['', '', '', '', 'IVA Discriminado ARS:', presupuesto.montoImpuestosTotal || 0]);
    } else {
      data.push(['', '', '', '', 'Subtotal Trabajos ARS:', presupuesto.totalARS || 0]);
    }
  }
  data.push(['', '', '', '', 'TOTAL FINAL ARS:', presupuesto.totalARS || 0]);

  if (presupuesto.opcionesEmision?.condicionesComerciales || presupuesto.condicionesPagoTexto) {
    data.push([]);
    data.push(['Condiciones Comerciales:', presupuesto.opcionesEmision?.condicionesComerciales || presupuesto.condicionesPagoTexto]);
  }

  // Create sheet & workbook with ExcelJS
  const ExcelModule = await import('exceljs');
  const ExcelJS = ExcelModule.default || ExcelModule;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Cotizador IEBA';
  wb.created = new Date();

  const ws = wb.addWorksheet(`Presupuesto_${presupuesto.numero}`);

  ws.columns = [
    { width: 5 },  // #
    { width: 45 }, // Descripción
    { width: 10 }, // Unidad
    { width: 12 }, // Cantidad
    { width: 22 }, // Precio Unitario
    { width: 22 }  // Subtotal
  ];

  data.forEach(row => {
    ws.addRow(row);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const filename = `Presupuesto_IEBA_${presupuesto.numero}_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const sharePresupuesto = async (presupuesto: Presupuesto, cliente?: Cliente) => {
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
