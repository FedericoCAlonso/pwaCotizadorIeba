import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileQuantitySheet } from './MobileQuantitySheet';
import { ItemPresupuesto } from '../../../../core/types';

describe('MobileQuantitySheet', () => {
  const mockItem = {
    id: 'item-1',
    descripcion: 'Boca de iluminación embutida',
    cantidad: 5,
    unidad: 'bocas',
    precioFinalItem: 50000,
    costoDirectoTotal: 30000
  } as unknown as ItemPresupuesto;

  it('no renderiza nada si isOpen es false', () => {
    const { container } = render(
      <MobileQuantitySheet
        isOpen={false}
        onClose={vi.fn()}
        item={mockItem}
        onConfirm={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza la cantidad y unidad inicial del ítem', () => {
    render(
      <MobileQuantitySheet
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText('Boca de iluminación embutida')).toBeDefined();
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('bocas')).toBeDefined();
  });

  it('los steppers rápidos (+1, +10, -1, -10) modifican el valor', () => {
    render(
      <MobileQuantitySheet
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        onConfirm={vi.fn()}
      />
    );
    const plus10Btn = screen.getByText('+10');
    fireEvent.click(plus10Btn);
    expect(screen.getByText('15')).toBeDefined();

    const minus1Btn = screen.getByText('-1');
    fireEvent.click(minus1Btn);
    expect(screen.getByText('14')).toBeDefined();
  });

  it('el keypad numérico táctil agrega dígitos y backspace borra', () => {
    render(
      <MobileQuantitySheet
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        onConfirm={vi.fn()}
      />
    );
    // Borrar dígito
    const delBtn = screen.getByLabelText('Borrar dígito');
    fireEvent.click(delBtn);

    // Tocar teclas '2' y '5'
    const key2 = screen.getByText('2');
    const key5 = screen.getByText('5');
    fireEvent.click(key2);
    fireEvent.click(key5);

    expect(screen.getByText('25')).toBeDefined();
  });

  it('al presionar Confirmar Cantidad se dispara onConfirm con el número y se cierra', () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <MobileQuantitySheet
        isOpen={true}
        onClose={handleClose}
        item={mockItem}
        onConfirm={handleConfirm}
      />
    );

    const plus1Btn = screen.getByText('+1');
    fireEvent.click(plus1Btn); // 5 -> 6

    const confirmBtn = screen.getByText('Confirmar Cantidad');
    fireEvent.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledWith(6, undefined);
    expect(handleClose).toHaveBeenCalled();
  });
});
