import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThumbArcGesture } from './useThumbArcGesture';

describe('useThumbArcGesture', () => {
  beforeEach(() => {
    navigator.vibrate = vi.fn();
  });

  const mockPointerEvent = (type: string, clientX: number, clientY: number, pointerId = 1) => {
    return {
      clientX,
      clientY,
      pointerId,
      currentTarget: {
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

  it('triggers onStepChange(1) when dragged right/up past sensitivity', () => {
    const onStepChange = vi.fn();
    const { result } = renderHook(() =>
      useThumbArcGesture({
        sensitivityPx: 15,
        onStepChange
      })
    );

    act(() => {
      result.current.handlers.onPointerDown(mockPointerEvent('down', 100, 100));
    });

    expect(result.current.isDragging).toBe(true);

    act(() => {
      result.current.handlers.onPointerMove(mockPointerEvent('move', 130, 95));
    });

    expect(onStepChange).toHaveBeenCalledWith(1);
    expect(result.current.lastGesture).toBe('inc');
  });

  it('triggers onStepChange(-1) when dragged left past sensitivity', () => {
    const onStepChange = vi.fn();
    const { result } = renderHook(() =>
      useThumbArcGesture({
        sensitivityPx: 15,
        onStepChange
      })
    );

    act(() => {
      result.current.handlers.onPointerDown(mockPointerEvent('down', 100, 100));
    });

    act(() => {
      result.current.handlers.onPointerMove(mockPointerEvent('move', 70, 105));
    });

    expect(onStepChange).toHaveBeenCalledWith(-1);
    expect(result.current.lastGesture).toBe('dec');
  });

  it('triggers onNextField on vertical swipe up', () => {
    const onNextField = vi.fn();
    const { result } = renderHook(() =>
      useThumbArcGesture({
        onNextField
      })
    );

    act(() => {
      result.current.handlers.onPointerDown(mockPointerEvent('down', 100, 200));
    });

    act(() => {
      // Swiping up: deltaY is -60px, deltaX is 5px
      result.current.handlers.onPointerMove(mockPointerEvent('move', 105, 140));
    });

    expect(onNextField).toHaveBeenCalledTimes(1);
    expect(result.current.lastGesture).toBe('next');
  });

  it('triggers onPrevField on vertical swipe down', () => {
    const onPrevField = vi.fn();
    const { result } = renderHook(() =>
      useThumbArcGesture({
        onPrevField
      })
    );

    act(() => {
      result.current.handlers.onPointerDown(mockPointerEvent('down', 100, 100));
    });

    act(() => {
      // Swiping down: deltaY is +60px, deltaX is 2px
      result.current.handlers.onPointerMove(mockPointerEvent('move', 102, 160));
    });

    expect(onPrevField).toHaveBeenCalledTimes(1);
    expect(result.current.lastGesture).toBe('prev');
  });

  it('resets isDragging on pointerUp', () => {
    const { result } = renderHook(() => useThumbArcGesture());

    act(() => {
      result.current.handlers.onPointerDown(mockPointerEvent('down', 100, 100));
    });
    expect(result.current.isDragging).toBe(true);

    act(() => {
      result.current.handlers.onPointerUp(mockPointerEvent('up', 100, 100));
    });
    expect(result.current.isDragging).toBe(false);
  });
});
