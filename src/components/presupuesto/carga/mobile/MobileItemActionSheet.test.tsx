import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileItemActionSheet } from './MobileItemActionSheet';
import { ItemPresupuesto } from '../../../../core/types';

describe('MobileItemActionSheet', () => {
  const mockItem: ItemPresupuesto = {
    id: 'item-202',
    descripcion: 'Punto y toma con bastidor Jeluz Verona',
    cantidad: 8,
    unidad: 'boca',
    costoDirectoTotal: 25000,
    precioFinalItem: 40000,
    parametros: [
      { id: 'alzada', etiqueta: 'Alzada', valor: 1.2 }
    ]
  } as unknown as ItemPresupuesto;

  it('no renderiza nada cuando isOpen es false', () => {
    const { container } = render(
      <MobileItemActionSheet
        isOpen={false}
        onClose={vi.fn()}
        item={mockItem}
        isFirst={false}
        isLast={false}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza la información completa de la partida al abrir', () => {
    render(
      <MobileItemActionSheet
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        isFirst={false}
        isLast={false}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText('Punto y toma con bastidor Jeluz Verona')).toBeDefined();
    expect(screen.getByText('8 boca')).toBeDefined();
    expect(screen.getByText(/Final:/)).toBeDefined();
  });

  it('los botones de reorden respetan los límites isFirst e isLast', () => {
    const handleMoveUp = vi.fn();
    const handleMoveDown = vi.fn();

    const { rerender } = render(
      <MobileItemActionSheet
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        isFirst={true}
        isLast={false}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onRemove={vi.fn()}
      />
    );

    const subirBtn = screen.getByLabelText('Subir partida de posición');
    const bajarBtn = screen.getByLabelText('Bajar partida de posición');

    expect((subirBtn as HTMLButtonElement).disabled).toBe(true);
    expect((bajarBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(bajarBtn);
    expect(handleMoveDown).toHaveBeenCalled();

    // Rerender con isLast = true
    rerender(
      <MobileItemActionSheet
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        isFirst={false}
        isLast={true}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onRemove={vi.fn()}
      />
    );

    expect((subirBtn as HTMLButtonElement).disabled).toBe(false);
    expect((bajarBtn as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(subirBtn);
    expect(handleMoveUp).toHaveBeenCalled();
  });

  it('las acciones técnicas disparan sus callbacks y cierran el sheet', () => {
    const handleOpenQuickParams = vi.fn();
    const handleSaveAsTareaTipo = vi.fn();
    const handleClose = vi.fn();

    render(
      <MobileItemActionSheet
        isOpen={true}
        onClose={handleClose}
        item={mockItem}
        isFirst={false}
        isLast={false}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onOpenQuickParams={handleOpenQuickParams}
        onSaveAsTareaTipo={handleSaveAsTareaTipo}
        onRemove={vi.fn()}
      />
    );

    const paramsBtn = screen.getByText('Configurar Parámetros');
    fireEvent.click(paramsBtn);
    expect(handleOpenQuickParams).toHaveBeenCalledWith('item-202');
    expect(handleClose).toHaveBeenCalled();

    const saveCatalogBtn = screen.getByText('Guardar en Catálogo (Tarea Tipo)');
    fireEvent.click(saveCatalogBtn);
    expect(handleSaveAsTareaTipo).toHaveBeenCalledWith(mockItem);
  });

  it('la acción destructiva implementa confirmación segura en 2 pasos', () => {
    const handleRemove = vi.fn();
    const handleClose = vi.fn();

    render(
      <MobileItemActionSheet
        isOpen={true}
        onClose={handleClose}
        item={mockItem}
        isFirst={false}
        isLast={false}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onRemove={handleRemove}
      />
    );

    // Paso 1: Tocar botón inicial
    const deleteBtn = screen.getByText('Eliminar partida');
    fireEvent.click(deleteBtn);

    // Debe mostrar la confirmación inline
    expect(screen.getByText('¿Eliminar esta partida de la cotización?')).toBeDefined();
    expect(handleRemove).not.toHaveBeenCalled();

    // Cancelar en paso 1
    const cancelConfirmBtn = screen.getByText('Cancelar');
    fireEvent.click(cancelConfirmBtn);
    expect(screen.queryByText('¿Eliminar esta partida de la cotización?')).toBeNull();
    expect(handleRemove).not.toHaveBeenCalled();

    // Paso 2: Volver a tocar y confirmar
    fireEvent.click(screen.getByText('Eliminar partida'));
    const confirmBtn = screen.getByText('Sí, Eliminar');
    fireEvent.click(confirmBtn);

    expect(handleRemove).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });

  it('el botón de Cierre de Pulgar y el botón X disparan onClose', () => {
    const handleClose = vi.fn();

    render(
      <MobileItemActionSheet
        isOpen={true}
        onClose={handleClose}
        item={mockItem}
        isFirst={false}
        isLast={false}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    const closeBottomBtn = screen.getByText('Cerrar');
    fireEvent.click(closeBottomBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const closeXBtn = screen.getByLabelText('Cerrar opciones');
    fireEvent.click(closeXBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
