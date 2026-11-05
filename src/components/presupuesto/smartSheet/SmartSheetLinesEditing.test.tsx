import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SmartSheetView } from './SmartSheetView';
import { ItemPresupuesto, CapituloPresupuesto } from '../../../core/types';
import { calcularTotalesPresupuesto } from '../../../core/calculations';

// Mock de useConfirm para simular confirmación de usuario
const mockConfirm = vi.fn();
vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => mockConfirm,
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

describe('SmartSheet Líneas Editing (Fase 2)', () => {
  const mockCapitulos: CapituloPresupuesto[] = [
    { id: 'cap-1', nombre: 'Instalaciones Eléctricas', orden: 1 }
  ];

  const createInitialItems = (): ItemPresupuesto[] => [
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
          categoriaId: 'mo-1',
          nombreCategoria: 'Oficial Electricista',
          horasTotales: 8,
          costoHoraCongelado: 5000,
          subtotalManoObra: 40000
        }
      ],
      serviciosTercerizados: []
    }
  ];

  it('permite editar la cantidad con un número y recalcula el costo directo y totales', async () => {
    let currentItems = createInitialItems();
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

    const { rerender } = render(
      <SmartSheetView
        items={currentItems}
        setItems={setItems}
        capitulos={mockCapitulos}
        totales={totales}
        calculosVariables={{ bocas: 10 }}
      />
    );

    // 1. Clic en la celda de cantidad del cable (50 m)
    const qtyDisplay = screen.getByText('50 m');
    fireEvent.click(qtyDisplay);

    // 2. Se muestra el input en edición
    const input = screen.getByDisplayValue('=bocas * 5') as HTMLInputElement;
    expect(input).toBeDefined();

    // 3. Escribir nueva cantidad "100" y presionar Enter
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // 4. Verificar que setItems fue llamado con la nueva cantidad recalculada
    expect(setItems).toHaveBeenCalled();
    const updatedItem = currentItems.find(it => it.id === 'item-1')!;
    expect(updatedItem.insumosSnapshot![0].cantidadTotal).toBe(100);
    // 100 * 500 = 50000 para insumos + 40000 MO = 90000
    expect(updatedItem.costoInsumos).toBe(50000);
    expect(updatedItem.costoDirectoTotal).toBe(90000);

    // 5. Re-renderizar con los datos actualizados para verificar UI
    const newTotales = calcularTotalesPresupuesto({ items: currentItems, capitulos: mockCapitulos, impuestosDetalle: [] });
    rerender(
      <SmartSheetView
        items={currentItems}
        setItems={setItems}
        capitulos={mockCapitulos}
        totales={newTotales}
        calculosVariables={{ bocas: 10 }}
      />
    );

    expect(screen.getByText('100 m')).toBeDefined();
  });

  it('evalúa fórmulas matemáticas con variables de obra (ej. =bocas * 8)', async () => {
    let currentItems = createInitialItems();
    const setItems = vi.fn((updater) => {
      if (typeof updater === 'function') {
        currentItems = updater(currentItems);
      } else {
        currentItems = updater;
      }
    });

    const totales = calcularTotalesPresupuesto({ items: currentItems, capitulos: mockCapitulos, impuestosDetalle: [] });

    render(
      <SmartSheetView
        items={currentItems}
        setItems={setItems}
        capitulos={mockCapitulos}
        totales={totales}
        calculosVariables={{ bocas: 10 }}
      />
    );

    // Clic en la cantidad para editar
    const qtyDisplay = screen.getByText('50 m');
    fireEvent.click(qtyDisplay);

    const input = screen.getByDisplayValue('=bocas * 5') as HTMLInputElement;
    // Cambiar a =bocas * 8 (10 * 8 = 80)
    fireEvent.change(input, { target: { value: '=bocas * 8' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(setItems).toHaveBeenCalled();
    const updatedItem = currentItems.find(it => it.id === 'item-1')!;
    expect(updatedItem.insumosSnapshot![0].cantidadTotal).toBe(80);
    expect(updatedItem.insumosSnapshot![0].formulaCantidad).toBe('=bocas * 8');
  });

  it('marca la celda en rojo si la fórmula es inválida sin perder lo escrito', async () => {
    let currentItems = createInitialItems();
    const setItems = vi.fn();
    const totales = calcularTotalesPresupuesto({ items: currentItems, capitulos: mockCapitulos, impuestosDetalle: [] });

    render(
      <SmartSheetView
        items={currentItems}
        setItems={setItems}
        capitulos={mockCapitulos}
        totales={totales}
        calculosVariables={{ bocas: 10 }}
      />
    );

    // Clic en cantidad
    const qtyDisplay = screen.getByText('50 m');
    fireEvent.click(qtyDisplay);

    const input = screen.getByDisplayValue('=bocas * 5') as HTMLInputElement;
    // Escribir fórmula inválida con variable inexistente
    fireEvent.change(input, { target: { value: '=variable_fantasma * 2' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // NO debe llamar a setItems porque la fórmula falló
    expect(setItems).not.toHaveBeenCalled();

    // El input retiene lo escrito
    expect(input.value).toBe('=variable_fantasma * 2');

    // Debe mostrar la clase de error roja
    expect(input.className).toContain('border-error');
    expect(input.className).toContain('text-error');
  });

  it('permite crear una nueva línea desde la última fila vacía (Ghost Row)', async () => {
    let currentItems = createInitialItems();
    const setItems = vi.fn((updater) => {
      if (typeof updater === 'function') {
        currentItems = updater(currentItems);
      } else {
        currentItems = updater;
      }
    });

    const totales = calcularTotalesPresupuesto({ items: currentItems, capitulos: mockCapitulos, impuestosDetalle: [] });

    render(
      <SmartSheetView
        items={currentItems}
        setItems={setItems}
        capitulos={mockCapitulos}
        totales={totales}
        calculosVariables={{ bocas: 10 }}
      />
    );

    // Encontrar los inputs de la fila vacía por su placeholder
    const funcionInput = screen.getByPlaceholderText('+ Nueva línea (función o descripción)...');
    const marcaInput = screen.getByPlaceholderText('Marca / Modelo');
    const cantidadInput = screen.getByPlaceholderText('1 o =fórmula');
    const unitarioInput = screen.getByPlaceholderText('0.00');

    // Escribir los datos de la nueva línea
    fireEvent.change(funcionInput, { target: { value: 'Caja octogonal chica' } });
    fireEvent.change(marcaInput, { target: { value: 'Genrod' } });
    fireEvent.change(cantidadInput, { target: { value: '15' } });
    fireEvent.change(unitarioInput, { target: { value: '850' } });

    // Confirmar presionando Enter
    fireEvent.keyDown(unitarioInput, { key: 'Enter', code: 'Enter' });

    // Verificar que setItems agregó la nueva línea al ítem
    expect(setItems).toHaveBeenCalled();
    const updatedItem = currentItems.find(it => it.id === 'item-1')!;
    expect(updatedItem.insumosSnapshot!.length).toBe(2);
    const addedLine = updatedItem.insumosSnapshot![1];
    expect(addedLine.nombre).toBe('Caja octogonal chica');
    expect(addedLine.marca).toBe('Genrod');
    expect(addedLine.cantidadTotal).toBe(15);
    expect(addedLine.precioUnitarioCongelado).toBe(850);
    expect(addedLine.subtotalInsumo).toBe(15 * 850);
  });

  it('elimina una línea solicitando confirmación modal', async () => {
    mockConfirm.mockResolvedValueOnce(true); // Usuario confirma eliminación

    let currentItems = createInitialItems();
    const setItems = vi.fn((updater) => {
      if (typeof updater === 'function') {
        currentItems = updater(currentItems);
      } else {
        currentItems = updater;
      }
    });

    const totales = calcularTotalesPresupuesto({ items: currentItems, capitulos: mockCapitulos, impuestosDetalle: [] });

    render(
      <SmartSheetView
        items={currentItems}
        setItems={setItems}
        capitulos={mockCapitulos}
        totales={totales}
      />
    );

    // Buscar botón de eliminar de la primera línea (Cable unipolar 2.5mm)
    const deleteBtn = screen.getByTitle('Eliminar línea "Cable unipolar 2.5mm"');
    fireEvent.click(deleteBtn);

    // Verificar que se abrió el diálogo de confirmación
    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Eliminar línea',
          isDestructive: true
        })
      );
    });

    // Verificar que la línea de insumo fue eliminada
    const updatedItem = currentItems.find(it => it.id === 'item-1')!;
    expect(updatedItem.insumosSnapshot!.length).toBe(0);
    expect(updatedItem.costoInsumos).toBe(0);
    // Solo queda la mano de obra (40000)
    expect(updatedItem.costoDirectoTotal).toBe(40000);
  });

  it('no elimina la línea si el usuario cancela la confirmación', async () => {
    mockConfirm.mockResolvedValueOnce(false); // Usuario cancela eliminación

    let currentItems = createInitialItems();
    const setItems = vi.fn();
    const totales = calcularTotalesPresupuesto({ items: currentItems, capitulos: mockCapitulos, impuestosDetalle: [] });

    render(
      <SmartSheetView
        items={currentItems}
        setItems={setItems}
        capitulos={mockCapitulos}
        totales={totales}
      />
    );

    const deleteBtn = screen.getByTitle('Eliminar línea "Cable unipolar 2.5mm"');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
    });

    // NO debe llamar a setItems si se canceló
    expect(setItems).not.toHaveBeenCalled();
    expect(currentItems[0].insumosSnapshot!.length).toBe(1);
  });
});
