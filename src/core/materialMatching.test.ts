import { describe, test, expect } from 'vitest';
import {
  normalizeStr,
  expandIdVariants,
  matchesMaterialContext,
  getObraQuantity,
  resolveOfertaVigente,
  buildInsumosMap,
} from './materialMatching';
import { Material, Producto, Oferta, Insumo, MaterialFilterContext } from './types';

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const makeMaterial = (id: string, nombre: string, categoriaId = 'cat-cables'): Material => ({
  id,
  categoriaId,
  nombre,
  unidadVenta: 'u',
  atributos: [],
  activo: true,
});

const makeProducto = (id: string, materialId: string, marca: string): Producto => ({
  id,
  materialId,
  marca,
  modelo: '',
  esPreferido: false,
});

const makeOferta = (id: string, materialId: string, precio: number, productoId?: string): Oferta => ({
  id,
  materialId,
  productoId,
  precio,
  fecha: new Date().toISOString(),
  fuente: 'manual',
});

// ─── normalizeStr ───────────────────────────────────────────────────────────────

describe('normalizeStr', () => {
  test('elimina tildes y pasa a lowercase', () => {
    expect(normalizeStr('Caño Rígido')).toBe('cano rigido');
  });

  test('reemplaza caracteres especiales por espacios', () => {
    // Ø (U+00D8) → NFD no descompone Ø (es una letra nórdica, no acentuada)
    // → toLowerCase() → ø → regex [^a-z0-9] elimina ø → se pierde
    expect(normalizeStr('Cable Ø3/4" IRAM-247')).toBe('cable 3 4 iram 247');
  });

  test('colapsa múltiples espacios', () => {
    expect(normalizeStr('  Cable   Unipolar  ')).toBe('cable unipolar');
  });

  test('string vacío devuelve vacío', () => {
    expect(normalizeStr('')).toBe('');
  });
});

// ─── expandIdVariants ───────────────────────────────────────────────────────────

describe('expandIdVariants', () => {
  test('genera variante ins- para prefijo mat-', () => {
    const variants = expandIdVariants('mat-cable-123');
    expect(variants).toContain('mat-cable-123');
    expect(variants).toContain('ins-cable-123');
  });

  test('genera variante mat- para prefijo ins-', () => {
    const variants = expandIdVariants('ins-cable-456');
    expect(variants).toContain('ins-cable-456');
    expect(variants).toContain('mat-cable-456');
  });

  test('no genera variante para otros prefijos', () => {
    const variants = expandIdVariants('custom-789');
    expect(variants).toEqual(['custom-789']);
  });

  test('normaliza a lowercase', () => {
    const variants = expandIdVariants('MAT-Cable-ABC');
    expect(variants).toContain('mat-cable-abc');
    expect(variants).toContain('ins-cable-abc');
  });
});

// ─── matchesMaterialContext ─────────────────────────────────────────────────────

describe('matchesMaterialContext', () => {
  const cables = makeMaterial('mat-cable-uni-1.5', 'Cable Unipolar 1.5 mm² Marrón IRAM 247-3');
  const cano = makeMaterial('mat-cano-mpc-3/4', 'Caño Rígido MPC Ø3/4"');
  const llave = makeMaterial('mat-llave-simple', 'Módulo Llave Simple 10A');

  test('match por ID directo', () => {
    const ctx: MaterialFilterContext = {
      title: 'Test',
      materialIds: ['mat-cable-uni-1.5'],
    };
    expect(matchesMaterialContext(cables, ctx, [])).toBe(true);
    expect(matchesMaterialContext(cano, ctx, [])).toBe(false);
  });

  test('match por variante de ID (ins- busca mat-)', () => {
    const ctx: MaterialFilterContext = {
      title: 'Test',
      materialIds: ['ins-cable-uni-1.5'],
    };
    expect(matchesMaterialContext(cables, ctx, [])).toBe(true);
  });

  test('match por variante de ID (mat- busca ins-)', () => {
    const insumoLegacy = makeMaterial('ins-cable-legacy', 'Cable Legacy');
    const ctx: MaterialFilterContext = {
      title: 'Test',
      materialIds: ['mat-cable-legacy'],
    };
    expect(matchesMaterialContext(insumoLegacy, ctx, [])).toBe(true);
  });

  test('match por producto asociado', () => {
    const prod = makeProducto('prod-prysmian', cables.id, 'Prysmian');
    const ctx: MaterialFilterContext = {
      title: 'Test',
      materialIds: ['prod-prysmian'],
    };
    expect(matchesMaterialContext(cables, ctx, [prod])).toBe(true);
    expect(matchesMaterialContext(cano, ctx, [prod])).toBe(false);
  });

  test('match por nombre exacto (substring)', () => {
    const ctx: MaterialFilterContext = {
      title: 'Test',
      materialIds: [],
      materialNames: ['Cable Unipolar 1.5 mm² Marrón IRAM 247-3'],
    };
    expect(matchesMaterialContext(cables, ctx, [])).toBe(true);
    expect(matchesMaterialContext(cano, ctx, [])).toBe(false);
  });

  test('match por tokens compartidos (>= 2)', () => {
    const ctx: MaterialFilterContext = {
      title: 'Test',
      materialIds: [],
      materialNames: ['Cable Unipolar 2.5mm'],
    };
    // "cable" y "unipolar" son tokens comunes
    expect(matchesMaterialContext(cables, ctx, [])).toBe(true);
    expect(matchesMaterialContext(llave, ctx, [])).toBe(false);
  });

  test('no matchea "insumo no encontrado"', () => {
    const ctx: MaterialFilterContext = {
      title: 'Test',
      materialIds: [],
      materialNames: ['Insumo no encontrado'],
    };
    expect(matchesMaterialContext(cables, ctx, [])).toBe(false);
  });

  test('sin IDs ni nombres devuelve false', () => {
    const ctx: MaterialFilterContext = {
      title: 'Test',
      materialIds: [],
      materialNames: [],
    };
    expect(matchesMaterialContext(cables, ctx, [])).toBe(false);
  });

  test('match múltiple: encuentra todos los materiales de una lista', () => {
    const ctx: MaterialFilterContext = {
      title: 'Tarea: Boca de Iluminación',
      materialIds: ['mat-cable-uni-1.5', 'mat-cano-mpc-3/4', 'mat-llave-simple'],
    };
    expect(matchesMaterialContext(cables, ctx, [])).toBe(true);
    expect(matchesMaterialContext(cano, ctx, [])).toBe(true);
    expect(matchesMaterialContext(llave, ctx, [])).toBe(true);
  });

  test('no incluye materiales ajenos con nombres parecidos si hay IDs explícitos', () => {
    const cable10mm = makeMaterial('mat-cable-uni-10', 'Cable Unipolar 10 mm² Negro IRAM 247-3');
    const ctx: MaterialFilterContext = {
      title: 'Cotización Test',
      materialIds: ['mat-cable-uni-1.5'],
      materialNames: ['Cable Unipolar 1.5 mm² Marrón IRAM 247-3'],
    };
    expect(matchesMaterialContext(cables, ctx, [])).toBe(true);
    expect(matchesMaterialContext(cable10mm, ctx, [])).toBe(false);
  });
});

// ─── getObraQuantity ────────────────────────────────────────────────────────────

describe('getObraQuantity', () => {
  const quantities: Record<string, { cantidad: number; unidad: string }> = {
    'mat-cable-1': { cantidad: 15, unidad: 'm' },
    'ins-cano-2': { cantidad: 3, unidad: 'u' },
  };

  test('búsqueda directa por ID', () => {
    expect(getObraQuantity('mat-cable-1', quantities)).toEqual({ cantidad: 15, unidad: 'm' });
  });

  test('búsqueda por variante mat- → ins-', () => {
    // El quantities tiene 'ins-cano-2', buscamos con 'mat-cano-2'
    expect(getObraQuantity('mat-cano-2', quantities)).toEqual({ cantidad: 3, unidad: 'u' });
  });

  test('búsqueda por variante ins- → mat-', () => {
    // El quantities tiene 'mat-cable-1', buscamos con 'ins-cable-1'
    expect(getObraQuantity('ins-cable-1', quantities)).toEqual({ cantidad: 15, unidad: 'm' });
  });

  test('ID no encontrado devuelve undefined', () => {
    expect(getObraQuantity('mat-inexistente', quantities)).toBeUndefined();
  });

  test('quantities undefined devuelve undefined', () => {
    expect(getObraQuantity('mat-cable-1', undefined)).toBeUndefined();
  });
});

// ─── resolveOfertaVigente ───────────────────────────────────────────────────────

describe('resolveOfertaVigente', () => {
  const matId = 'mat-cable-1';
  const prodPreferido = { ...makeProducto('prod-1', matId, 'Marca A'), esPreferido: true };
  const prodOtro = makeProducto('prod-2', matId, 'Marca B');
  const ofertaPref = makeOferta('of-1', matId, 100, 'prod-1');
  const ofertaOtro = makeOferta('of-2', matId, 80, 'prod-2');
  const ofertaGenerica = makeOferta('of-3', matId, 90);

  test('con productoId específico devuelve esa oferta', () => {
    const result = resolveOfertaVigente(matId, [ofertaPref, ofertaOtro], [prodPreferido, prodOtro], 'prod-2');
    expect(result?.id).toBe('of-2');
  });

  test('sin productoId prioriza producto preferido', () => {
    const result = resolveOfertaVigente(matId, [ofertaPref, ofertaOtro, ofertaGenerica], [prodPreferido, prodOtro]);
    expect(result?.id).toBe('of-1');
  });

  test('sin producto preferido devuelve primera oferta disponible', () => {
    const result = resolveOfertaVigente(matId, [ofertaOtro, ofertaGenerica], [prodOtro]);
    expect(result?.id).toBe('of-2');
  });

  test('sin ofertas devuelve undefined', () => {
    const result = resolveOfertaVigente(matId, [], [prodPreferido]);
    expect(result).toBeUndefined();
  });
});

// ─── buildInsumosMap ────────────────────────────────────────────────────────────

describe('buildInsumosMap', () => {
  test('combina insumos legacy y materiales', () => {
    const legacy: Insumo[] = [{
      id: 'ins-legacy-1',
      categoriaId: 'cat-1',
      nombre: 'Legacy Cable',
      unidadVenta: 'm',
      atributos: [],
      activo: true,
      precioActual: 50,
      historialPrecios: [],
    }];
    const materiales = [makeMaterial('mat-new-1', 'New Cable')];
    const ofertas = [makeOferta('of-1', 'mat-new-1', 120)];

    const map = buildInsumosMap(legacy, materiales, [], ofertas);

    expect(map.has('ins-legacy-1')).toBe(true);
    expect(map.has('mat-new-1')).toBe(true);
    expect(map.get('mat-new-1')?.precioActual).toBe(120);
  });

  test('material sobrescribe insumo legacy con mismo ID', () => {
    const legacy: Insumo[] = [{
      id: 'mat-shared',
      categoriaId: 'cat-1',
      nombre: 'Old Name',
      unidadVenta: 'u',
      atributos: [],
      activo: true,
      precioActual: 10,
      historialPrecios: [],
    }];
    const materiales = [makeMaterial('mat-shared', 'New Name')];
    const ofertas = [makeOferta('of-1', 'mat-shared', 200)];

    const map = buildInsumosMap(legacy, materiales, [], ofertas);
    expect(map.get('mat-shared')?.nombre).toBe('New Name');
    expect(map.get('mat-shared')?.precioActual).toBe(200);
  });

  test('prioriza oferta de producto preferido', () => {
    const materiales = [makeMaterial('mat-1', 'Cable')];
    const prods = [
      { ...makeProducto('prod-a', 'mat-1', 'Marca A'), esPreferido: true },
      makeProducto('prod-b', 'mat-1', 'Marca B'),
    ];
    const ofertas = [
      makeOferta('of-b', 'mat-1', 80, 'prod-b'),
      makeOferta('of-a', 'mat-1', 120, 'prod-a'),
    ];

    const map = buildInsumosMap([], materiales, prods, ofertas);
    // Debería usar la oferta del preferido (120), no la más barata (80)
    expect(map.get('mat-1')?.precioActual).toBe(120);
  });
});
