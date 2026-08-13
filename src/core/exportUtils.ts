import * as XLSX from 'xlsx';
import { Presupuesto, Cliente } from './types';
import { formatARS } from './calculations';

export const exportPresupuestoToXLSX = (presupuesto: Presupuesto, cliente?: Cliente) => {
  const data: any[][] = [];

  // Header
  data.push(['COTIZACIÓN DE INSTALACIONES ELÉCTRICAS - IEBA']);
  data.push(['Presupuesto Nº:', presupuesto.numero, '', 'Fecha Emisión:', new Date(presupuesto.fechaEmision).toLocaleDateString('es-AR')]);
  data.push(['Cliente:', cliente?.nombre || 'General', '', 'CUIT / DNI:', cliente?.cuitDni || 'S/D']);
  data.push(['Condición IVA:', cliente?.condicionIVA || 'Consumidor Final', '', 'Validez:', `${presupuesto.validezDias || 15} días`]);
  data.push([]); // Empty row

  // Table Headers
  data.push(['#', 'Descripción / Partida a Ejecutar', 'Unidad', 'Cantidad', 'Precio Unitario ARS', 'Subtotal ARS']);

  // Items
  presupuesto.items.forEach((item, idx) => {
    data.push([
      idx + 1,
      item.descripcion,
      item.unidad || 'punto',
      item.cantidad,
      item.precioVentaUnitario || 0,
      (item.cantidad || 1) * (item.precioVentaUnitario || 0)
    ]);
  });

  data.push([]); // Empty row

  // Summary Totals
  data.push(['', '', '', '', 'Subtotal Insumos ARS:', presupuesto.subtotalInsumos || 0]);
  data.push(['', '', '', '', 'Subtotal Mano de Obra ARS:', presupuesto.subtotalManoObra || 0]);
  if (presupuesto.subtotalServiciosTercerizados) {
    data.push(['', '', '', '', 'Servicios Tercerizados ARS:', presupuesto.subtotalServiciosTercerizados]);
  }
  data.push(['', '', '', '', 'Costos Indirectos Aplicados ARS:', presupuesto.subtotalCostosIndirectos || 0]);
  data.push(['', '', '', '', 'Ganancia / Margen ARS:', presupuesto.montoGanancia || 0]);
  data.push(['', '', '', '', 'TOTAL FINAL ARS:', presupuesto.totalARS || 0]);

  // Create sheet & workbook
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 5 },  // #
    { wch: 45 }, // Descripción
    { wch: 10 }, // Unidad
    { wch: 12 }, // Cantidad
    { wch: 22 }, // Precio Unitario
    { wch: 22 }  // Subtotal
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Presupuesto_${presupuesto.numero}`);

  const filename = `Presupuesto_IEBA_${presupuesto.numero}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
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
