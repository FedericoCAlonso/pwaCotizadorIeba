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
