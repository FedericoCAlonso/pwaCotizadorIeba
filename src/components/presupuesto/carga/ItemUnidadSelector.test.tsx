import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemUnidadSelector } from './ItemUnidadSelector';

describe('ItemUnidadSelector', () => {
  it('muestra la unidad actual por defecto', () => {
    render(<ItemUnidadSelector unidad="m" onChangeUnidad={vi.fn()} />);
    expect(screen.getByText('m')).toBeDefined();
  });

  it('abre el menú desplegable al hacer clic y permite seleccionar una unidad frecuente', () => {
    const handleChange = vi.fn();
    render(<ItemUnidadSelector unidad="u" onChangeUnidad={handleChange} />);

    const button = screen.getByTitle('Cambiar unidad de medida del ítem');
    fireEvent.click(button);

    // Debe mostrar la lista de unidades frecuentes
    expect(screen.getByText('boca (Bocas)')).toBeDefined();

    fireEvent.click(screen.getByText('boca (Bocas)'));
    expect(handleChange).toHaveBeenCalledWith('boca');
  });

  it('permite ingresar una unidad personalizada', () => {
    const handleChange = vi.fn();
    render(<ItemUnidadSelector unidad="u" onChangeUnidad={handleChange} />);

    fireEvent.click(screen.getByTitle('Cambiar unidad de medida del ítem'));

    const customBtn = screen.getByText('+ Otra personalizada...');
    fireEvent.click(customBtn);

    const input = screen.getByPlaceholderText('Otra unidad...');
    fireEvent.change(input, { target: { value: 'rollo' } });

    fireEvent.click(screen.getByText('OK'));
    expect(handleChange).toHaveBeenCalledWith('rollo');
  });
});
