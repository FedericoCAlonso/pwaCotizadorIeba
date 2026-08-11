import Dexie, { type Table } from 'dexie';
import {
  Insumo,
  CategoriaManoDeObra,
  CostoIndirecto,
  TareaTipo,
  Cliente,
  Proveedor,
  Proyecto,
  Presupuesto,
  RegistroTrabajo,
  AppConfig
} from '../core/types';
import {
  DEFAULT_APP_CONFIG,
  INITIAL_INSUMOS,
  INITIAL_MANO_OBRA,
  INITIAL_COSTOS_INDIRECTOS,
  INITIAL_TAREAS_TIPO,
  INITIAL_CLIENTES,
  INITIAL_PROVEEDORES
} from '../core/sampleData';

export class CotizadorDatabase extends Dexie {
  insumos!: Table<Insumo, string>;
  manoObra!: Table<CategoriaManoDeObra, string>;
  costosIndirectos!: Table<CostoIndirecto, string>;
  tareasTipo!: Table<TareaTipo, string>;
  clientes!: Table<Cliente, string>;
  proveedores!: Table<Proveedor, string>;
  proyectos!: Table<Proyecto, string>;
  presupuestos!: Table<Presupuesto, string>;
  registrosTrabajo!: Table<RegistroTrabajo, string>;
  config!: Table<AppConfig, string>;

  constructor() {
    super('CotizadorIebaDB');
    this.version(1).stores({
      insumos: 'id, nombre, categoria, codigoProveedor',
      manoObra: 'id, nombre',
      costosIndirectos: 'id, nombre, tipo',
      tareasTipo: 'id, nombre, categoria',
      clientes: 'id, nombre, cuitDni',
      proveedores: 'id, nombre, cuit',
      proyectos: 'id, clienteId, nombre',
      presupuestos: 'id, numero, clienteId, estado, fechaEmision',
      registrosTrabajo: 'id, presupuestoId, tareaTipoId, fecha',
      config: 'id'
    });
  }
}

export const db = new CotizadorDatabase();

/**
 * Inicializa la base de datos con los datos semillas por defecto si está vacía.
 */
export async function initializeDatabaseSeed(): Promise<void> {
  try {
    const configCount = await db.config.count();
    // Solo inicializar si la tabla de config está vacía (indicador de primera vez real)
    if (configCount === 0) {
      await db.transaction('rw', [
        db.insumos,
        db.manoObra,
        db.costosIndirectos,
        db.tareasTipo,
        db.clientes,
        db.proveedores,
        db.config
      ], async () => {
        if (await db.insumos.count() === 0) await db.insumos.bulkAdd(INITIAL_INSUMOS);
        if (await db.manoObra.count() === 0) await db.manoObra.bulkAdd(INITIAL_MANO_OBRA);
        if (await db.costosIndirectos.count() === 0) await db.costosIndirectos.bulkAdd(INITIAL_COSTOS_INDIRECTOS);
        if (await db.tareasTipo.count() === 0) await db.tareasTipo.bulkAdd(INITIAL_TAREAS_TIPO);
        if (await db.clientes.count() === 0) await db.clientes.bulkAdd(INITIAL_CLIENTES);
        if (await db.proveedores.count() === 0) await db.proveedores.bulkAdd(INITIAL_PROVEEDORES);
        if (await db.config.count() === 0) await db.config.add(DEFAULT_APP_CONFIG);
      });
      console.log('Base de datos inicializada con semillas IEBA correctamente.');
    }
  } catch (err) {
    console.error('Error al inicializar semillas de BD:', err);
  }
}

/**
 * Exporta toda la base de datos local a un archivo JSON.
 */
export async function exportDatabaseJSON(): Promise<string> {
  const data = {
    insumos: await db.insumos.toArray(),
    manoObra: await db.manoObra.toArray(),
    costosIndirectos: await db.costosIndirectos.toArray(),
    tareasTipo: await db.tareasTipo.toArray(),
    clientes: await db.clientes.toArray(),
    proveedores: await db.proveedores.toArray(),
    proyectos: await db.proyectos.toArray(),
    presupuestos: await db.presupuestos.toArray(),
    registrosTrabajo: await db.registrosTrabajo.toArray(),
    config: await db.config.toArray(),
    exportDate: new Date().toISOString()
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Restaura toda la base de datos local desde un JSON.
 */
export async function importDatabaseJSON(jsonStr: string): Promise<void> {
  const data = JSON.parse(jsonStr);
  await db.transaction('rw', [
    db.insumos,
    db.manoObra,
    db.costosIndirectos,
    db.tareasTipo,
    db.clientes,
    db.proyectos,
    db.presupuestos,
    db.registrosTrabajo,
    db.config
  ], async () => {
    if (data.insumos) { await db.insumos.clear(); await db.insumos.bulkAdd(data.insumos); }
    if (data.manoObra) { await db.manoObra.clear(); await db.manoObra.bulkAdd(data.manoObra); }
    if (data.costosIndirectos) { await db.costosIndirectos.clear(); await db.costosIndirectos.bulkAdd(data.costosIndirectos); }
    if (data.tareasTipo) { await db.tareasTipo.clear(); await db.tareasTipo.bulkAdd(data.tareasTipo); }
    if (data.clientes) { await db.clientes.clear(); await db.clientes.bulkAdd(data.clientes); }
    if (data.proyectos) { await db.proyectos.clear(); await db.proyectos.bulkAdd(data.proyectos); }
    if (data.presupuestos) { await db.presupuestos.clear(); await db.presupuestos.bulkAdd(data.presupuestos); }
    if (data.registrosTrabajo) { await db.registrosTrabajo.clear(); await db.registrosTrabajo.bulkAdd(data.registrosTrabajo); }
    if (data.config) { await db.config.clear(); await db.config.bulkAdd(data.config); }
  });
}

/**
 * Importa insumos en lote desde una cadena CSV.
 * Formato CSV: nombre,marca,modelo,unidad,categoria,precioActual,codigoProveedor
 */
export async function importInsumosCSV(csvText: string): Promise<number> {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return 0;

  // Asumimos primera linea es encabezado
  const now = new Date().toISOString();
  const newInsumos: Insumo[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 6) { // Expecting at least 6 to match the new format somewhat
      const nombre = cols[0];
      const marca = cols[1] || undefined;
      const modelo = cols[2] || undefined;
      const unidad = cols[3] || 'u';
      const categoria = cols[4] || 'general';
      const precioActual = parseFloat(cols[5]) || 0;
      const codigoProveedor = cols[6] || undefined;

      newInsumos.push({
        id: `ins-csv-${crypto.randomUUID()}`,
        nombre,
        marca,
        modelo,
        unidad,
        categoria,
        precioActual,
        fechaActualizacion: now,
        codigoProveedor,
        historialPrecios: [{ fecha: now, precio: precioActual, fuente: 'Importación CSV' }],
        ofertas: []
      });
    } else if (cols.length >= 4) { // Fallback for old CSV format without marca/modelo
      const nombre = cols[0];
      const unidad = cols[1] || 'u';
      const categoria = cols[2] || 'general';
      const precioActual = parseFloat(cols[3]) || 0;
      const codigoProveedor = cols[4] || undefined;

      newInsumos.push({
        id: `ins-csv-${crypto.randomUUID()}`,
        nombre,
        unidad,
        categoria,
        precioActual,
        fechaActualizacion: now,
        codigoProveedor,
        historialPrecios: [{ fecha: now, precio: precioActual, fuente: 'Importación CSV' }],
        ofertas: []
      });
    }
  }

  if (newInsumos.length > 0) {
    await db.insumos.bulkAdd(newInsumos);
  }
  return newInsumos.length;
}

/**
 * Importa proveedores en lote desde una cadena CSV.
 * Formato CSV: nombre,cuit,telefono,email,contacto,direccion,notas
 */
export async function importProveedoresCSV(csvText: string): Promise<number> {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return 0;

  const newProveedores: Proveedor[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 1) {
      newProveedores.push({
        id: `prov-csv-${crypto.randomUUID()}`,
        nombre: cols[0],
        cuit: cols[1] || undefined,
        telefono: cols[2] || undefined,
        email: cols[3] || undefined,
        contacto: cols[4] || undefined,
        direccion: cols[5] || undefined,
        notas: cols[6] || undefined
      });
    }
  }

  if (newProveedores.length > 0) {
    await db.proveedores.bulkAdd(newProveedores);
  }
  return newProveedores.length;
}

/**
 * Importa clientes en lote desde una cadena CSV.
 * Formato CSV: nombre,cuitDni,condicionIVA,telefono,email,direccion,notas
 */
export async function importClientesCSV(csvText: string): Promise<number> {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return 0;

  const newClientes: Cliente[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 1) {
      newClientes.push({
        id: `cli-csv-${crypto.randomUUID()}`,
        nombre: cols[0],
        cuitDni: cols[1] || undefined,
        condicionIVA: (cols[2] as Cliente['condicionIVA']) || undefined,
        telefono: cols[3] || undefined,
        email: cols[4] || undefined,
        direccion: cols[5] || undefined,
        notas: cols[6] || undefined
      });
    }
  }

  if (newClientes.length > 0) {
    await db.clientes.bulkAdd(newClientes);
  }
  return newClientes.length;
}
