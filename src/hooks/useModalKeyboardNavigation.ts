import { useEffect, useRef } from 'react';

interface UseModalKeyboardNavigationOptions {
  isOpen: boolean;
  autoFocusFirst?: boolean;
}

export function useModalKeyboardNavigation(options: UseModalKeyboardNavigationOptions) {
  const { isOpen, autoFocusFirst = true } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const getFocusableElements = (): HTMLElement[] => {
      if (!containerRef.current) return [];
      const selector = [
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'button:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(', ');
      return Array.from(containerRef.current.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => el.offsetParent !== null
      );
    };

    const getFormFields = (): HTMLElement[] => {
      if (!containerRef.current) return [];
      const selector = [
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])'
      ].join(', ');
      return Array.from(containerRef.current.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => el.offsetParent !== null
      );
    };

    if (autoFocusFirst) {
      const timer = setTimeout(() => {
        const fields = getFormFields();
        if (fields.length > 0) {
          fields[0].focus();
          if ('select' in fields[0] && typeof (fields[0] as HTMLInputElement).select === 'function') {
            (fields[0] as HTMLInputElement).select();
          }
        } else {
          const focusables = getFocusableElements();
          if (focusables.length > 0) {
            focusables[0].focus();
          }
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoFocusFirst]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || !containerRef.current) return;

    const getFocusableElements = (): HTMLElement[] => {
      if (!containerRef.current) return [];
      const selector = [
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'button:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(', ');
      return Array.from(containerRef.current.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => el.offsetParent !== null
      );
    };

    const getFormFields = (): HTMLElement[] => {
      if (!containerRef.current) return [];
      const selector = [
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])'
      ].join(', ');
      return Array.from(containerRef.current.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => el.offsetParent !== null
      );
    };

    // Enter key: advance to next input/select
    if (e.key === 'Enter') {
      const activeEl = document.activeElement as HTMLElement;
      const isInput = activeEl && activeEl.tagName === 'INPUT';
      const isSelect = activeEl && activeEl.tagName === 'SELECT';

      // Do not intercept Enter on buttons or textarea
      if (isInput || isSelect) {
        const fields = getFormFields();
        const currentIndex = fields.indexOf(activeEl);

        if (currentIndex >= 0 && currentIndex < fields.length - 1) {
          e.preventDefault();
          const nextField = fields[currentIndex + 1];
          nextField.focus();
          if ('select' in nextField && typeof (nextField as HTMLInputElement).select === 'function') {
            (nextField as HTMLInputElement).select();
          }
        }
      }
    }

    // Tab key: Focus trap inside modal
    if (e.key === 'Tab') {
      const focusables = getFocusableElements();
      if (focusables.length === 0) return;

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement;

      if (e.shiftKey) {
        // Shift + Tab: if on first element, wrap to last
        if (activeEl === firstEl || !containerRef.current.contains(activeEl)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (activeEl === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  };

  return { containerRef, handleKeyDown };
}
