import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThumbArcGesture } from './useThumbArcGesture';

describe('useThumbArcGesture (Polar Engine)', () => {
  beforeEach(() => {
    navigator.vibrate = vi.fn();
  });

  const mockPointerEvent = (type: string, clientX: number, clientY: number, pointerId = 1) => {
    return {
      clientX,
      clientY,
      pointerId,
      currentTarget: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 400,
          height: 400,
          right: 400,
          bottom: 400
        }),
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn()
      }
    } as unknown as React.PointerEvent;
  };

  it('initializes with default handedness right', () => {
    const { result } = renderHook(() => useThumbArcGesture());
    expect(result.current.handedness).toBe('right');
    expect(result.current.isDragging).toBe(false);
  });

  it('toggles handedness correctly', () => {
    const { result } = renderHook(() => useThumbArcGesture({ handedness: 'right' }));
    act(() => {
      result.current.toggleHandedness();
    });
    expect(result.current.handedness).toBe('left');
  });

  it('triggers onStepChange(1) when sweeping upward along arc for right hand', () => {
    const onStepChange = vi.fn();
    const { result } = renderHook(() =>
      useThumbArcGesture({
        handedness: 'right',
        sensitivityRad: 0.05,
        onStepChange
      })
    );

    act(() => {
      // Start near horizontal left of pivot (400, 400)
      result.current.handlers.onPointerDown(mockPointerEvent('down', 200, 380));
    });

    expect(result.current.isDragging).toBe(true);

    act(() => {
      // Move upward along the arc towards top
      result.current.handlers.onPointerMove(mockPointerEvent('move', 220, 240));
    });

    expect(onStepChange).toHaveBeenCalledWith(1);
    expect(result.current.lastGesture).toBe('inc');
  });

  it('triggers onStepChange(-1) when sweeping downward along arc for right hand', () => {
    const onStepChange = vi.fn();
    const { result } = renderHook(() =>
      useThumbArcGesture({
        handedness: 'right',
        sensitivityRad: 0.05,
        onStepChange
      })
    );

    act(() => {
      // Start higher up on the arc
      result.current.handlers.onPointerDown(mockPointerEvent('down', 220, 240));
    });

    act(() => {
      // Move downward towards horizontal bottom
      result.current.handlers.onPointerMove(mockPointerEvent('move', 200, 380));
    });

    expect(onStepChange).toHaveBeenCalledWith(-1);
    expect(result.current.lastGesture).toBe('dec');
  });

  it('resets isDragging on pointerUp', () => {
    const { result } = renderHook(() => useThumbArcGesture());

    act(() => {
      result.current.handlers.onPointerDown(mockPointerEvent('down', 200, 200));
    });
    expect(result.current.isDragging).toBe(true);

    act(() => {
      result.current.handlers.onPointerUp(mockPointerEvent('up', 200, 200));
    });
    expect(result.current.isDragging).toBe(false);
  });
});
