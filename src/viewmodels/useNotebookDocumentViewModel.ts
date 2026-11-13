import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import {
  AppConfig,
  CapituloPresupuesto,
  CategoriaManoDeObra,
  Contacto,
  CostoIndirecto,
  Insumo,
  ItemPresupuesto,
  Material,
  Oferta,
  Presupuesto,
  Producto,
  TareaTipo
} from '../core/types';
import { ResultadoAlcanceYAdvertencias } from '../core/notebookDomain';
import { safeNum, TotalesPresupuestoResultado } from '../core/calculations';
import {
  actualizarParametroEnLineaTt,
  applyNotebookBlocksToPresupuesto,
  buildNotebookCommandPalette,
  buildParseContext,
  construirLineaItemLibreRapido,
  construirLineaTareaTipoDesdeEsquema,
  construirTareaTipoDesdeItemLibre,
  eliminarBloqueEnLinea,
  evaluateNotebookText,
  filterNotebookCommandPalette,
  findNextParameterSlot,
  getContextualAutocompleteSuggestions,
  ModoPasadaCotizacion,
  NotebookAutocompleteResult,
  NotebookCommandPaletteItem,
  NotebookDocumentContext,
  NotebookErrorDocumento,
  ordenarTareasTipoParaMovil,
  presupuestoToNotebookBlocks,
  SubtotalBloqueInfo,
  SugerenciaConversionTareaTipo,
  TabJumpResult
} from '../core/notebookDocument';
import { NotebookBlock, serialize } from '../core/notebookParser';
import { PRESUPUESTO_MAXIMO_ADVERTENCIAS_VISIBLES, slugifyIdentificador } from '../core/notebookDomain';

export interface NotebookCursor {
  linea: number;
  columna: number;
  selectionStartCol?: number;
  selectionEndCol?: number;
}

export interface SiguienteSinValorizarInfo {
  itemId: string;
  linea: number;
  descripcion: string;
}

export interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  commands: NotebookCommandPaletteItem[];
}

export type NotebookSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseNotebookDocumentViewModelProps {
  config: AppConfig;
  presupuestoId?: string;
  initialPresupuesto?: Partial<Presupuesto>;
  initialPassMode?: ModoPasadaCotizacion;
  catalogOverride?: Partial<Omit<NotebookDocumentContext, 'config'>>;
  onSaved?: (presupuesto: Presupuesto) => void;
}

function resolveBlockIndexForLine(blockLineNumbers: number[], linea: number): number {
  if (blockLineNumbers.length === 0) return -1;
  let active = -1;
  for (let i = 0; i < blockLineNumbers.length; i++) {
    if (blockLineNumbers[i] <= linea) {
      active = i;
    } else {
      break;
    }
  }
  return active >= 0 ? active : 0;
}

function replaceSpanInLine(
  texto: string,
  linea1Based: number,
  startCol1Based: number,
  endCol1Based: number,
  insertText: string
): { nextTexto: string; nextCursor: NotebookCursor } {
  const lines = texto.split(/\r?\n/);
  const idx = Math.max(0, Math.min(linea1Based - 1, lines.length - 1));
  const raw = lines[idx] ?? '';
  const start = Math.max(0, Math.min(startCol1Based - 1, raw.length));
  const end = Math.max(start, Math.min(endCol1Based - 1, raw.length));
  const updatedLine = `${raw.slice(0, start)}${insertText}${raw.slice(end)}`;
  lines[idx] = updatedLine;
  return {
    nextTexto: lines.join('\n'),
    nextCursor: {
      linea: idx + 1,
      columna: start + insertText.length + 1
    }
  };
}

function insertLineAtCursor(
  texto: string,
  linea1Based: number,
  lineContent: string
): { nextTexto: string; nextCursor: NotebookCursor } {
  const lines = texto ? texto.split(/\r?\n/) : [''];
  const idx = Math.max(0, Math.min(linea1Based - 1, lines.length - 1));
  const currentTrimmed = (lines[idx] ?? '').trim();

  let targetIdx = idx;
  if (currentTrimmed.length === 0 || currentTrimmed === '/') {
    lines[idx] = lineContent;
  } else {
    targetIdx = idx + 1;
    lines.splice(targetIdx, 0, lineContent);
  }

  return {
    nextTexto: lines.join('\n'),
    nextCursor: {
      linea: targetIdx + 1,
      columna: lineContent.length + 1
    }
  };
}

export function useNotebookDocumentViewModel({
  config,
  presupuestoId,
  initialPresupuesto,
  initialPassMode = 'valorizacion',
  catalogOverride,
  onSaved
}: UseNotebookDocumentViewModelProps) {
  // ─── Catálogos reactivos desde Dexie (respaldo con catalogOverride para tests) ─
  const dbPresupuestos = useLiveQuery(
    () =>
      presupuestoId && db.presupuestos?.where
        ? db.presupuestos.where('id').equals(presupuestoId).toArray()
        : Promise.resolve([] as Presupuesto[]),
    [presupuestoId]
  );
  const dbTareasTipo = useLiveQuery(
    () => (db.tareasTipo?.toArray ? db.tareasTipo.toArray() : Promise.resolve([] as TareaTipo[])),
    []
  );
  const dbMateriales = useLiveQuery(
    () => (db.materiales?.toArray ? db.materiales.toArray() : Promise.resolve([] as Material[])),
    []
  );
  const dbProductos = useLiveQuery(
    () => (db.productos?.toArray ? db.productos.toArray() : Promise.resolve([] as Producto[])),
    []
  );
  const dbOfertas = useLiveQuery(
    () => (db.ofertas?.toArray ? db.ofertas.toArray() : Promise.resolve([] as Oferta[])),
    []
  );
  const dbInsumos = useLiveQuery(
    () => (db.insumos?.toArray ? db.insumos.toArray() : Promise.resolve([] as Insumo[])),
    []
  );
  const dbManoObra = useLiveQuery(
    () => (db.manoObra?.toArray ? db.manoObra.toArray() : Promise.resolve([] as CategoriaManoDeObra[])),
    []
  );
  const dbCostosIndirectos = useLiveQuery(
    () =>
      db.costosIndirectos?.toArray
        ? db.costosIndirectos.toArray()
        : Promise.resolve([] as CostoIndirecto[]),
    []
  );
  const dbContactos = useLiveQuery(
    () => (db.contactos?.toArray ? db.contactos.toArray() : Promise.resolve([] as Contacto[])),
    []
  );

  const [extraTareasTipo, setExtraTareasTipo] = useState<TareaTipo[]>([]);

  const contexto = useMemo<NotebookDocumentContext>(() => {
    const baseTareas = (catalogOverride?.tareasTipo ?? dbTareasTipo ?? []).filter(t => !t.deleted);
    const mergedMap = new Map<string, TareaTipo>();
    for (const t of baseTareas) mergedMap.set(t.id, t);
    for (const t of extraTareasTipo) mergedMap.set(t.id, t);

    return {
      config,
      tareasTipo: Array.from(mergedMap.values()),
      materiales: (catalogOverride?.materiales ?? dbMateriales ?? []).filter(m => !m.deleted),
      productos: (catalogOverride?.productos ?? dbProductos ?? []).filter(p => !p.deleted),
      ofertas: (catalogOverride?.ofertas ?? dbOfertas ?? []).filter(o => !o.deleted),
      legacyInsumos: (catalogOverride?.legacyInsumos ?? dbInsumos ?? []).filter(i => !i.deleted),
      manoObra: (catalogOverride?.manoObra ?? dbManoObra ?? []).filter(mo => !mo.deleted),
      costosIndirectosCatalog: (catalogOverride?.costosIndirectosCatalog ?? dbCostosIndirectos ?? []).filter(
        c => !c.deleted
      ),
      unidadesValidas: catalogOverride?.unidadesValidas
    };
  }, [
    config,
    catalogOverride,
    dbTareasTipo,
    dbMateriales,
    dbProductos,
    dbOfertas,
    dbInsumos,
    dbManoObra,
    dbCostosIndirectos,
    extraTareasTipo
  ]);

  // ─── Estado base del documento ─────────────────────────────────────────────
  const loadedFromDb = dbPresupuestos?.[0];
  const initialSource = useMemo<Partial<Presupuesto>>(
    () => loadedFromDb || initialPresupuesto || {},
    [loadedFromDb, initialPresupuesto]
  );

  const [passMode, setPassMode] = useState<ModoPasadaCotizacion>(initialPassMode);
  const [cursor, setCursorState] = useState<NotebookCursor>({ linea: 1, columna: 1 });
  const [autocompleteSelectedIndex, setAutocompleteSelectedIndex] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteSelectedIndex, setPaletteSelectedIndex] = useState(0);
  const [mostrarVistaPrevia, setMostrarVistaPrevia] = useState(false);
  const [mostrarAyudaAtajos, setMostrarAyudaAtajos] = useState(false);
  const [saveStatus, setSaveStatus] = useState<NotebookSaveStatus>('idle');
  const [isDirty, setIsDirty] = useState(false);

  const initialProjectedText = useMemo(() => {
    const baseEval = applyNotebookBlocksToPresupuesto(
      initialSource,
      initialSource.items || initialSource.capitulos || initialSource.variablesCotizacion
        ? presupuestoToNotebookBlocks(initialSource as Presupuesto, contexto)
        : [],
      contexto
    );
    const blocks = presupuestoToNotebookBlocks(baseEval.presupuesto, contexto);
    return serialize(blocks, buildParseContext(contexto));
  }, [initialSource, contexto]);

  const [texto, setTextoState] = useState<string>(() => initialProjectedText);
  const hydratedIdRef = useRef<string | undefined>(loadedFromDb?.id);

  // Hidrata si llega el presupuesto asincrónicamente desde IndexedDB (sin pisar ediciones del usuario)
  useEffect(() => {
    if (loadedFromDb && hydratedIdRef.current !== loadedFromDb.id && !isDirty) {
      hydratedIdRef.current = loadedFromDb.id;
      const blocks = presupuestoToNotebookBlocks(loadedFromDb, contexto);
      setTextoState(serialize(blocks, buildParseContext(contexto)));
    }
  }, [loadedFromDb, contexto, isDirty]);

  const [valorizarIdsOverride, setValorizarIdsOverride] = useState<string[]>([]);
  const [forzarValorizarTodos, setForzarValorizarTodos] = useState(false);
  const [metadataOverrides, setMetadataOverrides] = useState<Partial<Presupuesto>>({});

  // ─── Evaluación reactiva completa ──────────────────────────────────────────
  const evaluacion = useMemo(() => {
    const mergedBase: Partial<Presupuesto> = {
      ...initialSource,
      ...metadataOverrides
    };
    return evaluateNotebookText(texto, mergedBase, contexto, {
      modoPasada: passMode,
      valorizarItemIds: valorizarIdsOverride,
      forzarValorizarTodos
    });
  }, [
    texto,
    initialSource,
    metadataOverrides,
    contexto,
    passMode,
    valorizarIdsOverride,
    forzarValorizarTodos
  ]);

  const { parseResult, aplicacion } = evaluacion;
  const {
    presupuesto,
    totales,
    alcanceYAdvertencias,
    erroresVariables,
    erroresComposicion,
    subtotalesPorBloque,
    subtotalesPorItemId,
    blockLineNumbers,
    tareasSinValorizar,
    esTotalParcial,
    sugerenciasConversion
  } = aplicacion;

  // Errores consolidados (parser + ciclos de variables + composición + presupuesto de advertencias)
  const errores = useMemo<NotebookErrorDocumento[]>(() => {
    const list: NotebookErrorDocumento[] = [
      ...parseResult.errores.map(e => ({
        linea: e.linea,
        columna: e.columna,
        longitud: e.longitud,
        codigo: e.codigo,
        mensaje: e.mensaje,
        textoLinea: e.textoLinea,
        candidatos: e.candidatos
      })),
      ...erroresVariables,
      ...erroresComposicion
    ];

    if (alcanceYAdvertencias.excedePresupuestoAdvertencias) {
      list.push({
        linea: 1,
        columna: 1,
        longitud: 1,
        codigo: 'exceso_advertencias',
        mensaje: `El documento tiene ${alcanceYAdvertencias.todasLasAdvertencias.length} advertencias (el presupuesto máximo visible es ${PRESUPUESTO_MAXIMO_ADVERTENCIAS_VISIBLES}).`
      });
    }
    return list;
  }, [parseResult.errores, erroresVariables, erroresComposicion, alcanceYAdvertencias]);

  // ─── Bloque e ítem activo según el cursor ──────────────────────────────────
  const activeBlockIndex = useMemo(
    () => resolveBlockIndexForLine(blockLineNumbers, cursor.linea),
    [blockLineNumbers, cursor.linea]
  );
  const activeBlock = useMemo<NotebookBlock | null>(
    () => (activeBlockIndex >= 0 ? parseResult.bloques[activeBlockIndex] ?? null : null),
    [parseResult.bloques, activeBlockIndex]
  );

  const activeSubtotalInfo = useMemo<SubtotalBloqueInfo | null>(() => {
    if (activeBlockIndex < 0) return null;
    const blockLine = blockLineNumbers[activeBlockIndex];
    if (blockLine === undefined) return null;
    return subtotalesPorBloque[blockLine] ?? null;
  }, [activeBlockIndex, blockLineNumbers, subtotalesPorBloque]);

  const activeItemId = activeSubtotalInfo?.itemId ?? null;

  // ─── Autocompletado contextual y Ghost Text ────────────────────────────────
  const variableNames = useMemo(
    () => (presupuesto.variablesCotizacion || []).map(v => v.id),
    [presupuesto.variablesCotizacion]
  );

  const autocomplete = useMemo<NotebookAutocompleteResult>(
    () =>
      getContextualAutocompleteSuggestions(
        texto,
        cursor.linea,
        cursor.columna,
        contexto,
        variableNames
      ),
    [texto, cursor.linea, cursor.columna, contexto, variableNames]
  );

  const clampedAutocompleteIndex = useMemo(() => {
    if (autocomplete.suggestions.length === 0) return 0;
    return Math.max(0, Math.min(autocompleteSelectedIndex, autocomplete.suggestions.length - 1));
  }, [autocomplete.suggestions.length, autocompleteSelectedIndex]);

  // ─── Paleta de comandos ────────────────────────────────────────────────────
  const allPaletteCommands = useMemo(
    () => buildNotebookCommandPalette(contexto),
    [contexto]
  );
  const filteredPaletteCommands = useMemo(
    () => filterNotebookCommandPalette(allPaletteCommands, paletteQuery),
    [allPaletteCommands, paletteQuery]
  );
  const clampedPaletteIndex = useMemo(() => {
    if (filteredPaletteCommands.length === 0) return 0;
    return Math.max(0, Math.min(paletteSelectedIndex, filteredPaletteCommands.length - 1));
  }, [filteredPaletteCommands.length, paletteSelectedIndex]);

  const commandPalette: CommandPaletteState = useMemo(
    () => ({
      isOpen: paletteOpen,
      query: paletteQuery,
      selectedIndex: clampedPaletteIndex,
      commands: filteredPaletteCommands
    }),
    [paletteOpen, paletteQuery, clampedPaletteIndex, filteredPaletteCommands]
  );

  // ─── Siguiente tarea sin valorizar (Pasada 2) ───────────────────────────────
  const unvalorizedEntries = useMemo<SiguienteSinValorizarInfo[]>(() => {
    const out: SiguienteSinValorizarInfo[] = [];
    for (let i = 0; i < parseResult.bloques.length; i++) {
      const block = parseResult.bloques[i];
      if (block.tipo !== 'tarea_tipo' && block.tipo !== 'item_libre') continue;
      const linea = blockLineNumbers[i] ?? i + 1;
      const info = subtotalesPorBloque[linea];
      if (info && info.estadoValorizacion === 'sin_valorizar') {
        const item = presupuesto.items.find(it => it.id === info.itemId);
        out.push({
          itemId: info.itemId,
          linea,
          descripcion: item?.descripcion || (block.tipo === 'tarea_tipo' ? block.referencia : block.descripcion)
        });
      }
    }
    return out;
  }, [parseResult.bloques, blockLineNumbers, subtotalesPorBloque, presupuesto.items]);

  const siguienteSinValorizar = useMemo<SiguienteSinValorizarInfo | null>(() => {
    if (unvalorizedEntries.length === 0) return null;
    return unvalorizedEntries.find(e => e.linea > cursor.linea) || unvalorizedEntries[0];
  }, [unvalorizedEntries, cursor.linea]);

  // ─── Acciones de Edición y Cursor ──────────────────────────────────────────
  const setTexto = useCallback((nuevoTexto: string) => {
    setTextoState(nuevoTexto);
    setAutocompleteSelectedIndex(0);
    setForzarValorizarTodos(false);
    setIsDirty(true);
    setSaveStatus('idle');
  }, []);

  const setCursor = useCallback((linea: number, columna: number) => {
    setCursorState({
      linea: Math.max(1, linea),
      columna: Math.max(1, columna)
    });
    setAutocompleteSelectedIndex(0);
  }, []);

  const moveAutocompleteSelection = useCallback(
    (delta: 1 | -1) => {
      const len = autocomplete.suggestions.length;
      if (len === 0) return;
      setAutocompleteSelectedIndex(prev => (prev + delta + len) % len);
    },
    [autocomplete.suggestions.length]
  );

  const acceptAutocomplete = useCallback(
    (index?: number) => {
      if (autocomplete.suggestions.length === 0) return false;
      const targetIdx = index ?? clampedAutocompleteIndex;
      const sug = autocomplete.suggestions[targetIdx];
      if (!sug) return false;

      const { nextTexto, nextCursor } = replaceSpanInLine(
        texto,
        cursor.linea,
        sug.replaceStartCol,
        sug.replaceEndCol,
        sug.insertText
      );
      setTextoState(nextTexto);
      setCursorState(nextCursor);
      setAutocompleteSelectedIndex(0);
      setIsDirty(true);
      return true;
    },
    [autocomplete.suggestions, clampedAutocompleteIndex, texto, cursor.linea]
  );

  const acceptGhostText = useCallback(() => {
    if (!autocomplete.ghostText) return false;
    const { nextTexto, nextCursor } = replaceSpanInLine(
      texto,
      cursor.linea,
      cursor.columna,
      cursor.columna,
      autocomplete.ghostText
    );
    setTextoState(nextTexto);
    setCursorState(nextCursor);
    setAutocompleteSelectedIndex(0);
    setIsDirty(true);
    return true;
  }, [autocomplete.ghostText, texto, cursor.linea, cursor.columna]);

  const handleTabKey = useCallback((): TabJumpResult => {
    if (autocomplete.isOpen && autocomplete.ghostText) {
      const len = autocomplete.ghostText.length;
      acceptGhostText();
      return {
        handled: true,
        linea: cursor.linea,
        columna: cursor.columna + len
      };
    }

    const lines = texto.split(/\r?\n/);
    const rawLine = lines[Math.max(0, cursor.linea - 1)] || '';
    const jump = findNextParameterSlot(rawLine, cursor.linea, cursor.columna);
    if (jump.handled) {
      setCursorState({
        linea: jump.linea,
        columna: jump.columna,
        selectionStartCol: jump.selectionStartCol,
        selectionEndCol: jump.selectionEndCol
      });
    }
    return jump;
  }, [autocomplete.isOpen, autocomplete.ghostText, acceptGhostText, texto, cursor.linea, cursor.columna]);

  // ─── Acciones de Flujo 2 Pasadas y Metadata ────────────────────────────────
  const irASiguienteSinValorizar = useCallback((): SiguienteSinValorizarInfo | null => {
    if (!siguienteSinValorizar) return null;
    setCursorState({ linea: siguienteSinValorizar.linea, columna: 1 });
    return siguienteSinValorizar;
  }, [siguienteSinValorizar]);

  const valorizarItem = useCallback((itemId: string) => {
    setValorizarIdsOverride(prev => (prev.includes(itemId) ? prev : [...prev, itemId]));
    setIsDirty(true);
  }, []);

  const valorizarTodasPendientes = useCallback(() => {
    setForzarValorizarTodos(true);
    setPassMode('valorizacion');
    setIsDirty(true);
  }, []);

  const actualizarMetadataPresupuesto = useCallback((patch: Partial<Presupuesto>) => {
    setMetadataOverrides(prev => ({ ...prev, ...patch }));
    setIsDirty(true);
    setSaveStatus('idle');
  }, []);

  const toggleVistaPrevia = useCallback(() => {
    setMostrarVistaPrevia(v => !v);
  }, []);

  const toggleAyudaAtajos = useCallback(() => {
    setMostrarAyudaAtajos(v => !v);
  }, []);

  // ─── Persistencia en Dexie (Single Source of Truth) ─────────────────────────
  const guardar = useCallback(async (): Promise<Presupuesto | null> => {
    setSaveStatus('saving');
    try {
      const now = new Date().toISOString();
      const toSave: Presupuesto = {
        ...presupuesto,
        updatedAt: now,
        fechaModificacion: now,
        deleted: false
      };
      if (db.presupuestos?.put) {
        await db.presupuestos.put(toSave);
      }
      setSaveStatus('saved');
      setIsDirty(false);
      onSaved?.(toSave);
      return toSave;
    } catch {
      setSaveStatus('error');
      return null;
    }
  }, [presupuesto, onSaved]);

  // ─── Conversión de tarea libre repetida en Trabajo Tipo ────────────────────
  const convertirTareaLibreATareaTipo = useCallback(
    async (
      descripcionNormalizada: string,
      nombrePersonalizado?: string
    ): Promise<TareaTipo | null> => {
      const sug = sugerenciasConversion.find(
        s => s.descripcionNormalizada === descripcionNormalizada
      );
      const targetItem = sug
        ? presupuesto.items.find(it => it.id === sug.itemIds[0])
        : presupuesto.items.find(
            it =>
              !it.tareaTipoId &&
              it.descripcion.trim().toLowerCase() === descripcionNormalizada.toLowerCase()
          );

      if (!targetItem) return null;

      const nuevaId = `tt-custom-${Date.now()}-${slugifyIdentificador(nombrePersonalizado || targetItem.descripcion)}`;
      const nuevaTarea = construirTareaTipoDesdeItemLibre(
        targetItem,
        nuevaId,
        nombrePersonalizado
      );

      if (db.tareasTipo?.put) {
        await db.tareasTipo.put(nuevaTarea);
      }
      setExtraTareasTipo(prev => [...prev, nuevaTarea]);

      // Reemplaza los ítems coincidentes en el presupuesto actual por referencias a la nueva TareaTipo
      const idsAReemplazar = new Set(sug?.itemIds || [targetItem.id]);
      const itemsActualizados: ItemPresupuesto[] = presupuesto.items.map(it =>
        idsAReemplazar.has(it.id)
          ? {
              ...it,
              tareaTipoId: nuevaTarea.id,
              overridesParametros: { cantidad: safeNum(it.cantidad) || 1 }
            }
          : it
      );
      const nextCtx: NotebookDocumentContext = {
        ...contexto,
        tareasTipo: [...contexto.tareasTipo, nuevaTarea]
      };
      const projectedBlocks = presupuestoToNotebookBlocks(
        { ...presupuesto, items: itemsActualizados },
        nextCtx
      );
      setTextoState(serialize(projectedBlocks, buildParseContext(nextCtx)));
      setIsDirty(true);
      return nuevaTarea;
    },
    [sugerenciasConversion, presupuesto, contexto]
  );

  // ─── Acciones de Paleta de Comandos (Ctrl+K / /) ───────────────────────────
  const openCommandPalette = useCallback((initialQuery = '') => {
    setPaletteQuery(initialQuery);
    setPaletteSelectedIndex(0);
    setPaletteOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setPaletteOpen(false);
    setPaletteQuery('');
    setPaletteSelectedIndex(0);
  }, []);

  const setCommandPaletteQuery = useCallback((query: string) => {
    setPaletteQuery(query);
    setPaletteSelectedIndex(0);
  }, []);

  const moveCommandPaletteSelection = useCallback(
    (delta: 1 | -1) => {
      const len = filteredPaletteCommands.length;
      if (len === 0) return;
      setPaletteSelectedIndex(prev => (prev + delta + len) % len);
    },
    [filteredPaletteCommands.length]
  );

  const executeCommandPaletteItem = useCallback(
    async (commandId?: string): Promise<boolean> => {
      const cmd = commandId
        ? filteredPaletteCommands.find(c => c.id === commandId) ||
          allPaletteCommands.find(c => c.id === commandId)
        : filteredPaletteCommands[clampedPaletteIndex];

      if (!cmd) return false;
      closeCommandPalette();

      switch (cmd.actionType) {
        case 'insert_line': {
          if (cmd.insertLine !== undefined) {
            const { nextTexto, nextCursor } = insertLineAtCursor(
              texto,
              cursor.linea,
              cmd.insertLine
            );
            setTextoState(nextTexto);
            setCursorState(nextCursor);
            setIsDirty(true);
          }
          return true;
        }
        case 'next_unvalorized': {
          return irASiguienteSinValorizar() !== null;
        }
        case 'valorize_current': {
          if (activeItemId) {
            valorizarItem(activeItemId);
            return true;
          }
          return false;
        }
        case 'valorize_all': {
          valorizarTodasPendientes();
          return true;
        }
        case 'toggle_pass_mode': {
          setPassMode(m => (m === 'esqueleto' ? 'valorizacion' : 'esqueleto'));
          return true;
        }
        case 'toggle_preview': {
          toggleVistaPrevia();
          return true;
        }
        case 'toggle_shortcuts_help': {
          toggleAyudaAtajos();
          return true;
        }
        case 'save': {
          return (await guardar()) !== null;
        }
      }
    },
    [
      filteredPaletteCommands,
      allPaletteCommands,
      clampedPaletteIndex,
      closeCommandPalette,
      texto,
      cursor.linea,
      irASiguienteSinValorizar,
      activeItemId,
      valorizarItem,
      valorizarTodasPendientes,
      toggleVistaPrevia,
      toggleAyudaAtajos,
      guardar
    ]
  );

  // Reproyectar manualmente desde el modelo si la vista lo necesita (ej. descartar texto inválido)
  const reserializeFromPresupuesto = useCallback(() => {
    const blocks = presupuestoToNotebookBlocks(presupuesto, contexto);
    setTextoState(serialize(blocks, buildParseContext(contexto)));
  }, [presupuesto, contexto]);

  // ─── Acciones de Modo Ejecutar (Móvil orientado a esquemas de Trabajo Tipo) ──
  const clienteActual = useMemo<Contacto | undefined>(() => {
    if (!presupuesto.clienteId || !dbContactos) return undefined;
    return dbContactos.find(c => c.id === presupuesto.clienteId && !c.deleted);
  }, [presupuesto.clienteId, dbContactos]);

  const buscarTareasTipoMovil = useCallback(
    (query = ''): TareaTipo[] => ordenarTareasTipoParaMovil(contexto.tareasTipo, query),
    [contexto.tareasTipo]
  );

  const agregarTareaTipoDesdeEsquema = useCallback(
    async (
      tareaTipoId: string,
      valoresParametros?: Record<string, number>
    ): Promise<void> => {
      const tarea = contexto.tareasTipo.find(t => t.id === tareaTipoId);
      if (!tarea) return;

      const newLine = construirLineaTareaTipoDesdeEsquema(tarea, valoresParametros);
      const base = texto.trimEnd();
      const nextTexto = base ? `${base}\n${newLine}` : newLine;
      setTexto(nextTexto);

      const ahora = new Date().toISOString();
      const siguienteFrecuencia = safeNum(tarea.frecuenciaUso) + 1;
      const tareaActualizada: TareaTipo = {
        ...tarea,
        frecuenciaUso: siguienteFrecuencia,
        ultimoUsoFecha: ahora,
        updatedAt: ahora
      };
      setExtraTareasTipo(prev => [...prev.filter(t => t.id !== tarea.id), tareaActualizada]);
      if (db.tareasTipo?.update) {
        try {
          await db.tareasTipo.update(tarea.id, {
            frecuenciaUso: siguienteFrecuencia,
            ultimoUsoFecha: ahora,
            updatedAt: ahora
          });
        } catch {
          // En entornos de test con mock parcial de Dexie o fuera de DB, mantener estado en memoria
        }
      }
    },
    [contexto.tareasTipo, texto, setTexto]
  );

  const actualizarParametroDeItem = useCallback(
    (itemId: string, paramId: string, valor: number) => {
      const entry = Object.entries(subtotalesPorBloque).find(
        ([, info]) => info.itemId === itemId
      );
      if (!entry) return;
      const linea1Based = Number(entry[0]);
      if (!Number.isFinite(linea1Based) || linea1Based < 1) return;

      const lines = texto.split(/\r?\n/);
      const idx = linea1Based - 1;
      if (idx < 0 || idx >= lines.length) return;
      lines[idx] = actualizarParametroEnLineaTt(lines[idx], paramId, valor);
      setTexto(lines.join('\n'));
    },
    [subtotalesPorBloque, texto, setTexto]
  );

  const agregarItemLibreRapido = useCallback(
    (descripcion: string, cantidad: number, precioUnitario: number) => {
      if (!descripcion.trim()) return;
      const newLine = construirLineaItemLibreRapido(descripcion, cantidad, precioUnitario);
      const base = texto.trimEnd();
      setTexto(base ? `${base}\n${newLine}` : newLine);
    },
    [texto, setTexto]
  );

  const eliminarItemPorId = useCallback(
    (itemId: string) => {
      const entry = Object.entries(subtotalesPorBloque).find(
        ([, info]) => info.itemId === itemId
      );
      if (!entry) return;
      const linea1Based = Number(entry[0]);
      if (!Number.isFinite(linea1Based) || linea1Based < 1) return;
      setTexto(eliminarBloqueEnLinea(texto, linea1Based));
    },
    [subtotalesPorBloque, texto, setTexto]
  );

  return {
    // Modelo & Proyección
    presupuesto,
    clienteActual,
    contexto,
    texto,
    setTexto,
    reserializeFromPresupuesto,
    actualizarMetadataPresupuesto,
    bloques: parseResult.bloques,
    totales: totales as TotalesPresupuestoResultado,
    alcanceYAdvertencias: alcanceYAdvertencias as ResultadoAlcanceYAdvertencias,
    subtotalesPorBloque,
    subtotalesPorItemId,
    blockLineNumbers,
    capitulos: presupuesto.capitulos as CapituloPresupuesto[],
    isDirty,
    saveStatus,
    guardar,

    // Cursor y Bloque activo
    cursor,
    setCursor,
    activeBlockIndex,
    activeBlock,
    activeItemId,
    activeSubtotalInfo,
    handleTabKey,

    // Autocompletado y Ghost Text
    autocomplete,
    autocompleteSelectedIndex: clampedAutocompleteIndex,
    moveAutocompleteSelection,
    acceptAutocomplete,
    acceptGhostText,

    // Paleta de Comandos (Ctrl+K / /)
    commandPalette,
    openCommandPalette,
    closeCommandPalette,
    setCommandPaletteQuery,
    moveCommandPaletteSelection,
    executeCommandPaletteItem,

    // Flujo de Dos Pasadas
    passMode,
    setPassMode,
    esTotalParcial,
    tareasSinValorizar,
    cantidadSinValorizar: tareasSinValorizar.length,
    siguienteSinValorizar,
    irASiguienteSinValorizar,
    valorizarItem,
    valorizarTodasPendientes,

    // Sugerencias de conversión y UI Preview
    sugerenciasConversion,
    convertirTareaLibreATareaTipo,
    mostrarVistaPrevia,
    toggleVistaPrevia,
    mostrarAyudaAtajos,
    toggleAyudaAtajos,

    // Acciones Modo Ejecutar (Móvil)
    buscarTareasTipoMovil,
    agregarTareaTipoDesdeEsquema,
    actualizarParametroDeItem,
    agregarItemLibreRapido,
    eliminarItemPorId,

    // Errores y Lints
    errores,
    erroresParser: parseResult.errores,
    esValido: parseResult.valido && errores.length === 0
  };
}
