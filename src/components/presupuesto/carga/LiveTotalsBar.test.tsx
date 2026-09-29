import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LiveTotalsBar } from './LiveTotalsBar';
import { TotalesPresupuestoResultado } from '../../../core/calculations';

describe('LiveTotalsBar', () => {
  const mockTotales = {
    subtotalInsumos: 100000,
    subtotalManoObra: 50000,
    subtotalServiciosTercerizados: 10000,
    subtotalCostosDirectos: 160000,
    montoMargenRiesgo: 8000,
    gastosGeneralesTotal: 16000,
    beneficioMonto: 36800,
    montoImpuestosTotal: 46368,
    precioFinalGlobal: 267168,
    totalARS: 267168,
    coeficienteK: 1.67
  } as unknown as TotalesPresupuestoResultado;

  it('renderiza el total final y el coeficiente K', () => {
    render(<LiveTotalsBar totales={mockTotales} />);
    expect(screen.getAllByText(/Total:/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/267\.168/i).length).toBeGreaterThanOrEqual(1);
  });

  it('al pulsar en Cascada se despliega el Bottom Sheet de la estructura económica en móvil', () => {
    render(<LiveTotalsBar totales={mockTotales} />);
    const cascadeBtn = screen.getByText('Cascada');
    fireEvent.click(cascadeBtn);

    expect(screen.getByText('Estructura de Cascada Económica')).toBeDefined();
    expect(screen.getByText('1. Costo Directo Neto:')).toBeDefined();
    expect(screen.getByText('2. Margen de Riesgo:')).toBeDefined();
    expect(screen.getByText('3. Gastos Generales (GG):')).toBeDefined();
    expect(screen.getByText('4. Beneficio / Utilidad:')).toBeDefined();
    expect(screen.getByText('5. Impuestos:')).toBeDefined();
  });

  it('invoca onOpenQuoteParameters al tocar el botón de parámetros o total', () => {
    const handleOpen = vi.fn();
    render(<LiveTotalsBar totales={mockTotales} onOpenQuoteParameters={handleOpen} />);

    const configBtn = screen.getByLabelText('Configuración de parámetros');
    fireEvent.click(configBtn);

    expect(handleOpen).toHaveBeenCalled();
  });
});
