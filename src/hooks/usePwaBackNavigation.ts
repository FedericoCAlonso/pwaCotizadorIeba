import { useEffect, useRef } from 'react';
import { handlePopstateModalClose, getOpenModalsCount } from '../core/modalBackStack';
import { MaterialFilterContext } from '../core/types';

interface UsePwaBackNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  viewMode: 'list' | 'editor' | 'detail';
  setViewMode: (mode: 'list' | 'editor' | 'detail') => void;
  materialFilterContext: MaterialFilterContext | null;
  onClearMaterialFilter: () => void;
  toast: { info: (msg: string) => void };
}

/**
 * Hook centralizado de navegación móvil para PWA:
 * 1. Si hay un modal abierto → Cierra el modal (LIFO stack).
 * 2. Si hay un filtro de materiales activo → Limpia el filtro y regresa.
 * 3. Si está en una sub-pantalla (Editor o Detalle) → Regresa al listado.
 * 4. Si está en otra pestaña secundaria → Regresa a la pestaña principal (Presupuestos).
 * 5. Si está en la pantalla principal → Aplica el patrón "Doble toque para salir" con Toast.
 */
export function usePwaBackNavigation({
  activeTab,
  setActiveTab,
  viewMode,
  setViewMode,
  materialFilterContext,
  onClearMaterialFilter,
  toast
}: UsePwaBackNavigationProps) {
  const lastBackPressTimeRef = useRef<number>(0);
  const activeTabRef = useRef(activeTab);
  const viewModeRef = useRef(viewMode);
  const filterContextRef = useRef(materialFilterContext);

  activeTabRef.current = activeTab;
  viewModeRef.current = viewMode;
  filterContextRef.current = materialFilterContext;

  // 1. Inicializar la entrada base del historial para atrapar el retroceso en la raíz
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history) return;

    if (!window.history.state || !window.history.state.appRoot) {
      window.history.replaceState({ appRoot: true, level: 0 }, '');
      window.history.pushState({ appRoot: true, level: 1 }, '');
    }
  }, []);

  // 2. Registrar transiciones de sub-vistas (Editor / Detalle) en el historial
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history) return;

    if (viewMode === 'editor' || viewMode === 'detail') {
      window.history.pushState({ viewMode, tab: activeTab }, '');
    }
  }, [viewMode]);

  // 3. Listener global de popstate (disparado al presionar Atrás o gesto de retroceso)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      // 1er Nivel: ¿Hay algún modal abierto?
      if (getOpenModalsCount() > 0 || handlePopstateModalClose()) {
        return;
      }

      // 2do Nivel: ¿Hay un contexto de filtro de insumos/materiales activo?
      if (filterContextRef.current) {
        onClearMaterialFilter();
        return;
      }

      // 3er Nivel: ¿Estamos en una sub-pantalla (Editor o Detalle)?
      if (viewModeRef.current !== 'list') {
        setViewMode('list');
        return;
      }

      // 4to Nivel: ¿Estamos en otra pestaña distinta a Presupuestos?
      if (activeTabRef.current !== 'presupuestos') {
        setActiveTab('presupuestos');
        return;
      }

      // 5to Nivel: Estamos en la Pantalla Raíz → Doble toque para salir
      const now = Date.now();
      const elapsed = now - lastBackPressTimeRef.current;

      if (elapsed < 2000) {
        // Segundo toque rápido (< 2 segundos) → Permitir salir de la app
        window.history.back();
      } else {
        // Primer toque → Avisar al usuario y retener el historial
        lastBackPressTimeRef.current = now;
        window.history.pushState({ appRoot: true, level: 1 }, '');
        toast.info('Toca atrás de nuevo para salir');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setActiveTab, setViewMode, onClearMaterialFilter, toast]);
}
