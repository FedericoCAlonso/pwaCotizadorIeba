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
  Truck,
  ChevronDown
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
  const [showUtilsMenu, setShowUtilsMenu] = useState(false);

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
    setShowUtilsMenu(false);
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
    { id: 'insumos', label: 'Materiales', icon: Package },
    { id: 'manoObra', label: 'Mano de Obra', icon: Clock },
    { id: 'tareasTipo', label: 'Tareas Tipo', icon: Layers },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'proveedores', label: 'Proveedores', icon: Truck },
    { id: 'registroTrabajo', label: 'Registro', icon: HardHat }
  ];

  return (
    <header className="bg-slate-800/70 border-b border-slate-700/40 sticky top-0 z-30 backdrop-blur-md">
      {/* Single unified header row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 font-bold text-amber-400 tracking-wider shrink-0">
          <Zap className="w-4 h-4 fill-amber-400 text-amber-500" />
          <span className="text-sm">IEBA</span>
          <span className="hidden sm:inline text-slate-500 font-normal text-xs">Cotizador</span>
        </div>

        {/* Nav Tabs — scrollable */}
        <nav
          className="flex items-end gap-0.5 overflow-x-auto no-scrollbar flex-1 h-full"
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
                className={`flex items-center gap-1.5 px-3 h-full text-xs font-medium whitespace-nowrap border-b-2 transition-all ${
                  isActive
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden md:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Online status — discrete */}
          <div className={`hidden md:flex items-center gap-1 text-[11px] ${isOnline ? 'text-emerald-500' : 'text-amber-500'}`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          </div>

          {/* USD reference — clickable */}
          {config?.mostrarDolarPorDefecto && (
            <button
              onClick={onOpenConfig}
              className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700/50"
              title="Ajustar cotización de referencia"
            >
              <DollarSign className="w-3 h-3 text-emerald-400" />
              <span className="font-mono text-emerald-400">${config.dolarReferenciaValor}</span>
            </button>
          )}

          {/* Utils dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUtilsMenu((v) => !v)}
              className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
              title="Respaldo y Configuración"
              aria-label="Menú de utilidades"
            >
              <Settings className="w-4 h-4" />
            </button>

            {showUtilsMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUtilsMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-slate-800 border border-slate-700/60 rounded-xl shadow-lg py-1 min-w-[180px]">
                  <button
                    onClick={handleExportJSON}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/60 hover:text-white"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    Respaldar datos
                  </button>
                  <label className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/60 hover:text-white cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-slate-400" />
                    Restaurar datos
                    <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" aria-label="Seleccionar archivo de respaldo JSON" />
                  </label>
                  <hr className="border-slate-700/50 my-1" />
                  <button
                    onClick={() => { onOpenConfig(); setShowUtilsMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/60 hover:text-white"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    Configuración
                  </button>
                </div>
              </>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={onNewPresupuesto}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-xs transition active:scale-95 whitespace-nowrap"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nueva Cotización</span>
            <span className="sm:hidden">+</span>
          </button>
        </div>
      </div>

      {showExportSuccess && (
        <div className="bg-emerald-500/10 border-t border-emerald-500/20 text-emerald-400 text-xs px-4 py-1.5 text-center">
          ✓ Copia de seguridad guardada en descargas.
        </div>
      )}
    </header>
  );
};
