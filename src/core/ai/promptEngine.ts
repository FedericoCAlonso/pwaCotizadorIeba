import { Insumo, CategoriaManoDeObra } from '../types';
import { generateAeaRulesDigest } from './aeaRules';
import { normalizeDslString } from '../tareaTipoDsl';

/**
 * Genera el System Prompt de alta precisión para el Asistente de IA de Cotizador IEBA.
 * Integra estructura de costos, normas AEA 90364 y gramática YAML de Trabajos Tipo.
 */
export function generateSystemPrompt(): string {
  const aeaDigest = generateAeaRulesDigest();

  return `
Eres el Asistente Técnico de Ingeniería y Copiloto de Presupuestación de "Cotizador IEBA".
Tu objetivo es transformar peticiones de instalaciones o servicios eléctricos en definiciones estructuradas de Trabajos Tipo en formato YAML listo para computar costos.

--- ESTRUCTURA DE COSTOS Y METODOLOGÍA IEBA ---
1. Costo Directo (CD): Materiales de catálogo + Horas de Mano de Obra.
2. Parámetros de Entrada: Todo dimensionamiento debe basarse en parámetros dinámicos medibles (bocas, metros, circuitos, cantidad, potencia).
3. Desperdicio: Incluir 10% de desperdicio en conductores por replanteo y cortes.
4. Cuadrilla: Definir horas balanceadas para Oficial Electricista y Ayudante cuando el trabajo requiera canalización o tendido.
5. Cláusulas Técnicas: Incluir siempre notas de alcance y exclusiones legales (ej: no rotura de hormigón, no pintura, cañerías existentes aptas).

--- REGLAMENTACIÓN TÉCNICA OBLIGATORIA ---
${aeaDigest}

--- FORMATO DE SALIDA (YAML ESTRICTO) ---
Debes responder ÚNICAMENTE con un documento YAML válido respetando exactamente esta estructura de campos:

nombre: [Nombre descriptivo del trabajo]
categoria: [Instalaciones | Iluminación | Tableros | Puesta a Tierra | etc.]
unidad: [boca | m | u | global | etc.]
naturaleza: instalacion # instalacion | servicio_profesional | servicio_tercerizado

parametros:
  - id: [nombre_variable_sin_espacios]
    nombre: [Nombre visible para el usuario]
    tipo: numero # numero | select | boolean
    default: [valor numerico]
    unidad: [u | m | bocas | etc.]

calculos:
  [nombre_variable]: [formula_matematica_usando_parametros]

materiales:
  - material: "[Nombre exacto o similar del insumo en el catálogo del usuario]"
    formula: [variable_o_formula] # o 'cantidad: [numero]'

mano_obra:
  - categoria: "[Nombre de la categoría de mano de obra del usuario]"
    formula: [variable_o_formula] # o 'horas: [numero]'
    horas_setup: [horas fijas de alistamiento opcionales]

clausulas:
  notas: [Alcance técnico y consideraciones]
  exclusiones: [Trabajos no incluidos para protección del profesional]

REGLAS DE FORMATO:
- NO agregues texto conversacional antes ni después.
- NO agregues bloques de código markdown (\`\`\`yaml). Devuelve solo el YAML en texto plano.
- Respeta la indentación de 2 espacios.
`.trim();
}

/**
 * Busca insumos relevantes dentro del catálogo del usuario según las palabras clave de la petición.
 */
export function findRelevantInsumos(
  query: string,
  insumosMap: Map<string, Insumo>,
  maxResults: number = 15
): Insumo[] {
  const normalizedQuery = normalizeDslString(query);
  const keywords = normalizedQuery.split(/\s+/).filter((w) => w.length > 2);

  if (keywords.length === 0) {
    return Array.from(insumosMap.values()).slice(0, maxResults);
  }

  const scored: Array<{ insumo: Insumo; score: number }> = [];

  for (const insumo of insumosMap.values()) {
    const normNombre = normalizeDslString(insumo.nombre);
    const normCat = normalizeDslString(insumo.categoria || '');
    let score = 0;

    for (const kw of keywords) {
      if (normNombre.includes(kw)) score += 3;
      if (normCat.includes(kw)) score += 1;
      if (insumo.marca && normalizeDslString(insumo.marca).includes(kw)) score += 2;
    }

    if (score > 0) {
      scored.push({ insumo, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map((item) => item.insumo);
}

export interface BuildPromptParams {
  userPrompt: string;
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
}

/**
 * Ensambla el prompt del usuario inyectando el catálogo local relevante
 * para que el modelo elija materiales y mano de obra reales del usuario.
 */
export function buildUserPrompt({
  userPrompt,
  insumosMap,
  manoObraMap,
}: BuildPromptParams): string {
  const relevantInsumos = findRelevantInsumos(userPrompt, insumosMap, 15);
  const categoriasMo = Array.from(manoObraMap.values()).map((m) => m.nombre);

  let contextSnippet = 'CATÁLOGO LOCAL DISPONIBLE DEL USUARIO (Prioriza usar estos nombres de materiales si corresponden):\n';

  if (relevantInsumos.length > 0) {
    for (const ins of relevantInsumos) {
      contextSnippet += ` • "${ins.nombre}" (${ins.unidadVenta || 'u'})\n`;
    }
  } else {
    contextSnippet += ' (No se hallaron coincidencias específicas. Sugiere materiales estándar normalizados IRAM).\n';
  }

  contextSnippet += '\nCATEGORÍAS DE MANO DE OBRA CONFIGURADAS:\n';
  if (categoriasMo.length > 0) {
    for (const moName of categoriasMo) {
      contextSnippet += ` • "${moName}"\n`;
    }
  } else {
    contextSnippet += ' • "Oficial Electricista"\n • "Ayudante"\n';
  }

  return `
PETICIÓN DEL USUARIO:
${userPrompt.trim()}

${contextSnippet}

Genera la definición en YAML estricto cumpliendo las normas AEA correspondientes.
`.trim();
}
