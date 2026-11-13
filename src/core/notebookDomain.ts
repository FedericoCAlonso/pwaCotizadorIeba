/**
 * notebookDomain.ts - Funciones puras de dominio para el modelo ampliado del Notebook de Cotizaciones.
 *
 * Responsabilidades:
 * - Normalización determinista de identificadores/slugs de Trabajos Tipo.
 * - Evaluación de VariablesCotizacion con dependencias entre sí y detección de ciclos.
 * - Detección de ciclos en composición de Trabajos Tipo (subTrabajos).
 * - Evaluación de Alcance y Advertencias Condicionales según supuestos activos y presupuesto de visibilidad.
 *
 * Nota: No modifica la cascada de costos ni el motor de fórmulas existente; reutiliza `evaluateMathExpression`.
 */

import {
  AdvertenciaCondicional,
  AdvertenciaEvaluada,
  ClausulaAlcance,
  Presupuesto,
  TareaTipo,
  VariableCotizacion,
} from './types';
import { evaluateMathExpression, RESERVED_KEYWORDS } from './mathEvaluator';

export const PRESUPUESTO_MAXIMO_ADVERTENCIAS_VISIBLES = 3;

export interface ResultadoEvaluacionVariables {
  variables: VariableCotizacion[];
  scope: Record<string, number>;
  tieneErrores: boolean;
}

export interface GrupoTemaAlcance {
  tema: string;
  inclusiones: ClausulaAlcance[];
  exclusiones: ClausulaAlcance[];
  advertencias: AdvertenciaEvaluada[];
}

export interface ResultadoAlcanceYAdvertencias {
  inclusiones: ClausulaAlcance[];
  exclusiones: ClausulaAlcance[];
  advertenciasVisibles: AdvertenciaEvaluada[];
  advertenciasPlegadas: AdvertenciaEvaluada[];
  todasLasAdvertencias: AdvertenciaEvaluada[];
  gruposPorTema: GrupoTemaAlcance[];
  excedePresupuestoAdvertencias: boolean;
}

/**
 * Convierte un nombre legible en un slug determinista ASCII en minúsculas separado por guiones.
 */
export function slugifyIdentificador(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extrae identificadores de variables referenciados en una expresión matemática.
 */
export function extraerDependenciasExpresion(expresion: string): string[] {
  if (!expresion || typeof expresion !== 'string') return [];
  const clean = expresion.trim().startsWith('=') ? expresion.trim().slice(1) : expresion;
  const matches = clean.match(/[a-zA-Z_]\w*/g) || [];
  const deps = new Set<string>();
  for (const id of matches) {
    if (!RESERVED_KEYWORDS.has(id.toLowerCase())) {
      deps.add(id);
    }
  }
  return Array.from(deps);
}

/**
 * Evalúa las variables de cotización respetando dependencias entre sí y detectando ciclos
 * o referencias a variables inexistentes.
 */
export function evaluarVariablesCotizacion(
  variables: VariableCotizacion[]
): ResultadoEvaluacionVariables {
  const varMap = new Map<string, VariableCotizacion>();
  const duplicados = new Set<string>();

  for (const v of variables) {
    if (varMap.has(v.id)) {
      duplicados.add(v.id);
    }
    varMap.set(v.id, v);
  }

  const scope: Record<string, number> = {};
  const erroresMap = new Map<string, string>();
  const resolved = new Set<string>();
  const visiting = new Set<string>();

  const evaluar = (id: string, stack: string[]): void => {
    if (resolved.has(id)) return;

    if (visiting.has(id)) {
      const cycleStart = stack.indexOf(id);
      const cyclePath = [...stack.slice(Math.max(0, cycleStart)), id].join(' -> ');
      for (const nodeId of stack.slice(Math.max(0, cycleStart))) {
        erroresMap.set(nodeId, `Referencia circular detectada: ${cyclePath}`);
      }
      return;
    }

    const variable = varMap.get(id);
    if (!variable) return;

    if (duplicados.has(id)) {
      erroresMap.set(id, `Variable duplicada '${id}'.`);
    }

    visiting.add(id);
    const expr = (variable.expresion ?? '').trim();
    const deps = extraerDependenciasExpresion(expr);

    for (const dep of deps) {
      if (dep === id) {
        erroresMap.set(id, `Referencia circular detectada: ${id} -> ${id}`);
      } else if (varMap.has(dep)) {
        evaluar(dep, [...stack, id]);
      } else {
        erroresMap.set(id, `Variable no definida '${dep}' en la expresión de '${id}'.`);
      }
    }

    if (!erroresMap.has(id)) {
      if (expr === '') {
        erroresMap.set(id, `La variable '${id}' no tiene expresión o valor.`);
      } else {
        const res = evaluateMathExpression(expr, scope);
        if (res.isValid && res.value !== null && !Number.isNaN(res.value)) {
          scope[id] = res.value;
        } else {
          erroresMap.set(id, res.error || `Error al evaluar la variable '${id}'.`);
        }
      }
    }

    visiting.delete(id);
    resolved.add(id);
  };

  for (const v of variables) {
    evaluar(v.id, []);
  }

  const resultadoVariables: VariableCotizacion[] = variables.map((v) => {
    const deps = extraerDependenciasExpresion(v.expresion);
    const error = erroresMap.get(v.id);
    return {
      ...v,
      dependencias: deps,
      valorEvaluado: error ? undefined : scope[v.id],
      error,
    };
  });

  return {
    variables: resultadoVariables,
    scope,
    tieneErrores: erroresMap.size > 0,
  };
}

/**
 * Detecta ciclos en la composición jerárquica de Trabajos Tipo (subTrabajos).
 * Retorna el camino del ciclo (ej: ['tt-a', 'tt-b', 'tt-a']) o null si es acíclico.
 */
export function detectarCiclosComposicionTareaTipo(
  tareaTipoId: string,
  catalogo: Map<string, TareaTipo>,
  camino: string[] = []
): string[] | null {
  if (camino.includes(tareaTipoId)) {
    const idx = camino.indexOf(tareaTipoId);
    return [...camino.slice(idx), tareaTipoId];
  }

  const tarea = catalogo.get(tareaTipoId);
  if (!tarea?.subTrabajos || tarea.subTrabajos.length === 0) {
    return null;
  }

  const nuevoCamino = [...camino, tareaTipoId];
  for (const sub of tarea.subTrabajos) {
    const ciclo = detectarCiclosComposicionTareaTipo(sub.tareaTipoId, catalogo, nuevoCamino);
    if (ciclo) return ciclo;
  }
  return null;
}

function formatearTextoAdvertencia(adv: AdvertenciaCondicional): string {
  const precio = adv.precioUnitarioContingencia;
  if (precio !== undefined && Number.isFinite(precio)) {
    const formatted = `$${precio.toLocaleString('es-AR')}`;
    if (adv.textoPlantilla.includes('{precio}')) {
      return adv.textoPlantilla.replace(/\{precio\}/g, formatted);
    }
    const unidadSuffix = adv.unidadContingencia ? ` por ${adv.unidadContingencia}` : '';
    return `${adv.textoPlantilla.trim()} (${formatted}${unidadSuffix}).`;
  }
  return adv.textoPlantilla.trim();
}

/**
 * Evalúa las inclusiones, exclusiones y advertencias condicionales para el documento al cliente.
 * Implementa las 7 reglas de Alcance y Advertencias:
 * - Solo evalúa advertencias cuyo supuesto no está verificado / no aplica.
 * - Deduplica inclusiones, exclusiones y advertencias repetidas entre tareas.
 * - Agrupa por tema y respeta el presupuesto de 3 advertencias visibles antes del total.
 * - Nunca incluye notas internas.
 */
export function evaluarAlcanceYAdvertencias(
  presupuesto: Presupuesto,
  tareasTipoMap: Map<string, TareaTipo>,
  maxVisibles: number = PRESUPUESTO_MAXIMO_ADVERTENCIAS_VISIBLES
): ResultadoAlcanceYAdvertencias {
  const inclusionesMap = new Map<string, ClausulaAlcance>();
  const exclusionesMap = new Map<string, ClausulaAlcance>();
  const advertenciasMap = new Map<string, AdvertenciaEvaluada>();

  const supuestosGlobales = presupuesto.supuestos ?? {};

  for (const item of presupuesto.items) {
    if (!item.tareaTipoId) continue;
    const tarea = tareasTipoMap.get(item.tareaTipoId);
    if (!tarea) continue;

    const quitados = new Set(item.ajustesInstancia?.quitados ?? []);

    if (tarea.alcance) {
      for (const inc of tarea.alcance.inclusiones) {
        if (quitados.has(inc.id)) continue;
        const key = inc.texto.trim().toLowerCase();
        if (!inclusionesMap.has(key)) {
          inclusionesMap.set(key, {
            id: inc.id,
            texto: inc.texto.trim(),
            tema: inc.tema || 'general',
          });
        }
      }

      for (const exc of tarea.alcance.exclusiones) {
        const key = exc.texto.trim().toLowerCase();
        if (!exclusionesMap.has(key)) {
          exclusionesMap.set(key, {
            id: exc.id,
            texto: exc.texto.trim(),
            tema: exc.tema || 'general',
          });
        }
      }
    } else if (tarea.clausulaExclusiones && tarea.clausulaExclusiones.trim()) {
      const texto = tarea.clausulaExclusiones.trim();
      const key = texto.toLowerCase();
      if (!exclusionesMap.has(key)) {
        exclusionesMap.set(key, {
          id: `excl-${tarea.id}`,
          texto,
          tema: 'general',
        });
      }
    }

    const supuestosDeclarados = new Map(
      (tarea.supuestos ?? []).map((s) => [s.id, s])
    );

    for (const adv of tarea.advertenciasCondicionales ?? []) {
      const decl = supuestosDeclarados.get(adv.supuestoId);
      const valorActual =
        item.supuestosLocales?.[adv.supuestoId] ??
        supuestosGlobales[adv.supuestoId] ??
        decl?.valorDefault;

      // Regla 2: si el supuesto está verificado o no aplica (o no coincide con activación), no se evalúa ni muestra.
      if (!valorActual || valorActual === 'verificada' || valorActual === 'no_aplica') {
        continue;
      }
      if (!adv.valoresActivacion.includes(valorActual)) {
        continue;
      }

      // Regla 1: debe tener consecuencia económica o cambio de responsabilidad.
      const tieneImpacto =
        (adv.precioUnitarioContingencia !== undefined && adv.precioUnitarioContingencia > 0) ||
        adv.cambiaResponsabilidad === true;
      if (!tieneImpacto) continue;

      const textoFinal = formatearTextoAdvertencia(adv);
      const dedupKey = `${(adv.tema || 'general').toLowerCase()}::${textoFinal.toLowerCase()}`;
      if (!advertenciasMap.has(dedupKey)) {
        advertenciasMap.set(dedupKey, {
          id: adv.id,
          tema: adv.tema || 'general',
          texto: textoFinal,
          precioUnitarioContingencia: adv.precioUnitarioContingencia,
          unidadContingencia: adv.unidadContingencia,
          supuestoId: adv.supuestoId,
          origenTareaTipoId: tarea.id,
        });
      }
    }

    // Advertencia explícita al cliente del propio ítem (nunca notasInternas)
    if (item.advertenciaCliente && item.advertenciaCliente.trim()) {
      const texto = item.advertenciaCliente.trim();
      const dedupKey = `general::${texto.toLowerCase()}`;
      if (!advertenciasMap.has(dedupKey)) {
        advertenciasMap.set(dedupKey, {
          id: `adv-item-${item.id}`,
          tema: 'general',
          texto,
        });
      }
    }
  }

  const inclusiones = Array.from(inclusionesMap.values());
  const exclusiones = Array.from(exclusionesMap.values());
  const todasLasAdvertencias = Array.from(advertenciasMap.values());

  const advertenciasVisibles = todasLasAdvertencias.slice(0, maxVisibles);
  const advertenciasPlegadas = todasLasAdvertencias.slice(maxVisibles);

  const gruposMap = new Map<string, GrupoTemaAlcance>();
  const ensureGrupo = (tema?: string): GrupoTemaAlcance => {
    const key = (tema || 'general').trim() || 'general';
    let g = gruposMap.get(key);
    if (!g) {
      g = { tema: key, inclusiones: [], exclusiones: [], advertencias: [] };
      gruposMap.set(key, g);
    }
    return g;
  };

  for (const inc of inclusiones) ensureGrupo(inc.tema).inclusiones.push(inc);
  for (const exc of exclusiones) ensureGrupo(exc.tema).exclusiones.push(exc);
  for (const adv of todasLasAdvertencias) ensureGrupo(adv.tema).advertencias.push(adv);

  return {
    inclusiones,
    exclusiones,
    advertenciasVisibles,
    advertenciasPlegadas,
    todasLasAdvertencias,
    gruposPorTema: Array.from(gruposMap.values()),
    excedePresupuestoAdvertencias: todasLasAdvertencias.length > maxVisibles,
  };
}
