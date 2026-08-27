import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { GastoCatalogPickerModal } from './GastoCatalogPickerModal';
import { CostoIndirecto, GastoPresupuestoConfig } from '../../core/types';

describe('GastoCatalogPickerModal', () => {
  const sampleCatalog: CostoIndirecto[] = [
    {
      id: 'ci-movilidad',
      nombre: 'Movilidad y Flete',
      tipo: 'por_visita',
      modalidad: 'monto_fijo',
      destino: 'servicios',
      valor: 15000,
      incluirPorDefecto: true
    },
    {
      id: 'ci-cargas-sociales',
      nombre: 'Cargas Sociales y ART',
      tipo: 'porcentual_sobre_costo',
      modalidad: 'porcentual',
      destino: 'mano_obra',
      valor: 20,
      incluirPorDefecto: true
    },
    {
      id: 'ci-garantia',
      nombre: 'Garantía Extra de Materiales',
      tipo: 'porcentual_sobre_costo',
      modalidad: 'porcentual',
      destino: 'materiales',
      valor: 5,
      incluirPorDefecto: false
    }
  ];

  const currentGastos: GastoPresupuestoConfig[] = [
    {
      id: 'g-1',
      costoIndirectoId: 'ci-movilidad',
      nombre: 'Movilidad y Flete',
      valor: 15000,
      aplica: true
    }
  ];

  it('no renderiza nada si isOpen es false', () => {
    const { container } = render(
      <GastoCatalogPickerModal
        isOpen={false}
        onClose={vi.fn()}
        catalogGastos={sampleCatalog}
        currentGastosConfig={currentGastos}
        onAddGastos={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza la lista de gastos del catálogo e indica los que ya están en la cotización', () => {
    render(
      <GastoCatalogPickerModal
        isOpen={true}
        onClose={vi.fn()}
        catalogGastos={sampleCatalog}
        currentGastosConfig={currentGastos}
        onAddGastos={vi.fn()}
      />
    );

    expect(screen.getByText('Catálogo de Gastos y Costos Indirectos')).toBeDefined();
    expect(screen.getByText('Movilidad y Flete')).toBeDefined();
    expect(screen.getByText('Cargas Sociales y ART')).toBeDefined();
    expect(screen.getByText('Garantía Extra de Materiales')).toBeDefined();
    expect(screen.getByText('En cotización')).toBeDefined();
  });

  it('permite filtrar por término de búsqueda', () => {
    render(
      <GastoCatalogPickerModal
        isOpen={true}
        onClose={vi.fn()}
        catalogGastos={sampleCatalog}
        currentGastosConfig={currentGastos}
        onAddGastos={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Buscar gasto en el catálogo...');
    fireEvent.change(input, { target: { value: 'Cargas' } });

    expect(screen.getByText('Cargas Sociales y ART')).toBeDefined();
    expect(screen.queryByText('Movilidad y Flete')).toBeNull();
  });

  it('permite agregar múltiples gastos seleccionados con checkboxes', () => {
    const onAddGastos = vi.fn();
    const onClose = vi.fn();

    render(
      <GastoCatalogPickerModal
        isOpen={true}
        onClose={onClose}
        catalogGastos={sampleCatalog}
        currentGastosConfig={[]}
        onAddGastos={onAddGastos}
      />
    );

    // Seleccionar por defecto
    const btnDefaults = screen.getByText('Por Defecto');
    fireEvent.click(btnDefaults);

    // Click en botón de confirmación inferior
    const btnSubmit = screen.getByText(/Agregar a la Cotización \(2\)/i);
    fireEvent.click(btnSubmit);

    expect(onAddGastos).toHaveBeenCalledTimes(1);
    expect(onAddGastos).toHaveBeenCalledWith([sampleCatalog[0], sampleCatalog[1]]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('permite agregar un gasto individualmente con el botón directo', () => {
    const onAddGastos = vi.fn();
    const onClose = vi.fn();

    render(
      <GastoCatalogPickerModal
        isOpen={true}
        onClose={onClose}
        catalogGastos={sampleCatalog}
        currentGastosConfig={[]}
        onAddGastos={onAddGastos}
      />
    );

    const addButtons = screen.getAllByRole('button', { name: /Agregar/i });
    fireEvent.click(addButtons[0]);

    expect(onAddGastos).toHaveBeenCalledWith([sampleCatalog[0]]);
    expect(onClose).toHaveBeenCalled();
  });
});
