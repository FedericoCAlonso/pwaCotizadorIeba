import { describe, it, expect } from 'vitest';
import {
  parseDSLToPresupuesto,
  serializePresupuestoToDSL,
  parseLocalizedNumber,
  normalizeString
} from './dslParser';
import { Cliente, TareaTipo, Insumo, CategoriaManoDeObra, ItemPresupuesto, CapituloPresupuesto } from '../../../core/types';

describe('dslParser (Modo Experto Desktop)', () => {
  const mockClientes: Cliente[] = [
    { id: 'cli-1', nombre: 'Federico Gómez', razonSocial: 'Estudio Arq. Gómez', cuitDni: '30-12345678-9', direccion: 'Av. Corrientes 1000', roles: ['cliente'] },
    { id: 'cli-2', nombre: 'Juan Pérez', razonSocial: 'Juan Pérez', cuitDni: '20-98765432-1', direccion: 'Belgrano 450', roles: ['cliente'] }
  ];

  const mockTareas: TareaTipo[] = [
    {
      id: 'tarea-boca',
      nombre: 'Boca de Iluminación',
      unidad: 'u',
      categoria: 'iluminacion',
      insumos: [{ materialId: 'mat-cable', cantidad: 10 }],
      manoObra: [{ categoriaId: 'mo-oficial', horas: 1.5 }]
    },
    {
      id: 'tarea-disyuntor',
      nombre: 'Disyuntor Diferencial 2x40A',
      unidad: 'u',
      categoria: 'tableros',
      insumos: [{ materialId: 'mat-disyuntor', cantidad: 1 }],
      manoObra: [{ categoriaId: 'mo-oficial', horas: 1.0 }]
    }
  ];

  const mockInsumosMap = new Map<string, Insumo>([
    ['mat-cable', { id: 'mat-cable', nombre: 'Cable 2.5mm', precioActual: 200, unidad: 'm', categoria: 'cables' } as unknown as Insumo],
    ['mat-disyuntor', { id: 'mat-disyuntor', nombre: 'Disyuntor 2x40A', precioActual: 25000, unidad: 'u', categoria: 'tableros' } as unknown as Insumo]
  ]);

  const mockManoObraMap = new Map<string, CategoriaManoDeObra>([
    ['mo-oficial', { id: 'mo-oficial', nombre: 'Oficial', costoHora: 5000, fechaActualizacion: '2026-01-01' }]
  ]);

  it('parseLocalizedNumber parsea correctamente números con formatos varios', () => {
    expect(parseLocalizedNumber('1.250,50')).toBe(1250.5);
    expect(parseLocalizedNumber('45000')).toBe(45000);
    expect(parseLocalizedNumber('12,5')).toBe(12.5);
    expect(parseLocalizedNumber('$ 35.000')).toBe(35000);
  });

  it('parsea directivas de cabecera y vincula cliente y obra', () => {
    const text = `
@cliente: Estudio Arq. Gómez
@obra: Thames 1850, Palermo
@factura: Factura A
@validez: 30 dias
@margen: 40%
@riesgo: alto
@dolar: Dólar MEP = 1300
    `;

    const res = parseDSLToPresupuesto(text, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(res.clienteId).toBe('cli-1');
    expect(res.direccionObra).toBe('Thames 1850, Palermo');
    expect(res.tipoFactura).toBe('Factura A');
    expect(res.validezDias).toBe(30);
    expect(res.margenPorcentaje).toBe(40);
    expect(res.nivelMargenRiesgo).toBe('alto');
    expect(res.margenRiesgoPorcentaje).toBe(35);
    expect(res.mostrarDolar).toBe(true);
    expect(res.nombreDolar).toBe('Dólar MEP');
    expect(res.cotizacionDolar).toBe(1300);
  });

  it('parsea capítulos y vincula tareas tipo del catálogo con cálculo automático', () => {
    const text = `
# 1. Iluminación Principal
- 20 u * Boca de Iluminación

# 2. Tableros
- 2 u * Disyuntor Diferencial 2x40A
    `;

    const res = parseDSLToPresupuesto(text, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(res.capitulos.length).toBe(2);
    expect(res.capitulos[0].nombre).toBe('1. Iluminación Principal');
    expect(res.capitulos[1].nombre).toBe('2. Tableros');

    expect(res.items.length).toBe(2);
    expect(res.items[0].tareaTipoId).toBe('tarea-boca');
    expect(res.items[0].cantidad).toBe(20);
    expect(res.items[0].capituloId).toBe(res.capitulos[0].id);
    expect(res.items[0].insumosSnapshot.length).toBeGreaterThan(0);
    expect(res.items[0].manoObraSnapshot.length).toBeGreaterThan(0);

    expect(res.items[1].tareaTipoId).toBe('tarea-disyuntor');
    expect(res.items[1].cantidad).toBe(2);
    expect(res.items[1].capituloId).toBe(res.capitulos[1].id);
  });

  it('soporta partidas personalizadas con precio directo', () => {
    const text = `
- 1 u * Mano de obra especializada fuera de catálogo = $ 80.000
    `;

    const res = parseDSLToPresupuesto(text, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(res.items.length).toBe(1);
    expect(res.items[0].descripcion).toBe('Mano de obra especializada fuera de catálogo');
    expect(res.items[0].costoUnitario).toBe(80000);
    expect(res.items[0].precioManual).toBe(80000);
    expect(res.items[0].tareaTipoId).toBeUndefined();
  });

  it('serializa un presupuesto existente y lo vuelve a parsear de forma bidireccional', () => {
    const capitulos: CapituloPresupuesto[] = [{ id: 'cap-1', nombre: 'Sector A' }];
    const items: ItemPresupuesto[] = [
      {
        id: 'it-1',
        capituloId: 'cap-1',
        tareaTipoId: 'tarea-boca',
        descripcion: 'Boca de Iluminación',
        cantidad: 15,
        unidad: 'u',
        costoUnitario: 9500,
        costoInsumos: 30000,
        costoManoObra: 112500,
        costoDirectoTotal: 142500,
        costoTotal: 142500,
        precioVentaUnitario: 13300,
        precioVentaTotal: 199500,
        insumosSnapshot: [],
        manoObraSnapshot: []
      }
    ];

    const dsl = serializePresupuestoToDSL({
      clienteId: 'cli-1',
      direccionObra: 'Juncal 1234',
      tipoFactura: 'Factura B',
      validezDias: 20,
      margenPorcentaje: 30,
      capitulos,
      items,
      clientes: mockClientes
    });

    expect(dsl).toContain('@cliente: Estudio Arq. Gómez');
    expect(dsl).toContain('@obra: Juncal 1234');
    expect(dsl).toContain('# Sector A');
    expect(dsl).toContain('- 15 u * "Boca de Iluminación"');

    const parsed = parseDSLToPresupuesto(dsl, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(parsed.clienteId).toBe('cli-1');
    expect(parsed.direccionObra).toBe('Juncal 1234');
    expect(parsed.tipoFactura).toBe('Factura B');
    expect(parsed.validezDias).toBe(20);
    expect(parsed.items[0].cantidad).toBe(15);
    expect(parsed.items[0].tareaTipoId).toBe('tarea-boca');
  });
});
