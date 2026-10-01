import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ManoObraRow } from './ManoObraRow';
import { CategoriaManoDeObra } from '../../core/types';
import { CONVENIOS_PREDEFINIDOS } from '../../core/calculations';

describe('ManoObraRow', () => {
  const mockMO: CategoriaManoDeObra = {
    id: 'mo-1',
    nombre: 'Oficial Electricista',
    costoHora: 10000,
    costoJornada: 90000,
    horasJornada: 9,
    rol: 'oficial',
    convenioId: 'uocra',
    fechaActualizacion: '2026-10-01T00:00:00.000Z'
  };

  it('muestra la información de la categoría y permite alternar jornada 9hs/8hs', () => {
    const handleUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <table>
        <tbody>
          <ManoObraRow
            mo={mockMO}
            index={0}
            conveniosList={CONVENIOS_PREDEFINIDOS}
            onUpdateField={handleUpdate}
            onOpenEdit={vi.fn()}
            onDelete={vi.fn()}
            onDuplicate={vi.fn()}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText('Oficial Electricista')).toBeDefined();
    expect(screen.getByText('9 hs')).toBeDefined();

    // Clic en jornada para alternar a 8 hs
    fireEvent.click(screen.getByRole('button', { name: /jornada de 9 horas/i }));
    expect(handleUpdate).toHaveBeenCalledWith('mo-1', 'horasJornada', 8);
  });

  it('permite cambiar el rol de la cuadrilla', () => {
    const handleUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <table>
        <tbody>
          <ManoObraRow
            mo={mockMO}
            index={0}
            conveniosList={CONVENIOS_PREDEFINIDOS}
            onUpdateField={handleUpdate}
            onOpenEdit={vi.fn()}
            onDelete={vi.fn()}
            onDuplicate={vi.fn()}
          />
        </tbody>
      </table>
    );

    const select = screen.getByRole('combobox', { name: /rol para/i });
    fireEvent.change(select, { target: { value: 'especialista' } });
    expect(handleUpdate).toHaveBeenCalledWith('mo-1', 'rol', 'especialista');
  });

  it('abre la edición inline de costo por hora al hacer clic', () => {
    const handleUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <table>
        <tbody>
          <ManoObraRow
            mo={mockMO}
            index={0}
            conveniosList={CONVENIOS_PREDEFINIDOS}
            onUpdateField={handleUpdate}
            onOpenEdit={vi.fn()}
            onDelete={vi.fn()}
            onDuplicate={vi.fn()}
          />
        </tbody>
      </table>
    );

    const horaBtn = screen.getByRole('button', { name: /editar costo por hora/i });
    fireEvent.click(horaBtn);

    const input = screen.getByRole('spinbutton', { name: /editar costo hora/i });
    fireEvent.change(input, { target: { value: '12500' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(handleUpdate).toHaveBeenCalledWith('mo-1', 'costoHora', 12500);
  });

  it('permite duplicar la categoría con un clic', () => {
    const handleDuplicate = vi.fn();
    render(
      <table>
        <tbody>
          <ManoObraRow
            mo={mockMO}
            index={0}
            conveniosList={CONVENIOS_PREDEFINIDOS}
            onUpdateField={vi.fn()}
            onOpenEdit={vi.fn()}
            onDelete={vi.fn()}
            onDuplicate={handleDuplicate}
          />
        </tbody>
      </table>
    );

    const dupBtn = screen.getByRole('button', { name: /duplicar oficial electricista/i });
    fireEvent.click(dupBtn);
    expect(handleDuplicate).toHaveBeenCalledWith('mo-1');
  });
});

