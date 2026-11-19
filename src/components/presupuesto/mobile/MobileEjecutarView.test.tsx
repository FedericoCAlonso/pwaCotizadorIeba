import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../contexts/ToastContext';
import { DEFAULT_APP_CONFIG } from '../../../core/sampleData';
import { CategoriaManoDeObra, CostoIndirecto, TareaTipo } from '../../../core/types';
import { MobileEjecutarView } from './MobileEjecutarView';

const {
  mockPutPresupuesto,
  mockUpdateTareaTipo,
  mockExportPDF,
  mockGetPDFBlob,
  mockExportXLSX
} = vi.hoisted(() => ({
  mockPutPresupuesto: vi.fn().mockResolvedValue('pres-movil-1'),
  mockUpdateTareaTipo: vi.fn().mockResolvedValue(1),
  mockExportPDF: vi.fn(),
  mockGetPDFBlob: vi.fn().mockReturnValue(new Blob(['pdf'], { type: 'application/pdf' })),
  mockExportXLSX: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => undefined
}));

vi.mock('../../../db/database', () => ({
  db: {
    presupuestos: {
      put: mockPutPresupuesto,
      where: () => ({ toArray: vi.fn().mockResolvedValue([]) })
    },
    tareasTipo: {
      update: mockUpdateTareaTipo,
      toArray: vi.fn().mockResolvedValue([])
    },
    materiales: { toArray: vi.fn().mockResolvedValue([]) },
    productos: { toArray: vi.fn().mockResolvedValue([]) },
    ofertas: { toArray: vi.fn().mockResolvedValue([]) },
    insumos: { toArray: vi.fn().mockResolvedValue([]) },
    manoObra: { toArray: vi.fn().mockResolvedValue([]) },
    costosIndirectos: { toArray: vi.fn().mockResolvedValue([]) },
    contactos: { toArray: vi.fn().mockResolvedValue([]) }
  }
}));

vi.mock('../../../core/pdfExportUtils', () => ({
  exportPresupuestoToPDF: mockExportPDF,
  getPresupuestoPDFBlob: mockGetPDFBlob
}));

vi.mock('../../../core/exportUtils', () => ({
  exportPresupuestoToXLSX: mockExportXLSX
}));

const manoObra: CategoriaManoDeObra[] = [
  {
    id: 'mo-of',
    nombre: 'Oficial Especializado',
    costoHora: 10000,
    fechaActualizacion: '2026-11-01T00:00:00.000Z'
  }
];

const tareaTablero: TareaTipo = {
  id: 'tt-tablero',
  nombre: 'Armado de Tablero',
  slug: 'armado-tablero',
  categoria: 'Tableros',
  unidad: 'u',
  parametros: [
    {
      id: 'circuitos',
      nombre: 'Circuitos',
      tipo: 'numero',
      valorDefault: 4,
      min: 1,
      max: 48,
      step: 1,
      unidad: 'circ'
    },
    {
      id: 'tipo_embutido',
      nombre: 'Montaje',
      tipo: 'select',
      valorDefault: 1,
      opciones: [
        { id: 'op-emb', label: 'Embutido', valor: 1 },
        { id: 'op-ext', label: 'Exterior', valor: 2 }
      ]
    },
    {
      id: 'incluye_jabalina',
      nombre: 'Incluye jabalina',
      tipo: 'boolean',
      valorDefault: 0
    },
    {
      id: 'profundidad_jabalina',
      nombre: 'Profundidad jabalina',
      tipo: 'numero',
      valorDefault: 1.5,
      condicion: 'incluye_jabalina == 1',
      unidad: 'm'
    }
  ],
  insumos: [],
  manoObra: [{ categoriaId: 'mo-of', horas: 1, formula: 'circuitos * 0.5 + incluye_jabalina' }],
  frecuenciaUso: 12,
  ultimoUsoFecha: '2026-11-12T10:00:00.000Z'
};

const tareaBocas: TareaTipo = {
  id: 'tt-bocas',
  nombre: 'Bocas Iluminación',
  slug: 'bocas-iluminacion',
  categoria: 'Instalación',
  unidad: 'bocas',
  parametros: [],
  insumos: [],
  manoObra: [{ categoriaId: 'mo-of', horas: 1 }],
  frecuenciaUso: 1
};

describe('MobileEjecutarView - Vista móvil orientada a esquemas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra recientes arriba, renderiza formulario desde esquema (stepper, select, boolean y condición) y actualiza total vivo abajo', async () => {
    render(
      <ToastProvider>
        <MobileEjecutarView
          config={DEFAULT_APP_CONFIG}
          catalogOverride={{ tareasTipo: [tareaBocas, tareaTablero], manoObra }}
          onBack={() => {}}
        />
      </ToastProvider>
    );

    // No debe haber textarea ni modo experto/YAML en móvil
    expect(document.querySelector('textarea')).toBeNull();
    expect(screen.queryByText(/modo experto/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /\+ trabajo tipo/i }));

    const dialog = screen.getByRole('dialog', { name: /elegir trabajo tipo/i });
    const recientesSection = within(dialog).getByRole('region', { name: /recientes/i });
    expect(within(recientesSection).getByText('Armado de Tablero')).toBeTruthy();

    // Seleccionar trabajo con parámetros -> genera el formulario del esquema
    fireEvent.click(within(recientesSection).getByText('Armado de Tablero'));

    expect((screen.getByLabelText('Circuitos') as HTMLInputElement).value).toBe('4');
    expect(screen.getByRole('radio', { name: 'Exterior' })).toBeTruthy();
    // Campo condicional oculto cuando incluye_jabalina === 0
    expect(screen.queryByLabelText('Profundidad jabalina')).toBeNull();

    // Activar boolean -> aparece parámetro condicional
    fireEvent.click(screen.getByRole('switch', { name: 'Incluye jabalina' }));
    expect(screen.getByLabelText('Profundidad jabalina')).toBeTruthy();

    // Aumentar circuitos con stepper (+)
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar Circuitos' }));
    expect((screen.getByLabelText('Circuitos') as HTMLInputElement).value).toBe('5');

    fireEvent.click(screen.getByRole('button', { name: /agregar a la cotización/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText('Armado de Tablero')).toBeTruthy();
    });

    const totalBefore = screen.getByTestId('mobile-live-total').textContent || '';
    expect(totalBefore).not.toMatch(/^\$\s*0,00$/);

    // Editar stepper directo en la tarjeta recalcula el total vivo fijo abajo
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar Circuitos' }));
    await waitFor(() => {
      expect(screen.getByTestId('mobile-live-total').textContent).not.toBe(totalBefore);
    });
  });

  it('permite agregar un ítem libre con atajo de 3 campos y abrir acciones de compartir/exportar', async () => {
    render(
      <ToastProvider>
        <MobileEjecutarView
          config={DEFAULT_APP_CONFIG}
          catalogOverride={{ tareasTipo: [tareaBocas], manoObra }}
          onBack={() => {}}
        />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /ítem libre/i }));

    fireEvent.change(screen.getByLabelText('Descripción'), {
      target: { value: 'Visita técnica' }
    });
    fireEvent.change(screen.getByLabelText('Cantidad'), {
      target: { value: '2' }
    });
    fireEvent.change(screen.getByLabelText(/precio unitario/i), {
      target: { value: '15000' }
    });

    fireEvent.click(screen.getByRole('button', { name: /agregar ítem libre/i }));

    await waitFor(() => {
      expect(screen.getByText('Visita técnica')).toBeTruthy();
    });
    expect(screen.getByTestId('mobile-live-total').textContent || '').not.toMatch(/^\$\s*0,00$/);

    // Abrir hoja de compartir y disparar Descargar PDF / Excel
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    expect(mockExportPDF).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));
    await waitFor(() => {
      expect(mockExportXLSX).toHaveBeenCalledTimes(1);
    });
  });

  it('permite activar, editar y agregar gastos indirectos puntuales y márgenes por cotización desde móvil', async () => {
    const gastosCatalog: CostoIndirecto[] = [
      {
        id: 'ci-viaticos',
        nombre: 'Viáticos y movilidad',
        destino: 'costo_indirecto',
        modalidad: 'monto_fijo',
        valor: 10000,
        incluirPorDefecto: true
      },
      {
        id: 'ci-seguro',
        nombre: 'Seguro ART obra',
        destino: 'costo_indirecto',
        modalidad: 'porcentual',
        valor: 5,
        incluirPorDefecto: false
      }
    ];

    render(
      <ToastProvider>
        <MobileEjecutarView
          config={DEFAULT_APP_CONFIG}
          catalogOverride={{
            tareasTipo: [tareaBocas],
            manoObra,
            costosIndirectosCatalog: gastosCatalog
          }}
          onBack={() => {}}
        />
      </ToastProvider>
    );

    // Agregar 1 tarea base
    fireEvent.click(screen.getByRole('button', { name: /\+ trabajo tipo/i }));
    fireEvent.click(screen.getByRole('button', { name: /agregar rápido/i }));

    const totalConViaticosDefault = screen.getByTestId('mobile-live-total').textContent || '';

    // Abrir sheet de gastos indirectos y márgenes
    fireEvent.click(screen.getByRole('button', { name: /configurar gastos indirectos y márgenes/i }));
    const sheet = screen.getByRole('dialog', { name: /configurar gastos indirectos y márgenes/i });

    // Editar monto de Viáticos solo para esta cotización (10.000 -> 25.000)
    fireEvent.change(within(sheet).getByLabelText('Valor de Viáticos y movilidad'), {
      target: { value: '25000' }
    });

    // Activar Seguro ART obra (estaba inactivo por defecto)
    fireEvent.click(within(sheet).getByRole('switch', { name: 'Aplicar Seguro ART obra' }));
    expect(
      within(sheet).getByRole('switch', { name: 'Aplicar Seguro ART obra' }).getAttribute('aria-checked')
    ).toBe('true');

    // Agregar gasto puntual específico de esta obra
    fireEvent.click(within(sheet).getByRole('button', { name: /gasto puntual/i }));
    fireEvent.change(within(sheet).getByLabelText('Descripción del gasto puntual'), {
      target: { value: 'Alquiler de andamio' }
    });
    fireEvent.change(within(sheet).getByLabelText('Valor del gasto puntual'), {
      target: { value: '40000' }
    });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Agregar' }));

    expect(within(sheet).getByText('Alquiler de andamio')).toBeTruthy();

    // Ajustar Beneficio %
    fireEvent.change(within(sheet).getByLabelText('Beneficio porcentual'), {
      target: { value: '30' }
    });

    fireEvent.click(within(sheet).getByRole('button', { name: 'Listo' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    const totalActualizado = screen.getByTestId('mobile-live-total').textContent || '';
    expect(totalActualizado).not.toBe(totalConViaticosDefault);

    // Guardar y confirmar persistencia en Dexie de gastosConfig y beneficioPorcentaje
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cotización' }));
    await waitFor(() => {
      expect(mockPutPresupuesto).toHaveBeenCalledTimes(1);
    });
    const savedPresupuesto = mockPutPresupuesto.mock.calls[0][0];
    expect(savedPresupuesto.beneficioPorcentaje).toBe(30);
    expect(savedPresupuesto.gastosConfig).toHaveLength(3);
    expect(savedPresupuesto.gastosConfig).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ci-viaticos', valor: 25000, aplica: true }),
        expect.objectContaining({ id: 'ci-seguro', valor: 5, aplica: true }),
        expect.objectContaining({ nombre: 'Alquiler de andamio', valor: 40000, aplica: true })
      ])
    );
  });

  it('preserva fórmulas de escritorio sin degradar a NaN, evalúa visibilidad condicional con fórmulas y permite gestionar Variables de obra + MathInput en móvil', async () => {
    render(
      <ToastProvider>
        <MobileEjecutarView
          config={DEFAULT_APP_CONFIG}
          initialPresupuesto={{
            id: 'pres-desktop-formulas',
            numero: 'IEBA-FX1',
            variablesCotizacion: [
              { id: 'sup', expresion: '80', valorEvaluado: 80, unidad: 'm²' }
            ],
            items: [
              {
                id: 'item-tab-1',
                descripcion: 'Armado de Tablero',
                cantidad: 8,
                unidad: 'u',
                tareaTipoId: 'tt-tablero',
                overridesParametros: {
                  circuitos: 'ceil(sup * 0.1)',
                  incluye_jabalina: 'sup > 50 ? 1 : 0'
                },
                valoresParametros: {
                  circuitos: 8,
                  tipo_embutido: 1,
                  incluye_jabalina: 1,
                  profundidad_jabalina: 1.5
                },
                insumosSnapshot: [],
                manoObraSnapshot: [],
                costoInsumos: 0,
                costoManoObra: 50000,
                costoDirectoTotal: 50000,
                precioVentaUnitario: 50000,
                precioVentaTotal: 50000
              }
            ]
          }}
          catalogOverride={{ tareasTipo: [tareaTablero, tareaBocas], manoObra }}
          onBack={() => {}}
        />
      </ToastProvider>
    );

    // 1. El campo Circuitos muestra el valor real evaluado (8, NO valorDefault 4) y el indicador de fórmula
    const circuitosInput = screen.getByLabelText('Circuitos') as HTMLInputElement;
    expect(circuitosInput.value).toBe('8');
    expect(screen.getByText(/ƒx = ceil\(sup \* 0\.1\)/)).toBeTruthy();

    // 2. La condición `incluye_jabalina == 1` (derivada de fórmula) habilita Profundidad jabalina
    expect(screen.getByLabelText('Profundidad jabalina')).toBeTruthy();

    // 3. Editar la fórmula en MathInput (sup / 4 -> 20) recalcula y conserva la fórmula
    fireEvent.focus(circuitosInput);
    expect(circuitosInput.value).toBe('ceil(sup * 0.1)');
    fireEvent.change(circuitosInput, { target: { value: 'sup / 4' } });
    fireEvent.blur(circuitosInput);

    await waitFor(() => {
      expect((screen.getByLabelText('Circuitos') as HTMLInputElement).value).toBe('20');
      expect(screen.getByText(/ƒx = sup \/ 4/)).toBeTruthy();
    });

    // 4. Abrir hoja de Variables de obra y crear una variable derivada con álgebra de unidades
    fireEvent.click(screen.getByRole('button', { name: /configurar variables de obra/i }));
    const varsSheet = screen.getByRole('dialog', { name: 'Variables de obra' });
    expect(within(varsSheet).getAllByText('sup').length).toBeGreaterThanOrEqual(1);

    fireEvent.change(within(varsSheet).getByLabelText(/nombre \(identificador\)/i), {
      target: { value: 'bocas' }
    });
    fireEvent.change(within(varsSheet).getByLabelText(/valor o fórmula/i), {
      target: { value: 'sup / 4' }
    });
    expect(within(varsSheet).getByText(/Vista previa:/)).toBeTruthy();
    fireEvent.click(within(varsSheet).getByRole('button', { name: /agregar variable/i }));

    expect(within(varsSheet).getAllByText('bocas').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(within(varsSheet).getByLabelText('Cerrar variables de obra'));

    // 5. Agregar ítem libre rápido usando expresiones con variables en MathInput
    fireEvent.click(screen.getByRole('button', { name: /ítem libre/i }));
    fireEvent.change(screen.getByLabelText('Descripción'), {
      target: { value: 'Canalización extra' }
    });
    const qtyInput = screen.getByLabelText('Cantidad');
    fireEvent.focus(qtyInput);
    fireEvent.change(qtyInput, { target: { value: 'bocas / 2' } });
    fireEvent.blur(qtyInput);

    const priceInput = screen.getByLabelText(/precio unitario/i);
    fireEvent.focus(priceInput);
    fireEvent.change(priceInput, { target: { value: '2000 * 3' } });
    fireEvent.blur(priceInput);

    fireEvent.click(screen.getByRole('button', { name: /agregar ítem libre/i }));

    await waitFor(() => {
      expect(screen.getByText('Canalización extra')).toBeTruthy();
      expect(screen.getByText(/ƒx bocas \/ 2/)).toBeTruthy();
    });
  });
});
