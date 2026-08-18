/**
 * useInsumosMap.ts — Hook compartido para construir el mapa unificado de insumos/materiales.
 *
 * Centraliza la lógica que estaba duplicada en InsumosManager, PresupuestoEditor
 * y TareasTipoManager. Cada componente ahora importa este hook en vez de construir
 * su propia versión del insumosMap.
 */

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { Insumo } from '../core/types';
import { buildInsumosMap } from '../core/materialMatching';

/**
 * Hook que construye y devuelve un Map<string, Insumo> unificado, combinando:
 * - Insumos legacy (tabla 'insumos')
 * - Materiales normalizados (tabla 'materiales')
 * - Productos/marcas preferidos (tabla 'productos')
 * - Ofertas de precios vigentes (tabla 'ofertas')
 *
 * Se re-calcula automáticamente cuando cualquier tabla subyacente cambia (via useLiveQuery).
 *
 * @returns Map<id, Insumo> con precio vigente resuelto para cada material
 */
export function useInsumosMap(): Map<string, Insumo> {
  const legacyInsumos = (useLiveQuery(() => db.insumos.toArray()) || []).filter(i => !i.deleted);
  const materiales = (useLiveQuery(() => db.materiales.toArray()) || []).filter(m => !m.deleted);
  const productos = (useLiveQuery(() => db.productos.toArray()) || []).filter(p => !p.deleted);
  const ofertas = (useLiveQuery(() => db.ofertas.toArray()) || []).filter(o => !o.deleted);

  return useMemo(
    () => buildInsumosMap(legacyInsumos, materiales, productos, ofertas),
    [legacyInsumos, materiales, productos, ofertas]
  );
}
