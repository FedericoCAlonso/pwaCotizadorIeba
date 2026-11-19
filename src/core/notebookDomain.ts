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
import {
  convertUnitValue,
  evaluateUnitExpression,
  extractUnitExpressionDependencies,
  lookupUnitDef,
  UnitScopedValue,
} from './unitAlgebra';

export const PRESUPUESTO_MAXIMO_ADVERTENCIAS_VISIBLES = 3;

export interface ResultadoEvaluacionVariables {
  variables: VariableCotizacion[];
  scope: Record<string, number>;
  unitScope: Record<string, UnitScopedValue>;
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
 * Extrae identificadores de variables referenciados en una expresión matemática,
 * ignorando unidades inline que acompañan literales numéricos (`10 m + 80 cm`).
 */
export function extraerDependenciasExpresion(expresion: string): string[] {
  return extractUnitExpressionDependencies(expresion);
}

/**
 * Calcula la distancia de edición (Levenshtein) entre dos cadenas normalizadas.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n];
}

/**
 * Sugiere el identificador disponible más parecido a uno mal escrito (typo).
 */
export function sugerirIdentificadorCercano(
  desconocido: string,
  disponibles: string[]
): string | undefined {
  const target = (desconocido || '').trim().toLowerCase();
  if (!target || disponibles.length === 0) return undefined;

  const maxDist = target.length <= 4 ? 1 : 2;
  let bestCandidate: string | undefined;
  let bestDist = Infinity;

  for (const cand of disponibles) {
    const candLower = cand.toLowerCase();
    if (candLower === target) return cand;
    const dist = levenshteinDistance(target, candLower);
    const sharesPrefix =
      target.length >= 3 &&
      candLower.length >= 3 &&
      (candLower.startsWith(target) || target.startsWith(candLower));

    if (dist <= maxDist && dist < bestDist) {
      bestDist = dist;
      bestCandidate = cand;
    } else if (sharesPrefix && bestCandidate === undefined) {
      bestCandidate = cand;
      bestDist = maxDist + 0.5;
    }
  }
  return bestCandidate;
}

export interface ReferenciaIndefinidaInfo {
  identificador: string;
  sugerencia?: string;
  mensaje: string;
}

/**
 * Valida que todos los identificadores referenciados en una expresión existan en el scope dado.
 * Devuelve la lista de referencias no definidas (vacía si todas existen).
 */
export function validarReferenciasEnScope(
  expresion: string,
  scopeDisponible: Record<string, number>,
  etiquetaContexto?: string
): ReferenciaIndefinidaInfo[] {
  const deps = extraerDependenciasExpresion(expresion);
  if (deps.length === 0) return [];

  const keys = Object.keys(scopeDisponible);
  const lowerSet = new Set(keys.map((k) => k.toLowerCase()));
  const faltantes: ReferenciaIndefinidaInfo[] = [];

  for (const dep of deps) {
    if (lowerSet.has(dep.toLowerCase())) continue;
    const sugerencia = sugerirIdentificadorCercano(dep, keys);
    const contextoStr = etiquetaContexto ? ` en ${etiquetaContexto}` : '';
    const sugStr = sugerencia ? ` ¿Quisiste decir '${sugerencia}'?` : '';
    faltantes.push({
      identificador: dep,
      sugerencia,
      mensaje: `Variable no definida '${dep}'${contextoStr}.${sugStr}`,
    });
  }

  return faltantes;
}

/**
 * Evalúa las variables de cotización respetando dependencias entre sí, unidades pragmáticas
 * y detectando ciclos o referencias a variables inexistentes. Acepta un `baseScope` opcional
 * (y `baseUnitScope`) para evaluar parámetros locales que heredan variables globales.
 */
export function evaluarVariablesCotizacion(
  variables: VariableCotizacion[],
  baseScope: Record<string, number> = {},
  baseUnitScope: Record<string, UnitScopedValue> = {}
): ResultadoEvaluacionVariables {
  const varMap = new Map<string, VariableCotizacion>();
  const varMapLower = new Map<string, string>();
  const duplicados = new Set<string>();

  for (const v of variables) {
    if (varMap.has(v.id)) {
      duplicados.add(v.id);
    }
    varMap.set(v.id, v);
    varMapLower.set(v.id.toLowerCase(), v.id);
  }

  const scope: Record<string, number> = { ...baseScope };
  const unitScope: Record<string, UnitScopedValue> = {};
  for (const [k, val] of Object.entries(baseScope)) {
    unitScope[k] = baseUnitScope[k] ?? { value: val };
  }
  for (const [k, uVal] of Object.entries(baseUnitScope)) {
    unitScope[k] = uVal;
    if (scope[k] === undefined) scope[k] = uVal.value;
  }

  const baseLowerSet = new Set(Object.keys(scope).map((k) => k.toLowerCase()));
  const todosDisponibles = Array.from(new Set([...Object.keys(scope), ...Array.from(varMap.keys())]));
  const erroresMap = new Map<string, string>();
  const advertenciasMap = new Map<string, string>();
  const unidadesResueltasMap = new Map<string, string | undefined>();
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
      const depCanonical = varMap.has(dep) ? dep : varMapLower.get(dep.toLowerCase());
      if (depCanonical === id) {
        erroresMap.set(id, `Referencia circular detectada: ${id} -> ${id}`);
      } else if (depCanonical && varMap.has(depCanonical)) {
        evaluar(depCanonical, [...stack, id]);
        if (erroresMap.has(depCanonical) && !erroresMap.has(id)) {
          erroresMap.set(id, `Depende de '${depCanonical}', que contiene un error.`);
        }
      } else if (!baseLowerSet.has(dep.toLowerCase())) {
        const sug = sugerirIdentificadorCercano(
          dep,
          todosDisponibles.filter((k) => k.toLowerCase() !== id.toLowerCase())
        );
        const sugStr = sug ? ` ¿Quisiste decir '${sug}'?` : '';
        erroresMap.set(id, `Variable no definida '${dep}' en la expresión de '${id}'.${sugStr}`);
      }
    }

    if (!erroresMap.has(id)) {
      if (expr === '') {
        erroresMap.set(id, `La variable '${id}' no tiene expresión o valor.`);
      } else {
        const res = evaluateUnitExpression(expr, unitScope);
        if (res.isValid && res.value !== null && !Number.isNaN(res.value)) {
          let finalValue = res.value;
          let finalUnit = res.unit;
          let warning = res.warning;

          if (variable.unidad) {
            const targetCanonical = lookupUnitDef(variable.unidad)?.canonical ?? variable.unidad;
            if (res.unit) {
              const conv = convertUnitValue(finalValue, res.unit, variable.unidad);
              if (conv.converted) {
                finalValue = conv.value;
                finalUnit = conv.toUnit ?? targetCanonical;
              } else {
                // Override pragmático de unidad destino (ej: bocas = ceil(sup * 0.3) u)
                finalUnit = targetCanonical;
              }
            } else {
              finalUnit = targetCanonical;
            }
          }

          scope[id] = finalValue;
          unitScope[id] = { value: finalValue, ...(finalUnit ? { unit: finalUnit } : {}) };
          unidadesResueltasMap.set(id, finalUnit);
          if (warning) {
            advertenciasMap.set(id, warning);
          }
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
    const advertencia = advertenciasMap.get(v.id);
    const unidadResuelta = unidadesResueltasMap.has(v.id) ? unidadesResueltasMap.get(v.id) : v.unidad;
    return {
      ...v,
      ...(unidadResuelta ? { unidad: unidadResuelta } : {}),
      dependencias: deps,
      valorEvaluado: error ? undefined : scope[v.id],
      error,
      ...(advertencia ? { advertencia } : {}),
    };
  });

  return {
    variables: resultadoVariables,
    scope,
    unitScope,
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
