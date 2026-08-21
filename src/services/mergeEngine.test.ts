import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLocalMasterPayload, mergeLastWriteWins } from './mergeEngine';
import { db } from '../db/database';
import { MasterDatabasePayload } from './syncTypes';

describe('mergeEngine - Sincronización y Consolidación de Contactos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getLocalMasterPayload consolida contactos, clientes y proveedores sin omitir ninguno', async () => {
    vi.spyOn(db.contactos, 'toArray').mockResolvedValue([
      {
        id: 'ct-1',
        razonSocial: 'Contacto Uno',
        nombre: 'Contacto Uno',
        roles: ['cliente'],
        updatedAt: '2026-01-01T10:00:00Z',
        deleted: false
      } as any
    ]);

    vi.spyOn(db.clientes, 'toArray').mockResolvedValue([
      {
        id: 'cli-quick-1',
        razonSocial: 'Cliente Rápido',
        nombre: 'Cliente Rápido',
        roles: ['cliente'],
        updatedAt: '2026-01-02T10:00:00Z',
        deleted: false
      } as any
    ]);

    vi.spyOn(db.proveedores, 'toArray').mockResolvedValue([
      {
        id: 'prov-distribuidora',
        razonSocial: 'Distribuidora Eléctrica S.A.',
        nombre: 'Distribuidora Eléctrica S.A.',
        roles: ['proveedor'],
        tipoProveedor: 'material',
        updatedAt: '2026-01-03T10:00:00Z',
        deleted: false
      } as any
    ]);

    vi.spyOn(db.categoriasMaterial, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.materiales, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.productos, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.ofertas, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.solicitudesCotizacion, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.insumos, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.manoObra, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.costosIndirectos, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.tareasTipo, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.proyectos, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.presupuestos, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.registrosTrabajo, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.config, 'toArray').mockResolvedValue([]);

    const payload = await getLocalMasterPayload();

    expect(payload.contactos).toHaveLength(3);
    const ids = payload.contactos?.map(c => c.id);
    expect(ids).toContain('ct-1');
    expect(ids).toContain('cli-quick-1');
    expect(ids).toContain('prov-distribuidora');

    expect(payload.clientes).toHaveLength(2);
    expect(payload.proveedores).toHaveLength(1);
  });

  it('mergeLastWriteWins normaliza clientes y proveedores remotos y sincroniza tablas locales', async () => {
    vi.spyOn(db.contactos, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.clientes, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.proveedores, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.categoriasMaterial, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.materiales, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.productos, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.ofertas, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.solicitudesCotizacion, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.insumos, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.manoObra, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.costosIndirectos, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.tareasTipo, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.proyectos, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.presupuestos, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.registrosTrabajo, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.config, 'toArray').mockResolvedValue([]);

    const mockBulkPutContactos = vi.spyOn(db.contactos, 'bulkPut').mockResolvedValue(undefined as any);
    const mockBulkPutClientes = vi.spyOn(db.clientes, 'bulkPut').mockResolvedValue(undefined as any);
    const mockBulkPutProveedores = vi.spyOn(db.proveedores, 'bulkPut').mockResolvedValue(undefined as any);

    vi.spyOn(db, 'transaction').mockImplementation((...args: any[]) => {
      const cb = args[args.length - 1];
      return cb();
    });

    const remotePayload: MasterDatabasePayload = {
      version: 1,
      schemaVersion: 4,
      exportedAt: '2026-01-05T12:00:00Z',
      categoriasMaterial: [],
      materiales: [],
      productos: [],
      ofertas: [],
      solicitudesCotizacion: [],
      insumos: [],
      manoObra: [],
      costosIndirectos: [],
      tareasTipo: [],
      contactos: [
        {
          id: 'ct-remote-1',
          razonSocial: 'Empresa Remota S.A.',
          nombre: 'Empresa Remota S.A.',
          roles: ['cliente', 'proveedor'],
          updatedAt: '2026-01-04T10:00:00Z',
          deleted: false
        } as any
      ],
      clientes: [],
      proveedores: [],
      proyectos: [],
      presupuestos: [],
      registrosTrabajo: [],
      config: []
    };

    const { mergedPayload, stats } = await mergeLastWriteWins(remotePayload);

    expect(stats.localAddedCount).toBeGreaterThanOrEqual(1);
    expect(mockBulkPutContactos).toHaveBeenCalled();
    expect(mockBulkPutClientes).toHaveBeenCalled();
    expect(mockBulkPutProveedores).toHaveBeenCalled();
    expect(mergedPayload.contactos).toHaveLength(1);
    expect(mergedPayload.contactos?.[0].id).toBe('ct-remote-1');
  });
});
