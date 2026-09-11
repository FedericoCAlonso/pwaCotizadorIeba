import {
  CategoriaMaterial,
  Material,
  Producto,
  Oferta,
  Insumo,
  CategoriaManoDeObra,
  RolCategoriaManoDeObra,
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

export const INITIAL_MANO_OBRA: CategoriaManoDeObra[] = (bdDefaultData.manoObra as Partial<CategoriaManoDeObra>[] || []).map((mo) => {
  const nombreLower = (mo.nombre || '').toLowerCase();
  let rol: RolCategoriaManoDeObra = 'oficial';
  if (nombreLower.includes('ayudante') || nombreLower.includes('medio')) {
    rol = 'ayudante';
  } else if (nombreLower.includes('independiente') || nombreLower.includes('autonomo')) {
    rol = 'independiente';
  } else if (nombreLower.includes('ingeniero') || nombreLower.includes('especialista') || nombreLower.includes('protocolo')) {
    rol = 'especialista';
  }
  return {
    id: mo.id || `mo-${crypto.randomUUID()}`,
    nombre: mo.nombre || '',
    costoHora: mo.costoHora || 0,
    rol: mo.rol || rol,
    fechaActualizacion: now
  };
});

export const INITIAL_COSTOS_INDIRECTOS: CostoIndirecto[] = (bdDefaultData.costosIndirectos || []) as CostoIndirecto[];

export const DEFAULT_TAREAS_TIPO_SEEDS: TareaTipo[] = [
  {
    id: 'tt-cableado-vivienda-10kw',
    nombre: 'Cableado o recableado Vivienda hasta 10kW',
    categoria: 'Bocas',
    unidad: 'u',
    notasTecnicas: 'Modernización y recableado integral de instalación existente bajo norma reglamentaria AEA 90364-7-770/771. Contempla el retiro de conductores existentes deteriorados mediante tracción de cuadrilla en tándem, sondeo de cañerías existentes, enhebrado de nuevos conductores unipolares IRAM 247-3 con separación estricta de circuitos IUG (1.5 mm², 10A) y TUG (2.5 mm², 16A), conductor de protección PE (tierra) integral verde/amarillo en todas las bocas, empalmes escalonados con aislamiento de alta rigidez dieléctrica, conexión de bastidores y conexionado de tablero seccional.',
    clausulaExclusiones: 'La cotización contempla el reemplazo y pasaje de conductores a través de las canalizaciones existentes en condiciones mecánicamente transitables. En caso de detectarse cañerías colapsadas, aplastadas, con agua estancada o cajas ciegas no registrables ocultas por yesería/mampostería que impidan el paso de la cinta pasacable, los trabajos de apertura, destape o canalización auxiliar a la vista se cotizarán como adicionales previa conformidad del cliente. No incluye reparaciones de pintura ni albañilería mayor.',
    costoFijoOperativo: 0,
    descripcionCostoFijo: '',
    parametros: [
      { id: 'tug', nombre: 'Cantidad de bocas TUG', tipo: 'numero', valorDefault: 10, unidad: 'bocas', descripcion: 'Tomas de Uso General 10A (cable 2.5 mm²)' },
      { id: 'iug', nombre: 'Cantidad de bocas IUG', tipo: 'numero', valorDefault: 5, unidad: 'bocas', descripcion: 'Iluminación de Uso General (cable 1.5 mm²)' },
      { id: 'superficie', nombre: 'Superficie cubierta', tipo: 'numero', valorDefault: 50, unidad: 'm²', descripcion: 'Superficie de la vivienda en metros cuadrados para cálculo de tramos troncales' },
      { id: 'ambientes', nombre: 'Cantidad de ambientes / locales', tipo: 'numero', valorDefault: 3, unidad: 'ambientes', descripcion: 'Cantidad de locales habitables para cálculo de ramales principales' },
      { id: 'altura_techo', nombre: 'Altura promedio de cielorrasos', tipo: 'numero', valorDefault: 2.6, unidad: 'm', descripcion: 'Determina las bajadas verticales a tomas (h - 0.30m) y llaves (h - 1.10m)' },
      {
        id: 'estado_caneria',
        nombre: 'Estado / Complejidad de cañerías existentes',
        tipo: 'select',
        valorDefault: 1,
        unidad: 'coef',
        descripcion: 'Factor de dificultad por cañerías antiguas, curvas o saturación',
        opciones: [
          { id: 'opt-can-1', label: 'Normal / Buen estado (1.00x)', valor: 1 },
          { id: 'opt-can-2', label: 'Antigua / Hierro / Curvas (1.25x)', valor: 1.25 },
          { id: 'opt-can-3', label: 'Compleja / Semiobstruida (1.50x)', valor: 1.5 }
        ]
      },
      {
        id: 'cambio_modulos',
        nombre: 'Desarmado y rearmado de módulos / bastidores',
        tipo: 'select',
        valorDefault: 1,
        unidad: 'sn',
        descripcion: 'Desmontaje de bastidores y reconexión de tomas e interruptores',
        opciones: [
          { id: 'opt-mod-1', label: 'Sí (Desarmado y rearme completo)', valor: 1 },
          { id: 'opt-mod-0', label: 'No (Solo pasaje y empalmes)', valor: 0 }
        ]
      },
      { id: 'artefactos_pesados', nombre: 'Desarme de artefactos delicados o pesados', tipo: 'numero', valorDefault: 0, unidad: 'artefactos', descripcion: 'Arañas antiguas, ventiladores de techo o apliques pesados que demandan 2 operarios' },
      { id: 'tue', nombre: 'Cantidad de bocas TUE integradas', tipo: 'numero', valorDefault: 0, unidad: 'bocas', descripcion: 'Tomas de Uso Especial (4.0 mm²)' },
      { id: 'circuitos_tue', nombre: 'Cantidad de circuitos TUE', tipo: 'numero', valorDefault: 1, unidad: 'circuitos', descripcion: 'Circuitos exclusivos TUE (4.0 mm²)', condicion: 'tue > 0' },
      { id: 'esp', nombre: 'Cantidad de bocas especiales', tipo: 'numero', valorDefault: 0, unidad: 'bocas', descripcion: 'Otras bocas / circuitos especiales' },
      { id: 'circuitos_esp', nombre: 'Cantidad de circuitos especiales', tipo: 'numero', valorDefault: 0, unidad: 'circuitos', descripcion: 'Circuitos dedicados para cargas especiales', condicion: 'esp > 0' },
      {
        id: 'seccion_esp',
        nombre: 'Sección cables de circuitos especiales',
        tipo: 'select',
        valorDefault: 4,
        unidad: 'mm²',
        descripcion: 'Sección nominal para circuitos especiales',
        condicion: 'esp > 0',
        opciones: [
          { id: 'opt-1-5', label: '1.5 mm²', valor: 1.5 },
          { id: 'opt-2-5', label: '2.5 mm²', valor: 2.5 },
          { id: 'opt-4-0', label: '4.0 mm²', valor: 4.0 },
          { id: 'opt-6-0', label: '6.0 mm²', valor: 6.0 }
        ]
      }
    ],
    variables: [
      {
        id: 'bocas_totales',
        nombre: 'Total de bocas de la instalación',
        formula: 'iug + tug + tue + esp',
        unidad: 'bocas',
        descripcion: 'Suma de bocas a cablear'
      },
      {
        id: 'h_techo',
        nombre: 'Altura efectiva de techo',
        formula: 'altura_techo > 0 ? altura_techo : 2.6',
        unidad: 'm',
        descripcion: 'Altura de cielorraso para cálculo geométrico'
      },
      {
        id: 'bajada_toma',
        nombre: 'Bajada vertical a caja de tomas',
        formula: 'max(0.5, h_techo - 0.30)',
        unidad: 'm',
        descripcion: 'Distancia vertical desde caja de centro a 0.30m del suelo'
      },
      {
        id: 'bajada_llave',
        nombre: 'Bajada vertical a caja de llaves',
        formula: 'max(0.5, h_techo - 1.10)',
        unidad: 'm',
        descripcion: 'Distancia vertical desde caja de centro a 1.10m del suelo'
      },
      {
        id: 'distancia_troncal',
        nombre: 'Distancia troncal media',
        formula: 'ceil((ambientes > 0 ? ambientes : 3) * sqrt(superficie) * 0.75)',
        unidad: 'm',
        descripcion: 'Recorrido desde tablero a centros de ambientes'
      },
      {
        id: 'cable_2_5',
        nombre: 'Longitud conductores TUG (2.5 mm²)',
        formula: 'ceil((ceil(tug / 12) * distancia_troncal + tug * (2.8 + bajada_toma + 0.30)) * 1.10)',
        unidad: 'm',
        descripcion: 'Troncal + derivación + bajadas + chicotes (15cm) + 10% merma'
      },
      {
        id: 'cable_1_5',
        nombre: 'Longitud conductores IUG (1.5 mm²)',
        formula: 'ceil((ceil(iug / 8) * distancia_troncal + iug * (2.6 + bajada_llave + 0.30)) * 1.10)',
        unidad: 'm',
        descripcion: 'Troncal + derivación + bajadas + chicotes + 10% merma'
      },
      {
        id: 'cable_1_5_ret',
        nombre: 'Longitud retornos IUG (1.5 mm²)',
        formula: 'ceil(iug * (bajada_llave + 2.0) * 1.10)',
        unidad: 'm',
        descripcion: 'Retornos de llaves de efecto a centros de luz'
      },
      {
        id: 'cable_4_0',
        nombre: 'Longitud línea TUE (4.0 mm²)',
        formula: 'ceil((circuitos_tue * distancia_troncal + tue * (3.5 + bajada_toma + 0.30)) * 1.10)',
        unidad: 'm',
        descripcion: 'Línea de Tomas de Uso Especial 4.0 mm²'
      },
      {
        id: 'cable_esp',
        nombre: 'Longitud circuitos especiales / otros',
        formula: 'ceil((circuitos_esp * distancia_troncal + esp * (3.5 + bajada_toma + 0.30)) * 1.10)',
        unidad: 'm',
        descripcion: 'Líneas dedicadas para cargas especiales'
      },
      {
        id: 'horas_base_cuadrilla',
        nombre: 'Horas base Cuadrilla (Oficial + Ayudante en Obra)',
        formula: 'round(((bocas_totales * (0.35 + (cambio_modulos == 1 ? 0.15 : 0)) + 2.0) * estado_caneria) + artefactos_pesados * 1.25, 2)',
        unidad: 'hs',
        descripcion: 'Tiempo de enhebrado, tracción simultánea y conexión por cuadrilla indivisible'
      },
      {
        id: 'horas_cuadrilla',
        nombre: 'Horas Cuadrilla (con descansos reglamentarios)',
        formula: 'round(horas_base_cuadrilla + floor(horas_base_cuadrilla / 2) * 0.333, 2)',
        unidad: 'hs',
        descripcion: 'Jornada efectiva de la cuadrilla (20m descanso cada 2hs de tracción)'
      },
      {
        id: 'horas_oficial',
        nombre: 'Horas Oficial Electricista',
        formula: 'horas_cuadrilla',
        unidad: 'hs',
        descripcion: 'Horas de oficial trabajando en tándem de cuadrilla'
      },
      {
        id: 'horas_ayudante',
        nombre: 'Horas Ayudante',
        formula: 'horas_cuadrilla',
        unidad: 'hs',
        descripcion: 'Horas de ayudante trabajando en tándem de cuadrilla (mismo tiempo que oficial)'
      }
    ],
    insumos: [
      {
        materialId: 'mat-cable-uni-2_5-celeste',
        nombreSlot: 'Cable 2.5 mm² Celeste (Neutro)',
        condicion: 'tug > 0',
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
        materialId: 'mat-cable-uni-2_5-marron',
        nombreSlot: 'Cable 2.5 mm² Marrón (Fase)',
        condicion: 'tug > 0',
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
        materialId: 'mat-cable-uni-2_5-verde-amarillo',
        nombreSlot: 'Cable 2.5 mm² Verde/Amarillo (Tierra)',
        condicion: 'tug > 0',
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
        materialId: 'mat-cable-uni-1.5-blanco',
        nombreSlot: 'Cable 1.5 mm² Blanco (Retorno)',
        condicion: 'iug > 0',
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
        materialId: 'mat-cable-uni-1.5-marron',
        nombreSlot: 'Cable 1.5 mm² Marrón (Fase)',
        condicion: 'iug > 0',
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
        formula: 'cable_1_5'
      },
      {
        materialId: 'mat-cable-uni-1.5-verde-amarillo',
        nombreSlot: 'Cable 1.5 mm² Verde/Amarillo (Tierra)',
        condicion: 'iug > 0',
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
        formula: 'cable_1_5'
      },
      {
        materialId: 'mat-cable-uni-1.5-celeste',
        nombreSlot: 'Cable 1.5 mm² Celeste (Neutro)',
        condicion: 'iug > 0',
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
        materialId: 'mat-cable-uni-4-celeste',
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
        materialId: 'mat-cable-uni-4-marron',
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
        materialId: 'mat-cable-uni-4-verde-amarillo',
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
      { categoriaId: 'mo-ayudante', horas: 8.5, horasSetup: 1.0, horasRendimiento: 7.5, formula: 'horas_ayudante' },
      { categoriaId: 'mo-oficial-electricista', horas: 8.5, horasSetup: 1.0, horasRendimiento: 7.5, formula: 'horas_oficial' }
    ],
    horasSetupTotal: 1.5,
    cuadrillaRecomendada: { oficiales: 1, ayudantes: 1 },
    frecuenciaUso: 0,
    createdAt: now,
    updatedAt: now,
    deleted: false
  },
  {
    id: 'tt-alimentacion-carga-unica-acu',
    nombre: 'Alimentación Carga Única (ACU) - Split / Horno / Anafe',
    categoria: 'Circuitos',
    unidad: 'circuito',
    notasTecnicas: 'Instalación de línea de circuito exclusivo para Alimentación de Carga Única (ACU) según normativa AEA 90364-7-771. Comprende el tendido dedicado desde el tablero seccional hasta el punto de consumo (aire acondicionado Split frío/calor, horno eléctrico empotrable, anafe vitrocerámico/inducción o termotanque), colocación de interruptor termomagnético bipolar dedicado calibrado según corriente admisible del conductor, verificación de continuidad de puesta a tierra y conexionado en toma especial de 20A o bornera de conexión fija.',
    clausulaExclusiones: 'La cotización incluye el tendido y fijación de canalizaciones por el método seleccionado y la conexión en tablero existente con espacio disponible en riel DIN. Trabajos de albañilería pesada (picado profundo en vigas/columnas, revoque fino o pintura) quedan expresamente excluidos. En caso de requerirse ampliación o reemplazo del gabinete de tablero por falta de espacio, se presupuestará como adicional.',
    costoFijoOperativo: 0,
    descripcionCostoFijo: '',
    horasSetupTotal: 1.0,
    cuadrillaRecomendada: { oficiales: 1, ayudantes: 0 },
    parametros: [
      {
        id: 'distancia_tablero',
        nombre: 'Distancia lineal al tablero seccional',
        tipo: 'numero',
        valorDefault: 12,
        unidad: 'm',
        descripcion: 'Longitud estimada del recorrido de cañería o conducto hasta el equipo'
      },
      {
        id: 'tipo_carga',
        nombre: 'Tipo de equipo / Potencia estimada',
        tipo: 'select',
        valorDefault: 1,
        unidad: 'tipo',
        descripcion: 'Determina la sección de conductor y calibre de termomagnética',
        opciones: [
          { id: 'opt-carga-1', label: 'Aire Split hasta 3000 kcal / Lavavajillas (2.5 mm² - Térmica 16A)', valor: 1 },
          { id: 'opt-carga-2', label: 'Aire Split 4500 a 6000 kcal / Horno empotrado (4.0 mm² - Térmica 20A/25A)', valor: 2 },
          { id: 'opt-carga-3', label: 'Anafe inducción / Carga pesada hasta 7kW (6.0 mm² - Térmica 32A)', valor: 3 }
        ]
      },
      {
        id: 'tipo_canalizacion',
        nombre: 'Método de tendido / Canalización',
        tipo: 'select',
        valorDefault: 2,
        unidad: 'tipo',
        descripcion: 'Canalización a utilizar para el circuito dedicado',
        opciones: [
          { id: 'opt-can-existente', label: 'Por cañería existente libre (solo pasaje de cables)', valor: 1 },
          { id: 'opt-can-cablecanal', label: 'Cablecanal plástico a la vista con accesorios', valor: 2 },
          { id: 'opt-can-pvc-ext', label: 'Caño PVC rígido exterior a la vista con grapas', valor: 3 },
          { id: 'opt-can-embutido', label: 'Embutido nuevo en pared (canaleteado, caño y mezcla)', valor: 4 }
        ]
      },
      {
        id: 'requiere_termica',
        nombre: '¿Suministrar e instalar termomagnética en tablero?',
        tipo: 'select',
        valorDefault: 1,
        unidad: 'sn',
        descripcion: 'Incluye interruptor termomagnético bipolar curva C calibrado',
        opciones: [
          { id: 'opt-termica-si', label: 'Sí (Termomagnética bipolar calibrada en tablero)', valor: 1 },
          { id: 'opt-termica-no', label: 'No (Tablero ya cuenta con protección disponible)', valor: 0 }
        ]
      },
      {
        id: 'espacio_tablero',
        nombre: 'Disponibilidad de espacio en tablero',
        tipo: 'select',
        valorDefault: 1,
        unidad: 'sn',
        descripcion: 'Verificación de módulos DIN disponibles en el tablero seccional',
        opciones: [
          { id: 'opt-espacio-si', label: 'Suficiente (Riel DIN con polos libres)', valor: 1 },
          { id: 'opt-espacio-no', label: 'Agotado (Requiere cajita exterior DIN 2/4 bocas al lado)', valor: 0 }
        ]
      },
      {
        id: 'tipo_terminal',
        nombre: 'Terminación en el punto de consumo',
        tipo: 'select',
        valorDefault: 1,
        unidad: 'tipo',
        descripcion: 'Tipo de conexión final para el equipo',
        opciones: [
          { id: 'opt-term-toma', label: 'Tomacorriente 20A 2P+T IRAM 2071 con caja y tapa', valor: 1 },
          { id: 'opt-term-bornera', label: 'Conexión fija con bornera en caja de paso', valor: 2 }
        ]
      }
    ],
    variables: [
      {
        id: 'seccion_cable',
        nombre: 'Sección calculada del conductor',
        formula: 'tipo_carga == 3 ? 6.0 : (tipo_carga == 2 ? 4.0 : 2.5)',
        unidad: 'mm²',
        descripcion: 'Sección del conductor de fase, neutro y tierra según potencia'
      },
      {
        id: 'amperaje_termica',
        nombre: 'Calibre interruptor termomagnético',
        formula: 'tipo_carga == 3 ? 32 : (tipo_carga == 2 ? 20 : 16)',
        unidad: 'A',
        descripcion: 'Corriente nominal de protección según corriente admisible'
      },
      {
        id: 'metros_cable_conductor',
        nombre: 'Metros de cable por conductor',
        formula: 'ceil(distancia_tablero * 1.08 + 1.80)',
        unidad: 'm',
        descripcion: 'Recorrido + chicotes de conexión en tablero y equipo + 8% merma'
      },
      {
        id: 'metros_canalizacion',
        nombre: 'Metros lineales de canalización',
        formula: 'ceil(distancia_tablero)',
        unidad: 'm',
        descripcion: 'Metros de conducto a fijar o tender'
      },
      {
        id: 'k_canalizacion',
        nombre: 'Factor de dificultad por canalización',
        formula: 'tipo_canalizacion == 4 ? 2.8 : (tipo_canalizacion == 3 ? 1.6 : (tipo_canalizacion == 2 ? 1.3 : 1.0))',
        unidad: 'coef',
        descripcion: 'Multiplicador de tiempo de mano de obra según tipo de tendido'
      },
      {
        id: 'horas_base',
        nombre: 'Horas base de instalación',
        formula: 'round(1.5 + (distancia_tablero * 0.18 * k_canalizacion) + (requiere_termica == 1 ? 0.6 : 0) + (espacio_tablero == 0 ? 0.75 : 0) + 0.4, 2)',
        unidad: 'hs',
        descripcion: 'Tiempo de ejecución total del circuito ACU'
      },
      {
        id: 'horas_oficial',
        nombre: 'Horas Oficial Electricista',
        formula: 'horas_base',
        unidad: 'hs',
        descripcion: 'Tiempo de oficial para tendido, peinado y conexionado'
      },
      {
        id: 'horas_ayudante',
        nombre: 'Horas Ayudante',
        formula: 'tipo_canalizacion == 4 ? round(horas_base * 0.85, 2) : 0',
        unidad: 'hs',
        descripcion: 'Ayudante requerido para canaleteado y amurado si es embutido'
      }
    ],
    insumos: [
      {
        materialId: 'mat-cable-uni-2_5-celeste',
        nombreSlot: 'Cable 2.5 mm² Celeste (Neutro ACU)',
        condicion: 'seccion_cable == 2.5',
        cantidad: 15,
        formula: 'metros_cable_conductor'
      },
      {
        materialId: 'mat-cable-uni-2_5-marron',
        nombreSlot: 'Cable 2.5 mm² Marrón (Fase ACU)',
        condicion: 'seccion_cable == 2.5',
        cantidad: 15,
        formula: 'metros_cable_conductor'
      },
      {
        materialId: 'mat-cable-uni-2_5-verde-amarillo',
        nombreSlot: 'Cable 2.5 mm² Verde/Amarillo (Tierra ACU)',
        condicion: 'seccion_cable == 2.5',
        cantidad: 15,
        formula: 'metros_cable_conductor'
      },
      {
        materialId: 'mat-cable-uni-4-celeste',
        nombreSlot: 'Cable 4.0 mm² Celeste (Neutro ACU)',
        condicion: 'seccion_cable == 4',
        cantidad: 0,
        formula: 'metros_cable_conductor'
      },
      {
        materialId: 'mat-cable-uni-4-marron',
        nombreSlot: 'Cable 4.0 mm² Marrón (Fase ACU)',
        condicion: 'seccion_cable == 4',
        cantidad: 0,
        formula: 'metros_cable_conductor'
      },
      {
        materialId: 'mat-cable-uni-4-verde-amarillo',
        nombreSlot: 'Cable 4.0 mm² Verde/Amarillo (Tierra ACU)',
        condicion: 'seccion_cable == 4',
        cantidad: 0,
        formula: 'metros_cable_conductor'
      },
      {
        materialId: 'mat-cable-uni-6-celeste',
        nombreSlot: 'Cable 6.0 mm² Celeste (Neutro ACU)',
        condicion: 'seccion_cable == 6',
        cantidad: 0,
        formula: 'metros_cable_conductor'
      },
      {
        materialId: 'mat-cable-uni-6-marron',
        nombreSlot: 'Cable 6.0 mm² Marrón (Fase ACU)',
        condicion: 'seccion_cable == 6',
        cantidad: 0,
        formula: 'metros_cable_conductor'
      },
      {
        materialId: 'mat-cable-uni-6-verde-amarillo',
        nombreSlot: 'Cable 6.0 mm² Verde/Amarillo (Tierra ACU)',
        condicion: 'seccion_cable == 6',
        cantidad: 0,
        formula: 'metros_cable_conductor'
      },
      {
        materialId: 'mat-pia-2x16',
        nombreSlot: 'Interruptor Termomagnético 2P 16A Curva C',
        condicion: 'requiere_termica == 1 && amperaje_termica == 16',
        cantidad: 1
      },
      {
        materialId: 'mat-pia-2x20',
        nombreSlot: 'Interruptor Termomagnético 2P 20A Curva C',
        condicion: 'requiere_termica == 1 && amperaje_termica == 20',
        cantidad: 1
      },
      {
        materialId: 'mat-pia-2x32',
        nombreSlot: 'Interruptor Termomagnético 2P 32A Curva C',
        condicion: 'requiere_termica == 1 && amperaje_termica == 32',
        cantidad: 1
      },
      {
        materialId: 'mat-cano-pvc-20',
        nombreSlot: 'Caño PVC Rígido 20 mm Gris (Tira 3m)',
        condicion: 'tipo_canalizacion == 3',
        cantidad: 4,
        formula: 'ceil(metros_canalizacion / 3)'
      },
      {
        materialId: 'mat-mod-toma-20a-cargas',
        nombreSlot: 'Módulo Tomacorriente 2P+T 20A 250V IRAM 2071',
        condicion: 'tipo_terminal == 1',
        cantidad: 1
      }
    ],
    manoObra: [
      {
        categoriaId: 'mo-oficial-electricista',
        horas: 4.5,
        horasSetup: 1.0,
        horasRendimiento: 3.5,
        formula: 'horas_oficial'
      },
      {
        categoriaId: 'mo-ayudante',
        horas: 0,
        formula: 'horas_ayudante',
        condicion: 'tipo_canalizacion == 4'
      }
    ],
    frecuenciaUso: 0,
    createdAt: now,
    updatedAt: now,
    deleted: false
  },
  {
    id: 'tt-circuito-tue-dedicado',
    nombre: 'Circuito Tomas de Uso Especial (TUE) hasta 12 bocas',
    categoria: 'Circuitos',
    unidad: 'circuito',
    notasTecnicas: 'Instalación o adecuación reglamentaria de circuito exclusivo para Tomacorrientes de Uso Especial (TUE) bajo norma AEA 90364-7-771. Línea monofásica protegida con interruptor termomagnético de hasta 20A, conductores de sección nominal 2.5 mm² o 4.0 mm² y tomacorrientes de 20A (máximo 12 bocas por circuito). Especialmente indicado para electrodomésticos de alto consumo en cocinas, lavaderos, microondas, hornos eléctricos, lavavajillas, estufas o talleres.',
    clausulaExclusiones: 'No incluye rotura ni colocación de revestimientos cerámicos o azulejos existentes salvo presupuesto adicional explícito. La capacidad máxima admisible del circuito no debe superar los 20A (4400W en 220V). Las bocas a conectar deben poseer cajas de paso transitables y vinculadas.',
    costoFijoOperativo: 0,
    descripcionCostoFijo: '',
    horasSetupTotal: 1.0,
    cuadrillaRecomendada: { oficiales: 1, ayudantes: 1 },
    parametros: [
      {
        id: 'cantidad_bocas',
        nombre: 'Cantidad de bocas TUE (Tomas de 20A)',
        tipo: 'numero',
        valorDefault: 4,
        unidad: 'bocas',
        descripcion: 'Cantidad de tomacorrientes de uso especial a alimentar (máximo 12 según norma AEA)'
      },
      {
        id: 'distancia_al_tablero',
        nombre: 'Distancia lineal del tablero a la 1ra boca',
        tipo: 'numero',
        valorDefault: 10,
        unidad: 'm',
        descripcion: 'Longitud estimada del tramo troncal desde el tablero seccional'
      },
      {
        id: 'distancia_entre_bocas',
        nombre: 'Distancia promedio entre bocas sucesivas',
        tipo: 'numero',
        valorDefault: 3.5,
        unidad: 'm',
        descripcion: 'Distancia del ramal perimetral entre cajas sucesivas'
      },
      {
        id: 'seccion_conductor',
        nombre: 'Sección nominal de conductores',
        tipo: 'select',
        valorDefault: 4,
        unidad: 'mm²',
        descripcion: 'Sección según corriente admisible y distancia',
        opciones: [
          { id: 'opt-sec-25', label: '2.5 mm² (Admisible hasta 16A/20A en tramos cortos <= 15m)', valor: 2.5 },
          { id: 'opt-sec-40', label: '4.0 mm² (Recomendado AEA para 20A continuo y tramos medios/largos)', valor: 4.0 }
        ]
      },
      {
        id: 'tipo_canalizacion',
        nombre: 'Método de canalización / tendido',
        tipo: 'select',
        valorDefault: 1,
        unidad: 'tipo',
        descripcion: 'Tipo de canalización por donde correrá el circuito TUE',
        opciones: [
          { id: 'opt-can-existente', label: 'Por cañería existente libre / recableado', valor: 1 },
          { id: 'opt-can-cablecanal', label: 'Cablecanal plástico a la vista con accesorios', valor: 2 },
          { id: 'opt-can-pvc-ext', label: 'Caño PVC rígido exterior con grapas y curvas', valor: 3 },
          { id: 'opt-can-embutido', label: 'Embutido nuevo en mampostería (canaleteado y amurado)', valor: 4 }
        ]
      },
      {
        id: 'requiere_termica',
        nombre: '¿Suministrar e instalar termomagnética en tablero?',
        tipo: 'select',
        valorDefault: 1,
        unidad: 'sn',
        descripcion: 'Incluye interruptor termomagnético bipolar 2P 20A curva C en tablero',
        opciones: [
          { id: 'opt-term-si', label: 'Sí (Termomagnética bipolar 20A en tablero)', valor: 1 },
          { id: 'opt-term-no', label: 'No (Tablero ya cuenta con circuito disponible)', valor: 0 }
        ]
      },
      {
        id: 'suministro_tomas_20a',
        nombre: '¿Suministrar módulos tomacorriente 20A?',
        tipo: 'select',
        valorDefault: 1,
        unidad: 'sn',
        descripcion: 'Suministro de módulos de tomacorriente 20A IRAM 2071',
        opciones: [
          { id: 'opt-mod-si', label: 'Sí (Incluye módulos tomacorriente 20A IRAM 2071)', valor: 1 },
          { id: 'opt-mod-no', label: 'No (Solo conexionado / provistos por el cliente)', valor: 0 }
        ]
      }
    ],
    variables: [
      {
        id: 'longitud_recorrido',
        nombre: 'Longitud total de canalización',
        formula: 'ceil(distancia_al_tablero + (cantidad_bocas - 1) * distancia_entre_bocas)',
        unidad: 'm',
        descripcion: 'Tramo troncal + distribución perimetral entre bocas'
      },
      {
        id: 'cable_conductor_ml',
        nombre: 'Metros de cable por conductor',
        formula: 'ceil((longitud_recorrido + cantidad_bocas * 0.40) * 1.10)',
        unidad: 'm',
        descripcion: 'Metros de cable (fase, neutro, tierra) incluyendo colas y desperdicio'
      },
      {
        id: 'k_canal',
        nombre: 'Factor de dificultad por canalización',
        formula: 'tipo_canalizacion == 4 ? 2.5 : (tipo_canalizacion == 3 ? 1.5 : (tipo_canalizacion == 2 ? 1.25 : 1.0))',
        unidad: 'coef',
        descripcion: 'Multiplicador de mano de obra según tipo de canalización'
      },
      {
        id: 'horas_base_cuadrilla',
        nombre: 'Horas base cuadrilla (Oficial + Ayudante)',
        formula: 'round(1.0 + (longitud_recorrido * 0.12 * k_canal) + cantidad_bocas * 0.35 + (requiere_termica == 1 ? 0.6 : 0), 2)',
        unidad: 'hs',
        descripcion: 'Tiempo de ejecución total de la cuadrilla para el circuito TUE'
      },
      {
        id: 'horas_oficial',
        nombre: 'Horas Oficial Electricista',
        formula: 'horas_base_cuadrilla',
        unidad: 'hs',
        descripcion: 'Tiempo de oficial'
      },
      {
        id: 'horas_ayudante',
        nombre: 'Horas Ayudante',
        formula: 'horas_base_cuadrilla',
        unidad: 'hs',
        descripcion: 'Tiempo de ayudante en cuadrilla'
      }
    ],
    insumos: [
      {
        materialId: 'mat-cable-uni-4-celeste',
        nombreSlot: 'Cable 4.0 mm² Celeste (Neutro TUE)',
        condicion: 'seccion_conductor == 4',
        cantidad: 25,
        formula: 'cable_conductor_ml'
      },
      {
        materialId: 'mat-cable-uni-4-marron',
        nombreSlot: 'Cable 4.0 mm² Marrón (Fase TUE)',
        condicion: 'seccion_conductor == 4',
        cantidad: 25,
        formula: 'cable_conductor_ml'
      },
      {
        materialId: 'mat-cable-uni-4-verde-amarillo',
        nombreSlot: 'Cable 4.0 mm² Verde/Amarillo (Tierra TUE)',
        condicion: 'seccion_conductor == 4',
        cantidad: 25,
        formula: 'cable_conductor_ml'
      },
      {
        materialId: 'mat-cable-uni-2_5-celeste',
        nombreSlot: 'Cable 2.5 mm² Celeste (Neutro TUE)',
        condicion: 'seccion_conductor == 2.5',
        cantidad: 0,
        formula: 'cable_conductor_ml'
      },
      {
        materialId: 'mat-cable-uni-2_5-marron',
        nombreSlot: 'Cable 2.5 mm² Marrón (Fase TUE)',
        condicion: 'seccion_conductor == 2.5',
        cantidad: 0,
        formula: 'cable_conductor_ml'
      },
      {
        materialId: 'mat-cable-uni-2_5-verde-amarillo',
        nombreSlot: 'Cable 2.5 mm² Verde/Amarillo (Tierra TUE)',
        condicion: 'seccion_conductor == 2.5',
        cantidad: 0,
        formula: 'cable_conductor_ml'
      },
      {
        materialId: 'mat-pia-2x20',
        nombreSlot: 'Interruptor Termomagnético 2P 20A Curva C',
        condicion: 'requiere_termica == 1',
        cantidad: 1
      },
      {
        materialId: 'mat-mod-toma-20a-cargas',
        nombreSlot: 'Módulo Tomacorriente 2P+T 20A 250V IRAM 2071',
        condicion: 'suministro_tomas_20a == 1',
        cantidad: 4,
        formula: 'cantidad_bocas'
      },
      {
        materialId: 'mat-cano-pvc-20',
        nombreSlot: 'Caño PVC Rígido 20 mm Gris (Tira 3m)',
        condicion: 'tipo_canalizacion == 3',
        cantidad: 7,
        formula: 'ceil(longitud_recorrido / 3)'
      }
    ],
    manoObra: [
      {
        categoriaId: 'mo-oficial-electricista',
        horas: 5.5,
        horasSetup: 1.0,
        horasRendimiento: 4.5,
        formula: 'horas_oficial'
      },
      {
        categoriaId: 'mo-ayudante',
        horas: 5.5,
        horasSetup: 1.0,
        horasRendimiento: 4.5,
        formula: 'horas_ayudante'
      }
    ],
    frecuenciaUso: 0,
    createdAt: now,
    updatedAt: now,
    deleted: false
  },
  {
    id: 'tarea-fa255d31-2fa7-4c47-a67b-cba46f387140',
    nombre: 'Protocolo SRT 900/15 viviendas, consorcios, comercios pequeños y medianos',
    categoria: 'Medición / Protocolos',
    unidad: 'servicio',
    naturaleza: 'servicio_profesional',
    honorarioBase: 0,
    formulaHonorarios: 'stot_jabalina + stot_bocas + stot_diferenciales + stot_unifilares + stot_relevamiento',
    costoServicioDirecto: 0,
    notasTecnicas: 'Relevamiento, verificación de continuidad de masas, ensayo de tiempo de disparo de interruptores diferenciales y medición de resistencia de puesta a tierra bajo norma IRAM 2281 / Res. SRT 900/15 con instrumental digital contrastado.',
    clausulaTecnicaDefault: 'El servicio incluye la emisión de informe técnico con croquis e instrumental utilizado. No incluye reparaciones ni reemplazo de elementos no conformes.',
    clausulaExclusiones: 'El servicio contempla la medición e informe en condiciones normales de acceso. No incluye obras de adecuación ni canalizaciones adicionales.',
    costoFijoOperativo: 0,
    descripcionCostoFijo: '',
    parametros: [
      {
        id: 'bocas',
        nombre: 'Cantidad de Bocas',
        tipo: 'numero',
        valorDefault: 10,
        unidad: 'bocas',
        descripcion: 'Cantidad de bocas/tomas a verificar continuidad de masas'
      },
      {
        id: 'jabalinas',
        nombre: 'Cantidad de jabalinas',
        tipo: 'numero',
        valorDefault: 1,
        unidad: 'jabalinas',
        descripcion: 'Electrodos de puesta a tierra a medir'
      },
      {
        id: 'int_diferenciales',
        nombre: 'Cantidad de interruptores diferenciales',
        tipo: 'numero',
        valorDefault: 1,
        unidad: 'diferenciales',
        descripcion: 'Dispositivos diferenciales (RCD) a ensayar con rampa de disparo'
      },
      {
        id: 'requiere_unifilar',
        nombre: '¿Requiere confección de plano unifilar?',
        tipo: 'boolean',
        valorDefault: 0,
        unidad: 'Sí/No',
        descripcion: 'Habilita el dibujo y diseño del esquema unifilar de tableros',
        opciones: [
          { id: 'opt-1', label: 'Estándar (1.00x)', valor: 1 },
          { id: 'opt-2', label: 'Complejo (1.25x)', valor: 1.25 }
        ]
      },
      {
        id: 'cnt_unifialres',
        nombre: 'Cantidad de planos unifilares',
        tipo: 'numero',
        valorDefault: 1,
        unidad: 'planos',
        descripcion: 'Cantidad de esquemas unifilares a dibujar',
        condicion: 'requiere_unifilar == 1'
      },
      {
        id: 'circuitos',
        nombre: 'Cantidad total de circuitos de los tableros a relevar',
        tipo: 'numero',
        valorDefault: 5,
        unidad: 'circuitos',
        descripcion: 'Circuitos totales en los tableros a relevar',
        condicion: 'requiere_unifilar == 1'
      },
      {
        id: 'requiere_croquis',
        nombre: '¿Requiere relevamiento y croquis de la instalación?',
        tipo: 'boolean',
        valorDefault: 0,
        unidad: 'Sí/No',
        descripcion: 'Habilita el relevamiento de locales y bocas para croquis',
        opciones: [
          { id: 'opt-1', label: 'Estándar (1.00x)', valor: 1 },
          { id: 'opt-2', label: 'Complejo (1.25x)', valor: 1.25 }
        ]
      },
      {
        id: 'cnt_locales',
        nombre: 'Cantidad de locales a relevar',
        tipo: 'numero',
        valorDefault: 1,
        unidad: 'locales',
        descripcion: 'Ambientes / locales comerciales a relevar',
        condicion: 'requiere_croquis == 1'
      },
      {
        id: 'bocas_locales',
        nombre: 'Cantidad total de bocas en los locales a relevar',
        tipo: 'numero',
        valorDefault: 10,
        unidad: 'bocas',
        descripcion: 'Bocas totales a ubicar en el croquis',
        condicion: 'requiere_croquis == 1'
      },
      {
        id: 'encomienda',
        nombre: 'Valor de la encomienda ($)',
        tipo: 'numero',
        valorDefault: 30000,
        unidad: '$',
        descripcion: 'Arancel base (ingresa 0 para vincular automáticamente con la tarifa de Mano de Obra y Costos)'
      }
    ],
    variables: [
      {
        id: 'valor_encomienda',
        nombre: 'Valor base de la encomienda',
        formula: 'encomienda > 0 ? encomienda : 2 * tarifa_profesional',
        unidad: '$',
        descripcion: 'Valor de encomienda calculado o ingresado'
      },
      {
        id: 'stot_jabalina',
        nombre: 'Subtotal por medición de jabalinas',
        formula: '(1 + (jabalinas > 1 ? (jabalinas - 1) * 0.3 : 0)) * valor_encomienda',
        unidad: '$',
        descripcion: 'Base por 1ra jabalina + adicional por jabalinas extras'
      },
      {
        id: 'stot_bocas',
        nombre: 'Subtotal por verificación de bocas',
        formula: '(bocas / 5 + 1) * valor_encomienda',
        unidad: '$',
        descripcion: 'Inspección de continuidad según cantidad de bocas'
      },
      {
        id: 'stot_diferenciales',
        nombre: 'Subtotal por medición de interruptores diferenciales',
        formula: '(int_diferenciales < 5 ? 2 : 1/4) * valor_encomienda',
        unidad: '$',
        descripcion: 'Base por los primeros 5 ID + adicional por cada 4 ID extra'
      },
      {
        id: 'stot_unifilares',
        nombre: 'Subtotal por esquemas unifilares',
        formula: '(cnt_unifialres + circuitos / 4) * valor_encomienda * requiere_unifilar',
        unidad: '$',
        descripcion: 'Diseño de unifilares y circuitos'
      },
      {
        id: 'stot_relevamiento',
        nombre: 'Subtotal por relevamiento y croquis',
        formula: '(1 * cnt_locales + bocas_locales / 5) * valor_encomienda * requiere_croquis',
        unidad: '$',
        descripcion: 'Relevamiento en sitio de locales y bocas'
      }
    ],
    esParametrico: true,
    tipoParametrizacion: 'recableado_integral',
    insumos: [],
    manoObra: [
      {
        categoriaId: 'mo-ayudante',
        horas: 2.75,
        formula: '(jabalinas + bocas) / 4'
      }
    ],
    horasSetupTotal: 1,
    cuadrillaRecomendada: {
      oficiales: 1,
      ayudantes: 1
    },
    frecuenciaUso: 0,
    createdAt: '2026-08-25T15:45:56.632Z',
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
