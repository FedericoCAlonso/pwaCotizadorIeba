import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemParametersQuickModal } from './ItemParametersQuickModal';
import { ItemPresupuesto } from '../../../core/types';

describe('ItemParametersQuickModal', () => {
  const mockItem: ItemPresupuesto = {
    id: 'it-1',
    descripcion: 'Instalación de bocas',
    cantidad: 10,
    unidad: 'boca',
    costoInsumos: 1000,
    costoManoObra: 2000,
    costoDirectoTotal: 3000,
    precioVentaUnitario: 400,
    precioVentaTotal: 4000,
    insumosSnapshot: [],
    manoObraSnapshot: [],
    parametros: [
      { id: 'bocas', nombre: 'Cantidad de bocas', valor: 10, unidad: 'u' },
      { id: 'trifasica', nombre: 'Es trifásica', valor: 1, unidad: 'bool' }
    ]
  };

  it('renderiza la partida y sus parámetros con controles de ajuste', () => {
    const onUpdateParametros = vi.fn();

    render(
      <ItemParametersQuickModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        calculosVariables={{ superficie: 120 }}
        onUpdateParametros={onUpdateParametros}
      />
    );

    expect(screen.getByText('Instalación de bocas')).toBeDefined();
    expect(screen.getByText('Cantidad de bocas')).toBeDefined();
    expect(screen.getByText('Es trifásica')).toBeDefined();

    // Incremento con botón '+'
    const plusBtn = screen.getByTitle('Aumentar');
    fireEvent.click(plusBtn);
    expect(onUpdateParametros).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'bocas', valor: 11 })
      ])
    );
  });

  it('permite alternar valores booleanos Sí / No', () => {
    const onUpdateParametros = vi.fn();

    render(
      <ItemParametersQuickModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        onUpdateParametros={onUpdateParametros}
      />
    );

    // Botón de Sí para trifásica
    const boolBtn = screen.getByText('Sí');
    fireEvent.click(boolBtn);

    expect(onUpdateParametros).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'trifasica', valor: 0 })
      ])
    );
  });

  it('muestra variables globales de contexto para referencia en fórmulas', () => {
    render(
      <ItemParametersQuickModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        calculosVariables={{ superficie: 150, altura: 3.5 }}
      />
    );

    expect(screen.getByText(/superficie:/i)).toBeDefined();
    expect(screen.getByText('150')).toBeDefined();
  });

  it('discrimina parámetros de entrada interactivos de variables de cálculo interno (sólo lectura)', () => {
    const itemWithVar: ItemPresupuesto = {
      ...mockItem,
      parametros: [
        { id: 'bocas', nombre: 'Cantidad de bocas', valor: 10, tipo: 'parametro', unidad: 'u' },
        { id: 'cable_calc', nombre: 'Cable calculado', valor: 35, formula: '=bocas * 3.5', tipo: 'variable', unidad: 'm' }
      ]
    };

    render(
      <ItemParametersQuickModal
        isOpen={true}
        onClose={vi.fn()}
        item={itemWithVar}
        onUpdateParametros={vi.fn()}
      />
    );

    // Parámetro de entrada: tiene control numérico y botones +/-
    expect(screen.getByDisplayValue('10')).toBeDefined();
    expect(screen.getByTitle('Aumentar')).toBeDefined();

    // Variable interna: se muestra en el bloque de cálculo interno de solo lectura
    expect(screen.getByText(/Variables de Cálculo Interno \(1\)/i)).toBeDefined();
    expect(screen.getByText('$cable_calc')).toBeDefined();
    expect(screen.getByText('= 35 m')).toBeDefined();
    expect(screen.getByText('=bocas * 3.5')).toBeDefined();

    // No debe haber un segundo campo de input numérico para la variable interna
    expect(screen.queryByDisplayValue('35')).toBeNull();
  });
});
