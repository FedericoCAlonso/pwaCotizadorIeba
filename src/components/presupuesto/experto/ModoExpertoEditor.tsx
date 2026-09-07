import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Code2,
  Terminal,
  FileCheck,
  Sparkles,
  Plus,
  FolderPlus,
  HelpCircle,
  Truck,
  Copy,
  Keyboard,
  RotateCcw,
  Zap,
  Package,
  Layers
} from 'lucide-react';
import {
  Cliente,
  TareaTipo,
  Insumo,
  CategoriaManoDeObra,
  ItemPresupuesto,
  CapituloPresupuesto,
  GastoPresupuestoConfig,
  TipoFactura,
  NivelMargenRiesgo,
  AppConfig
} from '../../../core/types';
import { TotalesPresupuestoResultado } from '../../../core/calculations';
import {
  serializePresupuestoToDSL,
  parseDSLToPresupuesto,
  generateExampleDSL,
  DSLDiagnostic,
  normalizeString,
  detectCursorContext,
  formatSlashCommandReplacement,
  handleYamlSmartEnter,
  CursorContextType
} from './dslParser';
import { SlashCommandMenu } from './SlashCommandMenu';
import { MultiMaterialPickerModal } from './MultiMaterialPickerModal';
import { ExpertInspector } from './ExpertInspector';
import { useToast } from '../../../contexts/ToastContext';

interface ModoExpertoEditorProps {
  clientes: Cliente[];
  clienteId: string;
  setClienteId: (id: string) => void;
  direccionObra: string;
  setDireccionObra: (direccion: string) => void;
  tipoFactura: TipoFactura;
  setTipoFactura: (tf: TipoFactura) => void;
  validezDias: number;
  setValidezDias: (dias: number) => void;
  margenPorcentaje: number | null;
  setMargenPorcentaje: (margen: number | null) => void;
  nivelMargenRiesgo?: NivelMargenRiesgo;
  setNivelMargenRiesgo?: (nivel: NivelMargenRiesgo) => void;
  margenRiesgoPorcentaje?: number;
  setMargenRiesgoPorcentaje?: (margen: number) => void;
  mostrarDolar: boolean;
  setMostrarDolar: (mostrar: boolean) => void;
  nombreDolar: string;
  setNombreDolar: (nombre: string) => void;
  cotizacionDolar: number;
  setCotizacionDolar: (cotizacion: number) => void;
  capitulos: CapituloPresupuesto[];
  setCapitulos: React.Dispatch<React.SetStateAction<CapituloPresupuesto[]>>;
  items: ItemPresupuesto[];
  setItems: React.Dispatch<React.SetStateAction<ItemPresupuesto[]>>;
  gastosConfig: GastoPresupuestoConfig[];
  setGastosConfig: React.Dispatch<React.SetStateAction<GastoPresupuestoConfig[]>>;
  totales: TotalesPresupuestoResultado;
  tareasTipo: TareaTipo[];
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  config?: AppConfig;
  onEmitirClick?: () => void;
  onSaveDraft: () => void;
  onToggleGuidedMode: () => void;
}

export const ModoExpertoEditor: React.FC<ModoExpertoEditorProps> = ({
  clientes,
  clienteId,
  setClienteId,
  direccionObra,
  setDireccionObra,
  tipoFactura,
  setTipoFactura,
  validezDias,
  setValidezDias,
  margenPorcentaje,
  setMargenPorcentaje,
  nivelMargenRiesgo = 'medio',
  setNivelMargenRiesgo,
  margenRiesgoPorcentaje,
  setMargenRiesgoPorcentaje,
  mostrarDolar,
  setMostrarDolar,
  nombreDolar,
  setNombreDolar,
  cotizacionDolar,
  setCotizacionDolar,
  capitulos,
  setCapitulos,
  items,
  setItems,
  gastosConfig,
  setGastosConfig,
  totales,
  tareasTipo,
  insumosMap,
  manoObraMap,
  config,
  onEmitirClick,
  onSaveDraft,
  onToggleGuidedMode
}) => {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Inicializar el texto desde el estado actual del presupuesto (o plantilla comentada)
  const [dslText, setDslText] = useState<string>(() => {
    return serializePresupuestoToDSL({
      clienteId,
      direccionObra,
      tipoFactura,
      validezDias,
      margenPorcentaje,
      nivelMargenRiesgo,
      margenRiesgoPorcentaje,
      mostrarDolar,
      nombreDolar,
      cotizacionDolar,
      capitulos,
      items,
      gastosConfig,
      clientes
    });
  });

  const [diagnostics, setDiagnostics] = useState<DSLDiagnostic[]>([]);
  const [clienteMatched, setClienteMatched] = useState<Cliente | undefined>(() => {
    return clientes.find((c) => c.id === clienteId);
  });

  // Estado del menú flotante de autocompletado (/ o @ o IntelliSense automático)
  const [slashMenuState, setSlashMenuState] = useState<{
    isOpen: boolean;
    query: string;
    cursorPosition: number;
    slashIndex: number;
    contextType: CursorContextType;
    replaceFullLine?: boolean;
  }>({
    isOpen: false,
    query: '',
    cursorPosition: 0,
    slashIndex: -1,
    contextType: 'general'
  });

  // Posición flotante dinámica del menú de autocompletado pegada al cursor
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 48, left: 16 });

  // Recalcular dinámicamente la posición del popover flotante en relación al cursor
  const updateMenuPosition = useCallback(() => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const cursorPos = slashMenuState.cursorPosition;
    const textBefore = dslText.slice(0, cursorPos);
    const lines = textBefore.split('\n');
    const lineIndex = lines.length - 1;
    const currentLine = lines[lineIndex] || '';

    const scrollTop = textarea.scrollTop;
    const clientHeight = textarea.clientHeight;
    const clientWidth = textarea.clientWidth;

    // En font-mono leading-6 cada renglón mide 24px, padding superior textarea = 16px (p-4)
    const lineHeight = 24;
    const paddingTop = 16;
    const cursorY = paddingTop + (lineIndex + 1) * lineHeight - scrollTop;

    // Altura estimada del menú flotante
    const menuEstimatedHeight = 280;
    let top = cursorY + 4;
    if (cursorY + menuEstimatedHeight > clientHeight && cursorY > menuEstimatedHeight) {
      top = cursorY - lineHeight - menuEstimatedHeight - 8;
    }

    // Columna gutter de números de línea (~48px) + padding textarea (16px)
    const gutterWidth = 48 + 16;
    const approxCharWidth = 8.4;
    let left = gutterWidth + currentLine.length * approxCharWidth;

    const maxLeft = Math.max(48, clientWidth - 360);
    left = Math.min(Math.max(48, left), maxLeft);

    setMenuPosition({ top: Math.max(8, top), left });
  }, [slashMenuState.cursorPosition, dslText]);

  useEffect(() => {
    if (slashMenuState.isOpen) {
      updateMenuPosition();
    }
  }, [slashMenuState.isOpen, slashMenuState.cursorPosition, updateMenuPosition]);

  // Modal de paleta rápida de materiales (Alt + M)
  const [showMultiMaterialModal, setShowMultiMaterialModal] = useState(false);

  const isInternalUpdateRef = useRef(false);

  // Parseo y sincronización del YAML con el ViewModel
  const handleParseAndSync = useCallback(
    (textToParse: string) => {
      const result = parseDSLToPresupuesto(textToParse, {
        clientes,
        tareasTipo,
        insumosMap,
        manoObraMap,
        config,
        existingItems: items,
        existingCapitulos: capitulos,
        existingGastos: gastosConfig
      });

      setDiagnostics(result.diagnostics);
      setClienteMatched(result.clienteMatched);

      isInternalUpdateRef.current = true;

      // Sincronizar hacia el ViewModel
      if (result.clienteId !== clienteId) setClienteId(result.clienteId);
      if (result.direccionObra !== direccionObra) setDireccionObra(result.direccionObra);
      if (result.tipoFactura !== tipoFactura) setTipoFactura(result.tipoFactura);
      if (result.validezDias !== validezDias) setValidezDias(result.validezDias);
      if (result.margenPorcentaje !== margenPorcentaje) setMargenPorcentaje(result.margenPorcentaje);

      if (setNivelMargenRiesgo && result.nivelMargenRiesgo !== nivelMargenRiesgo) {
        setNivelMargenRiesgo(result.nivelMargenRiesgo);
      }
      if (setMargenRiesgoPorcentaje && result.margenRiesgoPorcentaje !== margenRiesgoPorcentaje) {
        setMargenRiesgoPorcentaje(result.margenRiesgoPorcentaje);
      }

      if (result.mostrarDolar !== mostrarDolar) setMostrarDolar(result.mostrarDolar);
      if (result.nombreDolar !== nombreDolar) setNombreDolar(result.nombreDolar);
      if (result.cotizacionDolar !== cotizacionDolar) setCotizacionDolar(result.cotizacionDolar);

      setCapitulos(result.capitulos);
      setItems(result.items);
      setGastosConfig(result.gastosConfig);

      setTimeout(() => {
        isInternalUpdateRef.current = false;
      }, 50);
    },
    [
      clientes,
      tareasTipo,
      insumosMap,
      manoObraMap,
      config,
      items,
      capitulos,
      gastosConfig,
      clienteId,
      direccionObra,
      tipoFactura,
      validezDias,
      margenPorcentaje,
      nivelMargenRiesgo,
      margenRiesgoPorcentaje,
      mostrarDolar,
      nombreDolar,
      cotizacionDolar,
      setClienteId,
      setDireccionObra,
      setTipoFactura,
      setValidezDias,
      setMargenPorcentaje,
      setNivelMargenRiesgo,
      setMargenRiesgoPorcentaje,
      setMostrarDolar,
      setNombreDolar,
      setCotizacionDolar,
      setCapitulos,
      setItems,
      setGastosConfig
    ]
  );

  // Sincronizar desde cambios externos del ViewModel hacia el texto
  useEffect(() => {
    if (isInternalUpdateRef.current) return;

    const freshDSL = serializePresupuestoToDSL({
      clienteId,
      direccionObra,
      tipoFactura,
      validezDias,
      margenPorcentaje,
      nivelMargenRiesgo,
      margenRiesgoPorcentaje,
      mostrarDolar,
      nombreDolar,
      cotizacionDolar,
      capitulos,
      items,
      gastosConfig,
      clientes
    });

    if (freshDSL !== dslText) {
      setDslText(freshDSL);
    }
  }, [
    clienteId,
    direccionObra,
    tipoFactura,
    validezDias,
    margenPorcentaje,
    nivelMargenRiesgo,
    margenRiesgoPorcentaje,
    mostrarDolar,
    nombreDolar,
    cotizacionDolar,
    capitulos,
    items,
    gastosConfig
  ]);

  // Atajo global para abrir paleta rápida de materiales (Alt + M, Alt + I, Ctrl + M)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const isM = e.key === 'm' || e.key === 'M';
      const isI = e.key === 'i' || e.key === 'I';
      if ((e.altKey && (isM || isI)) || ((e.ctrlKey || e.metaKey) && isM)) {
        e.preventDefault();
        setShowMultiMaterialModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  // Debounce para parsear mientras el usuario escribe fluido
  const parseDebounceTimerRef = useRef<any>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const cursorPos = e.target.selectionStart;
    setDslText(newText);

    const textBeforeCursor = newText.slice(0, cursorPos);
    const lastLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
    const currentLine = textBeforeCursor.slice(lastLineStart);

    // Detectar contexto semántico de la línea actual
    const { contextType, activeCategory } = detectCursorContext(textBeforeCursor);

    // 1. Detección explícita de "/" o "@"
    const explicitTriggerMatch = currentLine.match(/([\/@])([a-zA-Z0-9áéíóúÁÉÍÓÚ\s]*)$/);

    if (explicitTriggerMatch) {
      const triggerChar = explicitTriggerMatch[1];
      const queryStr = explicitTriggerMatch[2];
      const triggerIndex = lastLineStart + (explicitTriggerMatch.index || 0);

      setSlashMenuState({
        isOpen: true,
        query: `${triggerChar}${queryStr}`,
        cursorPosition: cursorPos,
        slashIndex: triggerIndex,
        contextType: triggerChar === '@' ? 'general' : contextType,
        replaceFullLine: false
      });
    } else {
      // 2. Detección automática tipo IntelliSense mientras escribe en un renglón de lista (-)
      // Ej: "- cab", "- 25 m cab", "- ofi", "- bo"
      const autoSuggestMatch = currentLine.match(/-\s*(?:[0-9.,]+\s*[a-zA-ZáéíóúÁÉÍÓÚ²³]*\s*)?([a-zA-ZáéíóúÁÉÍÓÚ]{2,}[a-zA-Z0-9áéíóúÁÉÍÓÚ\s]*)$/);
      const isKeyword = autoSuggestMatch && /^(materiales|insumos|mano_obra|manoobra|mo):?$/i.test(autoSuggestMatch[1].trim());

      if (autoSuggestMatch && !isKeyword) {
        const typedQuery = autoSuggestMatch[1].trim();
        const queryIndexInLine = currentLine.lastIndexOf(autoSuggestMatch[1]);
        const triggerIndex = lastLineStart + queryIndexInLine;

        // Si hay una subcategoría activa en el bloque (ej: "cables:"), prefijarla para filtrar
        const queryWithCategory = activeCategory ? `${activeCategory}/${typedQuery}` : typedQuery;

        setSlashMenuState({
          isOpen: true,
          query: queryWithCategory,
          cursorPosition: cursorPos,
          slashIndex: triggerIndex,
          contextType,
          replaceFullLine: false
        });
      } else {
        if (slashMenuState.isOpen) {
          setSlashMenuState((prev) => ({ ...prev, isOpen: false }));
        }
      }
    }

    if (parseDebounceTimerRef.current) {
      clearTimeout(parseDebounceTimerRef.current);
    }
    parseDebounceTimerRef.current = setTimeout(() => {
      handleParseAndSync(newText);
    }, 250);
  };

  // Manejo de atajos de teclado en el editor (Enter con auto-indentación, Tab para sangría, Ctrl+Enter para guardar)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMenuState.isOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      // El SlashCommandMenu maneja las flechas
      return;
    }

    const isM = e.key === 'm' || e.key === 'M';
    const isI = e.key === 'i' || e.key === 'I';
    if ((e.altKey && (isM || isI)) || ((e.ctrlKey || e.metaKey) && isM)) {
      e.preventDefault();
      setShowMultiMaterialModal(true);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onSaveDraft();
      toast.success('Borrador guardado');
      return;
    }

    // Tab -> Inserta 2 espacios de indentación YAML
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const text = dslText;
      const newText = text.substring(0, start) + '  ' + text.substring(end);
      setDslText(newText);
      handleParseAndSync(newText);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
      return;
    }

    // ENTER: Auto-indentación inteligente con memoria de nivel, continuidad de listas y reestructuración YAML
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (e.defaultPrevented) return;
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const textBefore = dslText.substring(0, start);
      const textAfter = dslText.substring(end);

      const { newText, newCursorPos } = handleYamlSmartEnter({ textBefore, textAfter });

      setDslText(newText);
      handleParseAndSync(newText);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newCursorPos;
        }
      }, 0);
      return;
    }
  };

  // Inserción de comando desde el SlashCommandMenu
  const handleSelectSlashCommand = (snippet: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const { cursorPosition } = slashMenuState;

    const textBeforeCursor = dslText.slice(0, cursorPosition);
    const lastLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
    const currentLineBeforeCursor = textBeforeCursor.slice(lastLineStart);

    const textAfterCursor = dslText.slice(cursorPosition);
    const nextNewline = textAfterCursor.indexOf('\n');
    const restOfDoc = nextNewline >= 0 ? textAfterCursor.slice(nextNewline) : '';

    const { replacementLine } = formatSlashCommandReplacement({
      currentLineBeforeCursor,
      snippet
    });

    const newText = dslText.slice(0, lastLineStart) + replacementLine + restOfDoc;

    setDslText(newText);
    setSlashMenuState({
      isOpen: false,
      query: '',
      cursorPosition: 0,
      slashIndex: -1,
      contextType: 'general'
    });

    handleParseAndSync(newText);

    setTimeout(() => {
      textarea.focus();
      const newPos = lastLineStart + replacementLine.length;
      textarea.selectionStart = textarea.selectionEnd = newPos;
    }, 10);
  };

  // Inserción masiva de materiales desde la paleta (Alt + M)
  const handleInsertMultipleMaterials = (formattedYamlLines: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const cursor = textarea.selectionStart;

    const textBefore = dslText.slice(0, cursor);
    const textAfter = dslText.slice(cursor);
    const lastLineStart = textBefore.lastIndexOf('\n') + 1;
    const currentLine = textBefore.slice(lastLineStart);

    // Detectar contexto para decidir si envolver con "materiales:"
    const { contextType, currentIndent } = detectCursorContext(textBefore);

    let contentToInsert = formattedYamlLines;
    if (contextType !== 'materiales') {
      // Si el usuario no está dentro de un bloque materiales:, envolverlo prolijamente
      const baseIndent = currentIndent.length > 0 ? currentIndent : '      ';
      const childIndent = baseIndent + '  ';
      const indentedLines = formattedYamlLines
        .split('\n')
        .filter(Boolean)
        .map((l) => `${childIndent}${l.trim()}`)
        .join('\n') + '\n';
      contentToInsert = `${baseIndent}materiales:\n${indentedLines}`;
    }

    let newText = '';
    let newCursorPos = 0;

    // Si la línea actual es un renglón de lista vacío o solo espacios, reemplazarlo
    if (/^\s*(-?\s*)?$/.test(currentLine)) {
      const nextNewline = textAfter.indexOf('\n');
      const restAfterLine = nextNewline >= 0 ? textAfter.slice(nextNewline + 1) : '';
      newText = dslText.slice(0, lastLineStart) + contentToInsert + restAfterLine;
      newCursorPos = lastLineStart + contentToInsert.length;
    } else {
      const needsLeadingNewline = !textBefore.endsWith('\n');
      newText = textBefore + (needsLeadingNewline ? '\n' : '') + contentToInsert + textAfter;
      newCursorPos = cursor + (needsLeadingNewline ? 1 : 0) + contentToInsert.length;
    }

    setDslText(newText);
    handleParseAndSync(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
    }, 10);

    toast.success('Insumos insertados correctamente en el YAML');
  };

  // Cargar plantilla de ejemplo
  const handleLoadExample = () => {
    const demo = generateExampleDSL(clientes[0]);
    setDslText(demo);
    handleParseAndSync(demo);
    toast.info('Plantilla de ejemplo cargada');
  };

  // Copiar YAML al portapapeles
  const handleCopyDSL = () => {
    navigator.clipboard.writeText(dslText);
    toast.success('Texto YAML copiado al portapapeles');
  };

  // Inserción de snippets rápidos desde la barra de herramientas
  const insertSnippet = (snippet: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newText = dslText.substring(0, start) + snippet + dslText.substring(end);
    setDslText(newText);
    handleParseAndSync(newText);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + snippet.length;
      }
    }, 10);
  };

  const lineCount = dslText.split('\n').length;

  // Extraer indentación actual para la paleta de materiales
  const currentIndentForPalette = useMemo(() => {
    if (!textareaRef.current) return '        ';
    const cursor = textareaRef.current.selectionStart || 0;
    const textBefore = dslText.slice(0, cursor);
    const { currentIndent } = detectCursorContext(textBefore);
    return currentIndent || '        ';
  }, [dslText]);

  return (
    <div className="space-y-4">
      {/* ─── Cabecera del Modo Experto Desktop ─── */}
      <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-on-surface">
                Modo Experto Desktop (Editor YAML Inteligente)
              </h2>
              <span className="text-[11px] font-mono font-bold bg-primary text-on-primary px-2 py-0.5 rounded-full shadow-2xs">
                YAML
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
              Escribe con auto-indentación, sugerencias en tiempo real y atajos de teclado sin mouse.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onToggleGuidedMode}
            className="px-3.5 py-2 bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface rounded-xl text-xs sm:text-sm font-bold border border-outline-variant/30 transition flex items-center gap-1.5 cursor-pointer min-h-[40px] active:scale-95"
            title="Volver a la vista guiada en 4 etapas (Alt + E)"
          >
            <RotateCcw className="w-4 h-4 text-primary" />
            <span>Volver a Modo Guiado</span>
          </button>

          <button
            type="button"
            onClick={onSaveDraft}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs min-h-[40px] active:scale-95"
            title="Guardar borrador actual (Ctrl + Enter)"
          >
            <span>Guardar</span>
            <kbd className="hidden sm:inline px-1 py-0.5 bg-on-primary/20 rounded font-mono text-[10px]">Ctrl+Enter</kbd>
          </button>
        </div>
      </div>

      {/* ─── Área Principal Split: Editor (7 cols) + Inspector en Vivo (5 cols) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Columna Izquierda: Editor Textual Monospace */}
        <div className="lg:col-span-7 space-y-2">
          {/* Barra de Atajos Rápidos */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            <button
              type="button"
              onClick={() => insertSnippet('\n  - 1 u ')}
              className="px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface-variant hover:text-on-surface font-semibold flex items-center gap-1 border border-outline-variant/20 transition shrink-0 cursor-pointer min-h-[34px]"
            >
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span>+ Partida</span>
            </button>

            <button
              type="button"
              onClick={() => insertSnippet('\n  - Tablero a Medida:\n      materiales:\n        - 1 u \n      mano_obra:\n        - 4 h Oficial\n')}
              className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-bold flex items-center gap-1 border border-primary/30 transition shrink-0 cursor-pointer min-h-[34px]"
              title="Crea una partida a medida con cómputo de materiales y mano de obra"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>+ Partida a Medida (APU)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMultiMaterialModal(true)}
              className="px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-primary font-bold flex items-center gap-1 border border-outline-variant/20 transition shrink-0 cursor-pointer min-h-[34px]"
              title="Abre la paleta para seleccionar múltiples insumos con cantidades (Alt + M)"
            >
              <Package className="w-3.5 h-3.5" />
              <span>📦 Paleta de Insumos</span>
              <kbd className="hidden sm:inline text-[10px] opacity-70 font-mono">Alt+M</kbd>
            </button>

            <button
              type="button"
              onClick={() => insertSnippet('\nCapítulo Nuevo:\n  - 1 u ')}
              className="px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface-variant hover:text-on-surface font-semibold flex items-center gap-1 border border-outline-variant/20 transition shrink-0 cursor-pointer min-h-[34px]"
            >
              <FolderPlus className="w-3.5 h-3.5 text-secondary" />
              <span>+ Capítulo</span>
            </button>

            <button
              type="button"
              onClick={() => insertSnippet('\ngastos:\n  - Viáticos: $ 15.000\n')}
              className="px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface-variant hover:text-on-surface font-semibold flex items-center gap-1 border border-outline-variant/20 transition shrink-0 cursor-pointer min-h-[34px]"
            >
              <Truck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>+ Gasto</span>
            </button>
          </div>

          {/* Lienzo del Editor con Números de Línea y Autocompletado */}
          <div className="relative bg-surface-container-lowest border border-outline-variant/30 rounded-3xl overflow-hidden shadow-xs focus-within:ring-2 focus-within:ring-primary/40 transition-shadow">
            <div className="flex text-xs text-on-surface-variant font-mono bg-surface-container-low/70 px-4 py-2 border-b border-outline-variant/20 items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-bold flex items-center gap-1 text-primary">
                  <Code2 className="w-4 h-4" />
                  <span>cotizacion.yaml</span>
                </span>
                <span>•</span>
                <span>{lineCount} líneas</span>
              </div>

              <div className="flex items-center gap-2 text-[11px]">
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

            <div className="relative flex">
              {/* Números de Línea */}
              <div className="py-4 pl-3 pr-2 select-none text-right font-mono text-xs text-on-surface-variant/40 bg-surface-container-lowest/50 border-r border-outline-variant/15 min-w-[3rem]">
                {Array.from({ length: lineCount }).map((_, idx) => (
                  <div key={idx} className="leading-6">
                    {idx + 1}
                  </div>
                ))}
              </div>

              {/* Textarea Monospace */}
              <textarea
                ref={textareaRef}
                value={dslText}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onScroll={updateMenuPosition}
                rows={22}
                placeholder={`cliente: Nombre del Cliente\nobra: Dirección de la Obra\nfactura: Factura A\n\nInstalación Eléctrica:\n  - 10 u Boca de Iluminación\n  - 5 u Tomacorriente Doble`}
                spellCheck={false}
                className="w-full p-4 bg-transparent text-on-surface font-mono text-xs sm:text-sm leading-6 resize-y focus:outline-none placeholder:text-on-surface-variant/30 min-h-[480px]"
              />

              {/* Popover contextual de autocompletado */}
              {slashMenuState.isOpen && (
                <SlashCommandMenu
                  query={slashMenuState.query}
                  tareasTipo={tareasTipo}
                  clientes={clientes}
                  insumosMap={insumosMap}
                  manoObraMap={manoObraMap}
                  contextType={slashMenuState.contextType}
                  position={menuPosition}
                  onSelect={handleSelectSlashCommand}
                  onClose={() =>
                    setSlashMenuState((prev) => ({ ...prev, isOpen: false }))
                  }
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
            clienteMatched={clienteMatched}
            direccionObra={direccionObra}
            capitulos={capitulos}
            items={items}
            diagnostics={diagnostics}
            onEmitirClick={onEmitirClick}
            onLoadExample={handleLoadExample}
            onCopyDSL={handleCopyDSL}
          />
        </div>
      </div>

      {/* Modal de Paleta Rápida de Insumos (Alt + M) */}
      <MultiMaterialPickerModal
        isOpen={showMultiMaterialModal}
        onClose={() => setShowMultiMaterialModal(false)}
        insumosMap={insumosMap}
        onInsertMaterials={handleInsertMultipleMaterials}
        currentIndent={currentIndentForPalette}
      />
    </div>
  );
};
