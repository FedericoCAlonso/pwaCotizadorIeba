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
    id: 'tt-recableado-integral',
    nombre: 'Recableado Integral de Circuito / Bocas Existentes',
    categoria: 'Bocas',
    unidad: 'boca',
    notasTecnicas: 'Retiro de conductores obsoletos y reposición con conductores unipolares IRAM 247-3 (Fase, Neutro y PE 2.5 mm²). Empalmes y conexionado en cajas existentes.',
    clausulaExclusiones: 'La cotización contempla el reemplazo de conductores a través de las canalizaciones existentes en condiciones transitables. En caso de detectarse cañerías obstruidas, colapsadas o cajas ciegas no accesibles que demanden apertura de mampostería o colocación de conductos a la vista, los trabajos de destape o recanalización se cotizarán como adicionales previa conformidad del cliente.',
    variables: [
      {
        id: 'bocas',
        nombre: 'Cantidad de Bocas',
        tipo: 'numero',
        valorDefault: 10,
        unidad: 'bocas',
        descripcion: 'Número total de bocas y centros a recablear'
      },
      {
        id: 'k_estado',
        nombre: 'Estado y Antigüedad de Cañerías',
        tipo: 'select',
        valorDefault: 1.25,
        descripcion: 'Estado de transitabilidad de los conductos existentes',
        opciones: [
          { id: 'opt-moderna', label: 'Moderna / Buen Estado (1.00x)', valor: 1.0 },
          { id: 'opt-intermedia', label: 'Intermedia / Regular (1.25x)', valor: 1.25 },
          { id: 'opt-antigua', label: 'Antigua / Rígida / Deteriorada (1.60x)', valor: 1.6 }
        ]
      },
      {
        id: 'k_altura',
        nombre: 'Altura de Trabajo',
        tipo: 'select',
        valorDefault: 1.0,
        descripcion: 'Altura de cielorrasos o cajas',
        opciones: [
          { id: 'opt-alt-std', label: 'Estándar < 2.80 m (1.00x)', valor: 1.0 },
          { id: 'opt-alt-doble', label: 'Doble Altura 2.80m - 4.50m (1.25x)', valor: 1.25 },
          { id: 'opt-alt-gran', label: 'Gran Altura > 4.50m (1.50x)', valor: 1.5 }
        ]
      },
      {
        id: 'desarmes',
        nombre: 'Ventiladores / Apliques a Desarmar',
        tipo: 'numero',
        valorDefault: 0,
        unidad: 'artefactos',
        descripcion: 'Cantidad de artefactos especiales que requieren desmontaje y rearmado complejo'
      }
    ],
    insumos: [
      { materialId: 'mat-cable-uni-2_5-marron', cantidad: 12, formula: 'bocas * 12 * 1.10' },
      { materialId: 'mat-cable-uni-2_5-celeste', cantidad: 12, formula: 'bocas * 12 * 1.10' },
      { materialId: 'mat-cable-uni-2_5-verde-amarillo', cantidad: 12, formula: 'bocas * 12 * 1.10' }
    ],
    manoObra: [
      { categoriaId: 'mo-oficial-electricista', horas: 1.5, formula: '1.0 + (bocas * 1.5) * k_estado * k_altura + (desarmes * 1.5)' },
      { categoriaId: 'mo-ayudante', horas: 0.8, formula: '1.0 + (bocas * 0.8) * k_estado * k_altura' }
    ],
    frecuenciaUso: 10,
    createdAt: now,
    updatedAt: now,
    deleted: false
  },
  {
    id: 'tt-boca-iug-nueva',
    nombre: 'Boca de Iluminación de Uso General (IUG) - Obra Nueva',
    categoria: 'Bocas',
    unidad: 'boca',
    notasTecnicas: 'Canalización embutida, colocación de caja octogonal chica, cableado 1.5 mm² y conexión según norma AEA 90364.',
    variables: [
      {
        id: 'bocas',
        nombre: 'Cantidad de Bocas',
        tipo: 'numero',
        valorDefault: 1,
        unidad: 'bocas'
      }
    ],
    insumos: [
      { materialId: 'mat-caja-oct-chica-pvc', cantidad: 1, formula: 'bocas * 1' },
      { materialId: 'mat-cable-uni-1.5-marron', cantidad: 8, formula: 'bocas * 8' },
      { materialId: 'mat-cable-uni-1.5-celeste', cantidad: 8, formula: 'bocas * 8' },
      { materialId: 'mat-cable-uni-1.5-verde-amarillo', cantidad: 8, formula: 'bocas * 8' }
    ],
    manoObra: [
      { categoriaId: 'mo-oficial-electricista', horas: 1.2, formula: 'bocas * 1.2' },
      { categoriaId: 'mo-ayudante', horas: 0.8, formula: 'bocas * 0.8' }
    ],
    frecuenciaUso: 5,
    createdAt: now,
    updatedAt: now,
    deleted: false
  },
  {
    id: 'tt-tablero-seccional-monofasico',
    nombre: 'Armado y conexión de tablero seccional monofásico en vivienda',
    categoria: 'Tableros',
    unidad: 'tablero',
    notasTecnicas: 'Montaje de gabinete DIN embutido, provisión y conexionado de interruptor termomagnético general, interruptor diferencial coordinado según AEA 90364, peines bipolares de distribución y termomagnéticas bipolares de circuitos derivados. Rotulado normalizado y prueba de disparo diferencial.',
    clausulaExclusiones: 'La cotización comprende el armado, peinado y conexionado en el gabinete del tablero. No incluye rotura de mampostería si el nicho no estuviera amurado previamente, ni tendido de líneas seccionales principales o circuitos troncales hacia bocas.',
    variables: [
      {
        id: 'circuitos',
        nombre: 'Cantidad de Circuitos Derivados (IUG/TUG/TUE)',
        tipo: 'numero',
        valorDefault: 4,
        unidad: 'circuitos',
        descripcion: 'Número de circuitos monofásicos a proteger (ej: 1 ilum + 2 tomas + 1 aire)'
      },
      {
        id: 'calibre_principal',
        nombre: 'Térmica General de Cabecera',
        tipo: 'select',
        valorDefault: 32,
        descripcion: 'Selecciona la corriente nominal del interruptor termomagnético principal',
        opciones: [
          { id: '25', label: '25 A (Curva C)', valor: 25 },
          { id: '32', label: '32 A (Curva C)', valor: 32 },
          { id: '40', label: '40 A (Curva C)', valor: 40 },
          { id: '50', label: '50 A (Curva C)', valor: 50 },
          { id: '63', label: '63 A (Curva C)', valor: 63 }
        ]
      },
      {
        id: 'requiere_certificacion',
        nombre: '¿Incluye Medición de PAT y Protocolo SRT 900/15?',
        tipo: 'boolean',
        valorDefault: 0,
        descripcion: 'Medición con telurímetro calibrado y emisión de protocolo firmado'
      }
    ],
    insumos: [
      // Slot 1: Gabinete DIN modular según cantidad de circuitos
      {
        nombreSlot: 'Gabinete DIN Embutir',
        cantidad: 1,
        reglasDinamicas: [
          { condicion: 'circuitos <= 2', materialId: 'mat-tablero-din-8-emb', descripcion: 'Gabinete DIN 8 Módulos' },
          { condicion: 'circuitos > 2 && circuitos <= 4', materialId: 'mat-tablero-din-12-emb', descripcion: 'Gabinete DIN 12 Módulos' },
          { condicion: 'circuitos > 4 && circuitos <= 7', materialId: 'mat-tablero-din-18-emb', descripcion: 'Gabinete DIN 18 Módulos' },
          { condicion: 'circuitos > 7', materialId: 'mat-tablero-din-24-emb', descripcion: 'Gabinete DIN 24 Módulos' }
        ]
      },
      // Slot 2: Interruptor Termomagnético General de Cabecera
      {
        nombreSlot: 'Interruptor Termomagnético General',
        cantidad: 1,
        reglasDinamicas: [
          { condicion: 'calibre_principal == 25', materialId: 'mat-pia-2x25', descripcion: 'Térmica 2x25A' },
          { condicion: 'calibre_principal == 32', materialId: 'mat-pia-2x32', descripcion: 'Térmica 2x32A' },
          { condicion: 'calibre_principal == 40', materialId: 'mat-pia-2x40', descripcion: 'Térmica 2x40A' },
          { condicion: 'calibre_principal == 50', materialId: 'mat-pia-2x50', descripcion: 'Térmica 2x50A' },
          { condicion: 'calibre_principal == 63', materialId: 'mat-pia-2x63', descripcion: 'Térmica 2x63A' }
        ]
      },
      // Slot 3: Interruptor Diferencial Coordinado (según AEA 90364: In_ID >= In_TM)
      {
        nombreSlot: 'Interruptor Diferencial Coordinado',
        cantidad: 1,
        reglasDinamicas: [
          { condicion: 'calibre_principal <= 25', materialId: 'mat-dif-2x25-30ma', descripcion: 'Diferencial 2x25A 30mA' },
          { condicion: 'calibre_principal > 25 && calibre_principal <= 40', materialId: 'mat-dif-2x40-30ma', descripcion: 'Diferencial 2x40A 30mA' },
          { condicion: 'calibre_principal > 40', materialId: 'mat-dif-2x63-30ma', descripcion: 'Diferencial 2x63A 30mA' }
        ]
      },
      // Insumo 4: Térmicas Bipolares para Circuitos Derivados (Curva C 16A)
      {
        materialId: 'mat-pia-2x16',
        cantidad: 1,
        formula: 'circuitos'
      }
    ],
    manoObra: [
      { categoriaId: 'mo-oficial-electricista', horas: 2.5, formula: '2.5 + circuitos * 0.75' },
      { categoriaId: 'mo-ayudante', horas: 1.0, formula: '1.0 + circuitos * 0.35' },
      { categoriaId: 'mo-oficial-electricista', horas: 1.5, condicion: 'requiere_certificacion == 1' }
    ],
    frecuenciaUso: 10,
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
