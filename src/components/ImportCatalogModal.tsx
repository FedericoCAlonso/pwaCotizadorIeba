import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, FileSpreadsheet, Upload, CheckCircle2, AlertCircle, ArrowRight, Table } from 'lucide-react';
import { db } from '../db/database';
import { Material, Producto, Oferta, CategoriaMaterial } from '../core/types';

interface ImportCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportCatalogModal: React.FC<ImportCatalogModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Select File, 2: Map Columns, 3: Dry-Run Preview
  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);

  // Column Mapping State
  const [mapping, setMapping] = useState<{
    nombre: string;
    categoria: string;
    unidad: string;
    norma: string;
    marca: string;
    precio: string;
    proveedor: string;
  }>({
    nombre: '',
    categoria: '',
    unidad: '',
    norma: '',
    marca: '',
    precio: '',
    proveedor: ''
  });

  // Parsed Preview Results
  const [parsedPreview, setParsedPreview] = useState<{
    materialesToCreate: Partial<Material>[];
    productosToCreate: Partial<Producto>[];
    ofertasToCreate: Partial<Oferta>[];
    ignoredCount: number;
  }>({
    materialesToCreate: [],
    productosToCreate: [],
    ofertasToCreate: [],
    ignoredCount: 0
  });

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
        if (jsonRows.length === 0) {
          alert('El archivo está vacío.');
          return;
        }

        const extractedHeaders = (jsonRows[0] as string[]).map(h => String(h || '').trim()).filter(Boolean);
        const dataRows = jsonRows.slice(1);

        setHeaders(extractedHeaders);
        setRawRows(dataRows);

        // Auto-guess mapping
        const autoMap = {
          nombre: extractedHeaders.find(h => /material|descrip|nombre|item|insumo/i.test(h)) || extractedHeaders[0] || '',
          categoria: extractedHeaders.find(h => /cat|rubro|familia|tipo/i.test(h)) || '',
          unidad: extractedHeaders.find(h => /unidad|unid|medida|u\.m/i.test(h)) || '',
          norma: extractedHeaders.find(h => /norma|iram|iec/i.test(h)) || '',
          marca: extractedHeaders.find(h => /marca|fabricante|modelo/i.test(h)) || '',
          precio: extractedHeaders.find(h => /precio|costo|valor|p\.u|monto/i.test(h)) || '',
          proveedor: extractedHeaders.find(h => /prov|distrib|vendedor/i.test(h)) || ''
        };

        setMapping(autoMap);
        setStep(2);
      } catch (err) {
        console.error('Error al procesar el archivo Excel/CSV:', err);
        alert('Ocurrió un error al leer el archivo. Asegúrate de subír un archivo .xlsx, .xls o .csv válido.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleGeneratePreview = () => {
    if (!mapping.nombre) {
      alert('Debes mapear al menos la columna del Nombre del Material.');
      return;
    }

    const nameIdx = headers.indexOf(mapping.nombre);
    const catIdx = headers.indexOf(mapping.categoria);
    const unitIdx = headers.indexOf(mapping.unidad);
    const normaIdx = headers.indexOf(mapping.norma);
    const marcaIdx = headers.indexOf(mapping.marca);
    const precioIdx = headers.indexOf(mapping.precio);
    const provIdx = headers.indexOf(mapping.proveedor);

    const matMap = new Map<string, Partial<Material>>();
    const prodList: Partial<Producto>[] = [];
    const ofertaList: Partial<Oferta>[] = [];
    let ignored = 0;

    const now = new Date().toISOString();

    rawRows.forEach((row, idx) => {
      const nombreVal = nameIdx > -1 ? String(row[nameIdx] || '').trim() : '';
      if (!nombreVal) {
        ignored++;
        return;
      }

      const catName = catIdx > -1 ? String(row[catIdx] || '').trim() : 'General';
      const unidadVal = unitIdx > -1 ? String(row[unitIdx] || '').trim() : 'u';
      const normaVal = normaIdx > -1 ? String(row[normaIdx] || '').trim() : '';
      const marcaVal = marcaIdx > -1 ? String(row[marcaIdx] || '').trim() : '';
      const precioVal = precioIdx > -1 ? parseFloat(String(row[precioIdx]).replace(/[^0-9.,]/g, '').replace(',', '.')) || 0 : 0;
      const provVal = provIdx > -1 ? String(row[provIdx] || '').trim() : '';

      const matKey = nombreVal.toLowerCase();
      let matId = `mat-imp-${matKey.replace(/[^a-z0-9]/g, '_')}`;

      if (!matMap.has(matKey)) {
        matMap.set(matKey, {
          id: matId,
          categoriaId: catName ? `cat-${catName.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : 'cat-sin-categoria',
          nombre: nombreVal,
          norma: normaVal,
          unidadVenta: unidadVal,
          atributos: [],
          activo: true,
          fichaIncompleta: false,
          createdAt: now,
          updatedAt: now
        });
      }

      if (marcaVal) {
        const prodId = `prod-imp-${matId}_${marcaVal.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        prodList.push({
          id: prodId,
          materialId: matId,
          marca: marcaVal,
          esPreferido: true
        });

        if (precioVal > 0) {
          ofertaList.push({
            id: `oferta-imp-${crypto.randomUUID()}`,
            materialId: matId,
            productoId: prodId,
            proveedorId: provVal ? `prov-${provVal.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : 'prov-general',
            precio: precioVal,
            fecha: now,
            fuente: 'importacion_excel'
          });
        }
      } else if (precioVal > 0) {
        ofertaList.push({
          id: `oferta-imp-${crypto.randomUUID()}`,
          materialId: matId,
          proveedorId: provVal ? `prov-${provVal.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : 'prov-general',
          precio: precioVal,
          fecha: now,
          fuente: 'importacion_excel'
        });
      }
    });

    setParsedPreview({
      materialesToCreate: Array.from(matMap.values()),
      productosToCreate: prodList,
      ofertasToCreate: ofertaList,
      ignoredCount: ignored
    });

    setStep(3);
  };

  const handleExecuteImport = async () => {
    try {
      await db.transaction('rw', [db.materiales, db.productos, db.ofertas, db.categoriasMaterial], async () => {
        // 1. Bulk Put Materiales
        if (parsedPreview.materialesToCreate.length > 0) {
          await db.materiales.bulkPut(parsedPreview.materialesToCreate as Material[]);
        }

        // 2. Bulk Put Productos
        if (parsedPreview.productosToCreate.length > 0) {
          await db.productos.bulkPut(parsedPreview.productosToCreate as Producto[]);
        }

        // 3. Bulk Put Ofertas
        if (parsedPreview.ofertasToCreate.length > 0) {
          await db.ofertas.bulkPut(parsedPreview.ofertasToCreate as Oferta[]);
        }
      });

      alert(`¡Importación exitosa!\n\n- ${parsedPreview.materialesToCreate.length} materiales procesados.\n- ${parsedPreview.productosToCreate.length} productos/marcas registrados.\n- ${parsedPreview.ofertasToCreate.length} ofertas de precios vigentes cargadas.`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error al volcar datos de la importación:', err);
      alert('Ocurrió un error al guardar los datos en la base de datos local.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-2xl shadow-2xl p-6 text-on-surface max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-on-surface">Importador Inteligente de Catálogos (Excel / CSV)</h3>
              <p className="text-xs text-on-surface-variant">Mapea columnas y previsualiza los cambios antes de guardar en el sistema.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-on-surface-variant hover:text-on-surface">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps Content */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {step === 1 && (
            <div className="p-10 border-2 border-dashed border-outline-variant/40 rounded-3xl text-center space-y-4 bg-surface-container-low">
              <Upload className="w-12 h-12 text-primary mx-auto" />
              <div>
                <h4 className="font-semibold text-sm text-on-surface">Selecciona o arrastra tu lista de precios / catálogo</h4>
                <p className="text-xs text-on-surface-variant mt-1">Soporta archivos .xlsx, .xls y .csv de proveedores y listas oficiales.</p>
              </div>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-xs cursor-pointer shadow-sm">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Explorar Archivo Excel</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 bg-surface-container-high rounded-2xl flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface">Archivo: {fileName}</span>
                <span className="text-on-surface-variant font-mono">{rawRows.length} filas detectadas</span>
              </div>

              <h4 className="font-semibold text-xs text-primary uppercase tracking-wider">Emparejar Columnas del Excel con el Sistema</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-on-surface-variant mb-1">Nombre / Descripción del Material *</label>
                  <select
                    value={mapping.nombre}
                    onChange={(e) => setMapping({ ...mapping, nombre: e.target.value })}
                    className="w-full p-2 bg-surface-container-high border border-outline-variant/30 rounded-xl text-on-surface"
                  >
                    <option value="">-- Seleccionar Columna --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-on-surface-variant mb-1">Precio Unitario ARS</label>
                  <select
                    value={mapping.precio}
                    onChange={(e) => setMapping({ ...mapping, precio: e.target.value })}
                    className="w-full p-2 bg-surface-container-high border border-outline-variant/30 rounded-xl text-on-surface"
                  >
                    <option value="">-- Seleccionar Columna --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-on-surface-variant mb-1">Marca / Fabricante</label>
                  <select
                    value={mapping.marca}
                    onChange={(e) => setMapping({ ...mapping, marca: e.target.value })}
                    className="w-full p-2 bg-surface-container-high border border-outline-variant/30 rounded-xl text-on-surface"
                  >
                    <option value="">-- No mapear --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-on-surface-variant mb-1">Categoría / Rubro</label>
                  <select
                    value={mapping.categoria}
                    onChange={(e) => setMapping({ ...mapping, categoria: e.target.value })}
                    className="w-full p-2 bg-surface-container-high border border-outline-variant/30 rounded-xl text-on-surface"
                  >
                    <option value="">-- No mapear --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-on-surface-variant mb-1">Unidad (m, u, kg)</label>
                  <select
                    value={mapping.unidad}
                    onChange={(e) => setMapping({ ...mapping, unidad: e.target.value })}
                    className="w-full p-2 bg-surface-container-high border border-outline-variant/30 rounded-xl text-on-surface"
                  >
                    <option value="">-- No mapear --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-on-surface-variant mb-1">Proveedor</label>
                  <select
                    value={mapping.proveedor}
                    onChange={(e) => setMapping({ ...mapping, proveedor: e.target.value })}
                    className="w-full p-2 bg-surface-container-high border border-outline-variant/30 rounded-xl text-on-surface"
                  >
                    <option value="">-- No mapear --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-700 dark:text-emerald-300 space-y-1 text-xs">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Resumen de Previsualización (Dry-Run)</span>
                </div>
                <p>Se procesaron {rawRows.length} filas del archivo Excel de forma segura en memoria:</p>
                <ul className="list-disc pl-5 pt-1 font-mono text-[11px]">
                  <li><strong>{parsedPreview.materialesToCreate.length}</strong> Materiales listos para ingresar/actualizar.</li>
                  <li><strong>{parsedPreview.productosToCreate.length}</strong> Productos / Marcas asociadas.</li>
                  <li><strong>{parsedPreview.ofertasToCreate.length}</strong> Ofertas de precio vigentes a guardar.</li>
                  <li><strong>{parsedPreview.ignoredCount}</strong> Filas omitidas por falta de nombre.</li>
                </ul>
              </div>

              <h4 className="font-semibold text-xs text-on-surface flex items-center gap-1.5">
                <Table className="w-4 h-4 text-primary" /> Muestra de los primeros registros a guardar:
              </h4>

              <div className="overflow-x-auto border border-outline-variant/20 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-high text-on-surface-variant">
                    <tr>
                      <th className="p-2.5">Material</th>
                      <th className="p-2.5">Unidad</th>
                      <th className="p-2.5 text-right">Precio ARS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {parsedPreview.materialesToCreate.slice(0, 5).map((m, idx) => {
                      const of = parsedPreview.ofertasToCreate.find(o => o.materialId === m.id);
                      return (
                        <tr key={idx}>
                          <td className="p-2.5 font-medium">{m.nombre}</td>
                          <td className="p-2.5">{m.unidadVenta}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-primary">
                            ${of ? of.precio?.toLocaleString('es-AR') : '0.00'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-outline-variant/30 flex justify-between items-center shrink-0">
          {step > 1 ? (
            <button
              onClick={() => setStep((step - 1) as any)}
              className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-variant rounded-full"
            >
              Atrás
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-variant rounded-full"
            >
              Cancelar
            </button>

            {step === 2 && (
              <button
                onClick={handleGeneratePreview}
                className="flex items-center gap-1.5 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold text-xs rounded-full shadow-sm"
              >
                <span>Previsualizar Cambios</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleExecuteImport}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs rounded-full shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar e Importar en la BD</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
