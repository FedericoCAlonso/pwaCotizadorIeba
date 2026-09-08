import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FolderPlus,
  Zap,
  Building2,
  MapPin,
  FileSpreadsheet,
  Calendar,
  Percent,
  ShieldAlert,
  DollarSign,
  Truck,
  Package,
  HardHat,
  Layers,
  Filter,
  Hash,
  Tag
} from 'lucide-react';
import { TareaTipo, Cliente, Insumo, CategoriaManoDeObra, CostoIndirecto } from '../../../core/types';
import { normalizeString, CursorContextType, scoreSearchMatch, CalculatedCell } from './dslParser';

export interface SlashCommandItem {
  id: string;
  category: 'tarea' | 'material' | 'mano_obra' | 'servicio' | 'capitulo' | 'directiva' | 'gasto';
  title: string;
  subtitle?: string;
  snippet: string;
  categoryTag?: string;
  extraText?: string;
  icon: React.FC<{ className?: string }>;
}

interface SlashCommandMenuProps {
  query: string;
  tareasTipo: TareaTipo[];
  clientes: Cliente[];
  clienteMatched?: Cliente;
  insumosMap?: Map<string, Insumo>;
  manoObraMap?: Map<string, CategoriaManoDeObra>;
  costosIndirectos?: CostoIndirecto[];
  contextType?: CursorContextType;
  directiveType?: 'cliente' | 'obra' | 'factura' | 'validez' | 'margen' | 'riesgo' | 'dolar';
  calculatedCells?: CalculatedCell[];
  isExplicit?: boolean;
  onSelect: (snippet: string) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  query,
  tareasTipo,
  clientes,
  clienteMatched,
  insumosMap,
  manoObraMap,
  costosIndirectos = [],
  contextType = 'general',
  directiveType,
  calculatedCells = [],
  isExplicit = false,
  onSelect,
  onClose,
  position
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasUserNavigated, setHasUserNavigated] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extraer categorías únicas de materiales
  const materialCategories = useMemo(() => {
    if (!insumosMap) return [];
    const set = new Set<string>();
    insumosMap.forEach((ins) => {
      if (ins.categoria) set.add(ins.categoria);
    });
    return Array.from(set).sort();
  }, [insumosMap]);

  // Si el usuario tipeó "cables/" o "#cables" en la query, extraer la categoría
  const { inlineCategory, effectiveQuery } = useMemo(() => {
    const raw = query.replace(/^[\/@]/, '').trim();
    const catSlashMatch = raw.match(/^([a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]+)[\/#:]\s*(.*)$/);
    if (catSlashMatch) {
      const candidateCat = normalizeString(catSlashMatch[1]);
      const matchedCat = materialCategories.find((c) => normalizeString(c) === candidateCat);
      if (matchedCat) {
        return {
          inlineCategory: matchedCat,
          effectiveQuery: catSlashMatch[2].trim()
        };
      }
    }
    return {
      inlineCategory: null,
      effectiveQuery: raw
    };
  }, [query, materialCategories]);

  const activeCategory = inlineCategory || selectedCategory;

  // Lista consolidada de sugerencias
  const items: SlashCommandItem[] = useMemo(() => {
    // 0a. Si la query empieza con "=", autocompletar variables de cálculo
    if (query.startsWith('=')) {
      const cleanVar = query.substring(1).trim().toLowerCase();
      const varList: SlashCommandItem[] = [];

      if (calculatedCells && calculatedCells.length > 0) {
        calculatedCells.forEach((c) => {
          varList.push({
            id: `var-${c.name}`,
            category: 'directiva',
            title: `=${c.name}`,
            subtitle: `Valor actual: ${c.evaluatedValue.toLocaleString('es-AR')} · ${c.isFormula ? c.rawExpression : 'constante'}`,
            snippet: `=${c.name}`,
            icon: Hash,
            extraText: `variable calculo formula celda ${c.name} ${c.rawExpression}`
          });
        });
      }

      if (!cleanVar) return varList;

      return varList
        .map((it) => ({
          item: it,
          score: scoreSearchMatch({ query: cleanVar, title: it.title, extraText: it.extraText })
        }))
        .filter((r) => r.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.item);
    }

    // 0. Si hay una directiva activa de cabecera, mostrar opciones exclusivas
    if (directiveType === 'cliente' || query.startsWith('@')) {
      const clientList: SlashCommandItem[] = [];
      clientes.forEach((cli) => {
        const name = cli.razonSocial || cli.nombre || 'Sin nombre';
        const cuitStr = (cli.cuitDni || cli.cuit) ? ` · CUIT: ${cli.cuitDni || cli.cuit}` : '';
        const ivaStr = cli.condicionIVA ? ` · ${cli.condicionIVA}` : '';
        const locStr = cli.localidad ? ` (${cli.localidad})` : '';
        const dirStr = cli.direccion ? ` · ${cli.direccion}${locStr}` : '';
        clientList.push({
          id: `cli-${cli.id}`,
          category: 'directiva',
          title: name,
          subtitle: `Cliente${cuitStr}${ivaStr}${dirStr}`,
          snippet: `cliente: ${name}\n`,
          icon: Building2,
          extraText: `${cli.cuitDni || ''} ${cli.cuit || ''} ${cli.direccion || ''} ${cli.localidad || ''} ${cli.email || ''} ${cli.telefono || ''} ${cli.condicionIVA || ''} ${cli.nombreFantasia || ''}`
        });
      });

      const cleanSearch = effectiveQuery.replace(/^@/, '').trim();
      const actionItem: SlashCommandItem = {
        id: 'cli-action-new',
        category: 'directiva',
        title: cleanSearch ? `+ Registrar "${cleanSearch}" en Contactos...` : '+ Registrar Nuevo Cliente...',
        subtitle: 'Crear ficha con CUIT, condición fiscal y domicilio de obra',
        snippet: `ACTION:NEW_CLIENT:${cleanSearch}`,
        icon: Building2,
        extraText: 'nuevo crear registrar contacto cliente comitente'
      };

      if (!cleanSearch) {
        return [...clientList.slice(0, 20), actionItem];
      }

      const scored = clientList
        .map((it) => ({
          item: it,
          score: scoreSearchMatch({
            query: cleanSearch,
            title: it.title,
            extraText: it.extraText
          })
        }))
        .filter((r) => r.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.item);

      scored.push(actionItem);
      return scored.slice(0, 25);
    }

    if (directiveType === 'factura') {
      const facturaOptions: SlashCommandItem[] = [
        {
          id: 'fac-a',
          category: 'directiva',
          title: 'Factura A',
          subtitle: 'Responsable Inscripto (IVA discriminado)',
          snippet: 'factura: Factura A\n',
          icon: FileSpreadsheet,
          extraText: 'factura a responsable inscripto iva ri'
        },
        {
          id: 'fac-b',
          category: 'directiva',
          title: 'Factura B',
          subtitle: 'Consumidor Final o Sujeto Exento',
          snippet: 'factura: Factura B\n',
          icon: FileSpreadsheet,
          extraText: 'factura b consumidor final exento cf'
        },
        {
          id: 'fac-c',
          category: 'directiva',
          title: 'Factura C',
          subtitle: 'Régimen Simplificado (Monotributo)',
          snippet: 'factura: Factura C\n',
          icon: FileSpreadsheet,
          extraText: 'factura c monotributo monotributista'
        },
        {
          id: 'fac-x',
          category: 'directiva',
          title: 'Presupuesto X (Sin Factura)',
          subtitle: 'Comercial interno sin comprobante fiscal',
          snippet: 'factura: Presupuesto X (Sin Factura)\n',
          icon: FileSpreadsheet,
          extraText: 'factura x presupuesto sin factura informal'
        }
      ];
      if (!effectiveQuery || !effectiveQuery.trim()) return facturaOptions;
      return facturaOptions
        .map((it) => ({
          item: it,
          score: scoreSearchMatch({ query: effectiveQuery, title: it.title, extraText: `${it.subtitle || ''} ${it.extraText || ''}` })
        }))
        .filter((r) => r.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.item);
    }

    if (directiveType === 'validez') {
      const validezOptions: SlashCommandItem[] = [
        { id: 'val-15', category: 'directiva', title: '15 dias', subtitle: 'Plazo estándar habitual', snippet: 'validez: 15 dias\n', icon: Calendar, extraText: '15 dias estandar normal' },
        { id: 'val-30', category: 'directiva', title: '30 dias', subtitle: 'Obras medianas o proyectos planificados', snippet: 'validez: 30 dias\n', icon: Calendar, extraText: '30 dias un mes' },
        { id: 'val-7', category: 'directiva', title: '7 dias', subtitle: 'Precios con alta volatilidad', snippet: 'validez: 7 dias\n', icon: Calendar, extraText: '7 dias una semana corto' },
        { id: 'val-60', category: 'directiva', title: '60 dias', subtitle: 'Licitaciones y grandes pliegos', snippet: 'validez: 60 dias\n', icon: Calendar, extraText: '60 dias dos meses' }
      ];
      if (!effectiveQuery || !effectiveQuery.trim()) return validezOptions;
      return validezOptions
        .map((it) => ({
          item: it,
          score: scoreSearchMatch({ query: effectiveQuery, title: it.title, extraText: `${it.subtitle || ''} ${it.extraText || ''}` })
        }))
        .filter((r) => r.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.item);
    }

    if (directiveType === 'margen') {
      const margenOptions: SlashCommandItem[] = [
        { id: 'mar-35', category: 'directiva', title: '35%', subtitle: 'Margen estándar recomendado', snippet: 'margen: 35%\n', icon: Percent, extraText: '35 por ciento estandar recomendado' },
        { id: 'mar-30', category: 'directiva', title: '30%', subtitle: 'Margen competitivo para obras grandes', snippet: 'margen: 30%\n', icon: Percent, extraText: '30 por ciento obra grande' },
        { id: 'mar-40', category: 'directiva', title: '40%', subtitle: 'Margen para obras complejas o urgencias', snippet: 'margen: 40%\n', icon: Percent, extraText: '40 por ciento compleja' },
        { id: 'mar-50', category: 'directiva', title: '50%', subtitle: 'Reparaciones pequeñas o alto valor agregado', snippet: 'margen: 50%\n', icon: Percent, extraText: '50 por ciento chico reparacion' },
        { id: 'mar-25', category: 'directiva', title: '25%', subtitle: 'Margen ajustado por volumen', snippet: 'margen: 25%\n', icon: Percent, extraText: '25 por ciento bajo volumen' }
      ];
      if (!effectiveQuery || !effectiveQuery.trim()) return margenOptions;
      return margenOptions
        .map((it) => ({
          item: it,
          score: scoreSearchMatch({ query: effectiveQuery, title: it.title, extraText: `${it.subtitle || ''} ${it.extraText || ''}` })
        }))
        .filter((r) => r.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.item);
    }

    if (directiveType === 'riesgo') {
      const riesgoOptions: SlashCommandItem[] = [
        { id: 'rie-normal', category: 'directiva', title: 'normal (5%)', subtitle: 'Riesgo estándar para reformas y trabajos habituales', snippet: 'riesgo: normal\n', icon: ShieldAlert, extraText: 'riesgo normal 5 por ciento estandar' },
        { id: 'rie-bajo', category: 'directiva', title: 'bajo (2.5%)', subtitle: 'Riesgo mínimo (obra nueva con planos detallados)', snippet: 'riesgo: bajo\n', icon: ShieldAlert, extraText: 'riesgo bajo 2.5 por ciento plano nuevo' },
        { id: 'rie-alto', category: 'directiva', title: 'alto (10%)', subtitle: 'Riesgo elevado (edificios antiguos, imprevistos o urgencias)', snippet: 'riesgo: alto\n', icon: ShieldAlert, extraText: 'riesgo alto 10 por ciento edificio viejo urgencia' }
      ];
      if (!effectiveQuery || !effectiveQuery.trim()) return riesgoOptions;
      return riesgoOptions
        .map((it) => ({
          item: it,
          score: scoreSearchMatch({ query: effectiveQuery, title: it.title, extraText: `${it.subtitle || ''} ${it.extraText || ''}` })
        }))
        .filter((r) => r.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.item);
    }

    if (directiveType === 'dolar') {
      const dolarOptions: SlashCommandItem[] = [
        { id: 'dol-blue', category: 'directiva', title: 'USD Blue = 1400', subtitle: 'Cotización informal de mercado', snippet: 'dolar: USD Blue = 1400\n', icon: DollarSign, extraText: 'dolar usd blue 1400 informal' },
        { id: 'dol-mep', category: 'directiva', title: 'USD MEP = 1350', subtitle: 'Cotización bursátil en blanco', snippet: 'dolar: USD MEP = 1350\n', icon: DollarSign, extraText: 'dolar usd mep 1350 bolsa bursatil' },
        { id: 'dol-oficial', category: 'directiva', title: 'USD Oficial = 1050', subtitle: 'Tipo de cambio Banco Nación', snippet: 'dolar: USD Oficial = 1050\n', icon: DollarSign, extraText: 'dolar usd oficial 1050 banco nacion' }
      ];
      if (!effectiveQuery || !effectiveQuery.trim()) return dolarOptions;
      return dolarOptions
        .map((it) => ({
          item: it,
          score: scoreSearchMatch({ query: effectiveQuery, title: it.title, extraText: `${it.subtitle || ''} ${it.extraText || ''}` })
        }))
        .filter((r) => r.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.item);
    }

    if (directiveType === 'obra') {
      const obraOptions: SlashCommandItem[] = [];
      if (clienteMatched?.direccion) {
        const fullDir = `${clienteMatched.direccion}${clienteMatched.localidad ? `, ${clienteMatched.localidad}` : ''}`;
        obraOptions.push({
          id: 'obra-domicilio-cliente',
          category: 'directiva',
          title: fullDir,
          subtitle: `Usar domicilio de ${clienteMatched.razonSocial || clienteMatched.nombre}`,
          snippet: `obra: ${fullDir}\n`,
          icon: MapPin,
          extraText: `obra direccion domicilio ${fullDir} cliente ${clienteMatched.razonSocial || clienteMatched.nombre}`
        });
      }
      clientes.forEach((cli) => {
        if (cli.direccion && cli.id !== clienteMatched?.id) {
          const fullDir = `${cli.direccion}${cli.localidad ? `, ${cli.localidad}` : ''}`;
          obraOptions.push({
            id: `obra-cli-${cli.id}`,
            category: 'directiva',
            title: fullDir,
            subtitle: `Domicilio de ${cli.razonSocial || cli.nombre}`,
            snippet: `obra: ${fullDir}\n`,
            icon: MapPin,
            extraText: `obra direccion domicilio ${fullDir} cliente ${cli.razonSocial || cli.nombre}`
          });
        }
      });
      if (!effectiveQuery || !effectiveQuery.trim()) return obraOptions.slice(0, 10);
      return obraOptions
        .map((it) => ({
          item: it,
          score: scoreSearchMatch({ query: effectiveQuery, title: it.title, extraText: `${it.subtitle || ''} ${it.extraText || ''}` })
        }))
        .filter((r) => r.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.item);
    }

    const list: SlashCommandItem[] = [];

    // 1. Insumos y Materiales del Catálogo (ÚNICAMENTE en sección de materiales)
    if (insumosMap && contextType === 'materiales') {
      insumosMap.forEach((ins) => {
        const brandTag = ins.marca ? ` [${ins.marca}]` : '';
        const brandSub = ins.marca ? ` · ${ins.marca}` : '';
        const priceStr = Math.round(ins.precioActual || 0).toLocaleString('es-AR');

        const defaultUnit = ins.unidad || 'u';

        // Snippet primario estructurado (bloque con propiedades, dejando cursor en cantidad)
        let blockSnippet = `- ${ins.nombre}:\n    cantidad: 1 ${defaultUnit}\n`;
        if (ins.marca) {
          blockSnippet += `    producto: ${ins.marca}\n`;
        }
        if (ins.precioActual && ins.precioActual > 0) {
          blockSnippet += `    precio: ${Math.round(ins.precioActual)}\n`;
        }

        // Opción 1: Bloque con propiedades prellenadas
        list.push({
          id: `ins-${ins.id}`,
          category: 'material',
          categoryTag: ins.categoria,
          title: ins.marca ? `${ins.nombre} [${ins.marca}]` : ins.nombre,
          subtitle: `Material · Bloque con propiedades · $ ${priceStr} / ${defaultUnit}${brandSub}${ins.categoria ? ` · ${ins.categoria}` : ''}`,
          snippet: blockSnippet,
          icon: Package,
          extraText: `${ins.categoria || ''} ${ins.marca || ''} ${ins.unidad || ''} ${ins.notas || ''} bloque propiedades cantidad producto precio`
        });

        // Opción 2: Línea compacta
        list.push({
          id: `ins-line-${ins.id}`,
          category: 'material',
          categoryTag: ins.categoria,
          title: `${ins.nombre}${brandTag} (Línea simple)`,
          subtitle: `Inserción rápida en un renglón · $ ${priceStr} / ${defaultUnit}`,
          snippet: `- 1 ${defaultUnit} ${ins.nombre}${brandTag}\n`,
          icon: Package,
          extraText: `${ins.categoria || ''} ${ins.marca || ''} ${ins.unidad || ''} linea simple directa`
        });
      });

      // Propiedades de Material (para escribir bajo un ítem como bloque YAML)
      list.push({
        id: 'prop-cantidad',
        category: 'directiva',
        title: 'cantidad: [valor]',
        subtitle: 'Propiedad · Cantidad y unidad del material (ej: 25 m, 4 u)',
        snippet: 'cantidad: ',
        icon: Hash,
        extraText: 'cantidad cant un unidad metros unidades'
      });
      list.push({
        id: 'prop-producto',
        category: 'directiva',
        title: 'producto: [Nombre o Marca]',
        subtitle: 'Propiedad · Producto comercial específico (ej: Prysmian Superplastic)',
        snippet: 'producto: ',
        icon: Tag,
        extraText: 'producto marca modelo fabricante'
      });
      list.push({
        id: 'prop-precio',
        category: 'directiva',
        title: 'precio: [Monto]',
        subtitle: 'Propiedad · Precio unitario manual para este material (ej: 1250)',
        snippet: 'precio: ',
        icon: DollarSign,
        extraText: 'precio costo valor'
      });
      list.push({
        id: 'prop-marca',
        category: 'directiva',
        title: 'marca: [Marca]',
        subtitle: 'Propiedad · Marca del fabricante',
        snippet: 'marca: ',
        icon: Tag,
        extraText: 'marca fabricante'
      });
      list.push({
        id: 'prop-unidad',
        category: 'directiva',
        title: 'unidad: [u, m, kg...]',
        subtitle: 'Propiedad · Unidad de medida técnica',
        snippet: 'unidad: ',
        icon: Hash,
        extraText: 'unidad medida u m kg'
      });

      // Directivas de transición hacia Mano de Obra o Condición
      list.push({
        id: 'dir-mat-mano-obra',
        category: 'directiva',
        title: 'mano_obra:',
        subtitle: 'Sección · Pasar a despiece de mano de obra y cuadrilla',
        snippet: 'mano_obra:\n  - ',
        icon: HardHat,
        extraText: 'mano de obra mo cuadrilla horas operarios'
      });
      list.push({
        id: 'dir-mat-condicion',
        category: 'directiva',
        title: 'condicion: [normal | dificultosa | favorable]',
        subtitle: 'Propiedad · Coeficiente de dificultad de la partida',
        snippet: 'condicion: normal\n',
        icon: Tag,
        extraText: 'condicion dificultad normal dificultosa favorable'
      });
    }

    // 2. Categorías de Mano de Obra (ÚNICAMENTE en sección mano de obra)
    if (manoObraMap && contextType === 'mano_obra') {
      manoObraMap.forEach((mo) => {
        list.push({
          id: `mo-${mo.id}`,
          category: 'mano_obra',
          title: `MO: ${mo.nombre}`,
          subtitle: `Mano de Obra · $ ${Math.round(mo.costoHora || 0).toLocaleString('es-AR')} / hora`,
          snippet: `- 4 h ${mo.nombre}\n`,
          icon: HardHat,
          extraText: `mano de obra ${mo.nombre}`
        });
      });

      // Propiedades de Mano de Obra
      list.push({
        id: 'prop-mo-horas',
        category: 'directiva',
        title: 'cantidad: [Horas]',
        subtitle: 'Propiedad · Horas estimadas de mano de obra (ej: 4 h)',
        snippet: 'cantidad: ',
        icon: Hash,
        extraText: 'cantidad horas tiempo dedicacion'
      });
      list.push({
        id: 'prop-mo-precio',
        category: 'directiva',
        title: 'precio: [Costo Hora]',
        subtitle: 'Propiedad · Costo por hora manual de la categoría',
        snippet: 'precio: ',
        icon: DollarSign,
        extraText: 'precio valor costo hora'
      });

      // Directivas de transición hacia Materiales o Condición
      list.push({
        id: 'dir-mo-materiales',
        category: 'directiva',
        title: 'materiales:',
        subtitle: 'Sección · Despiece de materiales e insumos',
        snippet: 'materiales:\n  - ',
        icon: Package,
        extraText: 'materiales insumos lista componentes'
      });
      list.push({
        id: 'dir-mo-condicion',
        category: 'directiva',
        title: 'condicion: [normal | dificultosa | favorable]',
        subtitle: 'Propiedad · Coeficiente de dificultad de la partida',
        snippet: 'condicion: normal\n',
        icon: Tag,
        extraText: 'condicion dificultad normal dificultosa favorable'
      });
    }

    // 3. Servicios y Subcontratos (ÚNICAMENTE en sección servicios)
    if (contextType === 'servicios') {
      const serviciosFrecuentes = [
        { nombre: 'Alquiler de andamio tubular (cuerpo c/ tablones)', precio: 25000, desc: 'Alquiler y armado de estructura de andamiaje' },
        { nombre: 'Volquete para escombros y retiro', precio: 45000, desc: 'Contenedor y gestión de residuos de obra' },
        { nombre: 'Alquiler grupo electrógeno 5 kVA', precio: 35000, desc: 'Generador autónomo monofásico' },
        { nombre: 'Hidroelevador / Grúa con operador', precio: 60000, desc: 'Trabajos en altura y tendidos aéreos' },
        { nombre: 'Medición de puesta a tierra con telurímetro', precio: 30000, desc: 'Protocolo SRT 900/15 y certificado' },
        { nombre: 'Flete y logística de traslado', precio: 20000, desc: 'Transporte de materiales e insumos pesados' },
        { nombre: 'Ayuda de gremio y caladuras', precio: 40000, desc: 'Canalizaciones y albañilería asociada' },
        { nombre: 'Medición de aislación con megóhmetro', precio: 28000, desc: 'Ensayo dieléctrico de conductores' }
      ];

      serviciosFrecuentes.forEach((sf, idx) => {
        list.push({
          id: `serv-frec-${idx}`,
          category: 'servicio',
          title: sf.nombre,
          subtitle: `Servicio sugerido · $ ${sf.precio.toLocaleString('es-AR')} · ${sf.desc}`,
          snippet: `- ${sf.nombre}: $ ${sf.precio}\n`,
          icon: Truck,
          extraText: `servicio alquiler subcontrato ${sf.nombre} ${sf.desc}`
        });
      });

      list.push({
        id: 'cmd-serv-libre',
        category: 'servicio',
        title: '⚡ Servicio / Subcontrato Libre',
        subtitle: 'Define un servicio ad-hoc con nombre y precio: - [Concepto]: $ [Monto]',
        snippet: `- Servicio Especial: $ 15000\n`,
        icon: Truck,
        extraText: 'servicio libre manual subcontrato alquiler costo'
      });

      list.push({
        id: 'prop-serv-precio',
        category: 'directiva',
        title: 'precio: [Monto]',
        subtitle: 'Propiedad · Precio o costo del servicio',
        snippet: 'precio: ',
        icon: DollarSign,
        extraText: 'precio costo valor'
      });

      list.push({
        id: 'prop-serv-cantidad',
        category: 'directiva',
        title: 'cantidad: [Número]',
        subtitle: 'Propiedad · Cantidad de unidades o jornadas',
        snippet: 'cantidad: ',
        icon: Hash,
        extraText: 'cantidad unidades computo'
      });
    }

    // 4. Despiece y Propiedades dentro de un Ítem / Partida
    if (contextType === 'item') {
      list.push({
        id: 'prop-item-materiales',
        category: 'directiva',
        title: 'materiales:',
        subtitle: 'Sección · Despiece de materiales e insumos de la partida',
        snippet: 'materiales:\n  - ',
        icon: Package,
        extraText: 'materiales insumos lista despiece componentes'
      });

      list.push({
        id: 'prop-item-mano-obra',
        category: 'directiva',
        title: 'mano_obra:',
        subtitle: 'Sección · Horas y categorías de mano de obra técnica',
        snippet: 'mano_obra:\n  - ',
        icon: HardHat,
        extraText: 'mano de obra horas mo oficiales ayudantes cuadrilla'
      });

      list.push({
        id: 'prop-item-servicios',
        category: 'directiva',
        title: 'servicios:',
        subtitle: 'Sección · Servicios tercerizados, alquileres y subcontratos',
        snippet: 'servicios:\n  - ',
        icon: Truck,
        extraText: 'servicios subcontratos alquileres equipos andamios volquete'
      });

      list.push({
        id: 'prop-item-precio',
        category: 'directiva',
        title: 'precio: [Monto]',
        subtitle: 'Propiedad · Precio unitario manual cerrado para la partida',
        snippet: 'precio: ',
        icon: DollarSign,
        extraText: 'precio valor costo manual monto cerrado'
      });

      list.push({
        id: 'prop-item-cantidad',
        category: 'directiva',
        title: 'cantidad: [Número o =fórmula]',
        subtitle: 'Propiedad · Cómputo o cantidad de unidades de la partida',
        snippet: 'cantidad: ',
        icon: Hash,
        extraText: 'cantidad cant unidades computo'
      });

      list.push({
        id: 'prop-item-unidad',
        category: 'directiva',
        title: 'unidad: [u | m | gl | boca]',
        subtitle: 'Propiedad · Unidad de medida técnica de la partida',
        snippet: 'unidad: ',
        icon: Hash,
        extraText: 'unidad medida u m gl boca'
      });

      list.push({
        id: 'prop-item-condicion',
        category: 'directiva',
        title: 'condicion: [normal | dificultosa | favorable]',
        subtitle: 'Propiedad · Coeficiente de dificultad para mano de obra',
        snippet: 'condicion: normal\n',
        icon: Tag,
        extraText: 'condicion trabajo dificultosa favorable normal multiplicador'
      });

      list.push({
        id: 'prop-item-calculos',
        category: 'directiva',
        title: 'calculos:',
        subtitle: 'Sección · Variables y cómputo local de la partida',
        snippet: 'calculos:\n  ',
        icon: Hash,
        extraText: 'calculos variables formulas celdas cascada computo'
      });
    }

    // 5. Gastos e Indirectos (ÚNICAMENTE en sección gastos)
    if (contextType === 'gastos') {
      // 1. Catálogo de Gastos y Modificadores de Costo
      if (costosIndirectos && costosIndirectos.length > 0) {
        costosIndirectos.filter((c) => !c.deleted).forEach((c) => {
          const mod = c.modalidad || (c.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo');
          let snippet = '';
          let subtitle = '';
          const destName =
            c.destino === 'mano_obra' ? 'Mano de Obra' :
            c.destino === 'materiales' ? 'Materiales' :
            c.destino === 'servicios' ? 'Servicios' :
            'Costos Directos';

          if (mod === 'porcentual') {
            const destSuffix = c.destino && c.destino !== 'costo_indirecto' ? ` sobre ${c.destino}` : ' sobre costo_directo';
            snippet = `- ${c.nombre}: ${c.valor}%${destSuffix}\n`;
            subtitle = `Catálogo · ${c.valor}% sobre ${destName}`;
          } else if (mod === 'parametrico' && c.formula) {
            snippet = `- ${c.nombre}: =${c.formula}\n`;
            subtitle = `Catálogo · Paramétrico: =${c.formula}`;
          } else {
            const valNum = Math.round(c.valor || 0);
            snippet = `- ${c.nombre}: $ ${valNum}\n`;
            subtitle = `Catálogo · Monto fijo $ ${valNum.toLocaleString('es-AR')}`;
          }

          list.push({
            id: `ci-${c.id}`,
            category: 'gasto',
            title: c.nombre,
            subtitle,
            snippet,
            icon: mod === 'porcentual' ? Percent : (mod === 'parametrico' ? Hash : DollarSign),
            extraText: `gasto indirecto catalogo modificador costo ${c.nombre} ${c.destino || 'costo_directo'} ${mod}`
          });
        });
      }

      // 2. Plantillas de Gastos Porcentuales con Destino Específico
      list.push({
        id: 'cmd-gasto-porcentual-mo',
        category: 'gasto',
        title: '⚡ Gasto Porcentual (s/ Mano de Obra)',
        subtitle: 'Aplica % sobre Mano de Obra (ej: ART, cargas sociales, viáticos MO)',
        snippet: `- Seguro ART: 8% sobre mano_obra\n`,
        icon: Percent,
        extraText: 'gasto porcentual mano obra mo art porcentaje seguro indirecto sobre mano_obra'
      });

      list.push({
        id: 'cmd-gasto-porcentual-mat',
        category: 'gasto',
        title: '⚡ Gasto Porcentual (s/ Materiales)',
        subtitle: 'Aplica % sobre Materiales e Insumos (ej: merma, roturas, flete insumos)',
        snippet: `- Merma de Materiales: 5% sobre materiales\n`,
        icon: Percent,
        extraText: 'gasto porcentual materiales insumos merma porcentaje flete sobre materiales'
      });

      list.push({
        id: 'cmd-gasto-porcentual-serv',
        category: 'gasto',
        title: '⚡ Gasto Porcentual (s/ Servicios)',
        subtitle: 'Aplica % sobre Subcontratos y Alquileres de Terceros (ej: coordinación)',
        snippet: `- Coordinación de Servicios: 5% sobre servicios\n`,
        icon: Percent,
        extraText: 'gasto porcentual servicios subcontratos coordinacion alquileres sobre servicios'
      });

      list.push({
        id: 'cmd-gasto-porcentual-directo',
        category: 'gasto',
        title: '⚡ Gasto Porcentual (s/ Costo Directo)',
        subtitle: 'Aplica % sobre todo el Costo Directo de obra (MO + Materiales + Servicios)',
        snippet: `- Gastos Generales: 10% sobre costo_directo\n`,
        icon: Percent,
        extraText: 'gasto porcentual costo directo totales imprevistos generales indirecto sobre costo_directo'
      });

      list.push({
        id: 'cmd-gasto-fijo',
        category: 'gasto',
        title: '⚡ Gasto Fijo ($)',
        subtitle: 'Define un monto en pesos fijo para la cotización: - [Concepto]: $ [Monto]',
        snippet: `- Flete y Logística: $ 25000\n`,
        icon: DollarSign,
        extraText: 'gasto fijo monto pesos dinero libre flete'
      });

      list.push({
        id: 'cmd-gasto-estructurado',
        category: 'gasto',
        title: '⚡ Gasto Estructurado (Bloque YAML)',
        subtitle: 'Define un gasto en bloque con porcentaje y categoría destino configurable',
        snippet: `- Gasto Personalizado:\n    porcentaje: 8%\n    aplica_a: mano_obra\n`,
        icon: Layers,
        extraText: 'gasto estructurado bloque yaml porcentaje destino aplica_a'
      });

      // 3. Propiedades para definir dentro de un bloque de gasto
      list.push({
        id: 'prop-gasto-porcentaje',
        category: 'directiva',
        title: 'porcentaje: 8%',
        subtitle: 'Define el porcentaje a aplicar sobre la base correspondiente',
        snippet: `porcentaje: 8%\n`,
        icon: Percent,
        extraText: 'porcentaje pct alicuota tasa'
      });

      list.push({
        id: 'prop-gasto-aplica-mo',
        category: 'directiva',
        title: 'aplica_a: mano_obra',
        subtitle: 'Aplica el porcentaje sobre el total de Mano de Obra',
        snippet: `aplica_a: mano_obra\n`,
        icon: HardHat,
        extraText: 'aplica_a destino mano de obra mo'
      });

      list.push({
        id: 'prop-gasto-aplica-mat',
        category: 'directiva',
        title: 'aplica_a: materiales',
        subtitle: 'Aplica el porcentaje sobre el total de Materiales e Insumos',
        snippet: `aplica_a: materiales\n`,
        icon: Package,
        extraText: 'aplica_a destino materiales insumos'
      });

      list.push({
        id: 'prop-gasto-aplica-serv',
        category: 'directiva',
        title: 'aplica_a: servicios',
        subtitle: 'Aplica el porcentaje sobre el total de Servicios Tercerizados',
        snippet: `aplica_a: servicios\n`,
        icon: Truck,
        extraText: 'aplica_a destino servicios subcontratos'
      });

      list.push({
        id: 'prop-gasto-aplica-directo',
        category: 'directiva',
        title: 'aplica_a: costo_directo',
        subtitle: 'Aplica el porcentaje sobre el total de Costos Directos',
        snippet: `aplica_a: costo_directo\n`,
        icon: ShieldAlert,
        extraText: 'aplica_a destino costo directo total'
      });

      list.push({
        id: 'prop-gasto-monto',
        category: 'directiva',
        title: 'monto: $ 25000',
        subtitle: 'Define un monto fijo en pesos para este gasto',
        snippet: `monto: 25000\n`,
        icon: DollarSign,
        extraText: 'monto precio valor fijo dinero'
      });

      // 4. Gastos frecuentes de referencia rápida
      const gastosFrecuentes = [
        { nombre: 'Viáticos y Movilidad', snippet: `- Viáticos y Movilidad: $ 15000\n`, desc: 'Traslados diarios del equipo y cuadrilla' },
        { nombre: 'Flete y Logística de Obra', snippet: `- Flete y Logística de Obra: $ 25000\n`, desc: 'Envío y acarreo de materiales e insumos pesados' },
        { nombre: 'Volquete y Retiro de Residuos', snippet: `- Volquete y Retiro de Residuos: $ 45000\n`, desc: 'Contenedor y disposición final de obra' },
        { nombre: 'Andamios y Estructuras de Trabajo', snippet: `- Andamios y Estructuras de Trabajo: $ 30000\n`, desc: 'Alquiler y habilitación de altura' },
        { nombre: 'Depósito, Pañol y Obrador', snippet: `- Depósito, Pañol y Obrador: $ 20000\n`, desc: 'Armado de puesto de trabajo y resguardo' },
        { nombre: 'Permisos y Planos Municipales', snippet: `- Permisos y Planos Municipales: $ 15000\n`, desc: 'Tasas y trámites de habilitación técnica' },
        { nombre: 'Gastos Administrativos y Gestión', snippet: `- Gastos Administrativos y Gestión: $ 12000\n`, desc: 'Gestión de compras, coordinación y facturación' }
      ];

      gastosFrecuentes.forEach((gf, idx) => {
        list.push({
          id: `gasto-frec-${idx}`,
          category: 'gasto',
          title: gf.nombre,
          subtitle: `Gasto habitual · ${gf.desc}`,
          snippet: gf.snippet,
          icon: Truck,
          extraText: `gasto indirecto frecuente ${gf.nombre} ${gf.desc}`
        });
      });
    }

    // 6. Celdas de Cálculo y Funciones Matemáticas
    if (contextType === 'calculos') {
      const funcionesMatematicas = [
        { name: 'ceil', desc: 'Redondea hacia arriba al entero más próximo (ej: =ceil(superficie / 6))', snippet: '=ceil()' },
        { name: 'floor', desc: 'Redondea hacia abajo al entero más próximo (ej: =floor(horas / 8))', snippet: '=floor()' },
        { name: 'round', desc: 'Redondea al entero más próximo según decimales', snippet: '=round()' },
        { name: 'max', desc: 'Devuelve el valor máximo entre expresiones (ej: =max(bocas, 4))', snippet: '=max(, )' },
        { name: 'min', desc: 'Devuelve el valor mínimo entre expresiones (ej: =min(horas, 40))', snippet: '=min(, )' },
        { name: 'si', desc: 'Condicional ternario (ej: =si(bocas > 10, 2, 1))', snippet: '=si(bocas > 10, 2, 1)' }
      ];

      funcionesMatematicas.forEach((fn) => {
        list.push({
          id: `func-${fn.name}`,
          category: 'directiva',
          title: `Función ${fn.name}()`,
          subtitle: fn.desc,
          snippet: fn.snippet,
          icon: Hash,
          extraText: `funcion calculo formula matematica ${fn.name}`
        });
      });

      list.push({
        id: 'template-calc-multiline',
        category: 'directiva',
        title: '📐 Cálculo multilínea (YAML Folded >)',
        subtitle: 'Escribe una fórmula matemática larga dividida en varios renglones legibles',
        snippet: `calculo_multilinea: >\n    superficie * 15\n    + bocas * 200\n`,
        icon: Hash,
        extraText: 'calculo multilinea doblado formula larga renglones'
      });

      list.push({
        id: 'template-calc-cascada',
        category: 'directiva',
        title: '📐 Cómputo en cascada',
        subtitle: 'Variables que se calculan sucesivamente unas de otras',
        snippet: `superficie: 120\nbocas: =ceil(superficie / 6)\ncable_m: =bocas * 12\n`,
        icon: Hash,
        extraText: 'computo cascada formulas variables superficie'
      });

      if (calculatedCells && calculatedCells.length > 0) {
        calculatedCells.forEach((c) => {
          list.push({
            id: `var-in-calc-${c.name}`,
            category: 'directiva',
            title: `=${c.name} (${c.evaluatedValue})`,
            subtitle: `Variable calculada · ${c.isFormula ? c.rawExpression : 'constante'}`,
            snippet: `=${c.name} `,
            icon: Hash,
            extraText: `variable celda calculo formula ${c.name} ${c.rawExpression}`
          });
        });
      }
    }

    // 7. Tareas Tipo de Catálogo y Partidas a Medida (contextType === 'tareas' o 'general')
    if (contextType === 'tareas' || contextType === 'general') {
      // Opciones para Partidas Libres y Plantillas Compuestas
      list.push({
        id: 'cmd-partida-libre',
        category: 'tarea',
        title: '⚡ Partida Libre (Texto y Precio)',
        subtitle: 'Partida simple con precio y cómputo directo · - 1 u [Nombre]: $ [Precio]',
        snippet: `- 1 u Partida Libre: $ 0\n`,
        icon: Tag,
        extraText: 'partida libre texto precio manual simple directa'
      });

      list.push({
        id: 'cmd-partida-medida',
        category: 'tarea',
        title: '⚡ Partida a Medida (APU)',
        subtitle: 'Crea un trabajo con despiece de materiales y mano de obra',
        snippet: `- Tablero a Medida:\n    materiales:\n      - 1 u Gabinete DIN 24 módulos\n    mano_obra:\n      - 6 h Oficial\n`,
        icon: Layers,
        extraText: 'apu partida a medida despiece materiales mano de obra'
      });

      list.push({
        id: 'cmd-partida-servicios',
        category: 'tarea',
        title: '⚡ Partida con Servicios / Subcontratos',
        subtitle: 'Crea un trabajo que incluye alquiler de equipos o servicios tercerizados',
        snippet: `- Tendido Aéreo con Grúa:\n    servicios:\n      - 1 u Hidroelevador con operador: $ 60000\n    mano_obra:\n      - 8 h Oficial\n`,
        icon: Truck,
        extraText: 'servicios subcontratos partida grua hidroelevador'
      });

      tareasTipo.forEach((t) => {
        const isParametric = t.parametros && t.parametros.length > 0;
        const hasApuBreakdown = !isParametric && ((t.insumos && t.insumos.length > 0) || (t.manoObra && t.manoObra.length > 0));

        if (isParametric) {
          // Generar snippet paramétrico con valores por defecto y comentarios condicionales
          let paramSnippet = `- ${t.nombre}:\n    cantidad: 1 ${t.unidad || 'u'}\n    parametros:\n`;
          t.parametros!.forEach((p) => {
            const commentParts: string[] = [];
            if (p.nombre && p.nombre !== p.id) commentParts.push(p.nombre);
            if (p.unidad) commentParts.push(p.unidad);
            const commentStr = commentParts.length > 0 ? `  # ${commentParts.join(', ')}` : '';

            if (p.condicion && p.condicion.trim()) {
              paramSnippet += `      # ${p.id}: ${p.valorDefault ?? 1}${commentStr} (si ${p.condicion})\n`;
            } else {
              paramSnippet += `      ${p.id}: ${p.valorDefault ?? 1}${commentStr}\n`;
            }
          });

          // Opción 1: Tarea paramétrica completa
          list.push({
            id: `tarea-${t.id}`,
            category: 'tarea',
            title: `⚡ ${t.nombre} (Paramétrica)`,
            subtitle: `Carga parámetros editables por defecto · /${t.unidad || 'u'} · ${t.categoria || 'General'}`,
            snippet: paramSnippet,
            icon: Zap,
            extraText: `${t.categoria || ''} ${t.notasTecnicas || ''} ${t.unidad || ''} parametros formula condicionales`
          });

          // Opción 2: Línea simple
          list.push({
            id: `tarea-line-${t.id}`,
            category: 'tarea',
            title: `${t.nombre} (Línea simple)`,
            subtitle: `Inserción rápida vinculada al catálogo · - 1 ${t.unidad || 'u'}`,
            snippet: `- 1 ${t.unidad || 'u'} ${t.nombre}\n`,
            icon: Zap,
            extraText: `${t.categoria || ''} ${t.notasTecnicas || ''} linea simple directa`
          });
        } else if (hasApuBreakdown) {
          // Generar snippet APU con materiales y mano de obra precargados
          let apuSnippet = `- ${t.nombre}:\n    cantidad: 1 ${t.unidad || 'u'}\n`;
          if (t.insumos && t.insumos.length > 0) {
            apuSnippet += `    materiales:\n`;
            t.insumos.forEach((item) => {
              let matName = item.nombreSlot || item.filtroMaterial?.etiqueta;
              let matUnit = 'u';
              let matBrand = '';
              const targetId = item.materialId || item.insumoId;
              if (targetId && insumosMap?.has(targetId)) {
                const realMat = insumosMap.get(targetId)!;
                matName = realMat.nombre;
                matUnit = realMat.unidad || 'u';
                if (realMat.marca) matBrand = ` [${realMat.marca}]`;
              }
              const nameToUse = matName || 'Material';
              apuSnippet += `      - ${item.cantidad || 1} ${matUnit} ${nameToUse}${matBrand}\n`;
            });
          }
          if (t.manoObra && t.manoObra.length > 0) {
            apuSnippet += `    mano_obra:\n`;
            t.manoObra.forEach((mo) => {
              let catName = 'Oficial';
              if (manoObraMap?.has(mo.categoriaId)) {
                catName = manoObraMap.get(mo.categoriaId)!.nombre;
              }
              apuSnippet += `      - ${mo.horas || 1} h ${catName}\n`;
            });
          }

          // Opción 1: Tarea APU con despiece
          list.push({
            id: `tarea-${t.id}`,
            category: 'tarea',
            title: `⚡ ${t.nombre} (Despiece APU)`,
            subtitle: `Carga desglose completo de materiales y mano de obra · /${t.unidad || 'u'}`,
            snippet: apuSnippet,
            icon: Layers,
            extraText: `${t.categoria || ''} ${t.notasTecnicas || ''} ${t.unidad || ''} apu materiales mano de obra despiece`
          });

          // Opción 2: Línea simple
          list.push({
            id: `tarea-line-${t.id}`,
            category: 'tarea',
            title: `${t.nombre} (Línea simple)`,
            subtitle: `Inserción rápida vinculada al catálogo · - 1 ${t.unidad || 'u'}`,
            snippet: `- 1 ${t.unidad || 'u'} ${t.nombre}\n`,
            icon: Zap,
            extraText: `${t.categoria || ''} ${t.notasTecnicas || ''} linea simple directa`
          });
        } else {
          // Tarea simple sin desglose
          list.push({
            id: `tarea-${t.id}`,
            category: 'tarea',
            title: t.nombre,
            subtitle: `Tarea Catálogo · /${t.unidad || 'u'} · ${t.categoria || 'General'}`,
            snippet: `- 1 ${t.unidad || 'u'} ${t.nombre}\n`,
            icon: Zap,
            extraText: `${t.categoria || ''} ${t.notasTecnicas || ''} ${t.unidad || ''}`
          });
        }
      });
    }

    if (contextType === 'general') {
      // Estructura y Capítulos
      list.push({
        id: 'cmd-capitulo',
        category: 'capitulo',
        title: 'Nuevo Capítulo',
        subtitle: 'Agrupa partidas bajo una sección de obra',
        snippet: `Capítulo Nuevo:\n  - 1 u `,
        icon: FolderPlus
      });

      // Directivas de Cotización en YAML
      list.push({
        id: 'cmd-cliente',
        category: 'directiva',
        title: 'cliente: [Nombre]',
        subtitle: 'Asigna el comitente o estudio de arquitectura',
        snippet: `cliente: `,
        icon: Building2
      });

      list.push({
        id: 'cmd-obra',
        category: 'directiva',
        title: 'obra: [Dirección]',
        subtitle: 'Ubicación específica de la obra',
        snippet: `obra: `,
        icon: MapPin
      });

      list.push({
        id: 'cmd-factura',
        category: 'directiva',
        title: 'factura: [Factura A | B | C]',
        subtitle: 'Encuadre fiscal de la cotización',
        snippet: `factura: Factura A\n`,
        icon: FileSpreadsheet
      });

      list.push({
        id: 'cmd-validez',
        category: 'directiva',
        title: 'validez: [15] dias',
        subtitle: 'Plazo de validez de la oferta',
        snippet: `validez: 15 dias\n`,
        icon: Calendar
      });

      list.push({
        id: 'cmd-margen',
        category: 'directiva',
        title: 'margen: [35]%',
        subtitle: 'Margen de beneficio sobre costos',
        snippet: `margen: 35%\n`,
        icon: Percent
      });

      list.push({
        id: 'cmd-riesgo',
        category: 'directiva',
        title: 'riesgo: [bajo | normal | alto]',
        subtitle: 'Fondo de contingencia para imprevistos',
        snippet: `riesgo: normal\n`,
        icon: ShieldAlert
      });

      list.push({
        id: 'cmd-dolar',
        category: 'directiva',
        title: 'dolar: [MEP 1350]',
        subtitle: 'Cotización en moneda extranjera',
        snippet: `dolar: MEP 1350\n`,
        icon: DollarSign
      });

      list.push({
        id: 'cmd-gasto',
        category: 'gasto',
        title: 'gastos: Viáticos = $ 15.000',
        subtitle: 'Costo logístico, fletes o traslados',
        snippet: `gastos:\n  - Viáticos: $ 15.000\n`,
        icon: Truck
      });

      // Celdas de cálculo y Trabajo Tipo paramétrico
      list.push({
        id: 'cmd-calculos',
        category: 'directiva',
        title: 'calculos: [Celdas y Fórmulas]',
        subtitle: 'Define variables y fórmulas de cómputo en cascada',
        snippet: `calculos:\n  superficie: 120\n  bocas: =ceil(superficie / 6)\n  cable_m: =bocas * 12\n`,
        icon: Hash,
        extraText: 'calculos variables formulas celdas cascada computo matematica'
      });

      list.push({
        id: 'cmd-trabajo-tipo',
        category: 'tarea',
        title: '⚡ Trabajo Tipo (Plantilla Paramétrica)',
        subtitle: 'Plantilla de trabajo con variables locales, materiales y mano de obra',
        snippet: `- Reparación y Armado de Tablero:\n    cantidad: 1 u\n    calculos:\n      modulos: 24\n      termicas: 6\n    materiales:\n      - 1 u Tablero Modular DIN =modulos Módulos Superficie Chapa Metálica Puerta Ciega IP40:\n          marca: Gabexel\n      - =termicas u Interruptor Termomagnético 2P\n    mano_obra:\n      - 4 h Oficial Electricista\n`,
        icon: Layers,
        extraText: 'trabajo tipo plantilla parametrica calculos materiales mano de obra partida'
      });

      if (calculatedCells && calculatedCells.length > 0) {
        calculatedCells.forEach((c) => {
          list.push({
            id: `var-${c.name}`,
            category: 'directiva',
            title: `=${c.name} (${c.evaluatedValue})`,
            subtitle: `Variable calculada · ${c.isFormula ? c.rawExpression : 'constante'}`,
            snippet: `=${c.name} `,
            icon: Hash,
            extraText: `variable celda calculo formula ${c.name} ${c.rawExpression}`
          });
        });
      }
    }

    // Filtrar por categoría activa
    let filtered = list;
    if (activeCategory) {
      filtered = filtered.filter(
        (it) => it.category === 'material' && normalizeString(it.categoryTag || '') === normalizeString(activeCategory)
      );
    }

    // Filtrar por query de búsqueda
    if (!effectiveQuery || !effectiveQuery.trim()) {
      return filtered.slice(0, 20);
    }

    const scoredResults = filtered
      .map((it) => ({
        item: it,
        score: scoreSearchMatch({
          query: effectiveQuery,
          title: it.title,
          category: it.categoryTag,
          extraText: `${it.subtitle || ''} ${it.extraText || ''}`
        })
      }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 25)
      .map((entry) => entry.item);

    // Si es modo implícito (tipeo directo tras guión) y el usuario escribió algo,
    // agregar opción explícita para mantener como texto libre
    if (!isExplicit && !directiveType && effectiveQuery && effectiveQuery.trim()) {
      const cleanTyped = effectiveQuery.trim();
      scoredResults.push({
        id: 'free-text-action',
        category: 'directiva',
        title: `✏️ Mantener "${cleanTyped}" (Texto Libre)`,
        subtitle: 'Enter o clic para continuar sin vincular al catálogo',
        snippet: `ACTION:FREE_TEXT:${cleanTyped}`,
        icon: Tag,
        extraText: 'texto libre manual directo'
      });
    }

    return scoredResults;
  }, [effectiveQuery, activeCategory, contextType, tareasTipo, insumosMap, manoObraMap, costosIndirectos, calculatedCells, isExplicit, directiveType]);

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setSelectedIndex(0);
    setHasUserNavigated(false);
  }, [query]);

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [selectedIndex]);

  // Manejo de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        if (items.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setHasUserNavigated(true);
          setSelectedIndex((prev) => (prev + 1) % items.length);
        }
      } else if (e.key === 'ArrowUp') {
        if (items.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setHasUserNavigated(true);
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        }
      } else if (e.key === 'Tab') {
        if (items.length > 0 && items[selectedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(items[selectedIndex].snippet);
        }
      } else if (e.key === 'Enter') {
        if (isExplicit || hasUserNavigated) {
          if (items.length > 0 && items[selectedIndex]) {
            e.preventDefault();
            e.stopPropagation();
            onSelect(items[selectedIndex].snippet);
          }
        } else {
          // El usuario estaba escribiendo texto libre sin navegar las opciones.
          // Cerrar el menú sin interceptar Enter, permitiendo que el editor pase al siguiente renglón con texto libre.
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [items, selectedIndex, isExplicit, hasUserNavigated, onSelect, onClose]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Si no hay ítems y no es explícito (/ o @) ni directiva de cabecera, no renderizar nada
  // (sin disparar onClose, para que el usuario pueda corregir errores con Backspace y seguir recibiendo sugerencias)
  if (items.length === 0 && !activeCategory && !isExplicit && !directiveType) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => e.preventDefault()}
      className="slash-command-menu absolute z-50 w-80 sm:w-96 max-h-96 bg-surface-container-high/95 backdrop-blur-md border border-outline-variant/40 rounded-2xl shadow-2xl overflow-y-auto p-1.5 animate-in fade-in zoom-in-95 duration-100"
      style={{
        top: position ? `${position.top}px` : '48px',
        left: position ? `${position.left}px` : '16px'
      }}
    >
      {/* Cabecera del Menú */}
      <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center justify-between border-b border-outline-variant/15 mb-1">
        <span className="flex items-center gap-1.5">
          {directiveType === 'cliente' || query.startsWith('@') ? (
            <>
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>Directorio de Clientes ({clientes.length})</span>
            </>
          ) : directiveType === 'factura' ? (
            <>
              <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
              <span>Tipo de Factura</span>
            </>
          ) : directiveType === 'validez' ? (
            <>
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Validez de Oferta</span>
            </>
          ) : directiveType === 'margen' ? (
            <>
              <Percent className="w-3.5 h-3.5 text-primary" />
              <span>Margen de Ganancia</span>
            </>
          ) : directiveType === 'riesgo' ? (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-primary" />
              <span>Fondo de Riesgo</span>
            </>
          ) : directiveType === 'dolar' ? (
            <>
              <DollarSign className="w-3.5 h-3.5 text-primary" />
              <span>Dólar de Referencia</span>
            </>
          ) : directiveType === 'obra' ? (
            <>
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>Ubicación de la Obra</span>
            </>
          ) : contextType === 'materiales' ? (
            <>
              <Package className="w-3.5 h-3.5 text-primary" />
              <span>Insumos del Catálogo</span>
            </>
          ) : contextType === 'mano_obra' ? (
            <>
              <HardHat className="w-3.5 h-3.5 text-primary" />
              <span>Mano de Obra</span>
            </>
          ) : contextType === 'servicios' ? (
            <>
              <Truck className="w-3.5 h-3.5 text-primary" />
              <span>Servicios y Alquileres</span>
            </>
          ) : contextType === 'item' ? (
            <>
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>Despiece de Partida</span>
            </>
          ) : contextType === 'gastos' ? (
            <>
              <Truck className="w-3.5 h-3.5 text-primary" />
              <span>Gastos y Modificadores de Costo</span>
            </>
          ) : contextType === 'calculos' ? (
            <>
              <Hash className="w-3.5 h-3.5 text-primary" />
              <span>Cálculos y Fórmulas</span>
            </>
          ) : contextType === 'tareas' ? (
            <>
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span>Partidas y Trabajos Tipo</span>
            </>
          ) : (
            <span>Catálogo y Comandos YAML</span>
          )}
        </span>
        <span className="font-mono text-[10px]">
          {!isExplicit ? (
            hasUserNavigated ? (
              <span className="flex items-center gap-1 text-primary font-bold">
                <span>Enter insertar</span>
                <span className="opacity-40">·</span>
                <span className="text-on-surface-variant font-normal">Esc cerrar</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-on-surface-variant">
                <span className="text-primary font-bold">Tab</span> insertar
                <span className="opacity-40">·</span>
                <span className="text-on-surface font-bold">Enter</span> libre
                <span className="opacity-40">·</span>
                <span>↑↓</span>
              </span>
            )
          ) : (
            <span className="text-primary font-bold">↑ ↓ Enter</span>
          )}
        </span>
      </div>

      {/* Barra de Filtro de Categorías para Materiales */}
      {contextType === 'materiales' && !directiveType && materialCategories.length > 0 && (
        <div className="px-2 py-1 flex items-center gap-1 overflow-x-auto pb-1.5 border-b border-outline-variant/10 text-[10px] scrollbar-none">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onTouchEnd={(e) => {
              e.preventDefault();
              setSelectedCategory(null);
            }}
            onClick={() => setSelectedCategory(null)}
            className={`px-2 py-0.5 rounded-md font-bold transition shrink-0 cursor-pointer ${
              activeCategory === null
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Todas
          </button>
          {materialCategories.slice(0, 6).map((cat) => {
            const isSelected = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setSelectedCategory(isSelected ? null : cat);
                }}
                onClick={() => setSelectedCategory(isSelected ? null : cat)}
                className={`px-2 py-0.5 rounded-md font-bold transition shrink-0 cursor-pointer capitalize ${
                  isSelected
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Lista de Sugerencias */}
      <div className="space-y-0.5 mt-1">
        {items.length === 0 ? (
          <div className="py-6 text-center text-xs text-on-surface-variant">
            No se encontraron coincidencias en esta categoría.
          </div>
        ) : (
          items.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = idx === selectedIndex;

            return (
              <button
                key={item.id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onSelect(item.snippet);
                }}
                onClick={() => onSelect(item.snippet)}
                onMouseEnter={() => {
                  setSelectedIndex(idx);
                  setHasUserNavigated(true);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-on-surface hover:bg-surface-container-highest'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-on-primary/20 text-on-primary' : 'bg-primary/10 text-primary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-bold truncate">{item.title}</div>
                  {item.subtitle && (
                    <div
                      className={`text-[11px] truncate ${
                        isSelected ? 'text-on-primary/80' : 'text-on-surface-variant'
                      }`}
                    >
                      {item.subtitle}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
