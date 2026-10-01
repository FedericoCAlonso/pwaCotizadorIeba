import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ManoObraDesktopTable } from './ManoObraDesktopTable';
import { CategoriaManoDeObra } from '../../core/types';
import { CONVENIOS_PREDEFINIDOS } from '../../core/calculations';

describe('ManoObraDesktopTable', () => {
  const mockList: CategoriaManoDeObra[] = [
    {
      id: 'mo-1',
      nombre: 'Oficial Especializado',
      costoHora: 11000,
      costoJornada: 99000,
      horasJornada: 9,
      rol: 'especialista',
      convenioId: 'uocra',
      fechaActualizacion: '2026-10-01T00:00:00.000Z'
    }
  ];

  it('muestra la tabla con la fila de categoría y el input de adición rápida', () => {
    const handleQuickCreate = vi.fn().mockResolvedValue('mo-new');
    render(
      <ManoObraDesktopTable
        manoObraList={mockList}
        conveniosList={CONVENIOS_PREDEFINIDOS}
        onUpdateField={vi.fn()}
        onOpenEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onQuickCreate={handleQuickCreate}
      />
    );

    expect(screen.getByText('Oficial Especializado')).toBeDefined();
    expect(screen.getByPlaceholderText(/agregar nueva categoría rápida/i)).toBeDefined();
  });

  it('permite agregar una categoría rápidamente al presionar enter o botón', async () => {
    const handleQuickCreate = vi.fn().mockResolvedValue('mo-new');
    render(
      <ManoObraDesktopTable
        manoObraList={mockList}
        conveniosList={CONVENIOS_PREDEFINIDOS}
        onUpdateField={vi.fn()}
        onOpenEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onQuickCreate={handleQuickCreate}
      />
    );

    const input = screen.getByPlaceholderText(/agregar nueva categoría rápida/i);
    fireEvent.change(input, { target: { value: 'Ayudante Carpintero' } });

    const addBtn = screen.getByRole('button', { name: /agregar/i });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    expect(handleQuickCreate).toHaveBeenCalledWith('Ayudante Carpintero', 'uocra', 'oficial');
  });

  it('muestra estado vacío amigable si la lista está vacía', () => {
    render(
      <ManoObraDesktopTable
        manoObraList={[]}
        conveniosList={CONVENIOS_PREDEFINIDOS}
        onUpdateField={vi.fn()}
        onOpenEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onQuickCreate={vi.fn()}
      />
    );

    expect(screen.getByText(/no hay categorías de mano de obra definidas/i)).toBeDefined();
  });
});

