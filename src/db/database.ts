import Dexie, { type Table } from 'dexie';
import {
  CategoriaMaterial,
  Material,
  Producto,
  Oferta,
  SolicitudCotizacion,
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
  INITIAL_CATEGORIAS_MATERIAL
} from '../core/sampleData';

export class CotizadorDatabase extends Dexie {
  categoriasMaterial!: Table<CategoriaMaterial, string>;
  materiales!: Table<Material, string>;
  productos!: Table<Producto, string>;
  ofertas!: Table<Oferta, string>;
  solicitudesCotizacion!: Table<SolicitudCotizacion, string>;

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

    this.version(2).stores({
      categoriasMaterial: 'id, nombre',
      materiales: 'id, categoriaId, nombre, activo',
      productos: 'id, materialId, marca, esPreferido',
      ofertas: 'id, materialId, productoId, proveedorId, fecha, fuente',
      solicitudesCotizacion: 'id, proveedorId, estado, fechaCreacion',

      insumos: 'id, nombre, categoria, codigoProveedor',
      manoObra: 'id, nombre',
      costosIndirectos: 'id, nombre, tipo',
      tareasTipo: 'id, nombre, categoria',
      clientes: 'id, nombre, cuitDni',
      proveedores: 'id, razonSocial, nombre, cuit',
      proyectos: 'id, clienteId, nombre',
      presupuestos: 'id, numero, clienteId, estado, fechaEmision',
      registrosTrabajo: 'id, presupuestoId, tareaTipoId, fecha',
      config: 'id'
    });

    this.version(3).stores({
      categoriasMaterial: 'id, nombre',
      materiales: 'id, categoriaId, nombre, activo, syncStatus',
      productos: 'id, materialId, marca, esPreferido, syncStatus',
      ofertas: 'id, materialId, productoId, proveedorId, fecha, fuente, syncStatus',
      solicitudesCotizacion: 'id, proveedorId, estado, fechaCreacion, syncStatus',

      insumos: 'id, nombre, categoria, codigoProveedor, syncStatus',
      manoObra: 'id, nombre, syncStatus',
      costosIndirectos: 'id, nombre, tipo, syncStatus',
      tareasTipo: 'id, nombre, categoria, syncStatus',
      clientes: 'id, nombre, cuitDni, syncStatus',
      proveedores: 'id, razonSocial, nombre, cuit, syncStatus',
      proyectos: 'id, clienteId, nombre, syncStatus',
      presupuestos: 'id, numero, clienteId, estado, fechaEmision, syncStatus',
      registrosTrabajo: 'id, presupuestoId, tareaTipoId, fecha, syncStatus',
      config: 'id, syncStatus'
    });
  }
}

export const db = new CotizadorDatabase();

/**
 * Inicializa la base de datos con los datos semillas por defecto si está vacía.
 */
export async function initializeDatabaseSeed(): Promise<void> {
  try {
    await db.transaction('rw', [
      db.categoriasMaterial,
      db.materiales,
      db.productos,
      db.ofertas,
      db.insumos,
      db.manoObra,
      db.costosIndirectos,
      db.tareasTipo,
      db.clientes,
      db.proveedores,
      db.config
    ], async () => {
      // 1. Asegurar que todas las categorías semillas de bdDefault.json existan y tengan sus atributosSugeridos actualizados
      for (const cat of INITIAL_CATEGORIAS_MATERIAL) {
        await db.categoriasMaterial.put(cat);
      }

      // 2. Mapear y corregir materiales existentes con IDs de categoría antiguos o no coincidentes
      const categoryMapping: Record<string, string> = {
        'cableado': 'cat-cables',
        'cables': 'cat-cables',
        'protecciones': 'cat-protecciones',
        'canalizaciones': 'cat-canalizaciones',
        'cajas': 'cat-cajas',
        'tableros': 'cat-tableros',
        'iluminacion': 'cat-iluminacion',
        'medicion': 'cat-medicion',
        'accesorios': 'cat-accesorios',
        'insumos': 'cat-accesorios'
      };

      const allCats = await db.categoriasMaterial.toArray();
      const validCatIds = new Set(allCats.map(c => c.id));

      const mats = await db.materiales.toArray();
      for (const m of mats) {
        let updated = false;
        let newCatId = m.categoriaId;

        if (categoryMapping[m.categoriaId]) {
          newCatId = categoryMapping[m.categoriaId];
          updated = true;
        } else if (!validCatIds.has(m.categoriaId)) {
          newCatId = 'cat-sin-categoria';
          updated = true;
        }

        if (updated) {
          await db.materiales.update(m.id, { categoriaId: newCatId });
        }
      }

      // 3. Inicializar configuración por defecto si la base está vacía
      if (await db.config.count() === 0) await db.config.add(DEFAULT_APP_CONFIG);
    });
    console.log('Verificación e inicialización de semillas de BD completada.');
  } catch (err) {
    console.error('Error al inicializar semillas de BD:', err);
  }
}

/**
 * Exporta toda la base de datos local a un archivo JSON.
 */
export async function exportDatabaseJSON(): Promise<string> {
  const data = {
    categoriasMaterial: await db.categoriasMaterial.toArray(),
    materiales: await db.materiales.toArray(),
    productos: await db.productos.toArray(),
    ofertas: await db.ofertas.toArray(),
    solicitudesCotizacion: await db.solicitudesCotizacion.toArray(),
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
    db.categoriasMaterial,
    db.materiales,
    db.productos,
    db.ofertas,
    db.solicitudesCotizacion,
    db.insumos,
    db.manoObra,
    db.costosIndirectos,
    db.tareasTipo,
    db.clientes,
    db.proveedores,
    db.proyectos,
    db.presupuestos,
    db.registrosTrabajo,
    db.config
  ], async () => {
    if (data.categoriasMaterial) { await db.categoriasMaterial.clear(); await db.categoriasMaterial.bulkAdd(data.categoriasMaterial); }
    if (data.materiales) { await db.materiales.clear(); await db.materiales.bulkAdd(data.materiales); }
    if (data.productos) { await db.productos.clear(); await db.productos.bulkAdd(data.productos); }
    if (data.ofertas) { await db.ofertas.clear(); await db.ofertas.bulkAdd(data.ofertas); }
    if (data.solicitudesCotizacion) { await db.solicitudesCotizacion.clear(); await db.solicitudesCotizacion.bulkAdd(data.solicitudesCotizacion); }
    if (data.insumos) { await db.insumos.clear(); await db.insumos.bulkAdd(data.insumos); }
    if (data.manoObra) { await db.manoObra.clear(); await db.manoObra.bulkAdd(data.manoObra); }
    if (data.costosIndirectos) { await db.costosIndirectos.clear(); await db.costosIndirectos.bulkAdd(data.costosIndirectos); }
    if (data.tareasTipo) { await db.tareasTipo.clear(); await db.tareasTipo.bulkAdd(data.tareasTipo); }
    if (data.clientes) { await db.clientes.clear(); await db.clientes.bulkAdd(data.clientes); }
    if (data.proveedores) { await db.proveedores.clear(); await db.proveedores.bulkAdd(data.proveedores); }
    if (data.proyectos) { await db.proyectos.clear(); await db.proyectos.bulkAdd(data.proyectos); }
    if (data.presupuestos) { await db.presupuestos.clear(); await db.presupuestos.bulkAdd(data.presupuestos); }
    if (data.registrosTrabajo) { await db.registrosTrabajo.clear(); await db.registrosTrabajo.bulkAdd(data.registrosTrabajo); }
    if (data.config) { await db.config.clear(); await db.config.bulkAdd(data.config); }
  });
}

/**
 * Importa insumos/materiales en lote desde una cadena CSV.
 */
export async function importInsumosCSV(csvText: string): Promise<number> {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return 0;

  const now = new Date().toISOString();
  const newInsumos: Insumo[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 4) {
      const nombre = cols[0];
      const unidad = cols[1] || 'u';
      const categoria = cols[2] || 'general';
      const precioActual = parseFloat(cols[3]) || 0;
      const codigoProveedor = cols[4] || undefined;

      newInsumos.push({
        id: `ins-csv-${crypto.randomUUID()}`,
        categoriaId: categoria,
        nombre,
        unidadVenta: unidad,
        atributos: [],
        activo: true,
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
 */
export async function importProveedoresCSV(csvText: string): Promise<number> {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return 0;

  const newProveedores: Proveedor[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 1) {
      const razonSocial = cols[0];
      newProveedores.push({
        id: `prov-csv-${crypto.randomUUID()}`,
        razonSocial,
        nombre: razonSocial,
        cuit: cols[1] || undefined,
        tipoProveedor: 'material',
        contactos: [
          {
            id: crypto.randomUUID(),
            nombrePersona: cols[4] || 'Contacto Principal',
            canales: [
              ...(cols[2] ? [{ tipo: 'telefono' as const, valor: cols[2], esPrincipal: true }] : []),
              ...(cols[3] ? [{ tipo: 'email' as const, valor: cols[3], esPrincipal: false }] : [])
            ]
          }
        ],
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
