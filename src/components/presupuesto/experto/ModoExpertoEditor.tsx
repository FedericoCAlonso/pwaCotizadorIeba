import React from 'react';
import {
  Code2,
  HelpCircle,
  Copy
} from 'lucide-react';
import { SlashCommandMenu } from './SlashCommandMenu';
import { ExpertInspector } from './ExpertInspector';
import { useToast } from '../../../contexts/ToastContext';
import { ModoExpertoToolbar } from './ModoExpertoToolbar';
import { ModoExpertoModals } from './ModoExpertoModals';
import { ModoExpertoCodeMirror } from './ModoExpertoCodeMirror';
import { useModoExpertoViewModel, ModoExpertoEditorProps } from './useModoExpertoViewModel';

export type { ModoExpertoEditorProps };

export const ModoExpertoEditor: React.FC<ModoExpertoEditorProps> = (props) => {
  const {
    clientes,
    direccionObra,
    tipoFactura,
    validezDias,
    margenPorcentaje,
    mostrarDolar,
    nombreDolar,
    capitulos,
    items,
    totales,
    tareasTipo,
    insumosMap,
    manoObraMap,
    onEmitirClick,
    onToggleGuidedMode
  } = props;

  const { toast } = useToast();
  const vm = useModoExpertoViewModel(props);

  return (
    <div className="space-y-4">
      {/* Aviso de degradación en pantalla móvil / sin teclado físico */}
      {vm.isMobileScreen && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <HelpCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Vista de sólo lectura:</strong> El modo experto requiere teclado físico. En dispositivos móviles se visualiza como consulta para no alterar el layout.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(vm.dslText);
                toast.success('Código YAML copiado al portapapeles');
              }}
              className="px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface font-semibold border border-outline-variant/30 flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-primary" />
              <span>Copiar YAML</span>
            </button>
            <button
              type="button"
              onClick={onToggleGuidedMode}
              className="px-3 py-1.5 bg-primary text-on-primary rounded-xl font-bold cursor-pointer"
            >
              Volver a Modo Guiado
            </button>
          </div>
        </div>
      )}

      {/* ─── Área Principal Split: Editor (7 cols) + Inspector en Vivo (5 cols) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Columna Izquierda: Editor Textual Monospace */}
        <div className="lg:col-span-7 space-y-2">
          {/* Barra de Atajos Rápidos */}
          <ModoExpertoToolbar
            createToolbarAction={vm.createToolbarAction}
            insertSnippet={vm.insertSnippet}
            onOpenMultiMaterialModal={() => vm.setShowMultiMaterialModal(true)}
            onOpenGastosModal={() => vm.setShowGastosModal(true)}
            onNavigateField={vm.handleNavigateField}
          />

          {/* Lienzo del Editor con Números de Línea y Autocompletado */}
          <div className="relative bg-surface-container-lowest border border-outline-variant/30 rounded-3xl overflow-hidden shadow-xs focus-within:ring-2 focus-within:ring-primary/40 transition-shadow">
            <div className="flex text-xs text-on-surface-variant font-mono bg-surface-container-low/70 px-4 py-2 border-b border-outline-variant/20 items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-bold flex items-center gap-1 text-primary">
                  <Code2 className="w-4 h-4" />
                  <span>cotizacion.yaml</span>
                </span>
                <span>•</span>
                <span>{vm.lineCount} líneas</span>
                <span>•</span>
                <span className="font-semibold text-primary/90 bg-primary/10 px-2 py-0.5 rounded text-[10px] sm:text-xs">
                  Fila {vm.cursorLineCol.line}, Col {vm.cursorLineCol.col}
                </span>

                {vm.activeFieldInfo && (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/20 text-primary border border-primary/40 text-[11px] font-bold rounded-full animate-pulse transition-all">
                    <span>📍 {vm.activeFieldInfo.label}</span>
                    {vm.activeFieldInfo.text !== '(vacío)' && (
                      <span className="opacity-90 font-mono text-[10px] truncate max-w-[140px]">
                        "{vm.activeFieldInfo.text}"
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px]">
                <kbd
                  className="px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/30 rounded font-mono font-semibold"
                  title="Navegar al siguiente campo (Alt+Enter o Tab si hay selección)"
                >
                  Alt+Enter campo
                </kbd>
                <kbd className="px-1.5 py-0.5 bg-surface-container rounded border border-outline-variant/20 font-mono">
                  Enter auto-indenta
                </kbd>
                <kbd className="px-1.5 py-0.5 bg-surface-container rounded border border-outline-variant/20 font-mono">
                  Alt+M insumos
                </kbd>
                <kbd className="px-1.5 py-0.5 bg-surface-container rounded border border-outline-variant/20 font-mono">
                  # comentarios
                </kbd>
              </div>
            </div>

            <div className="relative">
              <ModoExpertoCodeMirror
                value={vm.dslText}
                onChange={vm.handleCodeMirrorChange}
                diagnostics={vm.diagnostics}
                readOnly={vm.isMobileScreen}
                placeholder={`cliente: Nombre del Cliente\nobra: Dirección de la Obra\nfactura: Factura C\n\nInstalación Eléctrica:\n  - 10 u Boca de Iluminación: $ 12.500\n  - 5 u Tomacorriente Doble: $ 9.800`}
                onEditorReady={vm.setEditorView}
                onCursorChange={(line, col, pos) => {
                  vm.setCursorLineCol({ line, col });
                  vm.cursorPosRef.current = { start: pos, end: pos };
                }}
                onNavigateField={() => vm.handleNavigateField('forward')}
                onSlashTrigger={(info) => {
                  vm.setSlashMenuState({
                    isOpen: info.isOpen,
                    query: info.query,
                    cursorPosition: info.cursorPosition,
                    slashIndex: info.slashIndex,
                    contextType: info.contextType,
                    currentIndent: info.currentIndent,
                    directiveType: info.directiveType,
                    isExplicit: info.isExplicit
                  });
                  if (info.pos) {
                    vm.setMenuPosition(info.pos);
                  }
                }}
              />

              {/* Popover contextual de autocompletado */}
              {vm.slashMenuState.isOpen && (
                <SlashCommandMenu
                  query={vm.slashMenuState.query}
                  tareasTipo={tareasTipo}
                  clientes={clientes}
                  clienteMatched={vm.clienteMatched}
                  insumosMap={insumosMap}
                  manoObraMap={manoObraMap}
                  costosIndirectos={vm.catalogCostosIndirectos}
                  contextType={vm.slashMenuState.contextType}
                  currentIndent={vm.slashMenuState.currentIndent || ''}
                  directiveType={vm.slashMenuState.directiveType}
                  calculatedCells={vm.calculatedCells}
                  position={vm.menuPosition}
                  isExplicit={vm.slashMenuState.isExplicit}
                  onSelect={vm.handleSelectSlashCommand}
                  onClose={vm.handleCloseSlashMenu}
                />
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Inspector Económico Reactivo */}
        <div className="lg:col-span-5 sticky top-4">
          <ExpertInspector
            totales={totales}
            tipoFactura={tipoFactura}
            validezDias={validezDias}
            margenPorcentaje={margenPorcentaje}
            mostrarDolar={mostrarDolar}
            nombreDolar={nombreDolar}
            clienteMatched={vm.clienteMatched}
            clienteQuery={vm.clienteQuery}
            direccionObra={direccionObra}
            capitulos={capitulos}
            items={items}
            diagnostics={vm.diagnostics}
            calculatedCells={vm.calculatedCells}
            clientes={clientes}
            onSelectCliente={vm.handleSelectClienteFromUI}
            onOpenQuickClienteModal={vm.handleOpenQuickCliente}
            onSetDireccionObra={vm.handleSetDireccionObraFromUI}
            onEmitirClick={onEmitirClick}
            onLoadExample={vm.handleLoadExample}
            onCopyDSL={vm.handleCopyDSL}
            onAddMaterialToCatalog={vm.handleOpenQuickCreateMat}
          />
        </div>
      </div>

      {/* Conjunto de Diálogos Modales del Modo Experto */}
      <ModoExpertoModals
        showMultiMaterialModal={vm.showMultiMaterialModal}
        onCloseMultiMaterialModal={() => vm.setShowMultiMaterialModal(false)}
        insumosMap={insumosMap}
        onInsertMultipleMaterials={vm.handleInsertMultipleMaterials}
        currentIndentForPalette={vm.currentIndentForPalette}
        showGastosModal={vm.showGastosModal}
        onCloseGastosModal={() => vm.setShowGastosModal(false)}
        catalogCostosIndirectos={vm.catalogCostosIndirectos}
        onInsertGastos={vm.handleInsertGastos}
        isQuickCreateMatOpen={vm.isQuickCreateMatOpen}
        onCloseQuickCreateMat={() => vm.setIsQuickCreateMatOpen(false)}
        formDataQuickMat={vm.formDataQuickMat}
        setFormDataQuickMat={vm.setFormDataQuickMat}
        proveedores={vm.proveedores}
        onSaveQuickMat={vm.handleSaveQuickMat}
        isQuickClienteOpen={vm.isQuickClienteOpen}
        onCloseQuickCliente={() => vm.setIsQuickClienteOpen(false)}
        quickClienteInitialName={vm.quickClienteInitialName}
        onClienteCreated={vm.handleClienteCreated}
      />
    </div>
  );
};
