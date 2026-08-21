/**
 * materialMatching.ts — Lógica pura de matching, filtrado y resolución de precios de materiales.
 *
 * Funciones extraídas de InsumosManager.tsx para permitir testing unitario y reutilización
 * en múltiples componentes (InsumosManager, PresupuestoEditor, TareasTipoManager).
 *
 * TODAS las funciones de este módulo son puras (sin side-effects ni dependencias de React).
 */

import { Material, Producto, Oferta, Insumo, MaterialFilterContext } from './types';

// ─── Normalización de texto ─────────────────────────────────────────────────────

/**
 * Normaliza cadenas de texto eliminando tildes, mayúsculas y caracteres especiales
 * para comparaciones fonéticas y de palabras clave.
 *
 * @example normalizeStr("Caño Rígido MPC Ø3/4") → "cano rigido mpc o3 4"
 */
export function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Variantes de ID ────────────────────────────────────────────────────────────

/**
 * Genera las variantes alternativas de un ID de material/insumo para cubrir
 * la coexistencia de prefijos 'mat-' (materiales nuevos) e 'ins-' (insumos legacy).
 *
 * @example expandIdVariants("mat-cable-123") → ["mat-cable-123", "ins-cable-123"]
 * @example expandIdVariants("ins-cable-456") → ["ins-cable-456", "mat-cable-456"]
 * @example expandIdVariants("custom-789")    → ["custom-789"]
 */
export function expandIdVariants(id: string): string[] {
  const lower = id.toLowerCase().trim();
  const variants = [lower];
  if (lower.startsWith('mat-')) {
    variants.push('ins-' + lower.slice(4));
  } else if (lower.startsWith('ins-')) {
    variants.push('mat-' + lower.slice(4));
  }
  return variants;
}

// ─── Matching contextual de materiales ──────────────────────────────────────────

/**
 * Determina si un material del catálogo coincide con los requerimientos de la obra o tarea activa.
 * Utiliza una estrategia escalonada de 3 niveles:
 * 1. Coincidencia exacta por ID de Material o prefijo alternativo ('mat-' / 'ins-')
 * 2. Coincidencia por producto comercial vinculado (Marca / Modelo)
 * 3. Coincidencia por tokens y similitud fonética en el nombre (resguardo para partidas sin ID directo)
 *
 * @param mat      Material del catálogo a evaluar
 * @param ctx      Contexto de filtro proveniente de una cotización o tarea tipo
 * @param productos Array completo de productos para evaluar vinculación marca/modelo
 * @returns true si el material debería mostrarse en la vista filtrada
 */
export function matchesMaterialContext(
  mat: Material,
  ctx: MaterialFilterContext,
  productos: Producto[]
): boolean {
  const rawTargetIds = (ctx.materialIds || []).map(id => id.toLowerCase().trim()).filter(Boolean);
  const enrichedTargetIds = new Set(rawTargetIds.flatMap(id => expandIdVariants(id)));

  // 1. Coincidencia por ID directo o alternativo (con variantes bidireccionales)
  if (enrichedTargetIds.size > 0) {
    const matVariants = expandIdVariants(mat.id);
    for (const variant of matVariants) {
      if (enrichedTargetIds.has(variant)) return true;
    }

    // 2. Coincidencia por Producto comercial asociado
    const hasProdMatch = productos.some(
      p => p.materialId === mat.id && (enrichedTargetIds.has(p.id.toLowerCase()) || enrichedTargetIds.has(p.id))
    );
    if (hasProdMatch) return true;

    // Si la cotización/tarea contiene IDs explícitos, excluimos cualquier material ajeno a los IDs
    return false;
  }

  // 3. Coincidencia flexible por Palabras Clave y Nombres (SOLO cuando no existen IDs definidos)
  const targetNames = (ctx.materialNames || [])
    .map(n => normalizeStr(n))
    .filter(n => n.length >= 2);
  if (targetNames.length === 0) return false;

  const normMatName = normalizeStr(mat.nombre);
  const matTokens = normMatName.split(' ').filter(w => w.length >= 2);

  for (const tName of targetNames) {
    if (tName === 'insumo no encontrado') continue;

    // Coincidencia por substring
    if (normMatName.includes(tName) || tName.includes(normMatName)) {
      return true;
    }

    // Coincidencia por tokens compartidos
    const tTokens = tName.split(' ').filter(w => w.length >= 2);
    if (tTokens.length > 0) {
      const commonTokens = tTokens.filter(tok => matTokens.includes(tok));
      if (commonTokens.length >= 2 || (tTokens.length === 1 && commonTokens.length === 1)) {
        return true;
      }
    }
  }

  return false;
}

// ─── Resolución de cantidades de obra ───────────────────────────────────────────

/**
 * Obtiene la cantidad de cómputo métrico asignada a este material en la cotización o tarea activa.
 * Intenta variantes de prefijo 'mat-'/'ins-' para cubrir IDs legacy.
 *
 * @returns { cantidad, unidad } o undefined si el material no tiene cantidad asignada
 */
export function getObraQuantity(
  matId: string,
  quantities?: Record<string, { cantidad: number; unidad: string }>
): { cantidad: number; unidad: string } | undefined {
  if (!quantities) return undefined;

  // Búsqueda directa
  if (quantities[matId]) return quantities[matId];

  // Variantes alternativas
  const variants = expandIdVariants(matId);
  for (const variant of variants) {
    if (quantities[variant]) return quantities[variant];
  }

  return undefined;
}

// ─── Resolución de ofertas/precios vigentes ─────────────────────────────────────

/**
 * Resuelve la oferta vigente (precio más reciente) para un material dado.
 * Prioriza la oferta del producto preferido si existe.
 *
 * @param materialId ID del material
 * @param ofertas    Array de ofertas (debe estar pre-ordenado con las más recientes primero, o se tomará la primera match)
 * @param productos  Array de productos para resolver marca preferida
 * @param productoId ID de producto específico (opcional, para buscar oferta de un producto concreto)
 * @returns La oferta vigente o undefined
 */
export function resolveOfertaVigente(
  materialId: string,
  ofertas: Oferta[],
  productos: Producto[],
  productoId?: string
): Oferta | undefined {
  if (productoId) {
    return ofertas.find(o => o.materialId === materialId && o.productoId === productoId);
  }

  // 1. Si el material tiene un producto preferido con precio, tomarlo
  const matProds = productos.filter(p => p.materialId === materialId);
  const preferido = matProds.find(p => p.esPreferido);
  if (preferido) {
    const ofertaPreferido = ofertas.find(
      o => o.materialId === materialId && o.productoId === preferido.id
    );
    if (ofertaPreferido) return ofertaPreferido;
  }

  // 2. Si no, tomar la oferta más reciente (genérica o de cualquier marca)
  return ofertas.find(o => o.materialId === materialId);
}

// ─── Construcción del InsumosMap unificado ───────────────────────────────────────

/**
 * Construye un Map<id, Insumo> unificado que combina insumos legacy, materiales nuevos,
 * productos preferidos y ofertas vigentes. Este mapa es la fuente de verdad para
 * resolución de precios en cotizaciones y tareas tipo.
 *
 * Centraliza la lógica que estaba duplicada en InsumosManager, PresupuestoEditor
 * y TareasTipoManager.
 *
 * @param legacyInsumos Insumos de la tabla legacy 'insumos'
 * @param materiales    Materiales del catálogo normalizado
 * @param productos     Productos (marcas) vinculados a materiales
 * @param ofertas       Ofertas de precios (se ordenan internamente por fecha)
 * @returns Map unificado de ID → Insumo con precio vigente resuelto
 */
export function buildInsumosMap(
  legacyInsumos: Insumo[],
  materiales: Material[],
  productos: Producto[],
  ofertas: Oferta[]
): Map<string, Insumo> {
  const sortedOfertas = [...ofertas].sort(
    (a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime()
  );

  const map = new Map<string, Insumo>();

  // 1. Cargar insumos legacy primero
  legacyInsumos.forEach(i => map.set(i.id, i));

  // 2. Sobrescribir/agregar materiales del catálogo normalizado con precio resuelto
  materiales.forEach(m => {
    // Buscar marca preferida
    const matProds = productos.filter(p => p.materialId === m.id);
    const preferido = matProds.find(p => p.esPreferido);
    let oferta: Oferta | undefined;

    if (preferido) {
      oferta = sortedOfertas
        .filter(o => o.materialId === m.id && o.productoId === preferido.id)
        .pop();
    }
    if (!oferta) {
      oferta = sortedOfertas.filter(o => o.materialId === m.id).pop();
    }

    map.set(m.id, {
      ...m,
      id: m.id,
      nombre: m.nombre,
      unidad: m.unidadVenta || 'u',
      categoria: m.categoriaId,
      precioActual: oferta ? oferta.precio : (m as any).precioActual || 0,
      fechaActualizacion: oferta ? oferta.fecha : new Date().toISOString(),
      historialPrecios: []
    });
  });

  return map;
}
