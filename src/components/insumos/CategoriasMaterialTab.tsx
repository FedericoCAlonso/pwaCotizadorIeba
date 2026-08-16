import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  RotateCcw,
  ListFilter,
  Sliders,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { CategoriaMaterial, Material, AtributoSugerido, AtributoDependencia } from '../../core/types';
import { db, softDelete } from '../../db/database';
import { INITIAL_CATEGORIAS_MATERIAL } from '../../core/sampleData';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';

interface CategoriasMaterialTabProps {
  categorias: CategoriaMaterial[];
  materiales: Material[];
  isCreatingCat: boolean;
  setIsCreatingCat: (val: boolean) => void;
}

interface AttributeOptionsEditorProps {
  opciones: string[];
  onChange: (opciones: string[]) => void;
  inputCls: string;
}

const AttributeOptionsEditor: React.FC<AttributeOptionsEditorProps> = ({
  opciones = [],
  onChange,
  inputCls,
}) => {
  const [inputValue, setInputValue] = useState('');

  const addOption = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!opciones.includes(trimmed)) {
      onChange([...opciones, trimmed]);
    }
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addOption(inputValue);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const items = pasteData
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (items.length > 0) {
      const unique = Array.from(new Set([...opciones, ...items]));
      onChange(unique);
      setInputValue('');
    }
  };

  const removeOption = (idx: number) => {
    onChange(opciones.filter((_, i) => i !== idx));
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-outline-variant/15 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-on-surface-variant flex items-center gap-1">
          <ListFilter className="w-3 h-3 text-primary" />
          <span>Opciones Predefinidas (Desplegable)</span>
        </label>
        <span className="text-[10px] text-on-surface-variant font-mono">
          {opciones.length > 0 ? `${opciones.length} opciones cargadas` : 'Campo libre (sin desplegable)'}
        </span>
      </div>

      {/* Chips List */}
      {opciones.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-surface-container rounded-xl border border-outline-variant/20 max-h-28 overflow-y-auto">
          {opciones.map((opt, oIdx) => (
            <span
              key={oIdx}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 shadow-2xs group"
            >
              <span>{opt}</span>
              <button
                type="button"
                onClick={() => removeOption(oIdx)}
                className="text-primary/70 hover:text-rose-500 rounded-full p-0.5 transition-colors"
                title={`Quitar "${opt}"`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input to add options */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => {
            if (inputValue.trim()) addOption(inputValue);
          }}
          placeholder="Escribir opción y presionar Enter (o pegar lista separada por comas)..."
          className={`${inputCls} text-xs py-1.5 min-h-[36px] bg-surface-container`}
        />
        <button
          type="button"
          onClick={() => addOption(inputValue)}
          disabled={!inputValue.trim()}
          className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 disabled:opacity-40 text-primary font-semibold text-xs rounded-xl transition-colors h-[36px] shrink-0"
        >
          + Agregar
        </button>
      </div>
    </div>
  );
};

interface AttributeDependenciesEditorProps {
  dependencias: AtributoDependencia[];
  onChange: (dependencias: AtributoDependencia[]) => void;
  availableAttributes: AtributoSugerido[];
  currentAttributeOptions: string[];
  inputCls: string;
}

const AttributeDependenciesEditor: React.FC<AttributeDependenciesEditorProps> = ({
  dependencias = [],
  onChange,
  availableAttributes,
  currentAttributeOptions = [],
  inputCls,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const addDependency = () => {
    const defaultSource = availableAttributes[0]?.clave || '';
    onChange([
      ...dependencias,
      {
        dependeVinculo: defaultSource,
        valorEsperado: '',
        bloqueado: false,
      },
    ]);
    setIsExpanded(true);
  };

  const updateDependency = (index: number, field: keyof AtributoDependencia, value: any) => {
    const next = [...dependencias];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const removeDependency = (index: number) => {
    onChange(dependencias.filter((_, idx) => idx !== index));
  };

  return (
    <div className="mt-2 pt-2 border-t border-outline-variant/15">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Reglas Condicionales / Dependencias ({dependencias.length})</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {dependencias.length > 0 && !isExpanded && (
          <span className="text-[10px] bg-purple-500/15 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">
            {dependencias.length} regla{dependencias.length !== 1 ? 's' : ''} activa{dependencias.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="mt-2.5 space-y-3 p-3 bg-surface-container-high/60 rounded-2xl border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-on-surface-variant">
              Aplica reglas automáticas cuando el usuario selecciona un valor específico en otro atributo de esta categoría.
            </p>
            <button
              type="button"
              onClick={addDependency}
              className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1 shrink-0 ml-2"
            >
              <Plus className="w-3 h-3" /> Agregar Regla
            </button>
          </div>

          {dependencias.length === 0 ? (
            <div className="p-3 text-center text-[11px] text-on-surface-variant italic bg-surface-container rounded-xl border border-dashed border-outline-variant/30">
              No hay reglas condicionales para este atributo.
            </div>
          ) : (
            <div className="space-y-3">
              {dependencias.map((dep, dIdx) => {
                const sourceAttr = availableAttributes.find((a) => a.clave === dep.dependeVinculo);
                const sourceOptions = sourceAttr?.opciones || [];

                return (
                  <div
                    key={dIdx}
                    className="bg-surface-container p-3.5 rounded-xl border border-outline-variant/30 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
                      <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Regla #{dIdx + 1}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDependency(dIdx)}
                        className="text-on-surface-variant hover:text-rose-500 p-1 rounded-lg transition-colors"
                        title="Eliminar regla"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] text-on-surface-variant font-medium mb-1">
                          Si el atributo...
                        </label>
                        <select
                          value={dep.dependeVinculo}
                          onChange={(e) => updateDependency(dIdx, 'dependeVinculo', e.target.value)}
                          className={`${inputCls} text-xs py-1 min-h-[36px]`}
                        >
                          <option value="">-- Seleccionar Atributo Origen --</option>
                          {availableAttributes.map((a) => (
                            <option key={a.clave} value={a.clave}>
                              {a.etiqueta || a.clave}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-on-surface-variant font-medium mb-1">
                          es igual a...
                        </label>
                        {sourceOptions.length > 0 ? (
                          <select
                            value={dep.valorEsperado}
                            onChange={(e) => updateDependency(dIdx, 'valorEsperado', e.target.value)}
                            className={`${inputCls} text-xs py-1 min-h-[36px]`}
                          >
                            <option value="">-- Seleccionar Valor Esperado --</option>
                            {sourceOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={dep.valorEsperado}
                            onChange={(e) => updateDependency(dIdx, 'valorEsperado', e.target.value)}
                            placeholder="Ej: Termomagnética (PIA)"
                            className={`${inputCls} text-xs py-1 min-h-[36px]`}
                          />
                        )}
                      </div>
                    </div>

                    {/* Actions when condition matches */}
                    <div className="space-y-2 pt-2 border-t border-outline-variant/15">
                      <span className="text-[10px] font-semibold text-on-surface-variant block uppercase tracking-wider">
                        Acción al cumplirse la condición:
                      </span>

                      <div className="space-y-2">
                        {/* Bloquear campo */}
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-on-surface">
                            <input
                              type="checkbox"
                              checked={!!dep.bloqueado}
                              onChange={(e) => updateDependency(dIdx, 'bloqueado', e.target.checked)}
                              className="w-4 h-4 text-primary rounded"
                            />
                            <span>Bloquear campo / Deshabilitar</span>
                          </label>

                          {dep.bloqueado && (
                            <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                              <span className="text-[10px] text-on-surface-variant">Valor fijo:</span>
                              <input
                                type="text"
                                value={dep.valorFijo || ''}
                                onChange={(e) => updateDependency(dIdx, 'valorFijo', e.target.value)}
                                placeholder="Ej: N/A o 1"
                                className={`${inputCls} text-xs py-1 min-h-[32px] font-mono`}
                              />
                            </div>
                          )}
                        </div>

                        {/* Filtrar opciones si el atributo actual tiene opciones */}
                        {currentAttributeOptions.length > 0 && !dep.bloqueado && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[10px] text-on-surface-variant font-medium block">
                              Filtrar opciones permitidas (haz clic para activar/desactivar opciones permitidas):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {currentAttributeOptions.map((opt) => {
                                const isFiltered = (dep.opcionesFiltradas || []).includes(opt);
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                      const current = dep.opcionesFiltradas || [];
                                      const next = isFiltered
                                        ? current.filter((x) => x !== opt)
                                        : [...current, opt];
                                      updateDependency(
                                        dIdx,
                                        'opcionesFiltradas',
                                        next.length > 0 ? next : undefined
                                      );
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                                      isFiltered
                                        ? 'bg-primary text-on-primary border-primary shadow-2xs'
                                        : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/30 hover:border-primary/50'
                                    }`}
                                  >
                                    {opt} {isFiltered ? '✓' : ''}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const CategoriasMaterialTab: React.FC<CategoriasMaterialTabProps> = ({
  categorias,
  materiales,
  isCreatingCat,
  setIsCreatingCat,
}) => {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [editingCat, setEditingCat] = useState<CategoriaMaterial | null>(null);
  const [formDataCat, setFormDataCat] = useState<{
    nombre: string;
    atributosSugeridos: AtributoSugerido[];
  }>({
    nombre: '',
    atributosSugeridos: [],
  });

  const inputCls =
    'w-full px-3.5 py-2.5 text-base sm:text-xs rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]';

  const handleOpenCreateCat = () => {
    setEditingCat(null);
    setFormDataCat({
      nombre: '',
      atributosSugeridos: [],
    });
    setIsCreatingCat(true);
  };

  const handleOpenEditCat = (cat: CategoriaMaterial) => {
    setEditingCat(cat);
    setFormDataCat({
      nombre: cat.nombre,
      atributosSugeridos: cat.atributosSugeridos
        ? cat.atributosSugeridos.map((a) => ({
            ...a,
            opciones: a.opciones ? [...a.opciones] : [],
            dependencias: a.dependencias
              ? a.dependencias.map((d) => ({
                  ...d,
                  opcionesFiltradas: d.opcionesFiltradas ? [...d.opcionesFiltradas] : [],
                }))
              : [],
          }))
        : [],
    });
    setIsCreatingCat(true);
  };

  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDataCat.nombre.trim()) return;

    // Clean empty options and dependencies
    const cleanAtributos: AtributoSugerido[] = formDataCat.atributosSugeridos.map((a) => {
      const res: AtributoSugerido = {
        clave: a.clave,
        etiqueta: a.etiqueta,
        tipo: a.tipo,
      };
      if (a.unidad && a.unidad.trim() !== '') res.unidad = a.unidad.trim();
      if (a.opciones && a.opciones.length > 0) res.opciones = a.opciones;
      if (a.dependencias && a.dependencias.length > 0) {
        const validDeps = a.dependencias.filter((d) => d.dependeVinculo && d.valorEsperado);
        if (validDeps.length > 0) res.dependencias = validDeps;
      }
      return res;
    });

    if (editingCat) {
      await db.categoriasMaterial.update(editingCat.id, {
        nombre: formDataCat.nombre.trim(),
        atributosSugeridos: cleanAtributos,
      });
      toast.success('Categoría actualizada');
    } else {
      const newCat: CategoriaMaterial = {
        id: `cat-${crypto.randomUUID()}`,
        nombre: formDataCat.nombre.trim(),
        atributosSugeridos: cleanAtributos,
      };
      await db.categoriasMaterial.add(newCat);
      toast.success('Categoría creada');
    }

    setIsCreatingCat(false);
    setEditingCat(null);
  };

  const handleDeleteCat = async (id: string) => {
    const ok = await confirm({
      title: 'Eliminar Categoría',
      message: '¿Estás seguro de eliminar esta categoría de materiales?',
      confirmText: 'Eliminar',
      isDestructive: true,
    });
    if (ok) {
      await softDelete('categoriasMaterial', id);
      toast.success('Categoría eliminada');
    }
  };

  const handleAddAtributoField = () => {
    setFormDataCat((prev) => ({
      ...prev,
      atributosSugeridos: [
        ...prev.atributosSugeridos,
        {
          clave: `attr_${Date.now().toString().slice(-4)}`,
          etiqueta: '',
          unidad: '',
          tipo: 'texto',
          opciones: [],
          dependencias: [],
        },
      ],
    }));
  };

  const handleRemoveAtributoField = (index: number) => {
    setFormDataCat((prev) => ({
      ...prev,
      atributosSugeridos: prev.atributosSugeridos.filter((_, idx) => idx !== index),
    }));
  };

  const handleUpdateAtributoField = (index: number, field: keyof AtributoSugerido, value: any) => {
    setFormDataCat((prev) => {
      const next = [...prev.atributosSugeridos];
      next[index] = { ...next[index], [field]: value };
      if (field === 'etiqueta' && !next[index].clave.startsWith('attr_manual_')) {
        next[index].clave = value
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '_');
      }
      return { ...prev, atributosSugeridos: next };
    });
  };

  const handleRestoreInitialCategories = async () => {
    const ok = await confirm({
      title: 'Restablecer Categorías Iniciales',
      message: '¿Restaurar las familias y atributos técnicos sugeridos de fábrica?',
      confirmText: 'Restaurar',
      isDestructive: false,
    });
    if (ok) {
      await db.categoriasMaterial.bulkPut(INITIAL_CATEGORIAS_MATERIAL);
      toast.success('Categorías restauradas a valores de fábrica');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-container-low p-4 rounded-3xl border border-outline-variant/20">
        <div>
          <h3 className="font-bold text-on-surface text-base">Familias & Categorías de Materiales</h3>
          <p className="text-xs text-on-surface-variant">
            Define la estructura de atributos técnicos normativos, listas de opciones y reglas condicionales para cada familia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRestoreInitialCategories}
            className="px-3.5 py-2 bg-surface-container-highest hover:bg-surface-variant text-on-surface-variant rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Restablecer categorías y atributos iniciales"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Fábrica</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreateCat}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-xs transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva Categoría</span>
          </button>
        </div>
      </div>

      {/* Grid de Categorías */}
      {categorias.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-low border border-dashed border-outline-variant/30 rounded-3xl p-6">
          <p className="text-sm text-on-surface-variant">No hay categorías cargadas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categorias.map((cat) => {
            const matCount = materiales.filter((m) => m.categoriaId === cat.id).length;
            return (
              <div
                key={cat.id}
                className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-primary/10 text-primary rounded-xl">
                        <Layers className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-on-surface text-base">{cat.nombre}</h4>
                    </div>
                    <span className="text-[11px] font-medium text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-full shrink-0">
                      {matCount} material{matCount !== 1 ? 'es' : ''}
                    </span>
                  </div>

                  <div className="mt-3">
                    <p className="text-[11px] font-semibold text-on-surface-variant mb-1">Atributos Sugeridos:</p>
                    {cat.atributosSugeridos && cat.atributosSugeridos.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {cat.atributosSugeridos.map((at, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[10px] bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-md border border-outline-variant/20 font-mono"
                          >
                            <span>
                              {at.etiqueta || at.clave} {at.unidad ? `(${at.unidad})` : ''}
                            </span>
                            {at.opciones && at.opciones.length > 0 && (
                              <span
                                className="text-[9px] bg-primary/15 text-primary px-1 rounded font-bold"
                                title={`Desplegable con ${at.opciones.length} opciones: ${at.opciones.join(', ')}`}
                              >
                                {at.opciones.length} opt
                              </span>
                            )}
                            {at.dependencias && at.dependencias.length > 0 && (
                              <span
                                className="text-[9px] bg-purple-500/15 text-purple-700 dark:text-purple-300 px-1 rounded font-bold"
                                title={`Reglas condicionales activas: ${at.dependencias.length}`}
                              >
                                ⚙️ {at.dependencias.length}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-on-surface-variant italic">Sin atributos definidos</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-outline-variant/20 flex justify-end gap-1">
                  <button
                    onClick={() => handleOpenEditCat(cat)}
                    className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest rounded-lg transition-colors cursor-pointer"
                    title="Editar Categoría"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteCat(cat.id)}
                    className="p-1.5 text-on-surface-variant hover:text-rose-500 hover:bg-surface-container-highest rounded-lg transition-colors cursor-pointer"
                    title="Eliminar Categoría"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar Categoría */}
      {isCreatingCat && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-3xl shadow-2xl p-6 text-on-surface max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3 shrink-0">
              <h3 className="text-base font-semibold text-on-surface">
                {editingCat ? 'Editar Categoría de Material' : 'Nueva Categoría de Material'}
              </h3>
              <button onClick={() => setIsCreatingCat(false)} className="text-on-surface-variant hover:text-on-surface p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCat} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1 font-medium">
                  Nombre de la Categoría
                </label>
                <input
                  type="text"
                  value={formDataCat.nombre}
                  onChange={(e) => setFormDataCat({ ...formDataCat, nombre: e.target.value })}
                  className={inputCls}
                  placeholder="Ej: Tableros Eléctricos, Cables, Protecciones..."
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-xs text-on-surface-variant font-medium">
                      Atributos Técnicos Sugeridos
                    </label>
                    <p className="text-[11px] text-on-surface-variant/80">
                      Define los parámetros técnicos normativos, listas de opciones y reglas condicionales para esta familia.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAtributoField}
                    className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Atributo
                  </button>
                </div>

                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                  {formDataCat.atributosSugeridos.length > 0 && (
                    <div className="hidden sm:grid grid-cols-12 gap-2 px-1 text-[11px] font-semibold text-on-surface-variant">
                      <span className="col-span-4">Nombre / Etiqueta</span>
                      <span className="col-span-3">Clave (ID interno)</span>
                      <span className="col-span-2">Unidad</span>
                      <span className="col-span-2">Tipo</span>
                      <span className="col-span-1 text-center">Acción</span>
                    </div>
                  )}

                  {formDataCat.atributosSugeridos.map((at, idx) => {
                    const otherAttrs = formDataCat.atributosSugeridos.filter((_, i) => i !== idx);

                    return (
                      <div
                        key={idx}
                        className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/25 space-y-2.5"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <div className="sm:col-span-4">
                            <label className="block sm:hidden text-[10px] text-on-surface-variant font-medium mb-0.5">
                              Etiqueta
                            </label>
                            <input
                              type="text"
                              value={at.etiqueta}
                              onChange={(e) => handleUpdateAtributoField(idx, 'etiqueta', e.target.value)}
                              className={`${inputCls} text-xs`}
                              placeholder="Ej: Sección"
                              required
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block sm:hidden text-[10px] text-on-surface-variant font-medium mb-0.5">
                              Clave slug
                            </label>
                            <input
                              type="text"
                              value={at.clave}
                              onChange={(e) => handleUpdateAtributoField(idx, 'clave', e.target.value)}
                              className={`${inputCls} text-xs font-mono`}
                              placeholder="ej: seccion"
                              required
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block sm:hidden text-[10px] text-on-surface-variant font-medium mb-0.5">
                              Unidad
                            </label>
                            <input
                              type="text"
                              value={at.unidad || ''}
                              onChange={(e) => handleUpdateAtributoField(idx, 'unidad', e.target.value)}
                              className={`${inputCls} text-xs font-mono`}
                              placeholder="mm², A, V"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block sm:hidden text-[10px] text-on-surface-variant font-medium mb-0.5">
                              Tipo
                            </label>
                            <select
                              value={at.tipo}
                              onChange={(e) => handleUpdateAtributoField(idx, 'tipo', e.target.value as any)}
                              className={`${inputCls} text-xs`}
                            >
                              <option value="texto">Texto</option>
                              <option value="numero">Número</option>
                            </select>
                          </div>
                          <div className="sm:col-span-1 flex justify-end sm:justify-center pt-1 sm:pt-0">
                            <button
                              type="button"
                              onClick={() => handleRemoveAtributoField(idx)}
                              className="p-1.5 text-on-surface-variant hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar atributo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Options Tag/Chip Editor */}
                        <AttributeOptionsEditor
                          opciones={at.opciones || []}
                          onChange={(newOpts) => handleUpdateAtributoField(idx, 'opciones', newOpts)}
                          inputCls={inputCls}
                        />

                        {/* Conditional Rules / Dependencies Editor */}
                        <AttributeDependenciesEditor
                          dependencias={at.dependencias || []}
                          onChange={(newDeps) => handleUpdateAtributoField(idx, 'dependencias', newDeps)}
                          availableAttributes={otherAttrs}
                          currentAttributeOptions={at.opciones || []}
                          inputCls={inputCls}
                        />
                      </div>
                    );
                  })}

                  {formDataCat.atributosSugeridos.length === 0 && (
                    <div className="text-xs text-on-surface-variant italic py-6 text-center bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/30 space-y-2">
                      <p>Sin atributos técnicos normativos definidos para esta categoría.</p>
                      <button
                        type="button"
                        onClick={handleAddAtributoField}
                        className="px-3 py-1.5 bg-primary/10 text-primary font-semibold text-xs rounded-full hover:bg-primary/20 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar primer atributo
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreatingCat(false)}
                  className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm shadow-sm cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
