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
let currentMockConvenios: any[] = [];

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => any) => {
    const str = fn.toString();
    if (str.includes('manoObra')) {
      return currentMockMO;
    }
    if (str.includes('costosIndirectos')) {
      return currentMockCI;
    }
    if (str.includes('convenios')) {
      return currentMockConvenios;
    }
    return [];
  }
}));

const mockDbAddMO = vi.fn().mockResolvedValue('mo-new');
const mockDbUpdateMO = vi.fn().mockResolvedValue(1);
const mockDbAddCI = vi.fn().mockResolvedValue('ci-new');
const mockDbUpdateCI = vi.fn().mockResolvedValue(1);
const mockDbPutConvenio = vi.fn().mockResolvedValue('cct-new');
const mockDbUpdateConvenio = vi.fn().mockResolvedValue(1);
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
    },
    convenios: {
      toArray: vi.fn(() => Promise.resolve(currentMockConvenios)),
      put: (...args: any[]) => mockDbPutConvenio(...args),
      update: (...args: any[]) => mockDbUpdateConvenio(...args)
    }
  },
  softDelete: (...args: any[]) => mockSoftDelete(...args)
}));

describe('useManoObraViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockMO = [...mockManoObra];
    currentMockCI = [...mockCostosIndirectos];
    currentMockConvenios = [];
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

  describe('Nuevas funcionalidades UI/UX: Estadísticas, Edición Inline y Paritarias', () => {

    it('permite cambiar entre pestañas cuadrilla y cargas', () => {
      const { result } = renderHook(() => useManoObraViewModel());
      expect(result.current.activeTab).toBe('cuadrilla');

      act(() => {
        result.current.setActiveTab('cargas');
      });
      expect(result.current.activeTab).toBe('cargas');
    });

    it('actualiza un campo inline recalculando los valores bidireccionales', async () => {
      const { result } = renderHook(() => useManoObraViewModel());

      // Actualizar costoHora inline
      await act(async () => {
        await result.current.handleUpdateMOField('mo-oficial', 'costoHora', 12000);
      });

      expect(mockDbUpdateMO).toHaveBeenCalledWith(
        'mo-oficial',
        expect.objectContaining({
          costoHora: 12000,
          costoJornada: 108000 // 12000 * 9
        })
      );

      // Actualizar costoJornada inline
      await act(async () => {
        await result.current.handleUpdateMOField('mo-ayudante', 'costoJornada', 72000);
      });

      expect(mockDbUpdateMO).toHaveBeenCalledWith(
        'mo-ayudante',
        expect.objectContaining({
          costoJornada: 72000,
          costoHora: 8000 // 72000 / 9
        })
      );

      // Actualizar horasJornada inline
      await act(async () => {
        await result.current.handleUpdateMOField('mo-oficial', 'horasJornada', 8);
      });

      expect(mockDbUpdateMO).toHaveBeenCalledWith(
        'mo-oficial',
        expect.objectContaining({
          horasJornada: 8,
          costoJornada: 80000 // 10000 * 8
        })
      );
    });

    it('aplica un ajuste porcentual de paritaria masivo a todas las categorías', async () => {
      const { result } = renderHook(() => useManoObraViewModel());

      await act(async () => {
        await result.current.handleBatchParitariaUpdate(10); // +10%
      });

      // Oficial: 10000 -> 11000, Jornal 99000
      expect(mockDbUpdateMO).toHaveBeenCalledWith(
        'mo-oficial',
        expect.objectContaining({
          costoHora: 11000,
          costoJornada: 99000
        })
      );

      // Ayudante: 7000 -> 7700, Jornal 69300
      expect(mockDbUpdateMO).toHaveBeenCalledWith(
        'mo-ayudante',
        expect.objectContaining({
          costoHora: 7700,
          costoJornada: 69300
        })
      );

      expect(mockToast.success).toHaveBeenCalledWith(
        expect.stringContaining('Ajuste de paritaria aplicado: +10%')
      );
    });

    it('permite crear rápidamente una categoría inline con convenio UOCRA por defecto', async () => {
      const { result } = renderHook(() => useManoObraViewModel());

      await act(async () => {
        await result.current.handleQuickCreateMO('Medio Oficial', 'uocra', 'oficial');
      });

      expect(mockDbAddMO).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Medio Oficial',
          convenioId: 'uocra',
          horasJornada: 9,
          rol: 'oficial'
        })
      );
      expect(mockToast.success).toHaveBeenCalledWith('Categoría "Medio Oficial" creada');
    });

    it('permite duplicar una categoría de mano de obra con 1 clic', async () => {
      const { result } = renderHook(() => useManoObraViewModel());

      await act(async () => {
        await result.current.handleDuplicateMO('mo-oficial');
      });

      expect(mockDbAddMO).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Oficial Electricista (Copia)',
          costoHora: 10000,
          rol: 'oficial'
        })
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        expect.stringContaining('Categoría duplicada como "Oficial Electricista (Copia)"')
      );
    });

    it('permite duplicar un gasto del catálogo con 1 clic', async () => {
      const { result } = renderHook(() => useManoObraViewModel());

      await act(async () => {
        await result.current.handleDuplicateGasto('gasto-1');
      });

      expect(mockDbAddCI).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Cargas Sociales UOCRA (FCS) (Copia)',
          valor: 65
        })
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        expect.stringContaining('Gasto duplicado como')
      );
    });

    it('permite crear un gasto rápido e inline en el catálogo', async () => {
      const { result } = renderHook(() => useManoObraViewModel());

      await act(async () => {
        await result.current.handleQuickCreateGasto('Alquiler de Andamio', 'costo_indirecto', 'monto_fijo', 35000);
      });

      expect(mockDbAddCI).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Alquiler de Andamio',
          modalidad: 'monto_fijo',
          valor: 35000
        })
      );
    });

    it('filtra categorías y gastos por búsqueda y selectores', () => {
      const { result } = renderHook(() => useManoObraViewModel());

      // Búsqueda por texto
      act(() => {
        result.current.setSearchQuery('Ayudante');
      });
      expect(result.current.filteredManoObraList.length).toBe(1);
      expect(result.current.filteredManoObraList[0].nombre).toBe('Ayudante');

      // Limpiar búsqueda
      act(() => {
        result.current.setSearchQuery('');
        result.current.setFilterRol('oficial');
      });
      expect(result.current.filteredManoObraList.length).toBe(1);
      expect(result.current.filteredManoObraList[0].nombre).toBe('Oficial Electricista');
    });

    it('expone convenios laborales predefinidos y permite crearlos dinámicamente', async () => {
      const { result } = renderHook(() => useManoObraViewModel());
      expect(result.current.conveniosList.length).toBeGreaterThanOrEqual(3);
      expect(result.current.conveniosList.some(c => c.id === 'uocra')).toBe(true);

      // Crear convenio rápido
      await act(async () => {
        await result.current.handleQuickCreateConvenio('Petroleros', 70);
      });

      expect(mockDbPutConvenio).toHaveBeenCalledWith(expect.objectContaining({
        nombre: 'Petroleros',
        cargasSocialesPct: 70
      }));
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('creado correctamente'));
    });

    it('permite actualizar un campo de convenio directamente', async () => {
      const { result } = renderHook(() => useManoObraViewModel());
      await act(async () => {
        await result.current.handleUpdateConvenioField('uocra', 'cargasSocialesPct', 68);
      });

      expect(mockDbUpdateConvenio).toHaveBeenCalledWith('uocra', expect.objectContaining({
        cargasSocialesPct: 68
      }));
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('Convenio actualizado'));
    });

    it('permite duplicar un convenio laboral', async () => {
      const { result } = renderHook(() => useManoObraViewModel());
      await act(async () => {
        await result.current.handleDuplicateConvenio('uocra');
      });

      expect(mockDbPutConvenio).toHaveBeenCalledWith(expect.objectContaining({
        nombre: expect.stringContaining('(Copia)')
      }));
    });

    it('permite eliminar un convenio laboral con confirmación', async () => {
      const { result } = renderHook(() => useManoObraViewModel());
      await act(async () => {
        await result.current.handleDeleteConvenio('uocra');
      });

      expect(mockConfirm).toHaveBeenCalled();
      expect(mockSoftDelete).toHaveBeenCalledWith('convenios', 'uocra');
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('eliminado'));
    });
  });
});

