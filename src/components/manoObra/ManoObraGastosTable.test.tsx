import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ManoObraGastosTable } from './ManoObraGastosTable';
import { CostoIndirecto } from '../../core/types';

describe('ManoObraGastosTable', () => {
  const mockGastos: CostoIndirecto[] = [
    {
      id: 'gasto-1',
      nombre: 'Fondo de Cese Laboral y Previsión',
      destino: 'mano_obra',
      modalidad: 'porcentual',
      valor: 12,
      incluirPorDefecto: true
    },
    {
      id: 'gasto-2',
      nombre: 'Alquiler de Andamios y Plataformas',
      destino: 'costo_indirecto',
      modalidad: 'monto_fijo',
      valor: 85000,
      incluirPorDefecto: false
    }
  ];

  it('muestra la planilla de gastos con sus filas correspondientes', () => {
    render(
      <ManoObraGastosTable
        gastosList={mockGastos}
        onOpenCreate={vi.fn()}
        onOpenEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onToggleDefault={vi.fn()}
        onUpdateField={vi.fn()}
        onQuickCreate={vi.fn()}
      />
    );

    expect(screen.getByText('Fondo de Cese Laboral y Previsión')).toBeDefined();
    expect(screen.getByText('Alquiler de Andamios y Plataformas')).toBeDefined();
    expect(screen.getByText('12%')).toBeDefined();
    expect(screen.getByPlaceholderText(/nuevo gasto o concepto/i)).toBeDefined();
  });

  it('permite alternar el switch de incluir por defecto', () => {
    const handleToggle = vi.fn();
    render(
      <ManoObraGastosTable
        gastosList={mockGastos}
        onOpenCreate={vi.fn()}
        onOpenEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onToggleDefault={handleToggle}
        onUpdateField={vi.fn()}
        onQuickCreate={vi.fn()}
      />
    );

    const toggleBtns = screen.getAllByRole('button', { name: /por defecto/i });
    fireEvent.click(toggleBtns[0]);
    expect(handleToggle).toHaveBeenCalledWith(mockGastos[0]);
  });

  it('permite duplicar un gasto con un solo clic', () => {
    const handleDuplicate = vi.fn();
    render(
      <ManoObraGastosTable
        gastosList={mockGastos}
        onOpenCreate={vi.fn()}
        onOpenEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={handleDuplicate}
        onToggleDefault={vi.fn()}
        onUpdateField={vi.fn()}
        onQuickCreate={vi.fn()}
      />
    );

    const dupBtn = screen.getByRole('button', { name: /duplicar fondo de cese/i });
    fireEvent.click(dupBtn);
    expect(handleDuplicate).toHaveBeenCalledWith('gasto-1');
  });

  it('permite agregar un gasto rápidamente con el formulario inferior', async () => {
    const handleQuickCreate = vi.fn().mockResolvedValue('gasto-new');
    render(
      <ManoObraGastosTable
        gastosList={mockGastos}
        onOpenCreate={vi.fn()}
        onOpenEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onToggleDefault={vi.fn()}
        onUpdateField={vi.fn()}
        onQuickCreate={handleQuickCreate}
      />
    );

    const input = screen.getByPlaceholderText(/nuevo gasto o concepto/i);
    fireEvent.change(input, { target: { value: 'Seguro de ART' } });

    const addBtn = screen.getByRole('button', { name: /agregar/i });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    expect(handleQuickCreate).toHaveBeenCalledWith('Seguro de ART', 'costo_indirecto', 'porcentual', 5);
  });

  it('muestra estado vacío amigable cuando no hay gastos', () => {
    render(
      <ManoObraGastosTable
        gastosList={[]}
        onOpenCreate={vi.fn()}
        onOpenEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onToggleDefault={vi.fn()}
        onUpdateField={vi.fn()}
        onQuickCreate={vi.fn()}
      />
    );

    expect(screen.getByText(/no hay gastos configurados en el catálogo/i)).toBeDefined();
  });
});
