import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { clearUserSessionData, db } from './database';
import { DEFAULT_APP_CONFIG } from '../core/sampleData';

describe('clearUserSessionData - Cierre de sesión seguro y eliminación de datos privados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limpia todas las tablas de usuario y re-siembra la configuración limpia de fábrica sin contactos residuales', async () => {
    const clearSpies = {
      presupuestos: vi.spyOn(db.presupuestos, 'clear').mockResolvedValue(undefined as any),
      contactos: vi.spyOn(db.contactos, 'clear').mockResolvedValue(undefined as any),
      clientes: vi.spyOn(db.clientes, 'clear').mockResolvedValue(undefined as any),
      proveedores: vi.spyOn(db.proveedores, 'clear').mockResolvedValue(undefined as any),
      proyectos: vi.spyOn(db.proyectos, 'clear').mockResolvedValue(undefined as any),
      registrosTrabajo: vi.spyOn(db.registrosTrabajo, 'clear').mockResolvedValue(undefined as any),
      solicitudesCotizacion: vi.spyOn(db.solicitudesCotizacion, 'clear').mockResolvedValue(undefined as any),
      ofertas: vi.spyOn(db.ofertas, 'clear').mockResolvedValue(undefined as any),
      config: vi.spyOn(db.config, 'clear').mockResolvedValue(undefined as any),
      categoriasMaterial: vi.spyOn(db.categoriasMaterial, 'clear').mockResolvedValue(undefined as any),
      materiales: vi.spyOn(db.materiales, 'clear').mockResolvedValue(undefined as any),
      productos: vi.spyOn(db.productos, 'clear').mockResolvedValue(undefined as any),
      insumos: vi.spyOn(db.insumos, 'clear').mockResolvedValue(undefined as any),
      manoObra: vi.spyOn(db.manoObra, 'clear').mockResolvedValue(undefined as any),
      costosIndirectos: vi.spyOn(db.costosIndirectos, 'clear').mockResolvedValue(undefined as any),
      tareasTipo: vi.spyOn(db.tareasTipo, 'clear').mockResolvedValue(undefined as any)
    };

    const addConfigSpy = vi.spyOn(db.config, 'add').mockResolvedValue('app_config' as any);
    const bulkPutContactosSpy = vi.spyOn(db.contactos, 'bulkPut').mockResolvedValue([] as any);
    const bulkPutCategoriasSpy = vi.spyOn(db.categoriasMaterial, 'bulkPut').mockResolvedValue([] as any);
    const bulkPutMaterialesSpy = vi.spyOn(db.materiales, 'bulkPut').mockResolvedValue([] as any);
    const bulkPutProductosSpy = vi.spyOn(db.productos, 'bulkPut').mockResolvedValue([] as any);
    const bulkPutInsumosSpy = vi.spyOn(db.insumos, 'bulkPut').mockResolvedValue([] as any);
    const bulkPutManoObraSpy = vi.spyOn(db.manoObra, 'bulkPut').mockResolvedValue([] as any);
    const bulkPutCostosIndirectosSpy = vi.spyOn(db.costosIndirectos, 'bulkPut').mockResolvedValue([] as any);
    const bulkPutTareasTipoSpy = vi.spyOn(db.tareasTipo, 'bulkPut').mockResolvedValue([] as any);

    vi.spyOn(Dexie.prototype, 'transaction').mockImplementation(async (...args: any[]) => {
      const fn = args[args.length - 1];
      if (typeof fn === 'function') {
        return fn();
      }
    });

    await clearUserSessionData();

    // 1. Validar que se limpiaron todas las tablas privadas del usuario
    expect(clearSpies.presupuestos).toHaveBeenCalledTimes(1);
    expect(clearSpies.contactos).toHaveBeenCalledTimes(1);
    expect(clearSpies.clientes).toHaveBeenCalledTimes(1);
    expect(clearSpies.proveedores).toHaveBeenCalledTimes(1);
    expect(clearSpies.proyectos).toHaveBeenCalledTimes(1);
    expect(clearSpies.registrosTrabajo).toHaveBeenCalledTimes(1);
    expect(clearSpies.solicitudesCotizacion).toHaveBeenCalledTimes(1);
    expect(clearSpies.ofertas).toHaveBeenCalledTimes(1);
    expect(clearSpies.config).toHaveBeenCalledTimes(1);

    // 2. Validar que se restableció la configuración base limpia
    expect(addConfigSpy).toHaveBeenCalledWith(DEFAULT_APP_CONFIG);

    // 3. Validar que se limpiaron y re-sembraron catálogos estándar técnicos
    expect(clearSpies.categoriasMaterial).toHaveBeenCalledTimes(1);
    expect(clearSpies.materiales).toHaveBeenCalledTimes(1);
    expect(clearSpies.productos).toHaveBeenCalledTimes(1);
    expect(clearSpies.insumos).toHaveBeenCalledTimes(1);
    expect(clearSpies.manoObra).toHaveBeenCalledTimes(1);
    expect(clearSpies.costosIndirectos).toHaveBeenCalledTimes(1);
    expect(clearSpies.tareasTipo).toHaveBeenCalledTimes(1);

    expect(bulkPutCategoriasSpy).toHaveBeenCalled();
    expect(bulkPutMaterialesSpy).toHaveBeenCalled();
    expect(bulkPutInsumosSpy).toHaveBeenCalled();
    expect(bulkPutManoObraSpy).toHaveBeenCalled();
    expect(bulkPutCostosIndirectosSpy).toHaveBeenCalled();
    expect(bulkPutTareasTipoSpy).toHaveBeenCalled();

    // 4. Asegurar que NINGÚN contacto personal ni inicial fue inyectado
    expect(bulkPutContactosSpy).not.toHaveBeenCalled();
  });
});
