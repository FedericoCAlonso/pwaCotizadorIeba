import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Loader2,
  BookOpen,
  Cpu,
  X,
  ArrowRight,
  Sliders,
  Calculator,
  Package,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { Insumo, CategoriaManoDeObra, TareaFormData } from '../../../core/types';
import {
  generateTareaFormDataWithAI,
  checkOllamaAvailability,
  AiFormDataResult
} from '../../../core/ai/aiAssistantService';

export interface FormAiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFormData: (data: TareaFormData, yaml?: string) => void;
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  categoriasList?: string[];
  initialPrompt?: string;
}

const PRESET_EJEMPLOS = [
  {
    label: '❄️ Aire Split TUE',
    prompt: 'Circuito TUE exclusivo para aire acondicionado split 4500W con térmica dedicada y puesta a tierra'
  },
  {
    label: '🔌 Tomas TUG (Bocas)',
    prompt: 'Circuito para tomacorrientes de uso general TUG con 8 bocas, cable 2.5mm y cañería'
  },
  {
    label: '💡 Iluminación IUG',
    prompt: 'Circuito de iluminación de uso general IUG con 8 bocas, llaves de punto y cable 1.5mm'
  },
  {
    label: '⚡ Puesta a Tierra (PAT)',
    prompt: 'Instalación de puesta a tierra reglamentaria con jabalina 1.5m y protocolo SRT 900/15'
  },
  {
    label: '🎛️ Tablero Seccional',
    prompt: 'Armado de tablero seccional con disyuntor diferencial 40A y 4 circuitos termomagnéticos'
  },
  {
    label: '🏢 Línea Seccional',
    prompt: 'Tendido de alimentador seccional 15 metros con cable 4mm y protección'
  }
];

export const FormAiAssistantModal: React.FC<FormAiAssistantModalProps> = ({
  isOpen,
  onClose,
  onApplyFormData,
  insumosMap,
  manoObraMap,
  categoriasList = [],
  initialPrompt = ''
}) => {
  const [promptText, setPromptText] = useState(initialPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AiFormDataResult | null>(null);
  const [isOllamaOnline, setIsOllamaOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkOllamaAvailability().then(setIsOllamaOnline);
      if (initialPrompt) setPromptText(initialPrompt);
    } else {
      setResult(null);
    }
  }, [isOpen, initialPrompt]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!promptText.trim() || isLoading) return;
    setIsLoading(true);
    setResult(null);

    try {
      const res = await generateTareaFormDataWithAI(
        promptText,
        insumosMap,
        manoObraMap,
        categoriasList
      );
      setResult(res);
    } catch {
      // Manejado por servicio con fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (result?.data) {
      onApplyFormData(result.data, result.yaml);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-surface-container rounded-2xl sm:rounded-3xl shadow-2xl border border-outline-variant/40 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-outline-variant/30 bg-surface">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-on-surface">Asistente de Trabajo Tipo</h3>
                {isOllamaOnline ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1">
                    <Cpu className="w-3 h-3" /> Ollama Local
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> AEA 90364 Offline
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant">
                Completa todas las pestañas visuales según la reglamentación y tu catálogo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Input & Chips */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-on-surface uppercase tracking-wide">
              ¿Qué trabajo deseas configurar?
            </label>
            <textarea
              rows={3}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Ej: Circuito independiente para termotanque 2500W con cable 4mm a 15 metros del tablero..."
              className="w-full bg-surface border border-outline-variant/30 rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed resize-none transition"
              disabled={isLoading}
            />

            {/* Presets rápidos */}
            <div className="space-y-1">
              <span className="text-[11px] text-on-surface-variant font-medium">Ejemplos rápidos:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_EJEMPLOS.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setPromptText(ex.prompt);
                      setResult(null);
                    }}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-variant/50 text-on-surface-variant hover:text-on-surface border border-outline-variant/30 transition text-left active:scale-95"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Botón de Generar si no hay resultado */}
          {!result && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!promptText.trim() || isLoading}
              className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-sm transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 active:scale-98"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analizando normas AEA y catálogo...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Autocompletar Formulario</span>
                </>
              )}
            </button>
          )}

          {/* Tarjeta de Resumen con Vista Previa de Campos Listos */}
          {result && (
            <div className="space-y-3 p-3.5 rounded-2xl bg-surface border border-primary/25 shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Estructura Generada con Éxito</span>
                </span>
                <span className="text-[11px] font-mono text-on-surface-variant">
                  {result.source === 'ollama' ? 'Modelo LLM' : 'Normas AEA'}
                </span>
              </div>

              {/* Detalle visual de pestañas que se completarán */}
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20">
                  <span className="font-bold text-on-surface block text-sm">{result.data.nombre}</span>
                  <span className="text-on-surface-variant text-[11px]">
                    Categoría: <b>{result.data.categoria}</b> • Unidad: <b>{result.data.unidad}</b>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-surface-container-low border border-outline-variant/20 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span><b>{result.data.parametros.length}</b> Parámetros</span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-container-low border border-outline-variant/20 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span><b>{result.data.variables.length}</b> Fórmulas</span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-container-low border border-outline-variant/20 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span><b>{result.data.insumos.length}</b> Materiales catálogo</span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-container-low border border-outline-variant/20 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span><b>{result.data.manoObra.length}</b> Cuadrillas MO</span>
                  </div>
                </div>

                {result.data.clausulaExclusiones && (
                  <div className="p-2 rounded-lg bg-surface-container-low border border-outline-variant/20 text-[11px] text-on-surface-variant">
                    <div className="font-semibold text-on-surface flex items-center gap-1 mb-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                      <span>Cláusula de Exclusiones y Alcance:</span>
                    </div>
                    <p className="line-clamp-2 italic">{result.data.clausulaExclusiones}</p>
                  </div>
                )}
              </div>

              {/* Botones de acción final */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="px-3 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface rounded-xl transition"
                >
                  Modificar pedido
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <span>Cargar en el Formulario</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
