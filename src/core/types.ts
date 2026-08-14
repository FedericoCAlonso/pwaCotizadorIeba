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
export type TipoProveedor = 'material' | 'servicio' | 'ambos';

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
export interface AtributoTemplate {
  clave: string; // "seccion", "In", "Id", "polos", "norma"
  etiqueta: string; // texto visible en el formulario
  unidad?: string; // "mm²", "A", "mA"
  tipo: 'texto' | 'numero';
}

export interface CategoriaMaterial {
  id: string;
  nombre: string; // "Cables", "Protecciones", "Canalizaciones", etc.
  atributosSugeridos: AtributoTemplate[];
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
}

// ─── 5. Proveedor & Contactos Dinámicos ────────────────────────────────────────
export interface CanalContacto {
  tipo: 'telefono' | 'whatsapp' | 'email' | 'web';
  valor: string;
  esPrincipal: boolean;
}

export interface Contacto {
  id: string;
  nombrePersona: string;
  rol?: string; // "Ventas", "Administración", "Técnico"
  canales: CanalContacto[];
}

export interface Proveedor {
  id: string;
  razonSocial: string;
  nombre?: string; // Alias para razonSocial
  cuit?: string;
  tipoProveedor: TipoProveedor; // 'material', 'servicio', 'ambos'
  contactos: Contacto[];
  notas?: string;
  // Campos legados opcionales
  telefono?: string;
  email?: string;
  contacto?: string;
  direccion?: string;
}

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
}

// ─── 7. Mano de Obra y Costos Indirectos ───────────────────────────────────────
export interface CategoriaManoDeObra {
  id: string;
  nombre: string;
  costoHora: number;
  fechaActualizacion: string;
}

export type TipoCostoIndirecto = 'fijo_mensual' | 'porcentual_sobre_costo' | 'por_visita';

export interface CostoIndirecto {
  id: string;
  nombre: string;
  tipo: TipoCostoIndirecto;
  valor: number;
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
  cantidadTotal: number;
  precioUnitarioCongelado: number;
  subtotalInsumo: number;
  esAdHoc?: boolean;
  requiereCotizacionDirecta?: boolean;
}

export interface ManoObraSnapshot {
  categoriaId: string;
  nombreCategoria: string;
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

export interface Cliente {
  id: string;
  nombre: string;
  cuitDni?: string;
  condicionIVA?: 'Responsable Inscripto' | 'Monotributo' | 'Consumidor Final' | 'Exento';
  telefono?: string;
  email?: string;
  direccion?: string;
  notas?: string;
}

export interface Proyecto {
  id: string;
  clienteId: string;
  nombre: string;
  ubicacion?: string;
  descripcion?: string;
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
}

export type ThemeMode = 'dark' | 'light' | 'system';

export type SyncStatus = 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete';

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

  autoSyncEnabled?: boolean; // Default true
  syncIntervalMinutes?: number; // Default 5 mins
}
