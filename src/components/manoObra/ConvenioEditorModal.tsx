import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Zap, Plus, Trash2, Calendar, FileText, Info } from 'lucide-react';
import { ConvenioLaboral } from '../../core/types';
import { safeNum } from '../../core/calculations';

interface ConvenioEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  convenio: ConvenioLaboral | null;
  onSave: (c: ConvenioLaboral) => Promise<void>;
  onDelete?: (id: string) => void;
}

export const ConvenioEditorModal: React.FC<ConvenioEditorModalProps> = ({
  isOpen,
  onClose,
  convenio,
  onSave,
  onDelete
}) => {
  const [nombre, setNombre] = useState('');
  const [cargasSocialesPct, setCargasSocialesPct] = useState('65');
  const [gastosDirectos, setGastosDirectos] = useState('5000');
  const [horasJornada, setHorasJornada] = useState(9);
  const [descripcion, setDescripcion] = useState('');
  const [adicionalesList, setAdicionalesList] = useState<{ key: string; val: string }[]>([]);
  const [isIndependiente, setIsIndependiente] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (convenio) {
      setNombre(convenio.nombre || '');
      setCargasSocialesPct((convenio.cargasSocialesPct ?? 65).toString());
      setGastosDirectos((convenio.gastosDirectosOperarioDefecto ?? 5000).toString());
      setHorasJornada(convenio.horasJornadaDefecto || 9);
      setDescripcion(convenio.descripcion || '');
      setIsIndependiente(convenio.esIndependiente ?? false);

      const adic = convenio.adicionales || {};
      const entries = Object.entries(adic).map(([k, v]) => ({
        key: k,
        val: (v * 100).toString()
      }));
      setAdicionalesList(entries);
    } else {
      setNombre('');
      setCargasSocialesPct('65');
      setGastosDirectos('5000');
      setHorasJornada(9);
      setDescripcion('');
      setIsIndependiente(false);
      setAdicionalesList([{ key: 'adicionalTrabajoAltura', val: '20' }]);
    }
  }, [convenio, isOpen]);

  if (!isOpen) return null;

  const handleAddAdicional = () => {
    setAdicionalesList([...adicionalesList, { key: `adicional_${Date.now()}`, val: '15' }]);
  };

  const handleRemoveAdicional = (index: number) => {
    setAdicionalesList(adicionalesList.filter((_, i) => i !== index));
  };

  const handleUpdateAdicional = (index: number, field: 'key' | 'val', value: string) => {
    const next = [...adicionalesList];
    next[index][field] = value;
    setAdicionalesList(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    setIsSaving(true);
    try {
      const adicionalesMap: Record<string, number> = {};
      adicionalesList.forEach(({ key, val }) => {
        const cleanedKey = key.trim().replace(/\s+/g, '_');
        const num = parseFloat(val);
        if (cleanedKey && !isNaN(num)) {
          adicionalesMap[cleanedKey] = num / 100;
        }
      });

      const updatedConvenio: ConvenioLaboral = {
        id: convenio?.id || `cct-${nombre.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`,
        nombre: nombre.trim(),
        cargasSocialesPct: safeNum(parseFloat(cargasSocialesPct)) || 65,
        gastosDirectosOperarioDefecto: safeNum(parseFloat(gastosDirectos)) || 5000,
        horasJornadaDefecto: horasJornada,
        descripcion: descripcion.trim(),
        adicionales: adicionalesMap,
        esIndependiente: isIndependiente,
        createdAt: convenio?.createdAt,
        updatedAt: new Date().toISOString()
      };

      await onSave(updatedConvenio);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-surface border border-outline-variant/30 rounded-3xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">
                {convenio?.id ? 'Editar Convenio Laboral' : 'Nuevo Convenio Laboral'}
              </h3>
              <p className="text-xs text-on-surface-variant">
                Configura cargas sociales, EPP y variables de fórmula.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulario scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">
              Nombre del Convenio / Régimen <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: UOCRA CCT 76/75, UOM Tableros, Independiente..."
              className="w-full px-3 py-2 text-xs bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Descripción o Ámbito de Aplicación
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Construcción tradicional, canalizaciones, obras civiles..."
              className="w-full px-3 py-2 text-xs bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Grilla: Cargas Sociales %, Gastos Directos y Jornada */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <span>Cargas Soc. (FCS)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="150"
                  required
                  value={cargasSocialesPct}
                  onChange={(e) => setCargasSocialesPct(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface pr-7 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                EPP & Ropa ($/día)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="500"
                  min="0"
                  value={gastosDirectos}
                  onChange={(e) => setGastosDirectos(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface pl-6 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant font-mono">$</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-on-surface-variant" />
                <span>Jornada Base</span>
              </label>
              <select
                value={horasJornada}
                onChange={(e) => setHorasJornada(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value={9}>9 horas (UOCRA)</option>
                <option value={8}>8 horas (Legal / UOM)</option>
              </select>
            </div>
          </div>

          {/* Modificadores de Fórmula (Variables Globales) */}
          <div className="pt-2 border-t border-outline-variant/20">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-bold text-on-surface flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Modificadores de Fórmula DSL</span>
                </span>
                <span className="text-[11px] text-on-surface-variant block">
                  Variables utilizables en tareas tipo (ej: <code className="font-mono text-primary">{convenio?.id || 'uocra'}.adicionalTrabajoAltura</code>).
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddAdicional}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>

            {adicionalesList.length === 0 ? (
              <div className="p-3 bg-surface-container-low rounded-xl text-center text-xs text-on-surface-variant/70 italic">
                Sin adicionales configurados.
              </div>
            ) : (
              <div className="space-y-2">
                {adicionalesList.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.key}
                      onChange={(e) => handleUpdateAdicional(idx, 'key', e.target.value)}
                      placeholder="nombreVariable"
                      className="flex-1 px-2.5 py-1 text-xs font-mono bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="relative w-24">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="200"
                        value={item.val}
                        onChange={(e) => handleUpdateAdicional(idx, 'val', e.target.value)}
                        placeholder="20"
                        className="w-full px-2 py-1 text-xs font-mono font-bold text-right bg-surface-container border border-outline-variant/30 rounded-lg text-primary pr-6 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-primary">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAdicional(idx)}
                      className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition"
                      title="Eliminar modificador"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botones al pie */}
          <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between">
            {convenio?.id && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(convenio.id);
                  onClose();
                }}
                className="px-3 py-1.5 text-xs text-error hover:bg-error-container/30 rounded-xl transition font-semibold"
              >
                Eliminar
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || !nombre.trim()}
                className="px-5 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-full transition shadow-xs disabled:opacity-40"
              >
                {isSaving ? 'Guardando...' : 'Guardar Convenio'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
