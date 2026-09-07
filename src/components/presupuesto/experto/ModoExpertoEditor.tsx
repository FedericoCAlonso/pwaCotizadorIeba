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
  AppConfig,
  Material,
  Oferta
} from '../../../core/types';
import { TotalesPresupuestoResultado, calcularPrecioNeto, calcularPrecioFinal } from '../../../core/calculations';
import {
  serializePresupuestoToDSL,
  parseDSLToPresupuesto,
  generateExampleDSL,
  DSLDiagnostic,
  normalizeString,
  detectCursorContext,
  detectSuggestTrigger,
  formatSlashCommandReplacement,
  handleYamlSmartEnter,
  handleYamlSmartBackspace,
  CursorContextType,
  CalculatedCell
} from './dslParser';
import { db } from '../../../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { SlashCommandMenu } from './SlashCommandMenu';
import { MultiMaterialPickerModal } from './MultiMaterialPickerModal';
import { QuickCreateMaterialModal } from '../../insumos/QuickCreateMaterialModal';
import { QuickClienteModal } from '../QuickClienteModal';
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
  const cursorPosRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const isFocusedRef = useRef(false);
  const lastTouchTimeRef = useRef(0);

  const updateCursorPos = useCallback((el: HTMLTextAreaElement) => {
    cursorPosRef.current = {
      start: el.selectionStart,
      end: el.selectionEnd
    };
  }, []);

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
  const [calculatedCells, setCalculatedCells] = useState<CalculatedCell[]>([]);
  const [clienteMatched, setClienteMatched] = useState<Cliente | undefined>(() => {
    return clientes.find((c) => c.id === clienteId);
  });
  const [clienteQuery, setClienteQuery] = useState<string | undefined>(undefined);
  const [isQuickClienteOpen, setIsQuickClienteOpen] = useState(false);
  const [quickClienteInitialName, setQuickClienteInitialName] = useState('');

  // Estado del menú flotante de autocompletado (/ o @ o IntelliSense automático)
  const [slashMenuState, setSlashMenuState] = useState<{
    isOpen: boolean;
    query: string;
    cursorPosition: number;
    slashIndex: number;
    contextType: CursorContextType;
    replaceFullLine?: boolean;
    directiveType?: 'cliente' | 'obra' | 'factura' | 'validez' | 'margen' | 'riesgo' | 'dolar';
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

  // Modal de alta rápida de material al catálogo (+ Catálogo)
  const [isQuickCreateMatOpen, setIsQuickCreateMatOpen] = useState(false);
  const [formDataQuickMat, setFormDataQuickMat] = useState<{
    nombre: string;
    unidadVenta: string;
    precio: number | null;
    alicuotaIVA?: number;
    modoPrecio?: 'con_iva' | 'neto';
    proveedorId: string;
    marca?: string;
  }>({
    nombre: '',
    unidadVenta: 'u',
    precio: null,
    alicuotaIVA: 21,
    modoPrecio: 'con_iva',
    proveedorId: '',
    marca: ''
  });

  const proveedores = useLiveQuery(() => db.contactos.where('roles').equals('proveedor').toArray()) || [];

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
      setCalculatedCells(result.calculatedCells || []);
      setClienteMatched(result.clienteMatched);
      setClienteQuery(result.clienteQuery);

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
      }, 300);
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

  // Sincronizar desde cambios externos del ViewModel hacia el texto (sólo si no está escribiendo en el editor)
  useEffect(() => {
    if (isInternalUpdateRef.current) return;
    // Si el usuario tiene el foco activo en el editor, el editor es la fuente de la verdad
    if (isFocusedRef.current || (textareaRef.current && document.activeElement === textareaRef.current)) return;

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

  // Abrir modal de alta rápida de material pre-completado desde el YAML
  const handleOpenQuickCreateMat = useCallback(
    (data: { nombre: string; unidad: string; precio: number | null; marca?: string }) => {
      setFormDataQuickMat({
        nombre: data.nombre,
        unidadVenta: data.unidad || 'u',
        precio: data.precio,
        alicuotaIVA: 21,
        modoPrecio: 'con_iva',
        proveedorId: proveedores[0]?.id || 'prov-general',
        marca: data.marca || ''
      });
      setIsQuickCreateMatOpen(true);
    },
    [proveedores]
  );

  // Guardar material, producto (marca) y oferta en la base de datos Dexie
  const handleSaveQuickMat = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formDataQuickMat.nombre.trim()) return;

      try {
        const catSinCatId = 'cat-sin-categoria';
        const catExists = await db.categoriasMaterial.get(catSinCatId);
        if (!catExists) {
          await db.categoriasMaterial.put({
            id: catSinCatId,
            nombre: 'Sin categoría (No asignado)',
            atributosSugeridos: []
          });
        }

        const now = new Date().toISOString();
        const matId = `mat-${crypto.randomUUID()}`;
        const newMat: Material = {
          id: matId,
          categoriaId: catSinCatId,
          nombre: formDataQuickMat.nombre.trim(),
          unidadVenta: formDataQuickMat.unidadVenta || 'u',
          atributos: [],
          activo: true,
          fichaIncompleta: true,
          createdAt: now,
          updatedAt: now
        };

        await db.materiales.add(newMat);

        // Si se especificó marca/producto, registrarlo en la tabla productos
        let productoId: string | undefined = undefined;
        if (formDataQuickMat.marca?.trim()) {
          productoId = `prod-${crypto.randomUUID()}`;
          await db.productos.add({
            id: productoId,
            materialId: matId,
            marca: formDataQuickMat.marca.trim(),
            modelo: '',
            esPreferido: true,
            activo: true,
            createdAt: now,
            updatedAt: now
          });
        }

        // Si se indicó precio, registrar Oferta
        if (formDataQuickMat.precio && formDataQuickMat.precio > 0) {
          const p = formDataQuickMat.precio;
          const modo = formDataQuickMat.modoPrecio || 'con_iva';
          const alicuota = formDataQuickMat.alicuotaIVA ?? 21;
          const precioNeto = modo === 'con_iva' ? calcularPrecioNeto(p, alicuota) : p;
          const precioFinal = modo === 'con_iva' ? p : calcularPrecioFinal(p, alicuota);

          const newOferta: Oferta = {
            id: `oferta-${crypto.randomUUID()}`,
            materialId: matId,
            productoId,
            proveedorId: formDataQuickMat.proveedorId || proveedores[0]?.id || 'prov-general',
            precio: precioNeto,
            precioNeto,
            alicuotaIVA: alicuota,
            precioFinal,
            fecha: now,
            fuente: 'manual'
          };
          await db.ofertas.add(newOferta);
        }

        toast.success(`Material "${newMat.nombre}" agregado al catálogo`);
        setIsQuickCreateMatOpen(false);

        // Disparar re-parseo tras un instante para reflejar el nuevo material en vivo
        setTimeout(() => {
          handleParseAndSync(dslText);
        }, 60);
      } catch (err: any) {
        toast.error('Error al guardar material en catálogo: ' + (err?.message || 'Error desconocido'));
      }
    },
    [formDataQuickMat, proveedores, toast, handleParseAndSync, dslText]
  );

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
    cursorPosRef.current = { start: cursorPos, end: e.target.selectionEnd };
    setDslText(newText);

    const textBeforeCursor = newText.slice(0, cursorPos);
    const lastLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
    const currentLine = textBeforeCursor.slice(lastLineStart);

    // Detectar contexto semántico de la línea actual
    const { contextType, activeCategory } = detectCursorContext(textBeforeCursor);

    const trigger = detectSuggestTrigger(currentLine);

    if (trigger) {
      const triggerIndex = lastLineStart + trigger.queryIndexInLine;
      const typedQuery = trigger.query.trim();

      if (trigger.directiveType) {
        setSlashMenuState({
          isOpen: true,
          query: typedQuery,
          cursorPosition: cursorPos,
          slashIndex: triggerIndex,
          contextType: trigger.directiveType === 'cliente' ? 'general' : contextType,
          replaceFullLine: true,
          directiveType: trigger.directiveType
        });
      } else if (trigger.isExplicit) {
        setSlashMenuState({
          isOpen: true,
          query: `${trigger.triggerChar}${trigger.query}`,
          cursorPosition: cursorPos,
          slashIndex: triggerIndex,
          contextType: trigger.triggerChar === '@' ? 'general' : contextType,
          replaceFullLine: false,
          directiveType: trigger.triggerChar === '@' ? 'cliente' : undefined
        });
      } else {
        // Si hay una subcategoría activa en el bloque (ej: "cables:"), prefijarla para filtrar
        const queryWithCategory = activeCategory ? `${activeCategory}/${typedQuery}` : typedQuery;

        setSlashMenuState({
          isOpen: true,
          query: queryWithCategory,
          cursorPosition: cursorPos,
          slashIndex: triggerIndex,
          contextType,
          replaceFullLine: false,
          directiveType: undefined
        });
      }
    } else {
      if (slashMenuState.isOpen) {
        setSlashMenuState((prev) => ({ ...prev, isOpen: false }));
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
      cursorPosRef.current = { start: start + 2, end: start + 2 };
      setDslText(newText);
      handleParseAndSync(newText);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus({ preventScroll: true });
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
      return;
    }

    // BACKSPACE: Navegación inteligente de niveles de indentación
    if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Solo si el cursor no tiene selección de texto
      if (start === end) {
        const textBefore = dslText.substring(0, start);
        const textAfter = dslText.substring(end);

        const smartBack = handleYamlSmartBackspace({ textBefore, textAfter });
        if (smartBack) {
          e.preventDefault();
          cursorPosRef.current = { start: smartBack.newCursorPos, end: smartBack.newCursorPos };
          setDslText(smartBack.newText);
          handleParseAndSync(smartBack.newText);

          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus({ preventScroll: true });
              textareaRef.current.selectionStart = textareaRef.current.selectionEnd = smartBack.newCursorPos;
            }
          }, 0);
          return;
        }
      }
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

      cursorPosRef.current = { start: newCursorPos, end: newCursorPos };
      setDslText(newText);
      handleParseAndSync(newText);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus({ preventScroll: true });
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newCursorPos;
        }
      }, 0);
      return;
    }
  };

  // Inserción de comando desde el SlashCommandMenu
  const handleSelectSlashCommand = (snippet: string) => {
    if (!textareaRef.current) return;

    // Acción especial: Registrar nuevo cliente en modal rápido
    if (snippet.startsWith('ACTION:NEW_CLIENT:')) {
      const initialName = snippet.replace('ACTION:NEW_CLIENT:', '').trim();
      setSlashMenuState({
        isOpen: false,
        query: '',
        cursorPosition: 0,
        slashIndex: -1,
        contextType: 'general'
      });
      setQuickClienteInitialName(initialName);
      setIsQuickClienteOpen(true);
      return;
    }

    const textarea = textareaRef.current;
    const { cursorPosition } = slashMenuState;

    const textBeforeCursor = dslText.slice(0, cursorPosition);
    const lastLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
    const currentLineBeforeCursor = textBeforeCursor.slice(lastLineStart);

    const textAfterCursor = dslText.slice(cursorPosition);
    const nextNewline = textAfterCursor.indexOf('\n');
    const restOfDoc = nextNewline >= 0 ? textAfterCursor.slice(nextNewline) : '';

    const { replacementLine, selectionRange, newCursorOffset } = formatSlashCommandReplacement({
      currentLineBeforeCursor,
      snippet,
      contextType: slashMenuState.contextType,
      directiveType: slashMenuState.directiveType
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
      textarea.focus({ preventScroll: true });
      if (selectionRange) {
        textarea.selectionStart = lastLineStart + selectionRange.start;
        textarea.selectionEnd = lastLineStart + selectionRange.end;
      } else {
        const offset = newCursorOffset !== undefined ? newCursorOffset : replacementLine.length;
        const newPos = lastLineStart + offset;
        textarea.selectionStart = textarea.selectionEnd = newPos;
      }
      cursorPosRef.current = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd
      };
    }, 10);
  };

  // Selección de cliente desde la UI (Inspector o Selector)
  const handleSelectClienteFromUI = useCallback(
    (cliente: Cliente) => {
      const cliName = cliente.razonSocial || cliente.nombre || '';
      let updatedDsl = dslText;

      // 1. Actualizar directiva cliente:
      if (/^cliente\s*:[^\r\n]*/mi.test(updatedDsl)) {
        updatedDsl = updatedDsl.replace(/^cliente\s*:[^\r\n]*/mi, `cliente: ${cliName}`);
      } else {
        updatedDsl = `cliente: ${cliName}\n` + updatedDsl;
      }

      // 2. Si el cliente tiene dirección y la obra está vacía o genérica, vincularla
      if (cliente.direccion && (!direccionObra || direccionObra === 'Dirección de la Obra')) {
        const fullDir = `${cliente.direccion}${cliente.localidad ? `, ${cliente.localidad}` : ''}`;
        if (/^obra\s*:[^\r\n]*/mi.test(updatedDsl)) {
          updatedDsl = updatedDsl.replace(/^obra\s*:[^\r\n]*/mi, `obra: ${fullDir}`);
        } else {
          updatedDsl = updatedDsl.replace(/^cliente\s*:[^\r\n]*/mi, (match) => `${match}\nobra: ${fullDir}`);
        }
      }

      // 3. Adecuar encuadre fiscal según condición IVA del cliente
      if (cliente.condicionIVA) {
        let suggestedFactura = '';
        if (cliente.condicionIVA === 'Responsable Inscripto') suggestedFactura = 'Factura A';
        else if (cliente.condicionIVA === 'Consumidor Final') suggestedFactura = 'Factura B';
        else if (cliente.condicionIVA === 'Monotributo') suggestedFactura = 'Factura C';
        else if (cliente.condicionIVA === 'Exento') suggestedFactura = 'Factura B';

        if (suggestedFactura && /^factura\s*:[^\r\n]*/mi.test(updatedDsl)) {
          updatedDsl = updatedDsl.replace(/^factura\s*:[^\r\n]*/mi, `factura: ${suggestedFactura}`);
        }
      }

      setDslText(updatedDsl);
      handleParseAndSync(updatedDsl);
    },
    [dslText, direccionObra, handleParseAndSync]
  );

  // Asignar domicilio a la directiva obra: en YAML
  const handleSetDireccionObraFromUI = useCallback(
    (direccion: string) => {
      let updatedDsl = dslText;
      if (/^obra\s*:[^\r\n]*/mi.test(updatedDsl)) {
        updatedDsl = updatedDsl.replace(/^obra\s*:[^\r\n]*/mi, `obra: ${direccion}`);
      } else {
        updatedDsl = updatedDsl.replace(/^cliente\s*:[^\r\n]*/mi, (match) => `${match}\nobra: ${direccion}`);
      }
      setDslText(updatedDsl);
      handleParseAndSync(updatedDsl);
    },
    [dslText, handleParseAndSync]
  );

  // Apertura de modal de cliente rápido
  const handleOpenQuickCliente = useCallback((initialName?: string) => {
    setQuickClienteInitialName(initialName || '');
    setIsQuickClienteOpen(true);
  }, []);

  // Callback cuando el cliente rápido se crea exitosamente en Dexie
  const handleClienteCreated = useCallback(
    async (newClienteId: string) => {
      try {
        const created = await db.contactos.get(newClienteId);
        if (created) {
          handleSelectClienteFromUI(created);
        }
      } catch (e) {
        console.error('Error al recuperar nuevo cliente creado:', e);
      }
    },
    [handleSelectClienteFromUI]
  );

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

  // Retención de foco y cursor en dispositivos móviles al abrir teclado virtual o rotar pantalla
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;

    const handleViewportChange = () => {
      if (isFocusedRef.current && textareaRef.current) {
        if (document.activeElement !== textareaRef.current) {
          textareaRef.current.focus({ preventScroll: true });
        }
        if (cursorPosRef.current) {
          textareaRef.current.selectionStart = cursorPosRef.current.start;
          textareaRef.current.selectionEnd = cursorPosRef.current.end;
        }
        if (slashMenuState.isOpen) {
          updateMenuPosition();
        }
      }
    };

    if (vv) {
      vv.addEventListener('resize', handleViewportChange);
      vv.addEventListener('scroll', handleViewportChange);
    }
    window.addEventListener('resize', handleViewportChange);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', handleViewportChange);
        vv.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [slashMenuState.isOpen, updateMenuPosition]);

  // Helper para botones de la barra que no deben robar foco ni cerrar el teclado virtual en móvil
  const createToolbarAction = (action: () => void) => ({
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault();
    },
    onTouchStart: (e: React.TouchEvent) => {
      if (textareaRef.current) {
        cursorPosRef.current = {
          start: textareaRef.current.selectionStart,
          end: textareaRef.current.selectionEnd
        };
      }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault();
      lastTouchTimeRef.current = Date.now();
      action();
      if (textareaRef.current) {
        textareaRef.current.focus({ preventScroll: true });
        if (cursorPosRef.current) {
          textareaRef.current.selectionStart = cursorPosRef.current.start;
          textareaRef.current.selectionEnd = cursorPosRef.current.end;
        }
      }
    },
    onClick: (e: React.MouseEvent) => {
      if (Date.now() - lastTouchTimeRef.current < 450) {
        e.preventDefault();
        return;
      }
      action();
      if (textareaRef.current) {
        textareaRef.current.focus({ preventScroll: true });
        if (cursorPosRef.current) {
          textareaRef.current.selectionStart = cursorPosRef.current.start;
          textareaRef.current.selectionEnd = cursorPosRef.current.end;
        }
      }
    }
  });

  // Inserción de snippets rápidos desde la barra de herramientas sin perder foco ni posición
  const insertSnippet = (snippet: string) => {
    if (!textareaRef.current) return;
    const start = cursorPosRef.current.start ?? textareaRef.current.selectionStart;
    const end = cursorPosRef.current.end ?? textareaRef.current.selectionEnd;
    const newText = dslText.substring(0, start) + snippet + dslText.substring(end);
    const newPos = start + snippet.length;

    cursorPosRef.current = { start: newPos, end: newPos };
    setDslText(newText);
    handleParseAndSync(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus({ preventScroll: true });
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newPos;
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
          <div className="expert-toolbar flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            <button
              type="button"
              {...createToolbarAction(() => insertSnippet('\n  - 1 u '))}
              className="px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface-variant hover:text-on-surface font-semibold flex items-center gap-1 border border-outline-variant/20 transition shrink-0 cursor-pointer min-h-[34px]"
            >
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span>+ Partida</span>
            </button>

            <button
              type="button"
              {...createToolbarAction(() =>
                insertSnippet(
                  '\n  - 1 u Reparación y Armado de Tablero:\n      materiales:\n        - Tablero Modular DIN 24 Módulos Superficie Chapa Metálica Puerta Ciega IP40:\n            cantidad: 1\n            marca: Gabexel\n      mano_obra:\n        - 4 h Oficial Electricista\n'
                )
              )}
              className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-bold flex items-center gap-1 border border-primary/30 transition shrink-0 cursor-pointer min-h-[34px]"
              title="Crea una partida a medida con cómputo de materiales y mano de obra"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>+ Partida APU</span>
            </button>

            <button
              type="button"
              {...createToolbarAction(() => setShowMultiMaterialModal(true))}
              className="px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-primary font-bold flex items-center gap-1 border border-outline-variant/20 transition shrink-0 cursor-pointer min-h-[34px]"
              title="Abre la paleta para seleccionar múltiples insumos con cantidades (Alt + M)"
            >
              <Package className="w-3.5 h-3.5" />
              <span>📦 Paleta Insumos</span>
              <kbd className="hidden sm:inline text-[10px] opacity-70 font-mono">Alt+M</kbd>
            </button>

            <button
              type="button"
              {...createToolbarAction(() => insertSnippet('\nCapítulo Nuevo:\n  - 1 u '))}
              className="px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface-variant hover:text-on-surface font-semibold flex items-center gap-1 border border-outline-variant/20 transition shrink-0 cursor-pointer min-h-[34px]"
            >
              <FolderPlus className="w-3.5 h-3.5 text-secondary" />
              <span>+ Capítulo</span>
            </button>

            <button
              type="button"
              {...createToolbarAction(() => insertSnippet('\ngastos:\n  - Viáticos: $ 15.000\n'))}
              className="px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface-variant hover:text-on-surface font-semibold flex items-center gap-1 border border-outline-variant/20 transition shrink-0 cursor-pointer min-h-[34px]"
            >
              <Truck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>+ Gasto</span>
            </button>

            <button
              type="button"
              {...createToolbarAction(() =>
                insertSnippet('\ncalculos:\n  superficie: 120\n  bocas: =ceil(superficie / 6)\n  cable_m: =bocas * 12\n')
              )}
              className="px-2.5 py-1.5 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-xl font-bold flex items-center gap-1 border border-secondary/30 transition shrink-0 cursor-pointer min-h-[34px]"
              title="Define bloque de variables y fórmulas de cálculo en cascada"
            >
              <span className="font-mono text-sm font-black">=</span>
              <span>+ Cálculos</span>
            </button>

            {/* Accesorio de Teclado Rápido para móvil y tipeo ágil */}
            <div className="h-5 w-[1px] bg-outline-variant/30 shrink-0 mx-0.5" />

            <button
              type="button"
              {...createToolbarAction(() => insertSnippet('  '))}
              className="px-2 py-1 bg-surface-container-high hover:bg-surface-container-highest rounded-lg text-on-surface font-mono text-[11px] font-bold border border-outline-variant/30 transition shrink-0 cursor-pointer min-h-[32px]"
              title="Insertar sangría (2 espacios)"
            >
              Tab
            </button>

            <button
              type="button"
              {...createToolbarAction(() => insertSnippet(': '))}
              className="px-2 py-1 bg-surface-container-high hover:bg-surface-container-highest rounded-lg text-on-surface font-mono text-[11px] font-bold border border-outline-variant/30 transition shrink-0 cursor-pointer min-h-[32px]"
              title="Insertar dos puntos"
            >
              :
            </button>

            <button
              type="button"
              {...createToolbarAction(() => insertSnippet('- '))}
              className="px-2 py-1 bg-surface-container-high hover:bg-surface-container-highest rounded-lg text-on-surface font-mono text-[11px] font-bold border border-outline-variant/30 transition shrink-0 cursor-pointer min-h-[32px]"
              title="Insertar guión de lista"
            >
              -
            </button>

            <button
              type="button"
              {...createToolbarAction(() => insertSnippet('='))}
              className="px-2 py-1 bg-surface-container-high hover:bg-surface-container-highest rounded-lg text-primary font-mono text-[11px] font-bold border border-outline-variant/30 transition shrink-0 cursor-pointer min-h-[32px]"
              title="Insertar fórmula o variable"
            >
              =
            </button>

            <button
              type="button"
              {...createToolbarAction(() => insertSnippet('# '))}
              className="px-2 py-1 bg-surface-container-high hover:bg-surface-container-highest rounded-lg text-on-surface font-mono text-[11px] font-bold border border-outline-variant/30 transition shrink-0 cursor-pointer min-h-[32px]"
              title="Insertar comentario"
            >
              #
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
              <div
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => {
                  e.preventDefault();
                  textareaRef.current?.focus({ preventScroll: true });
                }}
                onClick={() => textareaRef.current?.focus({ preventScroll: true })}
                className="py-4 pl-3 pr-2 select-none text-right font-mono text-xs text-on-surface-variant/40 bg-surface-container-lowest/50 border-r border-outline-variant/15 min-w-[3rem] cursor-pointer"
              >
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
                onFocus={(e) => {
                  isFocusedRef.current = true;
                  updateCursorPos(e.currentTarget);
                }}
                onBlur={() => {
                  setTimeout(() => {
                    if (document.activeElement !== textareaRef.current) {
                      isFocusedRef.current = false;
                    }
                  }, 200);
                }}
                onSelect={(e) => updateCursorPos(e.currentTarget)}
                onClick={(e) => updateCursorPos(e.currentTarget)}
                onKeyUp={(e) => updateCursorPos(e.currentTarget)}
                onTouchEnd={(e) => updateCursorPos(e.currentTarget)}
                rows={22}
                placeholder={`cliente: Nombre del Cliente\nobra: Dirección de la Obra\nfactura: Factura C\n\nInstalación Eléctrica:\n  - 10 u Boca de Iluminación: $ 12.500\n  - 5 u Tomacorriente Doble: $ 9.800`}
                spellCheck={false}
                className="w-full p-4 bg-transparent text-on-surface font-mono text-xs sm:text-sm leading-6 resize-y focus:outline-none placeholder:text-on-surface-variant/30 min-h-[480px]"
              />

              {/* Popover contextual de autocompletado */}
              {slashMenuState.isOpen && (
                <SlashCommandMenu
                  query={slashMenuState.query}
                  tareasTipo={tareasTipo}
                  clientes={clientes}
                  clienteMatched={clienteMatched}
                  insumosMap={insumosMap}
                  manoObraMap={manoObraMap}
                  contextType={slashMenuState.contextType}
                  directiveType={slashMenuState.directiveType}
                  calculatedCells={calculatedCells}
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
            clienteQuery={clienteQuery}
            direccionObra={direccionObra}
            capitulos={capitulos}
            items={items}
            diagnostics={diagnostics}
            calculatedCells={calculatedCells}
            clientes={clientes}
            onSelectCliente={handleSelectClienteFromUI}
            onOpenQuickClienteModal={handleOpenQuickCliente}
            onSetDireccionObra={handleSetDireccionObraFromUI}
            onEmitirClick={onEmitirClick}
            onLoadExample={handleLoadExample}
            onCopyDSL={handleCopyDSL}
            onAddMaterialToCatalog={handleOpenQuickCreateMat}
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

      {/* Modal de Alta Rápida de Material al Catálogo (+ Catálogo) */}
      <QuickCreateMaterialModal
        isOpen={isQuickCreateMatOpen}
        onClose={() => setIsQuickCreateMatOpen(false)}
        formDataQuickMat={formDataQuickMat}
        setFormDataQuickMat={setFormDataQuickMat}
        proveedores={proveedores}
        onSave={handleSaveQuickMat}
      />

      {/* Modal de Alta Rápida de Cliente en Contactos */}
      <QuickClienteModal
        isOpen={isQuickClienteOpen}
        onClose={() => setIsQuickClienteOpen(false)}
        initialName={quickClienteInitialName}
        onClienteCreated={handleClienteCreated}
      />
    </div>
  );
};
