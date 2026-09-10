import React, { useState, useEffect, useRef } from 'react';
import { Calculator, Sparkles } from 'lucide-react';
import { evaluateMathExpression, isFormulaString } from '../../core/mathEvaluator';

export interface MathInputProps {
  value: number | null | undefined;
  onChange: (val: number | null, formula?: string) => void;
  formula?: string;
  allowFormula?: boolean;
  scope?: Record<string, number | boolean>;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number | string;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
  id?: string;
  size?: 'sm' | 'md' | 'lg';
  inputMode?: 'text' | 'decimal' | 'numeric';
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  fallbackOnBlur?: number | null;
}

export const MathInput: React.FC<MathInputProps> = ({
  value,
  onChange,
  formula,
  allowFormula = false,
  scope,
  placeholder = '0',
  min,
  max,
  step,
  decimals,
  suffix,
  prefix,
  className = '',
  disabled = false,
  autoFocus = false,
  ariaLabel,
  id,
  size = 'md',
  inputMode = 'decimal',
  onKeyDown,
  fallbackOnBlur,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [currentText, setCurrentText] = useState<string>(() => {
    return formula || (value !== undefined && value !== null ? String(value) : '');
  });
  const [lastSavedFormula, setLastSavedFormula] = useState<string | undefined>(formula);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevPropValueRef = useRef(value);
  const prevPropFormulaRef = useRef(formula);

  // Synchronize ONLY when external prop value or formula actually changes from parent
  useEffect(() => {
    if (formula !== prevPropFormulaRef.current) {
      prevPropFormulaRef.current = formula;
      setLastSavedFormula(formula);
      if (!isFocused && formula) {
        setCurrentText(formula);
      }
    }

    if (value !== prevPropValueRef.current) {
      prevPropValueRef.current = value;
      if (!isFocused) {
        setCurrentText(value !== undefined && value !== null ? String(value) : '');
      }
    }
  }, [value, formula, isFocused]);

  // Live evaluation while typing
  const evalResult = isFocused && isFormulaString(currentText)
    ? evaluateMathExpression(currentText, scope)
    : null;

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (disabled) return;
    setIsFocused(true);
    // If a formula was previously recorded, display the formula for easy re-editing
    if (lastSavedFormula) {
      setCurrentText(lastSavedFormula);
    } else {
      setCurrentText(value !== undefined && value !== null ? String(value) : '');
    }
    // Auto-select text on focus so user can immediately type a new number
    try {
      e.target.select();
    } catch {
      // ignore
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCurrentText(raw);

    const trimmed = raw.trim().replace(',', '.');
    if (!trimmed) {
      setLastSavedFormula(undefined);
      onChange(null, undefined);
      return;
    }

    // If it's a simple number (not an in-progress math formula), sync immediately with parent
    if (!isFormulaString(trimmed)) {
      const num = Number(trimmed);
      if (!isNaN(num)) {
        // NOTE: We deliberately DO NOT clamp with `min` or round `decimals` during live typing.
        // E.g., if min=1, typing "0.5" begins with "0", which would get clamped to 1!
        // Clamping min/max and formatting decimals is safely handled upon commit (blur / Enter).
        setLastSavedFormula(undefined);
        onChange(num, undefined);
      }
    }
  };

  const handleCommit = () => {
    setIsFocused(false);
    const trimmed = currentText.trim().replace(',', '.');

    if (!trimmed) {
      const fallback = fallbackOnBlur !== undefined ? fallbackOnBlur : null;
      setLastSavedFormula(undefined);
      setCurrentText(fallback !== null && fallback !== undefined ? String(fallback) : '');
      onChange(fallback, undefined);
      return;
    }

    const res = evaluateMathExpression(trimmed, scope);

    if (res.isValid && res.value !== null) {
      let finalVal = res.value;
      if (min !== undefined) finalVal = Math.max(min, finalVal);
      if (max !== undefined) finalVal = Math.min(max, finalVal);
      if (decimals !== undefined) {
        finalVal = Number(finalVal.toFixed(decimals));
      }

      if (res.isFormula) {
        setLastSavedFormula(trimmed);
        onChange(finalVal, trimmed);
      } else {
        setLastSavedFormula(undefined);
        onChange(finalVal, undefined);
      }
      setCurrentText(String(finalVal));
    } else {
      // If formula was broken, keep previous safe value or empty
      setCurrentText(value !== undefined && value !== null ? String(value) : '');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
      inputRef.current?.blur();
      onKeyDown?.(e);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsFocused(false);
      setCurrentText(value !== undefined ? String(value) : '');
      inputRef.current?.blur();
      onKeyDown?.(e);
    } else {
      onKeyDown?.(e);
    }
  };

  const hasFormula = Boolean(lastSavedFormula);

  const sizeClasses = {
    sm: 'text-sm py-1.5 px-3 min-h-[40px] font-semibold',
    md: 'text-sm sm:text-base py-2 px-3.5 min-h-[44px]',
    lg: 'text-base sm:text-lg py-2.5 px-4 min-h-[48px]',
  }[size];

  const rightPaddingClass = (() => {
    if (hasFormula && suffix) return 'pr-12';
    if (hasFormula) return 'pr-9';
    if (suffix) {
      return suffix.length <= 2 ? 'pr-6' : 'pr-9';
    }
    return 'pr-2.5';
  })();

  return (
    <div className="relative inline-flex items-center w-full group">
      {prefix && (
        <span className="absolute left-3 text-sm text-on-surface-variant font-medium pointer-events-none z-10">
          {prefix}
        </span>
      )}

      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode={inputMode}
        value={currentText}
        onChange={handleTextChange}
        onFocus={handleFocus}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        title={hasFormula ? `Fórmula calculada: ${lastSavedFormula} = ${value}` : undefined}
        className={`w-full bg-surface-container-high border rounded-xl font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all ${sizeClasses} ${
          hasFormula
            ? 'border-primary/40 bg-primary-container/10'
            : 'border-outline-variant/30 hover:border-outline-variant/50'
        } ${prefix ? 'pl-7' : ''} ${rightPaddingClass} ${className}`}
      />

      {/* Right Indicator: Formula Badge & Suffix */}
      <div className="absolute right-2 flex items-center gap-1 pointer-events-none z-10">
        {/* Has formula indicator pill */}
        {!isFocused && hasFormula && (
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 flex items-center gap-0.5"
            title={`Calculado por fórmula: ${lastSavedFormula}`}
          >
            <span className="italic font-serif font-bold">fx</span>
          </span>
        )}

        {/* Suffix (e.g. mts, un, hs) */}
        {suffix && (
          <span className="text-sm text-on-surface-variant font-mono font-medium">
            {suffix}
          </span>
        )}
      </div>

      {/* Live Result Tooltip Chip (while actively typing a formula) */}
      {isFocused && evalResult && evalResult.isValid && evalResult.value !== null && (
        <div className="absolute left-0 bottom-full mb-1 z-30 px-2.5 py-1 bg-surface-container-highest border border-primary/40 text-primary shadow-lg rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100">
          <Sparkles className="w-3 h-3 text-primary" />
          <span>= {evalResult.value}</span>
          {suffix && <span className="text-xs opacity-80">{suffix}</span>}
        </div>
      )}
    </div>
  );
};
