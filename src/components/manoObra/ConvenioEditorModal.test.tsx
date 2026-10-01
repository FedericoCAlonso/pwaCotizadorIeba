import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConvenioEditorModal } from './ConvenioEditorModal';
import { ConvenioLaboral } from '../../core/types';

describe('ConvenioEditorModal', () => {
  const mockConvenio: ConvenioLaboral = {
    id: 'uocra',
    nombre: 'UOCRA',
    cargasSocialesPct: 65,
    gastosDirectosOperarioDefecto: 5000,
    horasJornadaDefecto: 9,
    descripcion: 'Convenio general de obras',
    adicionales: {
      adicionalTrabajoAltura: 0.20
    }
  };

  it('no renderiza nada cuando isOpen es false', () => {
    const { container } = render(
      <ConvenioEditorModal
        isOpen={false}
        onClose={vi.fn()}
        convenio={mockConvenio}
        onSave={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('carga los datos del convenio existente en el formulario', () => {
    render(
      <ConvenioEditorModal
        isOpen={true}
        onClose={vi.fn()}
        convenio={mockConvenio}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Editar Convenio Laboral')).toBeDefined();
    expect(screen.getByDisplayValue('UOCRA')).toBeDefined();
    expect(screen.getByDisplayValue('65')).toBeDefined();
    expect(screen.getByDisplayValue('5000')).toBeDefined();
    expect(screen.getByDisplayValue('adicionalTrabajoAltura')).toBeDefined();
    expect(screen.getByDisplayValue('20')).toBeDefined();
  });

  it('permite modificar valores y guardar', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <ConvenioEditorModal
        isOpen={true}
        onClose={handleClose}
        convenio={mockConvenio}
        onSave={handleSave}
      />
    );

    const nameInput = screen.getByDisplayValue('UOCRA');
    fireEvent.change(nameInput, { target: { value: 'UOCRA 2026' } });

    const submitBtn = screen.getByRole('button', { name: /guardar convenio/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(handleSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 'uocra',
      nombre: 'UOCRA 2026',
      cargasSocialesPct: 65
    }));
    expect(handleClose).toHaveBeenCalled();
  });

  it('permite agregar un nuevo modificador de fórmula', () => {
    render(
      <ConvenioEditorModal
        isOpen={true}
        onClose={vi.fn()}
        convenio={mockConvenio}
        onSave={vi.fn()}
      />
    );

    const addModBtn = screen.getByRole('button', { name: /agregar/i });
    fireEvent.click(addModBtn);

    const removeBtns = screen.getAllByTitle('Eliminar modificador');
    expect(removeBtns.length).toBe(2);
  });
});
