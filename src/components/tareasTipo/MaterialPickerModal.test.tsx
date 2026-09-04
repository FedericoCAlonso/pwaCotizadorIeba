import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MaterialPickerModal } from './MaterialPickerModal';
import { Insumo } from '../../core/types';

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => []
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    toast: {
      success: vi.fn(),
      info: vi.fn(),
      error: vi.fn()
    }
  })
}));

describe('MaterialPickerModal - Selección por Lote con Cantidad Compartida', () => {
  const mockInsumos: Insumo[] = [
    {
      id: 'cable-celeste',
      nombre: 'Cable Unipolar 2,5 mm² Celeste',
      categoria: 'Conductores',
      categoriaId: 'cat1',
      unidad: 'm',
      unidadVenta: 'm',
      precioActual: 850,
      atributos: [],
      activo: true
    },
    {
      id: 'cable-marron',
      nombre: 'Cable Unipolar 2,5 mm² Marrón',
      categoria: 'Conductores',
      categoriaId: 'cat1',
      unidad: 'm',
      unidadVenta: 'm',
      precioActual: 850,
      atributos: [],
      activo: true
    },
    {
      id: 'cable-verde-amarillo',
      nombre: 'Cable Unipolar 2,5 mm² Verde/Amarillo',
      categoria: 'Conductores',
      categoriaId: 'cat1',
      unidad: 'm',
      unidadVenta: 'm',
      precioActual: 850,
      atributos: [],
      activo: true
    },
    {
      id: 'cano-corrugado',
      nombre: 'Caño Corrugado Blanco 3/4"',
      categoria: 'Canalizaciones',
      categoriaId: 'cat2',
      unidad: 'm',
      unidadVenta: 'm',
      precioActual: 500,
      atributos: [],
      activo: true
    }
  ];

  const insumosMap = new Map<string, Insumo>(mockInsumos.map(i => [i.id, i]));

  it('permite tildar cables fase, neutro y tierra, asignar cantidad 5 e incorporar los 3 en lote', () => {
    const onAddMultipleMaterials = vi.fn();
    const onClose = vi.fn();

    render(
      <MaterialPickerModal
        isOpen={true}
        onClose={onClose}
        insumosMap={insumosMap}
        onAddMaterial={vi.fn()}
        onAddMultipleMaterials={onAddMultipleMaterials}
      />
    );

    // 1. Tildar los 3 cables mediante su botón de selección
    const btnCeleste = screen.getByLabelText('Seleccionar Cable Unipolar 2,5 mm² Celeste');
    const btnMarron = screen.getByLabelText('Seleccionar Cable Unipolar 2,5 mm² Marrón');
    const btnTierra = screen.getByLabelText('Seleccionar Cable Unipolar 2,5 mm² Verde/Amarillo');

    fireEvent.click(btnCeleste);
    fireEvent.click(btnMarron);
    fireEvent.click(btnTierra);

    // 2. La barra de lote debe mostrar 3 seleccionados
    expect(screen.getByText(/3 materiales seleccionados/i)).toBeDefined();

    // 3. Modificar la cantidad común a 5
    const batchInput = screen.getByDisplayValue('1');
    fireEvent.change(batchInput, { target: { value: '5' } });
    fireEvent.blur(batchInput);

    // 4. Presionar el botón de incorporación directa en lote "Incorporar (3)"
    const btnIncorporar = screen.getByRole('button', { name: /Incorporar \(3\)/i });
    fireEvent.click(btnIncorporar);

    // 5. Verificar que se enviaron los 3 materiales con cantidad 5 cada uno
    expect(onAddMultipleMaterials).toHaveBeenCalledTimes(1);
    const addedItems = onAddMultipleMaterials.mock.calls[0][0];
    expect(addedItems).toHaveLength(3);

    expect(addedItems[0].material.id).toBe('cable-celeste');
    expect(addedItems[0].cantidad).toBe(5);

    expect(addedItems[1].material.id).toBe('cable-marron');
    expect(addedItems[1].cantidad).toBe(5);

    expect(addedItems[2].material.id).toBe('cable-verde-amarillo');
    expect(addedItems[2].cantidad).toBe(5);

    expect(onClose).toHaveBeenCalled();
  });
});
