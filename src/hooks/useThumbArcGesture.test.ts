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
      // Start at radius 200px from pivot (400, 400) at angle -170 deg:
      // dx = -197, dy = -35 -> clientX = 203, clientY = 365
      result.current.handlers.onPointerDown(mockPointerEvent('down', 203, 365));
    });

    expect(result.current.isDragging).toBe(true);

    act(() => {
      // Move along arc: same radius ~200px, but angle -145 deg:
      // dx = -164, dy = -115 -> clientX = 236, clientY = 285
      result.current.handlers.onPointerMove(mockPointerEvent('move', 236, 285));
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
      // Start higher up along arc: radius 200px at angle -145 deg
      result.current.handlers.onPointerDown(mockPointerEvent('down', 236, 285));
    });

    act(() => {
      // Move down along arc: same radius ~200px, angle -170 deg
      result.current.handlers.onPointerMove(mockPointerEvent('move', 203, 365));
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
      // Swiping straight UP: deltaY is -55px, deltaX is 2px, radius changes by 35px
      result.current.handlers.onPointerMove(mockPointerEvent('move', 202, 195));
    });

    expect(onPrevField).toHaveBeenCalledTimes(1);
    expect(onNextField).not.toHaveBeenCalled();
    expect(onStepChange).not.toHaveBeenCalled();
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
      // Swiping straight DOWN: deltaY is +55px, deltaX is 2px, radius changes by 35px
      result.current.handlers.onPointerMove(mockPointerEvent('move', 202, 205));
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
