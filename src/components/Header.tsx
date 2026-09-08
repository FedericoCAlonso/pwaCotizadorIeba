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
  HelpCircle,
  Keyboard
} from 'lucide-react';
import { exportDatabaseJSON, importDatabaseJSON } from '../db/database';
import { AppConfig, ThemeMode } from '../core/types';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './AuthModal';
import { SyncDetailsModal } from './header/SyncDetailsModal';
import { MobileNavDrawer } from './header/MobileNavDrawer';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  config: AppConfig | undefined;
  onOpenConfig: () => void;
  onOpenHelp?: () => void;
  onOpenShortcuts?: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  config,
  onOpenConfig,
  onOpenHelp,
  onOpenShortcuts,
  themeMode,
  onThemeModeChange
}) => {
  const {
    user,
    syncState,
    syncErrorMessage,
    lastSyncTime,
    activeProvider,
    hasPendingChanges,
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


  const handleExportJSON = async () => {
    try {
      await exportDatabaseJSON();
      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 3000);
    } catch (error) {
      console.error('Error al exportar base de datos:', error);
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await importDatabaseJSON(text);
      window.location.reload();
    } catch (error: any) {
      console.error('Error al importar base de datos:', error);
      alert(error.message || 'Error al restaurar archivo');
    }
  };

  const navItems = [
    { id: 'presupuestos' as const, label: 'Cotizaciones', icon: FileText },
    { id: 'contactos' as const, label: 'Contactos', icon: Users },
    { id: 'insumos' as const, label: 'Catálogo', icon: Package },
    { id: 'manoObra' as const, label: 'Tarifas MO', icon: HardHat },
    { id: 'costosIndirectos' as const, label: 'Logística', icon: Truck },
    { id: 'tareasTipo' as const, label: 'Tareas Tipo', icon: Layers },
    { id: 'registroTrabajo' as const, label: 'Historial Obra', icon: Clock },
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

  const formatTimeAgo = (date: Date | null): string => {
    if (!date) return '';
    const now = Date.now();
    const diffMin = Math.floor((now - date.getTime()) / 60000);
    if (diffMin < 1) return 'ahora';
    if (diffMin === 1) return 'hace 1m';
    if (diffMin < 60) return `hace ${diffMin}m`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderSyncBadge = () => {
    if (syncState === 'syncing') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-primary font-semibold" title="Sincronizando con la nube o archivo maestro...">
          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span className="hidden sm:inline">Sincronizando...</span>
          <span className="sm:hidden">Sync...</span>
        </span>
      );
    }
    if (syncState === 'error') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-rose-500 font-semibold" title={syncErrorMessage || 'Error de sincronización. Clic para reintentar.'}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Error Sync</span>
          <span className="sm:hidden">Error</span>
        </span>
      );
    }
    if (syncState === 'pending') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold" title="Hay modificaciones locales pendientes de subir a la nube">
          <Cloud className="w-3.5 h-3.5 shrink-0 text-amber-500 animate-pulse" />
          <span className="hidden sm:inline">Cambios pendientes</span>
          <span className="sm:hidden">Pendiente</span>
        </span>
      );
    }
    if (syncState === 'synced' && lastSyncTime) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium" title={`Última sincronización verificada: ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
          <span className="hidden sm:inline">Sincronizado {formatTimeAgo(lastSyncTime)}</span>
          <span className="sm:hidden">{lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium" title="Trabajando en modo local (Offline-First)">
        <Cloud className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Modo Local</span>
        <span className="sm:hidden">Local</span>
      </span>
    );
  };

  return (
    <header className="bg-surface sticky top-0 z-30 transition-colors shadow-sm border-b border-outline-variant/20">
      {/* Top App Bar area */}
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 md:px-5 lg:px-6 h-16 flex items-center justify-between gap-4">
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

          {/* Keyboard Shortcuts Button */}
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="hidden sm:flex p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
              title="Atajos de Teclado (Presiona ?)"
              aria-label="Ver atajos de teclado"
            >
              <Keyboard className="w-4 h-4" />
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
                  <div className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold">
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
                      <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
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
                      className={`p-2 rounded-xl flex flex-col items-center gap-1 text-xs font-medium transition-colors ${themeMode === 'system' ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-variant text-on-surface-variant'}`}
                      title="Automático según preferencia del dispositivo"
                    >
                      <Monitor className="w-4 h-4" />
                      <span>Auto</span>
                    </button>
                    <button
                      onClick={() => { onThemeModeChange('dark'); setShowUtilsMenu(false); }}
                      className={`p-2 rounded-xl flex flex-col items-center gap-1 text-xs font-medium transition-colors ${themeMode === 'dark' ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-variant text-on-surface-variant'}`}
                      title="Forzar modo oscuro"
                    >
                      <Moon className="w-4 h-4" />
                      <span>Oscuro</span>
                    </button>
                    <button
                      onClick={() => { onThemeModeChange('light'); setShowUtilsMenu(false); }}
                      className={`p-2 rounded-xl flex flex-col items-center gap-1 text-xs font-medium transition-colors ${themeMode === 'light' ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-variant text-on-surface-variant'}`}
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
      <div className="hidden md:block w-full max-w-[1920px] mx-auto px-3 sm:px-4 md:px-5 lg:px-6">
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
                className={`text-xs tracking-tight mt-0.5 transition-colors ${
                  isActive ? 'font-bold text-primary' : 'font-medium text-on-surface-variant'
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
          aria-selected={!['presupuestos', 'insumos', 'contactos', 'registroTrabajo'].includes(activeTab)}
          aria-haspopup="dialog"
          onClick={() => setShowMobileDrawer(true)}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-2xl min-w-[64px] min-h-[48px] transition-all"
          aria-label="Abrir menú de herramientas y más opciones"
        >
          <div
            className={`px-4 py-1 rounded-full flex items-center justify-center transition-all ${
              !['presupuestos', 'insumos', 'contactos', 'registroTrabajo'].includes(activeTab) || showMobileDrawer
                ? 'bg-secondary-container text-on-secondary-container font-semibold scale-105'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </div>
          <span
            className={`text-xs tracking-tight mt-0.5 transition-colors ${
              !['presupuestos', 'insumos', 'contactos', 'registroTrabajo'].includes(activeTab)
                ? 'font-bold text-primary'
                : 'font-medium text-on-surface-variant'
            }`}
          >
            Más
          </span>
        </button>
      </nav>

      {/* M3 Mobile Bottom Sheet Drawer for "Más" items */}
      <MobileNavDrawer
        isOpen={showMobileDrawer}
        onClose={() => setShowMobileDrawer(false)}
        navItems={navItems}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onOpenConfig={onOpenConfig}
      />

      {showExportSuccess && (
        <div className="bg-tertiary-container text-on-tertiary-container text-sm font-medium px-4 py-2 text-center shadow-md">
          ✓ Copia de seguridad guardada en descargas.
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* M3 Decentralized Sync Details Modal */}
      <SyncDetailsModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />
    </header>
  );
};
