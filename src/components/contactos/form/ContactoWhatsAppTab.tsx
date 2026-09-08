import React from 'react';
import { MessageSquare, Sparkles, RotateCcw } from 'lucide-react';
import { ContactoFormData } from '../ContactoFormModal';
import {
  VARIABLES_WHATSAPP_DISPONIBLES,
  DEFAULT_WHATSAPP_TEMPLATE_VAITTY,
  DEFAULT_WHATSAPP_TEMPLATE_GENERIC
} from '../../../core/whatsappUtils';

interface ContactoWhatsAppTabProps {
  formData: ContactoFormData;
  setFormData: React.Dispatch<React.SetStateAction<ContactoFormData>>;
}

export const ContactoWhatsAppTab: React.FC<ContactoWhatsAppTabProps> = ({
  formData,
  setFormData
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/20 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">
            Formato de Cotización por WhatsApp
          </h4>
        </div>
        <p className="text-xs text-on-surface-variant">
          Configura un formato de mensaje a medida para este cliente o plataforma (ej. Vaitty, aseguradoras, inmobiliarias). Si no se define, se utilizará automáticamente la plantilla genérica global de la empresa.
        </p>

        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="whatsappTemplateMode"
              checked={!formData.plantillaWhatsAppPersonalizada}
              onChange={() => setFormData((prev) => ({ ...prev, plantillaWhatsAppPersonalizada: '' }))}
              className="text-primary focus:ring-primary w-4 h-4"
            />
            <span className="text-xs font-medium text-on-surface">
              Usar plantilla global por defecto (Recomendado para clientes particulares)
            </span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="whatsappTemplateMode"
              checked={Boolean(formData.plantillaWhatsAppPersonalizada)}
              onChange={() => {
                if (!formData.plantillaWhatsAppPersonalizada) {
                  setFormData((prev) => ({
                    ...prev,
                    plantillaWhatsAppPersonalizada: DEFAULT_WHATSAPP_TEMPLATE_VAITTY
                  }));
                }
              }}
              className="text-primary focus:ring-primary w-4 h-4"
            />
            <span className="text-xs font-medium text-on-surface">
              Personalizar plantilla para este cliente / plataforma
            </span>
          </label>
        </div>
      </div>

      {Boolean(formData.plantillaWhatsAppPersonalizada) && (
        <div className="bg-surface-container-high p-4 rounded-2xl border border-outline-variant/30 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-primary uppercase tracking-wide">
              Cuerpo del Mensaje
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    plantillaWhatsAppPersonalizada: DEFAULT_WHATSAPP_TEMPLATE_VAITTY
                  }))
                }
                className="px-2.5 py-1 bg-surface-container hover:bg-surface text-on-surface text-xs font-medium rounded-full border border-outline-variant/30 transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-primary" />
                <span>Cargar Preset Vaitty</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    plantillaWhatsAppPersonalizada: DEFAULT_WHATSAPP_TEMPLATE_GENERIC
                  }))
                }
                className="px-2.5 py-1 bg-surface-container hover:bg-surface text-on-surface text-xs font-medium rounded-full border border-outline-variant/30 transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-on-surface-variant" />
                <span>Cargar Genérico</span>
              </button>
            </div>
          </div>

          <textarea
            rows={10}
            value={formData.plantillaWhatsAppPersonalizada}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, plantillaWhatsAppPersonalizada: e.target.value }))
            }
            className="w-full bg-surface-container-highest border border-outline-variant/40 rounded-xl p-3.5 text-xs text-on-surface font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed"
            placeholder="Escribe la plantilla de mensaje..."
          />

          {/* Chips de inserción de tags */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-on-surface-variant block">
              Variables disponibles (Haz clic para insertar en el texto):
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-surface-container rounded-xl border border-outline-variant/20">
              {VARIABLES_WHATSAPP_DISPONIBLES.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      plantillaWhatsAppPersonalizada:
                        (prev.plantillaWhatsAppPersonalizada || '') + ` ${v.tag} `
                    }));
                  }}
                  className="px-2 py-0.5 bg-surface-container-high hover:bg-primary/10 hover:text-primary text-on-surface text-xs font-mono rounded-lg border border-outline-variant/20 transition-colors cursor-pointer"
                  title={`${v.descripcion} (Ejemplo: ${v.ejemplo})`}
                >
                  +{v.etiqueta}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
