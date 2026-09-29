import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileTreeItemCard } from './MobileTreeItemCard';
import { ItemPresupuesto } from '../../../../core/types';

describe('MobileTreeItemCard', () => {
  const mockItem: ItemPresupuesto = {
    id: 'item-101',
    descripcion: 'Canalización con caño corrugado 3/4"',
    cantidad: 12,
    unidad: 'm',
    precioFinalItem: 24000,
    costoDirectoTotal: 15000,
    insumosSnapshot: [
      {
        materialId: 'mat-1',
        nombre: 'Caño 3/4',
        unidad: 'm',
        cantidadTotal: 12,
        precioUnitarioCongelado: 500,
        subtotalInsumo: 6000
      }
    ]
  } as unknown as ItemPresupuesto;

  it('renderiza la descripción, unidad y precios calculados', () => {
    render(
      <MobileTreeItemCard
        item={mockItem}
        isSelected={false}
        onSelect={vi.fn()}
        onOpenQuantitySheet={vi.fn()}
        onQuickStepQty={vi.fn()}
        onOpenDetail={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText('Canalización con caño corrugado 3/4"')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('m')).toBeDefined();
    expect(screen.getByText('1 rubro')).toBeDefined();
  });

  it('los steppers rápidos [-] y [+] disparan onQuickStepQty(-1) y (+1)', () => {
    const handleQuickStep = vi.fn();

    render(
      <MobileTreeItemCard
        item={mockItem}
        isSelected={false}
        onSelect={vi.fn()}
        onOpenQuantitySheet={vi.fn()}
        onQuickStepQty={handleQuickStep}
        onOpenDetail={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    const minusBtn = screen.getByLabelText('Restar 1 unidad');
    fireEvent.click(minusBtn);
    expect(handleQuickStep).toHaveBeenCalledWith(-1);

    const plusBtn = screen.getByLabelText('Sumar 1 unidad');
    fireEvent.click(plusBtn);
    expect(handleQuickStep).toHaveBeenCalledWith(1);
  });

  it('al pulsar el botón central de cantidad se dispara onOpenQuantitySheet', () => {
    const handleOpenSheet = vi.fn();

    render(
      <MobileTreeItemCard
        item={mockItem}
        isSelected={false}
        onSelect={vi.fn()}
        onOpenQuantitySheet={handleOpenSheet}
        onQuickStepQty={vi.fn()}
        onOpenDetail={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    const qtyPill = screen.getByTitle('Tocar para editar cantidad con keypad');
    fireEvent.click(qtyPill);
    expect(handleOpenSheet).toHaveBeenCalled();
  });

  it('el botón de Detalle y Despiece dispara onOpenDetail', () => {
    const handleOpenDetail = vi.fn();

    render(
      <MobileTreeItemCard
        item={mockItem}
        isSelected={false}
        onSelect={vi.fn()}
        onOpenQuantitySheet={vi.fn()}
        onQuickStepQty={vi.fn()}
        onOpenDetail={handleOpenDetail}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    const detailBtn = screen.getByLabelText(`Ver desglose y despiece de ${mockItem.descripcion}`);
    fireEvent.click(detailBtn);
    expect(handleOpenDetail).toHaveBeenCalled();
  });

  it('el menú contextual táctil abre las opciones de mover y eliminar', () => {
    const handleMoveUp = vi.fn();
    const handleRemove = vi.fn();

    render(
      <MobileTreeItemCard
        item={mockItem}
        isSelected={false}
        onSelect={vi.fn()}
        onOpenQuantitySheet={vi.fn()}
        onQuickStepQty={vi.fn()}
        onOpenDetail={vi.fn()}
        onMoveUp={handleMoveUp}
        onMoveDown={vi.fn()}
        onRemove={handleRemove}
      />
    );

    const menuBtn = screen.getByLabelText('Acciones de la partida');
    fireEvent.click(menuBtn);

    const moveUpItem = screen.getByText('Mover arriba');
    fireEvent.click(moveUpItem);
    expect(handleMoveUp).toHaveBeenCalled();

    // Reabrir menú para probar eliminar
    fireEvent.click(menuBtn);
    const removeItem = screen.getByText('Eliminar partida');
    fireEvent.click(removeItem);
    expect(handleRemove).toHaveBeenCalled();
  });
});
