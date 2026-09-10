import { Insumo, CategoriaManoDeObra } from '../types';
import { generateSystemPrompt, buildUserPrompt, findRelevantInsumos } from './promptEngine';
import { parseTareaTipoFromDSL } from '../tareaTipoDsl';

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
 * Generador heurístico de plantillas basado en normas AEA y catálogo real del usuario.
 * Se ejecuta de inmediato si no hay un motor LLM conectado o si el usuario está offline en móvil.
 */
export function generateHeuristicTareaTipo(
  prompt: string,
  insumosMap: Map<string, Insumo>,
  manoObraMap: Map<string, CategoriaManoDeObra>
): string {
  const normPrompt = prompt.toLowerCase();
  const relevantInsumos = findRelevantInsumos(prompt, insumosMap, 4);
  const firstMo = Array.from(manoObraMap.values())[0]?.nombre || 'Oficial Electricista';

  const isAire = normPrompt.includes('aire') || normPrompt.includes('split') || normPrompt.includes('clima');
  const isPat = normPrompt.includes('jabalina') || normPrompt.includes('tierra') || normPrompt.includes('pat');
  const isIluminacion = normPrompt.includes('iluminac') || normPrompt.includes('luz') || normPrompt.includes('lampara');

  let nombre = prompt.trim();
  if (nombre.length > 50) nombre = `${nombre.slice(0, 47)}...`;
  nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1);

  let categoria = 'Instalaciones';
  let unidad = 'u';
  let parametrosYaml = `  - id: cantidad\n    nombre: Cantidad de Unidades\n    tipo: numero\n    default: 1\n    unidad: u`;
  let calculosYaml = `  horas_total: cantidad * 2.0`;
  let clausulaNotas = 'Trabajo de instalación eléctrica según especificaciones técnicas.';
  let clausulaExclusiones = 'No incluye trabajos de albañilería, pintura ni rotura de hormigón.';

  if (isAire) {
    categoria = 'Fuerza Motriz';
    parametrosYaml = `  - id: equipos\n    nombre: Cantidad de Equipos Split\n    tipo: numero\n    default: 1\n    unidad: u\n  - id: distancia_tablero\n    nombre: Metros promedio hasta Tablero\n    tipo: numero\n    default: 12\n    unidad: m`;
    calculosYaml = `  metros_cable: equipos * distancia_tablero * 3 * 1.10\n  horas_instalacion: equipos * 3.5`;
    clausulaNotas = 'Circuito exclusivo TUE según norma AEA 90364-7-770 con protección termomagnética dedicada.';
    clausulaExclusiones = 'No incluye provisión del equipo acondicionador de aire ni carga de gas refrigerante.';
  } else if (isPat) {
    categoria = 'Puesta a Tierra';
    unidad = 'punto';
    parametrosYaml = `  - id: jabalinas\n    nombre: Cantidad de Jabalinas a hincar\n    tipo: numero\n    default: 1\n    unidad: u\n  - id: metros_bajada\n    nombre: Metros de Conductor de Bajada PE\n    tipo: numero\n    default: 10\n    unidad: m`;
    calculosYaml = `  horas_hincado_medicion: jabalinas * 2.5`;
    clausulaNotas = 'Puesta a tierra reglamentaria con jabalina IRAM 2309 y medición de resistencia según protocolo SRT 900/15.';
    clausulaExclusiones = 'No incluye adecuación de instalaciones internas antirreglamentarias existentes.';
  } else if (isIluminacion) {
    categoria = 'Iluminación';
    unidad = 'boca';
    parametrosYaml = `  - id: bocas\n    nombre: Cantidad de Bocas de Iluminación\n    tipo: numero\n    default: 8\n    unidad: bocas`;
    calculosYaml = `  metros_cable: bocas * 8 * 3 * 1.10\n  horas_oficial: bocas * 0.75`;
    clausulaNotas = 'Circuito IUG según norma AEA con conductores normalizados de 1.5mm².';
    clausulaExclusiones = 'No incluye provisión de luminarias, artefactos decorativos ni lámparas.';
  }

  // Generar sección de materiales usando insumos encontrados o nombres genéricos
  let materialesYaml = '';
  if (relevantInsumos.length > 0) {
    materialesYaml = relevantInsumos
      .map((ins) => `  - material: "${ins.nombre}"\n    cantidad: 1`)
      .join('\n');
  } else {
    materialesYaml = `  - material: "Material Normalizado del Catálogo"\n    cantidad: 1`;
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
${materialesYaml}

mano_obra:
  - categoria: "${firstMo}"
    horas: 2

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
