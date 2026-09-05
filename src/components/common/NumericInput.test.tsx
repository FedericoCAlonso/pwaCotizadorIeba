import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { NumericInput } from './NumericInput';

describe('NumericInput - Clearing and Null Handling', () => {
  it('permite borrar completamente el campo emitiendo null sin forzar 0 inmediatamente', () => {
    const onChange = vi.fn();
    render(<NumericInput value={15} onChange={onChange} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('15');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });

    expect(input.value).toBe('');
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('aplica fallbackOnBlur al perder foco solo si quedó vacío', () => {
    const onChange = vi.fn();
    render(<NumericInput value={null} onChange={onChange} fallbackOnBlur={15} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');

    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(input.value).toBe('15');
    expect(onChange).toHaveBeenCalledWith(15);
  });

  it('permite escribir decimales sin clamplear durante el tipeo', () => {
    const onChange = vi.fn();
    render(<NumericInput value={null} onChange={onChange} min={1} max={100} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.focus(input);

    // Escribir 0.5 (aunque min sea 1, al tipear 0. no debe trabarse ni forzar 1)
    fireEvent.change(input, { target: { value: '0.' } });
    expect(input.value).toBe('0.');

    fireEvent.change(input, { target: { value: '0.5' } });
    expect(input.value).toBe('0.5');

    // Al salir de foco, se aplica el clamp a min=1
    fireEvent.blur(input);
    expect(input.value).toBe('1');
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('soporta prefijo y sufijo visuales', () => {
    const { container } = render(
      <NumericInput value={100} onChange={vi.fn()} prefix="$" suffix="%" />
    );

    expect(container.textContent).toContain('$');
    expect(container.textContent).toContain('%');
  });
});
