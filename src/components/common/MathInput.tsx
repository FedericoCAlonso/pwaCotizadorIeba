import React, { useState, useEffect, useRef } from 'react';
import { Calculator, Sparkles } from 'lucide-react';
import { evaluateMathExpression, isFormulaString } from '../../core/mathEvaluator';

export interface MathInputProps {
  value: number;
  onChange: (val: number, formula?: string) => void;
  formula?: string;
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
}

export const MathInput: React.FC<MathInputProps> = ({
  value,
  onChange,
  formula,
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
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [currentText, setCurrentText] = useState<string>(() => {
    return formula || (value !== undefined && value !== null ? String(value) : '');
  });
  const [lastSavedFormula, setLastSavedFormula] = useState<string | undefined>(formula);
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize when external value or formula changes while not editing
  useEffect(() => {
    if (!isFocused) {
      if (formula) {
        setLastSavedFormula(formula);
      }
      setCurrentText(value !== undefined && value !== null ? String(value) : '');
    }
  }, [value, formula, isFocused]);

  // Live evaluation while typing
  const evalResult = isFocused && isFormulaString(currentText)
    ? evaluateMathExpression(currentText)
    : null;

  const handleFocus = () => {
    if (disabled) return;
    setIsFocused(true);
    // If a formula was previously recorded, display the formula for easy re-editing
    if (lastSavedFormula) {
      setCurrentText(lastSavedFormula);
    } else {
      setCurrentText(value !== undefined && value !== null ? String(value) : '');
    }
  };

  const handleCommit = () => {
    setIsFocused(false);
    const trimmed = currentText.trim();

    if (!trimmed) {
      const fallback = min !== undefined ? min : 0;
      setLastSavedFormula(undefined);
      setCurrentText(String(fallback));
      onChange(fallback, undefined);
      return;
    }

    const res = evaluateMathExpression(trimmed);

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
      // If formula was broken, keep previous safe value
      setCurrentText(value !== undefined ? String(value) : '0');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsFocused(false);
      setCurrentText(value !== undefined ? String(value) : '');
      inputRef.current?.blur();
    }
  };

  const hasFormula = Boolean(lastSavedFormula);

  const sizeClasses = {
    sm: 'text-xs py-1 px-2 min-h-[32px]',
    md: 'text-xs sm:text-sm py-1.5 px-3 min-h-[40px]',
    lg: 'text-sm sm:text-base py-2.5 px-3.5 min-h-[46px]',
  }[size];

  return (
    <div className="relative inline-flex items-center w-full group">
      {prefix && (
        <span className="absolute left-3 text-xs text-on-surface-variant font-medium pointer-events-none z-10">
          {prefix}
        </span>
      )}

      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="text"
        value={isFocused ? currentText : (value !== undefined && value !== null ? String(value) : '')}
        onChange={(e) => setCurrentText(e.target.value)}
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
        } ${prefix ? 'pl-7' : ''} ${suffix || hasFormula ? 'pr-14' : ''} ${className}`}
      />

      {/* Right Indicator: Formula Badge & Suffix */}
      <div className="absolute right-2 flex items-center gap-1 pointer-events-none z-10">
        {/* Has formula indicator pill */}
        {!isFocused && hasFormula && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 flex items-center gap-0.5"
            title={`Calculado por fórmula: ${lastSavedFormula}`}
          >
            <span className="italic font-serif font-bold">fx</span>
          </span>
        )}

        {/* Suffix (e.g. mts, un, hs) */}
        {suffix && (
          <span className="text-[10px] sm:text-xs text-on-surface-variant font-mono font-medium">
            {suffix}
          </span>
        )}
      </div>

      {/* Live Result Tooltip Chip (while actively typing a formula) */}
      {isFocused && evalResult && evalResult.isValid && evalResult.value !== null && (
        <div className="absolute left-0 bottom-full mb-1 z-30 px-2.5 py-1 bg-surface-container-highest border border-primary/40 text-primary shadow-lg rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100">
          <Sparkles className="w-3 h-3 text-primary" />
          <span>= {evalResult.value}</span>
          {suffix && <span className="text-[10px] opacity-80">{suffix}</span>}
        </div>
      )}
    </div>
  );
};
