import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemQuantityCell } from './ItemQuantityCell';
import { ItemPresupuesto } from '../../../core/types';

describe('ItemQuantityCell', () => {
  const baseItem: ItemPresupuesto = {
    id: 'it-1',
    capituloId: 'cap-1',
    descripcion: 'Punto de luz',
    cantidad: 10,
    unidad: 'boca',
    costoInsumos: 0,
    costoManoObra: 0,
    costoDirectoTotal: 0,
    precioVentaUnitario: 0,
    precioVentaTotal: 0,
    insumosSnapshot: [],
    manoObraSnapshot: []
  };

  it('muestra la cantidad y la unidad en modo lectura', () => {
    render(
      <ItemQuantityCell
        item={baseItem}
        isEditingQty={false}
        onStartEditQty={vi.fn()}
        onUpdateEditingCellValue={vi.fn()}
        onCommitEditCell={vi.fn()}
        onCancelEditCell={vi.fn()}
      />
    );

    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText('boca')).toBeDefined();
  });

  it('llama a onStartEditQty al hacer doble clic en la cantidad', () => {
    const handleStartEdit = vi.fn();
    render(
      <ItemQuantityCell
        item={baseItem}
        isEditingQty={false}
        onStartEditQty={handleStartEdit}
        onUpdateEditingCellValue={vi.fn()}
        onCommitEditCell={vi.fn()}
        onCancelEditCell={vi.fn()}
      />
    );

    const qtySpan = screen.getByText('10');
    fireEvent.doubleClick(qtySpan);
    expect(handleStartEdit).toHaveBeenCalled();
  });

  it('en modo edición muestra el input y previsualiza fórmulas en vivo con "="', () => {
    const handleUpdate = vi.fn();
    const handleCommit = vi.fn();

    render(
      <ItemQuantityCell
        item={baseItem}
        isEditingQty={true}
        editingValue="=5 * 4"
        onStartEditQty={vi.fn()}
        onUpdateEditingCellValue={handleUpdate}
        onCommitEditCell={handleCommit}
        onCancelEditCell={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('10 o =superficie * 2') as HTMLInputElement;
    expect(input.value).toBe('=5 * 4');

    // Previsualización de fórmula evaluada en vivo
    expect(screen.getByText('≈ 20')).toBeDefined();

    // Presionar Enter confirma
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(handleCommit).toHaveBeenCalledWith('cantidad', '=5 * 4');
  });

  it('cancela la edición al presionar Escape', () => {
    const handleCancel = vi.fn();

    render(
      <ItemQuantityCell
        item={baseItem}
        isEditingQty={true}
        editingValue="15"
        onStartEditQty={vi.fn()}
        onUpdateEditingCellValue={vi.fn()}
        onCommitEditCell={vi.fn()}
        onCancelEditCell={handleCancel}
      />
    );

    const input = screen.getByPlaceholderText('10 o =superficie * 2');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(handleCancel).toHaveBeenCalled();
  });
});
