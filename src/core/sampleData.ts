import {
  Insumo,
  CategoriaManoDeObra,
  CostoIndirecto,
  TareaTipo,
  Cliente,
  Proveedor,
  AppConfig
} from './types';
import appConfigData from '../config/appConfig.json';

const now = new Date().toISOString();

export const DEFAULT_APP_CONFIG: AppConfig = appConfigData.defaultAppConfig as AppConfig;

export const INITIAL_INSUMOS: Insumo[] = (appConfigData.initialInsumos as Partial<Insumo>[]).map((ins) => ({
  id: ins.id || `ins-${crypto.randomUUID()}`,
  nombre: ins.nombre || '',
  unidad: ins.unidad || 'u',
  categoria: ins.categoria || 'general',
  proveedorPreferido: ins.proveedorPreferido,
  precioActual: ins.precioActual || 0,
  fechaActualizacion: now,
  historialPrecios: [{ fecha: now, precio: ins.precioActual || 0, fuente: 'Carga Semilla Inicial' }]
}));

export const INITIAL_MANO_OBRA: CategoriaManoDeObra[] = (appConfigData.initialManoObra as Partial<CategoriaManoDeObra>[]).map((mo) => ({
  id: mo.id || `mo-${crypto.randomUUID()}`,
  nombre: mo.nombre || '',
  costoHora: mo.costoHora || 0,
  fechaActualizacion: now
}));

export const INITIAL_COSTOS_INDIRECTOS: CostoIndirecto[] = appConfigData.initialCostosIndirectos as CostoIndirecto[];

export const INITIAL_TAREAS_TIPO: TareaTipo[] = appConfigData.initialTareasTipo as TareaTipo[];

export const INITIAL_CLIENTES: Cliente[] = appConfigData.initialClientes as Cliente[];

export const INITIAL_PROVEEDORES: Proveedor[] = appConfigData.initialProveedores as Proveedor[];

export const BASE_CATEGORIES: string[] = appConfigData.categories;
export const BASE_UNITS: string[] = appConfigData.units;
export const CONDICIONES_IVA: string[] = appConfigData.condicionesIVA;
export const TIPOS_FACTURA: string[] = appConfigData.tiposFactura;
export const ESTADOS_PRESUPUESTO: string[] = appConfigData.estadosPresupuesto;
export const ESTADOS_REGISTRO_TRABAJO: string[] = appConfigData.estadosRegistroTrabajo;
