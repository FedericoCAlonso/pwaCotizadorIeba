// Core domain types for Cotizador Eléctrico (IEBA)
// Nota: todos los IDs nuevos deben generarse con crypto.randomUUID() — auditoria #33

// ─── Enums centralizados (auditoria #32: eliminar magic strings) ───────────────

export const ESTADO_PRESUPUESTO = {
  BORRADOR: 'borrador',
  ENVIADO: 'enviado',
  APROBADO: 'aprobado',
  RECHAZADO: 'rechazado',
  VENCIDO: 'vencido'
} as const;

export const CATEGORIA_INSUMO = {
  CABLEADO: 'cableado',
  PROTECCIONES: 'protecciones',
  CANALIZACIONES: 'canalizaciones',
  CAJAS: 'cajas',
  ILUMINACION: 'iluminacion',
  ACCESORIOS: 'accesorios',
  GENERAL: 'general'
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

// ────────────────────────────────────────────────────────────────────────────────

export interface PrecioHistorico {
  fecha: string; // ISO string
  precio: number;
  fuente: string; // "Lista Proveedor", "Manual", "Ajuste %", etc.
}

export interface Insumo {
  id: string;
  nombre: string; // "Cable unipolar 2.5mm2 IRAM 247-3"
  unidad: string; // "m", "u", "kg", "rollo 100m", "juego"
  categoria: string; // "cableado", "protecciones", "canalizaciones", "cajas", "iluminacion", "accesorios"
  proveedorPreferido?: string;
  codigoProveedor?: string;
  precioActual: number;
  fechaActualizacion: string; // ISO string
  historialPrecios: PrecioHistorico[];
}

export interface CategoriaManoDeObra {
  id: string;
  nombre: string; // "Oficial Electricista", "Ayudante", "Técnico DCI", "Especialista Tableros"
  costoHora: number; // Costo real por hora
  fechaActualizacion: string;
}

export type TipoCostoIndirecto = 'fijo_mensual' | 'porcentual_sobre_costo' | 'por_visita';

export interface CostoIndirecto {
  id: string;
  nombre: string; // "Combustible/Viáticos", "Amortización Herramientas", "Seguro/ART", "Monotributo"
  tipo: TipoCostoIndirecto;
  valor: number;
}

export interface InsumoEnTarea {
  insumoId: string;
  cantidad: number;
}

export interface ManoObraEnTarea {
  categoriaId: string;
  horas: number;
}

export interface TareaTipo {
  id: string;
  nombre: string; // "Boca de iluminación completa", "Punto TUG 20A", "Circuito completo TUG 10 bocas", "Tablero 12 módulos"
  categoria: string; // "Bocas", "Circuitos", "Tableros", "Acometidas", "Medición"
  insumos: InsumoEnTarea[];
  manoObra: ManoObraEnTarea[];
  unidad: string; // "u", "m", "punto", "obra"
  notasTecnicas?: string; // Ej: "Norma AEA 90364-7-771"
}

// Snapshots congelados al emitir el presupuesto (Inmutabilidad)
export interface InsumoSnapshot {
  insumoId: string;
  nombre: string;
  unidad: string;
  cantidadTotal: number;
  precioUnitarioCongelado: number;
  subtotalInsumo: number;
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
  descripcion: string;
  cantidad: number;
  unidad: string;
  
  // Detalle de costo al momento del armado
  insumosSnapshot: InsumoSnapshot[];
  manoObraSnapshot: ManoObraSnapshot[];
  
  costoInsumos: number;
  costoManoObra: number;
  costoDirectoTotal: number;
  
  precioVentaUnitario: number;
  precioVentaTotal: number;
}

export interface HitoPago {
  id: string;
  descripcion: string; // "Anticipo 50% materiales", "Certificado N°1 - 30%", "Saldo contra entrega"
  condicionLiberacion: string; // "Contra firma de contrato", "Avance de obra 50%"
  porcentaje: number; // % sobre el total
  montoCalculado: number;
  medioPagoEsperado: 'efectivo' | 'transferencia' | 'cheque' | 'otro';
  plazoChequeDias?: number;
}

export interface EsquemaPago {
  modalidad: 'pago_unico' | 'adelanto_saldo' | 'certificados_avance' | 'cuotas';
  fondoReparoPct?: number; // Ej: 5% retenido hasta recepción final
  hitos: HitoPago[];
}

export type EstadoPresupuesto = 'borrador' | 'enviado' | 'aprobado' | 'rechazado' | 'vencido';

export type TipoFactura = 'Factura A' | 'Factura B' | 'Factura C' | 'Presupuesto X (Sin Factura)';

export interface ImpuestoItem {
  id: string;
  nombre: string; // "IVA (21%)", "Ingresos Brutos (IIBB)", "Tasa Municipal"
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

export interface Proveedor {
  id: string;
  nombre: string;
  cuit?: string;
  telefono?: string;
  email?: string;
  contacto?: string;
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

export interface Presupuesto {
  id: string;
  numero: string; // Correlativo ej "IEBA-2026-0001"
  clienteId: string;
  proyectoId?: string;
  fechaEmision: string; // ISO String
  validezDias: number; // Ej: 15 días
  
  tipoFactura: TipoFactura;
  
  items: ItemPresupuesto[];
  costosIndirectosAplicados: CostoIndirectoSnapshot[];
  
  subtotalInsumos: number;
  subtotalManoObra: number;
  subtotalCostosDirectos: number;
  subtotalCostosIndirectos: number;
  costoTotalObra: number;
  
  margenPorcentaje: number; // Ej: 35%
  montoGanancia: number;
  
  impuestosDetalle: ImpuestoItem[];
  impuestosPorcentaje: number; // Suma acumulada de % impuestos
  montoImpuestos: number;
  
  totalARS: number;
  
  // Referencia Opcional Multimoneda (USD u otra)
  mostrarReferenciaMonedaExtranjera: boolean;
  nombreMonedaExtranjera: string; // "USD Blue", "USD Oficial"
  cotizacionMonedaExtranjera: number; // Valor de 1 USD en ARS (ej: 1350)
  totalMonedaExtranjera?: number; // totalARS / cotizacion
  
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
  fecha: string; // YYYY-MM-DD
  horasReales: number;
  categoriaManoObraId: string;
  cantidadEjecutada: number; // Ej: 8 bocas
  condicion?: 'normal' | 'dificultosa' | 'favorable';
  notas?: string;
}

export interface AppConfig {
  id: string;
  nombreEmpresa: string;
  subtituloEmpresa: string;
  cuit: string;
  telefono: string;
  email: string;
  direccion: string;
  dolarReferenciaNombre: string; // "USD Blue"
  dolarReferenciaValor: number; // Ej: 1350
  mostrarDolarPorDefecto: boolean;
  monotributista: boolean;
  tipoFacturaPorDefecto: TipoFactura;
  porcentajeIVAPorDefecto: number; // 21
  porcentajeIIBBPorDefecto: number; // 3.5
  margenPorDefectoPct: number;
  validezDiasPorDefecto: number;
  prefijoPresupuesto: string; // "IEBA"
  siguienteNumeroCorrelativo: number;
}
