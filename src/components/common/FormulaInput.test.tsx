import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { FormulaInput } from './FormulaInput';

describe('FormulaInput', () => {
  it('muestra un atajo para insertar potencia en la barra de chips', () => {
    render(
      <FormulaInput
        value=""
        onChange={vi.fn()}
        variables={[{ id: 'bocas', nombre: 'Bocas' }]}
      />
    );

    expect(screen.getByRole('button', { name: /^\^$/i })).toBeDefined();
  });
});
