// Core domain types for Cotizador Eléctrico (IEBA)
// Modelo reestructurado: CategoriaMaterial, Material, Producto, Oferta, Proveedor con Contactos y SolicitudCotizacion.

export const ESTADO_PRESUPUESTO = {
  BORRADOR: 'borrador',
  ENVIADO: 'enviado',
  APROBADO: 'aprobado',
  RECHAZADO: 'rechazado',
  VENCIDO: 'vencido'
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

export type AtributoSugerido = AtributoTemplate;

export interface SupercategoriaMaterial {
  id: string;
  nombre: string;
  orden?: number;
  icono?: string;
}

export interface CategoriaMaterial {
  id: string;
  nombre: string; // "Caños y Tuberías", "Cables Unipolares", etc.
  supercategoriaId?: string; // "canalizaciones", "conductores", "protecciones", etc.
  supercategoriaNombre?: string; // "Canalización y Contención", "Conductores y Cables", etc.
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

// ─── 1b. Cómputo Métrico Paramétrico de Materiales (Superficie, Trazado, Error) ──
export type ModeloEstimacionMaterial =
  | 'superficie_m2'              // Estimación por Superficie cubierta (m²)
  | 'longitud_caneria_fases'     // Estimación por Metros de cañería y N° de conductores
  | 'bocas_distancia'            // Estimación por Cantidad de bocas y distancia media
  | 'desperdicio_simple'         // Cantidad neta * (1 + % desperdicio)
  | 'formula_personalizada';     // Expresión matemática libre

export interface ParametrosEstimacionMaterial {
  modelo: ModeloEstimacionMaterial;
  // Variables de dimensionamiento
  superficieM2?: number;
  factorDensidadM2?: number;          // m de conductor o caño por m² de superficie cubierta
  longitudCaneriaM?: number;          // metros lineales de cañería / bandeja
  conductoresPorCaneria?: number;     // cantidad de conductores en simultáneo (ej: 3 para F+N+PE)
  adicionalBajadasPct?: number;       // % adicional por bajadas a cajas de tomas/llaves (ej: 15%)
  cantidadBocas?: number;
  distanciaPromedioBocasM?: number;
  
  // Margen de desperdicio, error de trazado, curvas y colas de empalme
  margenDesperdicioErrorPct: number;  // % error/desperdicio (ej: 10% = *1.10)
  
  // Resultado
  cantidadEstimadaTotal: number;
  formulaGenerada?: string;
  explicacionCalculo?: string;
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
  reglaEstimacionDefault?: Partial<ParametrosEstimacionMaterial>;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

// Alias de compatibilidad
export type Insumo = Material & {
  categoria?: string;
  unidad?: string;
  codigoProveedor?: string;
  precioActual?: number; // Canonical Base Neta (GMT)
  precioNeto?: number;   // Alias explícito de Base Neta
  alicuotaIVA?: number;  // Porcentaje de IVA del insumo (ej: 21, 10.5, 0)
  precioFinal?: number;  // Precio derivado con IVA incluido
  fechaActualizacion?: string;
  historialPrecios?: { fecha: string; precio: number; fuente: string; alicuotaIVA?: number }[];
  ofertas?: Oferta[];
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
  proveedorId?: string; // FK opcional si el proveedor está agendado
  proveedorNombre?: string; // Nombre del proveedor (agendado u ocasional/libre)
  precio: number; // Canonical: Precio Unitario Neto (Base Imponible) por unidad de consumo
  precioNeto?: number; // Alias explícito de Base Neta Unitaria
  alicuotaIVA?: number; // Porcentaje de IVA (default: 21)
  precioFinal?: number; // Precio Unitario Final con IVA
  presentacionCompra?: string; // Ej: 'Rollo x 100m', 'Bobina x 500m', 'Tira x 3m', 'Caja x 100u', 'Unidad'
  cantidadPorPresentacion?: number; // Factor de empaque (ej: 100, 500, 3, 1)
  precioPresentacion?: number; // Precio total del bulto/empaque completo
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
  incluirPorDefecto?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

// ─── 8. Tareas Tipo y Servicios Tercerizados ──────────────────────────────────
export interface CriterioAtributoMaterial {
  atributo: string; // Clave del atributo (ej: "polos", "In", "curva", "capacidad_modulos", "seccion")
  operador: '==' | '>=' | '<=' | '>' | '<' | '!=';
  valor: string | number; // Valor fijo ("2", "Curva C") o variable/expresión ("$calibre_principal", "4 + circuitos * 2")
}

export interface FiltroMaterialEnTarea {
  categoriaId: string; // ID de la categoría (ej: "cat-termomagneticas", "cat-diferenciales", "cat-tableros")
  criterios: CriterioAtributoMaterial[];
  estrategiaSeleccion?: 'menor_valor_que_cumpla' | 'mayor_valor_que_cumpla' | 'primer_coincidencia';
  atributoOrden?: string; // Atributo numérico sobre el que ordenar (ej: "In", "capacidad_modulos", "seccion")
  etiqueta?: string; // Nombre amigable (ej: "Térmica de cabecera", "Diferencial coordinado")
}

export interface ReglaInsumoDinamico {
  condicion: string; // Ej: "calibre_principal <= 25", "circuitos <= 2"
  materialId: string; // ID del material del catálogo que se asigna si la condición es verdadera
  descripcion?: string; // Etiqueta descriptiva opcional
}

export interface InsumoEnTarea {
  materialId?: string;
  insumoId?: string; // alias
  productoId?: string;
  nombreSlot?: string; // Nombre descriptivo del slot dinámico (ej: "Gabinete DIN", "Térmica General")
  filtroMaterial?: FiltroMaterialEnTarea; // Selector dinámico por categoría y atributos técnicos
  reglasDinamicas?: ReglaInsumoDinamico[]; // Reglas de selección por función / escalonamiento
  cantidad: number;
  formula?: string; // Phase 3: Fórmula matemática calculada opcional
  condicion?: string; // Condición lógica de inclusión (ej: "calibre_principal <= 25", "requiere_certificacion == 1")
  parametrosEstimacion?: ParametrosEstimacionMaterial;
}

export interface ManoObraEnTarea {
  categoriaId: string;
  horas: number;
  formula?: string; // Phase 3: Fórmula matemática calculada opcional
  condicion?: string; // Condición lógica de inclusión (ej: "requiere_certificacion == 1")
}

// ─── 8. Parámetros y Variables Paramétricas de Trabajos Tipo ─────────────────
export interface OpcionVariableTrabajo {
  id: string;
  label: string;
  valor: number;
}

/**
 * Parámetro de entrada que el usuario ingresa o selecciona al cotizar la tarea tipo.
 */
export interface ParametroTrabajoTipo {
  id: string; // Identificador en fórmulas (ej: "bocas", "circuitos", "k_estado", "desarmes")
  nombre: string; // Nombre visible (ej: "Cantidad de Bocas", "Superficie en m²")
  tipo: 'numero' | 'select' | 'boolean';
  valorDefault: number;
  unidad?: string; // ej: "bocas", "m²", "ml", "u"
  descripcion?: string; // Texto de ayuda
  opciones?: OpcionVariableTrabajo[]; // Cuando tipo === 'select'
}

/**
 * Variable interna calculada mediante fórmula matemática a partir de parámetros y/o variables previas.
 */
export interface VariableCalculadaTrabajoTipo {
  id: string; // Identificador en fórmulas (ej: "modulos_totales", "metros_cable", "k_complejidad")
  nombre: string; // Nombre visible (ej: "Módulos DIN Totales Requeridos", "Metros de Cable por Conductor")
  formula: string; // Expresión matemática (ej: "4 + circuitos * 2", "bocas * 12 * 1.10")
  unidad?: string; // ej: "módulos", "m", "hs"
  descripcion?: string; // Texto de ayuda o justificación técnica
}

// Alias de conveniencia
export type VariableTrabajoTipo = ParametroTrabajoTipo;

export interface TareaTipo {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  notasTecnicas?: string;
  clausulaExclusiones?: string; // Texto de exclusiones y resguardo legal / técnico

  // Parámetros de Entrada (Inputs del Usuario)
  parametros?: ParametroTrabajoTipo[];

  // Variables Internas Calculadas (Fórmulas Matemáticas Intermedias)
  variables?: VariableCalculadaTrabajoTipo[];

  // Costo Fijo de Operación / Setup / Base de Salida (no escala con las unidades)
  costoFijoOperativo?: number;
  descripcionCostoFijo?: string;

  insumos: InsumoEnTarea[];
  manoObra: ManoObraEnTarea[];
  factorCorreccion?: number;
  frecuenciaUso?: number;
  ultimoUsoFecha?: string;

  // Compatibilidad retroactiva opcional
  esParametrico?: boolean;
  tipoParametrizacion?: 'recableado_integral' | 'canalizacion_cableado' | 'personalizado';
  clausulaTecnicaDefault?: string;
  parametrosDefault?: Partial<ParametrosTrabajoTipo>;

  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

// ─── 8b. Parámetros de Complejidad y Multiplicadores de Trabajo Tipo ─────────
export type NivelAntiguedadEstado = 'moderna' | 'intermedia' | 'antigua' | 'personalizado';
export type NivelAccesibilidad = 'despejada' | 'habitada' | 'obstruida' | 'personalizado';
export type NivelAltura = 'estandar' | 'doble_altura' | 'gran_altura' | 'personalizado';

export interface ParametrosTrabajoTipo {
  // 1. Dimensionamiento Base
  cantidad: number;
  unidad: string;
  dimensionSecundariaValor?: number;
  dimensionSecundariaUnidad?: 'ml' | 'm2' | 'ninguna';
  escalaMaterialesConSecundaria?: boolean;

  // 2. Coeficientes de Complejidad
  estadoAntiguedad: NivelAntiguedadEstado;
  coeficienteEstado: number; // 1.0 (Moderna) | 1.25 (Intermedia) | 1.60 (Antigua)

  accesibilidad: NivelAccesibilidad;
  coeficienteAccesibilidad: number; // 1.0 (Despejada) | 1.15 (Habitada) | 1.35 (Obstruida)

  altura: NivelAltura;
  coeficienteAltura: number; // 1.0 (<=2.7m) | 1.25 (2.7m a 4m) | 1.50 (>4m)

  // Multiplicador acumulado = K_estado * K_acceso * K_altura
  coeficienteComplejidadTotal: number;

  // 3. Adicionales de Desarmado / Rearmado Especial
  artefactosEspecialesCantidad?: number;
  artefactosEspecialesDescripcion?: string;
  artefactosEspecialesCostoUnitario?: number;
  adicionalesDesarmadoTotal?: number;

  // 4. Cláusula Técnica Automática de Riesgo / Garantía
  clausulaTecnica?: string;
  incluirClausulaEnPresupuesto?: boolean;
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
  precioUnitarioCongelado: number; // Base Neta congelada
  alicuotaIVA?: number; // Porcentaje de IVA congelado (ej: 21, 10.5)
  precioFinalUnitarioCongelado?: number; // Precio con IVA congelado
  subtotalInsumo: number; // Subtotal Neto (precioUnitarioCongelado * cantidadTotal)
  subtotalInsumoFinal?: number; // Subtotal con IVA (precioFinalUnitarioCongelado * cantidadTotal)
  esAdHoc?: boolean;
  requiereCotizacionDirecta?: boolean;
  parametrosEstimacion?: ParametrosEstimacionMaterial;
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
  formulaCantidad?: string; // Phase 3: Fórmula matemática calculada opcional
  unidad: string;

  insumosSnapshot: InsumoSnapshot[];
  manoObraSnapshot: ManoObraSnapshot[];
  serviciosTercerizados?: ServicioTercerizado[];

  costoInsumos: number;
  costoManoObra: number;
  costoServiciosTercerizados?: number;
  costoDirectoTotal: number;

  condicionTrabajo?: 'normal' | 'dificultosa' | 'favorable';
  parametrosTrabajoTipo?: ParametrosTrabajoTipo;
  parametrosEstimacionMaterial?: ParametrosEstimacionMaterial;
  valoresParametros?: Record<string, number>;
  valoresVariables?: Record<string, number>;
  costoFijoOperativo?: number;
  descripcionCostoFijo?: string;
  clausulaExclusiones?: string;
  clausulaTecnica?: string;
  notasTecnicas?: string;
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
  condicionFiscalEmisor?: 'monotributo' | 'responsable_inscripto';
  modoIngresoPreciosDefault?: 'con_iva' | 'neto';
  alicuotaIVAPorDefecto?: number;
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
  categoriasTarea?: string[];

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

/**
 * Contexto de navegación para el filtrado enfocado del catálogo de materiales.
 * Permite que una Cotización (en edición o detalle) o un Trabajo Tipo abra el
 * Gestor de Materiales mostrando exclusivamente los insumos involucrados en la obra/tarea,
 * manteniendo todas las capacidades operativas (búsqueda web, marcas, ofertas y edición de precios).
 */
export interface MaterialFilterContext {
  /** Título descriptivo visible en el banner superior (ej: "Cotización #IEBA-2026-0042" o "Trabajo Tipo: Boca de Iluminación") */
  title: string;
  /** Lista de identificadores de materiales ('mat-...') que componen la cotización o tarea */
  materialIds: string[];
  /** Nombres de los materiales para respaldo de búsqueda semántica */
  materialNames?: string[];
  /** Mapa de cantidades de obra por materialId: { [matId]: { cantidad, unidad } } */
  quantities?: Record<string, { cantidad: number; unidad: string }>;
  /** Pestaña de origen para retornar al finalizar (ej: 'presupuestos' | 'tareasTipo') */
  returnTab?: string;
  /** Modo de vista de la cotización para retornar ('editor' | 'detail' | 'list') */
  returnViewMode?: 'list' | 'editor' | 'detail';
  /** ID del presupuesto activo para restaurar su estado al volver */
  returnPresupuestoId?: string;
}

