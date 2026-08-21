import { SyncProvider, SyncExecutionResult, MasterDatabasePayload } from './syncTypes';
import { LocalFileSystemProvider } from './providers/LocalFileSystemProvider';
import { GoogleDriveProvider } from './providers/GoogleDriveProvider';
import { ManualJsonProvider } from './providers/ManualJsonProvider';
import { mergeLastWriteWins, getLocalMasterPayload } from './mergeEngine';
import { SyncProviderType } from '../core/types';
import { db } from '../db/database';

class DecentralizedSyncEngine {
  private localFsProvider = new LocalFileSystemProvider();
  private gdriveProvider = new GoogleDriveProvider();
  private manualProvider = new ManualJsonProvider();
  private activeProviderType: SyncProviderType = 'local_file';
  private isSyncing = false;
  private autoSyncTimer: any = null;
  private listeners: ((state: { isSyncing: boolean; lastResult?: SyncExecutionResult }) => void)[] = [];
  private lastResult?: SyncExecutionResult;

  constructor() {
    this.initProviderFromStorage();
  }

  private initProviderFromStorage(): void {
    try {
      const savedType = localStorage.getItem('ieba_sync_active_provider') as SyncProviderType;
      if (savedType && ['local_file', 'google_drive', 'manual_json'].includes(savedType)) {
        this.activeProviderType = savedType;
      }
    } catch {
      this.activeProviderType = 'local_file';
    }
  }

  getActiveProviderType(): SyncProviderType {
    return this.activeProviderType;
  }

  setActiveProviderType(type: SyncProviderType): void {
    this.activeProviderType = type;
    localStorage.setItem('ieba_sync_active_provider', type);
    this.notifyListeners();
  }

  getProvider(type: SyncProviderType = this.activeProviderType): SyncProvider {
    switch (type) {
      case 'google_drive':
        return this.gdriveProvider;
      case 'manual_json':
        return this.manualProvider;
      case 'local_file':
      default:
        return this.localFsProvider;
    }
  }

  getGoogleDriveProvider(): GoogleDriveProvider {
    return this.gdriveProvider;
  }

  getLocalFileSystemProvider(): LocalFileSystemProvider {
    return this.localFsProvider;
  }

  subscribe(callback: (state: { isSyncing: boolean; lastResult?: SyncExecutionResult }) => void): () => void {
    this.listeners.push(callback);
    callback({ isSyncing: this.isSyncing, lastResult: this.lastResult });
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l({ isSyncing: this.isSyncing, lastResult: this.lastResult }));
  }

  /**
   * Ejecuta la sincronización completa: PULL -> LWW MERGE -> PUSH
   */
  async executeSync(overrideProviderType?: SyncProviderType): Promise<SyncExecutionResult> {
    if (this.isSyncing) {
      throw new Error('Ya hay una sincronización en curso.');
    }

    const providerType = overrideProviderType || this.activeProviderType;
    const provider = this.getProvider(providerType);

    this.isSyncing = true;
    this.notifyListeners();

    const timestamp = new Date().toISOString();

    try {
      // 1. PULL del archivo maestro desde el proveedor
      const remotePayload = await provider.readMasterPayload();

      // 2. MERGE Last-Write-Wins en IndexedDB
      const { mergedPayload, stats } = await mergeLastWriteWins(remotePayload);

      // 3. PUSH de la versión consolidada al proveedor
      await provider.writeMasterPayload(mergedPayload);

      // 4. Actualizar timestamp de última sincronización
      localStorage.setItem('ieba_last_sync_time', timestamp);
      const configs = await db.config.toArray();
      if (configs.length > 0) {
        await db.config.update(configs[0].id, {
          syncConfig: {
            providerType,
            autoSync: true,
            syncIntervalMinutes: configs[0].syncIntervalMinutes || 5,
            lastSyncTimestamp: timestamp
          }
        });
      }

      this.lastResult = {
        success: true,
        provider: providerType,
        timestamp,
        stats,
        message: `Sincronización exitosa: ${stats.localUpdatedCount + stats.localAddedCount} registros actualizados desde la nube/disco.`
      };

      return this.lastResult;
    } catch (err: any) {
      console.error('[DecentralizedSync] Error durante la sincronización:', err);
      this.lastResult = {
        success: false,
        provider: providerType,
        timestamp,
        stats: {
          tablesProcessed: 0,
          localUpdatedCount: 0,
          localAddedCount: 0,
          remoteNewerCount: 0,
          localNewerCount: 0,
          identicalCount: 0
        },
        message: err.message || 'Error al conectar con el proveedor de sincronización.',
        error: err.message
      };
      throw err;
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Ejecuta la depuración y compactación permanente de datos:
   * - Elimina permanentemente registros borrados (deleted: true) o corruptos tanto local como remotamente.
   * - Sanea el archivo maestro consolidado en Google Drive / Carpeta Local.
   * - Limpia y sincroniza la base de datos local Dexie.
   */
  async executeDataCleanup(): Promise<SyncExecutionResult> {
    if (this.isSyncing) {
      throw new Error('Ya hay una operación de sincronización en curso.');
    }

    const providerType = this.activeProviderType;
    const provider = this.getProvider(providerType);

    this.isSyncing = true;
    this.notifyListeners();
    const timestamp = new Date().toISOString();

    try {
      // 1. Leer estado remoto
      let remotePayload: MasterDatabasePayload | null = null;
      try {
        remotePayload = await provider.readMasterPayload();
      } catch (e) {
        console.warn('[syncEngine] No se pudo leer payload remoto previo, usando local:', e);
      }

      // 2. Limpieza de Contactos (Clientes / Proveedores)
      const allContactos = await db.contactos.toArray();
      const allClientes = await db.clientes.toArray();
      const allProveedores = await db.proveedores.toArray();

      const remoteContactos: any[] = [];
      if (Array.isArray(remotePayload?.contactos)) remoteContactos.push(...remotePayload.contactos);
      if (Array.isArray(remotePayload?.clientes)) remoteContactos.push(...remotePayload.clientes);
      if (Array.isArray(remotePayload?.proveedores)) remoteContactos.push(...remotePayload.proveedores);

      const activeContactsMap = new Map<string, any>();

      // Procesar remotos activos
      remoteContactos.forEach(rc => {
        if (!rc || !rc.id || rc.deleted) return;
        if (!rc.razonSocial && !rc.nombre) return;
        activeContactsMap.set(String(rc.id), rc);
      });

      // Procesar clientes y proveedores locales activos
      allClientes.forEach(lc => {
        if (!lc || !lc.id || lc.deleted) return;
        if (!lc.razonSocial && !lc.nombre) return;
        activeContactsMap.set(String(lc.id), {
          ...lc,
          razonSocial: lc.razonSocial || lc.nombre || 'Cliente',
          nombre: lc.nombre || lc.razonSocial || 'Cliente',
          roles: lc.roles && lc.roles.length > 0 ? lc.roles : ['cliente']
        });
      });

      allProveedores.forEach(lp => {
        if (!lp || !lp.id || lp.deleted) return;
        if (!lp.razonSocial && !lp.nombre) return;
        if (activeContactsMap.has(String(lp.id))) {
          const existing = activeContactsMap.get(String(lp.id));
          if (!existing.roles?.includes('proveedor')) {
            existing.roles = [...(existing.roles || []), 'proveedor'];
          }
          existing.tipoProveedor = lp.tipoProveedor || existing.tipoProveedor;
        } else {
          activeContactsMap.set(String(lp.id), {
            ...lp,
            razonSocial: lp.razonSocial || lp.nombre || 'Proveedor',
            nombre: lp.nombre || lp.razonSocial || 'Proveedor',
            roles: lp.roles && lp.roles.length > 0 ? lp.roles : ['proveedor'],
            tipoProveedor: lp.tipoProveedor || 'material'
          });
        }
      });

      // Procesar contactos locales activos
      allContactos.forEach(lc => {
        if (!lc || !lc.id || lc.deleted) return;
        if (!lc.razonSocial && !lc.nombre) return;
        activeContactsMap.set(String(lc.id), lc);
      });

      const cleanContactos = Array.from(activeContactsMap.values());
      const cleanClientes = cleanContactos.filter(c => !c.roles || c.roles.includes('cliente'));
      const cleanProveedores = cleanContactos.filter(c => c.roles?.includes('proveedor'));

      // 3. Limpieza de Proyectos CAD de Traza
      const remoteTrazaProjs: any[] = [];
      if (Array.isArray(remotePayload?.trazaProyectos)) remoteTrazaProjs.push(...remotePayload.trazaProyectos);
      if (Array.isArray(remotePayload?.proyectos)) {
        remotePayload.proyectos.forEach(p => {
          if (p && Array.isArray((p as any).ambientes)) remoteTrazaProjs.push(p);
        });
      }
      const cleanTrazaProyectos = remoteTrazaProjs.filter(p => p && p.id && !p.deleted);

      // 4. Limpieza de tablas de Cotizador (IndexedDB)
      const cleanCategoriasMaterial = (await db.categoriasMaterial.toArray()).filter(x => !x.deleted);
      const cleanMateriales = (await db.materiales.toArray()).filter(x => !x.deleted);
      const cleanProductos = (await db.productos.toArray()).filter(x => !x.deleted);
      const cleanOfertas = (await db.ofertas.toArray()).filter(x => !x.deleted);
      const cleanSolicitudes = (await db.solicitudesCotizacion.toArray()).filter(x => !x.deleted);
      const cleanInsumos = (await db.insumos.toArray()).filter(x => !x.deleted);
      const cleanManoObra = (await db.manoObra.toArray()).filter(x => !x.deleted);
      const cleanCostosIndirectos = (await db.costosIndirectos.toArray()).filter(x => !x.deleted);
      const cleanTareasTipo = (await db.tareasTipo.toArray()).filter(x => !x.deleted);
      const cleanProyectos = (await db.proyectos.toArray()).filter(x => !x.deleted && !Array.isArray((x as any).ambientes));
      const cleanPresupuestos = (await db.presupuestos.toArray()).filter(x => !x.deleted);
      const cleanRegistrosTrabajo = (await db.registrosTrabajo.toArray()).filter(x => !x.deleted);
      const cleanConfig = await db.config.toArray();

      // 5. Aplicar limpieza a IndexedDB local dentro de una transacción
      await db.transaction('rw', [
        db.contactos,
        db.clientes,
        db.proveedores,
        db.categoriasMaterial,
        db.materiales,
        db.productos,
        db.ofertas,
        db.solicitudesCotizacion,
        db.insumos,
        db.manoObra,
        db.costosIndirectos,
        db.tareasTipo,
        db.proyectos,
        db.presupuestos,
        db.registrosTrabajo
      ], async () => {
        await db.contactos.clear();
        await db.contactos.bulkAdd(cleanContactos);

        await db.clientes.clear();
        await db.clientes.bulkAdd(cleanClientes);

        await db.proveedores.clear();
        await db.proveedores.bulkAdd(cleanProveedores);

        await db.categoriasMaterial.clear();
        await db.categoriasMaterial.bulkAdd(cleanCategoriasMaterial);

        await db.materiales.clear();
        await db.materiales.bulkAdd(cleanMateriales);

        await db.productos.clear();
        await db.productos.bulkAdd(cleanProductos);

        await db.ofertas.clear();
        await db.ofertas.bulkAdd(cleanOfertas);

        await db.solicitudesCotizacion.clear();
        await db.solicitudesCotizacion.bulkAdd(cleanSolicitudes);

        await db.insumos.clear();
        await db.insumos.bulkAdd(cleanInsumos);

        await db.manoObra.clear();
        await db.manoObra.bulkAdd(cleanManoObra);

        await db.costosIndirectos.clear();
        await db.costosIndirectos.bulkAdd(cleanCostosIndirectos);

        await db.tareasTipo.clear();
        await db.tareasTipo.bulkAdd(cleanTareasTipo);

        await db.proyectos.clear();
        await db.proyectos.bulkAdd(cleanProyectos);

        await db.presupuestos.clear();
        await db.presupuestos.bulkAdd(cleanPresupuestos);

        await db.registrosTrabajo.clear();
        await db.registrosTrabajo.bulkAdd(cleanRegistrosTrabajo);
      });

      // 6. Construir Master Payload maestro compacto y limpio
      const cleanPayload: MasterDatabasePayload = {
        version: 1,
        schemaVersion: 4,
        exportedAt: timestamp,
        categoriasMaterial: cleanCategoriasMaterial,
        materiales: cleanMateriales,
        productos: cleanProductos,
        ofertas: cleanOfertas,
        solicitudesCotizacion: cleanSolicitudes,
        insumos: cleanInsumos,
        manoObra: cleanManoObra,
        costosIndirectos: cleanCostosIndirectos,
        tareasTipo: cleanTareasTipo,
        contactos: cleanContactos,
        clientes: cleanClientes,
        proveedores: cleanProveedores,
        proyectos: cleanProyectos,
        presupuestos: cleanPresupuestos,
        registrosTrabajo: cleanRegistrosTrabajo,
        config: cleanConfig,
        trazaProyectos: cleanTrazaProyectos
      };

      // 7. Escribir al proveedor
      await provider.writeMasterPayload(cleanPayload);

      // 8. Actualizar timestamp de sync
      localStorage.setItem('ieba_last_sync_time', timestamp);

      const result: SyncExecutionResult = {
        success: true,
        provider: providerType,
        timestamp,
        stats: {
          tablesProcessed: 16,
          localUpdatedCount: cleanContactos.length,
          localAddedCount: 0,
          remoteNewerCount: 0,
          localNewerCount: cleanContactos.length,
          identicalCount: 0
        },
        message: `Depuración y compactación exitosa: Base de datos saneada con ${cleanContactos.length} contactos y ${cleanTrazaProyectos.length} relevamientos activos.`
      };

      this.lastResult = result;
      return result;
    } catch (err: any) {
      console.error('[syncEngine] Error en limpieza de datos:', err);
      const result: SyncExecutionResult = {
        success: false,
        provider: providerType,
        timestamp,
        stats: {
          tablesProcessed: 0,
          localUpdatedCount: 0,
          localAddedCount: 0,
          remoteNewerCount: 0,
          localNewerCount: 0,
          identicalCount: 0
        },
        message: err.message || 'Error al ejecutar la limpieza de datos',
        error: err.message
      };
      this.lastResult = result;
      throw err;
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Exporta directamente el JSON local
   */
  async exportLocalMasterJson(): Promise<MasterDatabasePayload> {
    return getLocalMasterPayload();
  }

  /**
   * Inicia el temporizador de sincronización en segundo plano
   */
  startAutoSync(intervalMinutes = 5): void {
    this.stopAutoSync();
    const ms = Math.max(1, intervalMinutes) * 60 * 1000;
    this.autoSyncTimer = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.executeSync().catch(() => {});
      }
    }, ms);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && navigator.onLine && !this.isSyncing) {
          this.executeSync().catch(() => {});
        }
      });
    }
  }

  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }
}

export const syncEngine = new DecentralizedSyncEngine();
