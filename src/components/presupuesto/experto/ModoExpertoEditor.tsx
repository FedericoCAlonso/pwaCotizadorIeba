import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Code2,
  FileCheck,
  Sparkles,
  Plus,
  FolderPlus,
  HelpCircle,
  Truck,
  Copy,
  Keyboard,
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
  handleYamlSmartTab,
  normalizePastedYaml,
  CursorContextType,
  CalculatedCell,
  findNextFillableField
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
  initialDslText?: string;
  onDslTextChange?: (dsl: string) => void;
  savedCalculatedCells?: CalculatedCell[];
  onCalculatedCellsChange?: (cells: CalculatedCell[]) => void;
  savedCalculosVariables?: Record<string, number | string>;
  onCalculosVariablesChange?: (vars: Record<string, number | string>) => void;
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
  initialDslText,
  onDslTextChange,
  savedCalculatedCells,
  onCalculatedCellsChange,
  savedCalculosVariables,
  onCalculosVariablesChange,
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

  const [cursorLineCol, setCursorLineCol] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const gutterRef = useRef<HTMLDivElement>(null);

  const updateCursorPos = useCallback((el: HTMLTextAreaElement) => {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    cursorPosRef.current = { start, end };
    const textBefore = el.value.slice(0, start);
    const lines = textBefore.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    setCursorLineCol({ line, col });
  }, []);

  // Inicializar el texto desde el estado actual del presupuesto (o plantilla comentada)
  const [dslText, setDslText] = useState<string>(() => {
    if (initialDslText && initialDslText.trim().length > 0) {
      return initialDslText;
    }
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
      clientes,
      calculosVariables: savedCalculosVariables,
      calculatedCells: savedCalculatedCells
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
    isExplicit?: boolean;
  }>({
    isOpen: false,
    query: '',
    cursorPosition: 0,
    slashIndex: -1,
    contextType: 'general',
    isExplicit: false
  });

  const dismissedLineRef = useRef<number | null>(null);
  const dismissedLineTextRef = useRef<string | null>(null);

  // Posición flotante dinámica del menú de autocompletado pegada al cursor
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 48, left: 16 });

  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  const catalogCostosIndirectos = useLiveQuery(() => db.costosIndirectos.toArray()) || [];

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
        existingGastos: gastosConfig,
        costosIndirectosCatalog: catalogCostosIndirectos
      });

      setDiagnostics(result.diagnostics);
      setCalculatedCells(result.calculatedCells || []);
      setClienteMatched(result.clienteMatched);
      setClienteQuery(result.clienteQuery);

      onDslTextChange?.(textToParse);
      onCalculatedCellsChange?.(result.calculatedCells || []);
      if (result.calculosVariables) {
        onCalculosVariablesChange?.(result.calculosVariables);
      }

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
      catalogCostosIndirectos,
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
      setGastosConfig,
      onDslTextChange,
      onCalculatedCellsChange,
      onCalculosVariablesChange
    ]
  );

  // Sincronizar hacia el editor si el documento se cargó desde la base de datos de manera asíncrona
  useEffect(() => {
    if (initialDslText && initialDslText.trim().length > 0 && initialDslText !== dslText && !isFocusedRef.current) {
      setDslText(initialDslText);
      handleParseAndSync(initialDslText);
    }
  }, [initialDslText]);

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
      clientes,
      dslText: (initialDslText || dslText),
      calculosVariables: savedCalculosVariables,
      calculatedCells: savedCalculatedCells
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
    gastosConfig,
    initialDslText,
    savedCalculosVariables,
    savedCalculatedCells
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

  const [activeFieldInfo, setActiveFieldInfo] = useState<{ label: string; text: string } | null>(null);
  const activeFieldTimeoutRef = useRef<any>(null);

  // Navegación inteligente de campos a completar (Alt + Enter, AltGr + Enter, Tab)
  const handleNavigateField = useCallback(
    (direction: 'forward' | 'backward' = 'forward') => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const currentText = textarea.value ?? dslText;
      const isFocused = document.activeElement === textarea;
      const currentPos = isFocused
        ? (direction === 'forward' ? textarea.selectionEnd : textarea.selectionStart)
        : (direction === 'forward' ? (cursorPosRef.current?.end ?? 0) : (cursorPosRef.current?.start ?? 0));

      const nextField = findNextFillableField({
        text: currentText,
        cursorPos: currentPos,
        direction
      });

      if (nextField) {
        cursorPosRef.current = { start: nextField.start, end: nextField.end };

        const targetSlice = currentText.slice(nextField.start, nextField.end);
        const labelDisplay = nextField.label || 'Campo';
        setActiveFieldInfo({
          label: labelDisplay,
          text: targetSlice || '(vacío)'
        });

        if (activeFieldTimeoutRef.current) {
          clearTimeout(activeFieldTimeoutRef.current);
        }
        activeFieldTimeoutRef.current = setTimeout(() => {
          setActiveFieldInfo(null);
        }, 2200);

        const applySelection = () => {
          if (!textareaRef.current) return;
          const el = textareaRef.current;
          el.focus({ preventScroll: false });
          try {
            el.setSelectionRange(nextField.start, nextField.end);
          } catch {
            el.selectionStart = nextField.start;
            el.selectionEnd = nextField.end;
          }

          // Asegurar visibilidad de scroll si el campo queda fuera de la pantalla visible
          const textBefore = el.value.slice(0, nextField.start);
          const lineIndex = textBefore.split('\n').length - 1;
          const lineHeight = 24;
          const targetY = lineIndex * lineHeight;
          const visibleHeight = el.clientHeight;

          if (targetY < el.scrollTop || targetY > el.scrollTop + visibleHeight - lineHeight * 2) {
            el.scrollTop = Math.max(0, targetY - Math.floor(visibleHeight / 3));
          }
        };

        applySelection();
        requestAnimationFrame(applySelection);
        setTimeout(applySelection, 20);
      }
    },
    [dslText]
  );

  // Atajo global para el editor (Alt + Enter / AltGr + Enter para campos, Alt + M para catálogo)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Detección robusta de Alt (Left Alt o Right Alt/AltGr) y Enter (Enter o NumpadEnter)
      const isAlt = e.altKey || (typeof e.getModifierState === 'function' && (e.getModifierState('Alt') || e.getModifierState('AltGraph')));
      const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter';

      if (isAlt && isEnter) {
        e.preventDefault();
        e.stopPropagation();
        handleNavigateField(e.shiftKey ? 'backward' : 'forward');
        return;
      }

      const isM = e.key === 'm' || e.key === 'M';
      const isI = e.key === 'i' || e.key === 'I';
      if ((isAlt && (isM || isI)) || ((e.ctrlKey || e.metaKey) && isM)) {
        e.preventDefault();
        setShowMultiMaterialModal((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalShortcuts, { capture: true });
  }, [handleNavigateField]);

  // Auto-focus en el editor al montar en pantallas desktop
  useEffect(() => {
    if (window.innerWidth >= 768 && textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
    }
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
    const currentLineIndex = textBeforeCursor.split('\n').length - 1;

    setCursorLineCol({
      line: currentLineIndex + 1,
      col: currentLine.length + 1
    });

    // Si cambió de línea o el contenido de la línea descartada cambió, resetear el descarte
    if (dismissedLineRef.current !== null && dismissedLineRef.current !== currentLineIndex) {
      dismissedLineRef.current = null;
      dismissedLineTextRef.current = null;
    }
    if (dismissedLineTextRef.current !== null && dismissedLineTextRef.current !== currentLine.trim()) {
      dismissedLineTextRef.current = null;
      dismissedLineRef.current = null;
    }

    // Detectar contexto semántico de la línea actual
    const { contextType, activeCategory } = detectCursorContext(textBeforeCursor);

    const trigger = detectSuggestTrigger(currentLine);

    if (trigger) {
      if (trigger.isExplicit || trigger.directiveType) {
        dismissedLineRef.current = null;
        dismissedLineTextRef.current = null;
      }

      // Si el usuario descartó el menú con Escape en este renglón y el texto no ha cambiado, no molestar
      if (!trigger.isExplicit && !trigger.directiveType && dismissedLineRef.current === currentLineIndex && dismissedLineTextRef.current === currentLine.trim()) {
        if (slashMenuState.isOpen) {
          setSlashMenuState((prev) => ({ ...prev, isOpen: false }));
        }
      } else {
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
            directiveType: trigger.directiveType,
            isExplicit: true
          });
        } else if (trigger.isExplicit) {
          setSlashMenuState({
            isOpen: true,
            query: `${trigger.triggerChar}${trigger.query}`,
            cursorPosition: cursorPos,
            slashIndex: triggerIndex,
            contextType: trigger.triggerChar === '@' ? 'general' : contextType,
            replaceFullLine: false,
            directiveType: trigger.triggerChar === '@' ? 'cliente' : undefined,
            isExplicit: true
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
            directiveType: undefined,
            isExplicit: false
          });
        }
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

  // Manejo de atajos de teclado en el editor (Enter con auto-indentación, Tab para sangría o campo, Ctrl+Enter para guardar)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMenuState.isOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab')) {
      // El SlashCommandMenu maneja las flechas y la tecla Tab para autocompletar
      return;
    }

    // ALT + ENTER / ALT + SHIFT + ENTER / AltGr + Enter: Navegación inteligente por campos a completar
    const isAlt = e.altKey || (typeof e.getModifierState === 'function' && (e.getModifierState('Alt') || e.getModifierState('AltGraph')));
    const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter';

    if (isAlt && isEnter) {
      e.preventDefault();
      e.stopPropagation();
      handleNavigateField(e.shiftKey ? 'backward' : 'forward');
      return;
    }

    const isM = e.key === 'm' || e.key === 'M';
    const isI = e.key === 'i' || e.key === 'I';
    if ((isAlt && (isM || isI)) || ((e.ctrlKey || e.metaKey) && isM)) {
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

    // Tab -> Sangría inteligente contextual y ciclo de niveles semánticos (0 -> 2 -> 4 -> 6 -> 8 -> 0)
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (start !== end) {
        handleNavigateField(e.shiftKey ? 'backward' : 'forward');
        return;
      }

      const textBefore = dslText.substring(0, start);
      const textAfter = dslText.substring(end);

      const smartTab = handleYamlSmartTab({ textBefore, textAfter, shiftKey: e.shiftKey });
      cursorPosRef.current = { start: smartTab.newCursorPos, end: smartTab.newCursorPos };
      const tb = smartTab.newText.slice(0, smartTab.newCursorPos);
      const lines = tb.split('\n');
      setCursorLineCol({ line: lines.length, col: lines[lines.length - 1].length + 1 });
      setDslText(smartTab.newText);
      handleParseAndSync(smartTab.newText);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus({ preventScroll: true });
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = smartTab.newCursorPos;
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
          const tb = smartBack.newText.slice(0, smartBack.newCursorPos);
          const lines = tb.split('\n');
          setCursorLineCol({ line: lines.length, col: lines[lines.length - 1].length + 1 });
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
      const tb = newText.slice(0, newCursorPos);
      const lines = tb.split('\n');
      setCursorLineCol({ line: lines.length, col: lines[lines.length - 1].length + 1 });
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

  // Manejo de pegado en el editor: limpieza de caracteres invisibles, normalización de tabs y re-indentación contextual
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    e.preventDefault();
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const textBefore = dslText.substring(0, start);
    const textAfter = dslText.substring(end);

    const normalized = normalizePastedYaml(pastedText, textBefore);
    const newText = textBefore + normalized + textAfter;
    const newCursorPos = start + normalized.length;

    cursorPosRef.current = { start: newCursorPos, end: newCursorPos };
    const tb = newText.slice(0, newCursorPos);
    const lines = tb.split('\n');
    setCursorLineCol({ line: lines.length, col: lines[lines.length - 1].length + 1 });
    setDslText(newText);
    handleParseAndSync(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus({ preventScroll: true });
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newCursorPos;
      }
    }, 0);
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
        contextType: 'general',
        isExplicit: false
      });
      setQuickClienteInitialName(initialName);
      setIsQuickClienteOpen(true);
      return;
    }

    // Acción especial: Mantener texto libre
    if (snippet.startsWith('ACTION:FREE_TEXT:')) {
      setSlashMenuState({
        isOpen: false,
        query: '',
        cursorPosition: 0,
        slashIndex: -1,
        contextType: 'general',
        isExplicit: false
      });
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
      const textBefore = newText.slice(0, textarea.selectionStart);
      const lines = textBefore.split('\n');
      setCursorLineCol({ line: lines.length, col: lines[lines.length - 1].length + 1 });
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
      {/* Aviso de degradación en pantalla móvil / sin teclado físico */}
      {isMobileScreen && (
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
                navigator.clipboard.writeText(dslText);
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

            <button
              type="button"
              {...createToolbarAction(() => handleNavigateField('forward'))}
              className="px-2.5 py-1 bg-primary/15 hover:bg-primary/25 text-primary rounded-lg font-bold text-[11px] border border-primary/30 transition shrink-0 cursor-pointer min-h-[32px] flex items-center gap-1"
              title="Saltar al siguiente campo editable (Alt + Enter)"
            >
              <span>⏭ Campo</span>
              <kbd className="hidden sm:inline text-[9px] opacity-75 font-mono">Alt+Enter</kbd>
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
                <span>•</span>
                <span className="font-semibold text-primary/90 bg-primary/10 px-2 py-0.5 rounded text-[10px] sm:text-xs">
                  Fila {cursorLineCol.line}, Col {cursorLineCol.col}
                </span>

                {activeFieldInfo && (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/20 text-primary border border-primary/40 text-[11px] font-bold rounded-full animate-pulse transition-all">
                    <span>📍 {activeFieldInfo.label}</span>
                    {activeFieldInfo.text !== '(vacío)' && (
                      <span className="opacity-90 font-mono text-[10px] truncate max-w-[140px]">
                        "{activeFieldInfo.text}"
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

            <div className="relative flex">
              {/* Números de Línea */}
              <div
                ref={gutterRef}
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => {
                  e.preventDefault();
                  textareaRef.current?.focus({ preventScroll: true });
                }}
                onClick={() => textareaRef.current?.focus({ preventScroll: true })}
                className="py-4 pl-3 pr-2 select-none text-right font-mono text-xs text-on-surface-variant/40 bg-surface-container-lowest/50 border-r border-outline-variant/15 min-w-[3.25rem] cursor-pointer overflow-hidden"
              >
                {Array.from({ length: lineCount }).map((_, idx) => {
                  const lineNum = idx + 1;
                  const isActive = lineNum === cursorLineCol.line;
                  return (
                    <div
                      key={idx}
                      className={`leading-6 transition-colors px-1 -mx-1 rounded-sm ${
                        isActive ? 'text-primary font-bold bg-primary/15' : ''
                      }`}
                    >
                      {lineNum}
                    </div>
                  );
                })}
              </div>

              {/* Textarea Monospace */}
              <textarea
                ref={textareaRef}
                value={dslText}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                readOnly={isMobileScreen}
                onScroll={(e) => {
                  updateMenuPosition();
                  if (gutterRef.current) {
                    gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                  }
                }}
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
                className="w-full p-4 bg-transparent text-on-surface font-mono text-xs sm:text-sm leading-6 resize-y focus:outline-none placeholder:text-on-surface-variant/30 min-h-[480px] whitespace-pre overflow-x-auto"
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
                  costosIndirectos={catalogCostosIndirectos}
                  contextType={slashMenuState.contextType}
                  directiveType={slashMenuState.directiveType}
                  calculatedCells={calculatedCells}
                  position={menuPosition}
                  isExplicit={slashMenuState.isExplicit}
                  onSelect={handleSelectSlashCommand}
                  onClose={() => {
                    const cursorPos = textareaRef.current?.selectionStart ?? cursorPosRef.current.start;
                    const textBeforeCursor = dslText.slice(0, cursorPos);
                    const lastLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
                    const currentLine = textBeforeCursor.slice(lastLineStart);
                    const currentLineIndex = textBeforeCursor.split('\n').length - 1;
                    dismissedLineRef.current = currentLineIndex;
                    dismissedLineTextRef.current = currentLine.trim();
                    setSlashMenuState((prev) => ({ ...prev, isOpen: false }));
                  }}
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
