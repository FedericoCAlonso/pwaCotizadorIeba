import React, { useState } from 'react';
import {
  X, HelpCircle, FileSpreadsheet, Layers, FileText, Smartphone, Cloud,
  Download, Search, BookOpen, CheckCircle2, Package, Users
} from 'lucide-react';
import helpMessages from '../data/helpMessages.json';

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenImporter?: () => void;
}

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({
  isOpen,
  onClose,
  onOpenImporter
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string>(
    helpMessages.helpCenter.categories[0]?.id || 'categoriasTecnicas'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Package,
    FileSpreadsheet,
    Users,
    Layers,
    FileText,
    Smartphone,
    Cloud
  };

  const categories = helpMessages.helpCenter.categories;
  const filteredCategories = categories.filter(cat => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      cat.title.toLowerCase().includes(q) ||
      cat.summary.toLowerCase().includes(q) ||
      cat.sections.some(s => s.heading.toLowerCase().includes(q) || s.content.toLowerCase().includes(q))
    );
  });

  const activeCategory = categories.find(c => c.id === selectedCatId) || categories[0];
  const ActiveIcon = activeCategory ? (iconMap[activeCategory.iconName] || BookOpen) : BookOpen;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container rounded-2xl w-full max-w-4xl shadow-2xl p-6 text-on-surface max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-container text-on-primary-container rounded-xl">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-on-surface">{helpMessages.helpCenter.title}</h3>
              <p className="text-xs text-on-surface-variant">{helpMessages.helpCenter.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] p-2 rounded-full text-on-surface-variant hover:text-on-surface state-layer transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Cerrar ayuda"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Buscador de Ayuda */}
        <div className="mb-4 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar tema en el centro de ayuda (ej: Excel, Fichas, Opciones, RFQ, Tareas, Margen, Sync)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-surface-container-high text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Body Container (Categorías lateral + Contenido) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* Categorías Sidebar */}
          <div className="md:col-span-4 overflow-y-auto space-y-1.5 pr-1 border-b md:border-b-0 md:border-r border-outline-variant/20 pb-3 md:pb-0">
            {filteredCategories.map(cat => {
              const Icon = iconMap[cat.iconName] || BookOpen;
              const isSelected = cat.id === activeCategory.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`w-full text-left p-3 rounded-2xl state-layer transition-all text-xs flex items-start gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  <div className={`p-1.5 rounded-xl shrink-0 ${isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-medium text-xs text-on-surface">{cat.title}</span>
                    <span className="text-[10px] opacity-80 line-clamp-1">{cat.summary}</span>
                  </div>
                </button>
              );
            })}

            {filteredCategories.length === 0 && (
              <p className="text-xs text-on-surface-variant text-center py-4">No se encontraron temas con tu búsqueda.</p>
            )}
          </div>

          {/* Secciones de Contenido Detallado */}
          <div className="md:col-span-8 overflow-y-auto pr-1 space-y-4 text-xs leading-relaxed text-on-surface-variant">
            {activeCategory && (
              <div className="space-y-4">
                <div className="p-4 bg-primary-container/30 rounded-2xl text-on-surface">
                  <div className="flex items-center gap-2 mb-1">
                    <ActiveIcon className="w-4 h-4 text-primary" />
                    <h4 className="font-bold text-sm text-primary">{activeCategory.title}</h4>
                  </div>
                  <p className="text-xs">{activeCategory.summary}</p>
                </div>

                {activeCategory.sections.map((sec, idx) => (
                  <div key={idx} className="p-4 bg-surface-container-low rounded-2xl space-y-2">
                    <h5 className="font-bold text-xs text-on-surface flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                      {sec.heading}
                    </h5>
                    <p className="text-on-surface-variant">{sec.content}</p>

                    {sec.bullets && sec.bullets.length > 0 && (
                      <ul className="space-y-1.5 pt-1">
                        {sec.bullets.map((bullet, bIdx) => (
                          <li key={bIdx} className="flex items-start gap-2 text-[11px] text-on-surface">
                            <CheckCircle2 className="w-3.5 h-3.5 text-tertiary shrink-0 mt-0.5" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

                {activeCategory.id === 'importacion' && onOpenImporter && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenImporter();
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-semibold text-xs rounded-full state-layer shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Abrir Importador y Descargar Plantilla</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-outline-variant/20 flex justify-between items-center shrink-0 mt-2">
          <span className="text-[11px] text-on-surface-variant font-mono">Cotizador Eléctrico — IEBA v1.3.0</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-surface-container-highest hover:bg-surface-variant text-on-surface rounded-full state-layer transition-colors cursor-pointer"
          >
            Entendido, Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
