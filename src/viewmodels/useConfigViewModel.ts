import { useState, useEffect } from 'react';
import { AppConfig } from '../core/types';
import { db, resetDatabaseToDefaults } from '../db/database';
import {
  INITIAL_CATEGORIAS_MATERIAL,
  INITIAL_MATERIALES,
  INITIAL_PRODUCTOS,
  INITIAL_OFERTAS,
  INITIAL_INSUMOS,
  INITIAL_MANO_OBRA,
  INITIAL_COSTOS_INDIRECTOS,
  INITIAL_TAREAS_TIPO,
  BASE_TAREA_CATEGORIES
} from '../core/sampleData';
import { isFirebaseConfigured, getFirebaseConfig, clearCustomFirebaseConfig } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';

export interface UseConfigViewModelProps {
  config: AppConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function useConfigViewModel({
  config,
  isOpen,
  onClose,
  onSave
}: UseConfigViewModelProps) {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [formData, setFormData] = useState<AppConfig>({
    ...config,
    categoriasTarea: config.categoriasTarea && config.categoriasTarea.length > 0
      ? config.categoriasTarea
      : [...BASE_TAREA_CATEGORIES]
  });

  const [showAuthSetup, setShowAuthSetup] = useState(false);
  const firebaseConfigured = isFirebaseConfigured();
  const currentFbConfig = getFirebaseConfig();

  // Categorías de Trabajos / Tareas
  const [newCatName, setNewCatName] = useState('');
  const [editingCatIndex, setEditingCatIndex] = useState<number | null>(null);
  const [editingCatValue, setEditingCatValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...config,
        categoriasTarea: config.categoriasTarea && config.categoriasTarea.length > 0
          ? config.categoriasTarea
          : [...BASE_TAREA_CATEGORIES]
      });
      setNewCatName('');
      setEditingCatIndex(null);
      setEditingCatValue('');
    }
  }, [isOpen, config]);

  const updateFormData = (updates: Partial<AppConfig>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await db.config.put(formData);
    toast.success('Configuración guardada exitosamente');
    onSave();
    onClose();
  };

  const handleRestoreDefaultCategories = async () => {
    const ok = await confirm({
      title: 'Restaurar Categorías de Materiales',
      message: '¿Estás seguro de restablecer las categorías iniciales? Esta acción se recomienda solo si tus categorías sufrieron alteraciones.',
      confirmText: 'Restaurar',
      isDestructive: true
    });
    if (ok) {
      await db.categoriasMaterial.bulkPut(INITIAL_CATEGORIAS_MATERIAL);
      toast.success('Las categorías de materiales por defecto han sido restauradas.');
    }
  };

  const handleRestoreDefaultMaterials = async () => {
    const ok = await confirm({
      title: 'Cargar / Restaurar Catálogo Base de Materiales',
      message: `¿Estás seguro de cargar el catálogo base de materiales (${INITIAL_MATERIALES.length} fichas técnicas: cables unipolares con código de colores, cajas, gabinetes, caños RS y PVC, conectores y bandejas portacables con accesorios)?`,
      confirmText: 'Cargar Catálogo Base',
      isDestructive: false
    });
    if (ok) {
      await db.materiales.bulkPut(INITIAL_MATERIALES);
      if (INITIAL_PRODUCTOS.length > 0) await db.productos.bulkPut(INITIAL_PRODUCTOS);
      if (INITIAL_OFERTAS.length > 0) await db.ofertas.bulkPut(INITIAL_OFERTAS);
      if (INITIAL_INSUMOS.length > 0) await db.insumos.bulkPut(INITIAL_INSUMOS);
      toast.success(`${INITIAL_MATERIALES.length} materiales base cargados correctamente en el catálogo con sus marcas y precios.`);
    }
  };

  const handleRestoreDefaultManoObra = async () => {
    const ok = await confirm({
      title: 'Cargar / Restaurar Categorías de Mano de Obra',
      message: `¿Estás seguro de cargar los ${INITIAL_MANO_OBRA.length} roles estándar de mano de obra eléctrica (Oficial Especializado, Oficial, Medio Oficial, Ayudante, Capataz, Matriculado, Tablerista, Proyectista)? Los valores/tarifas horarias se inicializarán en 0.`,
      confirmText: 'Cargar Mano de Obra',
      isDestructive: false
    });
    if (ok) {
      await db.manoObra.bulkPut(INITIAL_MANO_OBRA);
      toast.success(`${INITIAL_MANO_OBRA.length} categorías de mano de obra cargadas.`);
    }
  };

  const handleRestoreDefaultCostosIndirectos = async () => {
    const ok = await confirm({
      title: 'Cargar / Restaurar Gastos Generales y Estructura',
      message: `¿Estás seguro de cargar los ${INITIAL_COSTOS_INDIRECTOS.length} conceptos de gastos generales y de estructura estándar (Movilidad, Seguros AP/ART, EPP, Desgaste de herramientas, Gastos administrativos, Taller/Depósito, Matrícula, Imprevistos, Andamios)? Los valores se inicializarán en 0.`,
      confirmText: 'Cargar Gastos Generales',
      isDestructive: false
    });
    if (ok) {
      await db.costosIndirectos.bulkPut(INITIAL_COSTOS_INDIRECTOS);
      toast.success(`${INITIAL_COSTOS_INDIRECTOS.length} conceptos de gastos generales cargados.`);
    }
  };

  const handleRestoreDefaultTareasTipo = async () => {
    const ok = await confirm({
      title: 'Cargar / Restaurar Trabajos Tipo Base',
      message: `¿Estás seguro de cargar los ${INITIAL_TAREAS_TIPO.length} trabajos tipo recomendados (incluyendo el modelo paramétrico de Recableado Integral con coeficientes de complejidad K_estado, K_acceso, K_altura, desarmados y cláusula de cañerías obstruidas)?`,
      confirmText: 'Cargar Trabajos Tipo',
      isDestructive: false
    });
    if (ok) {
      await db.tareasTipo.bulkPut(INITIAL_TAREAS_TIPO);
      toast.success(`${INITIAL_TAREAS_TIPO.length} trabajos tipo base cargados correctamente.`);
    }
  };

  const handleResetToDefaults = async () => {
    const ok = await confirm({
      title: '⚠️ Restablecer Todo a Valores de Fábrica',
      message: '¿Estás completamente seguro de restablecer TODA la base de datos? Se borrarán todos los presupuestos, clientes, proveedores y tareas creadas, y se recargarán los catálogos y configuración limpia por defecto.',
      confirmText: 'Sí, Restablecer Todo',
      isDestructive: true
    });
    if (ok) {
      try {
        await resetDatabaseToDefaults();
        toast.success('Base de datos restablecida a valores limpios de fábrica.');
        onSave();
        onClose();
        window.location.reload();
      } catch (err) {
        console.error('Error al restablecer base de datos:', err);
        toast.error('Error al restablecer la base de datos.');
      }
    }
  };

  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    const currentCats = formData.categoriasTarea || [...BASE_TAREA_CATEGORIES];
    if (currentCats.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.warning('Ya existe una categoría con ese nombre.');
      return;
    }
    setFormData({
      ...formData,
      categoriasTarea: [...currentCats, trimmed]
    });
    setNewCatName('');
    toast.success(`Categoría "${trimmed}" agregada`);
  };

  const handleStartEditCat = (index: number, name: string) => {
    setEditingCatIndex(index);
    setEditingCatValue(name);
  };

  const handleSaveEditCat = (index: number) => {
    const trimmed = editingCatValue.trim();
    if (!trimmed) return;
    const currentCats = [...(formData.categoriasTarea || BASE_TAREA_CATEGORIES)];
    if (currentCats.some((c, idx) => idx !== index && c.toLowerCase() === trimmed.toLowerCase())) {
      toast.warning('Ya existe otra categoría con ese nombre.');
      return;
    }
    currentCats[index] = trimmed;
    setFormData({
      ...formData,
      categoriasTarea: currentCats
    });
    setEditingCatIndex(null);
    setEditingCatValue('');
    toast.success('Categoría actualizada');
  };

  const handleCancelEditCat = () => {
    setEditingCatIndex(null);
    setEditingCatValue('');
  };

  const handleDeleteCategory = async (index: number) => {
    const currentCats = formData.categoriasTarea || [...BASE_TAREA_CATEGORIES];
    if (currentCats.length <= 1) {
      toast.warning('Debe haber al menos una categoría de trabajo.');
      return;
    }
    const catToDelete = currentCats[index];
    const ok = await confirm({
      title: 'Eliminar Categoría de Trabajo',
      message: `¿Estás seguro de eliminar la categoría "${catToDelete}"?`,
      confirmText: 'Eliminar',
      isDestructive: true
    });
    if (ok) {
      setFormData({
        ...formData,
        categoriasTarea: currentCats.filter((_, idx) => idx !== index)
      });
      toast.success(`Categoría "${catToDelete}" eliminada`);
    }
  };

  const handleRestoreDefaultTareaCategories = async () => {
    const ok = await confirm({
      title: 'Restaurar Categorías de Tareas',
      message: '¿Restablecer las categorías de tareas a los valores por defecto (Bocas, Circuitos, Tableros, Acometidas, Medición)?',
      confirmText: 'Restablecer',
      isDestructive: false
    });
    if (ok) {
      setFormData({
        ...formData,
        categoriasTarea: [...BASE_TAREA_CATEGORIES]
      });
      toast.success('Categorías de tareas restauradas a valores de fábrica');
    }
  };

  const handleClearCustomFirebase = async () => {
    const ok = await confirm({
      title: 'Desvincular Firebase Personalizado',
      message: '¿Estás seguro de remover las credenciales personalizadas de Firebase? La aplicación volverá a utilizar la configuración de entorno por defecto.',
      confirmText: 'Desvincular',
      isDestructive: true
    });
    if (ok) {
      clearCustomFirebaseConfig();
      toast.success('Credenciales personalizadas removidas.');
      onClose();
      window.location.reload();
    }
  };

  return {
    formData,
    setFormData,
    updateFormData,
    handleSubmit: handleSaveConfig,
    showAuthSetup,
    setShowAuthSetup,
    firebaseConfigured,
    currentFbConfig,
    newCatName,
    setNewCatName,
    editingCatIndex,
    editingCatValue,
    setEditingCatValue,
    handleSaveConfig,
    handleRestoreDefaultCategories,
    handleRestoreDefaultMaterials,
    handleRestoreDefaultManoObra,
    handleRestoreDefaultCostosIndirectos,
    handleRestoreDefaultTareasTipo,
    handleRestoreDefaultTareaCategories,
    handleResetToDefaults,
    handleAddCategory,
    handleStartEditCat,
    handleSaveEditCat,
    handleCancelEditCat,
    handleDeleteCategory,
    handleClearCustomFirebase
  };
}
