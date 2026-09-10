import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MathInput } from './MathInput';

describe('MathInput - Mobile Usability & Live Typing', () => {
  it('renderiza con inputMode="decimal" por defecto y permite escribir números inmediatamente', () => {
    const onChange = vi.fn();
    render(
      <MathInput
        value={4}
        onChange={onChange}
        suffix="hs"
        size="sm"
      />
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.getAttribute('inputmode')).toBe('decimal');
    expect(input.value).toBe('4');

    // Al escribir un número nuevo directamente, actualiza en vivo al padre
    fireEvent.change(input, { target: { value: '8' } });
    expect(input.value).toBe('8');
    expect(onChange).toHaveBeenCalledWith(8, undefined);
  });

  it('soporta coma decimal convirtiéndola a punto y actualizando el valor numérico', () => {
    const onChange = vi.fn();
    render(
      <MathInput
        value={2}
        onChange={onChange}
        suffix="hs"
        size="sm"
      />
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '3,5' } });
    expect(onChange).toHaveBeenCalledWith(3.5, undefined);
  });

  it('aplica padding derecho reducido cuando solo tiene suffix corto (hs)', () => {
    const { container } = render(
      <MathInput
        value={4}
        onChange={vi.fn()}
        suffix="hs"
        size="sm"
      />
    );

    const input = container.querySelector('input')!;
    // Debe tener pr-6 (24px) y NO pr-14 (56px) para no aplastar el área de escritura
    expect(input.className).toContain('pr-6');
    expect(input.className).not.toContain('pr-14');
  });

  it('evalúa fórmulas matemáticas en handleCommit (onBlur o Enter)', () => {
    const onChange = vi.fn();
    render(
      <MathInput
        value={0}
        onChange={onChange}
        size="sm"
      />
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2 * 3.5' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(7, '2 * 3.5');
    expect(input.value).toBe('7');
  });

  it('permite borrar completamente el campo emitiendo null sin bloquear el tipeo ni clamplear prematuramente', () => {
    const onChange = vi.fn();
    render(
      <MathInput
        value={10}
        onChange={onChange}
        min={1}
        size="sm"
      />
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });

    expect(input.value).toBe('');
    expect(onChange).toHaveBeenCalledWith(null, undefined);

    // Escribir 0.5: no debe clamplear a min=1 durante el tipeo
    fireEvent.change(input, { target: { value: '0.5' } });
    expect(input.value).toBe('0.5');
    expect(onChange).toHaveBeenCalledWith(0.5, undefined);
  });

  it('permite asignar una variable del scope como fórmula en el campo de cantidad', () => {
    const onChange = vi.fn();
    render(
      <MathInput
        value={1}
        onChange={onChange}
        allowFormula
        scope={{ bocas: 4 }}
        size="sm"
      />
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'bocas' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(4, 'bocas');
    expect(input.value).toBe('4');
  });

  it('aplica fallbackOnBlur al perder foco solo si quedó vacío', () => {
    const onChange = vi.fn();
    render(
      <MathInput
        value={null}
        onChange={onChange}
        fallbackOnBlur={1}
        size="sm"
      />
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(1, undefined);
    expect(input.value).toBe('1');
  });
});
