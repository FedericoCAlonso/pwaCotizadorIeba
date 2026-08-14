import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  X, FileSpreadsheet, Upload, CheckCircle2, ArrowRight, Table, Download, RefreshCw
} from 'lucide-react';
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
  const [importMode, setImportMode] = useState<'merge' | 'create_only'>('merge');

  // Column Mapping State (Sin Proveedor)
  const [mapping, setMapping] = useState<{
    nombre: string;
    categoria: string;
    unidad: string;
    norma: string;
    marca: string;
    precio: string;
  }>({
    nombre: '',
    categoria: '',
    unidad: '',
    norma: '',
    marca: '',
    precio: ''
  });

  // Parsed Preview Results
  const [parsedPreview, setParsedPreview] = useState<{
    materialesToCreate: Partial<Material>[];
    productosToCreate: Partial<Producto>[];
    ofertasToCreate: Partial<Oferta>[];
    categoriasToCreate: Partial<CategoriaMaterial>[];
    ignoredCount: number;
    updatedCount: number;
    newCount: number;
  }>({
    materialesToCreate: [],
    productosToCreate: [],
    ofertasToCreate: [],
    categoriasToCreate: [],
    ignoredCount: 0,
    updatedCount: 0,
    newCount: 0
  });

  if (!isOpen) return null;

  /**
   * Genera y descarga la plantilla Excel (.xlsx) estructurada usando ExcelJS:
   * - Hoja 1: "Materiales" (Tabla Oficial de Excel con Validación de Datos en columna Categoría)
   * - Hoja 2: "Categorías" (Tabla Oficial de Excel con las categorías de Dexie)
   */
  const handleDownloadExcelTemplate = async () => {
    try {
      const ExcelModule = await import('exceljs');
      const ExcelJS = ExcelModule.default || ExcelModule;

      const existingCats = await db.categoriasMaterial.toArray();

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Cotizador IEBA';
      workbook.created = new Date();

      // Hoja 2: "Categorías"
      const sheetCats = workbook.addWorksheet('Categorías');

      const catTableRows = existingCats.map(c => [c.nombre]);
      sheetCats.addTable({
        name: 'TablaCategorias',
        ref: 'A1',
        headerRow: true,
        totalsRow: false,
        style: {
          theme: 'TableStyleMedium2',
          showRowStripes: true,
        },
        columns: [{ name: 'Nombre_Categoria', filterButton: true }],
        rows: catTableRows.length > 0 ? catTableRows : [['Cables & Conductores'], ['Protecciones Eléctricas']]
      });
      sheetCats.getColumn(1).width = 38;

      // Hoja 1: "Materiales"
      const sheetMat = workbook.addWorksheet('Materiales');

      const sampleCatName = existingCats[0]?.nombre || 'Cables & Conductores';

      sheetMat.addTable({
        name: 'TablaMateriales',
        ref: 'A1',
        headerRow: true,
        totalsRow: false,
        style: {
          theme: 'TableStyleMedium9',
          showRowStripes: true,
        },
        columns: [
          { name: 'Nombre / Descripción', filterButton: true },
          { name: 'Categoría', filterButton: true },
          { name: 'Unidad', filterButton: true },
          { name: 'Norma', filterButton: true },
          { name: 'Marca', filterButton: true },
          { name: 'Precio Referencia ARS', filterButton: true }
        ],
        rows: [
          ['Cable Unipolar 2.5 mm² IRAM 247-3', sampleCatName, 'm', 'IRAM 247-3', 'Prysmian', 720]
        ]
      });

      sheetMat.getColumn(1).width = 42;
      sheetMat.getColumn(2).width = 32;
      sheetMat.getColumn(3).width = 12;
      sheetMat.getColumn(4).width = 16;
      sheetMat.getColumn(5).width = 22;
      sheetMat.getColumn(6).width = 22;

      // Aplicar Validación de Datos (dataValidation dropdown list) en la columna Categoría (B2:B100)
      const lastCatRow = Math.max(2, (catTableRows.length > 0 ? catTableRows.length : 2) + 1);
      const catFormula = `'Categorías'!$A$2:$A$${lastCatRow}`;

      for (let r = 2; r <= 100; r++) {
        sheetMat.getCell(`B${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [catFormula]
        };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Plantilla_Importacion_Materiales_IEBA.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al generar plantilla Excel con ExcelJS:', err);
      alert('Ocurrió un error al generar la plantilla Excel.');
    }
  };

  /**
   * Genera y descarga 2 planillas CSV separadas:
   * - Plantilla_Materiales.csv (solo encabezados)
   * - Plantilla_Categorias.csv (listado de categorías)
   */
  const handleDownloadCSVTemplate = async () => {
    try {
      const existingCats = await db.categoriasMaterial.toArray();

      // CSV 1: Materiales
      const csvMat = 'Nombre / Descripción,Categoría,Unidad,Norma,Marca,Precio Referencia ARS\n';
      const blobMat = new Blob([csvMat], { type: 'text/csv;charset=utf-8;' });
      const a1 = document.createElement('a');
      a1.href = URL.createObjectURL(blobMat);
      a1.download = 'Plantilla_Materiales.csv';
      a1.click();
      URL.revokeObjectURL(a1.href);

      // CSV 2: Categorías
      let csvCats = 'Nombre de la Categoría\n';
      existingCats.forEach(c => {
        csvCats += `"${c.nombre.replace(/"/g, '""')}"\n`;
      });
      const blobCats = new Blob([csvCats], { type: 'text/csv;charset=utf-8;' });
      const a2 = document.createElement('a');
      a2.href = URL.createObjectURL(blobCats);
      a2.download = 'Plantilla_Categorias.csv';
      setTimeout(() => {
        a2.click();
        URL.revokeObjectURL(a2.href);
      }, 300);
    } catch (err) {
      console.error('Error al generar planillas CSV:', err);
      alert('Ocurrió un error al generar las planillas CSV.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1, defval: '' });
        if (jsonRows.length === 0) {
          alert('El archivo está vacío.');
          return;
        }

        const extractedHeaders = (jsonRows[0] as string[]).map(h => String(h || '').trim()).filter(Boolean);
        // Filtrar filas completamente vacías
        const dataRows = jsonRows.slice(1).filter((r: any[]) => r && r.some(cell => String(cell || '').trim() !== ''));

        setHeaders(extractedHeaders);
        setRawRows(dataRows);

        // Smart Synonym Regex Matching
        const autoMap = {
          nombre: extractedHeaders.find(h => /material|descrip|nombre|item|insumo|art|articulo|detalle|producto/i.test(h)) || extractedHeaders[0] || '',
          categoria: extractedHeaders.find(h => /cat|rubro|familia|tipo|grupo|linea/i.test(h)) || '',
          unidad: extractedHeaders.find(h => /unidad|unid|medida|u\.m|pres|empaque/i.test(h)) || '',
          norma: extractedHeaders.find(h => /norma|iram|iec/i.test(h)) || '',
          marca: extractedHeaders.find(h => /marca|fabricante|modelo/i.test(h)) || '',
          precio: extractedHeaders.find(h => /precio|costo|valor|p\.u|monto|p\.lista|pneto|neto|importe/i.test(h)) || ''
        };

        setMapping(autoMap);
        setStep(2);
      } catch (err) {
        console.error('Error al procesar el archivo Excel/CSV:', err);
        alert('Ocurrió un error al leer el archivo. Asegúrate de subir un archivo .xlsx, .xls o .csv válido.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  /**
   * Helper para obtener valores de muestra para la vista previa del mapeo.
   */
  const getSampleValues = (headerName: string) => {
    if (!headerName) return null;
    const idx = headers.indexOf(headerName);
    if (idx === -1) return null;
    const samples = rawRows
      .slice(0, 3)
      .map(r => r[idx])
      .filter(v => v !== undefined && v !== null && String(v).trim() !== '');
    if (samples.length === 0) return null;
    return samples.map(s => String(s)).join('  |  ');
  };

  const handleGeneratePreview = async () => {
    if (!mapping.nombre) {
      alert('Debes mapear al menos la columna del Nombre / Descripción del Material.');
      return;
    }

    const existingCategories = await db.categoriasMaterial.toArray();
    const existingMaterials = await db.materiales.toArray();

    const nameIdx = headers.indexOf(mapping.nombre);
    const catIdx = headers.indexOf(mapping.categoria);
    const unitIdx = headers.indexOf(mapping.unidad);
    const normaIdx = headers.indexOf(mapping.norma);
    const marcaIdx = headers.indexOf(mapping.marca);
    const precioIdx = headers.indexOf(mapping.precio);

    const matMap = new Map<string, Partial<Material>>();
    const catMap = new Map<string, Partial<CategoriaMaterial>>();
    const prodList: Partial<Producto>[] = [];
    const ofertaList: Partial<Oferta>[] = [];
    let ignored = 0;
    let updatedExistingCount = 0;
    let createdNewCount = 0;

    const now = new Date().toISOString();
    const existingMatByNameMap = new Map(existingMaterials.map(m => [m.nombre.trim().toLowerCase(), m]));

    // Matcher y creación On-the-fly de categorías
    const resolveCategoryId = (excelCatName: string): string => {
      if (!excelCatName) return 'cat-sin-categoria';
      const normCat = excelCatName.trim().toLowerCase();

      // 1. Coincidencia exacta por ID o nombre
      const directMatch = existingCategories.find(c =>
        c.nombre.toLowerCase() === normCat || c.id.toLowerCase() === normCat
      );
      if (directMatch) return directMatch.id;

      // 2. Coincidencia difusa por palabras clave estándar de electricidad
      if (normCat.includes('cable') || normCat.includes('conductor')) return 'cat-cables';
      if (normCat.includes('termic') || normCat.includes('disyuntor') || normCat.includes('protec')) return 'cat-protecciones';
      if (normCat.includes('caño') || normCat.includes('canal') || normCat.includes('ducto')) return 'cat-canalizaciones';
      if (normCat.includes('caja') || normCat.includes('bastidor') || normCat.includes('modulo')) return 'cat-cajas';
      if (normCat.includes('tablero') || normCat.includes('gabinete')) return 'cat-tableros';
      if (normCat.includes('ilumin') || normCat.includes('lamp') || normCat.includes('led')) return 'cat-iluminacion';
      if (normCat.includes('medicion') || normCat.includes('jabalina') || normCat.includes('pat')) return 'cat-medicion';

      // 3. Creación On-the-fly si el usuario tipeó una categoría nueva en el Excel
      const newCatId = `cat-${normCat.replace(/[^a-z0-9]/g, '_')}`;
      if (!catMap.has(newCatId)) {
        catMap.set(newCatId, {
          id: newCatId,
          nombre: excelCatName.trim(),
          atributosSugeridos: []
        });
      }
      return newCatId;
    };

    rawRows.forEach((row) => {
      const nombreVal = nameIdx > -1 ? String(row[nameIdx] || '').trim() : '';
      if (!nombreVal) {
        ignored++;
        return;
      }

      const catName = catIdx > -1 ? String(row[catIdx] || '').trim() : '';
      const resolvedCatId = resolveCategoryId(catName);
      const unidadVal = unitIdx > -1 ? String(row[unitIdx] || '').trim() : 'u';
      const normaVal = normaIdx > -1 ? String(row[normaIdx] || '').trim() : '';
      const marcaVal = marcaIdx > -1 ? String(row[marcaIdx] || '').trim() : '';
      const precioVal = precioIdx > -1 ? parseFloat(String(row[precioIdx]).replace(/[^0-9.,]/g, '').replace(',', '.')) || 0 : 0;

      const matKey = nombreVal.toLowerCase();
      const existingMat = existingMatByNameMap.get(matKey);

      let matId = '';
      if (importMode === 'merge' && existingMat) {
        matId = existingMat.id;
        updatedExistingCount++;
      } else {
        matId = `mat-imp-${matKey.replace(/[^a-z0-9]/g, '_')}`;
        createdNewCount++;
      }

      if (!matMap.has(matKey)) {
        const baseAttrs = existingMat ? [...existingMat.atributos] : [];
        if (normaVal && !baseAttrs.some(a => a.clave === 'norma')) {
          baseAttrs.push({ clave: 'norma', valor: normaVal });
        }

        matMap.set(matKey, {
          id: matId,
          categoriaId: resolvedCatId,
          nombre: nombreVal,
          unidadVenta: unidadVal || (existingMat ? existingMat.unidadVenta : 'u'),
          atributos: baseAttrs,
          activo: true,
          fichaIncompleta: false,
          createdAt: existingMat ? existingMat.createdAt : now,
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
            proveedorId: 'prov-general',
            precio: precioVal,
            fecha: now,
            fuente: 'importacion_excel'
          });
        }
      } else if (precioVal > 0) {
        ofertaList.push({
          id: `oferta-imp-${crypto.randomUUID()}`,
          materialId: matId,
          proveedorId: 'prov-general',
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
      categoriasToCreate: Array.from(catMap.values()),
      ignoredCount: ignored,
      updatedCount: updatedExistingCount,
      newCount: createdNewCount
    });

    setStep(3);
  };

  const handleExecuteImport = async () => {
    try {
      await db.transaction('rw', [db.materiales, db.productos, db.ofertas, db.categoriasMaterial], async () => {
        // 1. Guardar nuevas categorías creadas On-the-fly
        if (parsedPreview.categoriasToCreate.length > 0) {
          await db.categoriasMaterial.bulkPut(parsedPreview.categoriasToCreate as CategoriaMaterial[]);
        }

        // 2. Guardar Materiales
        if (parsedPreview.materialesToCreate.length > 0) {
          await db.materiales.bulkPut(parsedPreview.materialesToCreate as Material[]);
        }

        // 3. Guardar Productos
        if (parsedPreview.productosToCreate.length > 0) {
          await db.productos.bulkPut(parsedPreview.productosToCreate as Producto[]);
        }

        // 4. Guardar Ofertas de Referencia
        if (parsedPreview.ofertasToCreate.length > 0) {
          await db.ofertas.bulkPut(parsedPreview.ofertasToCreate as Oferta[]);
        }
      });

      alert(
        `¡Importación de materiales completada con éxito!\n\n` +
        `- ${parsedPreview.materialesToCreate.length} materiales procesados (${parsedPreview.updatedCount} actualizados, ${parsedPreview.newCount} nuevos).\n` +
        (parsedPreview.categoriasToCreate.length > 0 ? `- ${parsedPreview.categoriasToCreate.length} nuevas categorías creadas On-the-fly incorporadas al sistema.\n` : '') +
        `- ${parsedPreview.productosToCreate.length} marcas registradas.\n` +
        `- ${parsedPreview.ofertasToCreate.length} precios de referencia guardados.`
      );
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error al guardar datos de la importación:', err);
      alert('Ocurrió un error al guardar los datos en la base de datos local.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-2xl shadow-2xl p-6 text-on-surface max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-on-surface">Importador Técnico de Materiales (ExcelJS / CSV)</h3>
              <p className="text-xs text-on-surface-variant">Generación avanzada con ExcelJS: Tablas Oficiales, Validación de Datos y Creación On-the-fly.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps Content */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-8 border-2 border-dashed border-outline-variant/40 rounded-3xl text-center space-y-4 bg-surface-container-low">
                <Upload className="w-12 h-12 text-primary mx-auto" />
                <div>
                  <h4 className="font-semibold text-sm text-on-surface">Selecciona tu lista o catálogo de materiales</h4>
                  <p className="text-xs text-on-surface-variant mt-1">Soporta archivos .xlsx, .xls y .csv de productos y fichas técnicas.</p>
                </div>
                <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-xs cursor-pointer shadow-sm">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Explorar Archivo Excel / CSV</span>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              {/* Botones Descargar Plantillas */}
              <div className="p-4 bg-surface-container-high rounded-2xl border border-outline-variant/20 space-y-2 text-xs">
                <div>
                  <h5 className="font-semibold text-on-surface">¿Deseas descargar planillas de plantilla estructuradas?</h5>
                  <p className="text-on-surface-variant text-[11px]">
                    Plantilla avanzada generada con ExcelJS (Tablas Oficiales + Validación de Datos desplegable vinculada a la hoja Categorías).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadExcelTemplate}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 rounded-xl font-semibold text-xs transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Plantilla Excel Avanzada (ExcelJS .xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCSVTemplate}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-container-highest text-on-surface hover:bg-surface-variant rounded-xl font-semibold text-xs transition-colors border border-outline-variant/30"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Plantillas CSV (2 Archivos .csv)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 bg-surface-container-high rounded-2xl flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface truncate max-w-[280px]">Archivo: {fileName}</span>
                <span className="text-primary font-mono font-bold bg-primary/10 px-2 py-0.5 rounded-full">{rawRows.length} filas</span>
              </div>

              {/* Selector de estrategia de importación */}
              <div className="p-3 bg-surface-container-low border border-outline-variant/30 rounded-2xl space-y-2">
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Modo de Importación & Deduplicación</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    importMode === 'merge'
                      ? 'bg-primary-container/30 border-primary text-on-primary-container font-semibold'
                      : 'bg-surface-container-highest border-outline-variant/30 text-on-surface-variant'
                  }`}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="block text-xs">Actualizar existencias (Recomendado)</span>
                      <span className="text-[10px] text-on-surface-variant font-normal">Actualiza si el material ya existe por nombre</span>
                    </div>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    importMode === 'create_only'
                      ? 'bg-primary-container/30 border-primary text-on-primary-container font-semibold'
                      : 'bg-surface-container-highest border-outline-variant/30 text-on-surface-variant'
                  }`}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'create_only'}
                      onChange={() => setImportMode('create_only')}
                      className="text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="block text-xs">Crear siempre nuevos ítems</span>
                      <span className="text-[10px] text-on-surface-variant font-normal">Agrega todo como ítem nuevo</span>
                    </div>
                  </label>
                </div>
              </div>

              <h4 className="font-semibold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-primary" /> Mapeo de Columnas con Previsualización
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Nombre / Descripción */}
                <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20">
                  <label className="block font-semibold text-on-surface mb-1">Nombre / Descripción del Material *</label>
                  <select
                    value={mapping.nombre}
                    onChange={(e) => setMapping({ ...mapping, nombre: e.target.value })}
                    className="w-full p-2 bg-surface-container-high border border-outline-variant/30 rounded-xl text-on-surface"
                  >
                    <option value="">-- Seleccionar Columna --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {getSampleValues(mapping.nombre) && (
                    <p className="text-[10px] text-on-surface-variant/80 mt-1 truncate">
                      <span className="font-semibold">Muestra:</span> {getSampleValues(mapping.nombre)}
                    </p>
                  )}
                </div>

                {/* Precio Referencia */}
                <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20">
                  <label className="block font-semibold text-on-surface mb-1">Precio Referencia ARS</label>
                  <select
                    value={mapping.precio}
                    onChange={(e) => setMapping({ ...mapping, precio: e.target.value })}
                    className="w-full p-2 bg-surface-container-high border border-outline-variant/30 rounded-xl text-on-surface"
                  >
                    <option value="">-- No mapear --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {getSampleValues(mapping.precio) && (
                    <p className="text-[10px] text-primary font-mono mt-1 truncate">
                      <span className="font-semibold text-on-surface-variant font-sans">Muestra:</span> {getSampleValues(mapping.precio)}
                    </p>
                  )}
                </div>

                {/* Marca / Fabricante */}
                <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20">
                  <label className="block font-semibold text-on-surface mb-1">Marca / Fabricante</label>
                  <select
                    value={mapping.marca}
                    onChange={(e) => setMapping({ ...mapping, marca: e.target.value })}
                    className="w-full p-2 bg-surface-container-high border border-outline-variant/30 rounded-xl text-on-surface"
                  >
                    <option value="">-- No mapear --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {getSampleValues(mapping.marca) && (
                    <p className="text-[10px] text-on-surface-variant/80 mt-1 truncate">
                      <span className="font-semibold">Muestra:</span> {getSampleValues(mapping.marca)}
                    </p>
                  )}
                </div>

                {/* Categoría / Rubro */}
                <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20">
                  <label className="block font-semibold text-on-surface mb-1">Categoría / Rubro</label>
                  <select
                    value={mapping.categoria}
                    onChange={(e) => setMapping({ ...mapping, categoria: e.target.value })}
                    className="w-full p-2 bg-surface-container-high border border-outline-variant/30 rounded-xl text-on-surface"
                  >
                    <option value="">-- Creación / Deducción On-the-fly --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {getSampleValues(mapping.categoria) && (
                    <p className="text-[10px] text-on-surface-variant/80 mt-1 truncate">
                      <span className="font-semibold">Muestra:</span> {getSampleValues(mapping.categoria)}
                    </p>
                  )}
                </div>

                {/* Unidad */}
                <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20 font-sans">
                  <label className="block font-semibold text-on-surface mb-1">Unidad (m, u, kg)</label>
                  <select
                    value={mapping.unidad}
                    onChange={(e) => setMapping({ ...mapping, unidad: e.target.value })}
                    className="w-full p-2 bg-surface-container-high border border-outline-variant/30 rounded-xl text-on-surface"
                  >
                    <option value="">-- Por defecto (u) --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {getSampleValues(mapping.unidad) && (
                    <p className="text-[10px] text-on-surface-variant/80 mt-1 truncate">
                      <span className="font-semibold">Muestra:</span> {getSampleValues(mapping.unidad)}
                    </p>
                  )}
                </div>

                {/* Norma */}
                <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20">
                  <label className="block font-semibold text-on-surface mb-1">Norma Técnico-Normativa</label>
                  <select
                    value={mapping.norma}
                    onChange={(e) => setMapping({ ...mapping, norma: e.target.value })}
                    className="w-full p-2 bg-surface-container-high border border-outline-variant/30 rounded-xl text-on-surface"
                  >
                    <option value="">-- No mapear --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {getSampleValues(mapping.norma) && (
                    <p className="text-[10px] text-on-surface-variant/80 mt-1 truncate">
                      <span className="font-semibold">Muestra:</span> {getSampleValues(mapping.norma)}
                    </p>
                  )}
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
                <p>Se analizaron {rawRows.length} filas del archivo de forma segura en memoria:</p>
                <ul className="list-disc pl-5 pt-1 font-mono text-[11px] space-y-0.5">
                  <li><strong>{parsedPreview.materialesToCreate.length}</strong> Materiales listos ({parsedPreview.updatedCount} actualizados, {parsedPreview.newCount} nuevos).</li>
                  {parsedPreview.categoriasToCreate.length > 0 && (
                    <li className="text-primary font-bold">
                      <strong>{parsedPreview.categoriasToCreate.length}</strong> nuevas categorías creadas On-the-fly.
                    </li>
                  )}
                  <li><strong>{parsedPreview.productosToCreate.length}</strong> Productos / Marcas asociadas.</li>
                  <li><strong>{parsedPreview.ignoredCount}</strong> Filas omitidas por falta de nombre o descripción.</li>
                </ul>
              </div>

              <h4 className="font-semibold text-xs text-on-surface flex items-center gap-1.5">
                <Table className="w-4 h-4 text-primary" /> Muestra de los primeros registros a procesar:
              </h4>

              <div className="overflow-x-auto border border-outline-variant/20 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-high text-on-surface-variant">
                    <tr>
                      <th className="p-2.5">Material</th>
                      <th className="p-2.5">Categoría ID</th>
                      <th className="p-2.5">Unidad</th>
                      <th className="p-2.5 text-right">Precio Ref. ARS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {parsedPreview.materialesToCreate.slice(0, 5).map((m, idx) => {
                      const of = parsedPreview.ofertasToCreate.find(o => o.materialId === m.id);
                      return (
                        <tr key={idx}>
                          <td className="p-2.5 font-medium">{m.nombre}</td>
                          <td className="p-2.5 text-[11px] font-mono text-on-surface-variant">{m.categoriaId}</td>
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
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs rounded-full shadow-sm active:scale-95 transition-transform"
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
