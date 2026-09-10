import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Check,
  Loader2,
  AlertCircle,
  BookOpen,
  Cpu,
  X
} from 'lucide-react';
import { Insumo, CategoriaManoDeObra } from '../../../core/types';
import {
  generateTareaTipoWithAI,
  checkOllamaAvailability,
  AiGenerationResult
} from '../../../core/ai/aiAssistantService';

export interface AiPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyYaml: (yaml: string) => void;
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
}

const EJEMPLOS_PROMPTS = [
  'Circuito exclusivo TUE para aire acondicionado split 3500W con térmica y tierra',
  'Puesta a tierra reglamentaria con jabalina y protocolo SRT 900/15',
  'Recableado de 10 bocas de iluminación y tomas con conductores de 1.5mm² y 2.5mm²',
  'Instalación de tablero seccional con disyuntor 30mA y 4 circuitos'
];

export const AiPromptModal: React.FC<AiPromptModalProps> = ({
  isOpen,
  onClose,
  onApplyYaml,
  insumosMap,
  manoObraMap
}) => {
  const [promptText, setPromptText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AiGenerationResult | null>(null);
  const [isOllamaOnline, setIsOllamaOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkOllamaAvailability().then(setIsOllamaOnline);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!promptText.trim() || isLoading) return;
    setIsLoading(true);
    setResult(null);

    try {
      const res = await generateTareaTipoWithAI(promptText, insumosMap, manoObraMap);
      setResult(res);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (result?.yaml) {
      onApplyYaml(result.yaml);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-surface-container rounded-2xl shadow-xl border border-outline-variant/40 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-outline-variant/30 bg-surface">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span>Asistente IA • Generador Normativo AEA</span>
                {isOllamaOnline ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1">
                    <Cpu className="w-3 h-3" /> Ollama Local Activo
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> Reglas AEA Offline
                  </span>
                )}
              </h3>
              <p className="text-xs text-on-surface-variant">
                Describe la instalación en lenguaje natural y la IA estructurará el Trabajo Tipo en YAML.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Input del Prompt */}
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1.5">
              ¿Qué trabajo deseas presupuestar o configurar?
            </label>
            <textarea
              rows={3}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Ej: Instalación de circuito para 2 aires acondicionados split 3000 frigorías con protección dedicada..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-surface border border-outline-variant/40 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-on-surface-variant/50 text-on-surface"
              disabled={isLoading}
            />
          </div>

          {/* Ejemplos rápidos */}
          <div>
            <span className="text-[11px] font-semibold text-on-surface-variant block mb-1.5">
              O elige una plantilla de ejemplo:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {EJEMPLOS_PROMPTS.map((ej, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPromptText(ej)}
                  className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-variant/60 text-[11px] text-on-surface border border-outline-variant/30 text-left transition-colors"
                >
                  {ej}
                </button>
              ))}
            </div>
          </div>

          {/* Previsualización del YAML Generado */}
          {result && (
            <div className="space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-on-surface">
                  <Bot className="w-4 h-4 text-primary" />
                  <span>Definición YAML generada ({result.source === 'ollama' ? 'Ollama' : 'Normativa AEA'}):</span>
                </span>
                <span className="text-[11px] font-mono text-emerald-600 font-bold">
                  {result.diagnosticsCount === 0 ? '✓ Sintaxis Válida' : `Avisos: ${result.diagnosticsCount}`}
                </span>
              </div>
              <pre className="p-3 bg-surface rounded-xl border border-outline-variant/30 font-mono text-[11px] text-on-surface max-h-56 overflow-y-auto whitespace-pre leading-relaxed scrollbar-thin">
                {result.yaml}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-outline-variant/30 bg-surface flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {!result ? (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!promptText.trim() || isLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-on-primary hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generando YAML con IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generar Trabajo Tipo</span>
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-on-surface bg-surface-variant/40 hover:bg-surface-variant/70 transition-colors"
                >
                  Regenerar
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-on-primary hover:bg-primary/90 transition-all shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Volcar al Editor Experto</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
