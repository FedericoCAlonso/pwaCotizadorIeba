import { SyncProviderType } from '../core/types';
import { SyncProvider } from './syncTypes';

/**
 * ISP (Interface Segregation Principle):
 * Interfaz segregada para aquellos proveedores de sincronización
 * que manejan autenticación con tokens de acceso (ej. Google Drive).
 * Los proveedores que no usan tokens (LocalFileSystem, ManualJson) no están forzados a implementarla.
 */
export interface TokenAuthenticableSyncProvider extends SyncProvider {
  setAccessToken(token: string, expiresInSeconds?: number, email?: string): void;
  getAccessToken(): string | null;
}

/**
 * DIP (Dependency Inversion Principle) y OCP (Open/Closed Principle):
 * Contrato abstracto para el registro de proveedores de sincronización.
 */
export interface ISyncProviderRegistry {
  register(provider: SyncProvider): void;
  get<T extends SyncProvider = SyncProvider>(type: SyncProviderType): T | undefined;
  getAll(): SyncProvider[];
  has(type: SyncProviderType): boolean;
  unregister(type: SyncProviderType): boolean;
}

/**
 * Implementación desacoplada del registro de proveedores de sincronización.
 * Permite registrar dinámicamente nuevos adaptadores de sincronización sin modificar
 * el motor de sincronización (`DecentralizedSyncEngine`).
 */
export class SyncProviderRegistry implements ISyncProviderRegistry {
  private providers = new Map<SyncProviderType, SyncProvider>();

  constructor(initialProviders: SyncProvider[] = []) {
    initialProviders.forEach((p) => this.register(p));
  }

  register(provider: SyncProvider): void {
    if (!provider || !provider.type) {
      throw new Error('[SyncProviderRegistry] Proveedor inválido o sin tipo definido.');
    }
    this.providers.set(provider.type, provider);
  }

  get<T extends SyncProvider = SyncProvider>(type: SyncProviderType): T | undefined {
    return this.providers.get(type) as T | undefined;
  }

  getAll(): SyncProvider[] {
    return Array.from(this.providers.values());
  }

  has(type: SyncProviderType): boolean {
    return this.providers.has(type);
  }

  unregister(type: SyncProviderType): boolean {
    return this.providers.delete(type);
  }
}
