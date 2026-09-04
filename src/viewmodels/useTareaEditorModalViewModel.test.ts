import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTareaEditorModalViewModel } from './useTareaEditorModalViewModel';
import { TareaTipo, Insumo, CategoriaManoDeObra } from '../core/types';

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn()
    }
  })
}));

describe('useTareaEditorModalViewModel', () => {
  const mockCategorias = ['Bocas', 'Tableros', 'Iluminación'];
  const mockInsumosMap = new Map<string, Insumo>([
    [
      'mat-cable-2.5',
      {
        id: 'mat-cable-2.5',
        categoriaId: 'cables',
        nombre: 'Cable 2.5 mm²',
        unidadVenta: 'm',
        atributos: [],
        activo: true,
        precioActual: 800,
        historialPrecios: []
      }
    ]
  ]);
  const mockManoObraList: CategoriaManoDeObra[] = [
    { id: 'mo-oficial', nombre: 'Oficial Electricista', costoHora: 7500, fechaActualizacion: '2026-09-04' },
    { id: 'mo-ayudante', nombre: 'Ayudante', costoHora: 5000, fechaActualizacion: '2026-09-04' }
  ];
  const mockManoObraMap = new Map<string, CategoriaManoDeObra>(
    mockManoObraList.map((m) => [m.id, m])
  );

  it('inicializa correctamente con valores por defecto para nueva tarea', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useTareaEditorModalViewModel({
        isOpen: true,
        onClose,
        editingTarea: null,
        categoriasList: mockCategorias,
        insumosMap: mockInsumosMap,
        manoObraList: mockManoObraList,
        manoObraMap: mockManoObraMap,
        onSave
      })
    );

    expect(result.current.activeTab).toBe('general');
    expect(result.current.formData.nombre).toBe('');
    expect(result.current.formData.categoria).toBe('Bocas');
    expect(result.current.parametrosCount).toBe(1);
    expect(result.current.formData.parametros[0].id).toBe('bocas');
  });

  it('permite cambiar de pestaña activamente', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useTareaEditorModalViewModel({
        isOpen: true,
        onClose,
        editingTarea: null,
        categoriasList: mockCategorias,
        insumosMap: mockInsumosMap,
        manoObraList: mockManoObraList,
        manoObraMap: mockManoObraMap,
        onSave
      })
    );

    expect(result.current.activeTab).toBe('general');

    act(() => {
      result.current.setActiveTab('parametros');
    });
    expect(result.current.activeTab).toBe('parametros');

    act(() => {
      result.current.setActiveTab('materiales');
    });
    expect(result.current.activeTab).toBe('materiales');

    act(() => {
      result.current.setActiveTab('mano_obra');
    });
    expect(result.current.activeTab).toBe('mano_obra');

    act(() => {
      result.current.setActiveTab('clausulas');
    });
    expect(result.current.activeTab).toBe('clausulas');
  });

  it('gestiona parámetros: agrega, actualiza y valida remoción', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useTareaEditorModalViewModel({
        isOpen: true,
        onClose,
        editingTarea: null,
        categoriasList: mockCategorias,
        insumosMap: mockInsumosMap,
        manoObraList: mockManoObraList,
        manoObraMap: mockManoObraMap,
        onSave
      })
    );

    act(() => {
      result.current.addParametro({ id: 'metros', nombre: 'Metros Lineales', valorDefault: 20 });
    });

    expect(result.current.parametrosCount).toBe(2);
    expect(result.current.formData.parametros[1].id).toBe('metros');

    act(() => {
      result.current.updateParametro(1, { valorDefault: 35 });
    });
    expect(result.current.formData.parametros[1].valorDefault).toBe(35);

    act(() => {
      result.current.removeParametro(1);
    });
    expect(result.current.parametrosCount).toBe(1);
  });

  it('agrega materiales del catálogo y evalúa costo en tiempo real', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useTareaEditorModalViewModel({
        isOpen: true,
        onClose,
        editingTarea: null,
        categoriasList: mockCategorias,
        insumosMap: mockInsumosMap,
        manoObraList: mockManoObraList,
        manoObraMap: mockManoObraMap,
        onSave
      })
    );

    const mat = mockInsumosMap.get('mat-cable-2.5')!;

    act(() => {
      result.current.handleAddMaterialFromPicker(mat, 15, 'bocas * 15');
    });

    expect(result.current.insumosCount).toBe(1);
    expect(result.current.formData.insumos[0].materialId).toBe('mat-cable-2.5');
    expect(result.current.liveEvaluation.costoInsumosTotal).toBe(15 * 800);
  });

  it('agrega mano de obra por categoría y evalúa horas y costo en vivo', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useTareaEditorModalViewModel({
        isOpen: true,
        onClose,
        editingTarea: null,
        categoriasList: mockCategorias,
        insumosMap: mockInsumosMap,
        manoObraList: mockManoObraList,
        manoObraMap: mockManoObraMap,
        onSave
      })
    );

    act(() => {
      result.current.addManoObraRow();
    });

    expect(result.current.manoObraCount).toBe(1);
    expect(result.current.formData.manoObra[0].categoriaId).toBe('mo-oficial');
    expect(result.current.liveEvaluation.costoManoObraTotal).toBe(7500);
  });

  it('ejecuta handleSubmit y llama a onSave con la información procesada', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useTareaEditorModalViewModel({
        isOpen: true,
        onClose,
        editingTarea: null,
        categoriasList: mockCategorias,
        insumosMap: mockInsumosMap,
        manoObraList: mockManoObraList,
        manoObraMap: mockManoObraMap,
        onSave
      })
    );

    act(() => {
      result.current.updateFormField('nombre', 'Instalación de Circuito Iluminación');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].nombre).toBe('Instalación de Circuito Iluminación');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
