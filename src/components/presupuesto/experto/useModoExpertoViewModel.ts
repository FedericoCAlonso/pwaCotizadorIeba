import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { useToast } from '../../../contexts/ToastContext';

export interface ModoExpertoEditorProps {
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

export function useModoExpertoViewModel(
  props: ModoExpertoEditorProps,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  gutterRef: React.RefObject<HTMLDivElement | null>
) {
  const {
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
    tareasTipo,
    insumosMap,
    manoObraMap,
    config,
    onSaveDraft
  } = props;

  const { toast } = useToast();
  const cursorPosRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const isFocusedRef = useRef(false);
  const lastTouchTimeRef = useRef(0);

  const [cursorLineCol, setCursorLineCol] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

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

  // Inicializar el texto desde el estado actual del presupuesto
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

  // Estado del menú flotante de autocompletado
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

  // Posición flotante dinámica del menú pegada al cursor
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

    const lineHeight = 24;
    const paddingTop = 16;
    const cursorY = paddingTop + (lineIndex + 1) * lineHeight - scrollTop;

    const menuEstimatedHeight = 280;
    let top = cursorY + 4;
    if (cursorY + menuEstimatedHeight > clientHeight && cursorY > menuEstimatedHeight) {
      top = cursorY - lineHeight - menuEstimatedHeight - 8;
    }

    const gutterWidth = 48 + 16;
    const approxCharWidth = 8.4;
    let left = gutterWidth + currentLine.length * approxCharWidth;

    const maxLeft = Math.max(48, clientWidth - 360);
    left = Math.min(Math.max(48, left), maxLeft);

    setMenuPosition({ top: Math.max(8, top), left });
  }, [slashMenuState.cursorPosition, dslText, textareaRef]);

  useEffect(() => {
    if (slashMenuState.isOpen) {
      updateMenuPosition();
    }
  }, [slashMenuState.isOpen, slashMenuState.cursorPosition, updateMenuPosition]);

  const [showMultiMaterialModal, setShowMultiMaterialModal] = useState(false);
  const [showGastosModal, setShowGastosModal] = useState(false);

  const latestDslTextRef = useRef<string>(dslText);
  latestDslTextRef.current = dslText;

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
  const parseDebounceTimerRef = useRef<any>(null);

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

  // Sincronizar hacia el editor si el documento se cargó desde la BD
  useEffect(() => {
    if (initialDslText && initialDslText.trim().length > 0 && initialDslText !== dslText && !isFocusedRef.current) {
      setDslText(initialDslText);
      handleParseAndSync(initialDslText);
    }
  }, [initialDslText]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al desmontar, flushear cualquier parseo pendiente
  useEffect(() => {
    return () => {
      if (parseDebounceTimerRef.current) {
        clearTimeout(parseDebounceTimerRef.current);
        if (latestDslTextRef.current) {
          handleParseAndSync(latestDslTextRef.current);
        }
      }
    };
  }, [handleParseAndSync]);

  // Sincronizar desde cambios externos del ViewModel hacia el texto
  useEffect(() => {
    if (isInternalUpdateRef.current) return;
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
  ]); // eslint-disable-line react-hooks/exhaustive-deps

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
    [dslText, textareaRef]
  );

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
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

  useEffect(() => {
    if (window.innerWidth >= 768 && textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
    }
  }, [textareaRef]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const cursorPos = e.target.selectionStart;
    cursorPosRef.current = { start: cursorPos, end: e.target.selectionEnd };
    setDslText(newText);
    latestDslTextRef.current = newText;

    const textBeforeCursor = newText.slice(0, cursorPos);
    const lastLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
    const currentLine = textBeforeCursor.slice(lastLineStart);
    const currentLineIndex = textBeforeCursor.split('\n').length - 1;

    setCursorLineCol({
      line: currentLineIndex + 1,
      col: currentLine.length + 1
    });

    if (dismissedLineRef.current !== null && dismissedLineRef.current !== currentLineIndex) {
      dismissedLineRef.current = null;
      dismissedLineTextRef.current = null;
    }
    if (dismissedLineTextRef.current !== null && dismissedLineTextRef.current !== currentLine.trim()) {
      dismissedLineTextRef.current = null;
      dismissedLineRef.current = null;
    }

    const { contextType, activeCategory } = detectCursorContext(textBeforeCursor);
    const trigger = detectSuggestTrigger(currentLine, contextType);

    if (trigger) {
      if (trigger.isExplicit || trigger.directiveType) {
        dismissedLineRef.current = null;
        dismissedLineTextRef.current = null;
      }

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMenuState.isOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab')) {
      return;
    }

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

    const isG = e.key === 'g' || e.key === 'G';
    if ((isAlt && isG) || ((e.ctrlKey || e.metaKey) && isG)) {
      e.preventDefault();
      setShowGastosModal(true);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onSaveDraft();
      toast.success('Borrador guardado');
      return;
    }

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

    if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

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
      latestDslTextRef.current = newText;
      handleParseAndSync(newText);

      const tbLastLineStart = tb.lastIndexOf('\n') + 1;
      const tbCurrentLine = tb.slice(tbLastLineStart);
      const { contextType: enterContextType, activeCategory: enterActiveCategory } = detectCursorContext(tb);
      const enterTrigger = detectSuggestTrigger(tbCurrentLine, enterContextType);

      if (enterTrigger) {
        const enterTriggerIndex = tbLastLineStart + enterTrigger.queryIndexInLine;
        const enterTypedQuery = enterTrigger.query.trim();
        const enterQueryWithCategory = enterActiveCategory ? `${enterActiveCategory}/${enterTypedQuery}` : enterTypedQuery;

        setSlashMenuState({
          isOpen: true,
          query: enterTrigger.isExplicit ? `${enterTrigger.triggerChar}${enterTrigger.query}` : enterQueryWithCategory,
          cursorPosition: newCursorPos,
          slashIndex: enterTriggerIndex,
          contextType: enterContextType,
          replaceFullLine: false,
          directiveType: enterTrigger.directiveType,
          isExplicit: enterTrigger.isExplicit
        });
      } else if (slashMenuState.isOpen) {
        setSlashMenuState((prev) => ({ ...prev, isOpen: false }));
      }

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus({ preventScroll: true });
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newCursorPos;
        }
      }, 0);
      return;
    }
  };

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

  const handleSelectSlashCommand = (snippet: string) => {
    if (!textareaRef.current) return;

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

    if (snippet === 'ACTION:OPEN_GASTOS_MODAL') {
      setSlashMenuState({
        isOpen: false,
        query: '',
        cursorPosition: 0,
        slashIndex: -1,
        contextType: 'general',
        isExplicit: false
      });
      setShowGastosModal(true);
      return;
    }

    if (snippet.startsWith('ACTION:FREE_TEXT:')) {
      const cleanTyped = snippet.replace('ACTION:FREE_TEXT:', '').trim();
      if (slashMenuState.contextType === 'gastos') {
        snippet = `- ${cleanTyped}: $ 0\n`;
      } else {
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

  const handleSelectClienteFromUI = useCallback(
    (cliente: Cliente) => {
      const cliName = cliente.razonSocial || cliente.nombre || '';
      let updatedDsl = dslText;

      if (/^cliente\s*:[^\r\n]*/mi.test(updatedDsl)) {
        updatedDsl = updatedDsl.replace(/^cliente\s*:[^\r\n]*/mi, `cliente: ${cliName}`);
      } else {
        updatedDsl = `cliente: ${cliName}\n` + updatedDsl;
      }

      if (cliente.direccion && (!direccionObra || direccionObra === 'Dirección de la Obra')) {
        const fullDir = `${cliente.direccion}${cliente.localidad ? `, ${cliente.localidad}` : ''}`;
        if (/^obra\s*:[^\r\n]*/mi.test(updatedDsl)) {
          updatedDsl = updatedDsl.replace(/^obra\s*:[^\r\n]*/mi, `obra: ${fullDir}`);
        } else {
          updatedDsl = updatedDsl.replace(/^cliente\s*:[^\r\n]*/mi, (match) => `${match}\nobra: ${fullDir}`);
        }
      }

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

  const handleOpenQuickCliente = useCallback((initialName?: string) => {
    setQuickClienteInitialName(initialName || '');
    setIsQuickClienteOpen(true);
  }, []);

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

  const handleInsertMultipleMaterials = (formattedYamlLines: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const cursor = textarea.selectionStart;

    const textBefore = dslText.slice(0, cursor);
    const textAfter = dslText.slice(cursor);
    const lastLineStart = textBefore.lastIndexOf('\n') + 1;
    const currentLine = textBefore.slice(lastLineStart);

    const { contextType, currentIndent } = detectCursorContext(textBefore);

    let contentToInsert = formattedYamlLines;
    if (contextType !== 'materiales') {
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

  const handleInsertGastos = (formattedYamlLines: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const cursor = textarea.selectionStart ?? dslText.length;

    const textBefore = dslText.slice(0, cursor);
    const textAfter = dslText.slice(cursor);
    const lastLineStart = textBefore.lastIndexOf('\n') + 1;
    const currentLine = textBefore.slice(lastLineStart);

    const { contextType } = detectCursorContext(textBefore);

    let contentToInsert = formattedYamlLines;
    let newText = '';
    let newCursorPos = 0;

    if (contextType === 'gastos') {
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
    } else {
      const gastosHeaderMatch = dslText.match(/^(\s*)gastos:\s*$/m);
      if (gastosHeaderMatch && gastosHeaderMatch.index !== undefined) {
        const headerEnd = gastosHeaderMatch.index + gastosHeaderMatch[0].length;
        const beforeGastos = dslText.slice(0, headerEnd);
        const afterGastos = dslText.slice(headerEnd);
        newText = `${beforeGastos}\n${contentToInsert.trimEnd()}${afterGastos.startsWith('\n') ? '' : '\n'}${afterGastos}`;
        newCursorPos = headerEnd + 1 + contentToInsert.trimEnd().length;
      } else {
        const needsLeadingNewline = !dslText.endsWith('\n') && dslText.length > 0;
        const block = `${needsLeadingNewline ? '\n' : ''}gastos:\n${contentToInsert}`;
        newText = dslText + block;
        newCursorPos = newText.length;
      }
    }

    setDslText(newText);
    latestDslTextRef.current = newText;
    handleParseAndSync(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
    }, 10);

    toast.success('Gastos insertados en el presupuesto');
  };

  const handleLoadExample = () => {
    const demo = generateExampleDSL(clientes[0]);
    setDslText(demo);
    handleParseAndSync(demo);
    toast.info('Plantilla de ejemplo cargada');
  };

  const handleCopyDSL = () => {
    navigator.clipboard.writeText(dslText);
    toast.success('Texto YAML copiado al portapapeles');
  };

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
  }, [slashMenuState.isOpen, updateMenuPosition, textareaRef]);

  const createToolbarAction = (action: () => void) => ({
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault();
    },
    onTouchStart: () => {
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

  const currentIndentForPalette = useMemo(() => {
    if (!textareaRef.current) return '        ';
    const cursor = textareaRef.current.selectionStart || 0;
    const textBefore = dslText.slice(0, cursor);
    const { currentIndent } = detectCursorContext(textBefore);
    return currentIndent || '        ';
  }, [dslText, textareaRef]);

  const handleCloseSlashMenu = useCallback(() => {
    const cursorPos = textareaRef.current?.selectionStart ?? cursorPosRef.current.start;
    const textBeforeCursor = dslText.slice(0, cursorPos);
    const lastLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
    const currentLine = textBeforeCursor.slice(lastLineStart);
    const currentLineIndex = textBeforeCursor.split('\n').length - 1;
    dismissedLineRef.current = currentLineIndex;
    dismissedLineTextRef.current = currentLine.trim();
    setSlashMenuState((prev) => ({ ...prev, isOpen: false }));
  }, [dslText, textareaRef]);

  return {
    dslText,
    setDslText,
    lineCount,
    cursorLineCol,
    activeFieldInfo,
    isMobileScreen,
    diagnostics,
    calculatedCells,
    clienteMatched,
    clienteQuery,
    slashMenuState,
    setSlashMenuState,
    menuPosition,
    catalogCostosIndirectos,
    proveedores,
    showMultiMaterialModal,
    setShowMultiMaterialModal,
    showGastosModal,
    setShowGastosModal,
    isQuickCreateMatOpen,
    setIsQuickCreateMatOpen,
    formDataQuickMat,
    setFormDataQuickMat,
    handleSaveQuickMat,
    isQuickClienteOpen,
    setIsQuickClienteOpen,
    quickClienteInitialName,
    handleClienteCreated,
    currentIndentForPalette,
    handleTextChange,
    handleKeyDown,
    handlePaste,
    handleSelectSlashCommand,
    handleSelectClienteFromUI,
    handleSetDireccionObraFromUI,
    handleOpenQuickCliente,
    handleOpenQuickCreateMat,
    handleInsertMultipleMaterials,
    handleInsertGastos,
    handleLoadExample,
    handleCopyDSL,
    handleNavigateField,
    createToolbarAction,
    insertSnippet,
    updateCursorPos,
    updateMenuPosition,
    handleCloseSlashMenu,
    isFocusedRef,
    cursorPosRef
  };
}
