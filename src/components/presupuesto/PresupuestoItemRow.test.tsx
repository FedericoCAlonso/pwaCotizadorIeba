import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PresupuestoItemRow } from './PresupuestoItemRow';
import { ItemPresupuesto, CategoriaManoDeObra } from '../../core/types';

describe('PresupuestoItemRow - Costo Base Desdoblamiento y Mano de Obra Inline', () => {
  const mockCategoriasMO: CategoriaManoDeObra[] = [
    { id: 'cat-oficial', nombre: 'Oficial Especializado', costoHora: 7500, fechaActualizacion: '2026-01-01' },
    { id: 'cat-ayudante', nombre: 'Ayudante', costoHora: 5000, fechaActualizacion: '2026-01-01' }
  ];

  const defaultProps = {
    index: 0,
    isExpanded: false,
    onToggleExpand: vi.fn(),
    onUpdateItemCondicion: vi.fn(),
    onUpdateItemQuantity: vi.fn(),
    onUpdateItemUnit: vi.fn(),
    onUpdateItemUnitDirectCost: vi.fn(),
    onUpdateItemDescription: vi.fn(),
    onRemoveItem: vi.fn(),
    onSaveAsTemplate: vi.fn(),
    condicionesTrabajo: [
      { value: 'normal', label: 'Normal' },
      { value: 'dificultosa', label: 'Dificultosa' },
      { value: 'favorable', label: 'Favorable' }
    ],
    categoriasManoObra: mockCategoriasMO
  };

  it('desdobla Costo Base en Insumos y M. Obra cuando el ítem libre tiene insumos con precio cero', () => {
    const itemWithZeroPriceMaterials: ItemPresupuesto = {
      id: 'item-1',
      descripcion: 'Partida con materiales pendientes de cotizar',
      cantidad: 1,
      unidad: 'gl',
      costoDirectoTotal: 0,
      costoUnitario: 0,
      costoInsumos: 0,
      costoManoObra: 0,
      precioVentaUnitario: 0,
      precioVentaTotal: 0,
      insumosSnapshot: [
        {
          insumoId: 'mat-termomagnetica',
          nombre: 'Termomagnética C20 2x20A',
          unidad: 'u',
          cantidadTotal: 2,
          precioUnitarioCongelado: 0,
          subtotalInsumo: 0
        }
      ],
      manoObraSnapshot: []
    };

    render(
      <PresupuestoItemRow
        {...defaultProps}
        item={itemWithZeroPriceMaterials}
        calcItem={itemWithZeroPriceMaterials}
      />
    );

    expect(screen.getByText(/Insumos:/i)).toBeDefined();
    expect(screen.getByText(/M\. Obra:/i)).toBeDefined();
    expect(screen.getByText('Desglosado')).toBeDefined();
  });

  it('muestra input directo unitario si el ítem libre no tiene snapshots asignados', () => {
    const itemLibreSimple: ItemPresupuesto = {
      id: 'item-2',
      descripcion: 'Arreglo menor directo',
      cantidad: 1,
      unidad: 'u',
      costoDirectoTotal: 15000,
      costoUnitario: 15000,
      costoInsumos: 0,
      costoManoObra: 15000,
      precioVentaUnitario: 21428.57,
      precioVentaTotal: 21428.57,
      insumosSnapshot: [],
      manoObraSnapshot: []
    };

    render(
      <PresupuestoItemRow
        {...defaultProps}
        item={itemLibreSimple}
        calcItem={itemLibreSimple}
      />
    );

    expect(screen.queryByText(/Insumos:/i)).toBeNull();
    expect(screen.getByText('Directo')).toBeDefined();
  });

  it('renderiza roles de mano de obra en el acordeón y permite agregar rol inline', () => {
    const onAddLaborRole = vi.fn();
    const onUpdateItemLaborHours = vi.fn();
    const onRemoveItemLabor = vi.fn();

    const itemConMO: ItemPresupuesto = {
      id: 'item-3',
      descripcion: 'Canalización embutida',
      cantidad: 1,
      unidad: 'm',
      costoDirectoTotal: 15000,
      costoUnitario: 15000,
      costoInsumos: 0,
      costoManoObra: 15000,
      precioVentaUnitario: 21428.57,
      precioVentaTotal: 21428.57,
      insumosSnapshot: [],
      manoObraSnapshot: [
        {
          categoriaId: 'cat-oficial',
          nombreCategoria: 'Oficial Especializado',
          horasTotales: 2,
          costoHoraCongelado: 7500,
          subtotalManoObra: 15000
        }
      ]
    };

    render(
      <PresupuestoItemRow
        {...defaultProps}
        item={itemConMO}
        calcItem={itemConMO}
        isExpanded={true}
        onAddLaborRole={onAddLaborRole}
        onUpdateItemLaborHours={onUpdateItemLaborHours}
        onRemoveItemLabor={onRemoveItemLabor}
      />
    );

    expect(screen.getByText('Oficial Especializado')).toBeDefined();

    const addRoleBtn = screen.getByRole('button', { name: /\+ Asignar rol de mano de obra/i });
    expect(addRoleBtn).toBeDefined();
    fireEvent.click(addRoleBtn);

    const asignarConfirmBtn = screen.getByRole('button', { name: /^Asignar$/i });
    expect(asignarConfirmBtn).toBeDefined();
    fireEvent.click(asignarConfirmBtn);

    expect(onAddLaborRole).toHaveBeenCalledTimes(1);
    expect(onAddLaborRole).toHaveBeenCalledWith(0, 'cat-oficial', 4);
  });
});
