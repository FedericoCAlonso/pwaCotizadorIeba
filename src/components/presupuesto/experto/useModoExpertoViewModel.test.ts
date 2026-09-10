import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useModoExpertoViewModel,
  ModoExpertoEditorProps,
  getFoldableBlocks,
  buildVisibleYamlText,
  highlightYamlText
} from './useModoExpertoViewModel';
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

  it('updates dslText on handleTextChange and syncs the external DSL text immediately', () => {
    const onDslTextChange = vi.fn();
    const props = {
      ...defaultProps,
      onDslTextChange
    };
    const { result } = renderHook(() =>
      useModoExpertoViewModel(props, mockTextareaRef, mockGutterRef)
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
    expect(onDslTextChange).toHaveBeenCalledWith('cliente: Juan Perez\n');
  });

  it('does not re-trigger parse sync on rerender when props are refreshed', () => {
    const onDslTextChange = vi.fn();
    const props = {
      ...defaultProps,
      onDslTextChange,
      clientes: [...mockClientes]
    };

    const { rerender } = renderHook((currentProps) =>
      useModoExpertoViewModel(currentProps, mockTextareaRef, mockGutterRef),
      { initialProps: props }
    );

    vi.clearAllMocks();

    rerender({
      ...props,
      clientes: [...mockClientes, { id: 'cli-2', razonSocial: 'Otra', nombre: 'Otra', roles: ['cliente'] }] 
    });

    expect(onDslTextChange).not.toHaveBeenCalled();
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

  it('detects foldable yaml blocks and collapses them in display text', () => {
    const yaml = `cálculo:
  superficie: 120
  bocas: 30

Capitulo 1:
  - material 1:
      cantidad: 1
      precio unitario: 500
  - material 2:
      cantidad: 2
      precio unitario: 600`;

    const blocks = getFoldableBlocks(yaml);
    expect(blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'cálculo' }),
        expect.objectContaining({ label: 'Capitulo 1' })
      ])
    );

    const collapsed = buildVisibleYamlText(yaml, { 1: true, 5: true });
    expect(collapsed).toContain('líneas plegadas');
    expect(collapsed).toContain('Capitulo 1:');
  });

  it('keeps blank lines in the syntax overlay as plain blank lines', () => {
    const highlighted = highlightYamlText('cliente: Federico\n\nobra: Av. Corrientes');

    expect(highlighted).not.toContain('opacity-0');
    expect(highlighted).toContain('text-sky-600');
    expect(highlighted).toContain('obra');
  });

  it('preserves 100% of characters, spaces, and coordinates in highlightYamlText (strict 1:1 text equality)', () => {
    const stripHtml = (html: string) =>
      html
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");

    const complexDsl = `# ============================================================
# Presupuesto Eléctrico - Obra Belgrano
# ============================================================
cliente:   Estudio Arquitectura & Asociados
obra: Av. Cabildo 2400, 4to B
factura: Factura C
validez: 30 dias
margen: 35%
dolar: USD Blue / 1400

cálculo:
  superficie: 120
  bocas_est: =superficie * 0.25 # estimación aproximada

Instalación Principal:
  - 10 u Boca de Iluminación: $ 12.500
  - =bocas_est * 2 u Tomacorriente Doble: $ 9.800
  - 5 [Schneider] Interruptor Termomagnético 2x20A: $ 8.500 # marca especificada
  materiales:
    - 2.5 m Cable Unipolar 2.5mm: $ 1.200
    - 1 u Cinta Aisladora 3M: $ 850
  mano_obra:
    - 1.5 hs Oficial Electricista: $ 8.000
    - 0.5 hs Ayudante: $ 4.500
  gastos:
    - 15% Seguro de Obra y Flete: $ 5.000

  - 1 u Tarea sin precio unitario definido
`;

    const highlighted = highlightYamlText(complexDsl);
    expect(stripHtml(highlighted)).toBe(complexDsl);
  });

  it('applies distinct semantic styling to chapters, APU blocks, items, brands, and prices', () => {
    const dsl = `Instalación Eléctrica:
  materiales:
    - 10 u Cable 2.5mm [Prysmian]: $ 1.250 # bobina
  mano_obra:
    - =horas * 2 hs Oficial: $ 5.000`;

    const highlighted = highlightYamlText(dsl);

    // Capítulo
    expect(highlighted).toContain('text-blue-600');
    expect(highlighted).toContain('Instalación Eléctrica');

    // Sub-bloques APU
    expect(highlighted).toContain('text-purple-600');
    expect(highlighted).toContain('materiales');
    expect(highlighted).toContain('mano_obra');

    // Viñetas
    expect(highlighted).toContain('text-slate-400');
    expect(highlighted).toContain('- ');

    // Cantidades
    expect(highlighted).toContain('text-amber-600'); // 10
    expect(highlighted).toContain('text-fuchsia-600'); // =horas * 2

    // Unidades
    expect(highlighted).toContain('text-teal-600'); // u, hs

    // Marca
    expect(highlighted).toContain('text-amber-500'); // [Prysmian]

    // Precios
    expect(highlighted).toContain('text-emerald-600'); // $
    expect(highlighted).toContain('text-emerald-700'); // 1.250

    // Comentario inline
    expect(highlighted).toContain('text-emerald-600/90'); // # bobina
  });
});
