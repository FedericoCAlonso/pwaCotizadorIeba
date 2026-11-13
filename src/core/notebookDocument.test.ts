import { describe, it, expect } from 'vitest';
import { DEFAULT_APP_CONFIG } from './sampleData';
import {
  CategoriaManoDeObra,
  Material,
  Oferta,
  Producto,
  TareaTipo
} from './types';
import {
  buildNotebookCommandPalette,
  construirTareaTipoDesdeItemLibre,
  evaluateNotebookText,
  filterNotebookCommandPalette,
  findNextParameterSlot,
  getContextualAutocompleteSuggestions,
  NotebookDocumentContext,
  presupuestoToNotebookBlocks
} from './notebookDocument';
import { parse, serialize } from './notebookParser';

const materiales: Material[] = [
  {
    id: 'mat-cable-25',
    nombre: 'Cable 2.5mm Celeste',
    categoriaId: 'cables',
    unidadVenta: 'm',
    atributos: [],
    activo: true,
    frecuenciaUso: 50
  },
  {
    id: 'mat-cable-15',
    nombre: 'Cable 1.5mm Rojo',
    categoriaId: 'cables',
    unidadVenta: 'm',
    atributos: [],
    activo: true,
    frecuenciaUso: 10
  },
  {
    id: 'mat-canaleta',
    nombre: 'Canaleta PVC 20x10',
    categoriaId: 'canalizaciones',
    unidadVenta: 'm',
    atributos: [],
    activo: true,
    frecuenciaUso: 20
  },
  {
    id: 'mat-jabalina',
    nombre: 'Puesta a tierra',
    categoriaId: 'protecciones',
    unidadVenta: 'u',
    atributos: [],
    activo: true,
    frecuenciaUso: 5
  }
];

const productos: Producto[] = [
  {
    id: 'prod-prysmian-25',
    materialId: 'mat-cable-25',
    marca: 'Prysmian',
    modelo: 'Superastic',
    esPreferido: true
  },
  {
    id: 'prod-kalop-can',
    materialId: 'mat-canaleta',
    marca: 'Kalop',
    modelo: 'Standard',
    esPreferido: true
  },
  {
    id: 'prod-jab',
    materialId: 'mat-jabalina',
    marca: 'Genrod',
    modelo: '1.5m',
    esPreferido: true
  }
];

const ofertas: Oferta[] = [
  {
    id: 'of-1',
    materialId: 'mat-cable-25',
    productoId: 'prod-prysmian-25',
    proveedorNombre: 'Distribuidora Sur',
    precio: 1000,
    fecha: '2026-01-01T00:00:00Z',
    fuente: 'manual'
  },
  {
    id: 'of-1-nueva',
    materialId: 'mat-cable-25',
    productoId: 'prod-prysmian-25',
    proveedorNombre: 'Distribuidora Sur',
    precio: 1200,
    fecha: '2026-02-01T00:00:00Z',
    fuente: 'manual'
  },
  {
    id: 'of-can',
    materialId: 'mat-canaleta',
    productoId: 'prod-kalop-can',
    proveedorNombre: 'Distribuidora Sur',
    precio: 500,
    fecha: '2026-02-01T00:00:00Z',
    fuente: 'manual'
  },
  {
    id: 'of-jab',
    materialId: 'mat-jabalina',
    productoId: 'prod-jab',
    proveedorNombre: 'Distribuidora Sur',
    precio: 15000,
    fecha: '2026-02-01T00:00:00Z',
    fuente: 'manual'
  }
];

const manoObra: CategoriaManoDeObra[] = [
  { id: 'mo-oficial', nombre: 'Oficial Electricista', costoHora: 8000, fechaActualizacion: '2026-03-01' },
  { id: 'mo-ayudante', nombre: 'Ayudante Electricista', costoHora: 5000, fechaActualizacion: '2026-03-01' }
];

const tareaBaseBoca: TareaTipo = {
  id: 'tt-boca',
  nombre: 'Boca básica',
  slug: 'boca-basica',
  categoria: 'Bocas',
  unidad: 'u',
  frecuenciaUso: 5,
  parametros: [{ id: 'cantidad', nombre: 'Cantidad', tipo: 'numero', valorDefault: 1 }],
  insumos: [{ materialId: 'mat-cable-25', cantidad: 5 }],
  manoObra: [{ categoriaId: 'mo-oficial', horas: 0.5 }]
};

const tareaRecableado: TareaTipo = {
  id: 'tt-recableado',
  nombre: 'Recableado Completo',
  slug: 'recableado-completo',
  categoria: 'Instalaciones',
  unidad: 'm2',
  frecuenciaUso: 40,
  parametros: [
    { id: 'sup', nombre: 'Superficie', tipo: 'numero', valorDefault: 50 },
    { id: 'bocas', nombre: 'Bocas', tipo: 'numero', valorDefault: 20 }
  ],
  insumos: [
    { materialId: 'mat-cable-25', cantidad: 1, formula: 'bocas * 2' },
    { materialId: 'mat-jabalina', claveAjuste: 'puesta-a-tierra', cantidad: 1 }
  ],
  manoObra: [{ categoriaId: 'mo-oficial', horas: 1, formula: 'bocas * 0.25' }],
  subTrabajos: [{ tareaTipoId: 'tt-boca', cantidadDefault: 2 }],
  supuestos: [
    {
      id: 'caneria',
      nombre: 'Estado de cañería',
      opciones: ['original', 'verificada', 'no_verificada'],
      valorDefault: 'no_verificada',
      descripcion: 'Estado de cañería existente'
    }
  ],
  alcance: {
    inclusiones: [{ id: 'inc-1', texto: 'Cableado completo con conductores normalizados' }],
    exclusiones: [{ id: 'exc-1', texto: 'Albañilería y pintura' }]
  },
  advertenciasCondicionales: [
    {
      id: 'adv-embutida',
      supuestoId: 'caneria',
      valoresActivacion: ['no_verificada'],
      textoPlantilla: 'Si al abrir aparece cañería embutida directa, se repone a {precio} por metro.',
      precioUnitarioContingencia: 8500,
      unidadContingencia: 'm',
      tema: 'caneria'
    }
  ]
};

const contexto: NotebookDocumentContext = {
  config: { ...DEFAULT_APP_CONFIG, tipoFacturaPorDefecto: 'Factura C', margenPorDefectoPct: 20 },
  tareasTipo: [tareaRecableado, tareaBaseBoca],
  materiales,
  productos,
  ofertas,
  manoObra
};

describe('notebookDocument', () => {
  it('resuelve Material -> Producto -> Oferta vigente, composición y ajustes -/+ al aplicar bloques', () => {
    const texto = [
      'supuesto: caneria = no_verificada',
      'nota: Verificar tablero seccional antes de empezar',
      'bocas_base = 10',
      'bocas = bocas_base * 2',
      '# Instalaciones Eléctricas',
      '/tt recableado-completo  sup=60  bocas=bocas  -puesta-a-tierra  +canaleta 10m',
      'item: Apertura de canaleta  1 gl  45000'
    ].join('\n');

    const { parseResult, aplicacion } = evaluateNotebookText(texto, {}, contexto, {
      modoPasada: 'valorizacion'
    });

    expect(parseResult.valido).toBe(true);
    expect(aplicacion.esTotalParcial).toBe(false);
    expect(aplicacion.presupuesto.items).toHaveLength(2);

    const recItem = aplicacion.presupuesto.items[0];
    // Factura C agrega IVA (21%) sobre base neta en insumosSnapshot: 65000 * 1.21 = 78650
    // Canaleta agregada (+canaleta 10m); Puesta a tierra quitada (-puesta-a-tierra)
    expect(recItem.insumosSnapshot.some(s => s.materialId === 'mat-jabalina')).toBe(false);
    expect(recItem.insumosSnapshot.some(s => s.materialId === 'mat-canaleta')).toBe(true);
    expect(recItem.costoInsumos).toBe(78650);
    // MO: recableado 20*0.25=5h + subTrabajo 2*0.5h=1h => 6h * 8000 = 48000
    expect(recItem.costoManoObra).toBe(48000);
    expect(recItem.costoDirectoTotal).toBe(126650);

    // Advertencia activa porque supuesto caneria está no_verificada y nota interna guardada
    expect(aplicacion.alcanceYAdvertencias.advertenciasVisibles).toHaveLength(1);
    expect(aplicacion.presupuesto.notasInternasLista).toHaveLength(1);
    expect(aplicacion.totales.precioFinalGlobal).toBeGreaterThan(126650);
  });

  it('soporta flujo en dos pasadas (esqueleto sin_valorizar y valorización selectiva)', () => {
    const texto = [
      '/tt recableado-completo  sup=60  bocas=20',
      '/tt boca-basica  cantidad=4'
    ].join('\n');

    // Pasada 1: esqueleto
    const pass1 = evaluateNotebookText(texto, {}, contexto, { modoPasada: 'esqueleto' });
    expect(pass1.aplicacion.esTotalParcial).toBe(true);
    expect(pass1.aplicacion.tareasSinValorizar).toHaveLength(2);
    expect(pass1.aplicacion.totales.precioFinalGlobal).toBe(0);

    // Pasada 2: valorizar solo el segundo ítem
    const segundoId = pass1.aplicacion.presupuesto.items[1].id;
    const pass2 = evaluateNotebookText(texto, pass1.aplicacion.presupuesto, contexto, {
      modoPasada: 'esqueleto',
      valorizarItemIds: [segundoId]
    });
    expect(pass2.aplicacion.tareasSinValorizar).toHaveLength(1);
    expect(pass2.aplicacion.esTotalParcial).toBe(true);
    expect(pass2.aplicacion.subtotalesPorItemId[segundoId].estadoValorizacion).toBe('valorizada');
    expect(pass2.aplicacion.subtotalesPorItemId[segundoId].costoDirecto).toBeGreaterThan(0);
  });

  it('detecta ciclos entre variables de cotización y reporta error', () => {
    const texto = ['a = b + 1', 'b = a + 2'].join('\n');
    const { aplicacion } = evaluateNotebookText(texto, {}, contexto);
    expect(aplicacion.erroresVariables.length).toBeGreaterThanOrEqual(2);
    expect(aplicacion.erroresVariables[0].codigo).toBe('ciclo_variable');
  });

  it('proyecta un Presupuesto existente a NotebookBlock y preserva datos en round-trip', () => {
    const textoOriginal = [
      'sup = 60',
      '# Tablero',
      '/tt boca-basica  cantidad=3',
      'item: Canalización externa  2 m  4000'
    ].join('\n');

    const first = evaluateNotebookText(textoOriginal, {}, contexto, { modoPasada: 'valorizacion' });
    const projectedBlocks = presupuestoToNotebookBlocks(first.aplicacion.presupuesto, contexto);
    const reserialized = serialize(projectedBlocks, {
      tareasTipo: contexto.tareasTipo,
      materiales: contexto.materiales,
      manoObra: contexto.manoObra
    });
    const reparsed = parse(reserialized, {
      tareasTipo: contexto.tareasTipo,
      materiales: contexto.materiales,
      manoObra: contexto.manoObra
    });

    expect(reparsed.errores).toEqual([]);
    expect(reparsed.valido).toBe(true);
    expect(reparsed.bloques.map(b => b.tipo)).toEqual(['variable', 'capitulo', 'tarea_tipo', 'item_libre']);
  });

  it('provee autocompletado contextual ordenado por frecuencia de uso + ghostText y salto Tab entre parámetros', () => {
    // 1. Nivel /tt por frecuencia (recableado tiene freq 40 vs boca 5)
    const acTt = getContextualAutocompleteSuggestions('/tt ', 1, 5, contexto);
    expect(acTt.isOpen).toBe(true);
    expect(acTt.suggestions[0].label).toBe('recableado-completo');

    // 2. Dentro de sub-línea de tarea: sugiere materiales ordenados por frecuencia
    const textoSub = 'tarea: Cablear cocina\n  cab';
    const acMat = getContextualAutocompleteSuggestions(textoSub, 2, 6, contexto);
    expect(acMat.isOpen).toBe(true);
    expect(acMat.suggestions[0].id).toBe('mat-mat-cable-25');
    expect(acMat.ghostText.length).toBeGreaterThan(0);

    // 3. Dentro de supuesto:
    const acSup = getContextualAutocompleteSuggestions('supuesto: can', 1, 14, contexto);
    expect(acSup.suggestions[0].label).toBe('caneria');

    // 4. Salto Tab entre parámetros en /tt
    const lineaTt = '/tt recableado-completo  sup=60  bocas=24';
    const jump1 = findNextParameterSlot(lineaTt, 1, 5);
    expect(jump1.handled).toBe(true);
    expect(jump1.paramId).toBe('sup');
    expect(lineaTt.slice((jump1.selectionStartCol ?? 1) - 1, (jump1.selectionEndCol ?? 1) - 1)).toBe('60');

    const jump2 = findNextParameterSlot(lineaTt, 1, jump1.columna);
    expect(jump2.handled).toBe(true);
    expect(jump2.paramId).toBe('bocas');
    expect(lineaTt.slice((jump2.selectionStartCol ?? 1) - 1, (jump2.selectionEndCol ?? 1) - 1)).toBe('24');
  });

  it('detecta tareas libres repetidas y construye TareaTipo + filtra paleta de comandos', () => {
    const texto = [
      'item: Colocar sensor crepuscular  1 u  18000',
      'item: Colocar sensor crepuscular  2 u  18000'
    ].join('\n');

    const { aplicacion } = evaluateNotebookText(texto, {}, contexto);
    expect(aplicacion.sugerenciasConversion).toHaveLength(1);
    expect(aplicacion.sugerenciasConversion[0].cantidadRepeticiones).toBe(2);

    const nuevaTt = construirTareaTipoDesdeItemLibre(aplicacion.presupuesto.items[0], 'tt-sensor');
    expect(nuevaTt.slug).toBe('colocar-sensor-crepuscular');
    expect(nuevaTt.costoFijoOperativo).toBe(18000);

    const palette = buildNotebookCommandPalette(contexto);
    const filtered = filterNotebookCommandPalette(palette, 'siguiente sin valorizar');
    expect(filtered[0].actionType).toBe('next_unvalorized');
  });
});
