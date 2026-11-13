import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../contexts/ToastContext';
import { DEFAULT_APP_CONFIG } from '../../../core/sampleData';
import { CategoriaManoDeObra, TareaTipo } from '../../../core/types';
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
});
