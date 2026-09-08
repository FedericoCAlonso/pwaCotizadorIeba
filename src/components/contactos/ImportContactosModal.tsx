import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  Building,
  Users,
  Smartphone,
  Check,
  RefreshCw
} from 'lucide-react';
import { db } from '../../db/database';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useToast } from '../../contexts/ToastContext';
import { Contacto, RolContacto } from '../../core/types';
import {
  readContactosFile,
  autoDetectContactosColumnMapping,
  validateAndBuildContactosPreview,
  generateContactosExcelTemplate,
  generateContactosCsvTemplate,
  ContactosColumnMapping,
  ContactosImportPreview
} from '../../core/contactosImportUtils';

interface ImportContactosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export const ImportContactosModal: React.FC<ImportContactosModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  useEscapeKey(isOpen, onClose);
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Archivo, 2: Mapeo, 3: Previsualización
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ContactosColumnMapping>({ razonSocial: '' });
  const [importStrategy, setImportStrategy] = useState<'update_existing' | 'ignore_duplicates' | 'create_always'>('update_existing');
  const [defaultRole, setDefaultRole] = useState<RolContacto>('cliente');
  const [existingContactos, setExistingContactos] = useState<Contacto[]>([]);
  const [preview, setPreview] = useState<ContactosImportPreview | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar contactos existentes para chequear duplicados
  useEffect(() => {
    if (isOpen) {
      db.contactos.toArray().then((list) => {
        setExistingContactos(list.filter((c) => !c.deleted));
      });
      setStep(1);
      setFile(null);
      setHeaders([]);
      setRawRows([]);
      setPreview(null);
      setIsProcessing(false);
    }
  }, [isOpen]);

  // Recalcular previsualización cuando cambien mapping, estrategia o filas
  useEffect(() => {
    if (step === 3 && rawRows.length > 0) {
      const p = validateAndBuildContactosPreview({
        rows: rawRows,
        mapping,
        existingContactos,
        importStrategy,
        defaultRole
      });
      setPreview(p);
    }
  }, [step, rawRows, mapping, existingContactos, importStrategy, defaultRole]);

  // Procesar archivo seleccionado
  const handleProcessFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);
    try {
      const { headers: parsedHeaders, rows: parsedRows } = await readContactosFile(selectedFile);
      if (parsedHeaders.length === 0 || parsedRows.length === 0) {
        toast.error('El archivo está vacío o no contiene filas con datos válidos.');
        setIsProcessing(false);
        return;
      }

      setHeaders(parsedHeaders);
      setRawRows(parsedRows);

      const detected = autoDetectContactosColumnMapping(parsedHeaders);
      setMapping(detected);

      // Si se detectó Razón Social automáticamente, saltar al paso 3 de preview
      if (detected.razonSocial) {
        const initialPreview = validateAndBuildContactosPreview({
          rows: parsedRows,
          mapping: detected,
          existingContactos,
          importStrategy,
          defaultRole
        });
        setPreview(initialPreview);
        setStep(3);
      } else {
        // Necesita confirmación de mapeo manual
        setStep(2);
      }
    } catch (err: any) {
      console.error('Error al leer archivo:', err);
      toast.error(err.message || 'Error al procesar el archivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Descarga de Plantilla Excel
  const handleDownloadExcelTemplate = async () => {
    try {
      const blob = await generateContactosExcelTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Plantilla_Contactos_IEBA.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Plantilla Excel descargada');
    } catch (err) {
      console.error(err);
      toast.error('Error al generar plantilla Excel');
    }
  };

  // Descarga de Plantilla CSV
  const handleDownloadCsvTemplate = () => {
    try {
      const csv = generateContactosCsvTemplate();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Plantilla_Contactos_IEBA.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Plantilla CSV descargada');
    } catch (err) {
      console.error(err);
      toast.error('Error al generar plantilla CSV');
    }
  };

  // Importar desde agenda de celular (Contact Picker API para Android / Chrome Mobile)
  const handleImportFromPhoneAgenda = async () => {
    if (!('contacts' in navigator && 'select' in (navigator as any).contacts)) {
      toast.info('Tu navegador no soporta importar directo desde la agenda. Podés usar la plantilla Excel o CSV.');
      return;
    }
    try {
      const contacts = await (navigator as any).contacts.select(['name', 'tel', 'email'], { multiple: true });
      if (contacts && contacts.length > 0) {
        const rows: Record<string, string>[] = contacts.map((c: any) => ({
          'Razón Social': (c.name && c.name[0]) || 'Sin nombre',
          'Teléfono': (c.tel && c.tel[0]) || '',
          'Email': (c.email && c.email[0]) || '',
          'Rol': defaultRole
        }));
        const newHeaders = ['Razón Social', 'Teléfono', 'Email', 'Rol'];
        setHeaders(newHeaders);
        setRawRows(rows);
        const map: ContactosColumnMapping = {
          razonSocial: 'Razón Social',
          telefono: 'Teléfono',
          email: 'Email',
          roles: 'Rol'
        };
        setMapping(map);
        const p = validateAndBuildContactosPreview({
          rows,
          mapping: map,
          existingContactos,
          importStrategy,
          defaultRole
        });
        setPreview(p);
        setStep(3);
        toast.success(`Se seleccionaron ${contacts.length} contactos de la agenda`);
      }
    } catch (err) {
      console.log('Operación de agenda cancelada o fallida:', err);
    }
  };

  // Ejecución final de la importación
  const handleExecuteImport = async () => {
    if (!preview) return;

    const rowsToImport = preview.rows.filter((r) => r.status === 'new' || r.status === 'update');
    if (rowsToImport.length === 0) {
      toast.error('No hay contactos válidos para importar en esta selección.');
      return;
    }

    setIsProcessing(true);
    try {
      const contactsToSave = rowsToImport.map((r) => r.data as Contacto);

      // Usar bulkPut para crear y actualizar idénticamente en Dexie
      await db.contactos.bulkPut(contactsToSave);

      // Retrocompatibilidad con tablas heredadas clientes / proveedores
      const clientesToSave = contactsToSave.filter((c) => c.roles?.includes('cliente'));
      const proveedoresToSave = contactsToSave.filter((c) => c.roles?.includes('proveedor'));

      if (clientesToSave.length > 0) {
        await db.clientes.bulkPut(clientesToSave);
      }
      if (proveedoresToSave.length > 0) {
        await db.proveedores.bulkPut(proveedoresToSave);
      }

      toast.success(`¡Se importaron ${rowsToImport.length} contactos exitosamente!`);
      onSuccess?.(rowsToImport.length);
      onClose();
    } catch (err: any) {
      console.error('Error al guardar contactos en base de datos:', err);
      toast.error(err.message || 'Error al guardar contactos en el dispositivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-scrim/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-high text-on-surface w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="p-4 sm:p-5 border-b border-outline-variant/20 flex items-center justify-between gap-3 bg-surface-container-low">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="import-modal-title" className="font-bold text-base sm:text-lg text-on-surface truncate">
                Importar Directorio de Contactos
              </h3>
              <p className="text-xs text-on-surface-variant truncate">
                Carga masiva de Clientes y Proveedores desde Excel (.xlsx, .xls) o CSV
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-full transition cursor-pointer shrink-0"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pasos / Stepper Indicator */}
        <div className="px-5 py-2.5 bg-surface-container border-b border-outline-variant/15 flex items-center justify-between text-xs font-semibold">
          <div className={`flex items-center gap-1.5 ${step === 1 ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-primary text-on-primary' : 'bg-surface-container-highest'}`}>1</span>
            <span>Seleccionar Archivo</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-outline-variant shrink-0" />
          <div className={`flex items-center gap-1.5 ${step === 2 ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-primary text-on-primary' : 'bg-surface-container-highest'}`}>2</span>
            <span>Mapeo de Columnas</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-outline-variant shrink-0" />
          <div className={`flex items-center gap-1.5 ${step === 3 ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-primary text-on-primary' : 'bg-surface-container-highest'}`}>3</span>
            <span>Previsualización & Importación</span>
          </div>
        </div>

        {/* Contenido del Modal */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* PASO 1: Subir Archivo y Descargar Plantillas */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const droppedFile = e.dataTransfer.files?.[0];
                  if (droppedFile) handleProcessFile(droppedFile);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2.5 ${
                  isDragging
                    ? 'border-primary bg-primary/10'
                    : 'border-outline-variant/40 hover:border-primary/60 bg-surface-container-lowest/50 hover:bg-surface-container-lowest'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) handleProcessFile(selected);
                  }}
                />
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">
                    Hacé clic o arrastrá tu archivo Excel o CSV aquí
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Soporta formatos <span className="font-mono font-semibold text-primary">.xlsx, .xls</span> y <span className="font-mono font-semibold text-primary">.csv</span>
                  </p>
                </div>
                {isProcessing && (
                  <div className="flex items-center gap-2 text-xs text-primary font-bold mt-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Leyendo y analizando archivo...</span>
                  </div>
                )}
              </div>

              {/* Botón de Agenda Móvil (si está disponible) */}
              {'contacts' in navigator && (
                <div className="p-3 bg-surface-container rounded-2xl border border-outline-variant/20 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-on-surface truncate">¿Estás en tu celular?</p>
                      <p className="text-[11px] text-on-surface-variant truncate">Podés seleccionar contactos directamente de la agenda de tu teléfono</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleImportFromPhoneAgenda}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 transition cursor-pointer"
                  >
                    Abrir Agenda
                  </button>
                </div>
              )}

              {/* Configuración de Importación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Estrategia de Duplicados */}
                <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20 space-y-2">
                  <label className="text-xs font-bold text-on-surface block">
                    Si el contacto ya existe (mismo CUIT o Nombre):
                  </label>
                  <div className="space-y-1.5 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="strategy"
                        value="update_existing"
                        checked={importStrategy === 'update_existing'}
                        onChange={() => setImportStrategy('update_existing')}
                        className="text-primary focus:ring-primary"
                      />
                      <span className="font-medium text-on-surface">Actualizar datos existentes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="strategy"
                        value="ignore_duplicates"
                        checked={importStrategy === 'ignore_duplicates'}
                        onChange={() => setImportStrategy('ignore_duplicates')}
                        className="text-primary focus:ring-primary"
                      />
                      <span className="font-medium text-on-surface">Ignorar y mantener intacto el existente</span>
                    </label>
                  </div>
                </div>

                {/* Rol por Defecto */}
                <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20 space-y-2">
                  <label className="text-xs font-bold text-on-surface block">
                    Rol por defecto (si la fila no lo especifica):
                  </label>
                  <div className="flex gap-2">
                    {[
                      { id: 'cliente', label: 'Cliente', icon: Users },
                      { id: 'proveedor', label: 'Proveedor', icon: Building }
                    ].map((r) => {
                      const isSel = defaultRole === r.id;
                      const Icon = r.icon;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setDefaultRole(r.id as RolContacto)}
                          className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                            isSel
                              ? 'bg-primary text-on-primary border-primary shadow-2xs'
                              : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border-outline-variant/30'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{r.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    Se aplicará a los registros que tengan la columna Rol en blanco.
                  </p>
                </div>
              </div>

              {/* Descarga de Plantillas */}
              <div className="pt-2 border-t border-outline-variant/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-on-surface-variant">¿No tenés una planilla armada? Descargá la plantilla oficial:</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadExcelTemplate}
                    className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-highest text-primary font-bold rounded-xl border border-outline-variant/30 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Plantilla Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-highest text-on-surface-variant font-medium rounded-xl border border-outline-variant/30 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Plantilla CSV</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: Confirmación de Mapeo de Columnas */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded-2xl border border-amber-500/20 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>
                  Revisá la correspondencia entre las columnas de tu archivo y los campos del sistema.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Razón Social (Obligatoria) */}
                <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/20 space-y-1">
                  <label className="font-bold text-on-surface block">
                    Razón Social / Nombre <span className="text-error font-black">*</span>
                  </label>
                  <select
                    value={mapping.razonSocial || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, razonSocial: e.target.value }))}
                    className="w-full bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 font-medium text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Seleccionar Columna --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* CUIT / DNI */}
                <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/20 space-y-1">
                  <label className="font-bold text-on-surface block">CUIT / DNI</label>
                  <select
                    value={mapping.cuitDni || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, cuitDni: e.target.value }))}
                    className="w-full bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 font-medium text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="">-- No mapear --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Condición IVA */}
                <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/20 space-y-1">
                  <label className="font-bold text-on-surface block">Condición IVA</label>
                  <select
                    value={mapping.condicionIVA || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, condicionIVA: e.target.value }))}
                    className="w-full bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 font-medium text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="">-- No mapear (Usa Consumidor Final) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rol */}
                <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/20 space-y-1">
                  <label className="font-bold text-on-surface block">Rol (Cliente / Proveedor)</label>
                  <select
                    value={mapping.roles || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, roles: e.target.value }))}
                    className="w-full bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 font-medium text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="">-- No mapear (Usa rol por defecto) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Teléfono */}
                <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/20 space-y-1">
                  <label className="font-bold text-on-surface block">Teléfono / WhatsApp</label>
                  <select
                    value={mapping.telefono || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, telefono: e.target.value }))}
                    className="w-full bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 font-medium text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="">-- No mapear --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Email */}
                <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/20 space-y-1">
                  <label className="font-bold text-on-surface block">Email</label>
                  <select
                    value={mapping.email || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 font-medium text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="">-- No mapear --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dirección */}
                <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/20 space-y-1">
                  <label className="font-bold text-on-surface block">Dirección</label>
                  <select
                    value={mapping.direccion || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, direccion: e.target.value }))}
                    className="w-full bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 font-medium text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="">-- No mapear --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Etiquetas */}
                <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/20 space-y-1">
                  <label className="font-bold text-on-surface block">Etiquetas / Tags</label>
                  <select
                    value={mapping.etiquetas || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, etiquetas: e.target.value }))}
                    className="w-full bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 font-medium text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="">-- No mapear --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* PASO 3: Previsualización de Resultados */}
          {step === 3 && preview && (
            <div className="space-y-4">
              {/* Tarjetas de Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-2xl border border-emerald-500/20 text-center">
                  <div className="text-xl font-black">{preview.newCount}</div>
                  <div className="font-semibold text-[11px]">Nuevos</div>
                </div>
                <div className="p-3 bg-sky-500/10 text-sky-700 dark:text-sky-300 rounded-2xl border border-sky-500/20 text-center">
                  <div className="text-xl font-black">{preview.updateCount}</div>
                  <div className="font-semibold text-[11px]">A Actualizar</div>
                </div>
                <div className="p-3 bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-2xl border border-amber-500/20 text-center">
                  <div className="text-xl font-black">{preview.skipCount}</div>
                  <div className="font-semibold text-[11px]">Omitidos</div>
                </div>
                <div className="p-3 bg-rose-500/10 text-rose-700 dark:text-rose-300 rounded-2xl border border-rose-500/20 text-center">
                  <div className="text-xl font-black">{preview.errorCount}</div>
                  <div className="font-semibold text-[11px]">Con Error</div>
                </div>
              </div>

              {/* Tabla de Muestra */}
              <div className="border border-outline-variant/20 rounded-2xl overflow-hidden bg-surface-container-lowest">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-container sticky top-0 text-[11px] font-bold text-on-surface-variant border-b border-outline-variant/20">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Razón Social / Nombre</th>
                        <th className="py-2 px-3">CUIT / DNI</th>
                        <th className="py-2 px-3">Rol</th>
                        <th className="py-2 px-3">Contacto</th>
                        <th className="py-2 px-3">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                      {preview.rows.slice(0, 50).map((r) => {
                        const isNew = r.status === 'new';
                        const isUpd = r.status === 'update';
                        const isSkip = r.status === 'skip';
                        const isErr = r.status === 'error';

                        return (
                          <tr key={r.rowNumber} className="hover:bg-surface-container-low/50">
                            <td className="py-2 px-3 font-mono text-[11px] text-on-surface-variant">
                              {r.rowNumber}
                            </td>
                            <td className="py-2 px-3 font-bold truncate max-w-[180px]">
                              {r.data.razonSocial || <span className="text-error font-normal">Sin nombre</span>}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px]">
                              {r.data.cuitDni || '-'}
                            </td>
                            <td className="py-2 px-3">
                              <span className="capitalize px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-container-highest">
                                {r.data.roles?.join(', ') || 'cliente'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-on-surface-variant truncate max-w-[140px]">
                              {r.data.telefono || r.data.email || '-'}
                            </td>
                            <td className="py-2 px-3">
                              {isNew && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3 h-3" /> Nuevo
                                </span>
                              )}
                              {isUpd && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                                  <RefreshCw className="w-3 h-3" /> Actualizar
                                </span>
                              )}
                              {isSkip && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full" title={r.errorMessage}>
                                  Omitido
                                </span>
                              )}
                              {isErr && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full" title={r.errorMessage}>
                                  <AlertCircle className="w-3 h-3" /> Error
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {preview.rows.length > 50 && (
                  <div className="p-2 text-center text-[11px] text-on-surface-variant bg-surface-container-low border-t border-outline-variant/15">
                    Mostrando las primeras 50 de {preview.rows.length} filas encontradas
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Barra Inferior de Acción */}
        <div className="p-4 sm:p-5 border-t border-outline-variant/20 bg-surface-container-low flex items-center justify-between gap-3">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev === 3 ? 2 : 1) as any)}
                className="px-4 py-2 bg-surface-container hover:bg-surface-container-highest text-on-surface font-semibold text-xs rounded-xl border border-outline-variant/30 transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>

            {step === 2 && (
              <button
                type="button"
                onClick={() => {
                  if (!mapping.razonSocial) {
                    toast.error('Debes seleccionar al menos la columna para Razón Social o Nombre');
                    return;
                  }
                  setStep(3);
                }}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continuar a Previsualización</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 3 && preview && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isProcessing || (preview.newCount === 0 && preview.updateCount === 0)}
                className="px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 text-on-primary font-bold text-xs sm:text-sm rounded-full shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Importar {preview.newCount + preview.updateCount} Contactos</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
