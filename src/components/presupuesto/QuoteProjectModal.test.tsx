import { describe, it, expect, vi } from 'vitest';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QuoteProjectModal } from './QuoteProjectModal';
import { Contacto } from '../../core/types';
import { ToastProvider } from '../../contexts/ToastContext';

const render = (ui: React.ReactElement) => {
  return rtlRender(<ToastProvider>{ui}</ToastProvider>);
};

describe('QuoteProjectModal', () => {
  const mockClientes: Contacto[] = [
    {
      id: 'c-1',
      razonSocial: 'Empresa Constructora Norte',
      nombre: 'Empresa Constructora Norte',
      roles: ['cliente'],
      telefono: '11-4567-8900',
      email: 'contacto@constructora.com',
      cuit: '30-12345678-9',
      direccion: 'Av. Libertador 1000',
      createdAt: new Date().toISOString()
    }
  ];

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <QuoteProjectModal
        isOpen={false}
        onClose={vi.fn()}
        clientes={mockClientes}
        clienteId=""
        onSelectCliente={vi.fn()}
        direccionObra=""
        onUpdateDireccionObra={vi.fn()}
        validezDias={15}
        onUpdateValidezDias={vi.fn()}
        tipoFactura="Factura B"
        onUpdateTipoFactura={vi.fn()}
        condicionesPagoTexto=""
        onUpdateCondicionesPagoTexto={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders correctly when open and displays client, obra and billing controls', () => {
    render(
      <QuoteProjectModal
        isOpen={true}
        onClose={vi.fn()}
        clientes={mockClientes}
        clienteId="c-1"
        onSelectCliente={vi.fn()}
        direccionObra="Edificio Bellini - Piso 5"
        onUpdateDireccionObra={vi.fn()}
        validezDias={15}
        onUpdateValidezDias={vi.fn()}
        tipoFactura="Factura A"
        onUpdateTipoFactura={vi.fn()}
        condicionesPagoTexto="50% anticipo"
        onUpdateCondicionesPagoTexto={vi.fn()}
        numero="IEBA-2026-0001"
        revision={2}
      />
    );

    expect(screen.getByText('Configurar Cliente y Obra')).toBeDefined();
    expect(screen.getByText(/IEBA-2026-0001/)).toBeDefined();
    expect(screen.getByText('Empresa Constructora Norte')).toBeDefined();
    expect(screen.getByDisplayValue('Edificio Bellini - Piso 5')).toBeDefined();
  });

  it('calls onUpdateDireccionObra when input changes', () => {
    const onUpdateDireccionObra = vi.fn();
    render(
      <QuoteProjectModal
        isOpen={true}
        onClose={vi.fn()}
        clientes={mockClientes}
        clienteId="c-1"
        onSelectCliente={vi.fn()}
        direccionObra=""
        onUpdateDireccionObra={onUpdateDireccionObra}
        validezDias={15}
        onUpdateValidezDias={vi.fn()}
        tipoFactura="Factura B"
        onUpdateTipoFactura={vi.fn()}
        condicionesPagoTexto=""
        onUpdateCondicionesPagoTexto={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/Torre Bellini/i);
    fireEvent.change(input, { target: { value: 'Planta Industrial Quilmes' } });
    expect(onUpdateDireccionObra).toHaveBeenCalledWith('Planta Industrial Quilmes');
  });

  it('calls onUpdateValidezDias and onUpdateTipoFactura on option click', () => {
    const onUpdateValidezDias = vi.fn();
    const onUpdateTipoFactura = vi.fn();

    render(
      <QuoteProjectModal
        isOpen={true}
        onClose={vi.fn()}
        clientes={mockClientes}
        clienteId="c-1"
        onSelectCliente={vi.fn()}
        direccionObra=""
        onUpdateDireccionObra={vi.fn()}
        validezDias={15}
        onUpdateValidezDias={onUpdateValidezDias}
        tipoFactura="Factura B"
        onUpdateTipoFactura={onUpdateTipoFactura}
        condicionesPagoTexto=""
        onUpdateCondicionesPagoTexto={vi.fn()}
      />
    );

    // Click 30d pill
    const pill30 = screen.getByText('30d');
    fireEvent.click(pill30);
    expect(onUpdateValidezDias).toHaveBeenCalledWith(30);

    // Click Fact. A
    const btnFactA = screen.getByText('Fact. A');
    fireEvent.click(btnFactA);
    expect(onUpdateTipoFactura).toHaveBeenCalledWith('Factura A');
  });

  it('calls onClose when clicking Listo button', () => {
    const onClose = vi.fn();
    render(
      <QuoteProjectModal
        isOpen={true}
        onClose={onClose}
        clientes={mockClientes}
        clienteId="c-1"
        onSelectCliente={vi.fn()}
        direccionObra=""
        onUpdateDireccionObra={vi.fn()}
        validezDias={15}
        onUpdateValidezDias={vi.fn()}
        tipoFactura="Factura B"
        onUpdateTipoFactura={vi.fn()}
        condicionesPagoTexto=""
        onUpdateCondicionesPagoTexto={vi.fn()}
      />
    );

    const listoBtn = screen.getByText('Listo');
    fireEvent.click(listoBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
