import {
  CategoriaMaterial,
  Material,
  Producto,
  Oferta,
  Insumo,
  CategoriaManoDeObra,
  CostoIndirecto,
  TareaTipo,
  Cliente,
  Proveedor,
  Contacto,
  RolContacto,
  MotorBusquedaEcommerce,
  AppConfig,
  SupercategoriaMaterial
} from './types';
import appConfigData from '../config/appConfig.json';
import bdDefaultData from '../config/bdDefault.json';

const now = new Date().toISOString();

export interface OptionConfig<T = string> {
  value: T;
  label: string;
  multiplicador?: number;
  description?: string;
}

export const DEFAULT_MOTORES_BUSQUEDA: MotorBusquedaEcommerce[] = [
  {
    id: 'mercadolibre',
    nombre: 'Mercado Libre',
    urlTemplate: 'https://listado.mercadolibre.com.ar/{query}#D[A:{query}]',
    activo: true,
    icono: 'mercadolibre',
    esPredeterminado: true
  },
  {
    id: 'google_shopping',
    nombre: 'Google Shopping',
    urlTemplate: 'https://www.google.com.ar/search?tbm=shop&q={query}',
    activo: true,
    icono: 'google',
    esPredeterminado: false
  },
  {
    id: 'google_web',
    nombre: 'Google Web',
    urlTemplate: 'https://www.google.com/search?q={query}+precio+argentina',
    activo: true,
    icono: 'search',
    esPredeterminado: false
  }
];

export const DEFAULT_APP_CONFIG: AppConfig = {
  ...appConfigData.defaultAppConfig,
  categoriasTarea: appConfigData.categoriasTarea || (appConfigData.defaultAppConfig as any).categoriasTarea || ['Bocas', 'Circuitos', 'Tableros', 'Acometidas', 'Medición'],
  motoresBusquedaOnline: DEFAULT_MOTORES_BUSQUEDA
} as AppConfig;

export const DEFAULT_SUPERCATEGORIAS: SupercategoriaMaterial[] =
  ((appConfigData as any).supercategorias || []) as SupercategoriaMaterial[];

export const INITIAL_CATEGORIAS_MATERIAL: CategoriaMaterial[] =
  (bdDefaultData.categoriasMaterial || []) as CategoriaMaterial[];

export const INITIAL_MATERIALES: Material[] =
  (bdDefaultData.materiales || []) as Material[];

export const INITIAL_PRODUCTOS: Producto[] =
  (bdDefaultData.productos || []) as Producto[];

export const INITIAL_OFERTAS: Oferta[] =
  (bdDefaultData.ofertas || []) as Oferta[];

export const INITIAL_INSUMOS: Insumo[] = INITIAL_MATERIALES.map(m => {
  const oferta = INITIAL_OFERTAS.find(o => o.materialId === m.id);
  return {
    ...m,
    categoria: m.categoriaId,
    precioActual: oferta?.precio || 0,
    fechaActualizacion: oferta?.fecha || now,
    historialPrecios: [{ fecha: oferta?.fecha || now, precio: oferta?.precio || 0, fuente: 'Carga Inicial' }]
  };
});

export const INITIAL_MANO_OBRA: CategoriaManoDeObra[] = (bdDefaultData.manoObra as Partial<CategoriaManoDeObra>[] || []).map((mo) => ({
  id: mo.id || `mo-${crypto.randomUUID()}`,
  nombre: mo.nombre || '',
  costoHora: mo.costoHora || 0,
  fechaActualizacion: now
}));

export const INITIAL_COSTOS_INDIRECTOS: CostoIndirecto[] = (bdDefaultData.costosIndirectos || []) as CostoIndirecto[];

export const DEFAULT_TAREAS_TIPO_SEEDS: TareaTipo[] = [
  {
    id: 'tt-cableado-vivienda-10kw',
    nombre: 'Cableado o recableado Vivienda hasta 10kW',
    categoria: 'Bocas',
    unidad: 'u',
    notasTecnicas: 'Tendido y enhebrado de conductores unipolares IRAM 247-3 para circuitos de iluminación, tomas de uso general, tomas de uso especial y circuitos especiales con puesta a tierra integral según normativa AEA 90364.',
    clausulaExclusiones: 'La cotización contempla el enhebrado de conductores a través de canalizaciones existentes en condiciones transitables. En caso de cañerías obstruidas o inaccesibles, los trabajos de destape o recanalización se cotizarán como adicionales previa conformidad del cliente.',
    costoFijoOperativo: 0,
    descripcionCostoFijo: '',
    parametros: [
      { id: 'tug', nombre: 'Cantidad de bocas TUG', tipo: 'numero', valorDefault: 10, unidad: 'bocas', descripcion: 'Tomas de Uso General (2.5 mm²)' },
      { id: 'iug', nombre: 'Cantidad de bocas IUG', tipo: 'numero', valorDefault: 5, unidad: 'bocas', descripcion: 'Iluminación de Uso General (1.5 mm²)' },
      { id: 'tue', nombre: 'Cantidad de bocas TUE', tipo: 'numero', valorDefault: 2, unidad: 'bocas', descripcion: 'Tomas de Uso Especial (4.0 mm²)' },
      { id: 'circuitos_tue', nombre: 'Cantidad de circuitos TUE', tipo: 'numero', valorDefault: 1, unidad: 'circuitos', descripcion: 'Circuitos exclusivos TUE (4.0 mm²)' },
      { id: 'esp', nombre: 'Cantidad de bocas especiales', tipo: 'numero', valorDefault: 0, unidad: 'bocas', descripcion: 'Otras bocas / circuitos especiales' },
      { id: 'circuitos_esp', nombre: 'Cantidad de circuitos especiales', tipo: 'numero', valorDefault: 0, unidad: 'circuitos', descripcion: 'Circuitos dedicados para cargas especiales' },
      {
        id: 'seccion_esp',
        nombre: 'Sección cables de circuitos especiales',
        tipo: 'select',
        valorDefault: 4,
        unidad: 'mm²',
        descripcion: 'Sección nominal para circuitos especiales',
        opciones: [
          { id: 'opt-1-5', label: '1.5 mm²', valor: 1.5 },
          { id: 'opt-2-5', label: '2.5 mm²', valor: 2.5 },
          { id: 'opt-4-0', label: '4.0 mm²', valor: 4.0 },
          { id: 'opt-6-0', label: '6.0 mm²', valor: 6.0 }
        ]
      },
      { id: 'superficie', nombre: 'Superficie cubierta', tipo: 'numero', valorDefault: 50, unidad: 'm²', descripcion: 'Superficie de la vivienda en metros cuadrados' }
    ],
    variables: [
      {
        id: 'cable_2_5',
        nombre: 'Longitud línea TUG (2.5 mm²)',
        formula: 'ceil(ceil(tug / 12) * sqrt(superficie) / 1.4 + tug * 3.5)',
        unidad: 'm',
        descripcion: 'Troncal + derivación por boca para 2.5 mm²'
      },
      {
        id: 'cable_1_5',
        nombre: 'Longitud línea IUG (1.5 mm²)',
        formula: 'ceil(ceil(iug / 8) * sqrt(superficie) / 1.4 + iug * 3.2)',
        unidad: 'm',
        descripcion: 'Troncal + derivación por boca para 1.5 mm²'
      },
      {
        id: 'cable_1_5_ret',
        nombre: 'Longitud retornos IUG (1.5 mm²)',
        formula: 'iug * 3',
        unidad: 'm',
        descripcion: 'Retornos de iluminación'
      },
      {
        id: 'cable_4_0',
        nombre: 'Longitud línea TUE (4.0 mm²)',
        formula: 'ceil(circuitos_tue * sqrt(superficie) / 1.2 + tue * 4.0)',
        unidad: 'm',
        descripcion: 'Línea de Tomas de Uso Especial 4.0 mm²'
      },
      {
        id: 'cable_esp',
        nombre: 'Longitud circuitos especiales / otros',
        formula: 'ceil(circuitos_esp * sqrt(superficie) / 1.2 + esp * 4.0)',
        unidad: 'm',
        descripcion: 'Líneas dedicadas para cargas especiales'
      },
      {
        id: 'bocas_totales',
        nombre: 'Total de bocas de la instalación',
        formula: 'iug + tug + tue + esp',
        unidad: 'bocas',
        descripcion: 'Suma de bocas a cablear'
      },
      {
        id: 'horas_base_oficial',
        nombre: 'Horas netas Oficial Electricista',
        formula: 'bocas_totales * 0.35 + 2.0',
        unidad: 'hs',
        descripcion: 'Base de replanteo y conexionado + tiempo por boca'
      },
      {
        id: 'horas_base_ayudante',
        nombre: 'Horas netas Ayudante',
        formula: 'bocas_totales * 0.25 + 2.0',
        unidad: 'hs',
        descripcion: 'Base de asistencia + tiempo por boca'
      },
      {
        id: 'horas_oficial',
        nombre: 'Horas Oficial (con descanso 20m cada 2hs)',
        formula: 'round(horas_base_oficial + floor(horas_base_oficial / 2) * 0.333, 2)',
        unidad: 'hs',
        descripcion: 'Horas con descanso reglamentario de 20 min por cada bloque de 2 hs'
      },
      {
        id: 'horas_ayudante',
        nombre: 'Horas Ayudante (con descanso 20m cada 2hs)',
        formula: 'round(horas_base_ayudante + floor(horas_base_ayudante / 2) * 0.333, 2)',
        unidad: 'hs',
        descripcion: 'Horas con descanso reglamentario de 20 min por cada bloque de 2 hs'
      }
    ],
    insumos: [
      {
        nombreSlot: 'Cable 2.5 mm² Celeste (Neutro)',
        filtroMaterial: {
          categoriaId: 'cat-cables',
          etiqueta: 'Cable Unipolar 2.5 mm² Celeste',
          criterios: [
            { atributo: 'tipo_cable', operador: '==', valor: 'Unipolar IRAM 247-3' },
            { atributo: 'seccion', operador: '==', valor: '2.5' },
            { atributo: 'color', operador: '==', valor: 'Celeste (Neutro)' }
          ],
          estrategiaSeleccion: 'mayor_valor_que_cumpla',
          atributoOrden: 'seccion'
        },
        cantidad: 41,
        formula: 'cable_2_5'
      },
      {
        nombreSlot: 'Cable 2.5 mm² Marrón (Fase)',
        filtroMaterial: {
          categoriaId: 'cat-cables',
          etiqueta: 'Cable Unipolar 2.5 mm² Marrón',
          criterios: [
            { atributo: 'tipo_cable', operador: '==', valor: 'Unipolar IRAM 247-3' },
            { atributo: 'seccion', operador: '==', valor: '2.5' },
            { atributo: 'color', operador: '==', valor: 'Marrón (Fase)' }
          ],
          estrategiaSeleccion: 'mayor_valor_que_cumpla',
          atributoOrden: 'seccion'
        },
        cantidad: 41,
        formula: 'cable_2_5'
      },
      {
        nombreSlot: 'Cable 2.5 mm² Verde/Amarillo (Tierra)',
        filtroMaterial: {
          categoriaId: 'cat-cables',
          etiqueta: 'Cable Unipolar 2.5 mm² Tierra',
          criterios: [
            { atributo: 'tipo_cable', operador: '==', valor: 'Unipolar IRAM 247-3' },
            { atributo: 'seccion', operador: '==', valor: '2.5' },
            { atributo: 'color', operador: '==', valor: 'Verde/Amarillo (Tierra)' }
          ],
          estrategiaSeleccion: 'mayor_valor_que_cumpla',
          atributoOrden: 'seccion'
        },
        cantidad: 41,
        formula: 'cable_2_5'
      },
      {
        nombreSlot: 'Cable 1.5 mm² Blanco (Retorno)',
        filtroMaterial: {
          categoriaId: 'cat-cables',
          etiqueta: 'Cable Unipolar 1.5 mm² Blanco',
          criterios: [
            { atributo: 'tipo_cable', operador: '==', valor: 'Unipolar IRAM 247-3' },
            { atributo: 'seccion', operador: '==', valor: '1.5' },
            { atributo: 'color', operador: '==', valor: 'Blanco (Retorno)' }
          ],
          estrategiaSeleccion: 'mayor_valor_que_cumpla',
          atributoOrden: 'seccion'
        },
        cantidad: 15,
        formula: 'cable_1_5_ret'
      },
      {
        nombreSlot: 'Cable 1.5 mm² Marrón (Fase)',
        filtroMaterial: {
          categoriaId: 'cat-cables',
          etiqueta: 'Cable Unipolar 1.5 mm² Marrón',
          criterios: [
            { atributo: 'tipo_cable', operador: '==', valor: 'Unipolar IRAM 247-3' },
            { atributo: 'seccion', operador: '==', valor: '1.5' },
            { atributo: 'color', operador: '==', valor: 'Marrón (Fase)' }
          ],
          estrategiaSeleccion: 'mayor_valor_que_cumpla',
          atributoOrden: 'seccion'
        },
        cantidad: 37,
        formula: 'cable_1_5 + cable_1_5_ret'
      },
      {
        nombreSlot: 'Cable 1.5 mm² Verde/Amarillo (Tierra)',
        filtroMaterial: {
          categoriaId: 'cat-cables',
          etiqueta: 'Cable Unipolar 1.5 mm² Tierra',
          criterios: [
            { atributo: 'tipo_cable', operador: '==', valor: 'Unipolar IRAM 247-3' },
            { atributo: 'seccion', operador: '==', valor: '1.5' },
            { atributo: 'color', operador: '==', valor: 'Verde/Amarillo (Tierra)' }
          ],
          estrategiaSeleccion: 'mayor_valor_que_cumpla',
          atributoOrden: 'seccion'
        },
        cantidad: 37,
        formula: 'cable_1_5 + cable_1_5_ret'
      },
      {
        nombreSlot: 'Cable 1.5 mm² Celeste (Neutro)',
        filtroMaterial: {
          categoriaId: 'cat-cables',
          etiqueta: 'Cable Unipolar 1.5 mm² Celeste',
          criterios: [
            { atributo: 'tipo_cable', operador: '==', valor: 'Unipolar IRAM 247-3' },
            { atributo: 'seccion', operador: '==', valor: '1.5' },
            { atributo: 'color', operador: '==', valor: 'Celeste (Neutro)' }
          ],
          estrategiaSeleccion: 'mayor_valor_que_cumpla',
          atributoOrden: 'seccion'
        },
        cantidad: 22,
        formula: 'cable_1_5'
      },
      {
        nombreSlot: 'Cable 4.0 mm² Celeste (Neutro TUE)',
        condicion: 'tue > 0',
        filtroMaterial: {
          categoriaId: 'cat-cables',
          etiqueta: 'Cable Unipolar 4.0 mm² Celeste',
          criterios: [
            { atributo: 'tipo_cable', operador: '==', valor: 'Unipolar IRAM 247-3' },
            { atributo: 'seccion', operador: '==', valor: '4' },
            { atributo: 'color', operador: '==', valor: 'Celeste (Neutro)' }
          ],
          estrategiaSeleccion: 'mayor_valor_que_cumpla',
          atributoOrden: 'seccion'
        },
        cantidad: 0,
        formula: 'cable_4_0'
      },
      {
        nombreSlot: 'Cable 4.0 mm² Marrón (Fase TUE)',
        condicion: 'tue > 0',
        filtroMaterial: {
          categoriaId: 'cat-cables',
          etiqueta: 'Cable Unipolar 4.0 mm² Marrón',
          criterios: [
            { atributo: 'tipo_cable', operador: '==', valor: 'Unipolar IRAM 247-3' },
            { atributo: 'seccion', operador: '==', valor: '4' },
            { atributo: 'color', operador: '==', valor: 'Marrón (Fase)' }
          ],
          estrategiaSeleccion: 'mayor_valor_que_cumpla',
          atributoOrden: 'seccion'
        },
        cantidad: 0,
        formula: 'cable_4_0'
      },
      {
        nombreSlot: 'Cable 4.0 mm² Verde/Amarillo (Tierra TUE)',
        condicion: 'tue > 0',
        filtroMaterial: {
          categoriaId: 'cat-cables',
          etiqueta: 'Cable Unipolar 4.0 mm² Tierra',
          criterios: [
            { atributo: 'tipo_cable', operador: '==', valor: 'Unipolar IRAM 247-3' },
            { atributo: 'seccion', operador: '==', valor: '4' },
            { atributo: 'color', operador: '==', valor: 'Verde/Amarillo (Tierra)' }
          ],
          estrategiaSeleccion: 'mayor_valor_que_cumpla',
          atributoOrden: 'seccion'
        },
        cantidad: 0,
        formula: 'cable_4_0'
      },
      {
        nombreSlot: 'Cable Especial Celeste (Neutro)',
        condicion: 'esp > 0',
        filtroMaterial: {
          categoriaId: 'cat-cables',
          etiqueta: 'Cable Unipolar Especial Celeste',
          criterios: [
            { atributo: 'tipo_cable', operador: '==', valor: 'Unipolar IRAM 247-3' },
            { atributo: 'seccion', operador: '==', valor: '$seccion_esp' },
            { atributo: 'color', operador: '==', valor: 'Celeste (Neutro)' }
          ],
          estrategiaSeleccion: 'mayor_valor_que_cumpla',
          atributoOrden: 'seccion'
        },
        cantidad: 0,
        formula: 'cable_esp'
      },
      {
        nombreSlot: 'Cable Especial Marrón (Fase)',
        condicion: 'esp > 0',
        filtroMaterial: {
          categoriaId: 'cat-cables',
          etiqueta: 'Cable Unipolar Especial Marrón',
          criterios: [
            { atributo: 'tipo_cable', operador: '==', valor: 'Unipolar IRAM 247-3' },
            { atributo: 'seccion', operador: '==', valor: '$seccion_esp' },
            { atributo: 'color', operador: '==', valor: 'Marrón (Fase)' }
          ],
          estrategiaSeleccion: 'mayor_valor_que_cumpla',
          atributoOrden: 'seccion'
        },
        cantidad: 0,
        formula: 'cable_esp'
      },
      {
        nombreSlot: 'Cable Especial Verde/Amarillo (Tierra)',
        condicion: 'esp > 0',
        filtroMaterial: {
          categoriaId: 'cat-cables',
          etiqueta: 'Cable Unipolar Especial Tierra',
          criterios: [
            { atributo: 'tipo_cable', operador: '==', valor: 'Unipolar IRAM 247-3' },
            { atributo: 'seccion', operador: '==', valor: '$seccion_esp' },
            { atributo: 'color', operador: '==', valor: 'Verde/Amarillo (Tierra)' }
          ],
          estrategiaSeleccion: 'mayor_valor_que_cumpla',
          atributoOrden: 'seccion'
        },
        cantidad: 0,
        formula: 'cable_esp'
      }
    ],
    manoObra: [
      { categoriaId: 'mo-ayudante', horas: 6.5, horasSetup: 1.0, horasRendimiento: 5.5, formula: 'horas_ayudante' },
      { categoriaId: 'mo-oficial-electricista', horas: 8.5, horasSetup: 1.0, horasRendimiento: 7.5, formula: 'horas_oficial' }
    ],
    horasSetupTotal: 2.0,
    cuadrillaRecomendada: { oficiales: 1, ayudantes: 1 },
    frecuenciaUso: 0,
    createdAt: now,
    updatedAt: now,
    deleted: false
  },
  {
    id: 'tt-tablero-seccional-din',
    nombre: 'Armado y Montaje de Tablero Seccional DIN',
    categoria: 'Tableros',
    unidad: 'u',
    notasTecnicas: 'Montaje de gabinete DIN estanco o embutir, peines de distribución aislados, interruptor diferencial bipolar/tetrapolar y llaves termomagnéticas calibradas según sección de conductores. Rotulación de circuitos y pruebas de disparo con instrumental.',
    clausulaExclusiones: 'La cotización no incluye acometida principal desde el medidor ni provisión de envolventes especiales de chapa pesada a menos que se especifique.',
    costoFijoOperativo: 0,
    descripcionCostoFijo: '',
    parametros: [
      { id: 'polos', nombre: 'Cantidad de módulos DIN (polos)', tipo: 'numero', valorDefault: 12, unidad: 'módulos', descripcion: 'Cantidad total de polos a alojar' },
      { id: 'disyuntores', nombre: 'Interruptores Diferenciales (ID)', tipo: 'numero', valorDefault: 1, unidad: 'unidades', descripcion: 'Disyuntores diferenciales bipolares o tetrapolares' },
      { id: 'termicas', nombre: 'Interruptores Termomagnéticos (PIA)', tipo: 'numero', valorDefault: 4, unidad: 'unidades', descripcion: 'Térmicas bipolares para circuitos' }
    ],
    variables: [
      {
        id: 'horas_oficial_tablero',
        nombre: 'Horas Oficial Tablero',
        formula: 'round(1.5 + termicas * 0.45 + disyuntores * 0.6, 2)',
        unidad: 'hs',
        descripcion: 'Montaje de gabinete + cableado y peinado por dispositivo'
      }
    ],
    insumos: [],
    manoObra: [
      { categoriaId: 'mo-oficial-electricista', horas: 3.9, horasSetup: 1.0, horasRendimiento: 2.9, formula: 'horas_oficial_tablero' }
    ],
    horasSetupTotal: 1.5,
    cuadrillaRecomendada: { oficiales: 1, ayudantes: 0 },
    frecuenciaUso: 0,
    createdAt: now,
    updatedAt: now,
    deleted: false
  },
  {
    id: 'tt-puesta-a-tierra-integral',
    nombre: 'Instalación de Sistema de Puesta a Tierra AEA',
    categoria: 'Medición',
    unidad: 'u',
    notasTecnicas: 'Hincado de jabalina de acero-cobre normalizada IRAM 2309 (1.5m x 5/8"), colocación de caja de inspección de PVC reforzada con tapa, morceto bronce-bronce, tendido de conductor de protección 1x10mm² hasta bornera principal de tierra (BPT) y medición de resistencia con telurómetro.',
    clausulaExclusiones: 'La cotización contempla terreno blando o estándar. En caso de suelo rocoso, contrapisos de hormigón armado de alto espesor o relleno con escombros, los trabajos de rotura y perforación especial se cotizarán por separado.',
    costoFijoOperativo: 0,
    descripcionCostoFijo: '',
    parametros: [
      { id: 'metros_cable', nombre: 'Metros de cable hasta Tablero', tipo: 'numero', valorDefault: 8, unidad: 'm', descripcion: 'Distancia desde jabalina hasta BPT' },
      { id: 'longitud_jabalina', nombre: 'Longitud de Jabalina', tipo: 'select', valorDefault: 1.5, unidad: 'm', descripcion: 'Largo de la jabalina', opciones: [
        { id: 'opt-1-5', label: '1.5 metros (Estándar)', valor: 1.5 },
        { id: 'opt-2-0', label: '2.0 metros (Reforzada)', valor: 2.0 },
        { id: 'opt-3-0', label: '3.0 metros (Industrial)', valor: 3.0 }
      ]}
    ],
    variables: [
      {
        id: 'horas_pat_oficial',
        nombre: 'Horas Oficial PAT',
        formula: 'round(1.0 + longitud_jabalina * 0.8 + metros_cable * 0.1, 2)',
        unidad: 'hs',
        descripcion: 'Conexionado, montaje caja BPT y medición'
      },
      {
        id: 'horas_pat_ayudante',
        nombre: 'Horas Ayudante PAT',
        formula: 'round(1.0 + longitud_jabalina * 1.0 + metros_cable * 0.15, 2)',
        unidad: 'hs',
        descripcion: 'Excavación, hincado y zanjeo'
      }
    ],
    insumos: [],
    manoObra: [
      { categoriaId: 'mo-oficial-electricista', horas: 3.0, horasSetup: 0.8, horasRendimiento: 2.2, formula: 'horas_pat_oficial' },
      { categoriaId: 'mo-ayudante', horas: 3.7, horasSetup: 0.8, horasRendimiento: 2.9, formula: 'horas_pat_ayudante' }
    ],
    horasSetupTotal: 1.0,
    cuadrillaRecomendada: { oficiales: 1, ayudantes: 1 },
    frecuenciaUso: 0,
    createdAt: now,
    updatedAt: now,
    deleted: false
  },
  {
    id: 'tt-boca-nueva-completa',
    nombre: 'Boca Nueva de Iluminación o Tomacorriente',
    categoria: 'Bocas',
    unidad: 'bocas',
    notasTecnicas: 'Canalización embutida con caño corrugado ignífugo o tubería PVC, colocación de caja rectangular u octogonal, tendido de conductores IRAM 247-3 y armado de bastidor con módulos de llave o toma.',
    clausulaExclusiones: 'No incluye pintura ni revoque fino de terminación en albañilería.',
    costoFijoOperativo: 0,
    descripcionCostoFijo: '',
    parametros: [
      { id: 'bocas', nombre: 'Cantidad de Bocas Nuevas', tipo: 'numero', valorDefault: 4, unidad: 'bocas', descripcion: 'Cantidad total de bocas completas a ejecutar' }
    ],
    variables: [
      {
        id: 'horas_oficial_boca',
        nombre: 'Horas Oficial Boca',
        formula: 'round(1.0 + bocas * 0.85, 2)',
        unidad: 'hs',
        descripcion: 'Replanteo + cableado y conexión'
      },
      {
        id: 'horas_ayudante_boca',
        nombre: 'Horas Ayudante Boca',
        formula: 'round(1.0 + bocas * 0.75, 2)',
        unidad: 'hs',
        descripcion: 'Acanalado y amurado de cajas'
      }
    ],
    insumos: [],
    manoObra: [
      { categoriaId: 'mo-oficial-electricista', horas: 4.4, horasSetup: 0.8, horasRendimiento: 3.6, formula: 'horas_oficial_boca' },
      { categoriaId: 'mo-ayudante', horas: 4.0, horasSetup: 0.8, horasRendimiento: 3.2, formula: 'horas_ayudante_boca' }
    ],
    horasSetupTotal: 1.0,
    cuadrillaRecomendada: { oficiales: 1, ayudantes: 1 },
    frecuenciaUso: 0,
    createdAt: now,
    updatedAt: now,
    deleted: false
  }
];

export const INITIAL_TAREAS_TIPO: TareaTipo[] =
  ((bdDefaultData.tareasTipo && bdDefaultData.tareasTipo.length > 0)
    ? bdDefaultData.tareasTipo
    : DEFAULT_TAREAS_TIPO_SEEDS) as TareaTipo[];

export const INITIAL_CLIENTES: Cliente[] = (bdDefaultData.clientes || []) as Cliente[];

export const INITIAL_PROVEEDORES: Proveedor[] = (bdDefaultData.proveedores || []) as unknown as Proveedor[];

export const INITIAL_CONTACTOS: Contacto[] = [
  ...INITIAL_CLIENTES.map(c => ({
    ...c,
    razonSocial: c.nombre || c.razonSocial,
    roles: ['cliente'] as RolContacto[],
    contactos: c.telefono || c.email ? [{
      id: `ct-${c.id}`,
      nombre: c.nombre || 'Contacto Principal',
      rol: 'Principal',
      telefono: c.telefono || '',
      email: c.email || '',
      esPrincipal: true
    }] : []
  })),
  ...INITIAL_PROVEEDORES.map(p => ({
    ...p,
    razonSocial: p.razonSocial || p.nombre || 'Proveedor',
    roles: ['proveedor'] as RolContacto[],
    tipoProveedor: p.tipoProveedor || 'material',
    contactos: p.contactos || []
  }))
];

export const BASE_CATEGORIES: string[] = appConfigData.categories;
export const BASE_TAREA_CATEGORIES: string[] = (appConfigData as any).categoriasTarea || ['Bocas', 'Circuitos', 'Tableros', 'Acometidas', 'Medición'];
export const BASE_UNITS: string[] = appConfigData.units;
export const CONDICIONES_IVA: string[] = appConfigData.condicionesIVA;
export const TIPOS_FACTURA: string[] = appConfigData.tiposFactura;
export const ESTADOS_PRESUPUESTO: string[] = appConfigData.estadosPresupuesto;
export const ESTADOS_REGISTRO_TRABAJO: string[] = appConfigData.estadosRegistroTrabajo;

export const CONDICIONES_TRABAJO: OptionConfig<'normal' | 'dificultosa' | 'favorable'>[] =
  appConfigData.condicionesTrabajo as OptionConfig<'normal' | 'dificultosa' | 'favorable'>[];

export const MOTIVOS_DESVIO: OptionConfig<string>[] =
  appConfigData.motivosDesvio as OptionConfig<string>[];

export const TIPOS_PROVEEDOR: OptionConfig<'material' | 'servicio' | 'ambos'>[] =
  appConfigData.tiposProveedor as OptionConfig<'material' | 'servicio' | 'ambos'>[];

export const TIPOS_COSTO_INDIRECTO: OptionConfig<'porcentual_sobre_costo' | 'por_visita' | 'fijo_mensual'>[] =
  appConfigData.tiposCostoIndirecto as OptionConfig<'porcentual_sobre_costo' | 'por_visita' | 'fijo_mensual'>[];

export const MEDIOS_PAGO: OptionConfig<'efectivo' | 'transferencia' | 'cheque' | 'otro'>[] =
  appConfigData.mediosPago as OptionConfig<'efectivo' | 'transferencia' | 'cheque' | 'otro'>[];

export const MODALIDADES_PAGO: OptionConfig<'pago_unico' | 'adelanto_saldo' | 'certificados_avance' | 'cuotas'>[] =
  appConfigData.modalidadesPago as OptionConfig<'pago_unico' | 'adelanto_saldo' | 'certificados_avance' | 'cuotas'>[];

export const TIPOS_AJUSTE_PRECIO: OptionConfig<string>[] =
  appConfigData.tiposAjustePrecio as OptionConfig<string>[];
