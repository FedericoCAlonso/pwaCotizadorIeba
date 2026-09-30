import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileItemDetailSheet } from './MobileItemDetailSheet';
import { ItemPresupuesto, Insumo, CategoriaManoDeObra } from '../../../../core/types';

describe('MobileItemDetailSheet', () => {
  const mockItem: ItemPresupuesto = {
    id: 'item-101',
    descripcion: 'Punto de luz con llave de combinación',
    cantidad: 4,
    unidad: 'bocas',
    precioFinalItem: 38000,
    costoDirectoTotal: 22000,
    insumosSnapshot: [
      {
        materialId: 'mat-1',
        nombre: 'Cable 1.5mm',
        unidad: 'm',
        cantidadTotal: 20,
        precioUnitarioCongelado: 450,
        subtotalInsumo: 9000
      }
    ],
    manoObraSnapshot: [
      {
        categoriaId: 'oficial',
        nombreCategoria: 'Oficial',
        horasTotal: 3,
        costoUnitarioCongelado: 4000,
        subtotalManoObra: 12000
      }
    ],
    serviciosTercerizados: [
      {
        id: 'serv-1',
        descripcion: 'Flete urbano',
        costo: 1000,
        cantidad: 1
      }
    ],
    parametros: [
      {
        id: 'distancia',
        nombre: 'distancia',
        valor: 15,
        unidad: 'm'
      }
    ],
    notasTecnicas: 'Colocar cajas plásticas ignífugas',
    clausulaExclusiones: 'No incluye provisión de luminarias'
  } as unknown as ItemPresupuesto;

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    item: mockItem,
    insumosMap: new Map<string, Insumo>(),
    manoObraMap: new Map<string, CategoriaManoDeObra>(),
    calculosVariables: {},
    currentIndex: 1,
    totalItems: 3,
    onPrevItem: vi.fn(),
    onNextItem: vi.fn(),
    onAddMaterial: vi.fn(),
    onRemoveMaterial: vi.fn(),
    onUpdateMaterialFormula: vi.fn(),
    onOpenMaterialCatalog: vi.fn(),
    onAddLabor: vi.fn(),
    onRemoveLabor: vi.fn(),
    onUpdateLaborFormula: vi.fn(),
    onAddService: vi.fn(),
    onRemoveService: vi.fn(),
    onUpdateNotas: vi.fn(),
    onUpdateParametros: vi.fn()
  };

  it('no renderiza nada cuando isOpen es false', () => {
    const { container } = render(<MobileItemDetailSheet {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza la cabecera con descripción, cantidad, y precios', () => {
    render(<MobileItemDetailSheet {...defaultProps} />);

    expect(screen.getByText('Punto de luz con llave de combinación')).toBeDefined();
    expect(screen.getByText('4 bocas')).toBeDefined();
    expect(screen.getByText('Materiales (1)')).toBeDefined();
    expect(screen.getByText('Mano Obra (1)')).toBeDefined();
    expect(screen.getByText('Servicios (1)')).toBeDefined();
    expect(screen.getByText('Parámetros (1)')).toBeDefined();
    expect(screen.getByText('Notas')).toBeDefined();
  });

  it('permite alternar entre pestañas y muestra el contenido de cada una', () => {
    render(<MobileItemDetailSheet {...defaultProps} />);

    // Pestaña inicial: Materiales
    expect(screen.getByText('Cable 1.5mm')).toBeDefined();

    // Cambiar a Mano de Obra
    fireEvent.click(screen.getByText('Mano Obra (1)'));
    expect(screen.getByText('Oficial')).toBeDefined();

    // Cambiar a Servicios
    fireEvent.click(screen.getByText('Servicios (1)'));
    expect(screen.getByText('Flete urbano')).toBeDefined();

    // Cambiar a Parámetros
    fireEvent.click(screen.getByText('Parámetros (1)'));
    expect(screen.getByText('distancia')).toBeDefined();

    // Cambiar a Notas
    fireEvent.click(screen.getByText('Notas'));
    expect(screen.getByDisplayValue('Colocar cajas plásticas ignífugas')).toBeDefined();
    expect(screen.getByDisplayValue('No incluye provisión de luminarias')).toBeDefined();
  });

  it('el paginador secuencial de pulgar dispara onPrevItem y onNextItem', () => {
    const handlePrev = vi.fn();
    const handleNext = vi.fn();

    render(
      <MobileItemDetailSheet
        {...defaultProps}
        onPrevItem={handlePrev}
        onNextItem={handleNext}
      />
    );

    expect(screen.getByText('2/3')).toBeDefined();

    const prevBtn = screen.getByLabelText('Ítem anterior');
    fireEvent.click(prevBtn);
    expect(handlePrev).toHaveBeenCalled();

    const nextBtn = screen.getByLabelText('Siguiente ítem');
    fireEvent.click(nextBtn);
    expect(handleNext).toHaveBeenCalled();
  });

  it('el botón "Listo" y el botón de cerrar disparan onClose', () => {
    const handleClose = vi.fn();

    render(<MobileItemDetailSheet {...defaultProps} onClose={handleClose} />);

    const listoBtn = screen.getByText('Listo');
    fireEvent.click(listoBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByLabelText('Cerrar detalle');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
