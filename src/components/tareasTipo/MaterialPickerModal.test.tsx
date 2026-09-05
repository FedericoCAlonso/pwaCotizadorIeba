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

  it('filtra dinámicamente los chips de categoría al escribir en la búsqueda', () => {
    render(
      <MaterialPickerModal
        isOpen={true}
        onClose={vi.fn()}
        insumosMap={insumosMap}
        onAddMaterial={vi.fn()}
      />
    );

    // Inicialmente: insumos en cat1 y cat2
    expect(screen.getByRole('button', { name: /Todas/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^cat1$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^cat2$/i })).toBeDefined();

    // Buscar "corrugado"
    const searchInput = screen.getByPlaceholderText(/Buscar por nombre/i);
    fireEvent.change(searchInput, { target: { value: 'corrugado' } });

    // Ahora sólo debe figurar el chip de categoría cat2 y "Todas". cat1 ya no tiene coincidencias y se oculta.
    expect(screen.getByRole('button', { name: /^cat2$/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^cat1$/i })).toBeNull();

    // Limpiar búsqueda
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByRole('button', { name: /^cat1$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^cat2$/i })).toBeDefined();
  });

  it('permite alternar entre colapsar y expandir cuando hay más de 3 categorías', () => {
    const manyCategoriesInsumos: Insumo[] = [
      ...mockInsumos,
      {
        id: 'termica-20a',
        nombre: 'Termomagnética 20A',
        categoriaId: 'cat3',
        unidad: 'u',
        unidadVenta: 'u',
        precioActual: 12000,
        atributos: [],
        activo: true
      },
      {
        id: 'disyuntor-25a',
        nombre: 'Disyuntor Diferencial 25A',
        categoriaId: 'cat4',
        unidad: 'u',
        unidadVenta: 'u',
        precioActual: 24000,
        atributos: [],
        activo: true
      }
    ];

    const largeMap = new Map<string, Insumo>(manyCategoriesInsumos.map(i => [i.id, i]));

    render(
      <MaterialPickerModal
        isOpen={true}
        onClose={vi.fn()}
        insumosMap={largeMap}
        onAddMaterial={vi.fn()}
      />
    );

    // Debe mostrar el botón "Ver todas"
    const toggleBtn = screen.getByRole('button', { name: /Ver todas/i });
    expect(toggleBtn).toBeDefined();

    // Clic para expandir
    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /Colapsar fila/i })).toBeDefined();

    // Clic para colapsar
    fireEvent.click(screen.getByRole('button', { name: /Colapsar fila/i }));
    expect(screen.getByRole('button', { name: /Ver todas/i })).toBeDefined();
  });
});

