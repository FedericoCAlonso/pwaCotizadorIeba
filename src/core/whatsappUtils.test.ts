import { describe, it, expect } from 'vitest';
import {
  generarMensajeWhatsAppCotizacion,
  limpiarNumeroTelefonoWhatsApp,
  generarEnlaceWhatsApp,
  DEFAULT_WHATSAPP_TEMPLATE_GENERIC,
  DEFAULT_WHATSAPP_TEMPLATE_VAITTY,
  consolidarMaterialesPresupuesto,
  generarMensajeWhatsAppListaMateriales,
  sanitizarEmojisWhatsApp
} from './whatsappUtils';
import { Presupuesto, Contacto, AppConfig } from './types';
import { DEFAULT_APP_CONFIG } from './sampleData';

describe('whatsappUtils', () => {
  const mockCliente: Contacto = {
    id: 'cli-1',
    razonSocial: 'Marcela Gómez',
    roles: ['cliente'],
    telefono: '11 4455-6677',
    direccion: 'Av. Corrientes 1234, CABA'
  };

  const mockPresupuesto: Presupuesto = {
    id: 'pres-1',
    numero: 'IEBA-2026-1045',
    clienteId: 'cli-1',
    fechaEmision: '2026-08-28T10:00:00.000Z',
    validezDias: 10,
    tipoFactura: 'Factura C',
    items: [
      {
        id: 'it-1',
        descripcion: 'Reemplazo Disyuntor 2x40A 30mA',
        cantidad: 1,
        unidad: 'u',
        costoInsumos: 30000,
        costoManoObra: 40000,
        costoDirectoTotal: 70000,
        precioVentaUnitario: 105000,
        precioVentaTotal: 105000,
        precioVentaClienteTotal: 105000,
        insumosSnapshot: [],
        manoObraSnapshot: []
      }
    ],
    costosIndirectosAplicados: [],
    subtotalInsumos: 30000,
    subtotalManoObra: 40000,
    subtotalCostosDirectos: 70000,
    subtotalCostosIndirectos: 0,
    costoTotalObra: 70000,
    margenPorcentaje: 50,
    montoGanancia: 35000,
    impuestosDetalle: [],
    impuestosPorcentaje: 0,
    montoImpuestos: 0,
    totalARS: 105000,
    coeficienteK: 1.5,
    mostrarReferenciaMonedaExtranjera: false,
    nombreMonedaExtranjera: 'USD',
    cotizacionMonedaExtranjera: 1350,
    condicionesPagoTexto: '50% anticipo y 50% al finalizar',
    estado: 'enviado',
    fechaModificacion: '2026-08-28T10:00:00.000Z'
  };

  it('debe renderizar el template genérico por defecto sustituyendo variables de cliente, ítems y total', () => {
    const mensaje = generarMensajeWhatsAppCotizacion(mockPresupuesto, mockCliente, DEFAULT_APP_CONFIG);

    expect(mensaje).toContain('PRESUPUESTO ELÉCTRICO');
    expect(mensaje).toContain('Marcela Gómez');
    expect(mensaje).toContain('Reemplazo Disyuntor 2x40A 30mA');
    expect(mensaje).toContain('105.000');
    expect(mensaje).toContain('50% anticipo y 50% al finalizar');
  });

  it('debe calcular la distribución de precios K (materiales + mano de obra = total) en plantillas como Vaitty', () => {
    // K = 1.5 -> Insumos 30.000 * 1.5 = 45.000, MO 40.000 * 1.5 = 60.000 -> Suma = 105.000
    const mensaje = generarMensajeWhatsAppCotizacion(mockPresupuesto, mockCliente, DEFAULT_APP_CONFIG, DEFAULT_WHATSAPP_TEMPLATE_VAITTY);

    expect(mensaje).toContain('*COTIZACIÓN DE SERVICIO - VAITTY*');
    expect(mensaje).toContain('Costo de Materiales:');
    expect(mensaje).toContain('45.000');
    expect(mensaje).toContain('Costo de Mano de Obra:');
    expect(mensaje).toContain('60.000');
    expect(mensaje).toContain('TOTAL FINAL:');
  });

  it('debe respetar la jerarquía de plantillas: cliente personalizado sobreescribe config global', () => {
    const clienteVaitty: Contacto = {
      ...mockCliente,
      plantillaWhatsAppPersonalizada: 'Mensaje especial para Vaitty: {{total_ars}} - Mat: {{precio_materiales}}'
    };

    const mensaje = generarMensajeWhatsAppCotizacion(mockPresupuesto, clienteVaitty, DEFAULT_APP_CONFIG);

    expect(mensaje).toContain('Mensaje especial para Vaitty:');
    expect(mensaje).toContain('105.000');
    expect(mensaje).toContain('45.000');
  });

  it('debe normalizar números telefónicos argentinos para wa.me', () => {
    expect(limpiarNumeroTelefonoWhatsApp('11 4455-6677')).toBe('5491144556677');
    expect(limpiarNumeroTelefonoWhatsApp('+54 9 11 4455-6677')).toBe('5491144556677');
    expect(limpiarNumeroTelefonoWhatsApp('011 4455-6677')).toBe('5491144556677');
  });

  it('debe generar el enlace wa.me correctamente codificado', () => {
    const link = generarEnlaceWhatsApp('11 4455 6677', 'Hola Marcela, tu total es $ 105.000');
    expect(link).toContain('https://wa.me/5491144556677?text=Hola%20Marcela');
  });

  it('debe consolidar insumos agrupando por material y sumando cantidades y subtotales', () => {
    const pConVariosItems: Presupuesto = {
      ...mockPresupuesto,
      items: [
        {
          id: 'it-1',
          descripcion: 'Circuito 1',
          cantidad: 1,
          unidad: 'u',
          costoInsumos: 25000,
          costoManoObra: 10000,
          costoDirectoTotal: 35000,
          precioVentaUnitario: 50000,
          precioVentaTotal: 50000,
          insumosSnapshot: [
            {
              materialId: 'mat-cable',
              nombre: 'Cable Unipolar 2.5mm',
              unidad: 'm',
              cantidadTotal: 50,
              precioUnitarioCongelado: 300,
              subtotalInsumo: 15000
            },
            {
              materialId: 'mat-termica',
              nombre: 'Térmica 2x16A',
              unidad: 'u',
              cantidadTotal: 1,
              precioUnitarioCongelado: 10000,
              subtotalInsumo: 10000
            }
          ],
          manoObraSnapshot: []
        },
        {
          id: 'it-2',
          descripcion: 'Circuito 2',
          cantidad: 1,
          unidad: 'u',
          costoInsumos: 15000,
          costoManoObra: 10000,
          costoDirectoTotal: 25000,
          precioVentaUnitario: 40000,
          precioVentaTotal: 40000,
          insumosSnapshot: [
            {
              materialId: 'mat-cable',
              nombre: 'Cable Unipolar 2.5mm',
              unidad: 'm',
              cantidadTotal: 50,
              precioUnitarioCongelado: 300,
              subtotalInsumo: 15000
            }
          ],
          manoObraSnapshot: []
        }
      ]
    };

    const consolidado = consolidarMaterialesPresupuesto(pConVariosItems.items);
    expect(consolidado).toHaveLength(2);

    const cable = consolidado.find((c) => c.nombre === 'Cable Unipolar 2.5mm');
    expect(cable).toBeDefined();
    expect(cable?.cantidadTotal).toBe(100);
    expect(cable?.subtotal).toBe(30000);

    const mensajeWhatsApp = generarMensajeWhatsAppListaMateriales(pConVariosItems, mockCliente, DEFAULT_APP_CONFIG, true);
    expect(mensajeWhatsApp).toContain('PEDIDO / LISTA DE MATERIALES');
    expect(mensajeWhatsApp).toContain('• 100 m - Cable Unipolar 2.5mm');
    expect(mensajeWhatsApp).toContain('• 1 u - Térmica 2x16A');
  });

  it('debe sanitizar emojis con selector de variación (U+FE0F) para evitar caracteres rotos en WhatsApp Web', () => {
    const textoConVariaciones = '🗓️ Fecha: 28/08/2026 🛠️ Trabajos ⚡️ Potencia ✔️ Aprobado ▪️ Item';
    const sanitizado = sanitizarEmojisWhatsApp(textoConVariaciones);
    expect(sanitizado).toBe('📅 Fecha: 28/08/2026 🔧 Trabajos ⚡ Potencia ✅ Aprobado • Item');
    // Verificar que no quedan caracteres \uFE0F
    expect(sanitizado.includes('\uFE0F')).toBe(false);
  });
});
