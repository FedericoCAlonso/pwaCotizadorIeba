/**
 * materialSuggestions.ts — Sugerencias de materiales del catálogo por función,
 * resolución de la mejor oferta de precio y marca asociada.
 *
 * Módulo puro desacoplado de React y de la base de datos (SOLID SRP/OCP).
 */

import { Material, Producto, Oferta, Insumo } from './types';
import { normalizeStr, expandIdVariants } from './materialMatching';

export interface MaterialCatalogSuggestion {
  id: string;
  /** Función / descripción técnica genérica (sin marca) */
  nombre: string;
  /** Unidad de medida / venta (ej: 'm', 'u', 'rollo x100m') */
  unidad: string;
  /** Precio vigente de la mejor oferta disponible (0 si no existe oferta) */
  precioVigente: number;
  /** Marca comercial del producto de la mejor oferta, o 'sin definir' */
  marcaModelo: string;
  /** Categoría opcional del material */
  categoriaId?: string;
}

/**
 * Resuelve la mejor oferta y marca para un material o insumo dado.
 *
 * Reglas de negocio (Fase 3):
 * 1. La sugerencia se presenta por función (nombre técnico genérico, sin marca).
 * 2. Si existen ofertas válidas (> 0), se selecciona la mejor oferta (menor precio unitario neto).
 * 3. Si la mejor oferta proviene de un producto con marca definida, se utiliza esa marca.
 *    Si no, se intenta con el producto preferido del material.
 *    Si ninguna marca está definida, se asigna 'sin definir'.
 * 4. La unidad corresponde a la unidadVenta del material (o 'u' por defecto).
 */
export function resolveMaterialSuggestion(
  mat: Material | Insumo,
  ofertas: Oferta[],
  productos: Producto[]
): MaterialCatalogSuggestion {
  const targetVariants = expandIdVariants(mat.id);

  // Filtrar ofertas activas para este material
  const activeOffers = ofertas.filter(
    (o) =>
      !o.deleted &&
      (o.materialId === mat.id || targetVariants.includes(o.materialId.toLowerCase())) &&
      Number(o.precio) > 0
  );

  let bestOffer: Oferta | undefined;
  if (activeOffers.length > 0) {
    // Mejor oferta = menor precio unitario vigente; en caso de empate, la más reciente
    bestOffer = [...activeOffers].sort((a, b) => {
      const diff = Number(a.precio) - Number(b.precio);
      if (diff !== 0) return diff;
      return new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime();
    })[0];
  }

  // Resolver marca comercial
  let resolvedBrand = '';

  // 1. Si la mejor oferta tiene un producto vinculado, buscar su marca
  if (bestOffer?.productoId) {
    const prod = productos.find((p) => !p.deleted && p.id === bestOffer?.productoId);
    if (prod?.marca?.trim()) {
      resolvedBrand = `${prod.marca.trim()}${prod.modelo?.trim() ? ' ' + prod.modelo.trim() : ''}`.trim();
    }
  }

  // 2. Si no hubo marca por la oferta, buscar productos asociados al material (priorizando el preferido)
  if (!resolvedBrand) {
    const matProds = productos.filter(
      (p) => !p.deleted && (p.materialId === mat.id || targetVariants.includes(p.materialId.toLowerCase()))
    );
    const prefProd = matProds.find((p) => p.esPreferido) || matProds[0];
    if (prefProd?.marca?.trim()) {
      resolvedBrand = `${prefProd.marca.trim()}${prefProd.modelo?.trim() ? ' ' + prefProd.modelo.trim() : ''}`.trim();
    }
  }

  // 3. Si no hay marca comercial definida, dejar estrictamente 'sin definir'
  if (!resolvedBrand) {
    const legacyMarca = (mat as Insumo).marca?.trim();
    if (legacyMarca && legacyMarca.toLowerCase() !== 'genérico' && legacyMarca.toLowerCase() !== 'sin marca') {
      resolvedBrand = legacyMarca;
    } else {
      resolvedBrand = 'sin definir';
    }
  }

  const unidad = (mat as Material).unidadVenta || (mat as Insumo).unidad || 'u';
  const precioVigente = bestOffer ? Number(bestOffer.precio) : Number((mat as Insumo).precioActual || 0);

  return {
    id: mat.id,
    nombre: mat.nombre,
    unidad,
    precioVigente,
    marcaModelo: resolvedBrand,
    categoriaId: mat.categoriaId || (mat as Insumo).categoria
  };
}

/**
 * Construye la lista de sugerencias de catálogo unificando materiales y ofertas.
 */
export function buildMaterialCatalogSuggestions(
  materiales: Material[],
  legacyInsumos: Insumo[],
  productos: Producto[],
  ofertas: Oferta[]
): MaterialCatalogSuggestion[] {
  const suggestions: MaterialCatalogSuggestion[] = [];
  const seenIds = new Set<string>();

  // 1. Materiales normalizados
  materiales.forEach((m) => {
    if (m.deleted || seenIds.has(m.id)) return;
    seenIds.add(m.id);
    suggestions.push(resolveMaterialSuggestion(m, ofertas, productos));
  });

  // 2. Insumos legacy que no coincidan con un material ya agregado
  legacyInsumos.forEach((ins) => {
    if (ins.deleted || seenIds.has(ins.id)) return;
    const variants = expandIdVariants(ins.id);
    if (variants.some((v) => seenIds.has(v))) return;
    seenIds.add(ins.id);
    suggestions.push(resolveMaterialSuggestion(ins, ofertas, productos));
  });

  return suggestions;
}

/**
 * Busca y filtra sugerencias de catálogo que coincidan con la búsqueda por función.
 */
export function searchMaterialCatalogSuggestions(
  query: string,
  suggestions: MaterialCatalogSuggestion[],
  limit = 8
): MaterialCatalogSuggestion[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const normQuery = normalizeStr(trimmed);
  const queryTokens = normQuery.split(' ').filter(Boolean);

  const matched = suggestions.filter((sug) => {
    const normName = normalizeStr(sug.nombre);
    // Cada token de la búsqueda debe estar presente en el nombre de la función
    return queryTokens.every((token) => normName.includes(token));
  });

  // Ordenar por relevancia: coincidencias exactas al inicio primero
  matched.sort((a, b) => {
    const normA = normalizeStr(a.nombre);
    const normB = normalizeStr(b.nombre);
    const startsA = normA.startsWith(normQuery);
    const startsB = normB.startsWith(normQuery);
    if (startsA && !startsB) return -1;
    if (!startsA && startsB) return 1;
    return a.nombre.localeCompare(b.nombre);
  });

  return matched.slice(0, limit);
}
