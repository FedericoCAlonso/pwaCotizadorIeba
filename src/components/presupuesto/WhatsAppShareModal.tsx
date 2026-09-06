import React, { useState, useEffect } from 'react';
import { MessageSquare, X, Send, Copy, Check, Sparkles, RotateCcw, Phone, User } from 'lucide-react';
import { Presupuesto, Contacto, AppConfig } from '../../core/types';
import {
  generarMensajeWhatsAppCotizacion,
  generarEnlaceWhatsApp,
  limpiarNumeroTelefonoWhatsApp,
  DEFAULT_WHATSAPP_TEMPLATE_GENERIC,
  DEFAULT_WHATSAPP_TEMPLATE_VAITTY
} from '../../core/whatsappUtils';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useToast } from '../../contexts/ToastContext';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  presupuesto: Presupuesto | null;
  cliente?: Contacto | null;
  config?: AppConfig | null;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  presupuesto,
  cliente,
  config
}) => {
  useEscapeKey(isOpen, onClose);
  const { toast } = useToast();

  const [telefonoDestino, setTelefonoDestino] = useState('');
  const [mensajeEditable, setMensajeEditable] = useState('');
  const [selectedTemplateMode, setSelectedTemplateMode] = useState<'auto' | 'generico' | 'vaitty'>('auto');
  const [isCopied, setIsCopied] = useState(false);

  // Inicializar o recalcular mensaje cuando cambian los datos o el modo
  useEffect(() => {
    if (!isOpen || !presupuesto) return;

    setTelefonoDestino(cliente?.telefono || '');
    setIsCopied(false);

    let templateOverride: string | undefined = undefined;
    if (selectedTemplateMode === 'generico') {
      templateOverride = config?.plantillaWhatsAppDefault || DEFAULT_WHATSAPP_TEMPLATE_GENERIC;
    } else if (selectedTemplateMode === 'vaitty') {
      templateOverride = DEFAULT_WHATSAPP_TEMPLATE_VAITTY;
    }

    const textoGenerado = generarMensajeWhatsAppCotizacion(
      presupuesto,
      cliente,
      config,
      templateOverride
    );

    setMensajeEditable(textoGenerado);
  }, [isOpen, presupuesto, cliente, config, selectedTemplateMode]);

  if (!isOpen || !presupuesto) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mensajeEditable);
      setIsCopied(true);
      toast.success('¡Mensaje copiado al portapapeles!');
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      toast.error('No se pudo copiar el texto');
    }
  };

  const handleOpenWhatsApp = () => {
    const url = generarEnlaceWhatsApp(telefonoDestino, mensajeEditable);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const hasCustomTemplate = Boolean(cliente?.plantillaWhatsAppPersonalizada);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] text-on-surface pb-safe">
        
        {/* Mobile drag bar */}
        <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto mt-2.5 mb-1 shrink-0 sm:hidden" />

        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-outline-variant/30 flex items-center justify-between shrink-0 bg-surface-container-low">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">
                Enviar Cotización por WhatsApp
              </h3>
              <p className="text-xs text-on-surface-variant">
                Presupuesto {presupuesto.numero}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* Destinatario y Teléfono */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/20">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-primary" /> Cliente
              </label>
              <div className="text-xs font-semibold text-on-surface truncate">
                {cliente?.razonSocial || cliente?.nombre || 'Cliente General'}
              </div>
              {(presupuesto.direccionObra || cliente?.direccion) && (
                <div className="text-xs text-on-surface-variant truncate">
                  Obra: {presupuesto.direccionObra || cliente?.direccion}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-500" /> Teléfono WhatsApp
              </label>
              <input
                type="text"
                value={telefonoDestino}
                onChange={(e) => setTelefonoDestino(e.target.value)}
                placeholder="ej: 11 4455-6677 o +54 9 11..."
                className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Selector de Plantilla */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Formato de Mensaje:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedTemplateMode('auto')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  selectedTemplateMode === 'auto'
                    ? 'bg-primary-container text-on-primary-container border-primary shadow-xs'
                    : 'bg-surface-container-highest border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                {hasCustomTemplate ? 'Personalizada de Cliente' : 'Global Genérica'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedTemplateMode('vaitty')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  selectedTemplateMode === 'vaitty'
                    ? 'bg-primary-container text-on-primary-container border-primary shadow-xs'
                    : 'bg-surface-container-highest border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                Formato Vaitty
              </button>
              <button
                type="button"
                onClick={() => setSelectedTemplateMode('generico')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  selectedTemplateMode === 'generico'
                    ? 'bg-primary-container text-on-primary-container border-primary shadow-xs'
                    : 'bg-surface-container-highest border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                Estándar Genérica
              </button>
            </div>
          </div>

          {/* Editor del Mensaje Renderizado */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs text-on-surface-variant">
              <span>Vista previa editable (Podés retocar los datos antes de enviar):</span>
              <span className="font-mono">{mensajeEditable.length} caracteres</span>
            </div>
            <textarea
              rows={12}
              value={mensajeEditable}
              onChange={(e) => setMensajeEditable(e.target.value)}
              className="w-full bg-surface-container-highest border border-outline-variant/40 rounded-2xl p-4 text-xs text-on-surface font-mono leading-relaxed focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-inner"
              placeholder="Cargando mensaje..."
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-t border-outline-variant/30 flex flex-wrap items-center justify-between gap-3 bg-surface-container-high shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-surface-container hover:bg-surface-variant text-on-surface text-xs font-semibold rounded-full border border-outline-variant/30 transition-colors shadow-xs"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{isCopied ? '¡Texto Copiado!' : 'Copiar Texto'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold text-xs rounded-full shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Abrir en WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
