import {
  collection,
  doc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { dbFirestore } from '../config/firebase';
import { db } from '../db/database';
import { SyncStatus } from '../core/types';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline' | 'quota_exceeded' | 'pending';

const SYNCED_TABLES = [
  'presupuestos',
  'insumos',
  'manoObra',
  'costosIndirectos',
  'tareasTipo',
  'clientes',
  'proveedores',
  'registrosTrabajo',
  'solicitudesCotizacion',
  'categoriasMaterial',
  'materiales',
  'productos',
  'ofertas',
  'proyectos',
  'config'
] as const;

type TableName = typeof SYNCED_TABLES[number];

let currentUserId: string | null = null;
let isApplyingRemoteChange = false;
let isSyncingActive = false;
let syncLockTimestamp = 0;
let syncIntervalTimer: any = null;
let visibilityListenerAttached = false;

const CIRCUIT_BREAKER_KEY = 'ieba_sync_blocked_until';
const SYNC_LOCK_TIMEOUT_MS = 15000; // 15s máximo para evitar deadlocks
const NETWORK_TIMEOUT_MS = 12000; // 12s máximo por llamada a Firestore

/**
 * Envuelve una promesa con un timeout de red realista.
 */
function withTimeout<T>(promise: Promise<T>, ms = NETWORK_TIMEOUT_MS, label = 'Operación de red'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout de conexión (${ms / 1000}s) en: ${label}`));
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Detecta si el lock de sincronización está activo y no ha expirado.
 */
export function isSyncLocked(): boolean {
  if (!isSyncingActive) return false;
  if (Date.now() - syncLockTimestamp > SYNC_LOCK_TIMEOUT_MS) {
    console.warn('[DeltaSync] Lock de sincronización expirado (>15s). Reseteando estado.');
    isSyncingActive = false;
    syncLockTimestamp = 0;
    return false;
  }
  return true;
}

/**
 * Libera manualmente cualquier bloqueo de sincronización.
 */
export function resetSyncLock(): void {
  isSyncingActive = false;
  syncLockTimestamp = 0;
}

/**
 * Detecta si un error proviene genuinamente del agotamiento de cuota diaria de Firebase Spark.
 * NO confunde timeouts locales de red con cuota agotada.
 */
export function isQuotaError(err: any): boolean {
  if (!err) return false;
  const code = err.code || err.status || '';
  const message = typeof err.message === 'string' ? err.message : '';

  return (
    code === 'resource-exhausted' ||
    code === 'RESOURCE_EXHAUSTED' ||
    (message.includes('Quota exceeded') && !message.includes('Timeout')) ||
    (message.includes('RESOURCE_EXHAUSTED') && !message.includes('timeout'))
  );
}

/**
 * Detecta si el error es por falta de permisos / reglas en Firestore.
 */
export function isPermissionError(err: any): boolean {
  if (!err) return false;
  const code = err.code || err.status || '';
  const message = typeof err.message === 'string' ? err.message : '';
  return code === 'permission-denied' || message.includes('Missing or insufficient permissions');
}

/**
 * Verifica si el Circuit Breaker de cuota está activo.
 */
export function isCircuitBreakerActive(): boolean {
  try {
    const blockedUntilStr = localStorage.getItem(CIRCUIT_BREAKER_KEY);
    if (!blockedUntilStr) return false;
    const blockedUntil = parseInt(blockedUntilStr, 10);
    if (isNaN(blockedUntil)) {
      localStorage.removeItem(CIRCUIT_BREAKER_KEY);
      return false;
    }

    if (Date.now() < blockedUntil) {
      return true;
    } else {
      localStorage.removeItem(CIRCUIT_BREAKER_KEY);
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Activa el Circuit Breaker bloqueando intentos automáticos durante 1 hora si la cuota fue superada.
 */
export function activateCircuitBreaker(durationMs = 60 * 60 * 1000): void {
  try {
    const blockedUntil = Date.now() + durationMs;
    localStorage.setItem(CIRCUIT_BREAKER_KEY, String(blockedUntil));
  } catch (err) {
    console.warn('[Sync] No se pudo guardar timestamp de Circuit Breaker:', err);
  }
}

/**
 * Desbloquea manualmente el Circuit Breaker para forzar reintento inmediato.
 */
export function resetQuotaExceededState(): void {
  try {
    localStorage.removeItem(CIRCUIT_BREAKER_KEY);
    resetSyncLock();
  } catch (err) {
    console.warn('[Sync] Error al reiniciar estado de cuota:', err);
  }
}

/**
 * Configura los ganchos (hooks) de Dexie para control de cambios ligero (Dirty Flags).
 */
export function setupDexieHooks(userId: string | null): void {
  currentUserId = userId;
  if (!userId) return;

  SYNCED_TABLES.forEach((tableName) => {
    const table = (db as any)[tableName];
    if (!table || table._syncHooksAttached) return;

    table.hook('creating', (_primKey: any, obj: any) => {
      if (!isApplyingRemoteChange) {
        obj.syncStatus = obj.syncStatus || 'pending_insert';
        obj._updatedAt = Date.now();
      }
    });

    table.hook('updating', (modifications: any, _primKey: any, obj: any) => {
      if (!isApplyingRemoteChange) {
        const currentStatus: SyncStatus = obj.syncStatus || 'synced';
        if (currentStatus === 'synced') {
          modifications.syncStatus = 'pending_update';
        }
        modifications._updatedAt = Date.now();
      }
    });

    table._syncHooksAttached = true;
  });
}

/**
 * Marcado lógico de borrado (Soft Delete) o eliminación física para registros sin sincronizar.
 */
export async function softDeleteRecord(tableName: TableName, id: string): Promise<void> {
  const table = (db as any)[tableName];
  if (!table) return;

  const item = await table.get(id);
  if (!item) return;

  if (item.syncStatus === 'pending_insert') {
    await table.delete(id);
  } else {
    await table.update(id, {
      syncStatus: 'pending_delete',
      _updatedAt: Date.now()
    });
  }
}

/**
 * Cuenta la cantidad total de registros locales pendientes de sincronización.
 */
export async function getPendingSyncCount(): Promise<number> {
  let count = 0;
  for (const tableName of SYNCED_TABLES) {
    const table = (db as any)[tableName];
    if (!table) continue;
    try {
      const items = await table.toArray();
      const pending = items.filter((item: any) => !item.syncStatus || item.syncStatus !== 'synced');
      count += pending.length;
    } catch {
      // Fallback
    }
  }
  return count;
}

/**
 * Motor Delta Sync: Envía lotes (writeBatch) a Firestore únicamente con registros modificados o sin sincronizar.
 */
export async function flushPendingSync(userId: string): Promise<SyncState> {
  if (!navigator.onLine) return 'offline';
  if (isCircuitBreakerActive()) return 'quota_exceeded';
  if (isSyncLocked()) return 'syncing';

  const firestore = dbFirestore;
  if (!firestore || !userId) return 'idle';

  isSyncingActive = true;
  syncLockTimestamp = Date.now();

  try {
    const pendingOps: { tableName: TableName; id: string; status: SyncStatus; data?: any }[] = [];

    // 1. Recolectar registros con Dirty Flags en IndexedDB
    for (const tableName of SYNCED_TABLES) {
      const table = (db as any)[tableName];
      if (!table) continue;

      const allItems: any[] = await table.toArray();
      const dirtyItems = allItems.filter((item: any) => !item.syncStatus || item.syncStatus !== 'synced');

      for (const item of dirtyItems) {
        pendingOps.push({
          tableName,
          id: String(item.id),
          status: (item.syncStatus || 'pending_insert') as SyncStatus,
          data: item
        });
      }
    }

    if (pendingOps.length === 0) {
      return 'synced';
    }

    // 2. Agrupar en batches de Firestore con timeout duro
    const BATCH_SIZE = 400;
    for (let i = 0; i < pendingOps.length; i += BATCH_SIZE) {
      const chunk = pendingOps.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(firestore);

      for (const op of chunk) {
        const docRef = doc(firestore, 'users', userId, op.tableName, op.id);

        if (op.status === 'pending_delete') {
          batch.delete(docRef);
        } else {
          const payload = { ...op.data };
          delete payload.syncStatus;
          payload._syncedAt = new Date().toISOString();
          batch.set(docRef, payload, { merge: true });
        }
      }

      // Envolver commit en timeout duro de 5 segundos
      await withTimeout(batch.commit(), NETWORK_TIMEOUT_MS);

      // 3. Actualizar estado local tras éxito del lote (commit HTTP 200)
      isApplyingRemoteChange = true;
      try {
        for (const op of chunk) {
          const table = (db as any)[op.tableName];
          if (!table) continue;

          if (op.status === 'pending_delete') {
            await table.delete(op.id);
          } else {
            await table.update(op.id, { syncStatus: 'synced' });
          }
        }
      } finally {
        isApplyingRemoteChange = false;
      }
    }

    return 'synced';
  } catch (err: any) {
    console.warn('[DeltaSync] Error al sincronizar lotes con Firestore:', err);

    if (isQuotaError(err)) {
      activateCircuitBreaker();
      return 'quota_exceeded';
    }
    return 'error';
  } finally {
    isSyncingActive = false;
    syncLockTimestamp = 0;
  }
}

/**
 * Realiza la sincronización bidireccional inicial y pull remoto desde Firestore en paralelo.
 */
export async function syncUserData(userId: string): Promise<SyncState> {
  setupDexieHooks(userId);
  const pushState = await flushPendingSync(userId);
  if (pushState !== 'synced' && pushState !== 'idle') {
    return pushState;
  }

  const firestore = dbFirestore;
  if (!firestore || !userId) return pushState;

  isSyncingActive = true;
  syncLockTimestamp = Date.now();

  try {
    // Pull remoto en paralelo para todas las colecciones
    const pullPromises = SYNCED_TABLES.map(async (tableName) => {
      const colRef = collection(firestore, 'users', userId, tableName);
      const snapshot = await withTimeout(getDocs(colRef), NETWORK_TIMEOUT_MS, `Lectura ${tableName}`);
      const table = (db as any)[tableName];
      if (!table) return;

      isApplyingRemoteChange = true;
      try {
        for (const docSnap of snapshot.docs) {
          const remoteData = docSnap.data();
          const localItem = await table.get(docSnap.id);
          if (!localItem) {
            const cleanData: any = { ...remoteData, syncStatus: 'synced' };
            delete cleanData._syncedAt;
            await table.put(cleanData);
          } else if (localItem.syncStatus === 'synced') {
            const remoteTime = remoteData._updatedAt || 0;
            const localTime = localItem._updatedAt || 0;
            if (remoteTime > localTime) {
              const cleanData: any = { ...remoteData, syncStatus: 'synced' };
              delete cleanData._syncedAt;
              await table.put(cleanData);
            }
          }
        }
      } finally {
        isApplyingRemoteChange = false;
      }
    });

    const results = await Promise.allSettled(pullPromises);

    let hasQuotaError = false;
    let hasPermissionError = false;
    let hasOtherError = false;

    for (const res of results) {
      if (res.status === 'rejected') {
        const err = res.reason;
        console.warn('[DeltaSync] Error al leer colección:', err);
        if (isQuotaError(err)) {
          hasQuotaError = true;
        } else if (isPermissionError(err)) {
          hasPermissionError = true;
        } else {
          hasOtherError = true;
        }
      }
    }

    if (hasQuotaError) {
      activateCircuitBreaker();
      return 'quota_exceeded';
    }

    if (hasPermissionError) {
      console.error(
        `[DeltaSync] Permiso denegado en Firestore. Asegúrate de que las reglas de seguridad en Firebase Console permitan lectura y escritura en: match /users/{userId}/{document=**} { allow read, write: if request.auth != null && request.auth.uid == userId; }`
      );
      return 'error';
    }

    if (hasOtherError && pushState !== 'synced') {
      return 'error';
    }

    return 'synced';
  } catch (err: any) {
    if (isQuotaError(err)) {
      activateCircuitBreaker();
      return 'quota_exceeded';
    }
    return 'error';
  } finally {
    isSyncingActive = false;
    syncLockTimestamp = 0;
  }
}

/**
 * Inicia el temporizador (Throttling) y listener de visibilidad para disparos eficientes.
 */
export function startSyncScheduler(userId: string, intervalMinutes = 5): void {
  stopSyncScheduler();
  if (!userId) return;

  const ms = Math.max(1, intervalMinutes) * 60 * 1000;
  syncIntervalTimer = setInterval(() => {
    if (navigator.onLine && !isCircuitBreakerActive() && !isSyncLocked()) {
      flushPendingSync(userId);
    }
  }, ms);

  if (!visibilityListenerAttached) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && navigator.onLine && !isCircuitBreakerActive() && !isSyncLocked()) {
        if (currentUserId) flushPendingSync(currentUserId);
      }
    });
    visibilityListenerAttached = true;
  }
}

/**
 * Detiene el programador de sincronización.
 */
export function stopSyncScheduler(): void {
  if (syncIntervalTimer) {
    clearInterval(syncIntervalTimer);
    syncIntervalTimer = null;
  }
}

/**
 * Compatibilidad con firma anterior para detener realtime sync.
 */
export function stopRealtimeSync(): void {
  stopSyncScheduler();
}

/**
 * Compatibilidad para suscripciones realtime si son solicitadas.
 */
export function startRealtimeSync(
  userId: string,
  _onUpdate?: () => void,
  _onError?: (err: any) => void
): () => void {
  startSyncScheduler(userId, 5);
  return () => stopSyncScheduler();
}
