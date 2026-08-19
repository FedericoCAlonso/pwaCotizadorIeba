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
  Contacto,
  Cliente,
  Proveedor,
  Proyecto,
  Presupuesto,
  RegistroTrabajo,
  AppConfig
} from '../core/types';
import {
  DEFAULT_APP_CONFIG,
  INITIAL_CATEGORIAS_MATERIAL,
  INITIAL_MATERIALES,
  INITIAL_PRODUCTOS,
  INITIAL_OFERTAS,
  INITIAL_INSUMOS,
  INITIAL_MANO_OBRA,
  INITIAL_COSTOS_INDIRECTOS,
  INITIAL_TAREAS_TIPO,
  INITIAL_CONTACTOS
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
  contactos!: Table<Contacto, string>;
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

    this.version(4).stores({
      categoriasMaterial: 'id, nombre, deleted, updatedAt',
      materiales: 'id, categoriaId, nombre, activo, deleted, updatedAt',
      productos: 'id, materialId, marca, esPreferido, deleted, updatedAt',
      ofertas: 'id, materialId, productoId, proveedorId, fecha, fuente, deleted, updatedAt',
      solicitudesCotizacion: 'id, proveedorId, estado, fechaCreacion, deleted, updatedAt',

      insumos: 'id, nombre, categoria, codigoProveedor, deleted, updatedAt',
      manoObra: 'id, nombre, deleted, updatedAt',
      costosIndirectos: 'id, nombre, tipo, deleted, updatedAt',
      tareasTipo: 'id, nombre, categoria, deleted, updatedAt',
      clientes: 'id, nombre, cuitDni, deleted, updatedAt',
      proveedores: 'id, razonSocial, nombre, cuit, deleted, updatedAt',
      proyectos: 'id, clienteId, nombre, deleted, updatedAt',
      presupuestos: 'id, numero, clienteId, estado, fechaEmision, deleted, updatedAt',
      registrosTrabajo: 'id, presupuestoId, tareaTipoId, fecha, deleted, updatedAt',
      config: 'id, deleted, updatedAt'
    });

    this.version(5).stores({
      categoriasMaterial: 'id, nombre, deleted, updatedAt',
      materiales: 'id, categoriaId, nombre, activo, deleted, updatedAt',
      productos: 'id, materialId, marca, esPreferido, deleted, updatedAt',
      ofertas: 'id, materialId, productoId, proveedorId, fecha, fuente, deleted, updatedAt',
      solicitudesCotizacion: 'id, proveedorId, estado, fechaCreacion, deleted, updatedAt',

      insumos: 'id, nombre, categoria, codigoProveedor, deleted, updatedAt',
      manoObra: 'id, nombre, deleted, updatedAt',
      costosIndirectos: 'id, nombre, tipo, deleted, updatedAt',
      tareasTipo: 'id, nombre, categoria, deleted, updatedAt',
      contactos: 'id, razonSocial, nombre, cuitDni, *roles, tipoProveedor, deleted, updatedAt',
      clientes: 'id, nombre, cuitDni, deleted, updatedAt',
      proveedores: 'id, razonSocial, nombre, cuit, deleted, updatedAt',
      proyectos: 'id, clienteId, nombre, deleted, updatedAt',
      presupuestos: 'id, numero, clienteId, estado, fechaEmision, deleted, updatedAt',
      registrosTrabajo: 'id, presupuestoId, tareaTipoId, fecha, deleted, updatedAt',
      config: 'id, deleted, updatedAt'
    }).upgrade(async (tx) => {
      try {
        const clientes = await tx.table('clientes').toArray();
        const proveedores = await tx.table('proveedores').toArray();
        const contactosTable = tx.table('contactos');

        const map = new Map<string, any>();

        for (const c of clientes) {
          map.set(c.id, {
            id: c.id,
            razonSocial: c.nombre || 'Cliente',
            nombre: c.nombre || 'Cliente',
            cuitDni: c.cuitDni || '',
            condicionIVA: c.condicionIVA || 'Consumidor Final',
            direccion: c.direccion || '',
            telefono: c.telefono || '',
            email: c.email || '',
            roles: ['cliente'],
            contactos: (c.telefono || c.email) ? [{
              id: `ct-${c.id}`,
              nombre: c.nombre || 'Contacto Principal',
              rol: 'Principal',
              telefono: c.telefono || '',
              email: c.email || '',
              esPrincipal: true
            }] : [],
            notas: c.notas || '',
            createdAt: c.createdAt || new Date().toISOString(),
            updatedAt: c.updatedAt || new Date().toISOString(),
            deleted: c.deleted || false
          });
        }

        for (const p of proveedores) {
          if (map.has(p.id)) {
            const existing = map.get(p.id);
            if (!existing.roles.includes('proveedor')) {
              existing.roles.push('proveedor');
            }
            existing.tipoProveedor = p.tipoProveedor || 'material';
            existing.cuitDni = existing.cuitDni || p.cuit;
            if (p.contactos && p.contactos.length > 0) {
              existing.contactos = [...existing.contactos, ...p.contactos];
            }
          } else {
            map.set(p.id, {
              id: p.id,
              razonSocial: p.razonSocial || p.nombre || 'Proveedor',
              nombre: p.razonSocial || p.nombre || 'Proveedor',
              cuitDni: p.cuit || '',
              condicionIVA: 'Responsable Inscripto',
              direccion: p.direccion || '',
              telefono: p.telefono || '',
              email: p.email || '',
              roles: ['proveedor'],
              tipoProveedor: p.tipoProveedor || 'material',
              contactos: p.contactos || ((p.telefono || p.email) ? [{
                id: `ct-${p.id}`,
                nombre: p.contacto || p.razonSocial || 'Contacto',
                rol: 'Ventas',
                telefono: p.telefono || '',
                email: p.email || '',
                esPrincipal: true
              }] : []),
              notas: p.notas || '',
              createdAt: p.createdAt || new Date().toISOString(),
              updatedAt: p.updatedAt || new Date().toISOString(),
              deleted: p.deleted || false
            });
          }
        }

        for (const contacto of map.values()) {
          await contactosTable.put(contacto);
        }
      } catch (e) {
        console.warn('Upgrade a versión 5 (contactos):', e);
      }
    });

    this.version(6).stores({
      contactos: 'id, razonSocial, nombre, cuitDni, *roles, *etiquetas, tipoProveedor, deleted, updatedAt'
    });
  }
}

export const db = new CotizadorDatabase();

/**
 * Realiza un borrado lógico (Tombstone) marcando deleted = true y actualizando updatedAt.
 */
export async function softDelete(
  tableName: 'categoriasMaterial' | 'materiales' | 'productos' | 'ofertas' | 'solicitudesCotizacion' | 'insumos' | 'manoObra' | 'costosIndirectos' | 'tareasTipo' | 'contactos' | 'clientes' | 'proveedores' | 'proyectos' | 'presupuestos' | 'registrosTrabajo' | 'config',
  id: string
): Promise<void> {
  const table = db[tableName] as Table<any, string>;
  if (!table) return;
  const now = new Date().toISOString();
  await table.update(id, {
    deleted: true,
    updatedAt: now,
    _updatedAt: Date.now()
  });
}

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
      db.contactos,
      db.clientes,
      db.proveedores,
      db.config
    ], async () => {
      // 1. Asegurar que las categorías semillas existan y tengan los atributos sugeridos y supercategorías actualizados
      for (const cat of INITIAL_CATEGORIAS_MATERIAL) {
        const existing = await db.categoriasMaterial.get(cat.id);
        if (!existing) {
          await db.categoriasMaterial.add({ ...cat, syncStatus: 'synced' });
        } else {
          await db.categoriasMaterial.update(cat.id, {
            nombre: cat.nombre,
            supercategoriaId: cat.supercategoriaId,
            supercategoriaNombre: cat.supercategoriaNombre,
            atributosSugeridos: cat.atributosSugeridos
          });
        }
      }

      // Eliminar categoría obsoleta combinada si existía
      await db.categoriasMaterial.delete('cat-protecciones');

      // 2. Mapear y corregir materiales existentes con IDs de categoría antiguos o no coincidentes
      const categoryMapping: Record<string, string> = {
        'cableado': 'cat-cables',
        'cables': 'cat-cables',
        'protecciones': 'cat-protecciones',
        'canalizaciones': 'cat-canos',
        'canos': 'cat-canos',
        'bandejas': 'cat-bandejas',
        'cablecanales': 'cat-cablecanales',
        'cajas': 'cat-cajas',
        'modulos': 'cat-modulos-llaves',
        'llaves': 'cat-modulos-llaves',
        'modulos-llaves': 'cat-modulos-llaves',
        'tableros': 'cat-tableros',
        'iluminacion': 'cat-iluminacion',
        'medicion': 'cat-tierra',
        'tierra': 'cat-tierra',
        'fijacion': 'cat-fijacion',
        'terminales': 'cat-terminales',
        'motores': 'cat-motores-automatizacion',
        'automatizacion': 'cat-motores-automatizacion',
        'motores-automatizacion': 'cat-motores-automatizacion',
        'renovables': 'cat-renovables',
        'solar': 'cat-renovables',
        'accesorios': 'cat-accesorios',
        'insumos': 'cat-accesorios'
      };

      const allCats = await db.categoriasMaterial.toArray();
      const validCatIds = new Set(allCats.map(c => c.id));

      const mats = await db.materiales.toArray();
      for (const m of mats) {
        let updated = false;
        let newCatId = m.categoriaId;

        // Migración específica de materiales antiguos de protecciones, canalizaciones o fijaciones
        if (m.categoriaId === 'cat-protecciones' || m.id.startsWith('mat-pia-') || m.id.startsWith('mat-dif-')) {
          if (m.id.startsWith('mat-pia-')) {
            newCatId = 'cat-termomagneticas';
            updated = true;
          } else if (m.id.startsWith('mat-dif-')) {
            newCatId = 'cat-diferenciales';
            updated = true;
          }
        } else if (m.categoriaId === 'cat-canalizaciones') {
          if (m.id.startsWith('mat-cano-')) newCatId = 'cat-canos';
          else if (m.id.startsWith('mat-bandeja-perf-')) newCatId = 'cat-bandejas';
          else newCatId = 'cat-accesorios-bandejas';
          updated = true;
        } else if (m.categoriaId === 'cat-fijacion') {
          if (m.id.startsWith('mat-conector-')) {
            newCatId = 'cat-accesorios-caneria';
            updated = true;
          } else if (m.id.startsWith('mat-terminal-tif-')) {
            newCatId = 'cat-terminales';
            updated = true;
          } else if (m.id.startsWith('mat-distribuidor-tetra-') || m.id.startsWith('mat-bornera-neutro-') || m.id.startsWith('mat-bornera-tierra-')) {
            newCatId = 'cat-accesorios-tablero';
            updated = true;
          } else if (m.id === 'mat-bornera-bep-8b') {
            newCatId = 'cat-tierra';
            updated = true;
          }
        } else if (m.categoriaId === 'cat-modulos-llaves' && (m.id.startsWith('mat-mod-bastidor-') || m.id.startsWith('mat-mod-tapa-'))) {
          newCatId = 'cat-bastidores-tapas';
          updated = true;
        } else if (categoryMapping[m.categoriaId]) {
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

      // 3. Migrar proveedores legacy (v1) que no tenían razonSocial como campo propio.
      const proveedores = await db.proveedores.toArray();
      for (const p of proveedores) {
        if (!p.razonSocial && p.nombre) {
          await db.proveedores.update(p.id, { razonSocial: p.nombre });
        }
      }

      // 4. Asegurar materiales iniciales si la tabla materiales está vacía
      if (await db.materiales.count() === 0 && INITIAL_MATERIALES.length > 0) {
        for (const mat of INITIAL_MATERIALES) {
          await db.materiales.put(mat);
        }
      }

      // 5. Asegurar productos y marcas iniciales si la tabla productos está vacía
      if (await db.productos.count() === 0 && INITIAL_PRODUCTOS.length > 0) {
        for (const prod of INITIAL_PRODUCTOS) {
          await db.productos.put(prod);
        }
      }

      // 6. Asegurar ofertas/precios iniciales si la tabla ofertas está vacía
      if (await db.ofertas.count() === 0 && INITIAL_OFERTAS.length > 0) {
        for (const ofr of INITIAL_OFERTAS) {
          await db.ofertas.put(ofr);
        }
      }

      // 7. Asegurar insumos legacy si la tabla insumos está vacía
      if (await db.insumos.count() === 0 && INITIAL_INSUMOS.length > 0) {
        for (const ins of INITIAL_INSUMOS) {
          await db.insumos.put(ins);
        }
      }

      // 8. Asegurar contactos iniciales si la tabla contactos está vacía
      if (await db.contactos.count() === 0) {
        for (const ct of INITIAL_CONTACTOS) {
          await db.contactos.put(ct);
        }
      }

      // 9. Asegurar mano de obra inicial si la tabla está vacía
      if (await db.manoObra.count() === 0 && INITIAL_MANO_OBRA.length > 0) {
        for (const mo of INITIAL_MANO_OBRA) {
          await db.manoObra.put(mo);
        }
      }

      // 10. Asegurar costos indirectos iniciales si la tabla está vacía
      if (await db.costosIndirectos.count() === 0 && INITIAL_COSTOS_INDIRECTOS.length > 0) {
        for (const ci of INITIAL_COSTOS_INDIRECTOS) {
          await db.costosIndirectos.put(ci);
        }
      }

      // 11. Asegurar tareas tipo iniciales y migrar tareas tipo enriquecidas
      if (await db.tareasTipo.count() === 0 && INITIAL_TAREAS_TIPO.length > 0) {
        for (const tt of INITIAL_TAREAS_TIPO) {
          await db.tareasTipo.put(tt);
        }
      } else {
        // Asegurar que las tareas tipo iniciales tengan la estructura actualizada de parametros y variables
        for (const tt of INITIAL_TAREAS_TIPO) {
          const existing = await db.tareasTipo.get(tt.id);
          if (!existing || !existing.parametros || (tt.variables && !existing.variables)) {
            await db.tareasTipo.put(tt);
          }
        }
        // Eliminar tarea antigua 'tt-tablero-seccional-8m' si existía
        const oldTablero = await db.tareasTipo.get('tt-tablero-seccional-8m');
        if (oldTablero) {
          await db.tareasTipo.delete('tt-tablero-seccional-8m');
        }
      }

      // 12. Inicializar configuración por defecto si la base está vacía
      if (await db.config.count() === 0) await db.config.add(DEFAULT_APP_CONFIG);
    });
    console.log('Verificación e inicialización de semillas de BD completada.');
  } catch (err) {
    console.error('Error al inicializar semillas de BD:', err);
  }
}

/**
 * Parser CSV compatible con RFC 4180: soporta campos entre comillas que pueden
 * contener comas, saltos de línea y comillas escapadas ("").
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; } // comilla escapada ""
        else inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
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
    contactos: await db.contactos.toArray(),
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
    db.contactos,
    db.clientes,
    db.proveedores,
    db.proyectos,
    db.presupuestos,
    db.registrosTrabajo,
    db.config
  ], async () => {
    if (data.categoriasMaterial) { await db.categoriasMaterial.clear(); await db.categoriasMaterial.bulkPut(data.categoriasMaterial); }
    if (data.materiales) { await db.materiales.clear(); await db.materiales.bulkPut(data.materiales); }
    if (data.productos) { await db.productos.clear(); await db.productos.bulkPut(data.productos); }
    if (data.ofertas) { await db.ofertas.clear(); await db.ofertas.bulkPut(data.ofertas); }
    if (data.solicitudesCotizacion) { await db.solicitudesCotizacion.clear(); await db.solicitudesCotizacion.bulkPut(data.solicitudesCotizacion); }
    if (data.insumos) { await db.insumos.clear(); await db.insumos.bulkPut(data.insumos); }
    if (data.manoObra) { await db.manoObra.clear(); await db.manoObra.bulkPut(data.manoObra); }
    if (data.costosIndirectos) { await db.costosIndirectos.clear(); await db.costosIndirectos.bulkPut(data.costosIndirectos); }
    if (data.tareasTipo) { await db.tareasTipo.clear(); await db.tareasTipo.bulkPut(data.tareasTipo); }
    if (data.contactos) { await db.contactos.clear(); await db.contactos.bulkPut(data.contactos); }
    if (data.clientes) { await db.clientes.clear(); await db.clientes.bulkPut(data.clientes); }
    if (data.proveedores) { await db.proveedores.clear(); await db.proveedores.bulkPut(data.proveedores); }
    if (data.proyectos) { await db.proyectos.clear(); await db.proyectos.bulkPut(data.proyectos); }
    if (data.presupuestos) { await db.presupuestos.clear(); await db.presupuestos.bulkPut(data.presupuestos); }
    if (data.registrosTrabajo) { await db.registrosTrabajo.clear(); await db.registrosTrabajo.bulkPut(data.registrosTrabajo); }
    if (data.config) { await db.config.clear(); await db.config.bulkPut(data.config); }
  });
}

/**
 * Restablece todas las tablas del sistema a sus valores iniciales limpios por defecto.
 * Limpia presupuestos, registros, tareas, ofertas y recarga los catálogos base
 * (Categorías, Materiales, Productos, Ofertas base, Mano de Obra, Gastos Generales y Configuración inicial).
 */
export async function resetDatabaseToDefaults(): Promise<void> {
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
    // 1. Limpiar todas las tablas
    await db.categoriasMaterial.clear();
    await db.materiales.clear();
    await db.productos.clear();
    await db.ofertas.clear();
    await db.solicitudesCotizacion.clear();
    await db.insumos.clear();
    await db.manoObra.clear();
    await db.costosIndirectos.clear();
    await db.tareasTipo.clear();
    await db.contactos.clear();
    await db.clientes.clear();
    await db.proveedores.clear();
    await db.proyectos.clear();
    await db.presupuestos.clear();
    await db.registrosTrabajo.clear();
    await db.config.clear();

    // 2. Re-sembrar datos de fábrica
    if (INITIAL_CATEGORIAS_MATERIAL.length > 0) await db.categoriasMaterial.bulkPut(INITIAL_CATEGORIAS_MATERIAL);
    if (INITIAL_MATERIALES.length > 0) await db.materiales.bulkPut(INITIAL_MATERIALES);
    if (INITIAL_PRODUCTOS.length > 0) await db.productos.bulkPut(INITIAL_PRODUCTOS);
    if (INITIAL_OFERTAS.length > 0) await db.ofertas.bulkPut(INITIAL_OFERTAS);
    if (INITIAL_INSUMOS.length > 0) await db.insumos.bulkPut(INITIAL_INSUMOS);
    if (INITIAL_MANO_OBRA.length > 0) await db.manoObra.bulkPut(INITIAL_MANO_OBRA);
    if (INITIAL_COSTOS_INDIRECTOS.length > 0) await db.costosIndirectos.bulkPut(INITIAL_COSTOS_INDIRECTOS);
    if (INITIAL_TAREAS_TIPO.length > 0) await db.tareasTipo.bulkPut(INITIAL_TAREAS_TIPO);
    if (INITIAL_CONTACTOS.length > 0) await db.contactos.bulkPut(INITIAL_CONTACTOS);
    await db.config.add(DEFAULT_APP_CONFIG);
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
    const cols = parseCSVLine(lines[i]);
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
    const cols = parseCSVLine(lines[i]);
    if (cols.length >= 1) {
      const razonSocial = cols[0];
      newProveedores.push({
        id: `prov-csv-${crypto.randomUUID()}`,
        razonSocial,
        nombre: razonSocial,
        cuitDni: cols[1] || undefined,
        cuit: cols[1] || undefined,
        roles: ['proveedor'],
        tipoProveedor: 'material',
        contactos: [
          {
            id: crypto.randomUUID(),
            nombre: cols[4] || 'Contacto Principal',
            nombrePersona: cols[4] || 'Contacto Principal',
            telefono: cols[2] || undefined,
            email: cols[3] || undefined,
            esPrincipal: true
          }
        ],
        telefono: cols[2] || undefined,
        email: cols[3] || undefined,
        contacto: cols[4] || undefined,
        direccion: cols[5] || undefined,
        notas: cols[6] || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  if (newProveedores.length > 0) {
    await db.proveedores.bulkAdd(newProveedores);
    await db.contactos.bulkPut(newProveedores);
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
    const cols = parseCSVLine(lines[i]);
    if (cols.length >= 1) {
      newClientes.push({
        id: `cli-csv-${crypto.randomUUID()}`,
        razonSocial: cols[0],
        nombre: cols[0],
        cuitDni: cols[1] || undefined,
        cuit: cols[1] || undefined,
        roles: ['cliente'],
        condicionIVA: (cols[2] as Cliente['condicionIVA']) || undefined,
        telefono: cols[3] || undefined,
        email: cols[4] || undefined,
        direccion: cols[5] || undefined,
        notas: cols[6] || undefined,
        contactos: (cols[3] || cols[4]) ? [{
          id: crypto.randomUUID(),
          nombre: cols[0],
          telefono: cols[3] || undefined,
          email: cols[4] || undefined,
          esPrincipal: true
        }] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  if (newClientes.length > 0) {
    await db.clientes.bulkAdd(newClientes);
    await db.contactos.bulkPut(newClientes);
  }
  return newClientes.length;
}
