import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Option {
  id: string;
  label: string;
  subLabel?: string;
  frecuenciaUso?: number;
  ultimoUsoFecha?: string;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Buscar o escribir...',
  className = '',
  icon
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options
    .filter(opt => 
      opt.label.toLowerCase().includes(value.toLowerCase()) || 
      (opt.subLabel && opt.subLabel.toLowerCase().includes(value.toLowerCase()))
    )
    .sort((a, b) => {
      const freqDiff = (b.frecuenciaUso || 0) - (a.frecuenciaUso || 0);
      if (freqDiff !== 0) return freqDiff;
      const dateA = a.ultimoUsoFecha ? new Date(a.ultimoUsoFecha).getTime() : 0;
      const dateB = b.ultimoUsoFecha ? new Date(b.ultimoUsoFecha).getTime() : 0;
      return dateB - dateA;
    });

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 z-10 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsFocused(true);
            setIsOpen(true);
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={`${className} ${icon ? 'pl-9' : ''} pr-8`}
          autoComplete="off"
        />
        <button 
          type="button" 
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors"
          tabIndex={-1}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (value.length > 0 || isFocused) && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto overscroll-contain">
          {filteredOptions.length > 0 ? (
            <ul className="py-1">
              {filteredOptions.map((opt) => (
                <li 
                  key={opt.id}
                  onMouseDown={(e) => {
                    // Prevent blur before click registers
                    e.preventDefault();
                  }}
                  onClick={() => {
                    onChange(opt.label);
                    setIsOpen(false);
                  }}
                  className="px-3 py-2 cursor-pointer hover:bg-slate-700/80 transition-colors flex flex-col"
                >
                  <span className="text-sm text-slate-200 font-medium">{opt.label}</span>
                  {opt.subLabel && <span className="text-[10px] text-slate-400 mt-0.5">{opt.subLabel}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-4 text-center text-sm text-slate-500">
              <span className="block mb-1">Sin resultados.</span>
              <span className="text-[11px]">Se guardará "{value}" como nuevo ingreso.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
