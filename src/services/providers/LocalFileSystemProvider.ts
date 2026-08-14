import { SyncProvider, MasterDatabasePayload } from '../syncTypes';

const IDB_HANDLE_DB = 'ieba_fs_handles';
const IDB_HANDLE_STORE = 'handles';
const MASTER_FILENAME = 'cotizador_ieba_master.json';

/**
 * Helper para almacenar y recuperar FileSystemHandle en IndexedDB nativo
 */
function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_HANDLE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStoredFileHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_HANDLE_STORE, 'readonly');
      const store = tx.objectStore(IDB_HANDLE_STORE);
      const req = store.get('master_file_handle');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveStoredFileHandle(handle: FileSystemFileHandle): Promise<void> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_HANDLE_STORE, 'readwrite');
      const store = tx.objectStore(IDB_HANDLE_STORE);
      const req = store.put(handle, 'master_file_handle');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[FSProvider] No se pudo guardar handle en IndexedDB:', e);
  }
}

async function clearStoredFileHandle(): Promise<void> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_HANDLE_STORE, 'readwrite');
      const store = tx.objectStore(IDB_HANDLE_STORE);
      const req = store.delete('master_file_handle');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export class LocalFileSystemProvider implements SyncProvider {
  readonly type = 'local_file' as const;
  readonly name = 'Carpeta / Archivo Local (File System Access API)';
  private fileHandle: FileSystemFileHandle | null = null;
  private fileName: string = MASTER_FILENAME;

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  }

  async connect(): Promise<boolean> {
    if (!('showSaveFilePicker' in window)) {
      throw new Error('Tu navegador no soporta la File System Access API. Utiliza Google Drive o Respaldo Manual.');
    }

    try {
      // Intentar recuperar handle previo
      const savedHandle = await getStoredFileHandle();
      if (savedHandle) {
        // Verificar permisos
        const opts = { mode: 'readwrite' as const };
        if ((await (savedHandle as any).queryPermission(opts)) === 'granted' ||
            (await (savedHandle as any).requestPermission(opts)) === 'granted') {
          this.fileHandle = savedHandle;
          this.fileName = savedHandle.name;
          return true;
        }
      }

      // Si no hay o expiró permiso, abrir diálogo de selección de archivo maestro
      const pickerOpts = {
        suggestedName: MASTER_FILENAME,
        types: [
          {
            description: 'Archivo Maestro de Cotizador IEBA (.json)',
            accept: { 'application/json': ['.json'] }
          }
        ]
      };

      const handle = await (window as any).showSaveFilePicker(pickerOpts);
      this.fileHandle = handle;
      this.fileName = handle.name;
      await saveStoredFileHandle(handle);
      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return false;
      }
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.fileHandle = null;
    await clearStoredFileHandle();
  }

  async readMasterPayload(): Promise<MasterDatabasePayload | null> {
    if (!this.fileHandle) {
      const saved = await getStoredFileHandle();
      if (saved) this.fileHandle = saved;
    }

    if (!this.fileHandle) return null;

    try {
      const file = await this.fileHandle.getFile();
      const text = await file.text();
      if (!text || text.trim().length === 0) return null;
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && parsed.categoriasMaterial) {
        return parsed as MasterDatabasePayload;
      }
      return null;
    } catch (err) {
      console.warn('[FSProvider] No se pudo leer el archivo maestro o está vacío:', err);
      return null;
    }
  }

  async writeMasterPayload(payload: MasterDatabasePayload): Promise<boolean> {
    if (!this.fileHandle) {
      const ok = await this.connect();
      if (!ok || !this.fileHandle) return false;
    }

    try {
      const writable = await (this.fileHandle as any).createWritable();
      const jsonStr = JSON.stringify(payload, null, 2);
      await writable.write(jsonStr);
      await writable.close();
      return true;
    } catch (err) {
      console.error('[FSProvider] Error al escribir archivo maestro en disco:', err);
      throw err;
    }
  }

  getStatus(): { isConfigured: boolean; label: string; details?: string } {
    return {
      isConfigured: this.fileHandle !== null,
      label: this.fileHandle ? `Vinculado: ${this.fileName}` : 'No vinculado a archivo local',
      details: this.fileHandle
        ? 'Sincronización transparente activa en disco local / Dropbox / Drive.'
        : 'Haz clic en Configurar para seleccionar tu archivo de sincronización.'
    };
  }
}
