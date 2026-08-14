import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDatabaseSeed } from './db/database';
import { AppConfig, Presupuesto } from './core/types';
import { Header } from './components/Header';
import { ConfigModal } from './components/ConfigModal';
import { InsumosManager } from './components/InsumosManager';
import { ManoObraManager } from './components/ManoObraManager';
import { TareasTipoManager } from './components/TareasTipoManager';
import { ClientesManager } from './components/ClientesManager';
import { ProveedoresManager } from './components/ProveedoresManager';
import { SolicitudCotizacionManager } from './components/SolicitudesCotizacionManager';
import { PresupuestosList } from './components/PresupuestosList';
import { PresupuestoEditor } from './components/PresupuestoEditor';
import { PresupuestoDetail } from './components/PresupuestoDetail';
import { RegistroTrabajoManager } from './components/RegistroTrabajoManager';
import { LogisticaManager } from './components/LogisticaManager';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { OnboardingBanner } from './components/OnboardingBanner';
import { HelpCenterModal } from './components/HelpCenterModal';
import { useTheme } from './hooks/useTheme';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('presupuestos');
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'detail'>('list');
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState<string | undefined>(undefined);
  const [initialClienteId, setInitialClienteId] = useState<string | undefined>(undefined);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

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
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-28 md:py-6">
        {/* Onboarding Guidance Banner */}
        <OnboardingBanner
          onNavigateTab={(tab) => {
            setActiveTab(tab);
            setViewMode('list');
          }}
        />

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
                />
              )}
              {viewMode === 'detail' && selectedPresupuestoId && config && (
                <PresupuestoDetail
                  presupuestoId={selectedPresupuestoId}
                  config={config}
                  onBack={() => setViewMode('list')}
                  onEdit={() => setViewMode('editor')}
                  onDuplicate={handleDuplicatePresupuesto}
                />
              )}
            </>
          )}

          {activeTab === 'insumos' && <InsumosManager />}
          {activeTab === 'manoObra' && <ManoObraManager />}
          {activeTab === 'tareasTipo' && <TareasTipoManager />}
          {activeTab === 'clientes' && (
            <ClientesManager
              onSelectPresupuesto={handleSelectPresupuestoFromClientes}
              onEditPresupuesto={handleEditPresupuestoFromClientes}
              onNewPresupuestoForCliente={handleNewPresupuestoForCliente}
              onDuplicatePresupuesto={handleDuplicatePresupuesto}
            />
          )}
          {activeTab === 'proveedores' && <ProveedoresManager />}
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

      {/* PWA Notifications & Install Banner */}
      <PWAInstallBanner />
    </div>
  );
}
