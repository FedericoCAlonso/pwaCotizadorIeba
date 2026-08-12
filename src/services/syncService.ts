import { collection, doc, getDocs, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { dbFirestore } from '../config/firebase';
import { db } from '../db/database';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

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

let activeListeners: Unsubscribe[] = [];

/**
 * Retorna una marca de tiempo numérico o Date para comparar la reciencia de un registro.
 */
function getItemTimestamp(item: any): number {
  if (!item) return 0;
  const dateStr = item.fechaModificacion || item.fechaActualizacion || item.fechaEmision || item.fecha;
  if (dateStr) {
    const time = new Date(dateStr).getTime();
    if (!isNaN(time)) return time;
  }
  return 0;
}

/**
 * Realiza la sincronización bidireccional completa entre Dexie (IndexedDB) y Firestore.
 */
export async function syncUserData(userId: string): Promise<void> {
  const firestore = dbFirestore;
  if (!firestore || !userId) return;

  for (const tableName of SYNCED_TABLES) {
    try {
      const dexieTable = (db as any)[tableName];
      if (!dexieTable) continue;

      const localItems: any[] = await dexieTable.toArray();
      const localMap = new Map<string, any>(localItems.map((item) => [item.id, item]));

      const colRef = collection(firestore, 'users', userId, tableName);
      const snapshot = await getDocs(colRef);
      const remoteMap = new Map<string, any>();

      snapshot.forEach((docSnap) => {
        remoteMap.set(docSnap.id, docSnap.data());
      });

      // 1. Subir locales faltantes o más nuevos a Firestore
      for (const [id, localItem] of localMap.entries()) {
        const remoteItem = remoteMap.get(id);
        const localTime = getItemTimestamp(localItem);
        const remoteTime = getItemTimestamp(remoteItem);

        if (!remoteItem || localTime > remoteTime) {
          const docRef = doc(firestore, 'users', userId, tableName, id);
          await setDoc(docRef, {
            ...localItem,
            _syncedAt: new Date().toISOString()
          }, { merge: true });
        }
      }

      // 2. Descargar remotos faltantes o más nuevos a Dexie
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
    } catch (err) {
      console.warn(`Error al sincronizar la tabla ${tableName}:`, err);
    }
  }
}

/**
 * Inicia la escucha en tiempo real de cambios remotos en Firestore para multidispositivo.
 */
export function startRealtimeSync(userId: string, onUpdate?: () => void): () => void {
  stopRealtimeSync();

  const firestore = dbFirestore;
  if (!firestore || !userId) return () => {};

  SYNCED_TABLES.forEach((tableName) => {
    try {
      const colRef = collection(firestore, 'users', userId, tableName);
      const unsub = onSnapshot(colRef, (snapshot) => {
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
              await dexieTable.put(cleanData);
              if (onUpdate) onUpdate();
            }
          }
        });
      }, (err) => {
        console.warn(`Error en onSnapshot para ${tableName}:`, err);
      });

      activeListeners.push(unsub);
    } catch (err) {
      console.warn(`Error al iniciar escucha en tiempo real para ${tableName}:`, err);
    }
  });

  return stopRealtimeSync;
}

export function stopRealtimeSync(): void {
  activeListeners.forEach((unsub) => unsub());
  activeListeners = [];
}
