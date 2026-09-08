import React from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ModalContainer } from '../ModalContainer';

interface SyncDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncDetailsModal: React.FC<SyncDetailsModalProps> = ({
  isOpen,
  onClose
}) => {
  const {
    syncState,
    syncErrorMessage,
    lastSyncTime,
    lastResult,
    activeProvider,
    setActiveProvider,
    triggerSync,
    triggerCleanup
  } = useAuth();

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      title="Sincronización Descentralizada (Offline-First)"
      subtitle="Sincroniza tus datos mediante Google Drive personal, Archivo Local o Respaldo JSON"
      icon={<Cloud className="w-5 h-5 text-primary" />}
      maxWidth="md"
    >
      <div className="space-y-4 text-on-surface">
        {/* Provider Selection Tabs */}
        <div className="flex bg-surface-container-high p-1 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => setActiveProvider('local_file')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeProvider === 'local_file'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            📁 Carpeta Local (PC)
          </button>

          <button
            type="button"
            onClick={() => setActiveProvider('google_drive')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeProvider === 'google_drive'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            ☁️ Google Drive
          </button>

          <button
            type="button"
            onClick={() => setActiveProvider('manual_json')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeProvider === 'manual_json'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            💾 Respaldo JSON
          </button>
        </div>

        {/* Main Status Banner */}
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 ${
            syncState === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
              : syncState === 'pending'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          {syncState === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
          ) : syncState === 'pending' ? (
            <Cloud className="w-5 h-5 shrink-0 mt-0.5 text-amber-500 animate-pulse" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
          )}

          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-sm">
              {syncState === 'error'
                ? 'Atención al Sincronizar'
                : syncState === 'syncing'
                ? 'Sincronizando registros...'
                : syncState === 'pending'
                ? 'Cambios locales pendientes de subir'
                : 'Almacenamiento Sincronizado'}
            </h4>

            <p className="leading-relaxed">
              {syncState === 'error'
                ? (syncErrorMessage || 'Ocurrió un inconveniente al conectar con el proveedor seleccionado.')
                : syncState === 'pending'
                ? 'Tienes modificaciones guardadas localmente en este dispositivo que aún no se han subido a la nube. Se enviarán automáticamente o puedes sincronizar ahora.'
                : activeProvider === 'local_file'
                ? 'Los cambios se fusionan automáticamente (Last-Write-Wins) con el archivo maestro en tu disco local o carpeta sincronizada (Dropbox, OneDrive, Google Drive Sync).'
                : activeProvider === 'google_drive'
                ? 'Los cambios se sincronizan directamente en tu cuenta personal de Google Drive sin intermediarios ni cuotas limitadas.'
                : 'Puedes exportar o restaurar el archivo JSON maestro con fusión inteligente de cambios.'}
            </p>

            {syncState === 'error' && activeProvider === 'google_drive' && (
              <div className="pt-2 flex flex-wrap gap-2">
                <a
                  href="https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=1064181500067"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Habilitar Google Drive API en Google Cloud (1 clic)</span>
                </a>

                <button
                  type="button"
                  onClick={async () => {
                    setActiveProvider('local_file');
                    try {
                      await triggerSync('local_file');
                    } catch {}
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-highest hover:bg-surface-variant text-on-surface rounded-xl text-xs font-semibold transition border border-outline-variant/30 cursor-pointer"
                >
                  <span>📁 Cambiar a Carpeta Local (Sin APIs)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Merge Result Statistics */}
        {lastResult && lastResult.stats && (
          <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-2 text-xs">
            <span className="font-bold text-on-surface block">Estadísticas de la última sincronización:</span>
            <div className="grid grid-cols-2 gap-2 text-on-surface-variant font-mono text-xs">
              <div>Tablas sincronizadas: <strong className="text-on-surface">{lastResult.stats.tablesProcessed}</strong></div>
              <div>Actualizados en dispositivo: <strong className="text-emerald-600 dark:text-emerald-400">{lastResult.stats.localUpdatedCount + lastResult.stats.localAddedCount}</strong></div>
              <div>Novedades enviadas: <strong className="text-primary">{lastResult.stats.localNewerCount}</strong></div>
              <div>Registros idénticos: <strong className="text-on-surface">{lastResult.stats.identicalCount}</strong></div>
            </div>
          </div>
        )}

        {/* Maintenance / Data Purge Section */}
        <div className="bg-surface-container-low p-3.5 rounded-2xl border border-dashed border-outline-variant/40 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              🧹 Depurar y Compactar Base de Datos
            </span>
            <span className="text-xs text-on-surface-variant leading-relaxed">
              Elimina permanentemente de la nube y del dispositivo los contactos, clientes, cotizaciones y relevamientos borrados o residuales.
            </span>
          </div>

          <button
            type="button"
            onClick={async () => {
              if (!confirm('¿Deseas purgar de la nube y del dispositivo todos los contactos, cotizaciones y relevamientos borrados o residuales?\n\nEsta acción dejará únicamente los registros activos y saneará la base de datos maestra.')) {
                return;
              }
              try {
                const res = await triggerCleanup();
                alert(res.message);
              } catch (err: any) {
                alert(err.message || 'Error al ejecutar la limpieza de datos');
              }
            }}
            disabled={syncState === 'syncing'}
            className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-xl border border-rose-200 dark:border-rose-800 transition disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {syncState === 'syncing' ? 'Depurando...' : 'Limpiar y Purgar'}
          </button>
        </div>

        {/* Sync Stats Info */}
        <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Proveedor activo:</span>
            <span className="font-semibold text-primary">
              {activeProvider === 'local_file' ? '📁 Archivo en Disco Local' : activeProvider === 'google_drive' ? '☁️ Google Drive Personal' : '💾 Manual JSON'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Última sincronización exitosa:</span>
            <span className="font-mono text-on-surface">
              {lastSyncTime ? lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Motor de Fusión:</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">Last-Write-Wins (LWW)</span>
          </div>
        </div>

        {/* Manual Retry Action Button */}
        <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-variant cursor-pointer"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                await triggerSync();
              } catch {}
            }}
            disabled={syncState === 'syncing'}
            className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
            <span>Sincronizar Ahora</span>
          </button>
        </div>
      </div>
    </ModalContainer>
  );
};
