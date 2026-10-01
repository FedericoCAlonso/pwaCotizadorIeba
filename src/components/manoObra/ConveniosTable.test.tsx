import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConveniosTable } from './ConveniosTable';
import { ConvenioLaboral } from '../../core/types';

describe('ConveniosTable', () => {
  const mockConvenios: ConvenioLaboral[] = [
    {
      id: 'uocra',
      nombre: 'UOCRA (Construcción)',
      cargasSocialesPct: 65,
      gastosDirectosOperarioDefecto: 5000,
      horasJornadaDefecto: 9,
      descripcion: 'Convenio general de obras',
      adicionales: {
        adicionalTrabajoAltura: 0.20
      }
    },
    {
      id: 'uom',
      nombre: 'UOM (Metalúrgicos)',
      cargasSocialesPct: 52,
      gastosDirectosOperarioDefecto: 4000,
      horasJornadaDefecto: 8,
      descripcion: 'Talleres y tableristas',
      adicionales: {}
    }
  ];

  it('renderiza la planilla de convenios con sus columnas y datos', () => {
    render(
      <ConveniosTable
        conveniosList={mockConvenios}
        onOpenCreate={vi.fn()}
        onOpenEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onUpdateField={vi.fn()}
        onQuickCreate={vi.fn()}
      />
    );

    expect(screen.getByText('UOCRA (Construcción)')).toBeDefined();
    expect(screen.getByText('UOM (Metalúrgicos)')).toBeDefined();
    expect(screen.getByText('65%')).toBeDefined();
    expect(screen.getByText('52%')).toBeDefined();
    expect(screen.getByText('9 hs')).toBeDefined();
    expect(screen.getByText('8 hs')).toBeDefined();
    expect(screen.getByPlaceholderText(/nuevo régimen o convenio laboral/i)).toBeDefined();
  });

  it('permite alternar jornada base de 9hs a 8hs con un clic', () => {
    const handleUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <ConveniosTable
        conveniosList={mockConvenios}
        onOpenCreate={vi.fn()}
        onOpenEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onUpdateField={handleUpdate}
        onQuickCreate={vi.fn()}
      />
    );

    const jornadaBtn = screen.getByRole('button', { name: /jornada de 9 horas para uocra/i });
    fireEvent.click(jornadaBtn);
    expect(handleUpdate).toHaveBeenCalledWith('uocra', 'horasJornadaDefecto', 8);
  });

  it('permite duplicar un convenio con 1 clic', () => {
    const handleDuplicate = vi.fn();
    render(
      <ConveniosTable
        conveniosList={mockConvenios}
        onOpenCreate={vi.fn()}
        onOpenEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={handleDuplicate}
        onUpdateField={vi.fn()}
        onQuickCreate={vi.fn()}
      />
    );

    const dupBtn = screen.getByRole('button', { name: /duplicar uocra/i });
    fireEvent.click(dupBtn);
    expect(handleDuplicate).toHaveBeenCalledWith('uocra');
  });

  it('permite agregar un convenio rápidamente mediante el formulario inferior', async () => {
    const handleQuickCreate = vi.fn().mockResolvedValue('cct-new');
    render(
      <ConveniosTable
        conveniosList={mockConvenios}
        onOpenCreate={vi.fn()}
        onOpenEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onUpdateField={vi.fn()}
        onQuickCreate={handleQuickCreate}
      />
    );

    const nameInput = screen.getByPlaceholderText(/nuevo régimen o convenio laboral/i);
    fireEvent.change(nameInput, { target: { value: 'Petroleros CCT 644/12' } });

    const pctInput = screen.getByRole('spinbutton', { name: /cargas sociales porcentaje rápido/i });
    fireEvent.change(pctInput, { target: { value: '72' } });

    const addBtn = screen.getByRole('button', { name: /agregar convenio/i });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    expect(handleQuickCreate).toHaveBeenCalledWith('Petroleros CCT 644/12', 72);
  });

  it('muestra estado amigable si la lista está vacía', () => {
    render(
      <ConveniosTable
        conveniosList={[]}
        onOpenCreate={vi.fn()}
        onOpenEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onUpdateField={vi.fn()}
        onQuickCreate={vi.fn()}
      />
    );

    expect(screen.getByText(/no hay convenios laborales registrados/i)).toBeDefined();
  });
});
