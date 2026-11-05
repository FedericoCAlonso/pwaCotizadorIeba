import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SmartSheetView } from './SmartSheetView';
import { ItemPresupuesto, CapituloPresupuesto, TareaTipo, Insumo, CategoriaManoDeObra } from '../../../core/types';
import { calcularTotalesPresupuesto } from '../../../core/calculations';

describe('SmartSheet Planilla Inteligente - FASE 3', () => {
  const mockCapitulos: CapituloPresupuesto[] = [
    { id: 'cap-1', nombre: 'Instalación General', orden: 1 }
  ];

  const mockItem: ItemPresupuesto = {
    id: 'item-test-1',
    capituloId: 'cap-1',
    descripcion: 'Boca de iluminación embutida',
    cantidad: 5,
    unidad: 'boca',
    naturaleza: 'instalacion',
    costoUnitario: 0,
    costoInsumos: 0,
    costoManoObra: 0,
    costoServicios: 0,
    costoDirectoTotal: 0,
    costoTotal: 0,
    precioVentaUnitario: 0,
    precioVentaTotal: 0,
    insumosSnapshot: [],
    manoObraSnapshot: []
  };

  const mockInsumosMap = new Map<string, Insumo>([
    [
      'mat-cable-25',
      {
        id: 'mat-cable-25',
        nombre: 'Cable unipolar 2.5 mm² Cu',
        unidad: 'm',
        unidadVenta: 'm',
        precioActual: 1350,
        marca: 'Prysmian Superastic',
        categoriaId: 'cat-conductores',
        atributos: [],
        activo: true
      } as unknown as Insumo
    ],
    [
      'mat-caja-oct',
      {
        id: 'mat-caja-oct',
        nombre: 'Caja octogonal chica de chapa',
        unidad: 'u',
        unidadVenta: 'u',
        precioActual: 550,
        marca: '', // Sin marca comercial definida
        categoriaId: 'cat-cajas',
        atributos: [],
        activo: true
      } as unknown as Insumo
    ]
  ]);

  const mockManoObraMap = new Map<string, CategoriaManoDeObra>([
    [
      'mo-oficial',
      {
        id: 'mo-oficial',
        nombre: 'Oficial Electricista',
        costoHora: 6000,
        rol: 'oficial'
      } as CategoriaManoDeObra
    ]
  ]);

  const mockTareasTipo: TareaTipo[] = [
    {
      id: 'tarea-boca-toma',
      nombre: 'Boca de Tomacorriente Doble',
      categoria: 'Bocas',
      unidad: 'boca',
      naturaleza: 'instalacion',
      insumos: [
        {
          insumoId: 'mat-cable-25',
          cantidad: 12
        },
        {
          insumoId: 'mat-caja-oct',
          cantidad: 1
        }
      ],
      manoObra: [
        {
          categoriaId: 'mo-oficial',
          horas: 1.5
        }
      ]
    }
  ];

  it('(a) sugiere materiales del catálogo existente por función al escribir en GhostRow y completa unidad, precio y marca', async () => {
    let currentItems = [{ ...mockItem }];
    const setItems = vi.fn((updater) => {
      if (typeof updater === 'function') {
        currentItems = updater(currentItems);
      } else {
        currentItems = updater;
      }
    });

    const totales = calcularTotalesPresupuesto({
      items: currentItems,
      capitulos: mockCapitulos,
      impuestosDetalle: []
    });

    const { rerender } = render(
      <SmartSheetView
        items={currentItems}
        setItems={setItems}
        capitulos={mockCapitulos}
        totales={totales}
        insumosMap={mockInsumosMap}
      />
    );

    // Escribir en el input de función de la fila vacía (Ghost Row)
    const ghostFuncInput = screen.getByPlaceholderText('+ Nueva línea (función o descripción)...');
    fireEvent.change(ghostFuncInput, { target: { value: 'cable' } });

    // Verificar que aparece el popup de sugerencias por función (sin marca en el título)
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeDefined();
      expect(screen.getByText('Cable unipolar 2.5 mm² Cu')).toBeDefined();
    });

    // Seleccionar la sugerencia
    fireEvent.mouseDown(screen.getByText('Cable unipolar 2.5 mm² Cu'));

    // Verificar que completó la función, la marca y el precio vigente
    expect((ghostFuncInput as HTMLInputElement).value).toBe('Cable unipolar 2.5 mm² Cu');
    expect((screen.getByPlaceholderText('Marca / Modelo') as HTMLInputElement).value).toBe('Prysmian Superastic');
    expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe('1350');

    // Confirmar la adición presionando Enter
    fireEvent.keyDown(ghostFuncInput, { key: 'Enter' });

    expect(setItems).toHaveBeenCalled();
    const updatedItem = currentItems[0];
    expect(updatedItem.insumosSnapshot).toHaveLength(1);
    expect(updatedItem.insumosSnapshot[0].nombre).toBe('Cable unipolar 2.5 mm² Cu');
    expect(updatedItem.insumosSnapshot[0].marca).toBe('Prysmian Superastic');
    expect(updatedItem.insumosSnapshot[0].unidad).toBe('m');
    expect(updatedItem.insumosSnapshot[0].precioUnitarioCongelado).toBe(1350);
  });

  it('(a) si el material sugerido no tiene marca definida, la deja como "sin definir"', async () => {
    let currentItems = [{ ...mockItem }];
    const setItems = vi.fn((updater) => {
      if (typeof updater === 'function') {
        currentItems = updater(currentItems);
      } else {
        currentItems = updater;
      }
    });

    const totales = calcularTotalesPresupuesto({
      items: currentItems,
      capitulos: mockCapitulos,
      impuestosDetalle: []
    });

    render(
      <SmartSheetView
        items={currentItems}
        setItems={setItems}
        capitulos={mockCapitulos}
        totales={totales}
        insumosMap={mockInsumosMap}
      />
    );

    const ghostFuncInput = screen.getByPlaceholderText('+ Nueva línea (función o descripción)...');
    fireEvent.change(ghostFuncInput, { target: { value: 'caja octogonal' } });

    await waitFor(() => {
      expect(screen.getByText('Caja octogonal chica de chapa')).toBeDefined();
    });

    fireEvent.mouseDown(screen.getByText('Caja octogonal chica de chapa'));

    expect((ghostFuncInput as HTMLInputElement).value).toBe('Caja octogonal chica de chapa');
    // Marca sin definir
    expect((screen.getByPlaceholderText('Marca / Modelo') as HTMLInputElement).value).toBe('sin definir');
    expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe('550');
  });

  it('(a) al editar la función de una línea existente, sugiere materiales del catálogo y actualiza unidad, marca y precio', async () => {
    const itemWithLine: ItemPresupuesto = {
      ...mockItem,
      insumosSnapshot: [
        {
          insumoId: 'ins-init',
          nombre: 'Cable generico',
          unidad: 'u',
          marca: 'sin definir',
          cantidadTotal: 10,
          cantidadUnitaria: 2,
          precioUnitarioCongelado: 100,
          subtotalInsumo: 1000
        }
      ]
    };

    let currentItems = [itemWithLine];
    const setItems = vi.fn((updater) => {
      if (typeof updater === 'function') {
        currentItems = updater(currentItems);
      } else {
        currentItems = updater;
      }
    });

    const totales = calcularTotalesPresupuesto({
      items: currentItems,
      capitulos: mockCapitulos,
      impuestosDetalle: []
    });

    render(
      <SmartSheetView
        items={currentItems}
        setItems={setItems}
        capitulos={mockCapitulos}
        totales={totales}
        insumosMap={mockInsumosMap}
      />
    );

    // Hacer clic en la celda de función existente para editarla
    const lineFuncCell = screen.getByText('Cable generico');
    fireEvent.click(lineFuncCell);

    // Escribir en el input de edición
    const editInput = screen.getByDisplayValue('Cable generico');
    fireEvent.change(editInput, { target: { value: 'cable unipolar' } });

    // Aparece sugerencia
    await waitFor(() => {
      expect(screen.getByText('Cable unipolar 2.5 mm² Cu')).toBeDefined();
    });

    // Seleccionar sugerencia
    fireEvent.mouseDown(screen.getByText('Cable unipolar 2.5 mm² Cu'));

    expect(setItems).toHaveBeenCalled();
    const updated = currentItems[0];
    expect(updated.insumosSnapshot[0].nombre).toBe('Cable unipolar 2.5 mm² Cu');
    expect(updated.insumosSnapshot[0].marca).toBe('Prysmian Superastic');
    expect(updated.insumosSnapshot[0].unidad).toBe('m');
    expect(updated.insumosSnapshot[0].precioUnitarioCongelado).toBe(1350);
  });

  it('(b) "Insertar trabajo tipo" permite elegir un trabajo tipo y expandirlo en líneas editables dentro del ítem', async () => {
    let currentItems = [{ ...mockItem }];
    const setItems = vi.fn((updater) => {
      if (typeof updater === 'function') {
        currentItems = updater(currentItems);
      } else {
        currentItems = updater;
      }
    });

    const totales = calcularTotalesPresupuesto({
      items: currentItems,
      capitulos: mockCapitulos,
      impuestosDetalle: []
    });

    render(
      <SmartSheetView
        items={currentItems}
        setItems={setItems}
        capitulos={mockCapitulos}
        totales={totales}
        insumosMap={mockInsumosMap}
        manoObraMap={mockManoObraMap}
        tareasTipo={mockTareasTipo}
      />
    );

    // Abrir modal de insertar trabajo tipo
    const btnInsertar = screen.getByTitle('Insertar un trabajo tipo y expandirlo en líneas editables dentro de este ítem');
    fireEvent.click(btnInsertar);

    // Modal abierto
    expect(screen.getByText('Insertar Trabajo Tipo en el Ítem')).toBeDefined();
    expect(screen.getByText('Boca de Tomacorriente Doble')).toBeDefined();

    // Seleccionar la tarea
    fireEvent.click(screen.getByText('Boca de Tomacorriente Doble'));

    // Click en "Insertar en este Ítem"
    const btnConfirmar = screen.getByText('Insertar en este Ítem');
    fireEvent.click(btnConfirmar);

    // Se expandieron las líneas dentro del ítem
    expect(setItems).toHaveBeenCalled();
    const updated = currentItems[0];
    expect(updated.insumosSnapshot.length).toBeGreaterThanOrEqual(2);
    expect(updated.manoObraSnapshot.length).toBeGreaterThanOrEqual(1);

    // Verificar que los insumos de la tarea tipo se expandieron
    expect(updated.insumosSnapshot.some((i) => i.nombre.includes('Cable'))).toBe(true);
    expect(updated.insumosSnapshot.some((i) => i.nombre.includes('Caja'))).toBe(true);
    // Verificar que la mano de obra se expandió
    expect(updated.manoObraSnapshot[0].nombreCategoria).toBe('Oficial Electricista');
  });

  it('(c) Pegado: permite pegar texto con varias líneas separadas por tabulador o salto de línea y crea una línea por renglón', async () => {
    let currentItems = [{ ...mockItem }];
    const setItems = vi.fn((updater) => {
      if (typeof updater === 'function') {
        currentItems = updater(currentItems);
      } else {
        currentItems = updater;
      }
    });

    const totales = calcularTotalesPresupuesto({
      items: currentItems,
      capitulos: mockCapitulos,
      impuestosDetalle: []
    });

    const { container } = render(
      <SmartSheetView
        items={currentItems}
        setItems={setItems}
        capitulos={mockCapitulos}
        totales={totales}
        insumosMap={mockInsumosMap}
      />
    );

    // Abrir modal de pegado
    const btnPegar = screen.getByTitle('Pegar texto de varias líneas (Excel, Sheets o texto plano)');
    fireEvent.click(btnPegar);

    expect(screen.getByText('Pegar Líneas (Excel, Sheets o Texto)')).toBeDefined();

    const textarea = container.querySelector('textarea')!;
    // Pegar dos líneas TSV (separadas por tabulador y salto de línea)
    const tsvText = `Cable unipolar 2.5 mm² Cu\tPrysmian\t50\t1400\nDisyuntor bipolar 25A\tSchneider\t1\t22000`;
    fireEvent.change(textarea, { target: { value: tsvText } });

    // Vista previa debe detectar 2 líneas
    await waitFor(() => {
      expect(screen.getByText('Vista previa (2 renglones)')).toBeDefined();
      expect(screen.getByText('Disyuntor bipolar 25A')).toBeDefined();
    });

    // Confirmar inserción
    const btnInsertarRenglones = screen.getByText('Insertar 2 líneas');
    fireEvent.click(btnInsertarRenglones);

    expect(setItems).toHaveBeenCalled();
    const updated = currentItems[0];
    expect(updated.insumosSnapshot).toHaveLength(2);
    expect(updated.insumosSnapshot[0].nombre).toBe('Cable unipolar 2.5 mm² Cu');
    expect(updated.insumosSnapshot[0].marca).toBe('Prysmian');
    expect(updated.insumosSnapshot[0].cantidadTotal).toBe(50);
    expect(updated.insumosSnapshot[0].precioUnitarioCongelado).toBe(1400);

    expect(updated.insumosSnapshot[1].nombre).toBe('Disyuntor bipolar 25A');
    expect(updated.insumosSnapshot[1].marca).toBe('Schneider');
    expect(updated.insumosSnapshot[1].cantidadTotal).toBe(1);
    expect(updated.insumosSnapshot[1].precioUnitarioCongelado).toBe(22000);
  });
});
