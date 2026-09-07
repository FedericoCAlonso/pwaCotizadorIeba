import { describe, it, expect } from 'vitest';
import {
  parseDSLToPresupuesto,
  serializePresupuestoToDSL,
  getDefaultPresupuestoYAMLTemplate,
  parseLocalizedNumber,
  normalizeString
} from './dslParser';
import { Cliente, TareaTipo, Insumo, CategoriaManoDeObra, ItemPresupuesto, CapituloPresupuesto } from '../../../core/types';

describe('dslParser (Modo Experto YAML)', () => {
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
    ['mo-oficial', { id: 'mo-oficial', nombre: 'Oficial', costoHora: 5000, fechaActualizacion: '2026-01-01' }],
    ['mo-ayudante', { id: 'mo-ayudante', nombre: 'Ayudante', costoHora: 3500, fechaActualizacion: '2026-01-01' }]
  ]);

  it('parseLocalizedNumber parsea correctamente números con formatos varios', () => {
    expect(parseLocalizedNumber('1.250,50')).toBe(1250.5);
    expect(parseLocalizedNumber('45000')).toBe(45000);
    expect(parseLocalizedNumber('12,5')).toBe(12.5);
    expect(parseLocalizedNumber('$ 35.000')).toBe(35000);
  });

  it('getDefaultPresupuestoYAMLTemplate genera la plantilla inicial comentada', () => {
    const template = getDefaultPresupuestoYAMLTemplate({ clientes: mockClientes });
    expect(template).toContain('# ============================================================');
    expect(template).toContain('cliente: Estudio Arq. Gómez');
    expect(template).toContain('factura: Factura A');
    expect(template).toContain('Instalación Eléctrica:');
    expect(template).toContain('Tableros y Automatización:');
    expect(template).toContain('materiales:');
    expect(template).toContain('mano_obra:');
    expect(template).toContain('gastos:');
  });

  it('parsea directivas de cabecera en YAML y vincula cliente y obra', () => {
    const yaml = `
# Comentario inicial
cliente: Estudio Arq. Gómez
obra: Thames 1850, Palermo
factura: Factura A
validez: 30 dias
margen: 40%
riesgo: alto
dolar: MEP 1300
    `;

    const result = parseDSLToPresupuesto(yaml, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(result.clienteId).toBe('cli-1');
    expect(result.clienteMatched?.razonSocial).toBe('Estudio Arq. Gómez');
    expect(result.direccionObra).toBe('Thames 1850, Palermo');
    expect(result.tipoFactura).toBe('Factura A');
    expect(result.validezDias).toBe(30);
    expect(result.margenPorcentaje).toBe(40);
    expect(result.nivelMargenRiesgo).toBe('alto');
    expect(result.margenRiesgoPorcentaje).toBe(10);
    expect(result.mostrarDolar).toBe(true);
    expect(result.cotizacionDolar).toBe(1300);
  });

  it('parsea capítulos y tareas simples vinculándolas con el catálogo de Tareas Tipo', () => {
    const yaml = `
Iluminación y Fuerza:
  - 10 u Boca de Iluminación
  - 2 u Disyuntor Diferencial 2x40A
    `;

    const result = parseDSLToPresupuesto(yaml, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(result.capitulos.length).toBe(1);
    expect(result.capitulos[0].nombre).toBe('Iluminación y Fuerza');
    expect(result.items.length).toBe(2);

    const itBoca = result.items[0];
    expect(itBoca.descripcion).toBe('Boca de Iluminación');
    expect(itBoca.cantidad).toBe(10);
    expect(itBoca.unidad).toBe('u');
    // APU calculado: Cable (10m * $200 = $2000) + MO (1.5h * $5000 = $7500) = $9500 unitario
    expect(itBoca.costoUnitario).toBe(9500);
    expect(itBoca.costoInsumos).toBe(20000); // 10 bocas * 2000
    expect(itBoca.costoManoObra).toBe(75000); // 10 bocas * 7500
    expect(itBoca.costoDirectoTotal).toBe(95000);
  });

  it('parsea partidas a medida con despiece de materiales y mano de obra', () => {
    const yaml = `
Tableros Especiales:
  - Tablero Seccional Bomba:
      materiales:
        - 2 u Disyuntor 2x40A
        - 1 u Bomba Sumergible 1HP : $ 180.000
      mano_obra:
        - 6 h Oficial
        - 4 h Ayudante
      condicion: dificultosa
    `;

    const result = parseDSLToPresupuesto(yaml, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(result.capitulos.length).toBe(1);
    expect(result.items.length).toBe(1);

    const item = result.items[0];
    expect(item.descripcion).toBe('Tablero Seccional Bomba');
    expect(item.esAdHoc).toBe(true);
    expect(item.condicionTrabajo).toBe('dificultosa');
    expect(item.insumosSnapshot.length).toBe(2);

    // Material 1: Disyuntor 2x40A (del catálogo = $25000 c/u * 2 = $50000)
    expect(item.insumosSnapshot[0].nombre).toBe('Disyuntor 2x40A');
    expect(item.insumosSnapshot[0].precioUnitarioCongelado).toBe(25000);
    expect(item.insumosSnapshot[0].subtotalInsumo).toBe(50000);

    // Material 2: Bomba Sumergible (fuera de catálogo con precio manual = $180000)
    expect(item.insumosSnapshot[1].nombre).toBe('Bomba Sumergible 1HP');
    expect(item.insumosSnapshot[1].precioUnitarioCongelado).toBe(180000);
    expect(item.insumosSnapshot[1].subtotalInsumo).toBe(180000);

    expect(item.costoInsumos).toBe(230000); // 50000 + 180000

    // Mano de Obra:
    // Oficial: 6h * $5000 = $30000
    // Ayudante: 4h * $3500 = $14000
    // Total base MO = $44000. Con condición dificultosa (+20%): 44000 * 1.2 = $52800
    expect(item.manoObraSnapshot.length).toBe(2);
    expect(item.costoManoObra).toBe(52800);

    // Costo directo total = 230000 + 52800 = 282800
    expect(item.costoDirectoTotal).toBe(282800);
  });

  it('reporta error de sintaxis si el YAML tiene indentación incorrecta', () => {
    const brokenYaml = `
cliente: Juan
obra:
  - Thames:
   error_indentacion
    `;

    const result = parseDSLToPresupuesto(brokenYaml, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    const errorDiag = result.diagnostics.find((d) => d.type === 'error');
    expect(errorDiag).toBeDefined();
    expect(errorDiag?.message).toContain('Error de sintaxis YAML');
  });

  it('serializa un presupuesto a YAML y lo vuelve a parsear bidireccionalmente', () => {
    const capitulos: CapituloPresupuesto[] = [{ id: 'cap-1', nombre: 'Sector Tableros' }];
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

    const yaml = serializePresupuestoToDSL({
      clienteId: 'cli-1',
      direccionObra: 'Juncal 1234',
      tipoFactura: 'Factura B',
      validezDias: 20,
      margenPorcentaje: 30,
      capitulos,
      items,
      clientes: mockClientes
    });

    expect(yaml).toContain('cliente: Estudio Arq. Gómez');
    expect(yaml).toContain('obra: Juncal 1234');
    expect(yaml).toContain('Sector Tableros:');
    expect(yaml).toContain('- 15 u Boca de Iluminación');

    const parsed = parseDSLToPresupuesto(yaml, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(parsed.clienteId).toBe('cli-1');
    expect(parsed.direccionObra).toBe('Juncal 1234');
    expect(parsed.capitulos[0].nombre).toBe('Sector Tableros');
    expect(parsed.items.length).toBe(1);
    expect(parsed.items[0].descripcion).toBe('Boca de Iluminación');
    expect(parsed.items[0].cantidad).toBe(15);
  });

  it('parsea partidas a medida con materiales agrupados por sub-categorías', () => {
    const yaml = `
Tableros:
  - Tablero Categorizado:
      materiales:
        cables:
          - 20 m Cable 2.5mm
        protecciones:
          - 1 u Disyuntor 2x40A
      mano_obra:
        - 4 h Oficial
    `;

    const result = parseDSLToPresupuesto(yaml, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item.insumosSnapshot.length).toBe(2);
    expect(item.insumosSnapshot[0].nombre).toBe('Cable 2.5mm');
    expect(item.insumosSnapshot[0].cantidadTotal).toBe(20);
    expect(item.insumosSnapshot[1].nombre).toBe('Disyuntor 2x40A');
    expect(item.insumosSnapshot[1].cantidadTotal).toBe(1);
    expect(item.manoObraSnapshot.length).toBe(1);
  });
});
