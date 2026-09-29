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
});
