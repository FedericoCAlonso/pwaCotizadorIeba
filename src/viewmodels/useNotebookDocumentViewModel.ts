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
  actualizarParametroEnBloque,
  applyNotebookBlocksToPresupuesto,
  buildNotebookCommandPalette,
  buildParseContext,
  construirLineaItemLibreRapido,
  construirLineaTareaTipoDesdeEsquema,
  construirTareaTipoDesdeItemLibre,
  eliminarBloqueEnLinea,
  evaluateNotebookText,
  filterNotebookCommandPalette,
  findNextParameterSlotInDocument,
  getContextualAutocompleteSuggestions,
  ModoPasadaCotizacion,
  NotebookAutocompleteResult,
  NotebookAutocompleteSuggestion,
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

interface HistorySnapshot {
  texto: string;
  cursor: NotebookCursor;
  timestamp: number;
}

const MAX_UNDO_HISTORY = 100;
const TYPING_COALESCE_WINDOW_MS = 550;

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

function offsetToLineColInsideSnippet(
  baseLine1Based: number,
  baseStartCol0Based: number,
  snippet: string,
  offset: number
): { linea: number; col1Based: number } {
  const safe = Math.max(0, Math.min(offset, snippet.length));
  const sub = snippet.slice(0, safe);
  const parts = sub.split('\n');
  if (parts.length === 1) {
    return {
      linea: baseLine1Based,
      col1Based: baseStartCol0Based + parts[0].length + 1
    };
  }
  return {
    linea: baseLine1Based + parts.length - 1,
    col1Based: (parts[parts.length - 1]?.length ?? 0) + 1
  };
}

function replaceSpanInLine(
  texto: string,
  linea1Based: number,
  startCol1Based: number,
  endCol1Based: number,
  insertText: string,
  selStartOffset?: number,
  selEndOffset?: number
): { nextTexto: string; nextCursor: NotebookCursor } {
  const lines = texto.split(/\r?\n/);
  const idx = Math.max(0, Math.min(linea1Based - 1, lines.length - 1));
  const raw = lines[idx] ?? '';
  const start = Math.max(0, Math.min(startCol1Based - 1, raw.length));
  const end = Math.max(start, Math.min(endCol1Based - 1, raw.length));
  const updatedChunk = `${raw.slice(0, start)}${insertText}${raw.slice(end)}`;
  const insertedLines = updatedChunk.split('\n');
  lines.splice(idx, 1, ...insertedLines);

  const endOffset = selEndOffset ?? insertText.length;
  const startOffset = selStartOffset ?? endOffset;
  const startPos = offsetToLineColInsideSnippet(idx + 1, start, insertText, startOffset);
  const endPos = offsetToLineColInsideSnippet(idx + 1, start, insertText, endOffset);

  const hasSingleLineSelection =
    selStartOffset !== undefined &&
    selEndOffset !== undefined &&
    selEndOffset > selStartOffset &&
    startPos.linea === endPos.linea;

  return {
    nextTexto: lines.join('\n'),
    nextCursor: {
      linea: endPos.linea,
      columna: endPos.col1Based,
      ...(hasSingleLineSelection
        ? { selectionStartCol: startPos.col1Based, selectionEndCol: endPos.col1Based }
        : {})
    }
  };
}

function applyAutocompleteSuggestionToText(
  texto: string,
  linea1Based: number,
  sug: NotebookAutocompleteSuggestion
): { nextTexto: string; nextCursor: NotebookCursor } {
  if (sug.insertOnNewIndentedLine) {
    const lines = texto.split(/\r?\n/);
    const idx = Math.max(0, Math.min(linea1Based - 1, lines.length - 1));
    const raw = lines[idx] ?? '';
    const start = Math.max(0, Math.min(sug.replaceStartCol - 1, raw.length));
    const end = Math.max(start, Math.min(sug.replaceEndCol - 1, raw.length));
    lines[idx] = `${raw.slice(0, start)}${raw.slice(end)}`.trimEnd();
    const newLine = `  ${sug.insertText}`;
    lines.splice(idx + 1, 0, newLine);

    const hasSel =
      sug.selectionStartOffset !== undefined &&
      sug.selectionEndOffset !== undefined &&
      sug.selectionEndOffset > sug.selectionStartOffset;
    const endCol = 3 + (sug.selectionEndOffset ?? sug.insertText.length);
    const startCol = 3 + (sug.selectionStartOffset ?? sug.insertText.length);
    return {
      nextTexto: lines.join('\n'),
      nextCursor: {
        linea: idx + 2,
        columna: endCol,
        ...(hasSel ? { selectionStartCol: startCol, selectionEndCol: endCol } : {})
      }
    };
  }

  return replaceSpanInLine(
    texto,
    linea1Based,
    sug.replaceStartCol,
    sug.replaceEndCol,
    sug.insertText,
    sug.selectionStartOffset,
    sug.selectionEndOffset
  );
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

  const chunkLines = lineContent.split('\n');
  if (chunkLines.length > 1) {
    const firstParamMatch = chunkLines[1].match(/^(\s*[a-zA-Z_][\w-]*\s*=\s*)(.+)$/);
    if (firstParamMatch) {
      const selStartCol = firstParamMatch[1].length + 1;
      const selEndCol = chunkLines[1].length + 1;
      return {
        nextTexto: lines.join('\n'),
        nextCursor: {
          linea: targetIdx + 2,
          columna: selEndCol,
          selectionStartCol: selStartCol,
          selectionEndCol: selEndCol
        }
      };
    }
  }

  const lastChunkLine = chunkLines[chunkLines.length - 1] ?? '';
  return {
    nextTexto: lines.join('\n'),
    nextCursor: {
      linea: targetIdx + chunkLines.length,
      columna: lastChunkLine.length + 1
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
  const [cursorSyncSeq, setCursorSyncSeq] = useState(0);
  const [autocompleteSelectedIndex, setAutocompleteSelectedIndex] = useState(0);
  const [autocompleteDismissedLineKey, setAutocompleteDismissedLineKey] = useState<string | null>(null);
  const [forceAutocompleteOpen, setForceAutocompleteOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteSelectedIndex, setPaletteSelectedIndex] = useState(0);
  const [mostrarVistaPrevia, setMostrarVistaPrevia] = useState(false);
  const [mostrarAyudaAtajos, setMostrarAyudaAtajos] = useState(false);
  const [saveStatus, setSaveStatus] = useState<NotebookSaveStatus>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const [historyState, setHistoryState] = useState<{
    past: HistorySnapshot[];
    future: HistorySnapshot[];
  }>({ past: [], future: [] });

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
  const latestTextoRef = useRef<string>(texto);
  const latestCursorRef = useRef<NotebookCursor>(cursor);
  const historyRef = useRef<{ past: HistorySnapshot[]; future: HistorySnapshot[] }>(historyState);
  latestTextoRef.current = texto;
  latestCursorRef.current = cursor;

  // Hidrata si llega el presupuesto asincrónicamente desde IndexedDB (sin pisar ediciones del usuario)
  useEffect(() => {
    if (loadedFromDb && hydratedIdRef.current !== loadedFromDb.id && !isDirty) {
      hydratedIdRef.current = loadedFromDb.id;
      const blocks = presupuestoToNotebookBlocks(loadedFromDb, contexto);
      const nextSerialized = serialize(blocks, buildParseContext(contexto));
      latestTextoRef.current = nextSerialized;
      setTextoState(nextSerialized);
      historyRef.current = { past: [], future: [] };
      setHistoryState({ past: [], future: [] });
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

  const currentLineKey = useMemo(() => {
    const lines = texto.split(/\r?\n/);
    const lineText = lines[Math.max(0, Math.min(cursor.linea - 1, lines.length - 1))] ?? '';
    return `${cursor.linea}:${lineText}`;
  }, [texto, cursor.linea]);

  const rawAutocomplete = useMemo<NotebookAutocompleteResult>(
    () =>
      getContextualAutocompleteSuggestions(
        texto,
        cursor.linea,
        cursor.columna,
        contexto,
        variableNames,
        { forceOpen: forceAutocompleteOpen }
      ),
    [texto, cursor.linea, cursor.columna, contexto, variableNames, forceAutocompleteOpen]
  );

  const autocomplete = useMemo<NotebookAutocompleteResult>(() => {
    if (!forceAutocompleteOpen && autocompleteDismissedLineKey === currentLineKey) {
      return {
        ...rawAutocomplete,
        isOpen: false,
        ghostText: ''
      };
    }
    return rawAutocomplete;
  }, [rawAutocomplete, forceAutocompleteOpen, autocompleteDismissedLineKey, currentLineKey]);

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

  // ─── Historial Undo / Redo y Edición ───────────────────────────────────────
  const commitEdit = useCallback(
    (
      nuevoTexto: string,
      nextCursor?: NotebookCursor,
      options?: { coalesce?: boolean; recordHistory?: boolean; markDirty?: boolean }
    ) => {
      const prevTexto = latestTextoRef.current;
      const prevCursor = latestCursorRef.current;
      const shouldRecord = options?.recordHistory !== false && nuevoTexto !== prevTexto;

      if (shouldRecord) {
        const now = Date.now();
        const prevHist = historyRef.current;
        const lastSnap = prevHist.past[prevHist.past.length - 1];
        const lenDelta = Math.abs(nuevoTexto.length - prevTexto.length);
        const lineChanged =
          (nuevoTexto.match(/\n/g)?.length ?? 0) !== (prevTexto.match(/\n/g)?.length ?? 0);
        const isWhitespaceBoundary = lenDelta === 1 && /\s$/.test(nuevoTexto);
        const canCoalesce =
          Boolean(options?.coalesce) &&
          Boolean(lastSnap) &&
          now - (lastSnap?.timestamp ?? 0) < TYPING_COALESCE_WINDOW_MS &&
          lenDelta === 1 &&
          !lineChanged &&
          !isWhitespaceBoundary;

        let nextPast: HistorySnapshot[];
        if (canCoalesce && lastSnap) {
          nextPast = [
            ...prevHist.past.slice(0, -1),
            { ...lastSnap, timestamp: now }
          ];
        } else {
          nextPast = [
            ...prevHist.past,
            { texto: prevTexto, cursor: prevCursor, timestamp: now }
          ].slice(-MAX_UNDO_HISTORY);
        }

        const updatedHist = { past: nextPast, future: [] };
        historyRef.current = updatedHist;
        setHistoryState(updatedHist);
      }

      if (nuevoTexto !== prevTexto) {
        latestTextoRef.current = nuevoTexto;
        setTextoState(nuevoTexto);
      }
      if (nextCursor) {
        latestCursorRef.current = nextCursor;
        setCursorState(nextCursor);
        if (!options?.coalesce) {
          setCursorSyncSeq(s => s + 1);
        }
      }
      setAutocompleteSelectedIndex(0);
      setAutocompleteDismissedLineKey(null);
      setForceAutocompleteOpen(false);
      setForzarValorizarTodos(false);
      if (options?.markDirty !== false) {
        setIsDirty(true);
        setSaveStatus('idle');
      }
    },
    []
  );

  const undo = useCallback((): boolean => {
    const currentHist = historyRef.current;
    if (currentHist.past.length === 0) return false;
    const prevSnapshot = currentHist.past[currentHist.past.length - 1];
    const nextHist = {
      past: currentHist.past.slice(0, -1),
      future: [
        ...currentHist.future,
        {
          texto: latestTextoRef.current,
          cursor: latestCursorRef.current,
          timestamp: Date.now()
        }
      ].slice(-MAX_UNDO_HISTORY)
    };
    historyRef.current = nextHist;
    setHistoryState(nextHist);
    latestTextoRef.current = prevSnapshot.texto;
    latestCursorRef.current = prevSnapshot.cursor;
    setTextoState(prevSnapshot.texto);
    setCursorState(prevSnapshot.cursor);
    setCursorSyncSeq(s => s + 1);
    setAutocompleteSelectedIndex(0);
    setAutocompleteDismissedLineKey(null);
    setForceAutocompleteOpen(false);
    setIsDirty(true);
    setSaveStatus('idle');
    return true;
  }, []);

  const redo = useCallback((): boolean => {
    const currentHist = historyRef.current;
    if (currentHist.future.length === 0) return false;
    const nextSnapshot = currentHist.future[currentHist.future.length - 1];
    const nextHist = {
      past: [
        ...currentHist.past,
        {
          texto: latestTextoRef.current,
          cursor: latestCursorRef.current,
          timestamp: Date.now()
        }
      ].slice(-MAX_UNDO_HISTORY),
      future: currentHist.future.slice(0, -1)
    };
    historyRef.current = nextHist;
    setHistoryState(nextHist);
    latestTextoRef.current = nextSnapshot.texto;
    latestCursorRef.current = nextSnapshot.cursor;
    setTextoState(nextSnapshot.texto);
    setCursorState(nextSnapshot.cursor);
    setCursorSyncSeq(s => s + 1);
    setAutocompleteSelectedIndex(0);
    setAutocompleteDismissedLineKey(null);
    setForceAutocompleteOpen(false);
    setIsDirty(true);
    setSaveStatus('idle');
    return true;
  }, []);

  const setTexto = useCallback(
    (nuevoTexto: string, nextCursor?: NotebookCursor) => {
      commitEdit(nuevoTexto, nextCursor, { coalesce: true });
    },
    [commitEdit]
  );

  const setCursor = useCallback((linea: number, columna: number) => {
    const nextLinea = Math.max(1, linea);
    const nextColumna = Math.max(1, columna);
    const prev = latestCursorRef.current;
    if (prev.linea === nextLinea && prev.columna === nextColumna) {
      return;
    }
    const nextCursor: NotebookCursor = { linea: nextLinea, columna: nextColumna };
    latestCursorRef.current = nextCursor;
    setCursorState(nextCursor);
    setAutocompleteSelectedIndex(0);
    if (prev.linea !== nextLinea) {
      setForceAutocompleteOpen(false);
    }
  }, []);

  const dismissAutocomplete = useCallback(() => {
    setAutocompleteDismissedLineKey(currentLineKey);
    setForceAutocompleteOpen(false);
  }, [currentLineKey]);

  const forceOpenAutocomplete = useCallback(() => {
    setAutocompleteDismissedLineKey(null);
    setForceAutocompleteOpen(true);
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

      const { nextTexto, nextCursor } = applyAutocompleteSuggestionToText(
        latestTextoRef.current,
        latestCursorRef.current.linea,
        sug
      );
      commitEdit(nextTexto, nextCursor, { coalesce: false });
      return true;
    },
    [autocomplete.suggestions, clampedAutocompleteIndex, commitEdit]
  );

  const acceptGhostText = useCallback(() => {
    if (!autocomplete.ghostText) return false;
    const { nextTexto, nextCursor } = replaceSpanInLine(
      latestTextoRef.current,
      latestCursorRef.current.linea,
      latestCursorRef.current.columna,
      latestCursorRef.current.columna,
      autocomplete.ghostText
    );
    commitEdit(nextTexto, nextCursor, { coalesce: false });
    return true;
  }, [autocomplete.ghostText, commitEdit]);

  const handleTabKey = useCallback(
    (shiftKey = false): TabJumpResult => {
      if (!shiftKey && autocomplete.isOpen && autocomplete.suggestions.length > 0) {
        const accepted = acceptAutocomplete();
        if (accepted) {
          return {
            handled: true,
            linea: latestCursorRef.current.linea,
            columna: latestCursorRef.current.columna,
            selectionStartCol: latestCursorRef.current.selectionStartCol,
            selectionEndCol: latestCursorRef.current.selectionEndCol
          };
        }
      }

      if (!shiftKey && autocomplete.isOpen && autocomplete.ghostText) {
        const len = autocomplete.ghostText.length;
        const startLinea = latestCursorRef.current.linea;
        const startCol = latestCursorRef.current.columna;
        acceptGhostText();
        return {
          handled: true,
          linea: startLinea,
          columna: startCol + len
        };
      }

      const jump = findNextParameterSlotInDocument(
        latestTextoRef.current,
        latestCursorRef.current.linea,
        latestCursorRef.current.columna,
        shiftKey ? -1 : 1
      );
      if (jump.handled) {
        const nextCursor: NotebookCursor = {
          linea: jump.linea,
          columna: jump.columna,
          selectionStartCol: jump.selectionStartCol,
          selectionEndCol: jump.selectionEndCol
        };
        latestCursorRef.current = nextCursor;
        setCursorState(nextCursor);
        return jump;
      }

      // Fallback estándar de editor: indentar / des-indentar 2 espacios en la línea actual
      const lines = latestTextoRef.current.split(/\r?\n/);
      const idx = Math.max(0, Math.min(latestCursorRef.current.linea - 1, lines.length - 1));
      const rawLine = lines[idx] ?? '';
      if (shiftKey) {
        const leadingMatch = rawLine.match(/^( {1,2})/);
        if (leadingMatch) {
          const removed = leadingMatch[1].length;
          lines[idx] = rawLine.slice(removed);
          const nextCol = Math.max(1, latestCursorRef.current.columna - removed);
          commitEdit(lines.join('\n'), { linea: idx + 1, columna: nextCol }, { coalesce: false });
          return { handled: true, linea: idx + 1, columna: nextCol };
        }
        return { handled: false, linea: idx + 1, columna: latestCursorRef.current.columna };
      }

      lines[idx] = `  ${rawLine}`;
      const nextCol = latestCursorRef.current.columna + 2;
      commitEdit(lines.join('\n'), { linea: idx + 1, columna: nextCol }, { coalesce: false });
      return { handled: true, linea: idx + 1, columna: nextCol };
    },
    [
      autocomplete.isOpen,
      autocomplete.ghostText,
      autocomplete.suggestions.length,
      acceptGhostText,
      acceptAutocomplete,
      commitEdit
    ]
  );

  const handleEnterKey = useCallback((): boolean => {
    const lines = latestTextoRef.current.split(/\r?\n/);
    const idx = Math.max(0, Math.min(latestCursorRef.current.linea - 1, lines.length - 1));
    const rawLine = lines[idx] ?? '';
    const colIdx = Math.max(0, Math.min(latestCursorRef.current.columna - 1, rawLine.length));
    const before = rawLine.slice(0, colIdx);
    const after = rawLine.slice(colIdx);
    const trimmed = rawLine.trim();

    // Si es una sub-línea indentada vacía (solo espacios), salir del bloque limpiando indentación
    if (/^\s+$/.test(rawLine)) {
      lines[idx] = '';
      commitEdit(lines.join('\n'), { linea: idx + 1, columna: 1 }, { coalesce: false });
      return true;
    }

    const indentMatch = rawLine.match(/^(\s+)/);
    const startsBlockHeader =
      trimmed.startsWith('/tt ') || trimmed.startsWith('tarea:') || trimmed.startsWith('item:');

    if (indentMatch && after.trim() === '') {
      const indent = indentMatch[1];
      lines[idx] = before;
      lines.splice(idx + 1, 0, indent);
      commitEdit(
        lines.join('\n'),
        { linea: idx + 2, columna: indent.length + 1 },
        { coalesce: false }
      );
      return true;
    }

    if (startsBlockHeader && after.trim() === '') {
      lines[idx] = before;
      lines.splice(idx + 1, 0, '  ');
      commitEdit(lines.join('\n'), { linea: idx + 2, columna: 3 }, { coalesce: false });
      return true;
    }

    return false;
  }, [commitEdit]);

  const moveCurrentLine = useCallback(
    (direction: -1 | 1): boolean => {
      const lines = latestTextoRef.current.split(/\r?\n/);
      const idx = Math.max(0, Math.min(latestCursorRef.current.linea - 1, lines.length - 1));
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= lines.length) return false;
      const temp = lines[idx];
      lines[idx] = lines[targetIdx];
      lines[targetIdx] = temp;
      commitEdit(
        lines.join('\n'),
        { linea: targetIdx + 1, columna: latestCursorRef.current.columna },
        { coalesce: false }
      );
      return true;
    },
    [commitEdit]
  );

  const duplicateCurrentLine = useCallback((): boolean => {
    const lines = latestTextoRef.current.split(/\r?\n/);
    const idx = Math.max(0, Math.min(latestCursorRef.current.linea - 1, lines.length - 1));
    lines.splice(idx + 1, 0, lines[idx] ?? '');
    commitEdit(
      lines.join('\n'),
      { linea: idx + 2, columna: latestCursorRef.current.columna },
      { coalesce: false }
    );
    return true;
  }, [commitEdit]);

  const deleteCurrentLine = useCallback((): boolean => {
    const lines = latestTextoRef.current.split(/\r?\n/);
    const idx = Math.max(0, Math.min(latestCursorRef.current.linea - 1, lines.length - 1));
    if (lines.length === 1) {
      if (lines[0] === '') return false;
      commitEdit('', { linea: 1, columna: 1 }, { coalesce: false });
      return true;
    }
    lines.splice(idx, 1);
    const nextIdx = Math.min(idx, lines.length - 1);
    commitEdit(lines.join('\n'), { linea: nextIdx + 1, columna: 1 }, { coalesce: false });
    return true;
  }, [commitEdit]);

  const toggleCommentCurrentLine = useCallback((): boolean => {
    const lines = latestTextoRef.current.split(/\r?\n/);
    const idx = Math.max(0, Math.min(latestCursorRef.current.linea - 1, lines.length - 1));
    const rawLine = lines[idx] ?? '';
    const indentMatch = rawLine.match(/^(\s*)(.*)$/);
    const indent = indentMatch?.[1] ?? '';
    const body = indentMatch?.[2] ?? '';
    let nextCol = latestCursorRef.current.columna;

    if (body.startsWith('// ')) {
      lines[idx] = `${indent}${body.slice(3)}`;
      nextCol = Math.max(1, nextCol - 3);
    } else if (body.startsWith('//')) {
      lines[idx] = `${indent}${body.slice(2)}`;
      nextCol = Math.max(1, nextCol - 2);
    } else {
      lines[idx] = `${indent}// ${body}`;
      nextCol += 3;
    }

    commitEdit(lines.join('\n'), { linea: idx + 1, columna: nextCol }, { coalesce: false });
    return true;
  }, [commitEdit]);

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
      commitEdit(serialize(projectedBlocks, buildParseContext(nextCtx)), undefined, { coalesce: false });
      return nuevaTarea;
    },
    [sugerenciasConversion, presupuesto, contexto, commitEdit]
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
              latestTextoRef.current,
              latestCursorRef.current.linea,
              cmd.insertLine
            );
            commitEdit(nextTexto, nextCursor, { coalesce: false });
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
        case 'undo': {
          return undo();
        }
        case 'redo': {
          return redo();
        }
        case 'open_suggestions': {
          forceOpenAutocomplete();
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
      commitEdit,
      irASiguienteSinValorizar,
      activeItemId,
      valorizarItem,
      valorizarTodasPendientes,
      toggleVistaPrevia,
      toggleAyudaAtajos,
      undo,
      redo,
      forceOpenAutocomplete,
      guardar
    ]
  );

  // Reproyectar manualmente desde el modelo si la vista lo necesita (ej. descartar texto inválido)
  const reserializeFromPresupuesto = useCallback(() => {
    const blocks = presupuestoToNotebookBlocks(presupuesto, contexto);
    commitEdit(serialize(blocks, buildParseContext(contexto)), undefined, { coalesce: false });
  }, [presupuesto, contexto, commitEdit]);

  // ─── Acciones de Modo Ejecutar (Móvil orientado a esquemas de Trabajo Tipo) ──
  const contactos = useMemo<Contacto[]>(
    () => (dbContactos || []).filter(c => !c.deleted),
    [dbContactos]
  );

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
      commitEdit(nextTexto, undefined, { coalesce: false });

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
    [contexto.tareasTipo, texto, commitEdit]
  );

  const actualizarParametroDeItem = useCallback(
    (itemId: string, paramId: string, valor: number) => {
      const entry = Object.entries(subtotalesPorBloque).find(
        ([, info]) => info.itemId === itemId
      );
      if (!entry) return;
      const linea1Based = Number(entry[0]);
      if (!Number.isFinite(linea1Based) || linea1Based < 1) return;

      const nextTexto = actualizarParametroEnBloque(
        latestTextoRef.current,
        linea1Based,
        paramId,
        valor
      );
      commitEdit(nextTexto, undefined, { coalesce: false });
    },
    [subtotalesPorBloque, commitEdit]
  );

  const agregarItemLibreRapido = useCallback(
    (descripcion: string, cantidad: number, precioUnitario: number) => {
      if (!descripcion.trim()) return;
      const newLine = construirLineaItemLibreRapido(descripcion, cantidad, precioUnitario);
      const base = texto.trimEnd();
      commitEdit(base ? `${base}\n${newLine}` : newLine, undefined, { coalesce: false });
    },
    [texto, commitEdit]
  );

  const eliminarItemPorId = useCallback(
    (itemId: string) => {
      const entry = Object.entries(subtotalesPorBloque).find(
        ([, info]) => info.itemId === itemId
      );
      if (!entry) return;
      const linea1Based = Number(entry[0]);
      if (!Number.isFinite(linea1Based) || linea1Based < 1) return;
      commitEdit(eliminarBloqueEnLinea(latestTextoRef.current, linea1Based), undefined, {
        coalesce: false
      });
    },
    [subtotalesPorBloque, commitEdit]
  );

  return {
    // Modelo & Proyección
    presupuesto,
    contactos,
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

    // Historial Undo / Redo y acciones de línea
    canUndo: historyState.past.length > 0,
    canRedo: historyState.future.length > 0,
    undo,
    redo,
    handleEnterKey,
    moveCurrentLine,
    duplicateCurrentLine,
    deleteCurrentLine,
    toggleCommentCurrentLine,

    // Cursor y Bloque activo
    cursor,
    cursorSyncSeq,
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
    dismissAutocomplete,
    forceOpenAutocomplete,

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
