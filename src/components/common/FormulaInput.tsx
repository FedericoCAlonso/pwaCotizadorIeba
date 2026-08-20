import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Sparkles } from 'lucide-react';

export interface FormulaSuggestionItem {
  id: string;
  label: string;
  type: 'param' | 'var' | 'func' | 'op' | 'value';
  detail?: string;
  insertTemplate?: string;
}

const BUILTIN_FUNCTIONS: FormulaSuggestionItem[] = [
  { id: 'si', label: 'si(cond, v1, v2)', type: 'func', detail: 'Condicional tipo Excel', insertTemplate: 'si(, , )' },
  { id: 'if', label: 'if(cond, v1, v2)', type: 'func', detail: 'Condicional lógico', insertTemplate: 'if(, , )' },
  { id: 'ceil', label: 'ceil(x) / techo', type: 'func', detail: 'Redondeo hacia arriba', insertTemplate: 'ceil()' },
  { id: 'floor', label: 'floor(x) / piso', type: 'func', detail: 'Redondeo hacia abajo', insertTemplate: 'floor()' },
  { id: 'round', label: 'round(x, dec)', type: 'func', detail: 'Redondear con decimales', insertTemplate: 'round(, 2)' },
  { id: 'int', label: 'int(x) / trunc', type: 'func', detail: 'Parte entera', insertTemplate: 'int()' },
  { id: 'min', label: 'min(a, b, ...)', type: 'func', detail: 'Valor mínimo', insertTemplate: 'min(, )' },
  { id: 'max', label: 'max(a, b, ...)', type: 'func', detail: 'Valor máximo', insertTemplate: 'max(, )' },
  { id: 'abs', label: 'abs(x)', type: 'func', detail: 'Valor absoluto', insertTemplate: 'abs()' },
  { id: 'sqrt', label: 'sqrt(x) / raiz', type: 'func', detail: 'Raíz cuadrada', insertTemplate: 'sqrt()' },
];

const BUILTIN_OPERATORS: FormulaSuggestionItem[] = [
  { id: 'and', label: 'and (&&)', type: 'op', detail: 'Operador Y lógico', insertTemplate: ' and ' },
  { id: 'or', label: 'or (||)', type: 'op', detail: 'Operador O lógico', insertTemplate: ' or ' },
  { id: 'not', label: 'not (!)', type: 'op', detail: 'Negación lógica', insertTemplate: 'not ' },
];

export interface FormulaInputProps {
  value?: string | number | null;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  parametros?: Array<{ id: string; nombre: string; unidad?: string }>;
  variables?: Array<{ id: string; nombre: string; unidad?: string }>;
  attributeValues?: string[];
  showChips?: boolean;
  isCondition?: boolean;
  required?: boolean;
}

export const FormulaInput: React.FC<FormulaInputProps> = ({
  value = '',
  onChange,
  placeholder = 'ej: 4 + ceil(circuitos / 2) * 2',
  className = '',
  parametros = [],
  variables = [],
  attributeValues = [],
  showChips = true,
  required = false,
}) => {
  const strValue = value !== undefined && value !== null ? String(value) : '';
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [suggestions, setSuggestions] = useState<FormulaSuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeWordRange, setActiveWordRange] = useState<{ start: number; end: number } | null>(null);

  // Pool consolidado de sugerencias
  const allSuggestions = useMemo<FormulaSuggestionItem[]>(() => {
    const list: FormulaSuggestionItem[] = [];

    // Valores de catálogo para el atributo actual (si aplica)
    attributeValues.forEach((val) => {
      if (val && !list.some((item) => item.id.toLowerCase() === val.toLowerCase())) {
        list.push({
          id: val,
          label: val,
          type: 'value',
          detail: 'Valor en catálogo',
          insertTemplate: val,
        });
      }
    });

    // Parámetros de entrada
    parametros.forEach((p) => {
      if (p.id) {
        list.push({
          id: p.id,
          label: p.nombre || p.id,
          type: 'param',
          detail: p.unidad ? `Parámetro (${p.unidad})` : 'Parámetro de entrada',
          insertTemplate: p.id,
        });
      }
    });

    // Variables calculadas
    variables.forEach((v) => {
      if (v.id) {
        list.push({
          id: v.id,
          label: v.nombre || v.id,
          type: 'var',
          detail: v.unidad ? `Variable (${v.unidad})` : 'Variable calculada',
          insertTemplate: v.id,
        });
      }
    });

    // Funciones matemáticas y operadores
    list.push(...BUILTIN_FUNCTIONS);
    list.push(...BUILTIN_OPERATORS);

    return list;
  }, [parametros, variables, attributeValues]);

  // Ajuste automático de altura de textarea (Auto-grow)
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.max(28, textarea.scrollHeight);
    textarea.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [strValue, adjustHeight]);

  // Detección de palabra bajo el cursor para IntelliSense
  const updateSuggestions = useCallback(
    (text: string, cursorPos: number) => {
      const textBeforeCursor = text.slice(0, cursorPos);
      const match = textBeforeCursor.match(/[a-zA-Z0-9_]+$/);

      if (!match) {
        setShowSuggestions(false);
        setSuggestions([]);
        setActiveWordRange(null);
        return;
      }

      const word = match[0];
      const wordStart = cursorPos - word.length;
      const lower = word.toLowerCase();

      const matched = allSuggestions.filter(
        (item) =>
          item.id.toLowerCase().startsWith(lower) ||
          item.label.toLowerCase().includes(lower)
      );

      if (matched.length > 0) {
        setSuggestions(matched);
        setSelectedIndex(0);
        setShowSuggestions(true);
        setActiveWordRange({ start: wordStart, end: cursorPos });
      } else {
        setShowSuggestions(false);
        setSuggestions([]);
        setActiveWordRange(null);
      }
    },
    [allSuggestions]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    onChange(newVal);
    updateSuggestions(newVal, e.target.selectionStart || 0);
  };

  const handleSelectSuggestion = (item: FormulaSuggestionItem) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    let before = '';
    let after = '';
    let newCursorPos = 0;

    const template = item.insertTemplate || item.id;

    if (activeWordRange) {
      before = strValue.slice(0, activeWordRange.start);
      after = strValue.slice(activeWordRange.end);
    } else {
      const pos = textarea.selectionStart || strValue.length;
      before = strValue.slice(0, pos);
      after = strValue.slice(pos);
    }

    const newValue = `${before}${template}${after}`;
    onChange(newValue);

    // Calcular posición óptima del cursor
    if (template.endsWith('()')) {
      newCursorPos = before.length + template.length - 1; // dentro de ()
    } else if (template.includes('(, )') || template.includes('(, , )')) {
      newCursorPos = before.length + template.indexOf('(') + 1; // justo después de '('
    } else {
      newCursorPos = before.length + template.length;
    }

    setShowSuggestions(false);
    setActiveWordRange(null);

    // Reposicionar cursor con delay de render
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        adjustHeight();
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }
  };

  const handleInsertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    const pos = textarea ? textarea.selectionStart || strValue.length : strValue.length;
    const before = strValue.slice(0, pos);
    const after = strValue.slice(pos);

    let template = snippet;
    let newCursorPos = pos + snippet.length;

    // Si el snippet es un operador ternario
    if (snippet === '? :') {
      template = ' ?  : ';
      newCursorPos = pos + 3; // Ubicar cursor entre '?' y ':'
    } else if (snippet.endsWith('()')) {
      newCursorPos = pos + snippet.length - 1; // Dentro de ()
    }

    const newValue = `${before}${template}${after}`;
    onChange(newValue);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        adjustHeight();
      }
    }, 10);
  };

  // Click outside para cerrar el menú de sugerencias
  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(ev.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(ev.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full space-y-1.5">
      {/* Editor Textarea Auto-expandible */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={1}
          required={required}
          value={strValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={(e) => updateSuggestions(strValue, (e.target as HTMLTextAreaElement).selectionStart || 0)}
          onKeyUp={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
              updateSuggestions(strValue, (e.target as HTMLTextAreaElement).selectionStart || 0);
            }
          }}
          placeholder={placeholder}
          className={`w-full bg-transparent font-mono text-xs font-bold text-primary focus:outline-none px-2 py-1 placeholder:text-on-surface-variant/40 resize-none overflow-y-auto whitespace-pre-wrap break-words leading-relaxed transition-all ${className}`}
        />

        {/* Dropdown Flotante de IntelliSense */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute left-0 top-full mt-1 w-full sm:w-80 max-h-56 overflow-y-auto bg-surface-container-high border border-primary/30 rounded-2xl shadow-2xl z-50 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
          >
            <div className="px-2 py-1 text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-wider flex items-center justify-between border-b border-outline-variant/20 mb-1">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary" />
                <span>Sugerencias IntelliSense</span>
              </span>
              <span className="text-[9px] font-mono text-on-surface-variant/60 lowercase">↑↓ enter / tab</span>
            </div>

            {suggestions.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => handleSelectSuggestion(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-primary text-on-primary font-bold shadow-xs'
                      : 'hover:bg-surface-variant/50 text-on-surface'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {item.type === 'param' && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-primary/15 text-primary'
                      }`}>
                        🅿️ {item.id}
                      </span>
                    )}
                    {item.type === 'var' && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        ⚡ ${item.id}
                      </span>
                    )}
                    {item.type === 'func' && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      }`}>
                        ƒ {item.id}()
                      </span>
                    )}
                    {item.type === 'op' && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                      }`}>
                        & {item.id}
                      </span>
                    )}
                    {item.type === 'value' && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                      }`}>
                        🏷️ {item.id}
                      </span>
                    )}
                    <span className="truncate font-sans text-xs">{item.label}</span>
                  </div>

                  {item.detail && (
                    <span className={`text-[10px] shrink-0 font-normal ml-2 ${
                      isSelected ? 'text-white/80' : 'text-on-surface-variant/70'
                    }`}>
                      {item.detail}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Chips de Inserción Rápida */}
      {showChips && (parametros.length > 0 || variables.length > 0 || attributeValues.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5 px-0.5">
          <span className="text-[10px] font-semibold text-on-surface-variant/70 shrink-0">
            Insertar:
          </span>

          {/* Valores de catálogo para el atributo */}
          {attributeValues.slice(0, 8).map((val) => (
            <button
              key={`val-${val}`}
              type="button"
              onClick={() => handleInsertSnippet(val)}
              className="px-1.5 py-0.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-[10px] font-mono font-bold rounded-md border border-cyan-500/25 transition active:scale-95 shrink-0"
              title={`Valor de catálogo: ${val}`}
            >
              🏷️ {val}
            </button>
          ))}

          {/* Parámetros */}
          {parametros.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleInsertSnippet(p.id)}
              className="px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-mono font-semibold rounded-lg border border-primary/20 transition active:scale-95 shrink-0"
              title={`Insertar parámetro: ${p.nombre}`}
            >
              {p.id}
            </button>
          ))}

          {/* Variables calculadas */}
          {variables.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => handleInsertSnippet(v.id)}
              className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono font-semibold rounded-lg border border-emerald-500/25 transition active:scale-95 shrink-0"
              title={`Insertar variable calculada: ${v.nombre}`}
            >
              ${v.id}
            </button>
          ))}

          {/* Operadores condicionales y funciones comunes */}
          <button
            type="button"
            onClick={() => handleInsertSnippet('? :')}
            className="px-1.5 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-mono font-bold rounded-lg border border-amber-500/25 transition active:scale-95 shrink-0"
            title="Insertar operador ternario (cond ? val1 : val2)"
          >
            ? :
          </button>

          <button
            type="button"
            onClick={() => handleInsertSnippet('si()')}
            className="px-1.5 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-mono font-bold rounded-lg border border-amber-500/25 transition active:scale-95 shrink-0"
            title="Insertar función si(cond, val1, val2)"
          >
            si()
          </button>

          <button
            type="button"
            onClick={() => handleInsertSnippet('ceil()')}
            className="px-1.5 py-0.5 bg-surface-container-highest hover:bg-surface-variant text-on-surface-variant text-[11px] font-mono font-semibold rounded-lg border border-outline-variant/30 transition active:scale-95 shrink-0"
            title="Redondeo hacia arriba ceil(x)"
          >
            ceil()
          </button>
        </div>
      )}
    </div>
  );
};
