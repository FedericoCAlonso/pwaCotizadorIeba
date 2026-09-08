import { Contacto, RolContacto, CondicionIVA, TipoProveedor, PersonaContacto } from './types';

export interface ContactosColumnMapping {
  razonSocial: string;
  nombreFantasia?: string;
  cuitDni?: string;
  condicionIVA?: string;
  roles?: string;
  tipoProveedor?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  localidad?: string;
  provincia?: string;
  sitioWeb?: string;
  etiquetas?: string;
  personaNombre?: string;
  personaTelefono?: string;
  personaEmail?: string;
  personaRol?: string;
  notas?: string;
}

export interface ParsedContactoRow {
  rowNumber: number;
  data: Partial<Contacto>;
  persona?: PersonaContacto;
  status: 'new' | 'update' | 'skip' | 'error';
  errorMessage?: string;
  existingId?: string;
}

export interface ContactosImportPreview {
  rows: ParsedContactoRow[];
  totalRows: number;
  newCount: number;
  updateCount: number;
  skipCount: number;
  errorCount: number;
}

/**
 * Normaliza un string quitando tildes, signos y espacios superfluos en minúsculas.
 */
export function cleanKey(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Mapeo inteligente automático de cabeceras de columnas a campos de Contacto.
 */
export function autoDetectContactosColumnMapping(headers: string[]): ContactosColumnMapping {
  const mapping: ContactosColumnMapping = {
    razonSocial: ''
  };

  headers.forEach((h) => {
    const k = cleanKey(h);

    // Campos de persona de contacto (evaluar antes para no colisionar con teléfono/email de la empresa)
    if (!mapping.personaNombre && (k === 'personanombre' || k === 'personadecontacto' || k === 'contactoprincipal' || k === 'nombrepersona' || k === 'atencion' || (k.includes('persona') && k.includes('nombre')))) {
      mapping.personaNombre = h;
    } else if (!mapping.personaTelefono && (k === 'personatelefono' || k === 'telefonopersona' || k === 'celularpersona' || k === 'movilpersona' || k === 'telefonocontacto' || (k.includes('contacto') && (k.includes('tel') || k.includes('cel'))))) {
      mapping.personaTelefono = h;
    } else if (!mapping.personaEmail && (k === 'personaemail' || k === 'emailpersona' || k === 'correopersona' || k === 'mailpersona' || k === 'emailcontacto' || (k.includes('contacto') && (k.includes('email') || k.includes('correo') || k.includes('mail'))))) {
      mapping.personaEmail = h;
    } else if (!mapping.personaRol && (k === 'personarol' || k === 'rolpersona' || k === 'cargopersona' || k === 'puesto' || k === 'cargo')) {
      mapping.personaRol = h;
    } else if (!mapping.nombreFantasia && (k === 'nombrefantasia' || k === 'fantasia' || k === 'alias' || k === 'nombrecomercial')) {
      mapping.nombreFantasia = h;
    } else if (!mapping.razonSocial && !k.includes('persona') && (k.includes('razon') || k.includes('empresa') || k.includes('cliente') || k.includes('proveedor') || k === 'nombre' || k === 'contacto' || k === 'titular')) {
      mapping.razonSocial = h;
    } else if (!mapping.cuitDni && (k === 'cuit' || k === 'cuil' || k === 'dni' || k === 'cuitdni' || k === 'cuitcuil' || k === 'identificacion' || k === 'documento' || k.includes('cuit') || k.includes('cuil'))) {
      mapping.cuitDni = h;
    } else if (!mapping.condicionIVA && (k === 'condicioniva' || k === 'iva' || k === 'situacionfiscal' || k === 'categoriaiva' || k === 'tipoiva' || k.includes('iva'))) {
      mapping.condicionIVA = h;
    } else if (!mapping.roles && (k === 'rol' || k === 'roles' || k === 'tipocontacto' || k === 'tipo')) {
      mapping.roles = h;
    } else if (!mapping.tipoProveedor && (k === 'tipoproveedor' || k === 'rubroproveedor')) {
      mapping.tipoProveedor = h;
    } else if (!mapping.telefono && (k === 'telefono' || k === 'tel' || k === 'celular' || k === 'movil' || k === 'whatsapp' || k === 'telefonoempresa' || k.includes('telefono') || k.includes('celular'))) {
      mapping.telefono = h;
    } else if (!mapping.email && (k === 'email' || k === 'correo' || k === 'mail' || k === 'correoelectronico' || k === 'emailempresa' || k.includes('email') || k.includes('correo'))) {
      mapping.email = h;
    } else if (!mapping.direccion && (k === 'direccion' || k === 'domicilio' || k === 'calle' || k === 'direccionobra' || k === 'ubicacion')) {
      mapping.direccion = h;
    } else if (!mapping.localidad && (k === 'localidad' || k === 'ciudad' || k === 'municipio' || k === 'partido')) {
      mapping.localidad = h;
    } else if (!mapping.provincia && (k === 'provincia' || k === 'jurisdiccion' || k === 'estado')) {
      mapping.provincia = h;
    } else if (!mapping.sitioWeb && (k === 'sitioweb' || k === 'web' || k === 'pagina' || k === 'url')) {
      mapping.sitioWeb = h;
    } else if (!mapping.etiquetas && (k === 'etiquetas' || k === 'etiqueta' || k === 'tags' || k === 'tag' || k === 'rubro' || k === 'categoria')) {
      mapping.etiquetas = h;
    } else if (!mapping.notas && (k === 'notas' || k === 'nota' || k === 'observaciones' || k === 'comentarios' || k === 'detalle')) {
      mapping.notas = h;
    }
  });

  return mapping;
}

/**
 * Normaliza la condición de IVA según las opciones soportadas en el sistema.
 */
export function normalizeCondicionIVA(val: string): CondicionIVA {
  const k = cleanKey(val);
  if (k.includes('inscripto') || k === 'ri' || k === 'respins') {
    return 'Responsable Inscripto';
  }
  if (k.includes('monotribut') || k === 'mono') {
    return 'Monotributo';
  }
  if (k.includes('exento') || k === 'ex' || k.includes('noresponsable')) {
    return 'Exento';
  }
  return 'Consumidor Final';
}

/**
 * Normaliza los roles de contacto (cliente, proveedor o ambos).
 */
export function normalizeRoles(val: string, defaultRole: RolContacto = 'cliente'): RolContacto[] {
  const k = cleanKey(val);
  if (!k) return [defaultRole];

  if (k.includes('ambos') || k.includes('clienteyproveedor') || k.includes('proveedorycliente')) {
    return ['cliente', 'proveedor'];
  }
  if (k.includes('proveedor') || k.includes('proveedora') || k.includes('distribuidor')) {
    return ['proveedor'];
  }
  if (k.includes('cliente') || k.includes('comprador')) {
    return ['cliente'];
  }
  return [defaultRole];
}

/**
 * Normaliza y formatea CUIT / CUIL o DNI.
 */
export function normalizeCuitDni(val: string): string | undefined {
  if (!val) return undefined;
  const digits = val.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  }
  if (digits.length >= 7 && digits.length <= 8) {
    return digits;
  }
  return val.trim() || undefined;
}

/**
 * Parsea un texto CSV respetando comillas, comas o puntos y comas.
 */
export function parseCSVText(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Detectar delimitador (coma, punto y coma o tab)
  const firstLine = lines[0];
  const countComma = (firstLine.match(/,/g) || []).length;
  const countSemi = (firstLine.match(/;/g) || []).length;
  const countTab = (firstLine.match(/\t/g) || []).length;
  const delimiter = countSemi > countComma && countSemi > countTab ? ';' : countTab > countComma ? '\t' : ',';

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let inQuotes = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map((h, i) => h.trim() || `Columna_${i + 1}`);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (cells.every((c) => !c.trim())) continue; // omitir filas completamente vacías
    const rowObj: Record<string, string> = {};
    headers.forEach((h, colIdx) => {
      rowObj[h] = cells[colIdx] || '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

/**
 * Lee un archivo .xlsx, .xls o .csv y devuelve las cabeceras y filas.
 */
export async function readContactosFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

  if (isExcel) {
    const ExcelModule = await import('exceljs');
    const ExcelJS = ExcelModule.default || ExcelModule;
    const arrayBuffer = await file.arrayBuffer();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    // Obtener la primera hoja de trabajo
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('El archivo Excel no contiene hojas válidas.');
    }

    const headers: string[] = [];
    const rows: Record<string, string>[] = [];

    worksheet.eachRow((row, rowNumber) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      if (rowNumber === 1) {
        values.forEach((val, idx) => {
          const str = val !== null && val !== undefined ? String(val).trim() : `Columna_${idx + 1}`;
          headers.push(str || `Columna_${idx + 1}`);
        });
      } else {
        const rowObj: Record<string, string> = {};
        let hasData = false;
        headers.forEach((h, idx) => {
          const rawVal = values[idx];
          const strVal = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '';
          rowObj[h] = strVal;
          if (strVal) hasData = true;
        });
        if (hasData) {
          rows.push(rowObj);
        }
      }
    });

    return { headers, rows };
  } else {
    // Archivo CSV
    const text = await file.text();
    return parseCSVText(text);
  }
}

/**
 * Valida y construye la previsualización de importación, detectando duplicados y asignando estados.
 */
export function validateAndBuildContactosPreview(params: {
  rows: Record<string, string>[];
  mapping: ContactosColumnMapping;
  existingContactos: Contacto[];
  importStrategy: 'update_existing' | 'ignore_duplicates' | 'create_always';
  defaultRole?: RolContacto;
}): ContactosImportPreview {
  const { rows, mapping, existingContactos, importStrategy, defaultRole = 'cliente' } = params;

  // Mapas para búsqueda rápida de existentes
  const cuitMap = new Map<string, Contacto>();
  const nameMap = new Map<string, Contacto>();

  existingContactos.forEach((c) => {
    if (c.cuitDni) {
      const clean = c.cuitDni.replace(/\D/g, '');
      if (clean) cuitMap.set(clean, c);
    }
    const cleanName = cleanKey(c.razonSocial || c.nombre || '');
    if (cleanName) {
      nameMap.set(cleanName, c);
    }
  });

  const parsedRows: ParsedContactoRow[] = [];
  let newCount = 0;
  let updateCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // considerando fila 1 de cabeceras

    const rawName = mapping.razonSocial ? (row[mapping.razonSocial] || '').trim() : '';
    if (!rawName) {
      parsedRows.push({
        rowNumber: rowNum,
        data: {},
        status: 'error',
        errorMessage: 'Falta Razón Social o Nombre del contacto'
      });
      errorCount++;
      return;
    }

    const rawCuit = mapping.cuitDni ? (row[mapping.cuitDni] || '').trim() : '';
    const cuitClean = rawCuit ? normalizeCuitDni(rawCuit) : undefined;
    const cuitDigits = cuitClean ? cuitClean.replace(/\D/g, '') : undefined;

    const rawIVA = mapping.condicionIVA ? (row[mapping.condicionIVA] || '').trim() : '';
    const condicionIVA = rawIVA ? normalizeCondicionIVA(rawIVA) : 'Consumidor Final';

    const rawRoles = mapping.roles ? (row[mapping.roles] || '').trim() : '';
    const roles = normalizeRoles(rawRoles, defaultRole);

    const rawTipoProv = mapping.tipoProveedor ? (row[mapping.tipoProveedor] || '').trim() : '';
    const tipoProveedor: TipoProveedor =
      roles.includes('proveedor')
        ? cleanKey(rawTipoProv).includes('servicio')
          ? 'servicio'
          : cleanKey(rawTipoProv).includes('ambos') || cleanKey(rawTipoProv).includes('mixto')
          ? 'ambos'
          : 'material'
        : 'ambos';

    const rawEtiquetas = mapping.etiquetas ? (row[mapping.etiquetas] || '').trim() : '';
    const etiquetas = rawEtiquetas
      ? rawEtiquetas
          .split(/[,;\/]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const rawTel = mapping.telefono ? (row[mapping.telefono] || '').trim() : undefined;
    const rawEmail = mapping.email ? (row[mapping.email] || '').trim() : undefined;
    const rawDir = mapping.direccion ? (row[mapping.direccion] || '').trim() : undefined;
    const rawLoc = mapping.localidad ? (row[mapping.localidad] || '').trim() : undefined;
    const rawProv = mapping.provincia ? (row[mapping.provincia] || '').trim() : undefined;
    const rawWeb = mapping.sitioWeb ? (row[mapping.sitioWeb] || '').trim() : undefined;
    const rawNotas = mapping.notas ? (row[mapping.notas] || '').trim() : undefined;
    const rawFantasia = mapping.nombreFantasia ? (row[mapping.nombreFantasia] || '').trim() : undefined;

    // Persona de contacto opcional
    let persona: PersonaContacto | undefined = undefined;
    const rawPerNombre = mapping.personaNombre ? (row[mapping.personaNombre] || '').trim() : '';
    if (rawPerNombre) {
      persona = {
        id: `per-${crypto.randomUUID()}`,
        nombre: rawPerNombre,
        nombrePersona: rawPerNombre,
        telefono: mapping.personaTelefono ? (row[mapping.personaTelefono] || '').trim() || undefined : undefined,
        email: mapping.personaEmail ? (row[mapping.personaEmail] || '').trim() || undefined : undefined,
        rol: mapping.personaRol ? (row[mapping.personaRol] || '').trim() || undefined : undefined,
        esPrincipal: true
      };
    }

    // Comprobar si ya existe
    let matchedContacto: Contacto | undefined = undefined;
    if (cuitDigits && cuitMap.has(cuitDigits)) {
      matchedContacto = cuitMap.get(cuitDigits);
    } else {
      const kName = cleanKey(rawName);
      if (nameMap.has(kName)) {
        matchedContacto = nameMap.get(kName);
      }
    }

    const data: Partial<Contacto> = {
      razonSocial: rawName,
      nombre: rawName,
      nombreFantasia: rawFantasia,
      cuitDni: cuitClean,
      cuit: cuitClean,
      condicionIVA,
      roles,
      tipoProveedor,
      etiquetas,
      telefono: rawTel,
      email: rawEmail,
      direccion: rawDir,
      localidad: rawLoc,
      provincia: rawProv,
      sitioWeb: rawWeb,
      notas: rawNotas,
      contactos: persona ? [persona] : []
    };

    if (matchedContacto) {
      if (importStrategy === 'ignore_duplicates') {
        parsedRows.push({
          rowNumber: rowNum,
          data,
          persona,
          status: 'skip',
          existingId: matchedContacto.id,
          errorMessage: `Ya existe como "${matchedContacto.razonSocial}" (omitido)`
        });
        skipCount++;
      } else if (importStrategy === 'update_existing') {
        parsedRows.push({
          rowNumber: rowNum,
          data: {
            ...matchedContacto,
            ...data,
            id: matchedContacto.id,
            updatedAt: new Date().toISOString()
          },
          persona,
          status: 'update',
          existingId: matchedContacto.id
        });
        updateCount++;
      } else {
        // create_always
        parsedRows.push({
          rowNumber: rowNum,
          data: {
            ...data,
            id: `ct-${crypto.randomUUID()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deleted: false
          },
          persona,
          status: 'new'
        });
        newCount++;
      }
    } else {
      parsedRows.push({
        rowNumber: rowNum,
        data: {
          ...data,
          id: `ct-${crypto.randomUUID()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deleted: false
        },
        persona,
        status: 'new'
      });
      newCount++;
    }
  });

  return {
    rows: parsedRows,
    totalRows: rows.length,
    newCount,
    updateCount,
    skipCount,
    errorCount
  };
}

/**
 * Genera y descarga un archivo Excel (.xlsx) oficial como plantilla para importar contactos.
 */
export async function generateContactosExcelTemplate(): Promise<Blob> {
  const ExcelModule = await import('exceljs');
  const ExcelJS = ExcelModule.default || ExcelModule;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Cotizador IEBA';
  workbook.created = new Date();

  // Hoja 1: "Plantilla Contactos"
  const sheet = workbook.addWorksheet('Contactos', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  const columns = [
    { header: 'Razón Social / Nombre (*)', key: 'razonSocial', width: 28 },
    { header: 'Nombre Fantasía', key: 'nombreFantasia', width: 20 },
    { header: 'CUIT / DNI', key: 'cuitDni', width: 16 },
    { header: 'Condición IVA', key: 'condicionIVA', width: 22 },
    { header: 'Rol (Cliente / Proveedor / Ambos)', key: 'roles', width: 26 },
    { header: 'Tipo Proveedor (Material / Servicio)', key: 'tipoProveedor', width: 24 },
    { header: 'Teléfono', key: 'telefono', width: 18 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Dirección', key: 'direccion', width: 26 },
    { header: 'Localidad', key: 'localidad', width: 18 },
    { header: 'Provincia', key: 'provincia', width: 16 },
    { header: 'Etiquetas (separadas por coma)', key: 'etiquetas', width: 28 },
    { header: 'Contacto Persona', key: 'personaNombre', width: 20 },
    { header: 'Teléfono Contacto', key: 'personaTelefono', width: 18 },
    { header: 'Email Contacto', key: 'personaEmail', width: 22 },
    { header: 'Notas / Observaciones', key: 'notas', width: 30 }
  ];

  sheet.columns = columns;

  // Estilo de cabecera
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3B82F6' } // Blue 500
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  // Filas de ejemplo realistas
  sheet.addRow({
    razonSocial: 'ElectroTech S.A.',
    nombreFantasia: 'ElectroTech',
    cuitDni: '30-71234567-8',
    condicionIVA: 'Responsable Inscripto',
    roles: 'Cliente',
    tipoProveedor: '',
    telefono: '11-4567-8901',
    email: 'contacto@electrotech.com.ar',
    direccion: 'Av. Corrientes 1234, Piso 4',
    localidad: 'CABA',
    provincia: 'Buenos Aires',
    etiquetas: 'Industrial, Obras Nuevas, Prioritario',
    personaNombre: 'Ing. Martín Rossi',
    personaTelefono: '11-3456-7890',
    personaEmail: 'mrossi@electrotech.com.ar',
    notas: 'Cliente corporativo habitual. Exige Factura A con orden de compra.'
  });

  sheet.addRow({
    razonSocial: 'González, Carlos Alberto',
    nombreFantasia: '',
    cuitDni: '20-28945612-4',
    condicionIVA: 'Consumidor Final',
    roles: 'Cliente',
    tipoProveedor: '',
    telefono: '11-6789-0123',
    email: 'carlos.gonzalez@gmail.com',
    direccion: 'Calle Olavarría 456',
    localidad: 'Quilmes',
    provincia: 'Buenos Aires',
    etiquetas: 'Residencial, Tableros',
    personaNombre: 'Carlos González',
    personaTelefono: '11-6789-0123',
    personaEmail: 'carlos.gonzalez@gmail.com',
    notas: 'Reforma integral de casa particular.'
  });

  sheet.addRow({
    razonSocial: 'Distribuidora Eléctrica Central S.R.L.',
    nombreFantasia: 'DEC Materiales',
    cuitDni: '30-65432198-7',
    condicionIVA: 'Responsable Inscripto',
    roles: 'Proveedor',
    tipoProveedor: 'Material',
    telefono: '11-4321-9876',
    email: 'ventas@decelectrica.com.ar',
    direccion: 'Av. Juan B. Justo 7890',
    localidad: 'CABA',
    provincia: 'Buenos Aires',
    etiquetas: 'Cables, Térmicas, Iluminación',
    personaNombre: 'Romina Fernández',
    personaTelefono: '11-9876-5432',
    personaEmail: 'rfernandez@decelectrica.com.ar',
    notas: 'Proveedor principal de conductores y protecciones. Descuento 15% pago contado.'
  });

  // Hoja 2: "Instrucciones y Valores Válidos"
  const sheetInst = workbook.addWorksheet('Instrucciones');
  sheetInst.columns = [
    { header: 'CAMPO', key: 'campo', width: 25 },
    { header: 'OBLIGATORIO', key: 'obligatorio', width: 16 },
    { header: 'VALORES ADMITIDOS / EJEMPLO', key: 'valores', width: 55 }
  ];

  const headerInst = sheetInst.getRow(1);
  headerInst.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerInst.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF10B981' } // Emerald 500
  };
  headerInst.height = 26;

  sheetInst.addRow({
    campo: 'Razón Social / Nombre',
    obligatorio: 'SÍ',
    valores: 'Nombre de la persona o empresa (ej: "Juan Pérez" o "Tech Solutions S.A.")'
  });
  sheetInst.addRow({
    campo: 'CUIT / DNI',
    obligatorio: 'NO',
    valores: 'Con o sin guiones (ej: 30-71234567-8 o 20354441112 o 35444111)'
  });
  sheetInst.addRow({
    campo: 'Condición IVA',
    obligatorio: 'NO',
    valores: 'Responsable Inscripto, Monotributo, Consumidor Final, Exento, No Responsable'
  });
  sheetInst.addRow({
    campo: 'Rol',
    obligatorio: 'NO',
    valores: 'Cliente, Proveedor, Ambos (por defecto se asume "Cliente")'
  });
  sheetInst.addRow({
    campo: 'Tipo Proveedor',
    obligatorio: 'NO',
    valores: 'Material, Servicio o Ambos (solo aplica si el rol es Proveedor)'
  });
  sheetInst.addRow({
    campo: 'Etiquetas',
    obligatorio: 'NO',
    valores: 'Separadas por coma (ej: "Comercial, Mantenimiento, Obra Nueva")'
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

/**
 * Genera y descarga una plantilla CSV oficial con formato delimitado por comas UTF-8.
 */
export function generateContactosCsvTemplate(): string {
  const header =
    'Razón Social,Nombre Fantasía,CUIT / DNI,Condición IVA,Rol,Tipo Proveedor,Teléfono,Email,Dirección,Localidad,Provincia,Etiquetas,Contacto Persona,Teléfono Contacto,Email Contacto,Notas\n';
  const row1 =
    '"ElectroTech S.A.","ElectroTech","30-71234567-8","Responsable Inscripto","Cliente","","11-4567-8901","contacto@electrotech.com.ar","Av. Corrientes 1234","CABA","Buenos Aires","Industrial, Obras Nuevas","Ing. Martín Rossi","11-3456-7890","mrossi@electrotech.com.ar","Cliente corporativo habitual"\n';
  const row2 =
    '"González, Carlos Alberto","","20-28945612-4","Consumidor Final","Cliente","","11-6789-0123","carlos.gonzalez@gmail.com","Calle Olavarría 456","Quilmes","Buenos Aires","Residencial","Carlos González","11-6789-0123","carlos.gonzalez@gmail.com","Reforma de vivienda"\n';
  const row3 =
    '"Distribuidora Eléctrica Central","DEC Materiales","30-65432198-7","Responsable Inscripto","Proveedor","Material","11-4321-9876","ventas@decelectrica.com.ar","Av. Juan B. Justo 7890","CABA","Buenos Aires","Cables, Térmicas","Romina Fernández","11-9876-5432","rfernandez@decelectrica.com.ar","Proveedor de insumos eléctricos"\n';

  return header + row1 + row2 + row3;
}
