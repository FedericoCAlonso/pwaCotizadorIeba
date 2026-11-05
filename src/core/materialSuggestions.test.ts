import { describe, it, expect } from 'vitest';
import { Material, Producto, Oferta, Insumo } from './types';
import {
  resolveMaterialSuggestion,
  buildMaterialCatalogSuggestions,
  searchMaterialCatalogSuggestions
} from './materialSuggestions';

describe('materialSuggestions', () => {
  const mockMaterial: Material = {
    id: 'mat-cable-25',
    categoriaId: 'cat-conductores',
    nombre: 'Cable unipolar 2.5 mm² Cu',
    unidadVenta: 'm',
    atributos: [],
    activo: true
  };

  const mockProductos: Producto[] = [
    {
      id: 'prod-prysmian-25',
      materialId: 'mat-cable-25',
      marca: 'Prysmian',
      modelo: 'Superastic',
      esPreferido: true
    },
    {
      id: 'prod-generic-25',
      materialId: 'mat-cable-25',
      marca: 'Kalop',
      modelo: 'Flex',
      esPreferido: false
    }
  ];

  it('resuelve unidad, precio de la mejor oferta y su marca correspondiente', () => {
    const ofertas: Oferta[] = [
      {
        id: 'of-1',
        materialId: 'mat-cable-25',
        productoId: 'prod-prysmian-25',
        precio: 1500,
        fecha: '2026-01-01',
        fuente: 'manual'
      },
      {
        id: 'of-2',
        materialId: 'mat-cable-25',
        productoId: 'prod-generic-25',
        precio: 1200, // Mejor oferta (menor precio)
        fecha: '2026-01-02',
        fuente: 'manual'
      }
    ];

    const sug = resolveMaterialSuggestion(mockMaterial, ofertas, mockProductos);
    expect(sug.nombre).toBe('Cable unipolar 2.5 mm² Cu');
    expect(sug.unidad).toBe('m');
    expect(sug.precioVigente).toBe(1200);
    expect(sug.marcaModelo).toBe('Kalop Flex');
  });

  it('deja la marca como "sin definir" si no hay producto ni marca asociada', () => {
    const matSinMarca: Material = {
      id: 'mat-tornillo',
      categoriaId: 'cat-fijaciones',
      nombre: 'Tornillo autoperforante T1',
      unidadVenta: 'u',
      atributos: [],
      activo: true
    };

    const ofertas: Oferta[] = [
      {
        id: 'of-tornillo',
        materialId: 'mat-tornillo',
        precio: 85,
        fecha: '2026-01-01',
        fuente: 'manual'
      }
    ];

    const sug = resolveMaterialSuggestion(matSinMarca, ofertas, []);
    expect(sug.nombre).toBe('Tornillo autoperforante T1');
    expect(sug.unidad).toBe('u');
    expect(sug.precioVigente).toBe(85);
    expect(sug.marcaModelo).toBe('sin definir');
  });

  it('deja precio 0 y marca "sin definir" si no existen ofertas ni productos', () => {
    const sug = resolveMaterialSuggestion(mockMaterial, [], []);
    expect(sug.precioVigente).toBe(0);
    expect(sug.marcaModelo).toBe('sin definir');
  });

  it('filtra sugerencias por búsqueda fonética / tokens de función', () => {
    const suggestions = [
      {
        id: '1',
        nombre: 'Cable unipolar 2.5 mm²',
        unidad: 'm',
        precioVigente: 1200,
        marcaModelo: 'Prysmian'
      },
      {
        id: '2',
        nombre: 'Cable unipolar 4.0 mm²',
        unidad: 'm',
        precioVigente: 1800,
        marcaModelo: 'sin definir'
      },
      {
        id: '3',
        nombre: 'Caja rectangular 10x5',
        unidad: 'u',
        precioVigente: 650,
        marcaModelo: 'Genrod'
      }
    ];

    const res1 = searchMaterialCatalogSuggestions('cable 2.5', suggestions);
    expect(res1).toHaveLength(1);
    expect(res1[0].id).toBe('1');

    const res2 = searchMaterialCatalogSuggestions('cable', suggestions);
    expect(res2).toHaveLength(2);

    const resEmpty = searchMaterialCatalogSuggestions('', suggestions);
    expect(resEmpty).toHaveLength(0);
  });
});
