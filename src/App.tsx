import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDatabaseSeed } from './db/database';
import { AppConfig, Presupuesto, MaterialFilterContext } from './core/types';
import { Header } from './components/Header';
import { ConfigModal } from './components/ConfigModal';
import { InsumosManager } from './components/InsumosManager';
import { ManoObraManager } from './components/ManoObraManager';
import { TareasTipoManager } from './components/TareasTipoManager';
import { ContactosManager } from './components/ContactosManager';
import { SolicitudCotizacionManager } from './components/SolicitudesCotizacionManager';
import { PresupuestosList } from './components/PresupuestosList';
import { PresupuestoEditor } from './components/PresupuestoEditor';
import { PresupuestoDetail } from './components/PresupuestoDetail';
import { RegistroTrabajoManager } from './components/RegistroTrabajoManager';
import { LogisticaManager } from './components/LogisticaManager';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { HelpCenterModal } from './components/HelpCenterModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('presupuestos');
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'detail'>('list');
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState<string | undefined>(undefined);
  const [initialClienteId, setInitialClienteId] = useState<string | undefined>(undefined);
  const [materialFilterContext, setMaterialFilterContext] = useState<MaterialFilterContext | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const configs = useLiveQuery(() => db.config.toArray());
  const config: AppConfig | undefined = configs && configs.length > 0 ? configs[0] : undefined;

  const { themeMode, setThemeMode } = useTheme(config?.themeMode);

  useEffect(() => {
    initializeDatabaseSeed();
  }, []);

  const handleNewPresupuesto = () => {
    setSelectedPresupuestoId(undefined);
    setInitialClienteId(undefined);
    setViewMode('editor');
  };

  const handleViewMaterialsInCatalog = (ctx: MaterialFilterContext) => {
    setMaterialFilterContext(ctx);
    setActiveTab('insumos');
    setViewMode('list');
  };

  const handleClearMaterialFilter = () => {
    setMaterialFilterContext(null);
  };

  const handleReturnFromMaterialFilter = () => {
    if (materialFilterContext?.returnTab) {
      setActiveTab(materialFilterContext.returnTab);
      if (materialFilterContext.returnViewMode) {
        setViewMode(materialFilterContext.returnViewMode);
      }
      if (materialFilterContext.returnPresupuestoId) {
        setSelectedPresupuestoId(materialFilterContext.returnPresupuestoId);
      }
    } else {
      setActiveTab('presupuestos');
      setViewMode('list');
    }
    setMaterialFilterContext(null);
  };

  useKeyboardShortcuts({
    activeTab,
    viewMode,
    setActiveTab,
    setViewMode,
    onNewPresupuesto: handleNewPresupuesto,
    onOpenShortcutsModal: () => setShowShortcutsModal(true),
    isAnyModalOpen: showConfigModal || showHelpModal || showShortcutsModal,
    onCloseActiveModals: () => {
      setShowConfigModal(false);
      setShowHelpModal(false);
      setShowShortcutsModal(false);
    }
  });

  const handleNewPresupuestoForCliente = (clienteId: string) => {
    setSelectedPresupuestoId(undefined);
    setInitialClienteId(clienteId);
    setActiveTab('presupuestos');
    setViewMode('editor');
  };

  const handleSelectPresupuestoFromClientes = (id: string) => {
    setSelectedPresupuestoId(id);
    setActiveTab('presupuestos');
    setViewMode('detail');
  };

  const handleEditPresupuestoFromClientes = (id: string) => {
    setSelectedPresupuestoId(id);
    setActiveTab('presupuestos');
    setViewMode('editor');
  };

  const handleSelectPresupuesto = (id: string) => {
    setSelectedPresupuestoId(id);
    setViewMode('detail');
  };

  const handleEditPresupuesto = (id: string) => {
    setSelectedPresupuestoId(id);
    setViewMode('editor');
  };

  const handleDuplicatePresupuesto = async (p: Presupuesto) => {
    const year = new Date().getFullYear();
    const seq = config?.siguienteNumeroCorrelativo || 1001;
    const newNumero = `${config?.prefijoPresupuesto || 'IEBA'}-${year}-${seq.toString().padStart(4, '0')}`;

    if (config) {
      await db.config.update(config.id, { siguienteNumeroCorrelativo: seq + 1 });
    }

    const duplicated: Presupuesto = {
      ...p,
      id: `pres-${crypto.randomUUID()}`,
      numero: newNumero,
      fechaEmision: new Date().toISOString(),
      estado: 'borrador',
      fechaModificacion: new Date().toISOString()
    };

    await db.presupuestos.add(duplicated);
    setSelectedPresupuestoId(duplicated.id);
    setViewMode('detail');
  };

  const handleSavedPresupuesto = (id: string) => {
    setSelectedPresupuestoId(id);
    setViewMode('detail');
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col font-sans transition-colors duration-300">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setViewMode('list');
        }}
        config={config}
        onOpenConfig={() => setShowConfigModal(true)}
        onOpenHelp={() => setShowHelpModal(true)}
        onOpenShortcuts={() => setShowShortcutsModal(true)}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-28 md:py-6">
        {/* Tab panel — role="tabpanel" vincula el contenido activo al tablist via aria-controls */}
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={0}
          className="outline-none"
        >
          {activeTab === 'presupuestos' && (
            <>
              {viewMode === 'list' && (
                <PresupuestosList
                  onNew={handleNewPresupuesto}
                  onSelect={handleSelectPresupuesto}
                  onEdit={handleEditPresupuesto}
                />
              )}
              {viewMode === 'editor' && config && (
                <PresupuestoEditor
                  presupuestoId={selectedPresupuestoId}
                  initialClienteId={initialClienteId}
                  config={config}
                  onBack={() => setViewMode('list')}
                  onSaved={handleSavedPresupuesto}
                  onViewMaterialsInCatalog={handleViewMaterialsInCatalog}
                />
              )}
              {viewMode === 'detail' && selectedPresupuestoId && config && (
                <PresupuestoDetail
                  presupuestoId={selectedPresupuestoId}
                  config={config}
                  onBack={() => setViewMode('list')}
                  onEdit={() => setViewMode('editor')}
                  onDuplicate={handleDuplicatePresupuesto}
                  onViewMaterialsInCatalog={handleViewMaterialsInCatalog}
                />
              )}
            </>
          )}

          {activeTab === 'insumos' && (
            <InsumosManager
              filterContext={materialFilterContext}
              onClearFilter={handleClearMaterialFilter}
              onReturnToSource={handleReturnFromMaterialFilter}
            />
          )}
          {activeTab === 'manoObra' && <ManoObraManager />}
          {activeTab === 'tareasTipo' && (
            <TareasTipoManager
              onViewMaterialsInCatalog={handleViewMaterialsInCatalog}
            />
          )}
          {(activeTab === 'contactos' || activeTab === 'clientes' || activeTab === 'proveedores') && (
            <ContactosManager
              onSelectPresupuesto={handleSelectPresupuestoFromClientes}
              onEditPresupuesto={handleEditPresupuestoFromClientes}
              onNewPresupuestoForCliente={handleNewPresupuestoForCliente}
              onDuplicatePresupuesto={handleDuplicatePresupuesto}
              onNewRFQForProveedor={() => setActiveTab('rfq')}
            />
          )}
          {activeTab === 'rfq' && <SolicitudCotizacionManager />}
          {activeTab === 'registroTrabajo' && <RegistroTrabajoManager />}
          {activeTab === 'logistica' && <LogisticaManager />}
        </div>
      </main>

      {/* Footer */}
      <footer className="no-print py-4 text-center text-xs text-on-surface-variant/70">
        Cotizador Eléctrico IEBA — Standalone · Offline-First · PWA
      </footer>

      {/* Config Modal */}
      {config && (
        <ConfigModal
          config={config}
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          onSave={() => {}}
        />
      )}

      {/* Help Center Modal */}
      <HelpCenterModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        onOpenImporter={() => {
          setActiveTab('insumos');
          setViewMode('list');
        }}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {/* PWA Notifications & Install Banner */}
      <PWAInstallBanner />
    </div>
  );
}
