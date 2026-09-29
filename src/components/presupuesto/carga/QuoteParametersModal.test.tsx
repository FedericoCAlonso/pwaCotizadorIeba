import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuoteParametersModal } from './QuoteParametersModal';

describe('QuoteParametersModal', () => {
  it('muestra el banner de ámbito global y permite seleccionar presets rápidos', () => {
    const onUpdateCalculosVariables = vi.fn();

    render(
      <QuoteParametersModal
        isOpen={true}
        onClose={vi.fn()}
        calculosVariables={{ superficie: 100 }}
        onUpdateCalculosVariables={onUpdateCalculosVariables}
      />
    );

    // Debe mostrar badge de ámbito global en el encabezado
    expect(screen.getByText('🌐 Ámbito Global')).toBeDefined();

    // Debe mostrar la variable existente
    expect(screen.getByText('superficie')).toBeDefined();

    // Debe mostrar presets como "Superficie (120 m²)", "Trifásica (1=Sí)", etc.
    const trifasicaPreset = screen.getByText(/Trifásica \(1=Sí\)/i);
    expect(trifasicaPreset).toBeDefined();

    // Al hacer clic en un preset no existente, lo agrega a las variables globales
    fireEvent.click(trifasicaPreset);
    expect(onUpdateCalculosVariables).toHaveBeenCalledWith(
      expect.objectContaining({
        superficie: 100,
        trifasica: 1
      })
    );
  });

  it('permite alternar la guía rápida de fórmulas y decisiones', () => {
    render(
      <QuoteParametersModal
        isOpen={true}
        onClose={vi.fn()}
        calculosVariables={{}}
      />
    );

    const toggleBtn = screen.getByText(/Guía de Fórmulas/i);
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/Reglas de alcance y uso de parámetros:/i)).toBeDefined();
  });
});
