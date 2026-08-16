import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { useAppConfig } from './useAppConfig';
import {
  BASE_CATEGORIES,
  BASE_UNITS,
  CONDICIONES_IVA,
  TIPOS_FACTURA,
  ESTADOS_PRESUPUESTO,
  ESTADOS_REGISTRO_TRABAJO,
  CONDICIONES_TRABAJO,
  MOTIVOS_DESVIO,
  TIPOS_PROVEEDOR,
  TIPOS_COSTO_INDIRECTO,
  MEDIOS_PAGO,
  MODALIDADES_PAGO,
  TIPOS_AJUSTE_PRECIO,
  BASE_TAREA_CATEGORIES,
  OptionConfig
} from '../core/sampleData';
import { CategoriaMaterial } from '../core/types';

/**
 * Hook centralizado que provee todas las listas de selección, unidades, estados y categorías del cotizador.
 */
export function useAppOptions() {
  const { config, categoriasTarea } = useAppConfig();
  
  const rawCategoriasMaterial = useLiveQuery(() => db.categoriasMaterial.toArray()) || [];
  const categoriasMaterial: CategoriaMaterial[] = rawCategoriasMaterial.filter(c => !c.deleted);

  return {
    // Categorías
    categoriasTarea: categoriasTarea || BASE_TAREA_CATEGORIES,
    categoriasMaterial,
    categoriasMaterialBase: BASE_CATEGORIES,

    // Unidades & Formatos
    units: BASE_UNITS,
    tiposFactura: TIPOS_FACTURA,
    condicionesIVA: CONDICIONES_IVA,

    // Estados
    estadosPresupuesto: ESTADOS_PRESUPUESTO,
    estadosRegistroTrabajo: ESTADOS_REGISTRO_TRABAJO,

    // Opciones con multiplicador / label
    condicionesTrabajo: CONDICIONES_TRABAJO,
    motivosDesvio: MOTIVOS_DESVIO,
    tiposProveedor: TIPOS_PROVEEDOR,
    tiposCostoIndirecto: TIPOS_COSTO_INDIRECTO,
    mediosPago: MEDIOS_PAGO,
    modalidadesPago: MODALIDADES_PAGO,
    tiposAjustePrecio: TIPOS_AJUSTE_PRECIO,

    // Configuración activa
    config
  };
}
