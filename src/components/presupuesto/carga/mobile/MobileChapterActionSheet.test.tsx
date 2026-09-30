import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileChapterActionSheet } from './MobileChapterActionSheet';
import { CapituloPresupuesto } from '../../../../core/types';

describe('MobileChapterActionSheet', () => {
  const mockCapitulo: CapituloPresupuesto = {
    id: 'cap-1',
    nombre: 'Cañerías y Cajas'
  };

  it('no renderiza nada cuando isOpen es false', () => {
    const { container } = render(
      <MobileChapterActionSheet
        isOpen={false}
        onClose={vi.fn()}
        capitulo={mockCapitulo}
        itemCount={3}
        totalPrecio={75000}
        onStartRename={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza el nombre del capítulo, cantidad de partidas y total', () => {
    render(
      <MobileChapterActionSheet
        isOpen={true}
        onClose={vi.fn()}
        capitulo={mockCapitulo}
        itemCount={3}
        totalPrecio={75000}
        onStartRename={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText('Cañerías y Cajas')).toBeDefined();
    expect(screen.getByText('3 partidas')).toBeDefined();
    expect(screen.getByText(/Total:/)).toBeDefined();
  });

  it('el botón de renombrar dispara onStartRename y cierra el sheet', () => {
    const handleStartRename = vi.fn();
    const handleClose = vi.fn();

    render(
      <MobileChapterActionSheet
        isOpen={true}
        onClose={handleClose}
        capitulo={mockCapitulo}
        itemCount={3}
        totalPrecio={75000}
        onStartRename={handleStartRename}
        onRemove={vi.fn()}
      />
    );

    const renameBtn = screen.getByText('Renombrar capítulo');
    fireEvent.click(renameBtn);

    expect(handleStartRename).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });

  it('la eliminación de capítulo solicita confirmación en 2 pasos', () => {
    const handleRemove = vi.fn();
    const handleClose = vi.fn();

    render(
      <MobileChapterActionSheet
        isOpen={true}
        onClose={handleClose}
        capitulo={mockCapitulo}
        itemCount={3}
        totalPrecio={75000}
        onStartRename={vi.fn()}
        onRemove={handleRemove}
      />
    );

    // Paso 1
    const deleteBtn = screen.getByText('Eliminar capítulo');
    fireEvent.click(deleteBtn);

    expect(screen.getByText('¿Eliminar este capítulo completo?')).toBeDefined();
    expect(screen.getByText(/Se eliminarán también las 3 partidas/)).toBeDefined();
    expect(handleRemove).not.toHaveBeenCalled();

    // Cancelar
    const cancelBtn = screen.getByText('Cancelar');
    fireEvent.click(cancelBtn);
    expect(screen.queryByText('¿Eliminar este capítulo completo?')).toBeNull();

    // Paso 2: Volver a presionar y confirmar
    fireEvent.click(screen.getByText('Eliminar capítulo'));
    const confirmBtn = screen.getByText('Sí, Eliminar');
    fireEvent.click(confirmBtn);

    expect(handleRemove).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });

  it('el botón Cerrar y el botón X disparan onClose', () => {
    const handleClose = vi.fn();

    render(
      <MobileChapterActionSheet
        isOpen={true}
        onClose={handleClose}
        capitulo={mockCapitulo}
        itemCount={3}
        totalPrecio={75000}
        onStartRename={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    const closeBtn = screen.getByText('Cerrar');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const closeXBtn = screen.getByLabelText('Cerrar opciones del capítulo');
    fireEvent.click(closeXBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
