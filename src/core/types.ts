// Core domain types for Cotizador Eléctrico (IEBA)
// Modelo reestructurado: CategoriaMaterial, Material, Producto, Oferta, Proveedor con Contactos y SolicitudCotizacion.

export const ESTADO_PRESUPUESTO = {
  BORRADOR: 'borrador',
  ENVIADO: 'enviado',
  APROBADO: 'aprobado',
  RECHAZADO: 'rechazado',
  VENCIDO: 'vencido'
} as const;

export const CATEGORIA_TAREA = {
  BOCAS: 'Bocas',
  CIRCUITOS: 'Circuitos',
  TABLEROS: 'Tableros',
  ACOMETIDAS: 'Acometidas',
  MEDICION: 'Medición'
} as const;

export const CONDICION_TRABAJO = {
  NORMAL: 'normal',
  DIFICULTOSA: 'dificultosa',
  FAVORABLE: 'favorable'
} as const;

export const MEDIO_PAGO = {
  EFECTIVO: 'efectivo',
  TRANSFERENCIA: 'transferencia',
  CHEQUE: 'cheque',
  OTRO: 'otro'
} as const;

export const TIPO_FACTURA_VALORES = {
  FACTURA_A: 'Factura A',
  FACTURA_B: 'Factura B',
  FACTURA_C: 'Factura C',
  SIN_FACTURA: 'Presupuesto X (Sin Factura)'
} as const;

export type MotivoDesvio = 'material' | 'diseno_cliente' | 'clima' | 'error_calculo' | 'otro';

export const MOTIVO_DESVIO_ETIQUETAS: Record<MotivoDesvio, string> = {
  material: 'Material',
  diseno_cliente: 'Diseño/Cliente',
  clima: 'Clima',
  error_calculo: 'Error de cálculo',
  otro: 'Otro'
};

export interface IndiceReferencia {
  nombre: string; // "Dólar Blue", "Dólar Oficial", "IPC", "Canasta Eléctrica", etc.
  valor: number;
}

// ─── 1. Categoría de Material ──────────────────────────────────────────────────
export interface AtributoDependencia {
  dependeVinculo: string; // ej: "norma"
  valorEsperado: string;  // ej: "IRAM 247-3"
  opcionesFiltradas?: string[]; // ej: ["1.5", "2.5", "4", "6", "10"]
  bloqueado?: boolean;
  valorFijo?: string;     // ej: conductores = "1"
}

export interface AtributoTemplate {
  clave: string; // "seccion", "In", "Id", "polos", "norma"
  etiqueta: string; // texto visible en el formulario
  unidad?: string; // "mm²", "A", "mA"
  tipo: 'texto' | 'numero';
  opciones?: string[];
  dependencias?: AtributoDependencia[];
}

export interface CategoriaMaterial {
  id: string;
  nombre: string; // "Cables", "Protecciones", "Canalizaciones", etc.
  atributosSugeridos: AtributoTemplate[];
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
  syncStatus?: SyncStatus;
  _updatedAt?: number;
}

// ─── 2. Material (Ficha técnico-normativa sin marca ni precio) ─────────────────
export interface AtributoMaterial {
  clave: string;
  valor: string;
}

export interface Material {
  id: string;
  categoriaId: string;
  nombre: string; // autogenerado desde atributos o editable a mano
  unidadVenta: string; // "m", "u", "kg", "rollo x100m"
  atributos: AtributoMaterial[];
  notas?: string;
  activo: boolean; // false = obsoleto/discontinuado
  requiereCotizacionDirecta?: boolean;
  fichaIncompleta?: boolean; // Phase 2: Alta rápida pendiente de completar
  urlMercadoLibre?: string; // Phase 2: Enlace directo opcional ML
  frecuenciaUso?: number; // Phase 2: Smart autocomplete frecuencia
  ultimoUsoFecha?: string; // Phase 2: ISO timestamp último uso
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

// Alias de compatibilidad
export type Insumo = Material & {
  categoria?: string;
  unidad?: string;
  codigoProveedor?: string;
  precioActual?: number;
  fechaActualizacion?: string;
  historialPrecios?: { fecha: string; precio: number; fuente: string }[];
  ofertas?: any[];
};

// ─── 3. Producto (Implementación de marca de un Material) ──────────────────────
export interface Producto {
  id: string;
  materialId: string; // FK obligatorio
  marca: string;
  modelo: string;
  codigoFabricante?: string;
  tierCalidad?: 'premium' | 'estandar' | 'economico';
  notas?: string;
  esPreferido: boolean;
  activo?: boolean; // false = obsoleto/discontinuado
  urlMercadoLibre?: string; // Phase 2: Enlace directo a ML
  frecuenciaUso?: number;
  ultimoUsoFecha?: string;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

// ─── 4. Oferta (Precio de proveedor para un Producto o Material) ──────────────
export interface Oferta {
  id: string;
  materialId: string; // FK siempre presente
  productoId?: string; // FK opcional (null = precio genérico sin marca)
  proveedorId: string;
  precio: number;
  fecha: string; // ISO String
  fuente: 'indice' | 'manual' | 'cotizacion_directa' | 'importacion_excel';
  tipoAjustePrecio?: string; // referencia a TIPOS_AJUSTE_PRECIO cuando fuente = 'indice'
  solicitudCotizacionId?: string; // FK opcional si proviene de RFQ
  notas?: string;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

// ─── 5. Directorio Unificado de Contactos (Clientes & Proveedores) ────────────
export type RolContacto = 'cliente' | 'proveedor';
export type TipoProveedor = 'material' | 'servicio' | 'ambos';
export type CondicionIVA = 'Responsable Inscripto' | 'Monotributo' | 'Consumidor Final' | 'Exento';

export interface CanalContacto {
  tipo: 'telefono' | 'whatsapp' | 'email' | 'web';
  valor: string;
  esPrincipal: boolean;
}

export interface PersonaContacto {
  id: string;
  nombre?: string;
  nombrePersona?: string; // compatibilidad
  rol?: string; // "Titular", "Jefe de Obra", "Compras", "Pagos", "Ventas", "Técnico"
  telefono?: string;
  email?: string;
  esPrincipal?: boolean;
  canales?: CanalContacto[];
}

export interface DatosFinancierosContacto {
  // Condiciones comerciales / cobro (como Cliente)
  condicionesCobroHabitual?: string; // ej: "50% anticipo, 50% fin de obra", "30 días f.f."
  descuentoHabitualPct?: number;     // % descuento acordado
  limiteCreditoARS?: number;         // límite de crédito para obra
  
  // Condiciones de pago / bancarias (como Proveedor)
  condicionesPagoHabitual?: string;  // ej: "Cuenta Corriente 30 días", "Contado contra entrega"
  cbuCvuAlias?: string;              // CBU / CVU / Alias bancario
  banco?: string;                    // ej: "Banco Galicia", "Mercado Pago"
  titularCuenta?: string;            // Titular de la cuenta
  cuitTitular?: string;              // CUIT del titular
  diasPlazoPago?: number;            // Días de plazo de pago
}

export interface Contacto {
  id: string;
  razonSocial: string;               // Nombre o Razón Social principal
  nombreFantasia?: string;           // Nombre comercial o alias
  nombre?: string;                   // Alias de compatibilidad (= razonSocial)
  cuitDni?: string;
  cuit?: string;                     // Alias de compatibilidad (= cuitDni)
  condicionIVA?: CondicionIVA;
  
  // Roles de negocio
  roles: RolContacto[];              // ['cliente'], ['proveedor'] o ['cliente', 'proveedor']
  tipoProveedor?: TipoProveedor;     // si roles.includes('proveedor')
  
  // Sistema de Etiquetas / Tags (M3 Chips)
  etiquetas?: string[];
  
  // Ubicación y Canales Generales
  direccion?: string;
  localidad?: string;
  provincia?: string;
  telefono?: string;
  email?: string;
  contacto?: string;                 // Alias de compatibilidad
  sitioWeb?: string;
  contactos?: PersonaContacto[];     // Directorio de personas de la empresa
  
  // Módulo Financiero
  financiero?: DatosFinancierosContacto;
  
  notas?: string;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
  syncStatus?: SyncStatus;
  _updatedAt?: number;
}

// Alias de retrocompatibilidad
export type Cliente = Contacto;
export type Proveedor = Contacto;

// ─── 6. Solicitud de Cotización (RFQ) ─────────────────────────────────────────
export interface SolicitudCotizacionItem {
  id: string;
  materialId: string;
  productoId?: string;
  cantidad?: number;
  precioRespuesta?: number; // cargado manualmente al recibir respuesta
  ofertaGeneradaId?: string; // FK a Oferta creada al confirmar
}

export type EstadoSolicitudCotizacion = 'borrador' | 'enviada' | 'respondida' | 'vencida';

export interface SolicitudCotizacion {
  id: string;
  proveedorId: string;
  estado: EstadoSolicitudCotizacion;
  fechaCreacion: string; // ISO string
  fechaEnvio?: string;
  items: SolicitudCotizacionItem[];
  notas?: string;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

// ─── 7. Mano de Obra y Costos Indirectos ───────────────────────────────────────
export interface CategoriaManoDeObra {
  id: string;
  nombre: string;
  costoHora: number;
  fechaActualizacion: string;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

export type TipoCostoIndirecto = 'fijo_mensual' | 'porcentual_sobre_costo' | 'por_visita';

export interface CostoIndirecto {
  id: string;
  nombre: string;
  tipo: TipoCostoIndirecto;
  valor: number;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

// ─── 8. Tareas Tipo y Servicios Tercerizados ──────────────────────────────────
export interface InsumoEnTarea {
  materialId?: string;
  insumoId?: string; // alias
  productoId?: string;
  cantidad: number;
}

export interface ManoObraEnTarea {
  categoriaId: string;
  horas: number;
}

export interface TareaTipo {
  id: string;
  nombre: string;
  categoria: string;
  insumos: InsumoEnTarea[];
  manoObra: ManoObraEnTarea[];
  unidad: string;
  notasTecnicas?: string;
  factorCorreccion?: number;
  frecuenciaUso?: number;
  ultimoUsoFecha?: string;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

export interface ServicioTercerizado {
  id: string;
  proveedorId?: string;
  nombreProveedor?: string;
  descripcion: string;
  costo: number;
  margenPropio?: number;
  validezCotizacionTercero?: string;
  hitoPagoSugerido?: string;
}

// ─── 9. Snapshots e Ítems de Presupuesto ──────────────────────────────────────
export interface InsumoSnapshot {
  materialId?: string;
  insumoId?: string;
  productoId?: string;
  ofertaId?: string;
  nombre: string;
  marca?: string;
  unidad: string;
  cantidadUnitaria?: number;
  cantidadTotal: number;
  precioUnitarioCongelado: number;
  subtotalInsumo: number;
  esAdHoc?: boolean;
  requiereCotizacionDirecta?: boolean;
}

export interface ManoObraSnapshot {
  categoriaId: string;
  nombreCategoria: string;
  horasUnitarias?: number;
  horasTotales: number;
  costoHoraCongelado: number;
  subtotalManoObra: number;
}

export interface CostoIndirectoSnapshot {
  costoIndirectoId: string;
  nombre: string;
  tipo: TipoCostoIndirecto;
  valorAplicado: number;
  montoCalculado: number;
}

export interface ItemPresupuesto {
  id: string;
  tareaTipoId?: string;
  materialId?: string;
  productoId?: string;
  ofertaId?: string;
  precioManual?: number;

  descripcion: string;
  cantidad: number;
  unidad: string;

  insumosSnapshot: InsumoSnapshot[];
  manoObraSnapshot: ManoObraSnapshot[];
  serviciosTercerizados?: ServicioTercerizado[];

  costoInsumos: number;
  costoManoObra: number;
  costoServiciosTercerizados?: number;
  costoDirectoTotal: number;

  condicionTrabajo?: 'normal' | 'dificultosa' | 'favorable';
  esAdHoc?: boolean;

  // Campos de Análisis de Precios Unitarios (APU) y Prorrateo de GG Absolutos
  incidencia?: number; // Incidencia = Costo_item / Costo_Total_Global
  ggAbsolutoProrrateado?: number; // GG_absoluto_item = Total_GG_absolutos * incidencia
  baseCostoItem?: number; // Base_item = Costo_item + GG_absoluto_item
  ggPorcentualItem?: number; // GG_porcentual_item = Base_item * porcentaje_GG
  beneficioItem?: number; // Beneficio_item = (Base_item + GG_porcentual_item) * porcentaje_Beneficio
  subtotalItem?: number; // Subtotal_item = Base_item + GG_porcentual_item + Beneficio_item
  impuestosItem?: number; // Impuestos_item = Σ(impuesto_i% * Subtotal_item)
  precioFinalItem?: number; // Precio_Final_item = Subtotal_item + Impuestos_item

  // Campos de venta al cliente
  costoUnitario?: number; // Costo por unidad del renglón (insumos + MO + servicios)
  costoTotal?: number; // Costo total del renglón = costoUnitario * cantidad
  precioVentaClienteUnitario?: number; // Precio unitario de venta cerrado para el cliente = Precio_Final_item / cantidad
  precioVentaClienteTotal?: number; // Precio de venta cerrado total = Precio_Final_item

  precioVentaUnitario: number;
  precioVentaTotal: number;
}

// ─── 10. Esquema de Pago, Clientes y Presupuesto ──────────────────────────────
export interface HitoPago {
  id: string;
  descripcion: string;
  condicionLiberacion: string;
  porcentaje: number;
  montoCalculado: number;
  medioPagoEsperado: 'efectivo' | 'transferencia' | 'cheque' | 'otro';
  plazoChequeDias?: number;
}

export interface EsquemaPago {
  modalidad: 'pago_unico' | 'adelanto_saldo' | 'certificados_avance' | 'cuotas';
  fondoReparoPct?: number;
  hitos: HitoPago[];
}

export type EstadoPresupuesto = 'borrador' | 'enviado' | 'aprobado' | 'rechazado' | 'vencido';

export type TipoFactura = 'Factura A' | 'Factura B' | 'Factura C' | 'Presupuesto X (Sin Factura)';

export interface ImpuestoItem {
  id: string;
  nombre: string;
  porcentaje: number;
  aplica: boolean;
  discriminar: boolean;
  montoCalculado: number;
}

export interface OpcionesEmisionPresupuesto {
  mostrarItemizado?: boolean;
  mostrarDetalleCostos?: boolean;
  condicionesComerciales?: string;
}


export interface Proyecto {
  id: string;
  clienteId: string;
  nombre: string;
  ubicacion?: string;
  descripcion?: string;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

export interface CostoIndirectoItemConfig {
  id: string;
  nombre: string;
  tipo: TipoCostoIndirecto;
  valor: number;
  aplica: boolean;
}

export interface Presupuesto {
  id: string;
  numero: string;
  clienteId: string;
  proyectoId?: string;
  fechaEmision: string;
  validezDias: number;

  tipoFactura: TipoFactura;

  items: ItemPresupuesto[];
  costosIndirectosConfig?: CostoIndirectoItemConfig[];
  costosIndirectosAplicados: CostoIndirectoSnapshot[];

  // ─── Nuevo Motor de Cálculo: C → GG → B → S → Impuestos → Precio Final & K ───
  costoGlobal?: number; // C = Σ(Insumos + Mano de Obra + Servicios)
  gastosGeneralesTotal?: number; // GG total = Σ(GG fijos) + Σ(GG% × C)
  beneficioPorcentaje?: number; // % beneficio aplicado sobre (C + GG)
  beneficioMonto?: number; // B = %beneficio × (C + GG)
  subtotalSinImpuestos?: number; // S = C + GG + B
  montoImpuestosTotal?: number; // Σ(impuesto_i% × S)
  precioFinalGlobal?: number; // Precio Final = S + Impuestos
  coeficienteK?: number; // K = Precio Final / Costo Global

  // Opciones de Emisión y Presentación para el Cliente
  opcionesEmision?: OpcionesEmisionPresupuesto;

  // Campos de compatibilidad
  subtotalInsumos: number;
  subtotalManoObra: number;
  subtotalServiciosTercerizados?: number;
  subtotalCostosDirectos: number;
  subtotalCostosIndirectos: number;
  costoTotalObra: number;

  margenPorcentaje: number;
  montoGanancia: number;

  impuestosDetalle: ImpuestoItem[];
  impuestosPorcentaje: number;
  montoImpuestos: number;

  totalARS: number;

  mostrarReferenciaMonedaExtranjera: boolean;
  nombreMonedaExtranjera: string;
  cotizacionMonedaExtranjera: number;
  totalMonedaExtranjera?: number;

  condicionesPagoTexto: string;
  esquemaPago?: EsquemaPago;

  estado: EstadoPresupuesto;
  notasInternas?: string;
  notasCliente?: string;

  fechaModificacion: string;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

export interface RegistroTrabajo {
  id: string;
  presupuestoId?: string;
  proyectoId?: string;
  tareaTipoId?: string;
  descripcion: string;
  fecha: string;
  horasReales: number;
  categoriaManoObraId: string;
  cantidadEjecutada: number;
  condicion?: 'normal' | 'dificultosa' | 'favorable';
  motivoDesvio?: MotivoDesvio;
  notas?: string;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

export type ThemeMode = 'dark' | 'light' | 'system';

export type SyncStatus = 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete';

export type SyncProviderType = 'local_file' | 'google_drive' | 'manual_json';

export interface SyncConfig {
  providerType: SyncProviderType;
  autoSync: boolean;
  syncIntervalMinutes: number;
  lastSyncTimestamp?: string;
  localDirectoryName?: string;
  googleDriveConnected?: boolean;
  googleDriveUserEmail?: string;
}

export interface AppConfig {
  id: string;
  nombreEmpresa: string;
  subtituloEmpresa: string;
  cuit: string;
  telefono: string;
  email: string;
  direccion: string;
  dolarReferenciaNombre: string;
  dolarReferenciaValor: number;
  mostrarDolarPorDefecto: boolean;
  monotributista: boolean;
  tipoFacturaPorDefecto: TipoFactura;
  porcentajeIVAPorDefecto: number;
  porcentajeIIBBPorDefecto: number;
  margenPorDefectoPct: number;
  validezDiasPorDefecto: number;
  prefijoPresupuesto: string;
  siguienteNumeroCorrelativo: number;
  themeMode?: ThemeMode;

  alphaEmaManoObra?: number;
  multiplicadorCondicionNormal?: number;
  multiplicadorCondicionDificultosa?: number;
  multiplicadorCondicionFavorable?: number;
  diasVencimientoPrecioVerde?: number;
  diasVencimientoPrecioAmarillo?: number;
  canastaElectricaValor?: number;
  umbralMargenMinimoAdvertencia?: number; // Porcentaje configurable (default: 20%)

  syncConfig?: SyncConfig;
  autoSyncEnabled?: boolean; // Default true
  syncIntervalMinutes?: number; // Default 5 mins
  motoresBusquedaOnline?: MotorBusquedaEcommerce[];

  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

export interface MotorBusquedaEcommerce {
  id: string;
  nombre: string;
  urlTemplate: string; // Plantilla con {query}
  activo: boolean;
  icono?: string;
  esPredeterminado?: boolean;
}
