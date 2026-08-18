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
  AppConfig,
  SyncProviderType
} from '../core/types';

export interface MasterDatabasePayload {
  version: number;
  schemaVersion: number;
  exportedAt: string;
  deviceId?: string;
  categoriasMaterial: CategoriaMaterial[];
  materiales: Material[];
  productos: Producto[];
  ofertas: Oferta[];
  solicitudesCotizacion: SolicitudCotizacion[];
  insumos: Insumo[];
  manoObra: CategoriaManoDeObra[];
  costosIndirectos: CostoIndirecto[];
  tareasTipo: TareaTipo[];
  contactos?: Contacto[];
  clientes: Cliente[];
  proveedores: Proveedor[];
  proyectos: Proyecto[];
  presupuestos: Presupuesto[];
  registrosTrabajo: RegistroTrabajo[];
  config: AppConfig[];
  trazaProyectos?: any[];
  [key: string]: any;
}

export interface MergeStats {
  tablesProcessed: number;
  localUpdatedCount: number;
  localAddedCount: number;
  remoteNewerCount: number;
  localNewerCount: number;
  identicalCount: number;
}

export interface SyncExecutionResult {
  success: boolean;
  provider: SyncProviderType;
  timestamp: string;
  stats: MergeStats;
  message: string;
  error?: string;
}

export interface SyncProvider {
  readonly type: SyncProviderType;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  readMasterPayload(): Promise<MasterDatabasePayload | null>;
  writeMasterPayload(payload: MasterDatabasePayload): Promise<boolean>;
  getStatus(): { isConfigured: boolean; label: string; details?: string };
}
