import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AiPromptModal } from './AiPromptModal';
import { Insumo, CategoriaManoDeObra } from '../../../core/types';

vi.mock('../../../core/ai/aiAssistantService', () => ({
  checkOllamaAvailability: vi.fn().mockResolvedValue(false),
  generateTareaTipoWithAI: vi.fn().mockResolvedValue({
    yaml: 'nombre: Tarea Generada por Mock\ncategoria: Instalaciones',
    source: 'heuristic_fallback',
    diagnosticsCount: 0,
  }),
}));

describe('AiPromptModal', () => {
  const mockInsumosMap = new Map<string, Insumo>();
  const mockManoObraMap = new Map<string, CategoriaManoDeObra>();

  it('no renderiza nada si isOpen es false', () => {
    const { container } = render(
      <AiPromptModal
        isOpen={false}
        onClose={vi.fn()}
        onApplyYaml={vi.fn()}
        insumosMap={mockInsumosMap}
        manoObraMap={mockManoObraMap}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza título, input y botones de ejemplo al estar abierto', () => {
    render(
      <AiPromptModal
        isOpen={true}
        onClose={vi.fn()}
        onApplyYaml={vi.fn()}
        insumosMap={mockInsumosMap}
        manoObraMap={mockManoObraMap}
      />
    );

    expect(screen.getByText(/Asistente IA • Generador Normativo AEA/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/aires acondicionados/i)).toBeDefined();
    expect(screen.getByText(/Generar Trabajo Tipo/i)).toBeDefined();
  });

  it('ejecuta generación y permite volcar el resultado al editor', async () => {
    const onApplyYaml = vi.fn();
    const onClose = vi.fn();

    render(
      <AiPromptModal
        isOpen={true}
        onClose={onClose}
        onApplyYaml={onApplyYaml}
        insumosMap={mockInsumosMap}
        manoObraMap={mockManoObraMap}
      />
    );

    const textarea = screen.getByPlaceholderText(/aires acondicionados/i);
    fireEvent.change(textarea, { target: { value: 'Circuito para aire split' } });

    const btnGenerate = screen.getByText(/Generar Trabajo Tipo/i);
    fireEvent.click(btnGenerate);

    await waitFor(() => {
      expect(screen.getByText(/Volcar al Editor Experto/i)).toBeDefined();
    });

    const btnApply = screen.getByText(/Volcar al Editor Experto/i);
    fireEvent.click(btnApply);

    expect(onApplyYaml).toHaveBeenCalledWith('nombre: Tarea Generada por Mock\ncategoria: Instalaciones');
    expect(onClose).toHaveBeenCalled();
  });
});
