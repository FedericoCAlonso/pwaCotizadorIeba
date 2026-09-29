import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { InlineMaterialSearchAdd } from './InlineMaterialSearchAdd';
import { Insumo } from '../../../core/types';

describe('InlineMaterialSearchAdd', () => {
  const mockInsumosMap = new Map<string, Insumo>([
    [
      'mat-1',
      {
        id: 'mat-1',
        categoriaId: 'cat-cables',
        nombre: 'Cable Unipolar 2.5 mm2',
        unidadVenta: 'm',
        unidad: 'm',
        marca: 'Prysmian',
        precioActual: 350,
        atributos: [],
        activo: true
      }
    ],
    [
      'mat-2',
      {
        id: 'mat-2',
        categoriaId: 'cat-cables',
        nombre: 'Cable Unipolar 4.0 mm2',
        unidadVenta: 'm',
        unidad: 'm',
        marca: 'Prysmian',
        precioActual: 550,
        atributos: [],
        activo: true
      }
    ]
  ]);

  it('renders input with search placeholder', () => {
    render(
      <InlineMaterialSearchAdd
        insumosMap={mockInsumosMap}
        onAddMaterial={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText(/Buscar material en catálogo/i)).toBeDefined();
  });

  it('shows predictive search results in portal when typing 2 or more characters', () => {
    render(
      <InlineMaterialSearchAdd
        insumosMap={mockInsumosMap}
        onAddMaterial={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/Buscar material en catálogo/i);
    fireEvent.change(input, { target: { value: 'Cable' } });

    expect(screen.getByText('Cable Unipolar 2.5 mm2')).toBeDefined();
    expect(screen.getByText('Cable Unipolar 4.0 mm2')).toBeDefined();
  });

  it('selects an item and triggers onAddMaterial on confirm', () => {
    const onAddMaterial = vi.fn();
    render(
      <InlineMaterialSearchAdd
        insumosMap={mockInsumosMap}
        onAddMaterial={onAddMaterial}
      />
    );

    const input = screen.getByPlaceholderText(/Buscar material en catálogo/i);
    fireEvent.change(input, { target: { value: 'Cable 2.5' } });

    const itemToSelect = screen.getByText('Cable Unipolar 2.5 mm2');
    fireEvent.click(itemToSelect);

    const addBtn = screen.getByRole('button', { name: /Agregar/i });
    expect(addBtn).not.toBeNull();
    fireEvent.click(addBtn);

    expect(onAddMaterial).toHaveBeenCalledTimes(1);
    expect(onAddMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mat-1', nombre: 'Cable Unipolar 2.5 mm2' }),
      1,
      undefined
    );
  });
});
