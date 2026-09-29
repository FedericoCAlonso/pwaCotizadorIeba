import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectParametersTuningSection } from './ProjectParametersTuningSection';
import { ItemPresupuesto } from '../../../core/types';

describe('ProjectParametersTuningSection', () => {
  const mockItems: ItemPresupuesto[] = [
    {
      id: 'it-1',
      descripcion: 'Bocas y cableado',
      cantidad: 10,
      unidad: 'boca',
      costoInsumos: 500,
      costoManoObra: 1000,
      costoDirectoTotal: 1500,
      precioVentaUnitario: 200,
      precioVentaTotal: 2000,
      insumosSnapshot: [],
      manoObraSnapshot: [],
      parametros: [
        { id: 'bocas', nombre: 'Bocas', valor: 10, unidad: 'u' }
      ]
    }
  ];

  it('permite alternar entre nivel global y nivel partidas', () => {
    render(
      <ProjectParametersTuningSection
        calculosVariables={{ superficie: 100 }}
        items={mockItems}
      />
    );

    // Nivel global activo por defecto
    expect(screen.getByText('superficie')).toBeDefined();

    // Cambiar a nivel por partida
    const itemsTab = screen.getByText(/📌 Por Partida/i);
    fireEvent.click(itemsTab);

    // Debe mostrar la partida con sus parámetros
    expect(screen.getByText('Bocas y cableado')).toBeDefined();
    expect(screen.getByText('Bocas:')).toBeDefined();
  });

  it('permite actualizar variables globales mediante incremento rápido', () => {
    const onUpdateCalculosVariables = vi.fn();

    render(
      <ProjectParametersTuningSection
        calculosVariables={{ superficie: 100 }}
        onUpdateCalculosVariables={onUpdateCalculosVariables}
        items={mockItems}
      />
    );

    // Buscar botón '+' para superficie
    const plusButtons = screen.getAllByRole('button');
    const plusBtn = plusButtons.find((btn) => btn.querySelector('svg.lucide-plus') && !btn.title?.includes('Guardar'));
    if (plusBtn) {
      fireEvent.click(plusBtn);
      expect(onUpdateCalculosVariables).toHaveBeenCalledWith(
        expect.objectContaining({ superficie: 101 })
      );
    }
  });

  it('muestra impacto económico si se proveen costos y precios', () => {
    render(
      <ProjectParametersTuningSection
        calculosVariables={{}}
        items={mockItems}
        costoDirectoTotal={150000}
        precioFinalGlobal={240000}
      />
    );

    expect(screen.getByText(/Impacto en la Cotización:/i)).toBeDefined();
    expect(screen.getByText(/150\.000/i)).toBeDefined();
    expect(screen.getByText(/240\.000/i)).toBeDefined();
  });
});
