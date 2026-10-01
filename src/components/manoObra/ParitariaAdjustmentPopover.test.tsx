import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ParitariaAdjustmentPopover } from './ParitariaAdjustmentPopover';

describe('ParitariaAdjustmentPopover', () => {
  it('se renderiza deshabilitado si no hay categorías activas', () => {
    render(
      <ParitariaAdjustmentPopover
        promedioHora={8000}
        totalCategorias={0}
        onApply={vi.fn()}
      />
    );

    const triggerBtn = screen.getByRole('button', { name: /ajuste paritaria/i });
    expect(triggerBtn).toHaveProperty('disabled', true);
  });

  it('abre el popover al hacer clic y muestra simulación de impacto', () => {
    render(
      <ParitariaAdjustmentPopover
        promedioHora={10000}
        totalCategorias={3}
        onApply={vi.fn()}
      />
    );

    const triggerBtn = screen.getByRole('button', { name: /ajuste paritaria/i });
    fireEvent.click(triggerBtn);

    expect(screen.getByText('Ajuste Masivo de Paritarias')).toBeDefined();
    // Default 10% on 10000 -> 11000 (+1000)
    expect(screen.getByText(/impacto en tarifa promedio/i)).toBeDefined();
  });

  it('permite cambiar porcentaje mediante preset y confirma llamando onApply', async () => {
    const handleApply = vi.fn().mockResolvedValue(undefined);
    render(
      <ParitariaAdjustmentPopover
        promedioHora={10000}
        totalCategorias={2}
        onApply={handleApply}
      />
    );

    // Abrir popover
    fireEvent.click(screen.getByRole('button', { name: /ajuste paritaria/i }));

    // Seleccionar preset +15%
    const preset15 = screen.getByRole('button', { name: '+15%' });
    fireEvent.click(preset15);

    // Confirmar
    const confirmBtn = screen.getByRole('button', { name: /aplicar ajuste/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(handleApply).toHaveBeenCalledWith(15);
  });
});
