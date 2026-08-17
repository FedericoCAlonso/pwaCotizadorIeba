import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ListFilter,
  Sliders,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FolderPlus,
  Package,
  Shield,
  Zap,
  Cpu,
  Lightbulb,
  Wrench,
  Activity,
  Sun,
  Tag,
  Search
} from 'lucide-react';
import { CategoriaMaterial, Material, AtributoSugerido, SupercategoriaMaterial } from '../../core/types';
import { DEFAULT_SUPERCATEGORIAS } from '../../core/sampleData';
import { db, softDelete } from '../../db/database';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';

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
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-secondary-container text-on-secondary-container border border-outline-variant/20 shadow-2xs group select-none"
            >
              <span>{opt}</span>
              <button
                type="button"
                onClick={() => removeOption(oIdx)}
                className="text-on-secondary-container/70 hover:text-error rounded-md p-0.5 transition-colors cursor-pointer"
                title="Eliminar opción"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input de nueva opción */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí una opción y presioná Enter o coma..."
          className={`${inputCls} text-xs py-1.5 min-h-[36px]`}
        />
        <button
          type="button"
          onClick={() => addOption(inputValue)}
          disabled={!inputValue.trim()}
          className="px-3 py-1.5 bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 disabled:opacity-50 text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
        >
          Agregar
        </button>
      </div>
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

  // Estados de vista
  const [selectedFamiliaFilter, setSelectedFamiliaFilter] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedFamilias, setExpandedFamilias] = useState<Set<string>>(new Set(['canalizaciones', 'conductores', 'protecciones', 'tableros']));
  
  // Modales de creación
  const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
  const [isCreatingFamilia, setIsCreatingFamilia] = useState(false);
  const [customFamilias, setCustomFamilias] = useState<SupercategoriaMaterial[]>([]);
  const [newFamiliaName, setNewFamiliaName] = useState('');

  // Edición de Categoría
  const [editingCat, setEditingCat] = useState<CategoriaMaterial | null>(null);
  const [isCustomFamiliaInput, setIsCustomFamiliaInput] = useState(false);
  const [customFamiliaText, setCustomFamiliaText] = useState('');
  
  const [formDataCat, setFormDataCat] = useState<{
    nombre: string;
    supercategoriaId: string;
    supercategoriaNombre: string;
    atributosSugeridos: AtributoSugerido[];
  }>({
    nombre: '',
    supercategoriaId: 'canalizaciones',
    supercategoriaNombre: 'Canalización y Contención',
    atributosSugeridos: [],
  });

  useEscapeKey(isCreatingCat, () => setIsCreatingCat(false));
  useEscapeKey(isChoiceModalOpen, () => setIsChoiceModalOpen(false));
  useEscapeKey(isCreatingFamilia, () => setIsCreatingFamilia(false));

  const inputCls =
    'w-full px-3.5 py-2.5 text-base sm:text-xs rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]';

  // Lista unificada de Familias (por defecto + personalizadas + presentes en categorías)
  const allFamilias = useMemo(() => {
    const map = new Map<string, SupercategoriaMaterial>();
    DEFAULT_SUPERCATEGORIAS.forEach(s => map.set(s.id, s));
    customFamilias.forEach(s => map.set(s.id, s));
    categorias.forEach(c => {
      const id = c.supercategoriaId || 'general';
      const nombre = c.supercategoriaNombre || 'General / Otros';
      if (!map.has(id)) {
        map.set(id, { id, nombre, orden: 50 });
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.orden ?? 50) - (b.orden ?? 50));
  }, [categorias, customFamilias]);

  // Expandir / Colapsar todas
  const handleToggleExpandAll = () => {
    if (expandedFamilias.size === allFamilias.length) {
      setExpandedFamilias(new Set());
    } else {
      setExpandedFamilias(new Set(allFamilias.map(f => f.id)));
    }
  };

  const toggleFamilia = (famId: string) => {
    setExpandedFamilias(prev => {
      const next = new Set(prev);
      if (next.has(famId)) {
        next.delete(famId);
      } else {
        next.add(famId);
      }
      return next;
    });
  };

  const getFamiliaIcon = (famId: string) => {
    switch (famId) {
      case 'canalizaciones': return <Package className="w-4 h-4 text-amber-500" />;
      case 'conductores': return <Zap className="w-4 h-4 text-sky-500" />;
      case 'protecciones': return <Shield className="w-4 h-4 text-emerald-500" />;
      case 'tableros': return <Layers className="w-4 h-4 text-indigo-500" />;
      case 'mecanismos': return <Sliders className="w-4 h-4 text-purple-500" />;
      case 'iluminacion': return <Lightbulb className="w-4 h-4 text-yellow-500" />;
      case 'puesta-a-tierra': return <Activity className="w-4 h-4 text-lime-500" />;
      case 'fijaciones': return <Wrench className="w-4 h-4 text-slate-400" />;
      case 'motores': return <Cpu className="w-4 h-4 text-cyan-500" />;
      case 'renovables': return <Sun className="w-4 h-4 text-orange-500" />;
      default: return <Tag className="w-4 h-4 text-primary" />;
    }
  };

  // Abrir creador de categoría
  const handleOpenCreateCat = (defaultFamId?: string, defaultFamName?: string) => {
    const famId = defaultFamId || 'canalizaciones';
    const famObj = allFamilias.find(f => f.id === famId);
    setEditingCat(null);
    setIsCustomFamiliaInput(false);
    setCustomFamiliaText('');
    setFormDataCat({
      nombre: '',
      supercategoriaId: famId,
      supercategoriaNombre: defaultFamName || (famObj ? famObj.nombre : 'Canalización y Contención'),
      atributosSugeridos: [],
    });
    setIsChoiceModalOpen(false);
    setIsCreatingCat(true);
  };

  const handleOpenEditCat = (cat: CategoriaMaterial) => {
    setEditingCat(cat);
    setIsCustomFamiliaInput(false);
    setCustomFamiliaText('');
    setFormDataCat({
      nombre: cat.nombre,
      supercategoriaId: cat.supercategoriaId || 'general',
      supercategoriaNombre: cat.supercategoriaNombre || 'General / Otros',
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

  const handleSupercategoryChange = (superId: string) => {
    if (superId === '__new__') {
      setIsCustomFamiliaInput(true);
      return;
    }
    setIsCustomFamiliaInput(false);
    const found = allFamilias.find(s => s.id === superId);
    setFormDataCat(prev => ({
      ...prev,
      supercategoriaId: superId,
      supercategoriaNombre: found ? found.nombre : superId
    }));
  };

  // Guardar nueva Familia individual
  const handleSaveNewFamilia = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFamiliaName.trim();
    if (!trimmed) return;

    const famId = `fam-${trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-')}`;
    
    if (allFamilias.some(f => f.nombre.toLowerCase() === trimmed.toLowerCase() || f.id === famId)) {
      toast.warning('Ya existe una familia con ese nombre.');
      return;
    }

    const newFam: SupercategoriaMaterial = {
      id: famId,
      nombre: trimmed,
      orden: 50
    };

    setCustomFamilias(prev => [...prev, newFam]);
    setExpandedFamilias(prev => new Set([...prev, famId]));
    setNewFamiliaName('');
    setIsCreatingFamilia(false);
    toast.success(`Familia "${trimmed}" creada.`);
  };

  // Guardar Categoría
  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDataCat.nombre.trim()) return;

    let finalFamId = formDataCat.supercategoriaId;
    let finalFamName = formDataCat.supercategoriaNombre;

    if (isCustomFamiliaInput && customFamiliaText.trim()) {
      finalFamName = customFamiliaText.trim();
      finalFamId = `fam-${finalFamName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-')}`;
      setCustomFamilias(prev => {
        if (prev.some(f => f.id === finalFamId)) return prev;
        return [...prev, { id: finalFamId, nombre: finalFamName, orden: 50 }];
      });
    }

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
        supercategoriaId: finalFamId,
        supercategoriaNombre: finalFamName,
        atributosSugeridos: cleanAtributos,
      });
      toast.success('Categoría actualizada');
    } else {
      const newCat: CategoriaMaterial = {
        id: `cat-${crypto.randomUUID()}`,
        nombre: formDataCat.nombre.trim(),
        supercategoriaId: finalFamId,
        supercategoriaNombre: finalFamName,
        atributosSugeridos: cleanAtributos,
      };
      await db.categoriasMaterial.add(newCat);
      toast.success('Categoría creada');
    }

    // Asegurar que la familia quede expandida
    setExpandedFamilias(prev => new Set([...prev, finalFamId]));
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
      atributosSugeridos: prev.atributosSugeridos.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateAtributo = (index: number, field: keyof AtributoSugerido, value: any) => {
    setFormDataCat((prev) => {
      const next = [...prev.atributosSugeridos];
      next[index] = { ...next[index], [field]: value };
      if (field === 'etiqueta' && (!next[index].clave || next[index].clave.startsWith('attr_'))) {
        next[index].clave = String(value)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '_');
      }
      return { ...prev, atributosSugeridos: next };
    });
  };

  // Filtrado de Familias y Categorías
  const sTerm = searchTerm.toLowerCase();
  const filteredFamilias = useMemo(() => {
    return allFamilias.filter(fam => {
      if (selectedFamiliaFilter !== 'todas' && fam.id !== selectedFamiliaFilter) return false;

      const famCategories = categorias.filter(c => (c.supercategoriaId || 'general') === fam.id);
      
      if (!sTerm) return true;

      const matchFamName = fam.nombre.toLowerCase().includes(sTerm);
      const matchCat = famCategories.some(c => 
        c.nombre.toLowerCase().includes(sTerm) ||
        (c.atributosSugeridos && c.atributosSugeridos.some(a => (a.etiqueta || a.clave).toLowerCase().includes(sTerm)))
      );

      return matchFamName || matchCat;
    });
  }, [allFamilias, categorias, selectedFamiliaFilter, sTerm]);

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-container-low p-4 rounded-3xl border border-outline-variant/20 shadow-xs">
        <div>
          <h3 className="font-bold text-on-surface text-base flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <span>Familias & Categorías de Materiales</span>
          </h3>
          <p className="text-xs text-on-surface-variant">
            Organiza tu catálogo por grandes familias y define los atributos técnicos normativos de cada categoría.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleToggleExpandAll}
            className="px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold rounded-xl border border-outline-variant/20 transition-colors cursor-pointer"
            title="Expandir o colapsar todas las familias"
          >
            {expandedFamilias.size === allFamilias.length ? 'Colapsar todo' : 'Expandir todo'}
          </button>
          <button
            type="button"
            onClick={() => setIsChoiceModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-xs state-layer transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuevo</span>
          </button>
        </div>
      </div>

      {/* Search & Family Filter Chips Bar */}
      <div className="space-y-3 bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/15">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por familia, categoría o atributo técnico (ej: corrugado, bandeja, disyuntor)..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips Horizontal Scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedFamiliaFilter('todas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
              selectedFamiliaFilter === 'todas'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
            }`}
          >
            Todas ({categorias.length})
          </button>
          {allFamilias.map(fam => {
            const count = categorias.filter(c => (c.supercategoriaId || 'general') === fam.id).length;
            const isSelected = selectedFamiliaFilter === fam.id;
            return (
              <button
                key={fam.id}
                type="button"
                onClick={() => setSelectedFamiliaFilter(fam.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-secondary-container text-on-secondary-container border border-primary/30 font-semibold shadow-xs'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                }`}
              >
                {getFamiliaIcon(fam.id)}
                <span>{fam.nombre}</span>
                <span className="text-[10px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accordion List by Familia */}
      {filteredFamilias.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-low rounded-3xl p-6 space-y-3 border border-dashed border-outline-variant/30">
          <Package className="w-10 h-10 text-outline mx-auto" />
          <p className="text-sm font-semibold text-on-surface">No se encontraron familias o categorías con ese criterio.</p>
          <button
            type="button"
            onClick={() => { setSearchTerm(''); setSelectedFamiliaFilter('todas'); }}
            className="px-4 py-1.5 bg-surface-container-high text-primary hover:underline text-xs font-semibold rounded-xl"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFamilias.map(fam => {
            const famCategories = categorias.filter(c => {
              const matchFam = (c.supercategoriaId || 'general') === fam.id;
              if (!matchFam) return false;
              if (!sTerm) return true;
              return (
                c.nombre.toLowerCase().includes(sTerm) ||
                fam.nombre.toLowerCase().includes(sTerm) ||
                (c.atributosSugeridos && c.atributosSugeridos.some(a => (a.etiqueta || a.clave).toLowerCase().includes(sTerm)))
              );
            });

            const totalMats = famCategories.reduce((acc, c) => acc + materiales.filter(m => m.categoriaId === c.id).length, 0);
            const isExpanded = expandedFamilias.has(fam.id);

            return (
              <div
                key={fam.id}
                className="bg-surface-container-low rounded-3xl border border-outline-variant/20 overflow-hidden shadow-xs transition-all"
              >
                {/* Familia Header (Collapsible trigger) */}
                <div
                  onClick={() => toggleFamilia(fam.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-container-high/60 select-none transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-surface-container-highest rounded-2xl shrink-0">
                      {getFamiliaIcon(fam.id)}
                    </div>
                    <div>
                      <h4 className="font-bold text-on-surface text-sm sm:text-base flex items-center gap-2">
                        {fam.nombre}
                      </h4>
                      <p className="text-[11px] text-on-surface-variant font-medium">
                        {famCategories.length} categorí{famCategories.length !== 1 ? 'as' : 'a'} · {totalMats} material{totalMats !== 1 ? 'es' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateCat(fam.id, fam.nombre)}
                      className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold rounded-full transition-colors cursor-pointer"
                      title={`Agregar categoría a ${fam.nombre}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Categoría</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFamilia(fam.id)}
                      className="p-2 text-on-surface-variant hover:text-on-surface rounded-full transition-colors cursor-pointer"
                      aria-label={isExpanded ? 'Colapsar familia' : 'Expandir familia'}
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Familia Body (Category Cards Grid) */}
                {isExpanded && (
                  <div className="p-4 pt-1 border-t border-outline-variant/15 bg-surface-container/30">
                    {famCategories.length === 0 ? (
                      <div className="text-center py-6 bg-surface-container-high/40 rounded-2xl p-4 space-y-2">
                        <p className="text-xs text-on-surface-variant">Esta familia aún no tiene categorías asignadas.</p>
                        <button
                          type="button"
                          onClick={() => handleOpenCreateCat(fam.id, fam.nombre)}
                          className="px-3.5 py-1.5 bg-primary text-on-primary text-xs font-semibold rounded-full inline-flex items-center gap-1 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" /> Crear primera categoría
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                        {famCategories.map((cat) => {
                          const matCount = materiales.filter((m) => m.categoriaId === cat.id).length;
                          return (
                            <div
                              key={cat.id}
                              className="bg-surface-container rounded-2xl p-4 border border-outline-variant/20 hover:border-outline-variant/40 hover:shadow-sm transition-all flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="p-2 bg-primary-container text-on-primary-container rounded-xl shrink-0">
                                      <Tag className="w-3.5 h-3.5" />
                                    </div>
                                    <h5 className="font-bold text-on-surface text-sm">{cat.nombre}</h5>
                                  </div>
                                  <span className="text-[10px] font-medium text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-lg shrink-0 select-none">
                                    {matCount} {matCount === 1 ? 'mat.' : 'mats.'}
                                  </span>
                                </div>

                                <div className="mt-3">
                                  <p className="text-[10px] font-semibold text-on-surface-variant mb-1">Atributos Sugeridos:</p>
                                  {cat.atributosSugeridos && cat.atributosSugeridos.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {cat.atributosSugeridos.map((at, idx) => (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center gap-1 text-[10px] bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-md font-mono select-none"
                                        >
                                          <span>
                                            {at.etiqueta || at.clave} {at.unidad ? `(${at.unidad})` : ''}
                                          </span>
                                          {at.opciones && at.opciones.length > 0 && (
                                            <span
                                              className="text-[9px] bg-secondary-container text-on-secondary-container px-1 py-0.2 rounded font-bold"
                                              title={`Opciones: ${at.opciones.join(', ')}`}
                                            >
                                              {at.opciones.length}
                                            </span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-on-surface-variant/70 italic">Sin atributos definidos</p>
                                  )}
                                </div>
                              </div>

                              <div className="mt-3.5 pt-2.5 border-t border-outline-variant/15 flex justify-end gap-1">
                                <button
                                  onClick={() => handleOpenEditCat(cat)}
                                  className="p-2 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container-high transition-colors flex items-center justify-center cursor-pointer"
                                  title="Editar Categoría"
                                  aria-label={`Editar categoría ${cat.nombre}`}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCat(cat.id)}
                                  className="p-2 text-on-surface-variant hover:text-error rounded-lg hover:bg-surface-container-high transition-colors flex items-center justify-center cursor-pointer"
                                  title="Eliminar Categoría"
                                  aria-label={`Eliminar categoría ${cat.nombre}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. MODAL DE ELECCIÓN: ¿Qué deseas crear? (Mismo patrón que Materiales)
         ───────────────────────────────────────────────────────────── */}
      {isChoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container rounded-3xl w-full max-w-md shadow-2xl p-6 text-on-surface border border-outline-variant/20">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-outline-variant/20">
              <div>
                <h3 className="text-base font-bold text-on-surface">¿Qué deseas crear?</h3>
                <p className="text-xs text-on-surface-variant">Elige el tipo de elemento a dar de alta en tu catálogo</p>
              </div>
              <button
                type="button"
                onClick={() => setIsChoiceModalOpen(false)}
                className="p-1 text-on-surface-variant hover:text-on-surface rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 py-2">
              {/* Opción 1: Nueva Categoría */}
              <button
                type="button"
                onClick={() => {
                  setIsChoiceModalOpen(false);
                  handleOpenCreateCat();
                }}
                className="flex items-start gap-3.5 p-4 rounded-2xl bg-surface-container-high hover:bg-primary-container/40 border border-outline-variant/20 hover:border-primary/40 text-left transition-all group cursor-pointer"
              >
                <div className="p-3 bg-primary text-on-primary rounded-2xl group-hover:scale-105 transition-transform shrink-0 shadow-sm">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-on-surface group-hover:text-primary">
                    🏷️ Nueva Categoría Técnica
                  </h4>
                  <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                    Crea una tipología técnica (ej: <em>Caños, Bandejas, Termomagnéticas</em>) y define sus atributos normativos sugeridos.
                  </p>
                </div>
              </button>

              {/* Opción 2: Nueva Familia */}
              <button
                type="button"
                onClick={() => {
                  setIsChoiceModalOpen(false);
                  setIsCreatingFamilia(true);
                }}
                className="flex items-start gap-3.5 p-4 rounded-2xl bg-surface-container-high hover:bg-secondary-container/40 border border-outline-variant/20 hover:border-secondary/40 text-left transition-all group cursor-pointer"
              >
                <div className="p-3 bg-secondary text-on-secondary rounded-2xl group-hover:scale-105 transition-transform shrink-0 shadow-sm">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-on-surface group-hover:text-secondary">
                    📦 Nueva Familia de Materiales
                  </h4>
                  <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                    Crea un nuevo rubro o grupo contenedor (ej: <em>Seguridad Electrónica & CCTV, Redes & Datos</em>) para agrupar categorías.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. MINI MODAL: Crear Nueva Familia
         ───────────────────────────────────────────────────────────── */}
      {isCreatingFamilia && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container rounded-3xl w-full max-w-md shadow-2xl p-6 text-on-surface border border-outline-variant/20">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-outline-variant/20">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-secondary" />
                <span>Nueva Familia de Materiales</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatingFamilia(false)}
                className="p-1 text-on-surface-variant hover:text-on-surface rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewFamilia} className="space-y-4">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1 font-semibold">
                  Nombre de la Familia / Rubro *
                </label>
                <input
                  type="text"
                  value={newFamiliaName}
                  onChange={(e) => setNewFamiliaName(e.target.value)}
                  placeholder="Ej: Seguridad Electrónica & CCTV, Redes & Datos..."
                  className={inputCls}
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setIsCreatingFamilia(false)}
                  className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold rounded-full"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newFamiliaName.trim()}
                  className="px-5 py-2 bg-secondary text-on-secondary hover:bg-secondary/90 disabled:opacity-50 text-xs font-bold rounded-full shadow-sm cursor-pointer"
                >
                  Guardar Familia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. MODAL: Crear / Editar Categoría Técnica
         ───────────────────────────────────────────────────────────── */}
      {isCreatingCat && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container rounded-3xl w-full max-w-3xl shadow-2xl p-6 text-on-surface max-h-[90vh] flex flex-col border border-outline-variant/20">
            <div className="flex items-center justify-between mb-4 border-b border-outline-variant/20 pb-3 shrink-0">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                <span>{editingCat ? 'Editar Categoría de Material' : 'Nueva Categoría de Material'}</span>
              </h3>
              <button
                onClick={() => setIsCreatingCat(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-on-surface-variant hover:text-on-surface rounded-full state-layer cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCat} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1 font-semibold">
                    Nombre de la Categoría *
                  </label>
                  <input
                    type="text"
                    value={formDataCat.nombre}
                    onChange={(e) => setFormDataCat({ ...formDataCat, nombre: e.target.value })}
                    className={inputCls}
                    placeholder="Ej: Caños y Tuberías Conduit"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1 font-semibold">
                    Familia de Pertenencia *
                  </label>
                  {!isCustomFamiliaInput ? (
                    <select
                      value={formDataCat.supercategoriaId}
                      onChange={(e) => handleSupercategoryChange(e.target.value)}
                      className={inputCls}
                    >
                      {allFamilias.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                      <option value="__new__" className="text-primary font-bold">
                        + Crear nueva familia personalizada...
                      </option>
                    </select>
                  ) : (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={customFamiliaText}
                        onChange={(e) => setCustomFamiliaText(e.target.value)}
                        placeholder="Escribe el nombre de la nueva familia..."
                        className={inputCls}
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomFamiliaInput(false);
                          setCustomFamiliaText('');
                        }}
                        className="p-2 text-on-surface-variant hover:text-on-surface rounded-xl bg-surface-container-high"
                        title="Cancelar y volver al listado"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Atributos Técnicos Sugeridos</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddAtributoField}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Atributo</span>
                  </button>
                </div>

                {formDataCat.atributosSugeridos.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-outline-variant/30 rounded-2xl p-4 text-xs text-on-surface-variant">
                    No hay atributos definidos. Agrega atributos como <em>Diámetro, Norma, Tipo, Sección</em> para sugerirlos al crear materiales de esta categoría.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {formDataCat.atributosSugeridos.map((attr, index) => (
                      <div
                        key={index}
                        className="p-3 bg-surface-container-high/70 border border-outline-variant/30 rounded-2xl space-y-2.5"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <div className="sm:col-span-4">
                            <label className="block text-[10px] text-on-surface-variant font-medium mb-0.5">
                              Etiqueta Visible
                            </label>
                            <input
                              type="text"
                              value={attr.etiqueta}
                              onChange={(e) => handleUpdateAtributo(index, 'etiqueta', e.target.value)}
                              placeholder="Ej: Diámetro Nominal"
                              className={`${inputCls} py-1.5 text-xs min-h-[36px]`}
                              required
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-[10px] text-on-surface-variant font-medium mb-0.5">
                              Clave Interna (ID)
                            </label>
                            <input
                              type="text"
                              value={attr.clave}
                              onChange={(e) => handleUpdateAtributo(index, 'clave', e.target.value)}
                              placeholder="ej: diametro"
                              className={`${inputCls} py-1.5 text-xs font-mono min-h-[36px]`}
                              required
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-on-surface-variant font-medium mb-0.5">
                              Unidad
                            </label>
                            <input
                              type="text"
                              value={attr.unidad || ''}
                              onChange={(e) => handleUpdateAtributo(index, 'unidad', e.target.value)}
                              placeholder="mm, A, W..."
                              className={`${inputCls} py-1.5 text-xs min-h-[36px]`}
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-on-surface-variant font-medium mb-0.5">
                              Tipo
                            </label>
                            <select
                              value={attr.tipo}
                              onChange={(e) => handleUpdateAtributo(index, 'tipo', e.target.value as any)}
                              className={`${inputCls} py-1.5 text-xs min-h-[36px]`}
                            >
                              <option value="texto">Texto</option>
                              <option value="numero">Numérico</option>
                            </select>
                          </div>

                          <div className="sm:col-span-1 flex justify-end items-end pt-3 sm:pt-0">
                            <button
                              type="button"
                              onClick={() => handleRemoveAtributoField(index)}
                              className="p-2 text-on-surface-variant hover:text-error rounded-xl transition-colors cursor-pointer"
                              title="Eliminar atributo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Editor de opciones predefinidas */}
                        <AttributeOptionsEditor
                          opciones={attr.opciones || []}
                          onChange={(newOpts) => handleUpdateAtributo(index, 'opciones', newOpts)}
                          inputCls={inputCls}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/20 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreatingCat(false)}
                  className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold rounded-full"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-full shadow-sm cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Categoría</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
