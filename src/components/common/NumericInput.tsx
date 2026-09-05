import React, { useState, useEffect, useRef } from 'react';

export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'prefix'> {
  value: number | null | undefined;
  onChange: (val: number | null) => void;
  fallbackOnBlur?: number | null;
  min?: number;
  max?: number;
  decimals?: number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  wrapperClassName?: string;
  allowNegative?: boolean;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  fallbackOnBlur,
  min,
  max,
  decimals,
  prefix,
  suffix,
  className = '',
  wrapperClassName = '',
  allowNegative = false,
  onBlur,
  onFocus,
  disabled,
  placeholder = '0',
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localText, setLocalText] = useState<string>(() => {
    return value !== null && value !== undefined && !isNaN(value) ? String(value) : '';
  });

  const prevValueRef = useRef(value);

  // Sincronizar desde la prop externa únicamente cuando cambia y el input no está en foco activo
  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (!isFocused) {
        setLocalText(value !== null && value !== undefined && !isNaN(value) ? String(value) : '');
      }
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (disabled) return;
    setIsFocused(true);
    setLocalText(value !== null && value !== undefined && !isNaN(value) ? String(value) : '');
    onFocus?.(e);
    try {
      e.target.select();
    } catch {
      // noop
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalText(raw);

    const trimmed = raw.trim().replace(',', '.');
    if (trimmed === '' || trimmed === '-' || trimmed === '.') {
      onChange(null);
      return;
    }

    const num = Number(trimmed);
    if (!isNaN(num)) {
      if (!allowNegative && num < 0) {
        onChange(0);
      } else {
        onChange(num);
      }
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const trimmed = localText.trim().replace(',', '.');

    if (trimmed === '' || isNaN(Number(trimmed))) {
      if (fallbackOnBlur !== undefined && fallbackOnBlur !== null) {
        setLocalText(String(fallbackOnBlur));
        onChange(fallbackOnBlur);
      } else {
        setLocalText('');
        onChange(null);
      }
    } else {
      let finalNum = Number(trimmed);
      if (!allowNegative && finalNum < 0) finalNum = 0;
      if (min !== undefined) finalNum = Math.max(min, finalNum);
      if (max !== undefined) finalNum = Math.min(max, finalNum);
      if (decimals !== undefined) {
        finalNum = Number(finalNum.toFixed(decimals));
      }
      setLocalText(String(finalNum));
      onChange(finalNum);
    }

    onBlur?.(e);
  };

  const hasDecoration = Boolean(prefix || suffix);

  const inputElement = (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={localText}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={`font-mono transition-shadow ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-7' : ''} ${className}`}
      {...rest}
    />
  );

  if (!hasDecoration && !wrapperClassName) {
    return inputElement;
  }

  return (
    <div className={`relative inline-flex items-center w-full ${wrapperClassName}`}>
      {prefix && (
        <span className="absolute left-3 text-xs text-on-surface-variant font-medium pointer-events-none z-10">
          {prefix}
        </span>
      )}
      {inputElement}
      {suffix && (
        <span className="absolute right-2.5 text-xs text-on-surface-variant font-medium pointer-events-none z-10">
          {suffix}
        </span>
      )}
    </div>
  );
};
