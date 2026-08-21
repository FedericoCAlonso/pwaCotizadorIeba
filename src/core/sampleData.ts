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
      { categoriaId: 'mo-ayudante', horas: 6.5, formula: 'horas_ayudante' },
      { categoriaId: 'mo-oficial-electricista', horas: 8.5, formula: 'horas_oficial' }
    ],
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
