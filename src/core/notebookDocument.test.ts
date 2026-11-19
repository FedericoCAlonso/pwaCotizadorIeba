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
  actualizarParametroEnBloque,
  actualizarParametroEnLineaTt,
  buildNotebookCommandPalette,
  construirLineaItemLibreRapido,
  construirLineaTareaTipoDesdeEsquema,
  construirTareaTipoDesdeItemLibre,
  eliminarBloqueEnLinea,
  evaluateNotebookText,
  evaluarVisibilidadParametroEnEsquema,
  filterNotebookCommandPalette,
  findNextParameterSlot,
  findNextParameterSlotInDocument,
  getContextualAutocompleteSuggestions,
  NotebookDocumentContext,
  ordenarTareasTipoParaMovil,
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

  it('ordena trabajos tipo para móvil con recientes arriba y filtra por texto', () => {
    const ttReciente: TareaTipo = {
      ...tareaRecableado,
      id: 'tt-reciente',
      nombre: 'Instalación Tablero Seccional',
      slug: 'tablero-seccional',
      frecuenciaUso: 3,
      ultimoUsoFecha: '2026-11-12T10:00:00.000Z'
    };
    const ttViejaFrecuente: TareaTipo = {
      ...tareaRecableado,
      id: 'tt-vieja',
      nombre: 'Recableado Antiguo',
      slug: 'recableado-antiguo',
      frecuenciaUso: 40,
      ultimoUsoFecha: '2026-10-01T10:00:00.000Z'
    };
    const ordenadas = ordenarTareasTipoParaMovil([tareaRecableado, ttViejaFrecuente, ttReciente]);
    expect(ordenadas[0].id).toBe('tt-reciente');
    expect(ordenadas[1].id).toBe('tt-vieja');

    const filtradas = ordenarTareasTipoParaMovil([tareaRecableado, ttViejaFrecuente, ttReciente], 'seccional');
    expect(filtradas).toHaveLength(1);
    expect(filtradas[0].id).toBe('tt-reciente');
  });

  it('evalúa visibilidad condicional y manipula líneas de esquema e ítem libre rápido', () => {
    expect(
      evaluarVisibilidadParametroEnEsquema(
        {
          id: 'metros_extra',
          nombre: 'Metros extra',
          tipo: 'numero',
          valorDefault: 5,
          condicion: 'bocas >= 10'
        },
        { bocas: 8 }
      )
    ).toBe(false);
    expect(
      evaluarVisibilidadParametroEnEsquema(
        {
          id: 'metros_extra',
          nombre: 'Metros extra',
          tipo: 'numero',
          valorDefault: 5,
          condicion: 'bocas >= 10'
        },
        { bocas: 12 }
      )
    ).toBe(true);

    const lineaTt = construirLineaTareaTipoDesdeEsquema(tareaRecableado, { sup: 75, bocas: 16 });
    expect(lineaTt).toBe('/tt recableado-completo\n  sup = 75\n  bocas = 16');

    const actualizadoBloque = actualizarParametroEnBloque(`${lineaTt}\n  -extra`, 1, 'bocas', 20);
    expect(actualizadoBloque).toBe('/tt recableado-completo\n  sup = 75\n  bocas = 20\n  -extra');

    const actualizada = actualizarParametroEnLineaTt('/tt recableado-completo  sup=75  bocas=16  -extra', 'bocas', 20);
    expect(actualizada).toBe('/tt recableado-completo  sup=75  bocas=20  -extra');

    const libre = construirLineaItemLibreRapido('Visita técnica   en obra', 2, 15000);
    expect(libre).toBe('item: Visita técnica en obra\n  cantidad = 2u\n  precio = 15000');

    const doc = ['/tt recableado-completo  bocas=10', '  cable 2.5mm celeste  20m', libre].join('\n');
    const sinPrimero = eliminarBloqueEnLinea(doc, 1);
    expect(sinPrimero).toBe(libre);
  });

  it('autocompleta de forma no invasiva, soporta búsqueda inteligente de materiales y navegación Tab/Shift+Tab multilínea', () => {
    // Línea vacía o texto común no abre sugerencias invasivamente
    const emptyAc = getContextualAutocompleteSuggestions('', 1, 1, contexto);
    expect(emptyAc.isOpen).toBe(false);
    const shortAc = getContextualAutocompleteSuggestions('ho', 1, 3, contexto);
    expect(shortAc.isOpen).toBe(false);

    // Ctrl+Space (forceOpen) sí abre comandos
    const forcedAc = getContextualAutocompleteSuggestions('', 1, 1, contexto, [], { forceOpen: true });
    expect(forcedAc.isOpen).toBe(true);
    expect(forcedAc.suggestions.some(s => s.insertText === '/tt ')).toBe(true);

    // Búsqueda inteligente de materiales: tokens desordenados + cantidad indentada debajo
    const matSmart = getContextualAutocompleteSuggestions('tarea: Tablero\n  celeste 2.5 25m', 2, 18, contexto);
    expect(matSmart.isOpen).toBe(true);
    expect(matSmart.suggestions[0].kind).toBe('material');
    expect(matSmart.suggestions[0].insertText).toBe('mat: Cable 2.5mm Celeste\n    cantidad = 25m');
    expect(matSmart.suggestions[0].detail).toContain('Prysmian');

    // Autocompletado de mano de obra indentado (mo: -> horas = 2hs)
    const moAc = getContextualAutocompleteSuggestions('tarea: Tablero\n  mo: ofi', 2, 10, contexto);
    expect(moAc.isOpen).toBe(true);
    expect(moAc.suggestions[0].kind).toBe('mano_obra');
    expect(moAc.suggestions[0].insertText).toBe('mo: Oficial Electricista\n    horas = 2hs');

    // Autocompletado de atributo hijo nivel 2 (`marca = ` debajo de `mat:`)
    const brandChildAc = getContextualAutocompleteSuggestions(
      'tarea: Tablero\n  mat: Cable 2.5mm Celeste\n    marca = Prys',
      3,
      17,
      contexto
    );
    expect(brandChildAc.isOpen).toBe(true);
    expect(brandChildAc.suggestions[0].kind).toBe('producto');
    expect(brandChildAc.suggestions[0].insertText).toBe('Prysmian Superastic');

    // Tab selecciona sólo el número (sin unidad) en cantidad = 25m / horas = 4.5hs
    const matTabDoc = 'tarea: Tablero\n  mat: Cable 2.5mm Celeste\n    cantidad = 25m\n  mo: Oficial\n    horas = 4.5hs';
    const tabQty = findNextParameterSlotInDocument(matTabDoc, 2, 5, 1);
    expect(tabQty.handled).toBe(true);
    expect(tabQty.linea).toBe(3);
    expect(matTabDoc.split('\n')[2].slice((tabQty.selectionStartCol ?? 1) - 1, (tabQty.selectionEndCol ?? 1) - 1)).toBe('25');

    const tabHrs = findNextParameterSlotInDocument(matTabDoc, 3, tabQty.columna, 1);
    expect(tabHrs.handled).toBe(true);
    expect(tabHrs.linea).toBe(5);
    expect(matTabDoc.split('\n')[4].slice((tabHrs.selectionStartCol ?? 1) - 1, (tabHrs.selectionEndCol ?? 1) - 1)).toBe('4.5');

    // Tab y Shift+Tab saltan entre sub-líneas indentadas de un bloque /tt
    const multilineDoc = '/tt recableado-completo\n  sup = 60\n  bocas = 24';
    const j1 = findNextParameterSlotInDocument(multilineDoc, 1, 4, 1);
    expect(j1.handled).toBe(true);
    expect(j1.linea).toBe(2);
    expect(j1.paramId).toBe('sup');

    const j2 = findNextParameterSlotInDocument(multilineDoc, j1.linea, j1.columna, 1);
    expect(j2.handled).toBe(true);
    expect(j2.linea).toBe(3);
    expect(j2.paramId).toBe('bocas');

    const back = findNextParameterSlotInDocument(multilineDoc, j2.linea, j2.columna, -1);
    expect(back.handled).toBe(true);
    expect(back.linea).toBe(2);
    expect(back.paramId).toBe('sup');
  });

  it('valida variables no definidas sin fallos silenciosos, encadena parámetros locales y preserva fórmulas en round-trip', () => {
    // 1. Errores visibles con línea exacta y sugerencia de typo en fórmulas de sub-líneas y parámetros
    const textoConTypos = [
      'bocas = 12',
      'tarifa = 5000',
      '/tt recableado-completo',
      '  sup = 60',
      '  bocas = boca * 2',
      'tarea: Circuito tomas',
      '  mat: Cable 2.5mm Celeste',
      '    cantidad = boca * 3 m',
      'item: Canalización extra',
      '  cantidad = 2 m',
      '  precio = tarfa * 1.2'
    ].join('\n');

    const resErr = evaluateNotebookText(textoConTypos, {}, contexto);
    expect(resErr.parseResult.valido).toBe(true);
    expect(resErr.aplicacion.erroresVariables).toHaveLength(3);
    expect(resErr.aplicacion.erroresVariables.map(e => ({ linea: e.linea, codigo: e.codigo }))).toEqual([
      { linea: 5, codigo: 'variable_no_definida' },
      { linea: 8, codigo: 'variable_no_definida' },
      { linea: 11, codigo: 'variable_no_definida' }
    ]);
    expect(resErr.aplicacion.erroresVariables[0].mensaje).toContain("¿Quisiste decir 'bocas'?");
    expect(resErr.aplicacion.erroresVariables[2].mensaje).toContain("¿Quisiste decir 'tarifa'?");

    // 2. Encadenamiento de parámetros locales + fórmulas naturales + round-trip sin pérdida de fórmulas
    const textoFiel = [
      'largo = 10 m',
      'tarifa = 4000',
      '/tt boca-basica',
      '  cantidad = largo / 2',
      'tarea: Circuito principal',
      '  bocas_local = 6',
      '  metros_local = bocas_local * 5',
      '  mat: Cable 2.5mm Celeste',
      '    cantidad = metros_local * 1.1 m',
      '  mo: Oficial Electricista',
      '    horas = bocas_local * 0.5 hs',
      '  serv: Flete materiales',
      '    cantidad = 1 gl',
      '    costo = tarifa * 2'
    ].join('\n');

    const eval1 = evaluateNotebookText(textoFiel, {}, contexto, { modoPasada: 'valorizacion' });
    expect(eval1.parseResult.errores).toEqual([]);
    expect(eval1.aplicacion.erroresVariables).toEqual([]);

    const ttItem = eval1.aplicacion.presupuesto.items[0];
    expect(ttItem.cantidad).toBe(5);
    expect(ttItem.formulaCantidad).toBe('largo / 2');

    const tareaItem = eval1.aplicacion.presupuesto.items[1];
    expect(tareaItem.insumosSnapshot[0].cantidadTotal).toBeCloseTo(33, 5);
    expect(tareaItem.insumosSnapshot[0].formulaCantidad).toBe('metros_local * 1.1');
    expect(tareaItem.manoObraSnapshot[0].horasTotales).toBe(3);
    expect(tareaItem.manoObraSnapshot[0].formulaHoras).toBe('bocas_local * 0.5');
    expect(tareaItem.costoServiciosTercerizados).toBe(8000);
    expect(tareaItem.serviciosTercerizados?.[0]).toMatchObject({
      descripcion: 'Flete materiales',
      unidad: 'gl',
      formulaCosto: 'tarifa * 2'
    });

    // Round-trip: Presupuesto -> NotebookBlock -> serialize -> parse -> Presupuesto
    const blocks = presupuestoToNotebookBlocks(eval1.aplicacion.presupuesto, contexto);
    const serialized = serialize(blocks, {
      tareasTipo: contexto.tareasTipo,
      materiales: contexto.materiales,
      productos: contexto.productos,
      manoObra: contexto.manoObra
    });
    expect(serialized).toContain('largo = 10 m');
    expect(serialized).toContain('cantidad = largo / 2');
    expect(serialized).toContain('metros_local = bocas_local * 5');
    expect(serialized).toContain('cantidad = metros_local * 1.1 m');
    expect(serialized).toContain('horas = bocas_local * 0.5 hs');
    expect(serialized).toContain('costo = tarifa * 2');

    const eval2 = evaluateNotebookText(serialized, {}, contexto, { modoPasada: 'valorizacion' });
    expect(eval2.parseResult.errores).toEqual([]);
    expect(eval2.aplicacion.erroresVariables).toEqual([]);
    expect(eval2.aplicacion.totales.precioFinalGlobal).toBe(eval1.aplicacion.totales.precioFinalGlobal);

    // 3. Tab en cantidad con fórmula + unidad separada por espacio selecciona solo la fórmula
    const tabFormulaDoc = 'tarea: Circuito\n  mat: Cable 2.5mm Celeste\n    cantidad = bocas * 2 m';
    const jump = findNextParameterSlotInDocument(tabFormulaDoc, 2, 5, 1);
    expect(jump.handled).toBe(true);
    expect(jump.linea).toBe(3);
    expect(
      tabFormulaDoc
        .split('\n')[2]
        .slice((jump.selectionStartCol ?? 1) - 1, (jump.selectionEndCol ?? 1) - 1)
    ).toBe('bocas * 2');
  });

  it('aplica álgebra pragmática de unidades: inferencia m², conversiones cm->m / min->h y advertencias suaves no bloqueantes', () => {
    const texto = [
      'largo = 12 m',
      'ancho = 5 m',
      'sup = largo * ancho',
      'tramo = 10 m + 80 cm',
      'tiempo = 2 h + 45 min',
      'bajada = 150 cm',
      'mezcla = 10 m + 3 hs',
      'tarea: Tendido de línea',
      '  mat: Cable 2.5mm Celeste',
      '    cantidad = bajada',
      '  mo: Oficial Electricista',
      '    horas = tiempo'
    ].join('\n');

    const { parseResult, aplicacion } = evaluateNotebookText(texto, {}, contexto, {
      modoPasada: 'valorizacion'
    });

    expect(parseResult.errores).toEqual([]);
    expect(aplicacion.erroresVariables).toEqual([]);

    const varsById = new Map((aplicacion.presupuesto.variablesCotizacion || []).map(v => [v.id, v]));
    expect(varsById.get('sup')).toMatchObject({ valorEvaluado: 60, unidad: 'm²' });
    expect(varsById.get('tramo')).toMatchObject({ valorEvaluado: 10.8, unidad: 'm' });
    expect(varsById.get('tiempo')).toMatchObject({ valorEvaluado: 2.75, unidad: 'h' });
    expect(varsById.get('mezcla')?.valorEvaluado).toBe(13);
    expect(varsById.get('mezcla')?.advertencia).toContain('incompatibles');
    expect(aplicacion.notasUnidadesPorLinea[7]?.advertencia).toContain('incompatibles');

    // bajada (150 cm) se convierte automáticamente a 1.5 m en Cable 2.5mm (unidadVenta: m)
    const tareaItem = aplicacion.presupuesto.items[0];
    expect(tareaItem.insumosSnapshot[0].cantidadTotal).toBeCloseTo(1.5, 5);
    expect(aplicacion.notasUnidadesPorLinea[10]?.nota).toBe('← 150 cm');
    expect(tareaItem.manoObraSnapshot[0].horasTotales).toBeCloseTo(2.75, 5);
  });

  it('ofrece autocompletado expression-aware: preserva prefijo tras operadores, incluye variables locales/globales con valor, funciones matemáticas, opciones select/boolean y comando de variable', () => {
    const ttConOpciones: TareaTipo = {
      ...tareaRecableado,
      id: 'tt-tablero',
      nombre: 'Tablero Seccional',
      slug: 'tablero-seccional',
      parametros: [
        {
          id: 'tipo_montaje',
          nombre: 'Tipo de montaje',
          tipo: 'select',
          valorDefault: 1,
          opciones: [
            { id: 'embutido', label: 'Embutido', valor: 1 },
            { id: 'exterior', label: 'Exterior', valor: 2 }
          ]
        },
        {
          id: 'con_tierra',
          nombre: 'Incluye puesta a tierra',
          tipo: 'boolean',
          valorDefault: 1
        }
      ]
    };
    const ctxExt: NotebookDocumentContext = {
      ...contexto,
      tareasTipo: [...contexto.tareasTipo, ttConOpciones]
    };
    const variableDetails = {
      superficie: { value: 80, unit: 'm²' },
      bocas: { value: 24 },
      tarifa: { value: 5000 }
    };

    // 1. Dentro de expresión después de `(`: reemplaza solo el identificador parcial (`su`) y muestra valor de variable
    const docExpr = 'superficie = 80 m²\nbocas = ceil(su';
    const acExpr = getContextualAutocompleteSuggestions(
      docExpr,
      2,
      16,
      ctxExt,
      ['superficie', 'bocas', 'tarifa'],
      { variableDetails }
    );
    expect(acExpr.isOpen).toBe(true);
    expect(acExpr.suggestions[0]).toMatchObject({
      kind: 'variable',
      label: 'superficie',
      insertText: 'superficie',
      replaceStartCol: 14,
      replaceEndCol: 16
    });
    expect(acExpr.suggestions[0].detail).toContain('80');
    expect(acExpr.suggestions[0].detail).toContain('m²');
    // Excluye la propia variable `bocas` en su propia declaración para evitar ciclos
    expect(acExpr.suggestions.some(s => s.label === 'bocas')).toBe(false);

    // 2. Funciones matemáticas en expresión con cursor dentro de los paréntesis
    const acFn = getContextualAutocompleteSuggestions(
      'superficie = 80\nbocas = ce',
      2,
      11,
      ctxExt,
      ['superficie', 'bocas'],
      { variableDetails }
    );
    expect(acFn.isOpen).toBe(true);
    const ceilSugg = acFn.suggestions.find(s => s.kind === 'funcion' && s.label.startsWith('ceil('));
    expect(ceilSugg).toBeTruthy();
    expect(ceilSugg?.insertText).toBe('ceil()');
    expect(ceilSugg?.selectionStartOffset).toBe(5);
    expect(ceilSugg?.selectionEndOffset).toBe(5);

    // 3. Variables locales declaradas en el mismo bloque `tarea:` + preservación del texto previo en `cantidad = bocas + `
    const docLocal = [
      'bocas = 24',
      'tarea: Circuito cocina',
      '  bocas_cocina = 6',
      '  mat: Cable 2.5mm Celeste',
      '    cantidad = bocas + boc'
    ].join('\n');
    const acLocal = getContextualAutocompleteSuggestions(
      docLocal,
      5,
      27,
      ctxExt,
      ['bocas'],
      { variableDetails }
    );
    expect(acLocal.isOpen).toBe(true);
    const localSugg = acLocal.suggestions.find(s => s.label === 'bocas_cocina');
    expect(localSugg).toBeTruthy();
    expect(localSugg?.detail).toContain('local');
    expect(localSugg?.replaceStartCol).toBe(24);
    expect(localSugg?.replaceEndCol).toBe(27);
    expect(acLocal.suggestions.some(s => s.label === 'bocas')).toBe(true);

    // 4. Opciones de parámetro `select` y `boolean` en bloque `/tt`
    const docSelect = '/tt tablero-seccional\n  tipo_montaje = ';
    const acSelect = getContextualAutocompleteSuggestions(
      docSelect,
      2,
      18,
      ctxExt,
      ['bocas'],
      { forceOpen: true, variableDetails }
    );
    expect(acSelect.isOpen).toBe(true);
    expect(acSelect.suggestions.filter(s => s.kind === 'opcion_parametro').map(s => s.insertText)).toEqual(['1', '2']);

    const docBool = '/tt tablero-seccional\n  con_tierra = ';
    const acBool = getContextualAutocompleteSuggestions(
      docBool,
      2,
      16,
      ctxExt,
      ['bocas'],
      { forceOpen: true, variableDetails }
    );
    expect(acBool.suggestions.filter(s => s.kind === 'opcion_parametro').map(s => s.label)).toEqual(['1 · Sí', '0 · No']);

    // 5. Comando `variable =` en menú `/` y `cmd-new-variable` en paleta Ctrl+K
    const acSlash = getContextualAutocompleteSuggestions('/', 1, 2, ctxExt);
    expect(acSlash.suggestions.some(s => s.id === 'cmd-var' && s.insertText === 'nombre = 1')).toBe(true);

    const palette = buildNotebookCommandPalette(ctxExt);
    const varCmd = filterNotebookCommandPalette(palette, 'variable')[0];
    expect(varCmd?.id).toBe('cmd-new-variable');
    expect(varCmd?.insertLine).toBe('medida = 1');
  });
});
