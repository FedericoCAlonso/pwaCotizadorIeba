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
  ShieldCheck,
  Send,
  ShoppingCart,
  Menu,
  ChevronRight,
  X,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { exportDatabaseJSON, importDatabaseJSON } from '../db/database';
import { AppConfig, ThemeMode } from '../core/types';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './AuthModal';
import { ModalContainer } from './ModalContainer';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  config: AppConfig | undefined;
  onOpenConfig: () => void;
  onOpenHelp?: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  config,
  onOpenConfig,
  onOpenHelp,
  themeMode,
  onThemeModeChange
}) => {
  const {
    user,
    syncState,
    syncErrorMessage,
    lastSyncTime,
    lastResult,
    activeProvider,
    setActiveProvider,
    logout,
    triggerSync
  } = useAuth();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [showUtilsMenu, setShowUtilsMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

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

  useEffect(() => {
    if (showMobileDrawer) {
      document.body.classList.add('mobile-drawer-open');
    } else {
      document.body.classList.remove('mobile-drawer-open');
    }
    return () => {
      document.body.classList.remove('mobile-drawer-open');
    };
  }, [showMobileDrawer]);

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
    reader.onload = async (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        await importDatabaseJSON(content);
        setShowUtilsMenu(false);
        window.location.reload();
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
    { id: 'contactos', label: 'Contactos', icon: Users },
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

  const renderSyncBadge = () => {
    if (syncState === 'syncing') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span className="hidden sm:inline">Sincronizando...</span>
        </span>
      );
    }
    if (syncState === 'error') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-rose-500 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Error Sync</span>
        </span>
      );
    }
    if (syncState === 'synced') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
          <span className="hidden sm:inline">Al día</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
        <Cloud className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Local-First</span>
      </span>
    );
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

          {/* Help Center Button */}
          {onOpenHelp && (
            <button
              type="button"
              onClick={onOpenHelp}
              className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors"
              title="Centro de Ayuda y Guía de inicio"
              aria-label="Abrir centro de ayuda"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          )}

          {/* Firebase Authentication & Cloud Sync Profile / Login */}
          {user ? (
            <div className="relative flex items-center gap-2">
              {/* Reactive Sync Badge Button */}
              <button
                type="button"
                onClick={() => setShowSyncModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-container-highest hover:bg-surface-variant border border-outline-variant/30 transition-all text-xs"
                title="Estado de sincronización nube. Clic para ver detalles o reintentar."
              >
                {renderSyncBadge()}
              </button>

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
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 z-20 bg-surface-container-high rounded-2xl shadow-xl py-3 min-w-[240px] border border-outline-variant/30 text-on-surface">
                    <div className="px-4 pb-2 border-b border-outline-variant/20 mb-2">
                      <p className="text-xs font-semibold text-on-surface truncate">{user.displayName || 'Usuario IEBA'}</p>
                      <p className="text-[11px] text-on-surface-variant truncate">{user.email}</p>
                      <div
                        onClick={() => {
                          setShowSyncModal(true);
                          setShowUserMenu(false);
                        }}
                        className="mt-2 cursor-pointer"
                      >
                        {renderSyncBadge()}
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
                      Forzar Reintento Manual
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
        role="tablist"
      >
        {/* Primary 4 Mobile Navigation Items */}
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${item.id}`}
              id={`tab-mobile-${item.id}`}
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
          role="tab"
          aria-selected={['clientes', 'proveedores', 'rfq', 'registroTrabajo', 'logistica'].includes(activeTab)}
          aria-haspopup="dialog"
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            className="relative bg-surface-container border-t border-outline-variant/30 rounded-t-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 pb-safe pb-8 animate-in slide-in-from-bottom duration-300"
          >
            {/* Drag handle pill */}
            <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto mt-3 mb-2 shrink-0" />

            <div className="px-5 py-3 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low shrink-0">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" aria-hidden="true" />
                <h3 id="drawer-title" className="font-bold text-base text-on-surface">Herramientas & Módulos IEBA</h3>
              </div>
              <button
                onClick={() => setShowMobileDrawer(false)}
                className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-variant"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" aria-hidden="true" />
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

      {/* M3 Decentralized Sync Details Modal */}
      <ModalContainer
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
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
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
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
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
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
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
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
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            {syncState === 'error' ? (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
            )}

            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-sm">
                {syncState === 'error'
                  ? 'Atención al Sincronizar'
                  : syncState === 'syncing'
                  ? 'Sincronizando registros...'
                  : 'Almacenamiento Local-First Activo'}
              </h4>

              <p className="leading-relaxed">
                {syncState === 'error'
                  ? (syncErrorMessage || 'Ocurrió un inconveniente al conectar con el proveedor seleccionado.')
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-highest hover:bg-surface-variant text-on-surface rounded-xl text-xs font-semibold transition border border-outline-variant/30"
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
              <div className="grid grid-cols-2 gap-2 text-on-surface-variant font-mono text-[11px]">
                <div>Tablas sincronizadas: <strong className="text-on-surface">{lastResult.stats.tablesProcessed}</strong></div>
                <div>Actualizados en dispositivo: <strong className="text-emerald-600 dark:text-emerald-400">{lastResult.stats.localUpdatedCount + lastResult.stats.localAddedCount}</strong></div>
                <div>Novedades enviadas: <strong className="text-primary">{lastResult.stats.localNewerCount}</strong></div>
                <div>Registros idénticos: <strong className="text-on-surface">{lastResult.stats.identicalCount}</strong></div>
              </div>
            </div>
          )}

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
              onClick={() => setShowSyncModal(false)}
              className="px-4 py-2 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-variant"
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
              className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
              <span>Sincronizar Ahora</span>
            </button>
          </div>
        </div>
      </ModalContainer>
    </header>
  );
};
