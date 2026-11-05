import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SmartSheetView } from './SmartSheetView';
import { ItemPresupuesto, CapituloPresupuesto } from '../../../core/types';
import { calcularTotalesPresupuesto } from '../../../core/calculations';
import { MaterialCatalogSuggestion } from '../../../core/materialSuggestions';

describe('SmartSheetNarrowView - FASE 4 (Pantallas < 700 px)', () => {
  const mockCapitulos: CapituloPresupuesto[] = [
    { id: 'cap-1', nombre: 'Instalación General', orden: 1 }
  ];

  const mockItem: ItemPresupuesto = {
    id: 'item-1',
    capituloId: 'cap-1',
    descripcion: 'Punto y toma embutido',
    cantidad: 4,
    unidad: 'boca',
    naturaleza: 'instalacion',
    costoUnitario: 3500,
    costoInsumos: 14000,
    costoManoObra: 0,
    costoServicios: 0,
    costoDirectoTotal: 14000,
    costoTotal: 14000,
    precioVentaUnitario: 4500,
    precioVentaTotal: 18000,
    insumosSnapshot: [
      {
        insumoId: 'ins-1',
        nombre: 'Cable unipolar 2.5 mm²',
        marca: 'Prysmian',
        unidad: 'm',
        cantidadTotal: 30,
        cantidadUnitaria: 7.5,
        precioUnitarioCongelado: 1200,
        subtotalInsumo: 36000
      },
      {
        insumoId: 'ins-2',
        nombre: 'Caja octogonal chica',
        marca: 'sin definir',
        unidad: 'u',
        cantidadTotal: 4,
        cantidadUnitaria: 1,
        precioUnitarioCongelado: 500,
        subtotalInsumo: 2000
      }
    ],
    manoObraSnapshot: []
  };

  const mockSuggestions: MaterialCatalogSuggestion[] = [
    {
      id: 'mat-termica',
      nombre: 'Termomagnética 2x16A',
      unidad: 'u',
      precioVigente: 8900,
      marcaModelo: 'Schneider Electric'
    }
  ];

  it('muestra la lista de ítems (master) y al tocar uno navega al detalle de líneas', () => {
    let currentItems = [mockItem];
    const setItems = vi.fn();

    const totales = calcularTotalesPresupuesto({
      items: currentItems,
      capitulos: mockCapitulos,
      impuestosDetalle: []
    });

    render(
      <SmartSheetView
        items={currentItems}
        setItems={setItems}
        capitulos={mockCapitulos}
        totales={totales}
        isNarrow={true}
      />
    );

    // Debe mostrar la vista master de ítems
    expect(screen.getByText('Ítems del Presupuesto (1)')).toBeDefined();
    expect(screen.getByText('Punto y toma embutido')).toBeDefined();

    // Al tocar el ítem:
    fireEvent.click(screen.getByText('Punto y toma embutido'));

    // Ahora debe mostrar la vista de líneas con el botón de volver "Ítems"
    expect(screen.getByRole('button', { name: 'Volver a la lista de ítems' })).toBeDefined();
    expect(screen.getByText('Cable unipolar 2.5 mm²')).toBeDefined();

    // Volver a ítems
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la lista de ítems' }));
    expect(screen.getByText('Ítems del Presupuesto (1)')).toBeDefined();
  });

  it('muestra las líneas en dos renglones (función arriba; marca y cantidad abajo en gris; subtotal a la derecha)', () => {
    let currentItems = [mockItem];

    const totales = calcularTotalesPresupuesto({
      items: currentItems,
      capitulos: mockCapitulos,
      impuestosDetalle: []
    });

    render(
      <SmartSheetView
        items={currentItems}
        capitulos={mockCapitulos}
        totales={totales}
        isNarrow={true}
      />
    );

    // Entrar al detalle
    fireEvent.click(screen.getByText('Punto y toma embutido'));

    // Renglón 1: Función
    expect(screen.getByText('Cable unipolar 2.5 mm²')).toBeDefined();
    expect(screen.getByText('Caja octogonal chica')).toBeDefined();

    // Renglón 2: Marca y cantidad abajo en gris
    expect(screen.getByText('Prysmian')).toBeDefined();
    expect(screen.getByText('30 m')).toBeDefined();

    expect(screen.getByText('sin definir')).toBeDefined();
    expect(screen.getByText('4 u')).toBeDefined();

    // Subtotal a la derecha
    expect(screen.getByText('$ 36.000,00')).toBeDefined();
    expect(screen.getByText('$ 2.000,00')).toBeDefined();
  });

  it('la cascada APU es un bloque plegable (oculta por defecto y visible al expandir)', () => {
    let currentItems = [mockItem];

    const totales = calcularTotalesPresupuesto({
      items: currentItems,
      capitulos: mockCapitulos,
      impuestosDetalle: []
    });

    render(
      <SmartSheetView
        items={currentItems}
        capitulos={mockCapitulos}
        totales={totales}
        isNarrow={true}
      />
    );

    fireEvent.click(screen.getByText('Punto y toma embutido'));

    // El bloque plegable existe
    const toggleButton = screen.getByText('Cascada APU (Costos y Precio Final)');
    expect(toggleButton).toBeDefined();

    // Por defecto el desglose detallado no está visible
    expect(screen.queryByText('Costo Directo Total:')).toBeNull();

    // Al hacer clic, se expande
    fireEvent.click(toggleButton);
    expect(screen.getByText('Costo Directo Total:')).toBeDefined();

    // Al volver a hacer clic, se repliega
    fireEvent.click(toggleButton);
    expect(screen.queryByText('Costo Directo Total:')).toBeNull();
  });

  it('permite agregar una línea mediante el control fijo inferior con autocompletado y cantidad numérica', async () => {
    let currentItems: ItemPresupuesto[] = [{ ...mockItem, insumosSnapshot: [] }];
    const setItems = vi.fn((updater) => {
      if (typeof updater === 'function') {
        currentItems = updater(currentItems);
      } else {
        currentItems = updater;
      }
    });

    const totales = calcularTotalesPresupuesto({
      items: currentItems,
      capitulos: mockCapitulos,
      impuestosDetalle: []
    });

    render(
      <SmartSheetView
        items={currentItems}
        setItems={setItems}
        capitulos={mockCapitulos}
        totales={totales}
        isNarrow={true}
      />
    );

    fireEvent.click(screen.getByText('Punto y toma embutido'));

    // Control inferior fijo "+ Agregar línea (material)..."
    const inputFuncion = screen.getByPlaceholderText('+ Agregar línea (material)...');
    const inputCant = screen.getByPlaceholderText('Cant');
    const btnAgregar = screen.getByTitle('Agregar línea al ítem');

    // Escribir en función y cantidad
    fireEvent.change(inputFuncion, { target: { value: 'Caño corrugado 3/4' } });
    fireEvent.change(inputCant, { target: { value: '25' } });

    fireEvent.click(btnAgregar);

    expect(setItems).toHaveBeenCalled();
    const updated = currentItems[0];
    expect(updated.insumosSnapshot).toHaveLength(1);
    expect(updated.insumosSnapshot[0].nombre).toBe('Caño corrugado 3/4');
    expect(updated.insumosSnapshot[0].cantidadTotal).toBe(25);
    expect(updated.insumosSnapshot[0].marca).toBe('sin definir');
  });
});
