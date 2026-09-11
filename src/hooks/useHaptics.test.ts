import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHaptics } from './useHaptics';

describe('useHaptics', () => {
  const originalVibrate = navigator.vibrate;

  beforeEach(() => {
    navigator.vibrate = vi.fn();
  });

  afterEach(() => {
    navigator.vibrate = originalVibrate;
  });

  it('reports isSupported true when navigator.vibrate exists', () => {
    const { result } = renderHook(() => useHaptics());
    expect(result.current.isSupported).toBe(true);
  });

  it('triggers tick with 10ms vibration', () => {
    const { result } = renderHook(() => useHaptics());
    result.current.tick();
    expect(navigator.vibrate).toHaveBeenCalledWith(10);
  });

  it('triggers success with multi-pulse pattern', () => {
    const { result } = renderHook(() => useHaptics());
    result.current.success();
    expect(navigator.vibrate).toHaveBeenCalledWith([20, 50, 30]);
  });
});
