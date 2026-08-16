import { useEffect } from 'react';

const TABS_ORDER = [
  'presupuestos',
  'insumos',
  'contactos',
  'registroTrabajo',
  'tareasTipo',
  'manoObra',
  'rfq',
  'logistica'
];

interface UseKeyboardShortcutsOptions {
  activeTab: string;
  viewMode: 'list' | 'editor' | 'detail';
  setActiveTab: (tab: string) => void;
  setViewMode: (mode: 'list' | 'editor' | 'detail') => void;
  onNewPresupuesto: () => void;
  onOpenShortcutsModal: () => void;
  isAnyModalOpen: boolean;
  onCloseActiveModals: () => void;
}

export function useKeyboardShortcuts({
  activeTab,
  viewMode,
  setActiveTab,
  setViewMode,
  onNewPresupuesto,
  onOpenShortcutsModal,
  isAnyModalOpen,
  onCloseActiveModals
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Verificar si el usuario está escribiendo activamente en un campo editable
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // --- Atajo Escape (Cerrar modal o Volver a lista) ---
      if (e.key === 'Escape') {
        const hasModalInDOM = !!document.querySelector('.fixed.inset-0, [role="dialog"]');
        if (hasModalInDOM || isAnyModalOpen) {
          onCloseActiveModals();
          return;
        }
        if (viewMode === 'editor' || viewMode === 'detail') {
          setViewMode('list');
          return;
        }
      }

      // --- Atajo Ctrl+S / Cmd+S (Guardar) ---
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('app:shortcut-save'));
        return;
      }

      // --- Atajos de Pestañas: Alt + 1..8 ---
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= TABS_ORDER.length) {
          e.preventDefault();
          const targetTab = TABS_ORDER[num - 1];
          setActiveTab(targetTab);
          setViewMode('list');
          return;
        }
      }

      // --- Atajo Buscar: Ctrl + K o '/' (solo fuera de inputs) ---
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        focusSearchInput();
        return;
      }

      // Si está escribiendo en un input, no procesamos teclas simples
      if (isEditable) return;

      // --- Atajo Buscar: '/' ---
      if (e.key === '/') {
        e.preventDefault();
        focusSearchInput();
        return;
      }

      // --- Atajo Ayuda de atajos: '?' o 'F1' ---
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        onOpenShortcutsModal();
        return;
      }

      // --- Atajo Contextual de Creación: '+' o 'n' / 'N' ---
      if (e.key === '+' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (activeTab === 'presupuestos' && viewMode === 'list') {
          onNewPresupuesto();
        } else {
          // Disparamos evento para el manager activo
          window.dispatchEvent(new CustomEvent('app:shortcut-new'));
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTab,
    viewMode,
    setActiveTab,
    setViewMode,
    onNewPresupuesto,
    onOpenShortcutsModal,
    isAnyModalOpen,
    onCloseActiveModals
  ]);
}

function focusSearchInput() {
  const searchInput = document.querySelector<HTMLInputElement>(
    'input[data-shortcut-search], input[type="text"][placeholder*="Buscar" i], input[type="search"]'
  );
  if (searchInput) {
    searchInput.focus();
    searchInput.select();
  }
}
