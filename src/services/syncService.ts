import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { dbFirestore } from '../config/firebase';
import { db } from '../db/database';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline' | 'quota_exceeded';

const SYNCED_TABLES = [
  'presupuestos',
  'insumos',
  'manoObra',
  'costosIndirectos',
  'tareasTipo',
  'clientes',
  'proveedores',
  'registrosTrabajo',
  'config'
] as const;

type TableName = typeof SYNCED_TABLES[number];

let activeListeners: Unsubscribe[] = [];
let currentUserId: string | null = null;
let isApplyingRemoteChange = false;
let isQuotaExceededSession = false;

/**
 * Checks if an error is a Firebase Firestore Quota Exceeded error.
 */
export function isQuotaError(err: any): boolean {
  if (!err) return false;
  return (
    err.code === 'resource-exhausted' ||
    err.status === 'RESOURCE_EXHAUSTED' ||
    (typeof err.message === 'string' && (
      err.message.includes('Quota exceeded') ||
      err.message.includes('resource-exhausted') ||
      err.message.includes('quota') ||
      err.message.includes('Quota')
    ))
  );
}

export function resetQuotaExceededState(): void {
  isQuotaExceededSession = false;
}

/**
 * Retorna una marca de tiempo numérico para comparar reciencia de registros.
 */
function getItemTimestamp(item: any): number {
  if (!item) return 0;
  if (item._updatedAt && typeof item._updatedAt === 'number') return item._updatedAt;
  const dateStr = item.fechaModificacion || item.fechaActualizacion || item.fechaEmision || item.fecha;
  if (dateStr) {
    const time = new Date(dateStr).getTime();
    if (!isNaN(time)) return time;
  }
  return 0;
}

/**
 * Envía una adición o actualización local hacia Firestore inmediatamente.
 */
async function pushToFirestore(userId: string, tableName: string, id: string, data: any): Promise<void> {
  if (isQuotaExceededSession) return;
  const firestore = dbFirestore;
  if (!firestore || !userId || isApplyingRemoteChange) return;

  try {
    const docRef = doc(firestore, 'users', userId, tableName, id);
    const timeNow = Date.now();
    const payload = {
      ...data,
      _updatedAt: timeNow,
      _syncedAt: new Date().toISOString()
    };
    await setDoc(docRef, payload, { merge: true });
  } catch (err: any) {
    console.warn(`[Sync] Error al subir ${tableName}/${id} a Firestore:`, err);
    if (isQuotaError(err)) {
      isQuotaExceededSession = true;
      stopRealtimeSync();
    }
  }
}

/**
 * Elimina un registro en Firestore cuando se borra localmente en Dexie.
 */
async function deleteFromFirestore(userId: string, tableName: string, id: string): Promise<void> {
  if (isQuotaExceededSession) return;
  const firestore = dbFirestore;
  if (!firestore || !userId || isApplyingRemoteChange) return;

  try {
    const docRef = doc(firestore, 'users', userId, tableName, id);
    await deleteDoc(docRef);
  } catch (err: any) {
    console.warn(`[Sync] Error al eliminar ${tableName}/${id} en Firestore:`, err);
    if (isQuotaError(err)) {
      isQuotaExceededSession = true;
      stopRealtimeSync();
    }
  }
}

/**
 * Registra ganchos (hooks) en Dexie para interceptar cualquier alta, edición o baja local en tiempo real.
 */
export function setupDexieHooks(userId: string | null): void {
  currentUserId = userId;
  if (!userId) return;

  SYNCED_TABLES.forEach((tableName) => {
    const table = (db as any)[tableName];
    if (!table || table._syncHooksAttached) return;

    table.hook('creating', (primKey: any, obj: any) => {
      if (currentUserId && !isApplyingRemoteChange && !isQuotaExceededSession) {
        const id = String(primKey || obj.id);
        pushToFirestore(currentUserId, tableName, id, obj);
      }
    });

    table.hook('updating', (modifications: any, primKey: any, obj: any) => {
      if (currentUserId && !isApplyingRemoteChange && !isQuotaExceededSession) {
        const id = String(primKey || obj.id);
        const updatedObj = { ...obj, ...modifications };
        pushToFirestore(currentUserId, tableName, id, updatedObj);
      }
    });

    table.hook('deleting', (primKey: any) => {
      if (currentUserId && !isApplyingRemoteChange && !isQuotaExceededSession) {
        const id = String(primKey);
        deleteFromFirestore(currentUserId, tableName, id);
      }
    });

    table._syncHooksAttached = true;
  });
}

/**
 * Realiza la sincronización bidireccional inicial completa entre Dexie (IndexedDB) y Cloud Firestore.
 */
export async function syncUserData(userId: string): Promise<void> {
  if (isQuotaExceededSession) {
    throw { code: 'resource-exhausted', message: 'Quota exceeded' };
  }
  const firestore = dbFirestore;
  if (!firestore || !userId) return;

  setupDexieHooks(userId);

  for (const tableName of SYNCED_TABLES) {
    try {
      const dexieTable = (db as any)[tableName];
      if (!dexieTable) continue;

      const localItems: any[] = await dexieTable.toArray();
      const localMap = new Map<string, any>(localItems.map((item) => [String(item.id), item]));

      const colRef = collection(firestore, 'users', userId, tableName);
      const snapshot = await getDocs(colRef);
      const remoteMap = new Map<string, any>();

      snapshot.forEach((docSnap) => {
        remoteMap.set(docSnap.id, docSnap.data());
      });

      // 1. Subir a Firestore datos locales faltantes o más recientes
      for (const [id, localItem] of localMap.entries()) {
        const remoteItem = remoteMap.get(id);
        const localTime = getItemTimestamp(localItem);
        const remoteTime = getItemTimestamp(remoteItem);

        if (!remoteItem || localTime > remoteTime) {
          await pushToFirestore(userId, tableName, id, localItem);
        }
      }

      // 2. Aplicar en Dexie datos remotos de Firestore faltantes o más recientes
      isApplyingRemoteChange = true;
      try {
        for (const [id, remoteItem] of remoteMap.entries()) {
          const localItem = localMap.get(id);
          const localTime = getItemTimestamp(localItem);
          const remoteTime = getItemTimestamp(remoteItem);

          if (!localItem || remoteTime > localTime) {
            const cleanItem = { ...remoteItem };
            delete cleanItem._syncedAt;
            await dexieTable.put(cleanItem);
          }
        }
      } finally {
        isApplyingRemoteChange = false;
      }
    } catch (err: any) {
      console.warn(`[Sync] Error al sincronizar la tabla ${tableName}:`, err);
      if (isQuotaError(err)) {
        isQuotaExceededSession = true;
        stopRealtimeSync();
        throw err;
      }
    }
  }
}

/**
 * Escucha cambios en tiempo real (onSnapshot) desde Firestore y los aplica en Dexie.
 */
export function startRealtimeSync(
  userId: string,
  onUpdate?: () => void,
  onError?: (err: any) => void
): () => void {
  stopRealtimeSync();

  if (isQuotaExceededSession) {
    if (onError) onError({ code: 'resource-exhausted', message: 'Quota exceeded' });
    return () => {};
  }

  const firestore = dbFirestore;
  if (!firestore || !userId) return () => {};

  setupDexieHooks(userId);

  SYNCED_TABLES.forEach((tableName) => {
    try {
      const colRef = collection(firestore, 'users', userId, tableName);
      const unsub = onSnapshot(
        colRef,
        (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            const data = change.doc.data();
            const id = change.doc.id;
            const dexieTable = (db as any)[tableName];
            if (!dexieTable) return;

            if (change.type === 'added' || change.type === 'modified') {
              const cleanData = { ...data };
              delete cleanData._syncedAt;

              const existing = await dexieTable.get(id);
              const localTime = getItemTimestamp(existing);
              const remoteTime = getItemTimestamp(cleanData);

              if (!existing || remoteTime >= localTime) {
                isApplyingRemoteChange = true;
                try {
                  await dexieTable.put(cleanData);
                  if (onUpdate) onUpdate();
                } finally {
                  isApplyingRemoteChange = false;
                }
              }
            } else if (change.type === 'removed') {
              isApplyingRemoteChange = true;
              try {
                await dexieTable.delete(id);
                if (onUpdate) onUpdate();
              } finally {
                isApplyingRemoteChange = false;
              }
            }
          });
        },
        (err) => {
          console.warn(`[Sync] Error en escucha en tiempo real para ${tableName}:`, err);
          if (isQuotaError(err)) {
            isQuotaExceededSession = true;
            stopRealtimeSync();
            if (onError) onError(err);
          } else if (onError) {
            onError(err);
          }
        }
      );

      activeListeners.push(unsub);
    } catch (err: any) {
      console.warn(`[Sync] Error al iniciar escucha para ${tableName}:`, err);
      if (isQuotaError(err)) {
        isQuotaExceededSession = true;
        stopRealtimeSync();
        if (onError) onError(err);
      }
    }
  });

  return stopRealtimeSync;
}

export function stopRealtimeSync(): void {
  activeListeners.forEach((unsub) => {
    try {
      unsub();
    } catch {
      // ignore
    }
  });
  activeListeners = [];
  currentUserId = null;
}

