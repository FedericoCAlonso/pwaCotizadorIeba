import { describe, it, expect } from 'vitest';
import {
  serializeTareaTipoToDSL,
  parseTareaTipoFromDSL,
  normalizeDslString
} from './tareaTipoDsl';
import { TareaFormData, Insumo, CategoriaManoDeObra } from './types';
import { DEFAULT_TAREAS_TIPO_SEEDS } from './sampleData';

describe('tareaTipoDsl', () => {
  const mockInsumosMap = new Map<string, Insumo>([
    [
      'ins_cable_25',
      {
        id: 'ins_cable_25',
        categoriaId: 'cat_cables',
        nombre: 'Cable Unipolar 2.5mm Normalizado',
        unidadVenta: 'm',
        atributos: [],
        activo: true,
        precioActual: 1200,
        marca: 'Prysmian',
        codigoProveedor: 'CAB-25-PRY',
      },
    ],
    [
      'ins_cinta',
      {
        id: 'ins_cinta',
        categoriaId: 'cat_cintas',
        nombre: 'Cinta Aisladora 20m',
        unidadVenta: 'u',
        atributos: [],
        activo: true,
        precioActual: 1500,
        marca: '3M',
      },
    ],
  ]);

  const mockManoObraMap = new Map<string, CategoriaManoDeObra>([
    [
      'mo_oficial',
      {
        id: 'mo_oficial',
        nombre: 'Oficial Electricista',
        costoHora: 9000,
        fechaActualizacion: '2026-09-10',
      },
    ],
    [
      'mo_ayudante',
      {
        id: 'mo_ayudante',
        nombre: 'Ayudante',
        costoHora: 6000,
        fechaActualizacion: '2026-09-10',
      },
    ],
  ]);

  const sampleFormData: TareaFormData = {
    nombre: 'Recableado Integral de Circuito',
    categoria: 'Instalaciones',
    unidad: 'boca',
    naturaleza: 'instalacion',
    honorarioBase: 0,
    formulaHonorarios: '',
    costoServicioDirecto: 0,
    costoFijoOperativo: 15000,
    descripcionCostoFijo: 'Movilidad y herramientas',
    horasSetupTotal: 1.5,
    cuadrillaRecomendada: { oficiales: 1, ayudantes: 1 },
    parametros: [
      {
        id: 'bocas',
        nombre: 'Cantidad de Bocas',
        tipo: 'numero',
        valorDefault: 10,
        unidad: 'u',
      },
      {
        id: 'distancia_promedio',
        nombre: 'Distancia Promedio por Boca',
        tipo: 'numero',
        valorDefault: 8,
        unidad: 'm',
      },
    ],
    variables: [
      {
        id: 'metros_cable',
        nombre: 'Metros de Cable Totales',
        formula: 'bocas * distancia_promedio * 3',
        unidad: 'm',
      },
    ],
    insumos: [
      {
        materialId: 'ins_cable_25',
        cantidad: 1,
        formula: 'metros_cable',
      },
      {
        materialId: 'ins_cinta',
        cantidad: 2,
      },
    ],
    manoObra: [
      {
        categoriaId: 'mo_oficial',
        horas: 1,
        formula: 'bocas * 0.75',
        horasSetup: 0.5,
      },
    ],
    notasTecnicas: 'Incluye desmonte y reconexión de artefactos.',
    clausulaExclusiones: 'No incluye canalizaciones embutidas adicionales.',
  };

  it('normaliza cadenas correctamente eliminando tildes y mayúsculas', () => {
    expect(normalizeDslString('Cable Térmico Eléctrico')).toBe('cable termico electrico');
    expect(normalizeDslString('   OFICIAL ELECTRICISTA  ')).toBe('oficial electricista');
  });

  it('serializa TareaFormData a YAML sin encabezados internos de sistema', () => {
    const yaml = serializeTareaTipoToDSL(sampleFormData, mockInsumosMap, mockManoObraMap);

    expect(yaml).toContain('nombre: Recableado Integral de Circuito');
    expect(yaml).toContain('categoria: Instalaciones');
    expect(yaml).toContain('unidad: boca');
    expect(yaml).not.toContain('tipo: trabajo_tipo'); // Encabezado no visible para el usuario
    expect(yaml).toContain('bocas * distancia_promedio * 3');
    expect(yaml).toContain('Cable Unipolar 2.5mm Normalizado');
    expect(yaml).toContain('Oficial Electricista');
  });

  it('parsea YAML hacia TareaFormData realizando round-trip con éxito', () => {
    const yaml = serializeTareaTipoToDSL(sampleFormData, mockInsumosMap, mockManoObraMap);
    const { data, diagnostics } = parseTareaTipoFromDSL(
      yaml,
      mockInsumosMap,
      mockManoObraMap,
      ['Instalaciones']
    );

    expect(diagnostics).toHaveLength(0);
    expect(data.nombre).toBe(sampleFormData.nombre);
    expect(data.categoria).toBe(sampleFormData.categoria);
    expect(data.costoFijoOperativo).toBe(15000);
    expect(data.horasSetupTotal).toBe(1.5);
    expect(data.cuadrillaRecomendada?.oficiales).toBe(1);
    expect(data.cuadrillaRecomendada?.ayudantes).toBe(1);
    expect(data.parametros).toHaveLength(2);
    expect(data.parametros[0].id).toBe('bocas');
    expect(data.variables).toHaveLength(1);
    expect(data.variables[0].id).toBe('metros_cable');
    expect(data.insumos).toHaveLength(2);
    expect(data.insumos[0].materialId).toBe('ins_cable_25');
    expect(data.insumos[0].formula).toBe('metros_cable');
    expect(data.insumos[1].materialId).toBe('ins_cinta');
    expect(data.insumos[1].cantidad).toBe(2);
    expect(data.manoObra).toHaveLength(1);
    expect(data.manoObra[0].categoriaId).toBe('mo_oficial');
    expect(data.manoObra[0].formula).toBe('bocas * 0.75');
    expect(data.notasTecnicas).toBe('Incluye desmonte y reconexión de artefactos.');
    expect(data.clausulaExclusiones).toBe('No incluye canalizaciones embutidas adicionales.');
  });

  it('soporta matching difuso en nombres de insumos y categorías de mano de obra', () => {
    const yaml = `
nombre: Tarea con Nombres Difusos
categoria: General
unidad: u

materiales:
  - material: "cable unipolar 2.5mm normalizado"
    formula: "15"
  - material: "cinta aisladora 20m"
    cantidad: 3

mano_obra:
  - categoria: "oficial electricista"
    horas: 4
`;

    const { data, diagnostics } = parseTareaTipoFromDSL(yaml, mockInsumosMap, mockManoObraMap);

    expect(diagnostics).toHaveLength(0);
    expect(data.insumos[0].materialId).toBe('ins_cable_25');
    expect(data.insumos[1].materialId).toBe('ins_cinta');
    expect(data.manoObra[0].categoriaId).toBe('mo_oficial');
    expect(data.manoObra[0].horas).toBe(4);
  });

  it('soporta formato diccionario abreviado en cálculos', () => {
    const yaml = `
nombre: Tarea con Cálculos Abreviados
unidad: u

parametros:
  - id: bocas
    default: 5

calculos:
  metros_cable: bocas * 10
  horas_total: bocas * 1.5
`;

    const { data } = parseTareaTipoFromDSL(yaml, mockInsumosMap, mockManoObraMap);

    expect(data.variables).toHaveLength(2);
    expect(data.variables[0].id).toBe('metros_cable');
    expect(data.variables[0].formula).toBe('bocas * 10');
    expect(data.variables[1].id).toBe('horas_total');
    expect(data.variables[1].formula).toBe('bocas * 1.5');
  });

  it('tolera si el YAML incluye un encabezado interno "tipo: trabajo_tipo" sin fallar', () => {
    const yaml = `
tipo: trabajo_tipo
version: 1
nombre: Tarea con Encabezado Interno
unidad: u
`;

    const { data, diagnostics } = parseTareaTipoFromDSL(yaml, mockInsumosMap, mockManoObraMap);

    expect(diagnostics).toHaveLength(0);
    expect(data.nombre).toBe('Tarea con Encabezado Interno');
  });

  it('reporta diagnóstico si un insumo no existe en el catálogo', () => {
    const yaml = `
nombre: Tarea con Insumo Desconocido
unidad: u

materiales:
  - material: Transformador Nuclear 500kVA
    cantidad: 1
`;

    const { data, diagnostics } = parseTareaTipoFromDSL(yaml, mockInsumosMap, mockManoObraMap);

    expect(diagnostics.some(d => d.message.includes('Transformador Nuclear 500kVA'))).toBe(true);
    expect(data.insumos[0].materialId).toBeUndefined();
    expect(data.insumos[0].nombreSlot).toBe('Transformador Nuclear 500kVA');
  });

  it('reporta diagnóstico de sintaxis cuando el YAML está mal formateado', () => {
    const badYaml = `
nombre: Tarea Rota
  indentacion_invalida:
    - foo: [bar
`;

    const { diagnostics } = parseTareaTipoFromDSL(badYaml, mockInsumosMap, mockManoObraMap);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0].type).toBe('error');
  });

  it('serializa y parsea correctamente todas las plantillas predeterminadas de DEFAULT_TAREAS_TIPO_SEEDS', () => {
    DEFAULT_TAREAS_TIPO_SEEDS.forEach((tt) => {
      const yaml = serializeTareaTipoToDSL(tt as unknown as TareaFormData, mockInsumosMap, mockManoObraMap);
      expect(yaml).toBeDefined();
      expect(typeof yaml).toBe('string');
      expect(yaml.length).toBeGreaterThan(20);

      const { data, diagnostics } = parseTareaTipoFromDSL(yaml, mockInsumosMap, mockManoObraMap);
      const errors = diagnostics.filter(d => d.type === 'error');
      expect(errors).toHaveLength(0);
      expect(data.nombre).toBe(tt.nombre);
      expect(data.categoria).toBe(tt.categoria);
      expect(data.parametros?.length).toBe(tt.parametros?.length || 0);
      expect(data.variables?.length).toBe(tt.variables?.length || 0);
    });
  });
});
