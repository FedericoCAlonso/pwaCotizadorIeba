import React, { useState, useEffect } from 'react';
import {
  Zap,
  Wifi,
  WifiOff,
  DollarSign,
  Download,
  Upload,
  Settings,
  PlusCircle,
  FileText,
  Package,
  Clock,
  Layers,
  Users,
  HardHat,
  Truck
} from 'lucide-react';
import { db, exportDatabaseJSON, importDatabaseJSON } from '../db/database';
import { AppConfig } from '../core/types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNewPresupuesto: () => void;
  config: AppConfig | undefined;
  onOpenConfig: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onNewPresupuesto,
  config,
  onOpenConfig
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showExportSuccess, setShowExportSuccess] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleExportJSON = async () => {
    const json = await exportDatabaseJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IEBA-Cotizador-Backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportSuccess(true);
    setTimeout(() => setShowExportSuccess(false), 3000);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        await importDatabaseJSON(content);
        alert('¡Base de datos restaurada con éxito!');
        window.location.reload();
      } catch (err) {
        alert('Error al importar el archivo de respaldo: ' + err);
      }
    };
    reader.readAsText(file);
  };

  const navItems = [
    { id: 'presupuestos', label: 'Presupuestos', icon: FileText },
    { id: 'insumos', label: 'Materiales e Insumos', icon: Package },
    { id: 'manoObra', label: 'Mano de Obra & Indirectos', icon: Clock },
    { id: 'tareasTipo', label: 'Tareas Tipo', icon: Layers },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'proveedores', label: 'Proveedores', icon: Truck },
    { id: 'registroTrabajo', label: 'Registro de Trabajo', icon: HardHat }
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-xl">
      {/* Top Utility Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-amber-400 tracking-wider">
            <Zap className="w-4 h-4 fill-amber-400 text-amber-500 animate-pulse" />
            <span>IEBA COTIZADOR</span>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono">
              v1.0 PWA
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400 font-medium">Offline (IndexedDB Activo)</span>
              </>
            )}
          </div>
        </div>

        {/* Currency ticker & Backup Actions */}
        <div className="flex items-center gap-3">
          {config?.mostrarDolarPorDefecto && (
            <div
              onClick={onOpenConfig}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded border border-slate-700 cursor-pointer text-slate-200 transition"
              title="Haz clic para ajustar la cotización de referencia"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">{config.dolarReferenciaNombre}:</span>
              <span className="font-mono font-bold text-emerald-400">${config.dolarReferenciaValor} ARS</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Descargar copia de seguridad en JSON"
              aria-label="Respaldar base de datos en JSON"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Respaldar</span>
            </button>

            <label
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title="Restaurar copia de seguridad en JSON"
              aria-label="Restaurar base de datos desde JSON"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Restaurar</span>
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" aria-label="Seleccionar archivo de respaldo JSON" />
            </label>

            <button
              onClick={onOpenConfig}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Configuración de Empresa y Cotizador"
              aria-label="Abrir configuración de empresa y cotizador"
            >
              <Settings className="w-4 h-4 text-slate-300" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Nav Tabs */}
        <nav
          className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1"
          role="tablist"
          aria-label="Navegación principal"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${item.id}`}
                id={`tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Quick Create Quote Button */}
        <button
          onClick={onNewPresupuesto}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg shadow-md shadow-amber-500/20 transition transform active:scale-95 whitespace-nowrap text-sm"
        >
          <PlusCircle className="w-4 h-4 fill-slate-950 text-amber-500" />
          <span>Nueva Cotización</span>
        </button>
      </div>

      {showExportSuccess && (
        <div className="bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 text-xs px-4 py-1 text-center font-medium">
          ✓ Copia de seguridad guardada en descargas correctamente.
        </div>
      )}
    </header>
  );
};
