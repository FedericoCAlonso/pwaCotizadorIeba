import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DEFAULT_APP_CONFIG } from '../../../core/sampleData';
import {
  CategoriaManoDeObra,
  Material,
  Oferta,
  Producto,
  TareaTipo
} from '../../../core/types';
import { NotebookDesktopView } from './NotebookDesktopView';

const { mockPutPresupuesto, mockPutTareaTipo } = vi.hoisted(() => ({
  mockPutPresupuesto: vi.fn().mockResolvedValue('pres-1'),
  mockPutTareaTipo: vi.fn().mockResolvedValue('tt-new')
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
      put: mockPutTareaTipo,
      toArray: vi.fn().mockResolvedValue([])
    },
    materiales: { toArray: vi.fn().mockResolvedValue([]) },
    productos: { toArray: vi.fn().mockResolvedValue([]) },
    ofertas: { toArray: vi.fn().mockResolvedValue([]) },
    insumos: { toArray: vi.fn().mockResolvedValue([]) },
    manoObra: { toArray: vi.fn().mockResolvedValue([]) },
    costosIndirectos: { toArray: vi.fn().mockResolvedValue([]) }
  }
}));

const materiales: Material[] = [
  {
    id: 'mat-cable-25',
    nombre: 'Cable 2.5mm Celeste',
    categoriaId: 'cables',
    unidadVenta: 'm',
    atributos: [],
    activo: true,
    frecuenciaUso: 50
  }
];

const productos: Producto[] = [
  {
    id: 'prod-prysmian',
    materialId: 'mat-cable-25',
    marca: 'Prysmian',
    modelo: 'Superastic',
    esPreferido: true
  }
];

const ofertas: Oferta[] = [
  {
    id: 'of-1',
    materialId: 'mat-cable-25',
    productoId: 'prod-prysmian',
    proveedorNombre: 'Distribuidora',
    precio: 1000,
    fecha: '2026-03-01T00:00:00Z',
    fuente: 'manual'
  }
];

const manoObra: CategoriaManoDeObra[] = [
  { id: 'mo-oficial', nombre: 'Oficial', costoHora: 5000, fechaActualizacion: '2026-03-01' }
];

const tareasTipo: TareaTipo[] = [
  {
    id: 'tt-recableado',
    nombre: 'Recableado Completo',
    slug: 'recableado-completo',
    categoria: 'Instalaciones',
    unidad: 'm2',
    frecuenciaUso: 40,
    parametros: [
      { id: 'sup', nombre: 'Superficie', tipo: 'numero', valorDefault: 60 },
      { id: 'bocas', nombre: 'Bocas', tipo: 'numero', valorDefault: 12 }
    ],
    insumos: [{ materialId: 'mat-cable-25', cantidad: 1, formula: 'bocas * 2' }],
    manoObra: [{ categoriaId: 'mo-oficial', horas: 1, formula: 'bocas * 0.5' }],
    supuestos: [
      { id: 'caneria', nombre: 'Cañería', opciones: ['no_verificada', 'verificada'], valorDefault: 'no_verificada' },
      { id: 'tablero', nombre: 'Tablero', opciones: ['no_verificada', 'verificada'], valorDefault: 'no_verificada' },
      { id: 'puesta_tierra', nombre: 'PAT', opciones: ['no_verificada', 'verificada'], valorDefault: 'no_verificada' },
      { id: 'medianera', nombre: 'Medianera', opciones: ['no_verificada', 'verificada'], valorDefault: 'no_verificada' }
    ],
    alcance: {
      inclusiones: [{ id: 'inc-1', texto: 'Cableado normalizado completo' }],
      exclusiones: [{ id: 'exc-1', texto: 'Trabajos de albañilería' }]
    },
    advertenciasCondicionales: [
      {
        id: 'adv-1',
        supuestoId: 'caneria',
        valoresActivacion: ['no_verificada'],
        tema: 'caneria',
        textoPlantilla: 'Si aparece cañería tapada, se repone a {precio} por metro.',
        precioUnitarioContingencia: 8000,
        unidadContingencia: 'm'
      },
      {
        id: 'adv-2',
        supuestoId: 'tablero',
        valoresActivacion: ['no_verificada'],
        tema: 'tablero',
        textoPlantilla: 'Si el gabinete no tiene espacio DIN, se cambia a {precio}.',
        precioUnitarioContingencia: 45000
      },
      {
        id: 'adv-3',
        supuestoId: 'puesta_tierra',
        valoresActivacion: ['no_verificada'],
        tema: 'pat',
        textoPlantilla: 'Si no existe jabalina previa, se agrega hincado por {precio}.',
        precioUnitarioContingencia: 65000
      },
      {
        id: 'adv-4',
        supuestoId: 'medianera',
        valoresActivacion: ['no_verificada'],
        tema: 'albañileria',
        textoPlantilla: 'Si la pared es portante, el pase se cotiza aparte desde {precio}.',
        precioUnitarioContingencia: 25000
      }
    ]
  }
];

describe('NotebookDesktopView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const catalogOverride = { tareasTipo, materiales, productos, ofertas, manoObra };

  it('renderiza chips reconocidos (material, marca, unidad) y subtotal en margen derecho', () => {
    render(
      <NotebookDesktopView
        config={DEFAULT_APP_CONFIG}
        initialPresupuesto={{ numero: 'IEBA-0100' }}
        catalogOverride={catalogOverride}
        onBack={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText('Editor notebook de cotización');
    fireEvent.change(textarea, {
      target: { value: '/tt recableado-completo  sup=60  bocas=12', selectionStart: 39 }
    });

    const marginLine = screen.getByTestId('margin-line-1');
    expect(marginLine.textContent).toContain('Cable 2.5mm Celeste');
    expect(marginLine.textContent).toContain('Prysmian');
    expect(marginLine.textContent).toContain('$');
  });

  it('soporta autocompletado con Tab/Enter, ghost text, paleta Ctrl+K y ayuda ?', () => {
    render(
      <NotebookDesktopView
        config={DEFAULT_APP_CONFIG}
        catalogOverride={catalogOverride}
        onBack={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText('Editor notebook de cotización') as HTMLTextAreaElement;

    // Escribir /tt recab muestra autocompletado + ghost text y Tab lo acepta
    fireEvent.change(textarea, { target: { value: '/tt recab', selectionStart: 9 } });
    fireEvent.click(textarea);

    expect(screen.getByRole('listbox', { name: 'Sugerencias de autocompletado' })).toBeTruthy();
    expect(screen.getByTestId('notebook-ghost-text').textContent).toContain('leado-completo');

    fireEvent.keyDown(textarea, { key: 'Tab' });
    expect(textarea.value).toBe('/tt recableado-completo\n  sup = 60\n  bocas = 12');

    // Ctrl+K abre paleta de comandos y permite insertar un bloque con click
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Paleta de comandos del notebook' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Buscar comando'), { target: { value: 'nota' } });
    fireEvent.click(screen.getByText('Nueva nota interna'));
    expect(textarea.value).toContain('nota: ');

    // Ayuda de atajos con ? (botón descubrible o atajo fuera del editor)
    fireEvent.click(screen.getByLabelText('Ayuda de atajos de teclado'));
    expect(screen.getByRole('dialog', { name: 'Atajos de teclado del notebook' })).toBeTruthy();
  });

  it('muestra Total parcial en Dos Pasadas, permite ir a siguiente (Ctrl+↓) y valorizar con clic', () => {
    render(
      <NotebookDesktopView
        config={DEFAULT_APP_CONFIG}
        catalogOverride={catalogOverride}
        onBack={vi.fn()}
      />
    );

    // Pasada 1: activar modo esqueleto con el pill del encabezado
    fireEvent.click(screen.getByText(/Pasada 2/));

    const textarea = screen.getByLabelText('Editor notebook de cotización');
    fireEvent.change(textarea, {
      target: {
        value: '/tt recableado-completo  sup=40  bocas=8\n/tt recableado-completo  sup=80  bocas=16',
        selectionStart: 1
      }
    });

    expect(screen.getByTestId('notebook-total-header').textContent).toContain('Total parcial');
    expect(screen.getByText(/2 sin valorizar/)).toBeTruthy();

    // Ctrl+↓ salta a la siguiente pendiente y botón Sin valorizar valoriza en 1 clic
    fireEvent.keyDown(window, { key: 'ArrowDown', ctrlKey: true });
    const sinValButtons = screen.getAllByText('Sin valorizar');
    fireEvent.click(sinValButtons[0]);

    expect(screen.getByText(/1 sin valorizar/)).toBeTruthy();
  });

  it('sugiere convertir tarea libre repetida en Trabajo tipo y muestra Alcance y supuestos antes del total sin notas internas', async () => {
    render(
      <NotebookDesktopView
        config={DEFAULT_APP_CONFIG}
        catalogOverride={catalogOverride}
        onBack={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText('Editor notebook de cotización');
    fireEvent.change(textarea, {
      target: {
        value: [
          'nota: Margen mínimo secreto',
          '/tt recableado-completo  sup=60  bocas=12',
          'item: Colocar sensor crepuscular  1 u  15000',
          'item: Colocar sensor crepuscular  2 u  15000'
        ].join('\n'),
        selectionStart: 1
      }
    });

    // Sugerencia de conversión visible y funcional
    expect(screen.getByText(/Se repite “Colocar sensor crepuscular” \(2x\)/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Convertir en \/tt colocar-sensor-crepuscular/));
    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toContain('/tt colocar-sensor-crepuscular');
    });

    // Abrir vista previa al cliente
    fireEvent.click(screen.getByText('Cliente'));
    const dialog = screen.getByRole('dialog', { name: 'Vista previa del documento al cliente' });

    const alcanceEl = screen.getByTestId('alcance-antes-del-total');
    const totalEl = screen.getByTestId('total-documento-cliente');

    // Regla 5: Alcance y supuestos ANTES del total en el DOM
    expect(
      alcanceEl.compareDocumentPosition(totalEl) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // Regla 4: máximo 3 advertencias visibles + "Ver condiciones" desplegable
    expect(screen.getByText(/Ver condiciones \(1\)/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Ver condiciones \(1\)/));
    expect(dialog.textContent).toContain('Si la pared es portante');

    // Regla 7: nota interna NUNCA sale en el documento al cliente
    expect(dialog.textContent).not.toContain('Margen mínimo secreto');
  });

  it('navega sugerencias con ArrowDown sin resetear en keyUp, cierra con Esc/× y soporta Ctrl+Z / Ctrl+Y', () => {
    const onBack = vi.fn();
    render(
      <NotebookDesktopView
        config={DEFAULT_APP_CONFIG}
        catalogOverride={catalogOverride}
        onBack={onBack}
      />
    );

    const textarea = screen.getByLabelText('Editor notebook de cotización') as HTMLTextAreaElement;

    // En línea vacía el popup NO debe abrirse invasivamente
    expect(screen.queryByRole('listbox', { name: 'Sugerencias de autocompletado' })).toBeNull();

    // Escribir `/` abre el menú de comandos
    fireEvent.change(textarea, { target: { value: '/', selectionStart: 1 } });
    fireEvent.keyUp(textarea, { key: '/' });
    expect(screen.getByRole('listbox', { name: 'Sugerencias de autocompletado' })).toBeTruthy();

    // ArrowDown mueve la selección al segundo ítem y keyUp posterior NO debe resetearla a 0
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    fireEvent.keyUp(textarea, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');

    // Esc cierra el popup sin salir de la vista
    fireEvent.keyDown(textarea, { key: 'Escape' });
    fireEvent.keyUp(textarea, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'Sugerencias de autocompletado' })).toBeNull();
    expect(onBack).not.toHaveBeenCalled();

    // Ctrl+Space vuelve a abrir las sugerencias y el botón × permite cerrarlas
    fireEvent.keyDown(textarea, { key: ' ', code: 'Space', ctrlKey: true });
    expect(screen.getByRole('listbox', { name: 'Sugerencias de autocompletado' })).toBeTruthy();
    fireEvent.mouseDown(screen.getByLabelText('Cerrar sugerencias'));
    expect(screen.queryByRole('listbox', { name: 'Sugerencias de autocompletado' })).toBeNull();

    // Ctrl+Z deshace y Ctrl+Y rehace
    fireEvent.change(textarea, { target: { value: 'primero', selectionStart: 7 } });
    fireEvent.change(textarea, { target: { value: 'segundo bloque', selectionStart: 14 } });
    expect(textarea.value).toBe('segundo bloque');

    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true });
    expect(textarea.value).toBe('primero');

    fireEvent.keyDown(textarea, { key: 'y', ctrlKey: true });
    expect(textarea.value).toBe('segundo bloque');
  });

  it('muestra valores evaluados en margen derecho, cinta interactiva de variables, funciones y resaltado de sintaxis', () => {
    render(
      <NotebookDesktopView
        config={DEFAULT_APP_CONFIG}
        catalogOverride={catalogOverride}
        onBack={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText('Editor notebook de cotización') as HTMLTextAreaElement;

    // 1. Declarar variable desde el botón + Variable de la cinta
    fireEvent.click(screen.getByRole('button', { name: 'Variable' }));
    const dialog = screen.getByRole('dialog', { name: 'Nueva variable' });
    fireEvent.change(screen.getByLabelText(/Nombre \(identificador\)/i), { target: { value: 'sup' } });
    fireEvent.change(screen.getByLabelText(/Valor o fórmula/i), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'm²' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(dialog).toBeTruthy();

    expect(textarea.value).toContain('sup = 80 m²');
    expect(screen.getByTestId('margin-line-1').textContent).toContain('= 80 m²');
    expect(screen.getByTestId('notebook-syntax-overlay')).toBeTruthy();

    // 2. Escribir variable derivada y sub-línea con fórmula -> el margen muestra resultados reales
    fireEvent.change(textarea, {
      target: {
        value: [
          'sup = 80 m²',
          'bocas = ceil(sup * 0.3)',
          '/tt recableado-completo',
          '  sup = sup',
          '  bocas = bocas'
        ].join('\n'),
        selectionStart: 1
      }
    });

    expect(screen.getByTestId('margin-line-1').textContent).toContain('= 80 m²');
    expect(screen.getByTestId('margin-line-2').textContent).toContain('= 24');
    expect(screen.getByTestId('margin-line-4').textContent).toContain('= 80');
    expect(screen.getByTestId('margin-line-5').textContent).toContain('= 24');

    // 3. Insertar función desde menú ƒ(x) en el cursor
    fireEvent.click(screen.getByLabelText('Insertar función matemática'));
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: /ceil\(x\)/i }));
    expect(textarea.value).toContain('ceil()');

    // 4. Álgebra pragmática de unidades visible en el margen derecho (m², cm->m con nota)
    fireEvent.change(textarea, {
      target: {
        value: [
          'largo = 12 m',
          'ancho = 5 m',
          'sup = largo * ancho',
          'bajada = 150 cm',
          'tarea: Bajada tablero',
          '  mat: Cable 2.5mm Celeste',
          '    cantidad = bajada'
        ].join('\n'),
        selectionStart: 1
      }
    });

    expect(screen.getByTestId('margin-line-3').textContent).toContain('= 60 m²');
    expect(screen.getByTestId('margin-line-7').textContent).toContain('1,5 m');
    expect(screen.getByTestId('margin-line-7').textContent).toContain('← 150 cm');
  });

  it('abre la guía rápida (?) con pestañas Sintaxis y Fórmulas / Atajos y permite insertar un ejemplo en el editor', () => {
    render(
      <NotebookDesktopView
        config={DEFAULT_APP_CONFIG}
        catalogOverride={catalogOverride}
        onBack={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText('Editor notebook de cotización') as HTMLTextAreaElement;

    // Abrir modal ?
    fireEvent.click(screen.getByLabelText(/Atajos de teclado/i));
    const dialog = screen.getByRole('dialog', { name: 'Atajos de teclado del notebook' });
    expect(dialog).toBeTruthy();

    // Pestaña inicial: Sintaxis y Fórmulas
    const tabSintaxis = screen.getByRole('tab', { name: /Sintaxis y Fórmulas/i });
    const tabAtajos = screen.getByRole('tab', { name: /Atajos/i });
    expect(tabSintaxis.getAttribute('aria-selected')).toBe('true');
    expect(dialog.textContent).toContain('Variables globales y unidades');
    expect(dialog.textContent).toContain('Operadores y funciones matemáticas');

    // Cambiar a pestaña Atajos y verificar contenido
    fireEvent.click(tabAtajos);
    expect(tabAtajos.getAttribute('aria-selected')).toBe('true');
    expect(dialog.textContent).toContain('Abrir paleta de comandos');

    // Volver a Sintaxis e insertar el primer ejemplo
    fireEvent.click(tabSintaxis);
    const insertButtons = screen.getAllByRole('button', { name: /Insertar ejemplo/i });
    expect(insertButtons.length).toBeGreaterThan(0);
    fireEvent.click(insertButtons[0]);

    // El modal se cierra y el ejemplo queda insertado en el textarea
    expect(screen.queryByRole('dialog', { name: 'Atajos de teclado del notebook' })).toBeNull();
    expect(textarea.value).toContain('largo = 12 m');
  });
});
