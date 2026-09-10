import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TareaEditorExperto } from './TareaEditorExperto';

// Mock de ModoExpertoCodeMirror para testing de UI
vi.mock('../../presupuesto/experto/ModoExpertoCodeMirror', () => ({
  ModoExpertoCodeMirror: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div data-testid="mock-codemirror">
      <textarea
        data-testid="codemirror-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
}));

import { ConsumosCalculadosResultado } from '../../../core/calculations';

describe('TareaEditorExperto', () => {
  const mockLiveEval: ConsumosCalculadosResultado = {
    cantidadPrincipal: 1,
    valoresParametros: {},
    valoresVariables: {},
    scope: {},
    costoFijoOperativo: 0,
    insumosSnapshot: [],
    manoObraSnapshot: [{ categoriaId: 'oficial', nombreCategoria: 'Oficial', horasTotales: 5.5, costoHoraCongelado: 7272, subtotalManoObra: 40000 }],
    costoInsumosTotal: 25000,
    costoManoObraTotal: 40000,
    costoDirectoTotal: 65000,
  };

  const mockFormData = {
    nombre: 'Instalación de Tablero Seccional',
    categoria: 'Tableros',
    unidad: 'u',
    notasTecnicas: '',
    parametros: [],
    variables: [],
    insumos: [],
    manoObra: [],
  };

  it('renderiza la barra de snippets y los costos en vivo correctamente', () => {
    const onYamlChange = vi.fn();
    const onInsertSnippet = vi.fn();

    render(
      <TareaEditorExperto
        yamlText="nombre: Instalación de Tablero Seccional\ncategoria: Tableros"
        onYamlChange={onYamlChange}
        diagnostics={[]}
        onInsertSnippet={onInsertSnippet}
        formData={mockFormData}
        liveEvaluation={mockLiveEval}
      />
    );

    expect(screen.getByText('Instalación de Tablero Seccional')).toBeDefined();
    expect(screen.getByText(/25\.000/)).toBeDefined();
    expect(screen.getByText(/40\.000/)).toBeDefined();
    expect(screen.getByText(/65\.000/)).toBeDefined();
    expect(screen.getByText(/5\.5 hs/)).toBeDefined();
    expect(screen.getByText('YAML Válido')).toBeDefined();
  });

  it('dispara onInsertSnippet cuando se hace clic en los botones de inserción', () => {
    const onInsertSnippet = vi.fn();

    render(
      <TareaEditorExperto
        yamlText=""
        onYamlChange={vi.fn()}
        diagnostics={[]}
        onInsertSnippet={onInsertSnippet}
        formData={mockFormData}
        liveEvaluation={mockLiveEval}
      />
    );

    fireEvent.click(screen.getByText('+ Parámetro'));
    expect(onInsertSnippet).toHaveBeenCalledWith('parametro');

    fireEvent.click(screen.getByText('+ Cálculo'));
    expect(onInsertSnippet).toHaveBeenCalledWith('calculo');

    fireEvent.click(screen.getByText('+ Material'));
    expect(onInsertSnippet).toHaveBeenCalledWith('material');

    fireEvent.click(screen.getByText('+ Mano de Obra'));
    expect(onInsertSnippet).toHaveBeenCalledWith('mano_obra');
  });

  it('muestra diagnósticos de error y advertencia en pantalla', () => {
    render(
      <TareaEditorExperto
        yamlText="nombre: Error"
        onYamlChange={vi.fn()}
        diagnostics={[
          { line: 2, type: 'error', message: 'Falta definir la unidad' },
          { line: 4, type: 'warning', message: 'Insumo no encontrado' },
        ]}
        onInsertSnippet={vi.fn()}
        formData={mockFormData}
        liveEvaluation={mockLiveEval}
      />
    );

    expect(screen.getByText(/Sintaxis inválida \(1\)/)).toBeDefined();
    expect(screen.getByText('Falta definir la unidad')).toBeDefined();
    expect(screen.getByText('Insumo no encontrado')).toBeDefined();
  });
});
