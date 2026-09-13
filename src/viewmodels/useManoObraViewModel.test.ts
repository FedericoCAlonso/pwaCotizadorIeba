import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useManoObraViewModel } from './useManoObraViewModel';
import { CategoriaManoDeObra, CostoIndirecto } from '../core/types';

const { mockToast, mockConfirm, mockManoObra, mockCostosIndirectos } = vi.hoisted(() => {
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  };
  const mockConfirm = vi.fn().mockResolvedValue(true);

  const mockManoObra: CategoriaManoDeObra[] = [
    {
      id: 'mo-oficial',
      nombre: 'Oficial Electricista',
      costoHora: 10000,
      horasJornada: 9,
      costoJornada: 90000,
      rol: 'oficial',
      fechaActualizacion: '2026-09-01T00:00:00.000Z'
    },
    {
      id: 'mo-ayudante',
      nombre: 'Ayudante',
      costoHora: 7000,
      horasJornada: 9,
      costoJornada: 63000,
      rol: 'ayudante',
      fechaActualizacion: '2026-09-01T00:00:00.000Z'
    }
  ];

  const mockCostosIndirectos: CostoIndirecto[] = [
    {
      id: 'gasto-1',
      nombre: 'Cargas Sociales UOCRA (FCS)',
      destino: 'mano_obra',
      modalidad: 'porcentual',
      valor: 65,
      tipo: 'porcentual_sobre_costo',
      incluirPorDefecto: true
    }
  ];

  return { mockToast, mockConfirm, mockManoObra, mockCostosIndirectos };
});

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ toast: mockToast })
}));

vi.mock('../contexts/ConfirmContext', () => ({
  useConfirm: () => mockConfirm
}));

let currentMockMO = [...mockManoObra];
let currentMockCI = [...mockCostosIndirectos];

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => any) => {
    // If querying db.manoObra
    const str = fn.toString();
    if (str.includes('manoObra')) {
      return currentMockMO;
    }
    if (str.includes('costosIndirectos')) {
      return currentMockCI;
    }
    return [];
  }
}));

const mockDbAddMO = vi.fn().mockResolvedValue('mo-new');
const mockDbUpdateMO = vi.fn().mockResolvedValue(1);
const mockDbAddCI = vi.fn().mockResolvedValue('ci-new');
const mockDbUpdateCI = vi.fn().mockResolvedValue(1);
const mockSoftDelete = vi.fn().mockResolvedValue(undefined);

vi.mock('../db/database', () => ({
  db: {
    manoObra: {
      toArray: vi.fn(() => Promise.resolve(currentMockMO)),
      add: (...args: any[]) => mockDbAddMO(...args),
      update: (...args: any[]) => mockDbUpdateMO(...args)
    },
    costosIndirectos: {
      toArray: vi.fn(() => Promise.resolve(currentMockCI)),
      add: (...args: any[]) => mockDbAddCI(...args),
      update: (...args: any[]) => mockDbUpdateCI(...args)
    }
  },
  softDelete: (...args: any[]) => mockSoftDelete(...args)
}));

describe('useManoObraViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockMO = [...mockManoObra];
    currentMockCI = [...mockCostosIndirectos];
  });

  it('inicializa y expone listas filtradas de mano de obra y gastos', () => {
    const { result } = renderHook(() => useManoObraViewModel());

    expect(result.current.manoObraList.length).toBe(2);
    expect(result.current.gastosCatalogList.length).toBe(1);
    expect(result.current.editingMO).toBeNull();
    expect(result.current.isCreatingMO).toBe(false);
  });

  describe('Cálculo bidireccional Hora <-> Jornada UOCRA', () => {
    it('al cambiar el costo por hora, calcula automáticamente el costo por jornada (por defecto 9 hs)', () => {
      const { result } = renderHook(() => useManoObraViewModel());

      act(() => {
        result.current.openCreateMO('oficial');
      });

      expect(result.current.isCreatingMO).toBe(true);
      expect(result.current.moForm.horasJornada).toBe(9);

      // Cambiamos costo por hora a 12000
      act(() => {
        result.current.handleCostoHoraChange(12000);
      });

      expect(result.current.moForm.costoHora).toBe(12000);
      expect(result.current.moForm.costoJornada).toBe(108000); // 12000 * 9
    });

    it('al cambiar el costo por jornada, calcula automáticamente el costo por hora', () => {
      const { result } = renderHook(() => useManoObraViewModel());

      act(() => {
        result.current.openCreateMO('oficial');
      });

      // Cambiamos costo por jornada a 90000 (con 9 hs de base)
      act(() => {
        result.current.handleCostoJornadaChange(90000);
      });

      expect(result.current.moForm.costoJornada).toBe(90000);
      expect(result.current.moForm.costoHora).toBe(10000); // 90000 / 9
    });

    it('al cambiar las horas de jornada a 8 hs (Legal), recalcula el costo por jornada a partir de la hora', () => {
      const { result } = renderHook(() => useManoObraViewModel());

      act(() => {
        result.current.openCreateMO('oficial');
        result.current.handleCostoHoraChange(10000);
      });

      expect(result.current.moForm.costoJornada).toBe(90000); // 10000 * 9

      // Cambiar a 8 horas
      act(() => {
        result.current.handleHorasJornadaChange(8);
      });

      expect(result.current.moForm.horasJornada).toBe(8);
      expect(result.current.moForm.costoJornada).toBe(80000); // 10000 * 8
    });

    it('maneja strings vacíos sin romper el estado', () => {
      const { result } = renderHook(() => useManoObraViewModel());

      act(() => {
        result.current.openCreateMO('oficial');
        result.current.handleCostoHoraChange('');
      });

      expect(result.current.moForm.costoHora).toBe('');
      expect(result.current.moForm.costoJornada).toBe('');

      act(() => {
        result.current.handleCostoJornadaChange('');
      });

      expect(result.current.moForm.costoJornada).toBe('');
      expect(result.current.moForm.costoHora).toBe('');
    });
  });

  describe('Creación, Edición y Persistencia', () => {
    it('abre modal para edición precargando datos y convirtiendo jornada si falta', () => {
      const { result } = renderHook(() => useManoObraViewModel());

      const itemToEdit: CategoriaManoDeObra = {
        id: 'mo-test',
        nombre: 'Capataz',
        costoHora: 15000,
        rol: 'especialista',
        fechaActualizacion: ''
      };

      act(() => {
        result.current.openEditMO(itemToEdit);
      });

      expect(result.current.editingMO).toEqual(itemToEdit);
      expect(result.current.moForm.nombre).toBe('Capataz');
      expect(result.current.moForm.costoHora).toBe(15000);
      expect(result.current.moForm.horasJornada).toBe(9);
      expect(result.current.moForm.costoJornada).toBe(135000); // 15000 * 9
      expect(result.current.moForm.rol).toBe('especialista');
    });

    it('valida que el nombre no esté vacío al guardar', async () => {
      const { result } = renderHook(() => useManoObraViewModel());

      act(() => {
        result.current.openCreateMO('oficial');
        result.current.handleNombreChange('   ');
      });

      await act(async () => {
        await result.current.handleSaveMO();
      });

      expect(mockToast.error).toHaveBeenCalledWith('El nombre de la categoría es obligatorio');
      expect(mockDbAddMO).not.toHaveBeenCalled();
    });

    it('guarda una nueva categoría en la base de datos con costoHora, costoJornada y horasJornada', async () => {
      const { result } = renderHook(() => useManoObraViewModel());

      act(() => {
        result.current.openCreateMO('oficial');
        result.current.handleNombreChange('Medio Oficial Tablerista');
        result.current.handleCostoHoraChange(9500);
      });

      await act(async () => {
        await result.current.handleSaveMO();
      });

      expect(mockDbAddMO).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Medio Oficial Tablerista',
          costoHora: 9500,
          costoJornada: 85500, // 9500 * 9
          horasJornada: 9,
          rol: 'oficial',
          deleted: false
        })
      );
      expect(mockToast.success).toHaveBeenCalledWith('Categoría de mano de obra creada');
      expect(result.current.isCreatingMO).toBe(false);
    });

    it('actualiza una categoría existente', async () => {
      const { result } = renderHook(() => useManoObraViewModel());

      act(() => {
        result.current.openEditMO(mockManoObra[0]);
        result.current.handleNombreChange('Oficial Electricista Cat. A');
        result.current.handleCostoJornadaChange(99000);
      });

      await act(async () => {
        await result.current.handleSaveMO();
      });

      expect(mockDbUpdateMO).toHaveBeenCalledWith(
        'mo-oficial',
        expect.objectContaining({
          nombre: 'Oficial Electricista Cat. A',
          costoHora: 11000, // 99000 / 9
          costoJornada: 99000
        })
      );
      expect(mockToast.success).toHaveBeenCalledWith('Categoría de mano de obra actualizada');
      expect(result.current.editingMO).toBeNull();
    });

    it('elimina una categoría tras confirmar', async () => {
      const { result } = renderHook(() => useManoObraViewModel());

      await act(async () => {
        await result.current.handleDeleteMO('mo-oficial');
      });

      expect(mockConfirm).toHaveBeenCalled();
      expect(mockSoftDelete).toHaveBeenCalledWith('manoObra', 'mo-oficial');
      expect(mockToast.success).toHaveBeenCalledWith('Categoría eliminada');
    });
  });

  describe('Gastos del Catálogo Global', () => {
    it('alterna el flag incluirPorDefecto de un gasto', async () => {
      const { result } = renderHook(() => useManoObraViewModel());

      await act(async () => {
        await result.current.handleToggleIncluirPorDefecto(mockCostosIndirectos[0]);
      });

      expect(mockDbUpdateCI).toHaveBeenCalledWith(
        'gasto-1',
        expect.objectContaining({
          incluirPorDefecto: false
        })
      );
    });

    it('agrega un nuevo gasto al catálogo global', async () => {
      const { result } = renderHook(() => useManoObraViewModel());

      act(() => {
        result.current.handleOpenCreateGasto();
      });

      expect(result.current.showGastoModal).toBe(true);
      expect(result.current.editingGasto).toBeNull();

      await act(async () => {
        await result.current.handleSaveCatalogGasto({
          id: 'gasto-seguro',
          costoIndirectoId: 'gasto-seguro',
          nombre: 'Seguro de Accidentes Personales (AP)',
          destino: 'mano_obra',
          modalidad: 'monto_fijo',
          valor: 25000,
          incluirPorDefecto: true,
          aplica: true
        });
      });

      expect(mockDbAddCI).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'gasto-seguro',
          nombre: 'Seguro de Accidentes Personales (AP)',
          destino: 'mano_obra',
          modalidad: 'monto_fijo',
          valor: 25000
        })
      );
      expect(result.current.showGastoModal).toBe(false);
    });
  });
});
