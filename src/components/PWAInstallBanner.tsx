import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, WifiOff, CheckCircle2, X } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);
  const [needRefresh, setNeedRefresh] = useState<boolean>(false);
  const [offlineReady, setOfflineReady] = useState<boolean>(false);
  const [updateSWFn, setUpdateSWFn] = useState<(() => void) | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [showOfflineToast, setShowOfflineToast] = useState<boolean>(false);

  useEffect(() => {
    // 1. Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show banner if user hasn't dismissed it in this session
      if (!sessionStorage.getItem('ieba-pwa-install-dismissed')) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 2. Register Service Worker
    if ('serviceWorker' in navigator) {
      const updateSW = registerSW({
        onNeedRefresh() {
          setNeedRefresh(true);
        },
        onOfflineReady() {
          setOfflineReady(true);
          setTimeout(() => setOfflineReady(false), 5000);
        },
      });

      setUpdateSWFn(() => () => updateSW(true));
    }

    // 3. Network listener
    const handleOnline = () => {
      setIsOffline(false);
      setShowOfflineToast(false);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowOfflineToast(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('ieba-pwa-install-dismissed', 'true');
  };

  return (
    <aside aria-label="Notificaciones PWA" className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-md w-full px-4 sm:px-0">
      {/* 1. Install Prompt Banner */}
      {showInstallBanner && deferredPrompt && (
        <div className="bg-surface-container-high border border-primary/30 text-on-surface p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl text-primary shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">Instalar Cotizador IEBA</h4>
              <p className="text-xs text-on-surface-variant">Acceso rápido e instalación 100% offline en tu dispositivo.</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleInstallClick}
              className="bg-primary text-on-primary hover:bg-primary/90 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              Instalar
            </button>
            <button
              onClick={handleDismissInstall}
              className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg transition-colors"
              title="Desestimar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. New Version Available Toast */}
      {needRefresh && (
        <div className="bg-primary text-on-primary p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <div>
              <h4 className="font-semibold text-sm">Nueva versión disponible</h4>
              <p className="text-xs opacity-90">Actualizá para recibir las últimas mejoras.</p>
            </div>
          </div>
          <button
            onClick={() => updateSWFn && updateSWFn()}
            className="bg-on-primary text-primary hover:bg-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            Actualizar
          </button>
        </div>
      )}

      {/* 3. Offline Ready Notification */}
      {offlineReady && (
        <div className="bg-tertiary-container text-on-tertiary-container p-3 rounded-2xl shadow-lg flex items-center gap-3 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-tertiary" />
          <span>La aplicación está lista para funcionar offline sin conexión.</span>
        </div>
      )}

      {/* 4. Offline Toast Banner */}
      {isOffline && showOfflineToast && (
        <div className="bg-amber-900/90 text-amber-100 border border-amber-500/40 p-3 rounded-2xl shadow-lg flex items-center justify-between gap-3 text-xs font-medium backdrop-blur-md">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Sin conexión a internet. Modo autónomo Offline-First activo.</span>
          </div>
          <button
            onClick={() => setShowOfflineToast(false)}
            className="p-1 hover:bg-amber-800 rounded-md transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </aside>
  );
};
