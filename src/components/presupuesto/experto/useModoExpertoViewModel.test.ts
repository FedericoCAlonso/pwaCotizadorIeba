import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModoExpertoViewModel, ModoExpertoEditorProps } from './useModoExpertoViewModel';
import { Cliente, TareaTipo, Insumo, CategoriaManoDeObra } from '../../../core/types';
import { TotalesPresupuestoResultado } from '../../../core/calculations';

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn()
    }
  })
}));

const emptyArray: any[] = [];
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => emptyArray
}));

describe('useModoExpertoViewModel', () => {
  const mockClientes: Cliente[] = [
    { id: 'cli-1', razonSocial: 'Constructora Central', nombre: 'Constructora Central', roles: ['cliente'] }
  ];

  const mockTareasTipo: TareaTipo[] = [];
  const mockInsumosMap = new Map<string, Insumo>();
  const mockManoObraMap = new Map<string, CategoriaManoDeObra>();

  const mockTotales = {
    costoGlobal: 115000,
    precioFinalGlobal: 180895,
    itemsCalculados: []
  } as unknown as TotalesPresupuestoResultado;

  const defaultProps: ModoExpertoEditorProps = {
    initialDslText: 'cliente: Constructora Central\n\nCapitulo 1:\n  - 5 u Boca de Iluminacion: $ 10.000\n',
    onDslTextChange: vi.fn(),
    clientes: mockClientes,
    clienteId: 'cli-1',
    setClienteId: vi.fn(),
    direccionObra: 'Av. Libertador 1200',
    setDireccionObra: vi.fn(),
    tipoFactura: 'Factura B',
    setTipoFactura: vi.fn(),
    validezDias: 15,
    setValidezDias: vi.fn(),
    margenPorcentaje: 30,
    setMargenPorcentaje: vi.fn(),
    mostrarDolar: false,
    setMostrarDolar: vi.fn(),
    nombreDolar: 'USD Blue',
    setNombreDolar: vi.fn(),
    cotizacionDolar: 1200,
    setCotizacionDolar: vi.fn(),
    capitulos: [],
    setCapitulos: vi.fn(),
    items: [],
    setItems: vi.fn(),
    gastosConfig: [],
    setGastosConfig: vi.fn(),
    totales: mockTotales,
    tareasTipo: mockTareasTipo,
    insumosMap: mockInsumosMap,
    manoObraMap: mockManoObraMap,
    onSaveDraft: vi.fn(),
    onToggleGuidedMode: vi.fn()
  };

  const mockTextareaRef = {
    current: {
      value: defaultProps.initialDslText || '',
      selectionStart: 0,
      selectionEnd: 0,
      focus: vi.fn(),
      scrollTop: 0,
      clientHeight: 400,
      clientWidth: 600
    } as unknown as HTMLTextAreaElement
  };

  const mockGutterRef = {
    current: {
      scrollTop: 0
    } as unknown as HTMLDivElement
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes dslText from initialDslText prop', () => {
    const { result } = renderHook(() =>
      useModoExpertoViewModel(defaultProps, mockTextareaRef, mockGutterRef)
    );

    expect(result.current.dslText).toContain('Constructora Central');
    expect(result.current.lineCount).toBe(5);
  });

  it('updates dslText on handleTextChange', () => {
    const { result } = renderHook(() =>
      useModoExpertoViewModel(defaultProps, mockTextareaRef, mockGutterRef)
    );

    act(() => {
      result.current.handleTextChange({
        target: {
          value: 'cliente: Juan Perez\n',
          selectionStart: 19,
          selectionEnd: 19
        }
      } as any);
    });

    expect(result.current.dslText).toBe('cliente: Juan Perez\n');
  });

  it('handles snippet insertion correctly', () => {
    const { result } = renderHook(() =>
      useModoExpertoViewModel(defaultProps, mockTextareaRef, mockGutterRef)
    );

    act(() => {
      result.current.insertSnippet('# Nota importante\n');
    });

    expect(result.current.dslText).toContain('# Nota importante\n');
  });

  it('toggles modal states for materials and gastos', () => {
    const { result } = renderHook(() =>
      useModoExpertoViewModel(defaultProps, mockTextareaRef, mockGutterRef)
    );

    expect(result.current.showMultiMaterialModal).toBe(false);
    act(() => {
      result.current.setShowMultiMaterialModal(true);
    });
    expect(result.current.showMultiMaterialModal).toBe(true);

    expect(result.current.showGastosModal).toBe(false);
    act(() => {
      result.current.setShowGastosModal(true);
    });
    expect(result.current.showGastosModal).toBe(true);
  });
});
