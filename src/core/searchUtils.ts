import { Material, Producto, MotorBusquedaEcommerce } from './types';
import { DEFAULT_MOTORES_BUSQUEDA } from './sampleData';

/**
 * Construye de forma inteligente el término de búsqueda según el nivel:
 * - A nivel MATERIAL: búsqueda genérica técnica (Nombre + Atributos técnicos clave como sección, norma, polos, etc.).
 * - A nivel PRODUCTO: búsqueda comercial exacta (Marca + Modelo + Código de Fabricante).
 */
export function buildSearchTerm(target: {
  tipo: 'material' | 'producto';
  material?: Partial<Material> | null;
  producto?: Partial<Producto> | null;
  customNombre?: string;
}): string {
  if (target.tipo === 'producto' && target.producto) {
    const p = target.producto;
    const m = target.material;

    const code = p.codigoFabricante || (p as any).codigo || (p as any).sku;
    const marca = p.marca || '';
    const modelo = p.modelo || '';
    const matNombre = m?.nombre || target.customNombre || '';

    // Si tiene código de fabricante/SKU claro (más de 3 caracteres)
    if (code && code.trim().length >= 3) {
      if (marca && !code.toLowerCase().includes(marca.toLowerCase())) {
        return `${marca} ${code}`.trim();
      }
      return code.trim();
    }

    // Si no tiene código directo, combinamos Marca + Modelo + Nombre Material
    const parts: string[] = [];
    if (marca) parts.push(marca);
    if (modelo) parts.push(modelo);
    if (matNombre && !parts.some((pt) => matNombre.toLowerCase().includes(pt.toLowerCase()))) {
      parts.push(matNombre);
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  // Búsqueda genérica técnica a nivel Material
  const m = target.material;
  const nombre = m?.nombre || target.customNombre || '';
  const parts: string[] = [nombre];

  if (m?.atributos && Array.isArray(m.atributos)) {
    m.atributos.forEach((at) => {
      if (at.valor && typeof at.valor === 'string' && at.valor.trim()) {
        const val = at.valor.trim();
        if (!nombre.toLowerCase().includes(val.toLowerCase())) {
          parts.push(val);
        }
      }
    });
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Abre la búsqueda en una nueva pestaña del navegador para el motor seleccionado.
 */
export function openEcommerceSearch(
  engine: MotorBusquedaEcommerce,
  target: {
    tipo: 'material' | 'producto';
    material?: Partial<Material> | null;
    producto?: Partial<Producto> | null;
    customNombre?: string;
  }
): void {
  const query = buildSearchTerm(target);
  if (!query) return;

  const encodedQuery = encodeURIComponent(query);
  const rawUrl = engine.urlTemplate.replace(/\{query\}/g, encodedQuery);
  window.open(rawUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Obtiene la lista de motores activos configurados, con fallback a los motores por defecto.
 */
export function getActiveSearchEngines(customEngines?: MotorBusquedaEcommerce[]): MotorBusquedaEcommerce[] {
  if (customEngines && customEngines.length > 0) {
    const actives = customEngines.filter((e) => e.activo);
    if (actives.length > 0) return actives;
  }
  return DEFAULT_MOTORES_BUSQUEDA.filter((e) => e.activo);
}
