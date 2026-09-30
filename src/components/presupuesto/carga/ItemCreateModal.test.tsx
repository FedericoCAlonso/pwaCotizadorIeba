import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemCreateModal } from './ItemCreateModal';

describe('ItemCreateModal', () => {
  it('no renderiza nada si isOpen es false', () => {
    const { container } = render(
      <ItemCreateModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza el rubro asignado y los campos iniciales cuando isOpen es true', () => {
    render(
      <ItemCreateModal
        isOpen={true}
        capituloNombre="Instalación Eléctrica"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText('En Rubro: Instalación Eléctrica')).toBeDefined();
    expect(screen.getByPlaceholderText(/Boca de iluminación living/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Crear Ítem/i })).toBeDefined();
  });

  it('el botón de crear ítem está deshabilitado si la descripción está vacía', () => {
    render(
      <ItemCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Crear Ítem/i });
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    const inputDesc = screen.getByPlaceholderText(/Boca de iluminación living/i);
    fireEvent.change(inputDesc, { target: { value: '   ' } });
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });

  it('permite ingresar descripción, seleccionar unidad y cantidad y disparar onConfirm', () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <ItemCreateModal
        isOpen={true}
        capituloNombre="Rubro 1"
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    );

    const inputDesc = screen.getByPlaceholderText(/Boca de iluminación living/i);
    fireEvent.change(inputDesc, { target: { value: 'Tomacorriente doble' } });

    // Seleccionar chip de unidad "boca"
    const bocaChip = screen.getByRole('button', { name: 'boca' });
    fireEvent.click(bocaChip);

    // Cambiar cantidad
    const inputCant = screen.getByDisplayValue('1');
    fireEvent.change(inputCant, { target: { value: '5' } });

    const submitBtn = screen.getByRole('button', { name: /Crear Ítem/i });
    expect(submitBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(submitBtn);

    expect(handleConfirm).toHaveBeenCalledWith({
      descripcion: 'Tomacorriente doble',
      unidad: 'boca',
      cantidad: 5
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it('permite cancelar con el botón Cancelar', () => {
    const handleClose = vi.fn();
    render(
      <ItemCreateModal
        isOpen={true}
        onClose={handleClose}
        onConfirm={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancelar/i });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
