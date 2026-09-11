import React, { useState, useMemo, useEffect } from 'react';
import {
  TareaTipo,
  Insumo,
  CategoriaManoDeObra,
  TipoFactura,
  ParametroTrabajoTipo
} from '../../core/types';
import {
  calcularConsumosTareaTipo,
  ConsumosCalculadosResultado,
  DEFAULT_CLAUSULA_OBRA_EXISTENTE,
  safeNum
} from '../../core/calculations';
import { evaluateCondition } from '../../core/mathEvaluator';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { GestureParametricSheet } from './GestureParametricSheet';
import { ClassicParametricModal } from './ClassicParametricModal';

interface ParametricJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  tarea: TareaTipo;
  initialParametros?: Record<string, number>;
  initialVariables?: Record<string, number>;
  initialClausula?: string;
  initialIncluirClausula?: boolean;
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  tipoFactura?: TipoFactura;
  onConfirm: (resultado: {
    parametros: Record<string, number>;
    variables: Record<string, number>;
    calculos: ConsumosCalculadosResultado;
    clausulaExclusiones?: string;
    incluirClausula: boolean;
  }) => void;
}

export const ParametricJobModal: React.FC<ParametricJobModalProps> = ({
  isOpen,
  onClose,
  tarea,
  initialParametros,
  initialVariables,
  initialClausula,
  initialIncluirClausula,
  insumosMap,
  manoObraMap,
  tipoFactura = 'Factura A',
  onConfirm
}) => {
  useEscapeKey(isOpen, onClose);

  // Modo de visualización: en móviles inicia con el modo gestual ('gesture'), en escritorio con 'classic'
  const [viewMode, setViewMode] = useState<'classic' | 'gesture'>('classic');

  // Estado local para los valores de parámetros ingresados
  const [parametrosValues, setParametrosValues] = useState<Record<string, number>>({});
  const [clausulaTexto, setClausulaTexto] = useState<string>('');
  const [incluirClausula, setIncluirClausula] = useState<boolean>(true);

  // Inicializar valores al abrir el modal y detectar tamaño de pantalla
  useEffect(() => {
    if (isOpen) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      setViewMode(isMobile ? 'gesture' : 'classic');

      const defaults: Record<string, number> = {};
      if (tarea.parametros && tarea.parametros.length > 0) {
        tarea.parametros.forEach(p => {
          defaults[p.id] = initialParametros?.[p.id] ?? initialVariables?.[p.id] ?? p.valorDefault ?? 1;
        });
      } else {
        defaults['cantidad'] = initialParametros?.['cantidad'] ?? initialVariables?.['cantidad'] ?? 1;
      }
      setParametrosValues(defaults);
      setIncluirClausula(initialIncluirClausula ?? true);
      setClausulaTexto(initialClausula || tarea.clausulaExclusiones || tarea.clausulaTecnicaDefault || DEFAULT_CLAUSULA_OBRA_EXISTENTE);
    }
  }, [isOpen, tarea, initialParametros, initialVariables, initialClausula, initialIncluirClausula]);

  // Actualizar valores de parámetro
  const handleParametroChange = (paramId: string, value: any) => {
    setParametrosValues(prev => ({
      ...prev,
      [paramId]: value
    }));
  };

  // Agrupar parámetros para renderizado jerárquico Material 3
  const groupedParametros = useMemo(() => {
    if (!tarea.parametros || tarea.parametros.length === 0) return [];

    const currentScope: Record<string, number> = {};
    const evalMap = new Map<string, { isVisible: boolean; isConditional: boolean }>();

    tarea.parametros.forEach((p) => {
      let isVisible = true;
      const isConditional = Boolean(p.condicion && p.condicion.trim());

      if (isConditional) {
        isVisible = evaluateCondition(p.condicion, currentScope);
      }

      const rawVal = parametrosValues[p.id] !== undefined
        ? safeNum(parametrosValues[p.id])
        : (p.valorDefault ?? 1);

      const effectiveVal = isVisible ? rawVal : 0;
      currentScope[p.id] = effectiveVal;
      evalMap.set(p.id, { isVisible, isConditional });
    });

    type ParamGroup = {
      root: ParametroTrabajoTipo;
      rootMeta: { isVisible: boolean; isConditional: boolean };
      children: Array<{ parametro: ParametroTrabajoTipo; meta: { isVisible: boolean; isConditional: boolean } }>;
    };

    const groups: ParamGroup[] = [];
    let currentGroup: ParamGroup | null = null;

    tarea.parametros.forEach((p) => {
      const meta = evalMap.get(p.id)!;
      if (!meta.isConditional) {
        currentGroup = {
          root: p,
          rootMeta: meta,
          children: []
        };
        groups.push(currentGroup);
      } else {
        if (currentGroup) {
          currentGroup.children.push({ parametro: p, meta });
        } else {
          currentGroup = {
            root: p,
            rootMeta: meta,
            children: []
          };
          groups.push(currentGroup);
        }
      }
    });

    return groups;
  }, [tarea.parametros, parametrosValues]);

  // Live evaluation de parámetros, variables calculadas y consumos
  const calculosResultado: ConsumosCalculadosResultado = useMemo(() => {
    return calcularConsumosTareaTipo(
      tarea,
      parametrosValues,
      insumosMap,
      manoObraMap,
      { tipoFactura }
    );
  }, [tarea, parametrosValues, insumosMap, manoObraMap, tipoFactura]);

  // Aplicar cambios confirmados y cerrar modal
  const handleConfirm = () => {
    const sanitizedParams: Record<string, number> = {};
    const evalScope: Record<string, number> = {};

    if (tarea.parametros && tarea.parametros.length > 0) {
      tarea.parametros.forEach((p) => {
        let isVisible = true;
        if (p.condicion && p.condicion.trim()) {
          isVisible = evaluateCondition(p.condicion, evalScope);
        }
        const rawVal = parametrosValues[p.id] !== undefined
          ? safeNum(parametrosValues[p.id])
          : (p.valorDefault ?? 1);
        const val = isVisible ? rawVal : 0;
        sanitizedParams[p.id] = val;
        evalScope[p.id] = val;
      });
    } else {
      sanitizedParams['cantidad'] = safeNum(parametrosValues['cantidad']) || 1;
    }

    onConfirm({
      parametros: sanitizedParams,
      variables: calculosResultado.valoresVariables,
      calculos: calculosResultado,
      clausulaExclusiones: incluirClausula ? clausulaTexto : undefined,
      incluirClausula
    });
    onClose();
  };

  if (!isOpen) return null;

  if (viewMode === 'gesture') {
    return (
      <GestureParametricSheet
        tarea={tarea}
        parametrosValues={parametrosValues}
        onParametroChange={handleParametroChange}
        calculosResultado={calculosResultado}
        onConfirm={handleConfirm}
        onClose={onClose}
        onSwitchToClassic={() => setViewMode('classic')}
      />
    );
  }

  return (
    <ClassicParametricModal
      tarea={tarea}
      parametrosValues={parametrosValues}
      onParametroChange={handleParametroChange}
      groupedParametros={groupedParametros}
      calculosResultado={calculosResultado}
      clausulaTexto={clausulaTexto}
      setClausulaTexto={setClausulaTexto}
      incluirClausula={incluirClausula}
      setIncluirClausula={setIncluirClausula}
      onConfirm={handleConfirm}
      onClose={onClose}
      onSwitchToGesture={() => setViewMode('gesture')}
    />
  );
};
