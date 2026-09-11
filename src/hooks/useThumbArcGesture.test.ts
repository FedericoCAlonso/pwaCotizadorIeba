import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThumbArcGesture } from './useThumbArcGesture';

describe('useThumbArcGesture (Polar Engine & Vertical Gestures)', () => {
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
        sensitivityRad: 0.04,
        onStepChange
      })
    );

    act(() => {
      // Start at radius ~250px from pivot (400, 400) at angle -150 deg:
      // x = 400 - 216.5 = 184, y = 400 - 125 = 275
      result.current.handlers.onPointerDown(mockPointerEvent('down', 184, 275));
    });

    expect(result.current.isDragging).toBe(true);

    act(() => {
      // Move along arc to angle -120 deg:
      // x = 400 - 125 = 275, y = 400 - 216.5 = 184
      // deltaX = +91, deltaY = -91 (ratio = 1.0, not vertical swipe)
      result.current.handlers.onPointerMove(mockPointerEvent('move', 275, 184));
    });

    expect(onStepChange).toHaveBeenCalledWith(1);
    expect(result.current.lastGesture).toBe('inc');
  });

  it('triggers onStepChange(-1) when sweeping downward along arc for right hand', () => {
    const onStepChange = vi.fn();
    const { result } = renderHook(() =>
      useThumbArcGesture({
        handedness: 'right',
        sensitivityRad: 0.04,
        onStepChange
      })
    );

    act(() => {
      // Start at angle -120 deg
      result.current.handlers.onPointerDown(mockPointerEvent('down', 275, 184));
    });

    act(() => {
      // Move downward along arc to angle -150 deg:
      // deltaX = -91, deltaY = +91 (ratio = 1.0)
      result.current.handlers.onPointerMove(mockPointerEvent('move', 184, 275));
    });

    expect(onStepChange).toHaveBeenCalledWith(-1);
    expect(result.current.lastGesture).toBe('dec');
  });

  it('triggers onPrevField (retroceder) on vertical swipe UP', () => {
    const onPrevField = vi.fn();
    const onNextField = vi.fn();
    const onStepChange = vi.fn();
    const { result } = renderHook(() =>
      useThumbArcGesture({
        onPrevField,
        onNextField,
        onStepChange
      })
    );

    act(() => {
      result.current.handlers.onPointerDown(mockPointerEvent('down', 200, 250));
    });

    act(() => {
      // Swiping straight UP: deltaY is -50px, deltaX is 2px (ratio = 25.0, highly vertical)
      result.current.handlers.onPointerMove(mockPointerEvent('move', 202, 200));
    });

    expect(onPrevField).toHaveBeenCalledTimes(1);
    expect(onNextField).not.toHaveBeenCalled();
    expect(onStepChange).not.toHaveBeenCalled(); // No toca el valor del dial
    expect(result.current.lastGesture).toBe('prev');
  });

  it('triggers onNextField (avanzar) on vertical swipe DOWN', () => {
    const onPrevField = vi.fn();
    const onNextField = vi.fn();
    const onStepChange = vi.fn();
    const { result } = renderHook(() =>
      useThumbArcGesture({
        onPrevField,
        onNextField,
        onStepChange
      })
    );

    act(() => {
      result.current.handlers.onPointerDown(mockPointerEvent('down', 200, 150));
    });

    act(() => {
      // Swiping straight DOWN: deltaY is +50px, deltaX is 2px (ratio = 25.0, highly vertical)
      result.current.handlers.onPointerMove(mockPointerEvent('move', 202, 200));
    });

    expect(onNextField).toHaveBeenCalledTimes(1);
    expect(onPrevField).not.toHaveBeenCalled();
    expect(onStepChange).not.toHaveBeenCalled();
    expect(result.current.lastGesture).toBe('next');
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
