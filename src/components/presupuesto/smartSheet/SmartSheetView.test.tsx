import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SmartSheetView } from './SmartSheetView';
import { ItemPresupuesto, CapituloPresupuesto } from '../../../core/types';
import { calcularTotalesPresupuesto, formatARS } from '../../../core/calculations';

describe('SmartSheetView (Fase 1: Planilla Inteligente)', () => {
  const mockCapitulos: CapituloPresupuesto[] = [
    { id: 'cap-1', nombre: 'Instalaciones Eléctricas', orden: 1 },
    { id: 'cap-2', nombre: 'Tableros y Protecciones', orden: 2 }
  ];

  const mockItems: ItemPresupuesto[] = [
    {
      id: 'item-1',
      capituloId: 'cap-1',
      descripcion: 'Bocas de iluminación y tomas',
      cantidad: 10,
      unidad: 'boca',
      costoInsumos: 25000,
      costoManoObra: 40000,
      costoDirectoTotal: 65000,
      precioVentaUnitario: 9500,
      precioVentaTotal: 95000,
      insumosSnapshot: [
        {
          insumoId: 'ins-1',
          nombre: 'Cable unipolar 2.5mm',
          marca: 'Prysmian',
          unidad: 'm',
          cantidadTotal: 50,
          formulaCantidad: '=bocas * 5',
          precioUnitarioCongelado: 500,
          subtotalInsumo: 25000
        }
      ],
      manoObraSnapshot: [
        {
          categoriaId: 'mo-oficial',
          nombreCategoria: 'Oficial Electricista',
          horasTotales: 8,
          formulaHoras: '=bocas * 0.8',
          costoHoraCongelado: 5000,
          subtotalManoObra: 40000
        }
      ],
      serviciosTercerizados: []
    },
    {
      id: 'item-2',
      capituloId: 'cap-2',
      descripcion: 'Tablero Principal de Embutir',
      cantidad: 1,
      unidad: 'gl',
      costoInsumos: 80000,
      costoManoObra: 30000,
      costoDirectoTotal: 110000,
      precioVentaUnitario: 160000,
      precioVentaTotal: 160000,
      insumosSnapshot: [
        {
          insumoId: 'ins-2',
          nombre: 'Gabinete 24 bocas',
          unidad: 'u',
          // Sin marca especificada para probar fallback "Sin definir"
          cantidadTotal: 1,
          precioUnitarioCongelado: 80000,
          subtotalInsumo: 80000
        }
      ],
      manoObraSnapshot: [
        {
          categoriaId: 'mo-especialista',
          nombreCategoria: 'Especialista Tablerista',
          horasTotales: 5,
          costoHoraCongelado: 6000,
          subtotalManoObra: 30000
        }
      ],
      serviciosTercerizados: [
        {
          id: 'serv-1',
          descripcion: 'Certificación y Protocolo DCI',
          costo: 15000,
          cantidad: 1,
          nombreProveedor: 'Colegio de Ingenieros'
        }
      ]
    }
  ];

  const totales = calcularTotalesPresupuesto({
    items: mockItems,
    capitulos: mockCapitulos,
    margenPorcentaje: 30,
    impuestosDetalle: [{ id: 'tax-iva', nombre: 'IVA', porcentaje: 21, aplica: true, discriminar: true, montoCalculado: 0 }]
  });

  it('renderiza las 3 zonas apiladas: Itemizado, Líneas y Cascada junto a las Variables de Obra', () => {
    render(
      <SmartSheetView
        items={mockItems}
        capitulos={mockCapitulos}
        totales={totales}
        calculosVariables={{ bocas: 10, superficie: 85 }}
      />
    );

    // Variables de obra al tope
    expect(screen.getByText(/Variables de Obra:/i)).toBeDefined();
    expect(screen.getByText('bocas:')).toBeDefined();
    expect(screen.getByText('85')).toBeDefined();

    // Zona 1: Itemizado
    expect(screen.getByText(/Zona 1 · Itemizado/i)).toBeDefined();
    expect(screen.getAllByText('Bocas de iluminación y tomas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tablero Principal de Embutir').length).toBeGreaterThan(0);
    expect(screen.getByText(/Capítulo 1: Instalaciones Eléctricas/i)).toBeDefined();
    expect(screen.getByText(/Capítulo 2: Tableros y Protecciones/i)).toBeDefined();

    // Zona 2: Líneas del ítem seleccionado por defecto (item-1)
    expect(screen.getByText(/Zona 2 · Líneas del Ítem/i)).toBeDefined();
    expect(screen.getByText('Cable unipolar 2.5mm')).toBeDefined();
    expect(screen.getByText('Prysmian')).toBeDefined();
    expect(screen.getByText('Oficial Electricista')).toBeDefined();
    expect(screen.getByText('=bocas * 5')).toBeDefined();

    // Zona 3: Cascada APU del ítem seleccionado
    expect(screen.getByText(/Zona 3 · Cascada:/i)).toBeDefined();
    expect(screen.getAllByText(/Costo Directo/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gastos Generales/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Beneficio/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Impuestos/i).length).toBeGreaterThan(0);
  });

  it('actualiza las líneas y la cascada al seleccionar otro ítem en el itemizado', () => {
    render(
      <SmartSheetView
        items={mockItems}
        capitulos={mockCapitulos}
        totales={totales}
      />
    );

    // Al inicio está seleccionado item-1
    expect(screen.getByText('Cable unipolar 2.5mm')).toBeDefined();

    // Clic en item-2 en el itemizado
    const item2Row = screen.getAllByText('Tablero Principal de Embutir')[0];
    fireEvent.click(item2Row);

    // Ahora deben verse las líneas de item-2 (Gabinete y Certificación)
    expect(screen.getByText('Gabinete 24 bocas')).toBeDefined();
    expect(screen.getByText('Certificación y Protocolo DCI')).toBeDefined();
    expect(screen.getByText('Colegio de Ingenieros')).toBeDefined();
    // Marca sin definir debe mostrarse en gris/itálica
    expect(screen.getAllByText('Sin definir').length).toBeGreaterThan(0);
  });

  it('los totales mostrados coinciden exactamente con el resultado del motor calcularTotalesPresupuesto', () => {
    render(
      <SmartSheetView
        items={mockItems}
        capitulos={mockCapitulos}
        totales={totales}
      />
    );

    // Total general en la barra inferior debe coincidir exactamente
    expect(screen.getAllByText(/298\.870/).length).toBeGreaterThan(0);

    // Costo directo general
    expect(screen.getAllByText(/190\.000/).length).toBeGreaterThan(0);
  });

  it('permite alternar al Editor Clásico mediante el callback onToggleClassicView', () => {
    const onToggleMock = vi.fn();
    render(
      <SmartSheetView
        items={mockItems}
        capitulos={mockCapitulos}
        totales={totales}
        onToggleClassicView={onToggleMock}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /Ver Editor Clásico/i });
    fireEvent.click(toggleBtn);
    expect(onToggleMock).toHaveBeenCalledTimes(1);
  });
});
