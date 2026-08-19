import { db } from '../db/database';
import { MasterDatabasePayload, MergeStats } from './syncTypes';

const TABLE_NAMES = [
  'categoriasMaterial',
  'materiales',
  'productos',
  'ofertas',
  'solicitudesCotizacion',
  'insumos',
  'manoObra',
  'costosIndirectos',
  'tareasTipo',
  'contactos',
  'clientes',
  'proveedores',
  'proyectos',
  'presupuestos',
  'registrosTrabajo',
  'config'
] as const;

type TableName = typeof TABLE_NAMES[number];

/**
 * Obtiene un timestamp numérico comparable a partir de un registro (updatedAt, fechaModificacion, etc.)
 */
function getRecordTimestamp(item: any): number {
  if (!item) return 0;
  if (item.updatedAt) {
    const t = new Date(item.updatedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (item._updatedAt && typeof item._updatedAt === 'number') {
    return item._updatedAt;
  }
  if (item.fechaModificacion) {
    const t = new Date(item.fechaModificacion).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (item.fechaActualizacion) {
    const t = new Date(item.fechaActualizacion).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (item.createdAt) {
    const t = new Date(item.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
}

/**
 * Exporta el estado completo actual de IndexedDB como un MasterDatabasePayload.
 */
export async function getLocalMasterPayload(): Promise<MasterDatabasePayload> {
  const allContactos = await db.contactos.toArray();
  const cleanClientes = allContactos.filter(c => !c.roles || c.roles.includes('cliente'));
  const cleanProveedores = allContactos.filter(c => c.roles?.includes('proveedor'));

  return {
    version: 1,
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    categoriasMaterial: await db.categoriasMaterial.toArray(),
    materiales: await db.materiales.toArray(),
    productos: await db.productos.toArray(),
    ofertas: await db.ofertas.toArray(),
    solicitudesCotizacion: await db.solicitudesCotizacion.toArray(),
    insumos: await db.insumos.toArray(),
    manoObra: await db.manoObra.toArray(),
    costosIndirectos: await db.costosIndirectos.toArray(),
    tareasTipo: await db.tareasTipo.toArray(),
    contactos: allContactos,
    clientes: cleanClientes,
    proveedores: cleanProveedores,
    proyectos: await db.proyectos.toArray(),
    presupuestos: await db.presupuestos.toArray(),
    registrosTrabajo: await db.registrosTrabajo.toArray(),
    config: await db.config.toArray()
  };
}

/**
 * Ejecuta el algoritmo Last-Write-Wins (LWW) entre la base de datos local y el payload remoto.
 * Aplica los cambios resultantes en IndexedDB y retorna el payload consolidado para subir al Provider.
 */
export async function mergeLastWriteWins(
  remotePayload: MasterDatabasePayload | null
): Promise<{ mergedPayload: MasterDatabasePayload; stats: MergeStats }> {
  const localPayload = await getLocalMasterPayload();
  const stats: MergeStats = {
    tablesProcessed: TABLE_NAMES.length,
    localUpdatedCount: 0,
    localAddedCount: 0,
    remoteNewerCount: 0,
    localNewerCount: 0,
    identicalCount: 0
  };

  // Si no hay payload remoto previo (primer sync), el payload local es el maestro inicial
  if (!remotePayload) {
    return {
      mergedPayload: localPayload,
      stats
    };
  }

  const mergedPayload: Partial<MasterDatabasePayload> = {
    version: 1,
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    trazaProyectos: remotePayload.trazaProyectos || []
  };

  await db.transaction('rw', [
    db.categoriasMaterial,
    db.materiales,
    db.productos,
    db.ofertas,
    db.solicitudesCotizacion,
    db.insumos,
    db.manoObra,
    db.costosIndirectos,
    db.tareasTipo,
    db.contactos,
    db.clientes,
    db.proveedores,
    db.proyectos,
    db.presupuestos,
    db.registrosTrabajo,
    db.config
  ], async () => {
    for (const tableName of TABLE_NAMES) {
      const localItems: any[] = localPayload[tableName] || [];
      const remoteItems: any[] = remotePayload[tableName] || [];

      const localMap = new Map<string, any>(localItems.map(item => [String(item.id), item]));
      const remoteMap = new Map<string, any>(remoteItems.map(item => [String(item.id), item]));

      const allIds = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);
      const mergedList: any[] = [];
      const itemsToUpdateLocally: any[] = [];

      for (const id of allIds) {
        const localItem = localMap.get(id);
        const remoteItem = remoteMap.get(id);

        if (localItem && !remoteItem) {
          // Solo existe localmente -> gana local
          mergedList.push(localItem);
          stats.localNewerCount++;
        } else if (!localItem && remoteItem) {
          // Solo existe remotamente -> gana remoto, guardar en Dexie
          mergedList.push(remoteItem);
          itemsToUpdateLocally.push(remoteItem);
          stats.localAddedCount++;
        } else if (localItem && remoteItem) {
          const localTime = getRecordTimestamp(localItem);
          const remoteTime = getRecordTimestamp(remoteItem);

          if (remoteTime > localTime) {
            // Remoto es más nuevo -> sobreescribe local
            mergedList.push(remoteItem);
            itemsToUpdateLocally.push(remoteItem);
            stats.remoteNewerCount++;
          } else {
            // Local es más nuevo o idéntico -> conserva local
            mergedList.push(localItem);
            if (remoteTime === localTime) {
              stats.identicalCount++;
            } else {
              stats.localNewerCount++;
            }
          }
        }
      }

      // Guardar cambios aplicados en la tabla de Dexie
      if (itemsToUpdateLocally.length > 0) {
        const table = (db as any)[tableName];
        if (table) {
          await table.bulkPut(itemsToUpdateLocally);
          stats.localUpdatedCount += itemsToUpdateLocally.length;
        }
      }

      (mergedPayload as any)[tableName] = mergedList;
    }
  });

  return {
    mergedPayload: mergedPayload as MasterDatabasePayload,
    stats
  };
}
