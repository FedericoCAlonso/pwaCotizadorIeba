import React, { useState, useEffect } from 'react';
import {
  Zap,
  Wifi,
  WifiOff,
  DollarSign,
  Download,
  Upload,
  Settings,
  FileText,
  Package,
  Clock,
  Layers,
  Users,
  HardHat,
  Truck,
  Sun,
  Moon,
  Monitor,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  Send,
  ShoppingCart,
  Menu,
  ChevronRight,
  X
} from 'lucide-react';
import { exportDatabaseJSON, importDatabaseJSON } from '../db/database';
import { AppConfig, ThemeMode } from '../core/types';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './AuthModal';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  config: AppConfig | undefined;
  onOpenConfig: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  config,
  onOpenConfig,
  themeMode,
  onThemeModeChange
}) => {
  const { user, syncState, lastSyncTime, logout, triggerSync } = useAuth();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [showUtilsMenu, setShowUtilsMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

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
    { id: 'insumos', label: 'Materiales & Precios', icon: Package },
    { id: 'tareasTipo', label: 'Laboratorio Tareas', icon: Layers },
    { id: 'registroTrabajo', label: 'Registro Obra', icon: HardHat },
    { id: 'manoObra', label: 'Mano de Obra', icon: Clock },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'proveedores', label: 'Proveedores', icon: Truck },
    { id: 'rfq', label: 'Solicitudes RFQ', icon: Send },
    { id: 'logistica', label: 'Logística', icon: ShoppingCart }
  ];

  const cycleTheme = () => {
    if (themeMode === 'system') onThemeModeChange('dark');
    else if (themeMode === 'dark') onThemeModeChange('light');
    else onThemeModeChange('system');
  };

  const getThemeIcon = () => {
    if (themeMode === 'dark') return <Moon className="w-5 h-5 text-primary" />;
    if (themeMode === 'light') return <Sun className="w-5 h-5 text-primary" />;
    return <Monitor className="w-5 h-5 text-primary" />;
  };

  const getThemeTitle = () => {
    if (themeMode === 'dark') return 'Tema Oscuro (Clic para cambiar a Claro)';
    if (themeMode === 'light') return 'Tema Claro (Clic para cambiar a Automático)';
    return 'Tema Automático / Sistema (Clic para cambiar a Oscuro)';
  };

  return (
    <header className="bg-surface sticky top-0 z-30 transition-colors shadow-sm border-b border-outline-variant/20">
      {/* Top App Bar area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 font-bold text-primary tracking-wider shrink-0">
          <div className="bg-primary-container p-2 rounded-full">
            <Zap className="w-5 h-5 fill-primary text-primary" />
          </div>
          <span className="text-lg">IEBA</span>
          <span className="hidden sm:inline text-on-surface-variant font-normal text-sm">Cotizador</span>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Online status — discrete */}
          <div className={`hidden md:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${isOnline ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-error-container text-on-error-container'}`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* USD reference — clickable */}
          {config?.mostrarDolarPorDefecto && (
            <button
              onClick={onOpenConfig}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-variant px-3 py-1.5 rounded-full transition-colors"
              title="Ajustar cotización de referencia"
            >
              <DollarSign className="w-4 h-4 text-tertiary" />
              <span className="font-mono">${config.dolarReferenciaValor}</span>
            </button>
          )}

          {/* Theme Quick Toggle */}
          <button
            onClick={cycleTheme}
            className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
            title={getThemeTitle()}
            aria-label="Cambiar tema de color"
          >
            {getThemeIcon()}
          </button>

          {/* Firebase Authentication & Cloud Sync Profile / Login */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-container/40 text-on-primary-container hover:bg-primary-container/70 border border-primary/20 transition-all text-xs font-medium"
                title={`Sesión iniciada: ${user.email}`}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-5 h-5 rounded-full" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold">
                    {user.email ? user.email[0].toUpperCase() : 'U'}
                  </div>
                )}
                <span className="hidden sm:inline max-w-[120px] truncate">{user.displayName || user.email?.split('@')[0]}</span>
                {syncState === 'syncing' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                ) : syncState === 'quota_exceeded' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                ) : syncState === 'error' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 z-20 bg-surface-container-high rounded-2xl shadow-xl py-3 min-w-[240px] border border-outline-variant/30 text-on-surface">
                    <div className="px-4 pb-2 border-b border-outline-variant/20 mb-2">
                      <p className="text-xs font-semibold text-on-surface truncate">{user.displayName || 'Usuario IEBA'}</p>
                      <p className="text-[11px] text-on-surface-variant truncate">{user.email}</p>
                      <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg ${
                        syncState === 'quota_exceeded'
                          ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                          : syncState === 'error'
                          ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
                          : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                      }`}>
                        {syncState === 'quota_exceeded' || syncState === 'error' ? (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>
                          {syncState === 'syncing'
                            ? 'Sincronizando...'
                            : syncState === 'quota_exceeded'
                            ? 'Cuota superada (Modo Local activo)'
                            : syncState === 'error'
                            ? 'Error de sincronización'
                            : lastSyncTime
                            ? `Sincronizado ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : 'Nube activa'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        triggerSync();
                        setShowUserMenu(false);
                      }}
                      disabled={syncState === 'syncing'}
                      className="w-full flex items-center gap-3 px-4 py-2 text-xs text-on-surface hover:bg-surface-container-highest transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 text-primary ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
                      Sincronizar ahora
                    </button>

                    <button
                      onClick={() => {
                        setShowAuthModal(true);
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-xs text-on-surface hover:bg-surface-container-highest transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4 text-on-surface-variant" />
                      Configuración de cuenta
                    </button>

                    <hr className="border-outline-variant/30 my-1" />

                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-xs text-error hover:bg-error-container/20 transition-colors font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-primary text-on-primary shadow-sm hover:bg-primary/90 transition-colors"
              title="Iniciar sesión para acceder desde cualquier dispositivo"
            >
              <Cloud className="w-4 h-4" />
              <span className="hidden sm:inline">Iniciar Sesión</span>
            </button>
          )}

          {/* Utils dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUtilsMenu((v) => !v)}
              className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
              title="Respaldo y Configuración"
              aria-label="Menú de utilidades"
            >
              <Settings className="w-5 h-5" />
            </button>

            {showUtilsMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUtilsMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-20 bg-surface-container-high rounded-2xl shadow-md py-2 min-w-[220px] border border-outline-variant/30 text-on-surface">
                  <div className="px-4 py-2 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Apariencia (Tema)
                  </div>
                  <div className="flex items-center justify-around px-3 py-1.5 border-b border-outline-variant/30 mb-1">
                    <button
                      onClick={() => { onThemeModeChange('system'); setShowUtilsMenu(false); }}
                      className={`p-2 rounded-xl flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${themeMode === 'system' ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-variant text-on-surface-variant'}`}
                      title="Automático según preferencia del dispositivo"
                    >
                      <Monitor className="w-4 h-4" />
                      <span>Auto</span>
                    </button>
                    <button
                      onClick={() => { onThemeModeChange('dark'); setShowUtilsMenu(false); }}
                      className={`p-2 rounded-xl flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${themeMode === 'dark' ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-variant text-on-surface-variant'}`}
                      title="Forzar modo oscuro"
                    >
                      <Moon className="w-4 h-4" />
                      <span>Oscuro</span>
                    </button>
                    <button
                      onClick={() => { onThemeModeChange('light'); setShowUtilsMenu(false); }}
                      className={`p-2 rounded-xl flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${themeMode === 'light' ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-variant text-on-surface-variant'}`}
                      title="Forzar modo claro"
                    >
                      <Sun className="w-4 h-4" />
                      <span>Claro</span>
                    </button>
                  </div>

                  <button
                    onClick={handleExportJSON}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest transition-colors"
                  >
                    <Download className="w-4 h-4 text-on-surface-variant" />
                    Respaldar datos (JSON)
                  </button>
                  <label className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer">
                    <Upload className="w-4 h-4 text-on-surface-variant" />
                    Restaurar datos (JSON)
                    <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" aria-label="Seleccionar archivo de respaldo JSON" />
                  </label>
                  <hr className="border-outline-variant/50 my-1" />
                  <button
                    onClick={() => { onOpenConfig(); setShowUtilsMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest transition-colors"
                  >
                    <Settings className="w-4 h-4 text-on-surface-variant" />
                    Configuración General
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Desktop Tab Navigation Area (Visible md and up) */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav
          className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 pt-1"
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
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mobile M3 Bottom Navigation Bar (Visible on mobile < md) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-high/95 backdrop-blur-md border-t border-outline-variant/30 px-1 py-1.5 flex items-center justify-around pb-safe shadow-lg"
        aria-label="Navegación inferior móvil"
      >
        {/* Primary 4 Mobile Navigation Items */}
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setShowMobileDrawer(false);
              }}
              className="flex flex-col items-center justify-center py-1 px-2 rounded-2xl min-w-[64px] min-h-[48px] transition-all"
            >
              <div
                className={`px-4 py-1 rounded-full flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-secondary-container text-on-secondary-container font-semibold scale-105'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <span
                className={`text-[10px] tracking-tight mt-0.5 transition-colors ${
                  isActive ? 'font-bold text-primary' : 'text-on-surface-variant'
                }`}
              >
                {item.label.split(' ')[0]}
              </span>
            </button>
          );
        })}

        {/* 5th Mobile Navigation Item: "Más" (Drawer Trigger) */}
        <button
          onClick={() => setShowMobileDrawer(true)}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-2xl min-w-[64px] min-h-[48px] transition-all"
          aria-label="Abrir menú de herramientas y más opciones"
        >
          <div
            className={`px-4 py-1 rounded-full flex items-center justify-center transition-all ${
              ['clientes', 'proveedores', 'rfq', 'registroTrabajo', 'logistica'].includes(activeTab) || showMobileDrawer
                ? 'bg-secondary-container text-on-secondary-container font-semibold scale-105'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </div>
          <span
            className={`text-[10px] tracking-tight mt-0.5 transition-colors ${
              ['clientes', 'proveedores', 'rfq', 'registroTrabajo', 'logistica'].includes(activeTab)
                ? 'font-bold text-primary'
                : 'text-on-surface-variant'
            }`}
          >
            Más
          </span>
        </button>
      </nav>

      {/* M3 Mobile Bottom Sheet Drawer for "Más" items */}
      {showMobileDrawer && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setShowMobileDrawer(false)}
            aria-hidden="true"
          />
          <div className="relative bg-surface-container border-t border-outline-variant/30 rounded-t-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 pb-safe animate-in slide-in-from-bottom duration-300">
            {/* Drag handle pill */}
            <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto mt-3 mb-2 shrink-0" />

            <div className="px-5 py-3 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low shrink-0">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base text-on-surface">Herramientas & Módulos IEBA</h3>
              </div>
              <button
                onClick={() => setShowMobileDrawer(false)}
                className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-variant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 touch-pan-y overscroll-contain">
              {/* Navigation Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setShowMobileDrawer(false);
                      }}
                      className={`flex items-center gap-3 p-3 rounded-2xl text-left transition-all min-h-[56px] border ${
                        isActive
                          ? 'bg-secondary-container text-on-secondary-container border-primary/30 shadow-xs'
                          : 'bg-surface-container-low hover:bg-surface-container-high border-outline-variant/20 text-on-surface'
                      }`}
                    >
                      <div className={`p-2 rounded-xl shrink-0 ${isActive ? 'bg-primary/20 text-primary' : 'bg-surface-variant text-on-surface-variant'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold block truncate">{item.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Utility Actions */}
              <div className="pt-3 border-t border-outline-variant/30 space-y-2">
                <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-1">
                  Acciones Rápidas
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      handleExportJSON();
                      setShowMobileDrawer(false);
                    }}
                    className="flex items-center gap-2 p-3 bg-surface-container-low hover:bg-surface-container-high rounded-2xl border border-outline-variant/20 text-xs font-medium text-on-surface min-h-[48px]"
                  >
                    <Download className="w-4 h-4 text-primary" />
                    <span>Respaldar JSON</span>
                  </button>

                  <label className="flex items-center gap-2 p-3 bg-surface-container-low hover:bg-surface-container-high rounded-2xl border border-outline-variant/20 text-xs font-medium text-on-surface cursor-pointer min-h-[48px]">
                    <Upload className="w-4 h-4 text-primary" />
                    <span>Restaurar JSON</span>
                    <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                  </label>
                </div>

                <button
                  onClick={() => {
                    onOpenConfig();
                    setShowMobileDrawer(false);
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-surface-container-low hover:bg-surface-container-high rounded-2xl border border-outline-variant/20 text-xs font-semibold text-on-surface min-h-[48px]"
                >
                  <div className="flex items-center gap-2.5">
                    <Settings className="w-4 h-4 text-primary" />
                    <span>Configuración General & Moneda</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExportSuccess && (
        <div className="bg-tertiary-container text-on-tertiary-container text-sm font-medium px-4 py-2 text-center shadow-md">
          ✓ Copia de seguridad guardada en descargas.
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </header>
  );
};
