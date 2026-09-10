import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { FormAiAssistantModal } from './FormAiAssistantModal';
import { Insumo, CategoriaManoDeObra, TareaFormData } from '../../../core/types';

vi.mock('../../../core/ai/aiAssistantService', () => ({
  checkOllamaAvailability: vi.fn().mockResolvedValue(false),
  generateTareaFormDataWithAI: vi.fn().mockResolvedValue({
    data: {
      nombre: 'Instalación Circuito TUE Aire Acondicionado',
      categoria: 'Fuerza Motriz',
      unidad: 'punto',
      naturaleza: 'instalacion',
      honorarioBase: 0,
      formulaHonorarios: '',
      costoServicioDirecto: 0,
      notasTecnicas: 'Circuito TUE según AEA 90364',
      clausulaExclusiones: 'No incluye provisión de split',
      costoFijoOperativo: 0,
      descripcionCostoFijo: '',
      parametros: [
        { id: 'equipos', nombre: 'Cantidad de Equipos', tipo: 'numero', valorDefault: 1, unidad: 'u' }
      ],
      variables: [
        { id: 'cable_fase_neutro', formula: 'equipos * 12 * 2 * 1.10' }
      ],
      insumos: [
        { materialId: 'c-25', cantidad: 1, formula: 'cable_fase_neutro' }
      ],
      manoObra: [
        { categoriaId: 'mo-oficial', horas: 3.5, formula: 'equipos * 3.5' }
      ]
    } as TareaFormData,
    yaml: 'nombre: Test',
    source: 'heuristic_fallback',
    diagnosticsCount: 0
  })
}));

describe('FormAiAssistantModal', () => {
  const mockInsumosMap = new Map<string, Insumo>();
  const mockManoObraMap = new Map<string, CategoriaManoDeObra>();

  it('no se renderiza si isOpen es false', () => {
    const { container } = render(
      <FormAiAssistantModal
        isOpen={false}
        onClose={vi.fn()}
        onApplyFormData={vi.fn()}
        insumosMap={mockInsumosMap}
        manoObraMap={mockManoObraMap}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('se abre y permite generar y aplicar el formulario estructurado', async () => {
    const handleApply = vi.fn();
    const handleClose = vi.fn();

    render(
      <FormAiAssistantModal
        isOpen={true}
        onClose={handleClose}
        onApplyFormData={handleApply}
        insumosMap={mockInsumosMap}
        manoObraMap={mockManoObraMap}
      />
    );

    expect(screen.getByText('Asistente de Trabajo Tipo')).toBeDefined();

    // Click on preset
    const presetBtn = screen.getByText('❄️ Aire Split TUE');
    fireEvent.click(presetBtn);

    // Click on generate
    const generateBtn = screen.getByText('Autocompletar Formulario');
    fireEvent.click(generateBtn);

    // Wait for result summary
    await waitFor(() => {
      expect(screen.getByText('Estructura Generada con Éxito')).toBeDefined();
    });

    expect(screen.getByText('Instalación Circuito TUE Aire Acondicionado')).toBeDefined();
    expect(screen.getByText(/Parámetros/)).toBeDefined();

    // Click apply to form
    const applyBtn = screen.getByText('Cargar en el Formulario');
    fireEvent.click(applyBtn);

    expect(handleApply).toHaveBeenCalledTimes(1);
    expect(handleApply).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Instalación Circuito TUE Aire Acondicionado',
        categoria: 'Fuerza Motriz'
      }),
      'nombre: Test'
    );
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
