import { Insumo, CategoriaManoDeObra, TareaFormData, InsumoEnTarea } from '../types';
import { generateSystemPrompt, buildUserPrompt, findRelevantInsumos } from './promptEngine';
import { parseTareaTipoFromDSL, normalizeDslString } from '../tareaTipoDsl';

export interface AiGenerationOptions {
  host?: string;
  model?: string;
  temperature?: number;
}

export interface AiGenerationResult {
  yaml: string;
  source: 'ollama' | 'heuristic_fallback';
  modelUsed?: string;
  diagnosticsCount: number;
}

export interface AiFormDataResult {
  data: TareaFormData;
  yaml: string;
  source: 'ollama' | 'heuristic_fallback';
  modelUsed?: string;
  diagnosticsCount: number;
}

/**
 * Limpia delimitadores de markdown si el modelo los incluyó (```yaml ... ```)
 */
export function cleanAiYamlResponse(rawText: string): string {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/i, '');
  cleaned = cleaned.replace(/\n?```$/i, '');
  return cleaned.trim();
}

/**
 * Verifica de forma no bloqueante si Ollama está disponible localmente.
 */
export async function checkOllamaAvailability(host: string = 'http://localhost:11434'): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${host}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Busca el insumo del catálogo que mejor coincida con una lista de palabras clave prioritarias.
 */
export function findMatchingInsumo(
  insumosMap: Map<string, Insumo>,
  keywords: string[]
): Insumo | undefined {
  const normKeywords = keywords.map((k) => normalizeDslString(k));
  let bestItem: Insumo | undefined;
  let bestScore = 0;

  for (const insumo of insumosMap.values()) {
    const normNombre = normalizeDslString(insumo.nombre);
    const normCat = normalizeDslString(insumo.categoria || '');
    let matchedCount = 0;

    for (const kw of normKeywords) {
      if (normNombre.includes(kw) || normCat.includes(kw)) {
        matchedCount++;
      }
    }

    if (matchedCount > bestScore) {
      bestScore = matchedCount;
      bestItem = insumo;
    }
  }

  return bestScore >= Math.min(2, keywords.length) ? bestItem : undefined;
}

/**
 * Generador heurístico y experto basado en normas AEA 90364 y catálogo real del usuario.
 * Se ejecuta de inmediato si Ollama no está conectado (ej: en celular o modo offline).
 */
export function generateHeuristicTareaTipo(
  prompt: string,
  insumosMap: Map<string, Insumo>,
  manoObraMap: Map<string, CategoriaManoDeObra>
): string {
  const normPrompt = normalizeDslString(prompt);

  const moList = Array.from(manoObraMap.values());
  const oficialMo = moList.find((m) => normalizeDslString(m.nombre).includes('oficial'))?.nombre
    || moList[0]?.nombre
    || 'Oficial Electricista';
  const ayudanteMo = moList.find((m) => normalizeDslString(m.nombre).includes('ayudante'))?.nombre;

  // Detección de arquetipos según AEA 90364
  const isAire = normPrompt.includes('aire') || normPrompt.includes('split') || normPrompt.includes('clima') || normPrompt.includes('tue') || normPrompt.includes('anafe') || normPrompt.includes('horno') || normPrompt.includes('termotanque');
  const isPat = normPrompt.includes('jabalina') || normPrompt.includes('tierra') || normPrompt.includes('pat') || normPrompt.includes('telur') || normPrompt.includes('srt');
  const isIluminacion = normPrompt.includes('iluminac') || normPrompt.includes('luz') || normPrompt.includes('luces') || normPrompt.includes('lampara') || normPrompt.includes('iug') || normPrompt.includes('artefacto');
  const isTomas = normPrompt.includes('toma') || normPrompt.includes('enchufe') || normPrompt.includes('tug') || normPrompt.includes('boca');
  const isTablero = normPrompt.includes('tablero') || normPrompt.includes('seccional') || normPrompt.includes('disyuntor') || normPrompt.includes('termica') || normPrompt.includes('gabinete');
  const isAlimentador = normPrompt.includes('alimentador') || normPrompt.includes('linea seccional') || normPrompt.includes('acometida') || normPrompt.includes('subterraneo');

  let nombre = prompt.trim();
  if (nombre.length > 60) nombre = `${nombre.slice(0, 57)}...`;
  nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1);

  let categoria = 'Instalaciones';
  let unidad = 'u';
  let parametrosYaml = `  - id: cantidad\n    nombre: Cantidad de Unidades\n    tipo: numero\n    default: 1\n    unidad: u`;
  let calculosYaml = `  horas_total: cantidad * 2.0`;
  let clausulaNotas = 'Trabajo de instalación eléctrica según especificaciones técnicas y normas AEA 90364.';
  let clausulaExclusiones = 'No incluye trabajos de albañilería pesada, pintura ni rotura de hormigón armado.';
  const materialesLines: string[] = [];
  let manoObraLines: string[] = [`  - categoria: "${oficialMo}"\n    formula: horas_total`];

  const addMat = (item: Insumo | undefined, fallbackName: string, formulaOrQty: string) => {
    if (item) {
      materialesLines.push(`  - material: "${item.nombre}"\n    ${formulaOrQty}`);
    } else if (insumosMap.size === 0) {
      materialesLines.push(`  - material: "${fallbackName}"\n    ${formulaOrQty}`);
    }
  };

  if (isAire) {
    categoria = 'Fuerza Motriz';
    unidad = 'punto';
    parametrosYaml = `  - id: equipos\n    nombre: Cantidad de Equipos / Tomas TUE\n    tipo: numero\n    default: 1\n    unidad: u\n  - id: distancia_tablero\n    nombre: Metros promedio hasta Tablero\n    tipo: numero\n    default: 12\n    unidad: m`;
    calculosYaml = ayudanteMo
      ? `  cable_fase_neutro: equipos * distancia_tablero * 2 * 1.10\n  cable_tierra: equipos * distancia_tablero * 1.10\n  canio_corrugado: equipos * distancia_tablero\n  horas_oficial: equipos * 2.5 + 1.0\n  horas_ayudante: equipos * 1.5`
      : `  cable_fase_neutro: equipos * distancia_tablero * 2 * 1.10\n  cable_tierra: equipos * distancia_tablero * 1.10\n  canio_corrugado: equipos * distancia_tablero\n  horas_oficial: equipos * 4.0`;
    clausulaNotas = 'Circuito exclusivo TUE según norma AEA 90364-7-770 con protección termomagnética dedicada calibrada (curva C) y conductor mínimo 2.5 mm² IRAM 2183.';
    clausulaExclusiones = 'No incluye provisión del equipo acondicionador de aire / electrodoméstico, soporte de unidad exterior, carga de gas ni perforaciones en hormigón armado.';

    const cableFase = findMatchingInsumo(insumosMap, ['cable', '2.5']) || findMatchingInsumo(insumosMap, ['cable', 'unipolar']) || findMatchingInsumo(insumosMap, ['cable']);
    const cablePe = findMatchingInsumo(insumosMap, ['cable', 'tierra']) || findMatchingInsumo(insumosMap, ['cable', 'verde']);
    const termica20 = findMatchingInsumo(insumosMap, ['termica', '20']) || findMatchingInsumo(insumosMap, ['termomagnetica']) || findMatchingInsumo(insumosMap, ['termica']);
    const toma20 = findMatchingInsumo(insumosMap, ['toma', '20']) || findMatchingInsumo(insumosMap, ['tomacorriente']) || findMatchingInsumo(insumosMap, ['toma']);
    const canio = findMatchingInsumo(insumosMap, ['corrugado', '3/4']) || findMatchingInsumo(insumosMap, ['canio']) || findMatchingInsumo(insumosMap, ['corrugado']);

    addMat(cableFase, 'Cable Unipolar 2.5mm² IRAM 2183', 'formula: cable_fase_neutro');
    addMat(cablePe, 'Cable Unipolar 2.5mm² Verde/Amarillo', 'formula: cable_tierra');
    addMat(termica20, 'Termomagnética Bipolar 20A Curva C', 'formula: equipos');
    addMat(toma20, 'Tomacorriente 20A 2P+T con Bastidor', 'formula: equipos');
    addMat(canio, 'Caño Corrugado Blanco Ignífugo 3/4"', 'formula: canio_corrugado');

    manoObraLines = ayudanteMo
      ? [
          `  - categoria: "${oficialMo}"\n    formula: horas_oficial`,
          `  - categoria: "${ayudanteMo}"\n    formula: horas_ayudante`
        ]
      : [
          `  - categoria: "${oficialMo}"\n    formula: horas_oficial`
        ];
  } else if (isPat) {
    categoria = 'Puesta a Tierra';
    unidad = 'punto';
    parametrosYaml = `  - id: jabalinas\n    nombre: Cantidad de Jabalinas a hincar\n    tipo: numero\n    default: 1\n    unidad: u\n  - id: distancia_bajada\n    nombre: Metros de Conductor de Bajada PE\n    tipo: numero\n    default: 10\n    unidad: m`;
    calculosYaml = `  cable_tierra_pe: distancia_bajada * 1.10\n  horas_hincado_medicion: jabalinas * 2.5 + 1.0`;
    clausulaNotas = 'Puesta a tierra reglamentaria con jabalina IRAM 2309 y medición de resistencia según protocolo SRT 900/15 con telurímetro contrastado.';
    clausulaExclusiones = 'No incluye obras civiles de picado de roca ni adecuación de circuitos internos del inmueble que no posean conductor de protección PE.';

    const jabalina = findMatchingInsumo(insumosMap, ['jabalina', '1/2']) || findMatchingInsumo(insumosMap, ['jabalina']);
    const tomacable = findMatchingInsumo(insumosMap, ['tomacable']) || findMatchingInsumo(insumosMap, ['cobre']);
    const cajaInsp = findMatchingInsumo(insumosMap, ['inspeccion']) || findMatchingInsumo(insumosMap, ['caja']);
    const cableVerde = findMatchingInsumo(insumosMap, ['cable', 'verde']) || findMatchingInsumo(insumosMap, ['cable', '4']) || findMatchingInsumo(insumosMap, ['cable']);

    addMat(jabalina, 'Jabalina Cobre 1/2" 1.5m IRAM 2309', 'formula: jabalinas');
    addMat(tomacable, 'Tomacable para Jabalina 1/2 Bronce', 'formula: jabalinas');
    addMat(cajaInsp, 'Caja de Inspección 15x15 PVC para Jabalina', 'formula: jabalinas');
    addMat(cableVerde, 'Cable Unipolar 4mm² Verde/Amarillo IRAM 2183', 'formula: cable_tierra_pe');

    manoObraLines = [
      `  - categoria: "${oficialMo}"\n    formula: horas_hincado_medicion`
    ];
  } else if (isIluminacion) {
    categoria = 'Iluminación';
    unidad = 'boca';
    parametrosYaml = `  - id: bocas\n    nombre: Cantidad de Bocas de Iluminación\n    tipo: numero\n    default: 8\n    unidad: bocas\n  - id: metros_por_boca\n    nombre: Metros promedio de cañería por boca\n    tipo: numero\n    default: 5\n    unidad: m`;
    calculosYaml = ayudanteMo
      ? `  metros_canio: bocas * metros_por_boca\n  cable_fase_retornos: metros_canio * 2.5 * 1.10\n  cable_tierra: metros_canio * 1.10\n  horas_oficial: bocas * 0.75\n  horas_ayudante: bocas * 0.5`
      : `  metros_canio: bocas * metros_por_boca\n  cable_fase_retornos: metros_canio * 2.5 * 1.10\n  cable_tierra: metros_canio * 1.10\n  horas_oficial: bocas * 1.2`;
    clausulaNotas = 'Circuito IUG según norma AEA 90364 con conductores normalizados de 1.5 mm² IRAM 2183 y protección termomagnética calibrada a 10A máx.';
    clausulaExclusiones = 'No incluye provisión de luminarias, artefactos decorativos, apliques colgantes ni lámparas.';

    const cable15 = findMatchingInsumo(insumosMap, ['cable', '1.5']) || findMatchingInsumo(insumosMap, ['cable', 'unipolar']) || findMatchingInsumo(insumosMap, ['cable']);
    const cablePe = findMatchingInsumo(insumosMap, ['cable', 'tierra']) || findMatchingInsumo(insumosMap, ['cable', '2.5']);
    const termica10 = findMatchingInsumo(insumosMap, ['termica', '10']) || findMatchingInsumo(insumosMap, ['termomagnetica']) || findMatchingInsumo(insumosMap, ['termica']);
    const caja = findMatchingInsumo(insumosMap, ['octogonal']) || findMatchingInsumo(insumosMap, ['caja']);
    const llave = findMatchingInsumo(insumosMap, ['llave', 'punto']) || findMatchingInsumo(insumosMap, ['interruptor']) || findMatchingInsumo(insumosMap, ['llave']) || findMatchingInsumo(insumosMap, ['boca']);

    addMat(cable15, 'Cable Unipolar 1.5mm² IRAM 2183', 'formula: cable_fase_retornos');
    addMat(cablePe, 'Cable Unipolar 2.5mm² Verde/Amarillo', 'formula: cable_tierra');
    addMat(termica10, 'Termomagnética Bipolar 10A Curva C', 'cantidad: 1');
    addMat(caja, 'Caja Octogonal Chapa / PVC', 'formula: bocas');
    addMat(llave, 'Interruptor de Punto con Bastidor y Tapa', 'formula: bocas');

    manoObraLines = ayudanteMo
      ? [
          `  - categoria: "${oficialMo}"\n    formula: horas_oficial`,
          `  - categoria: "${ayudanteMo}"\n    formula: horas_ayudante`
        ]
      : [
          `  - categoria: "${oficialMo}"\n    formula: horas_oficial`
        ];
  } else if (isTablero) {
    categoria = 'Tableros';
    unidad = 'global';
    parametrosYaml = `  - id: circuitos\n    nombre: Cantidad de Circuitos a Instalar\n    tipo: numero\n    default: 4\n    unidad: circuitos`;
    calculosYaml = `  horas_armado: circuitos * 0.8 + 2.0\n  cable_interconexion: circuitos * 1.5`;
    clausulaNotas = 'Montaje y conexionado de Tablero Seccional según AEA 90364-7-770. Identificación reglamentaria de circuitos y bornera de tierra equipotencial.';
    clausulaExclusiones = 'No incluye adecuación de la línea principal de acometida de la distribuidora eléctrica.';

    const disyuntor = findMatchingInsumo(insumosMap, ['diferencial', '40']) || findMatchingInsumo(insumosMap, ['disyuntor']) || findMatchingInsumo(insumosMap, ['diferencial']);
    const termica = findMatchingInsumo(insumosMap, ['termica', '16']) || findMatchingInsumo(insumosMap, ['termica', 'bipolar']) || findMatchingInsumo(insumosMap, ['termomagnetica']);
    const gabinete = findMatchingInsumo(insumosMap, ['gabinete', 'din']) || findMatchingInsumo(insumosMap, ['tablero']) || findMatchingInsumo(insumosMap, ['caja']);
    const peine = findMatchingInsumo(insumosMap, ['peine']) || findMatchingInsumo(insumosMap, ['bornera']);

    addMat(gabinete, 'Gabinete DIN Embutir / Superficie', 'cantidad: 1');
    addMat(disyuntor, 'Interruptor Diferencial 2x40A 30mA IRAM 61008', 'cantidad: 1');
    addMat(termica, 'Termomagnética Bipolar Curva C', 'formula: circuitos');
    if (peine) {
      addMat(peine, 'Peine de Distribución Bipolar', 'cantidad: 1');
    }

    manoObraLines = [
      `  - categoria: "${oficialMo}"\n    formula: horas_armado`
    ];
  } else if (isAlimentador) {
    categoria = 'Instalaciones';
    unidad = 'm';
    parametrosYaml = `  - id: distancia_metros\n    nombre: Longitud del Tendido\n    tipo: numero\n    default: 15\n    unidad: m`;
    calculosYaml = ayudanteMo
      ? `  cable_fase_neutro: distancia_metros * 2 * 1.10\n  cable_tierra: distancia_metros * 1.10\n  horas_oficial: distancia_metros * 0.25 + 1.0\n  horas_ayudante: distancia_metros * 0.25`
      : `  cable_fase_neutro: distancia_metros * 2 * 1.10\n  cable_tierra: distancia_metros * 1.10\n  horas_oficial: distancia_metros * 0.5 + 1.0`;
    clausulaNotas = 'Línea seccional dimensionada por caída de tensión admisible (< 1%) y capacidad de corriente según AEA 90364 con conductores mínimo 4 mm².';
    clausulaExclusiones = 'No incluye zanjeo manual en suelo consolidado ni reposición de baldosas o solados.';

    const cable4 = findMatchingInsumo(insumosMap, ['cable', '4']) || findMatchingInsumo(insumosMap, ['subterraneo']) || findMatchingInsumo(insumosMap, ['cable', '6']) || findMatchingInsumo(insumosMap, ['cable']);
    const cablePe4 = findMatchingInsumo(insumosMap, ['cable', 'tierra']) || findMatchingInsumo(insumosMap, ['cable', 'verde']);
    const canio = findMatchingInsumo(insumosMap, ['corrugado']) || findMatchingInsumo(insumosMap, ['canio']);

    addMat(cable4, 'Cable Unipolar 4mm² IRAM 2183', 'formula: cable_fase_neutro');
    addMat(cablePe4, 'Cable Unipolar 4mm² Verde/Amarillo', 'formula: cable_tierra');
    if (canio) {
      addMat(canio, 'Caño de Protección Semipesado', 'formula: distancia_metros');
    }

    manoObraLines = ayudanteMo
      ? [
          `  - categoria: "${oficialMo}"\n    formula: horas_oficial`,
          `  - categoria: "${ayudanteMo}"\n    formula: horas_ayudante`
        ]
      : [
          `  - categoria: "${oficialMo}"\n    formula: horas_oficial`
        ];
  } else {
    // Tomas TUG / Boca estándar o fallback
    categoria = 'Instalaciones';
    unidad = 'boca';
    parametrosYaml = `  - id: bocas\n    nombre: Cantidad de Bocas de Tomacorriente\n    tipo: numero\n    default: 8\n    unidad: bocas\n  - id: metros_por_boca\n    nombre: Metros de cañería por boca\n    tipo: numero\n    default: 4\n    unidad: m`;
    calculosYaml = ayudanteMo
      ? `  metros_canio: bocas * metros_por_boca\n  cable_fase_neutro: metros_canio * 2 * 1.10\n  cable_tierra: metros_canio * 1.10\n  horas_oficial: bocas * 0.9\n  horas_ayudante: bocas * 0.6`
      : `  metros_canio: bocas * metros_por_boca\n  cable_fase_neutro: metros_canio * 2 * 1.10\n  cable_tierra: metros_canio * 1.10\n  horas_oficial: bocas * 1.5`;
    clausulaNotas = 'Circuito para Tomacorrientes de Uso General (TUG) según AEA 90364 (máx 15 bocas, protección máx 16A). Conductor mínimo 2.5 mm² IRAM 2183.';
    clausulaExclusiones = 'No incluye provisión de artefactos electrodomésticos ni aperturas en mampostería no cotizadas.';

    const cable25 = findMatchingInsumo(insumosMap, ['cable', '2.5']) || findMatchingInsumo(insumosMap, ['cable', 'unipolar']) || findMatchingInsumo(insumosMap, ['cable']);
    const cablePe = findMatchingInsumo(insumosMap, ['cable', 'tierra']) || findMatchingInsumo(insumosMap, ['cable', 'verde']);
    const termica16 = findMatchingInsumo(insumosMap, ['termica', '16']) || findMatchingInsumo(insumosMap, ['termomagnetica']) || findMatchingInsumo(insumosMap, ['termica']);
    const toma = findMatchingInsumo(insumosMap, ['toma', '10']) || findMatchingInsumo(insumosMap, ['tomacorriente']) || findMatchingInsumo(insumosMap, ['toma']);
    const canio = findMatchingInsumo(insumosMap, ['corrugado']) || findMatchingInsumo(insumosMap, ['canio']);

    addMat(cable25, 'Cable Unipolar 2.5mm² IRAM 2183', 'formula: cable_fase_neutro');
    addMat(cablePe, 'Cable Unipolar 2.5mm² Verde/Amarillo', 'formula: cable_tierra');
    addMat(termica16, 'Termomagnética Bipolar 16A Curva C', 'cantidad: 1');
    addMat(toma, 'Módulo Tomacorriente 10A 2P+T con Bastidor', 'formula: bocas * 2');
    if (canio) {
      addMat(canio, 'Caño Corrugado Blanco Ignífugo 3/4"', 'formula: metros_canio');
    }

    manoObraLines = ayudanteMo
      ? [
          `  - categoria: "${oficialMo}"\n    formula: horas_oficial`,
          `  - categoria: "${ayudanteMo}"\n    formula: horas_ayudante`
        ]
      : [
          `  - categoria: "${oficialMo}"\n    formula: horas_oficial`
        ];
  }

  // Si no se asignó ningún material por arquetipo, buscar insumos relevantes en el catálogo
  if (materialesLines.length === 0) {
    const relevantInsumos = findRelevantInsumos(prompt, insumosMap, 4);
    if (relevantInsumos.length > 0) {
      for (const ins of relevantInsumos) {
        materialesLines.push(`  - material: "${ins.nombre}"\n    cantidad: 1`);
      }
    } else {
      materialesLines.push(`  - material: "Material Normalizado del Catálogo"\n    cantidad: 1`);
    }
  }

  return `nombre: ${nombre}
categoria: ${categoria}
unidad: ${unidad}
naturaleza: instalacion

parametros:
${parametrosYaml}

calculos:
${calculosYaml}

materiales:
${materialesLines.join('\n')}

mano_obra:
${manoObraLines.join('\n')}

clausulas:
  notas: "${clausulaNotas}"
  exclusiones: "${clausulaExclusiones}"
`;
}

/**
 * Orquesta la generación asistida por IA:
 * 1. Si Ollama está disponible, envía el prompt optimizado con reglas AEA y catálogo.
 * 2. Si no hay conexión o falla, activa el generador heurístico inteligente con datos del catálogo.
 */
export async function generateTareaTipoWithAI(
  userPrompt: string,
  insumosMap: Map<string, Insumo>,
  manoObraMap: Map<string, CategoriaManoDeObra>,
  options: AiGenerationOptions = {}
): Promise<AiGenerationResult> {
  const host = options.host || 'http://localhost:11434';
  const model = options.model || 'gemma-64k:latest';
  const temperature = options.temperature ?? 0.2;

  const isOllamaOnline = await checkOllamaAvailability(host);

  if (isOllamaOnline) {
    try {
      const system = generateSystemPrompt();
      const prompt = buildUserPrompt({ userPrompt, insumosMap, manoObraMap });

      const res = await fetch(`${host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          system,
          prompt,
          stream: false,
          options: { temperature },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const cleanedYaml = cleanAiYamlResponse(data.response || '');
        if (cleanedYaml) {
          const parsed = parseTareaTipoFromDSL(cleanedYaml, insumosMap, manoObraMap);
          return {
            yaml: cleanedYaml,
            source: 'ollama',
            modelUsed: model,
            diagnosticsCount: parsed.diagnostics.length,
          };
        }
      }
    } catch {
      // Fallback a heurístico si hay timeout o error de red
    }
  }

  // Fallback heurístico normativo
  const heuristicYaml = generateHeuristicTareaTipo(userPrompt, insumosMap, manoObraMap);
  const parsedFallback = parseTareaTipoFromDSL(heuristicYaml, insumosMap, manoObraMap);

  return {
    yaml: heuristicYaml,
    source: 'heuristic_fallback',
    diagnosticsCount: parsedFallback.diagnostics.length,
  };
}

/**
 * Genera directamente el objeto estructurado TareaFormData listo para poblar
 * formularios visuales sin obligar al usuario a ver o editar código YAML.
 */
export async function generateTareaFormDataWithAI(
  userPrompt: string,
  insumosMap: Map<string, Insumo>,
  manoObraMap: Map<string, CategoriaManoDeObra>,
  categoriasList: string[] = [],
  options: AiGenerationOptions = {}
): Promise<AiFormDataResult> {
  const aiResult = await generateTareaTipoWithAI(userPrompt, insumosMap, manoObraMap, options);
  const parsed = parseTareaTipoFromDSL(aiResult.yaml, insumosMap, manoObraMap, categoriasList);

  return {
    data: parsed.data,
    yaml: aiResult.yaml,
    source: aiResult.source,
    modelUsed: aiResult.modelUsed,
    diagnosticsCount: parsed.diagnostics.length,
  };
}

/**
 * Sugiere materiales complementarios según la reglamentación AEA 90364
 * para ser agregados directamente a la pestaña de Materiales de una tarea existente.
 */
export function suggestAeaMaterialsForTask(
  taskName: string,
  taskCategory: string,
  insumosMap: Map<string, Insumo>
): InsumoEnTarea[] {
  const normName = normalizeDslString(taskName);
  const normCat = normalizeDslString(taskCategory);
  const combined = `${normName} ${normCat}`;

  const isAire = combined.includes('aire') || combined.includes('split') || combined.includes('tue') || combined.includes('fuerza');
  const isPat = combined.includes('tierra') || combined.includes('jabalina') || combined.includes('pat');
  const isIluminacion = combined.includes('iluminac') || combined.includes('luz') || combined.includes('iug');
  const isTablero = combined.includes('tablero') || combined.includes('seccional');

  const suggested: InsumoEnTarea[] = [];

  if (isAire) {
    const cable = findMatchingInsumo(insumosMap, ['cable', '2.5']) || findMatchingInsumo(insumosMap, ['cable', 'unipolar']);
    const cablePe = findMatchingInsumo(insumosMap, ['cable', 'tierra']) || findMatchingInsumo(insumosMap, ['cable', 'verde']);
    const termica = findMatchingInsumo(insumosMap, ['termica', '20']) || findMatchingInsumo(insumosMap, ['termomagnetica']);
    const toma = findMatchingInsumo(insumosMap, ['toma', '20']);

    if (cable) suggested.push({ materialId: cable.id, insumoId: cable.id, cantidad: 25, formula: 'distancia_tablero * 2 * 1.10', nombreSlot: cable.nombre });
    if (cablePe) suggested.push({ materialId: cablePe.id, insumoId: cablePe.id, cantidad: 12, formula: 'distancia_tablero * 1.10', nombreSlot: cablePe.nombre });
    if (termica) suggested.push({ materialId: termica.id, insumoId: termica.id, cantidad: 1, formula: '1', nombreSlot: termica.nombre });
    if (toma) suggested.push({ materialId: toma.id, insumoId: toma.id, cantidad: 1, formula: '1', nombreSlot: toma.nombre });
  } else if (isPat) {
    const jabalina = findMatchingInsumo(insumosMap, ['jabalina']);
    const tomacable = findMatchingInsumo(insumosMap, ['tomacable']);
    const caja = findMatchingInsumo(insumosMap, ['inspeccion']);
    const cablePe = findMatchingInsumo(insumosMap, ['cable', 'verde']) || findMatchingInsumo(insumosMap, ['cable', '4']);

    if (jabalina) suggested.push({ materialId: jabalina.id, insumoId: jabalina.id, cantidad: 1, formula: '1', nombreSlot: jabalina.nombre });
    if (tomacable) suggested.push({ materialId: tomacable.id, insumoId: tomacable.id, cantidad: 1, formula: '1', nombreSlot: tomacable.nombre });
    if (caja) suggested.push({ materialId: caja.id, insumoId: caja.id, cantidad: 1, formula: '1', nombreSlot: caja.nombre });
    if (cablePe) suggested.push({ materialId: cablePe.id, insumoId: cablePe.id, cantidad: 10, formula: 'distancia_bajada * 1.10', nombreSlot: cablePe.nombre });
  } else if (isIluminacion) {
    const cable15 = findMatchingInsumo(insumosMap, ['cable', '1.5']) || findMatchingInsumo(insumosMap, ['cable', 'unipolar']);
    const cablePe = findMatchingInsumo(insumosMap, ['cable', 'tierra']) || findMatchingInsumo(insumosMap, ['cable', '2.5']);
    const termica = findMatchingInsumo(insumosMap, ['termica', '10']);

    if (cable15) suggested.push({ materialId: cable15.id, insumoId: cable15.id, cantidad: 20, formula: 'bocas * 7 * 1.10', nombreSlot: cable15.nombre });
    if (cablePe) suggested.push({ materialId: cablePe.id, insumoId: cablePe.id, cantidad: 10, formula: 'bocas * 3 * 1.10', nombreSlot: cablePe.nombre });
    if (termica) suggested.push({ materialId: termica.id, insumoId: termica.id, cantidad: 1, formula: '1', nombreSlot: termica.nombre });
  } else if (isTablero) {
    const disyuntor = findMatchingInsumo(insumosMap, ['diferencial']) || findMatchingInsumo(insumosMap, ['disyuntor']);
    const termica = findMatchingInsumo(insumosMap, ['termica']);
    const gabinete = findMatchingInsumo(insumosMap, ['gabinete']) || findMatchingInsumo(insumosMap, ['tablero']);

    if (gabinete) suggested.push({ materialId: gabinete.id, insumoId: gabinete.id, cantidad: 1, formula: '1', nombreSlot: gabinete.nombre });
    if (disyuntor) suggested.push({ materialId: disyuntor.id, insumoId: disyuntor.id, cantidad: 1, formula: '1', nombreSlot: disyuntor.nombre });
    if (termica) suggested.push({ materialId: termica.id, insumoId: termica.id, cantidad: 2, formula: '2', nombreSlot: termica.nombre });
  } else {
    // General TUG
    const cable = findMatchingInsumo(insumosMap, ['cable', '2.5']) || findMatchingInsumo(insumosMap, ['cable', 'unipolar']);
    const cablePe = findMatchingInsumo(insumosMap, ['cable', 'tierra']) || findMatchingInsumo(insumosMap, ['cable', 'verde']);
    const termica = findMatchingInsumo(insumosMap, ['termica', '16']);

    if (cable) suggested.push({ materialId: cable.id, insumoId: cable.id, cantidad: 30, formula: 'bocas * 8 * 1.10', nombreSlot: cable.nombre });
    if (cablePe) suggested.push({ materialId: cablePe.id, insumoId: cablePe.id, cantidad: 15, formula: 'bocas * 4 * 1.10', nombreSlot: cablePe.nombre });
    if (termica) suggested.push({ materialId: termica.id, insumoId: termica.id, cantidad: 1, formula: '1', nombreSlot: termica.nombre });
  }

  return suggested;
}

/**
 * Devuelve cláusulas legales y notas técnicas normalizadas según AEA 90364 para una tarea.
 */
export function getAeaClausesForTask(
  taskName: string,
  taskCategory: string
): { notasTecnicas: string; clausulaExclusiones: string } {
  const normName = normalizeDslString(taskName);
  const normCat = normalizeDslString(taskCategory);
  const combined = `${normName} ${normCat}`;

  if (combined.includes('tierra') || combined.includes('jabalina') || combined.includes('pat') || combined.includes('srt')) {
    return {
      notasTecnicas: 'Puesta a tierra reglamentaria con jabalina IRAM 2309 y medición de resistencia según protocolo SRT 900/15 con telurímetro contrastado.',
      clausulaExclusiones: 'No incluye obras civiles de picado de roca ni adecuación de circuitos internos del inmueble que no posean conductor de protección PE.'
    };
  }

  if (combined.includes('aire') || combined.includes('split') || combined.includes('tue') || combined.includes('fuerza')) {
    return {
      notasTecnicas: 'Circuito exclusivo TUE según norma AEA 90364-7-770 con protección termomagnética calibrada (curva C) y conductor normalizado IRAM 2183.',
      clausulaExclusiones: 'No incluye provisión del equipo acondicionador de aire / electrodoméstico, soporte de unidad exterior, carga de gas ni perforaciones en hormigón armado.'
    };
  }

  if (combined.includes('tablero') || combined.includes('seccional')) {
    return {
      notasTecnicas: 'Montaje y conexionado de Tablero Seccional según AEA 90364-7-770. Identificación reglamentaria de circuitos y bornera equipotencial de tierra.',
      clausulaExclusiones: 'No incluye adecuación de la línea principal de acometida de la distribuidora eléctrica.'
    };
  }

  return {
    notasTecnicas: 'Instalación eléctrica ejecutada según Reglamentación AEA 90364. Conductores con sello IRAM y protecciones coordinadas (Ib <= In <= Iz).',
    clausulaExclusiones: 'No incluye trabajos de albañilería pesada, pintura, zanjeo en suelo consolidado ni rotura de hormigón armado.'
  };
}
