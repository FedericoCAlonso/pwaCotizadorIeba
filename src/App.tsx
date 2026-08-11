import React, { useState, useEffect } from 'react';
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
import { PresupuestosList } from './components/PresupuestosList';
import { PresupuestoEditor } from './components/PresupuestoEditor';
import { PresupuestoDetail } from './components/PresupuestoDetail';
import { RegistroTrabajoManager } from './components/RegistroTrabajoManager';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('presupuestos');
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'detail'>('list');
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState<string | undefined>(undefined);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const configs = useLiveQuery(() => db.config.toArray());
  const config: AppConfig | undefined = configs && configs.length > 0 ? configs[0] : undefined;

  useEffect(() => {
    initializeDatabaseSeed();
  }, []);

  const handleNewPresupuesto = () => {
    setSelectedPresupuestoId(undefined);
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
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
        {activeTab === 'clientes' && <ClientesManager />}
        {activeTab === 'proveedores' && <ProveedoresManager />}
        {activeTab === 'registroTrabajo' && <RegistroTrabajoManager />}
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
    </div>
  );
}
