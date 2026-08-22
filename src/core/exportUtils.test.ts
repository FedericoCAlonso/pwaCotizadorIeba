import { describe, it, expect, vi } from 'vitest';
import { Presupuesto, Cliente, AppConfig } from './types';
import { buildPresupuestoPDFDoc, exportPresupuestoToLaTeX } from './pdfExportUtils';

describe('PDF and LaTeX Export Utils', () => {
  const mockPresupuesto: Presupuesto = {
    id: 'p-1',
    numero: 'COT-2026-001',
    clienteId: 'cli-1',
    fechaEmision: '2026-08-21T00:00:00.000Z',
    validezDias: 15,
    tipoFactura: 'Factura B',
    items: [
      {
        id: 'it-1',
        descripcion: 'Instalación de Tablero Principal',
        cantidad: 1,
        unidad: 'gl',
        insumosSnapshot: [
          {
            insumoId: 'ins-1',
            nombre: 'Gabinete Din 24 bocas',
            unidad: 'u',
            cantidadUnitaria: 1,
            cantidadTotal: 1,
            precioUnitarioCongelado: 25000,
            subtotalInsumo: 25000
          }
        ],
        manoObraSnapshot: [
          {
            categoriaId: 'mo-1',
            nombreCategoria: 'Oficial Electricista',
            horasUnitarias: 4,
            horasTotales: 4,
            costoHoraCongelado: 5000,
            subtotalManoObra: 20000
          }
        ],
        costoInsumos: 25000,
        costoManoObra: 20000,
        costoDirectoTotal: 45000,
        precioVentaUnitario: 65000,
        precioVentaTotal: 65000,
        precioVentaClienteUnitario: 65000,
        precioVentaClienteTotal: 65000
      }
    ],
    costosIndirectosAplicados: [
      {
        costoIndirectoId: 'ci-1',
        nombre: 'Movilidad y Flete',
        tipo: 'por_visita',
        valorAplicado: 5000,
        montoCalculado: 5000
      }
    ],
    subtotalInsumos: 25000,
    subtotalManoObra: 20000,
    subtotalCostosDirectos: 45000,
    subtotalCostosIndirectos: 5000,
    gastosGeneralesTotal: 5000,
    costoGlobal: 45000,
    costoTotalObra: 50000,
    margenPorcentaje: 30,
    montoGanancia: 15000,
    subtotalSinImpuestos: 65000,
    impuestosDetalle: [],
    impuestosPorcentaje: 0,
    montoImpuestos: 0,
    totalARS: 65000,
    mostrarReferenciaMonedaExtranjera: false,
    nombreMonedaExtranjera: 'USD',
    cotizacionMonedaExtranjera: 1200,
    condicionesPagoTexto: '50% anticipo y 50% al finalizar',
    estado: 'borrador',
    fechaModificacion: '2026-08-21T00:00:00.000Z'
  };

  const mockCliente: Cliente = {
    id: 'cli-1',
    nombre: 'Juan Pérez',
    razonSocial: 'Juan Pérez',
    roles: ['cliente'],
    cuitDni: '20-12345678-9',
    condicionIVA: 'Consumidor Final',
    telefono: '1122334455',
    email: 'juan@test.com'
  };

  const mockConfig: AppConfig = {
    id: 'cfg-1',
    nombreEmpresa: 'IEBA Electricidad',
    subtituloEmpresa: 'Instalaciones y Montajes',
    cuit: '20-33445566-7',
    telefono: '1199887766',
    email: 'contacto@ieba.com.ar',
    direccion: 'Buenos Aires, Argentina',
    dolarReferenciaNombre: 'Dólar Blue',
    dolarReferenciaValor: 1250,
    mostrarDolarPorDefecto: false,
    monotributista: true,
    tipoFacturaPorDefecto: 'Factura B',
    porcentajeIVAPorDefecto: 21,
    porcentajeIIBBPorDefecto: 3.5,
    margenPorDefectoPct: 35,
    validezDiasPorDefecto: 15,
    prefijoPresupuesto: 'IEBA',
    siguienteNumeroCorrelativo: 100
  };

  it('builds a valid jsPDF document with headers and items', () => {
    const doc = buildPresupuestoPDFDoc(mockPresupuesto, mockCliente, mockConfig);
    expect(doc).toBeDefined();
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(210);
    expect(Math.round(doc.internal.pageSize.getHeight())).toBe(297);
  });

  it('generates exportable LaTeX code containing quotation metadata and items', () => {
    // Mock window.URL.createObjectURL and DOM anchor click
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    const clickMock = vi.fn();
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
      set href(val: string) {},
      set download(val: string) {},
      click: clickMock
    } as any);

    exportPresupuestoToLaTeX(mockPresupuesto, mockCliente, mockConfig);

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(clickMock).toHaveBeenCalled();
    expect(createObjectURLMock).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });
});
