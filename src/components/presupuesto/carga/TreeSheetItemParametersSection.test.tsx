import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TreeSheetItemParametersSection } from './TreeSheetItemParametersSection';

describe('TreeSheetItemParametersSection', () => {
  it('permite agregar un nuevo parámetro local y muestra variables globales', () => {
    const onUpdateParametros = vi.fn();

    render(
      <TreeSheetItemParametersSection
        parametros={[{ id: 'largo', nombre: 'largo', valor: 15, unidad: 'm', origen: 'propio' }]}
        calculosVariables={{ superficie: 150, trifasica: 1 }}
        onUpdateParametros={onUpdateParametros}
      />
    );

    // Debe mostrar el parámetro local existente
    expect(screen.getByText('largo')).toBeDefined();
    expect(screen.getByText('15')).toBeDefined();
    expect(screen.getByText('m')).toBeDefined();

    // Debe mostrar las variables globales disponibles
    expect(screen.getByText('superficie')).toBeDefined();
    expect(screen.getByText('=150')).toBeDefined();
    expect(screen.getByText('trifasica')).toBeDefined();

    // Formulario de nuevo parámetro local
    const idInput = screen.getByPlaceholderText(/Identificador/i);
    const valInput = screen.getByPlaceholderText(/Valor o =fórmula/i);
    const saveBtn = screen.getByText(/Guardar/i);

    fireEvent.change(idInput, { target: { value: 'bocas' } });
    fireEvent.change(valInput, { target: { value: '12' } });
    fireEvent.click(saveBtn);

    expect(onUpdateParametros).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'largo', valor: 15 }),
        expect.objectContaining({ id: 'bocas', valor: 12 })
      ])
    );
  });

  it('permite agregar una nueva variable de cálculo interno con fórmula matemática y tipo "variable"', () => {
    const onUpdateParametros = vi.fn();

    render(
      <TreeSheetItemParametersSection
        parametros={[{ id: 'largo', nombre: 'largo', valor: 15, unidad: 'm', origen: 'propio' }]}
        calculosVariables={{ factor: 2 }}
        onUpdateParametros={onUpdateParametros}
      />
    );

    // Seleccionar modalidad Variable
    const variableTabBtn = screen.getByRole('button', { name: /Variable \(Cálculo interno\)/i });
    fireEvent.click(variableTabBtn);

    const idInput = screen.getByPlaceholderText(/Identificador/i);
    const descInput = screen.getByPlaceholderText(/Descripción \/ Etiqueta humana/i);
    const formulaInput = screen.getByPlaceholderText(/Fórmula matemática/i);
    const saveBtn = screen.getByRole('button', { name: /Guardar/i });

    fireEvent.change(idInput, { target: { value: 'cable_total' } });
    fireEvent.change(descInput, { target: { value: 'Total de conductores' } });
    fireEvent.change(formulaInput, { target: { value: 'largo * factor' } });

    // Previsualización en vivo (15 * 2 = 30)
    expect(screen.getByText('≈ 30')).toBeDefined();

    fireEvent.click(saveBtn);

    expect(onUpdateParametros).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'largo', valor: 15 }),
        expect.objectContaining({
          id: 'cable_total',
          nombre: 'Total de conductores',
          descripcion: 'Total de conductores',
          tipo: 'variable',
          formula: '=largo * factor',
          valor: 30
        })
      ])
    );
  });

  it('muestra bloques diferenciados para Parámetros de Entrada y Variables de Cálculo Interno', () => {
    const onUpdateParametros = vi.fn();

    render(
      <TreeSheetItemParametersSection
        parametros={[
          { id: 'bocas', nombre: 'Cantidad de Bocas', valor: 10, tipo: 'parametro' },
          { id: 'cable', nombre: 'Metros de Cable', valor: 25, formula: '=bocas * 2.5', tipo: 'variable' }
        ]}
        calculosVariables={{}}
        onUpdateParametros={onUpdateParametros}
      />
    );

    expect(screen.getByText(/Parámetros de Entrada \(1\)/i)).toBeDefined();
    expect(screen.getByText(/Variables de Cálculo Interno \(1\)/i)).toBeDefined();
    expect(screen.getByText('$bocas')).toBeDefined();
    expect(screen.getByText('$cable')).toBeDefined();

    // Eliminar variable
    const deleteButtons = screen.getAllByTitle(/Eliminar/i);
    expect(deleteButtons.length).toBe(2);
    fireEvent.click(deleteButtons[1]); // Eliminar variable 'cable'

    expect(onUpdateParametros).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'bocas', valor: 10 })
    ]);
  });
});
