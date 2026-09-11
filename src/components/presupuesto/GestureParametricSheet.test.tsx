import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { GestureParametricSheet } from './GestureParametricSheet';
import { TareaTipo } from '../../core/types';
import { ConsumosCalculadosResultado } from '../../core/calculations';

describe('GestureParametricSheet', () => {
  const mockTarea: TareaTipo = {
    id: 'tt-test-acu',
    nombre: 'Alimentación Carga Única (ACU)',
    categoria: 'Fuerza Motriz',
    unidad: 'circuito',
    parametros: [
      {
        id: 'distancia_metros',
        nombre: 'Distancia al Tablero',
        tipo: 'numero',
        valorDefault: 12,
        unidad: 'm'
      },
      {
        id: 'tipo_canalizacion',
        nombre: 'Tipo de Canalización',
        tipo: 'select',
        valorDefault: 1,
        opciones: [
          { id: 'opc-existente', label: 'Existente', valor: 1 },
          { id: 'opc-cablecanal', label: 'Cablecanal', valor: 2 }
        ]
      }
    ],
    insumos: [],
    manoObra: []
  };

  const mockCalculos: ConsumosCalculadosResultado = {
    cantidadPrincipal: 1,
    valoresParametros: {},
    valoresVariables: { metros_cable: 36 },
    scope: {},
    costoFijoOperativo: 0,
    insumosSnapshot: [],
    manoObraSnapshot: [],
    costoInsumosTotal: 25000,
    costoManoObraTotal: 45000,
    costoDirectoTotal: 70000
  };

  it('renders job title and initial parameter display correctly', () => {
    render(
      <GestureParametricSheet
        tarea={mockTarea}
        parametrosValues={{ distancia_metros: 14 }}
        onParametroChange={vi.fn()}
        calculosResultado={mockCalculos}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
        onSwitchToClassic={vi.fn()}
      />
    );

    expect(screen.getByText('Alimentación Carga Única (ACU)')).toBeDefined();
    expect(screen.getByText('Distancia al Tablero')).toBeDefined();
    expect(screen.getByText('14 m')).toBeDefined();
  });

  it('navigates between parameters using arrows', () => {
    render(
      <GestureParametricSheet
        tarea={mockTarea}
        parametrosValues={{ distancia_metros: 12, tipo_canalizacion: 1 }}
        onParametroChange={vi.fn()}
        calculosResultado={mockCalculos}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
        onSwitchToClassic={vi.fn()}
      />
    );

    expect(screen.getByText('Distancia al Tablero')).toBeDefined();

    // Find next chevron button
    const buttons = screen.getAllByRole('button');
    const chevronRightBtn = buttons.find(b => b.querySelector('svg.lucide-chevron-right'));
    if (chevronRightBtn) {
      fireEvent.click(chevronRightBtn);
      expect(screen.getByText('Tipo de Canalización')).toBeDefined();
    }
  });

  it('triggers onConfirm when confirmation button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <GestureParametricSheet
        tarea={mockTarea}
        parametrosValues={{ distancia_metros: 12 }}
        onParametroChange={vi.fn()}
        calculosResultado={mockCalculos}
        onConfirm={onConfirm}
        onClose={vi.fn()}
        onSwitchToClassic={vi.fn()}
      />
    );

    const confirmBtn = screen.getByText(/Confirmar y Agregar/i);
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('triggers onSwitchToClassic when mode switch button is clicked', () => {
    const onSwitchToClassic = vi.fn();
    render(
      <GestureParametricSheet
        tarea={mockTarea}
        parametrosValues={{ distancia_metros: 12 }}
        onParametroChange={vi.fn()}
        calculosResultado={mockCalculos}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
        onSwitchToClassic={onSwitchToClassic}
      />
    );

    const switchBtn = screen.getByTitle('Ver formulario clásico');
    fireEvent.click(switchBtn);
    expect(onSwitchToClassic).toHaveBeenCalledTimes(1);
  });
});
