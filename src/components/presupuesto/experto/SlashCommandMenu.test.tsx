import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SlashCommandMenu } from './SlashCommandMenu';
import { TareaTipo } from '../../../core/types';

describe('SlashCommandMenu Keyboard Navigation', () => {
  const mockTareas: TareaTipo[] = [
    {
      id: 'tt-1',
      nombre: 'Boca de Iluminación',
      categoria: 'bocas',
      unidad: 'u',
      insumos: [],
      manoObra: []
    },
    {
      id: 'tt-2',
      nombre: 'Tomacorriente',
      categoria: 'tomas',
      unidad: 'u',
      insumos: [],
      manoObra: []
    },
    {
      id: 'tt-3',
      nombre: 'Tablero Seccional',
      categoria: 'tableros',
      unidad: 'u',
      insumos: [],
      manoObra: []
    }
  ];

  it('navigates with ArrowDown, ArrowUp and Shift+Tab, and selects with Enter', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <SlashCommandMenu
        query=""
        contextType="general"
        currentIndent="  "
        tareasTipo={mockTareas}
        clientes={[]}
        isExplicit={false}
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    const itemButtons = Array.from(container.querySelectorAll('.space-y-0\\.5 button'));
    expect(itemButtons.length).toBeGreaterThan(1);

    // Initial state: item 0 selected
    expect(itemButtons[0].className).toContain('bg-primary');

    // Press ArrowDown: advances to item 1
    fireEvent.keyDown(window, { key: 'ArrowDown', code: 'ArrowDown' });
    expect(itemButtons[1].className).toContain('bg-primary');

    // Press Shift+Tab: goes back to item 0
    fireEvent.keyDown(window, { key: 'Tab', code: 'Tab', shiftKey: true });
    expect(itemButtons[0].className).toContain('bg-primary');

    // Press Shift+Tab again: wraps to last item
    fireEvent.keyDown(window, { key: 'Tab', code: 'Tab', shiftKey: true });
    expect(itemButtons[itemButtons.length - 1].className).toContain('bg-primary');

    // Press Enter: confirms selection because user navigated
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('selects immediately on Tab without prior navigation', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SlashCommandMenu
        query=""
        contextType="general"
        currentIndent="  "
        tareasTipo={mockTareas}
        clientes={[]}
        isExplicit={false}
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    // Press Tab: immediately selects active item
    fireEvent.keyDown(window, { key: 'Tab', code: 'Tab' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes without selecting when Enter is pressed without navigating and isExplicit is false', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SlashCommandMenu
        query=""
        contextType="general"
        currentIndent="  "
        tareasTipo={mockTareas}
        clientes={[]}
        isExplicit={false}
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    // Press Enter without navigating
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('selects immediately on Enter when isExplicit is true', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SlashCommandMenu
        query="/boca"
        contextType="general"
        currentIndent="  "
        tareasTipo={mockTareas}
        clientes={[]}
        isExplicit={true}
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    // Press Enter immediately
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
