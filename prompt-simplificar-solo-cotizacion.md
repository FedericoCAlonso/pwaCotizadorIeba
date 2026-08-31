# Prompt de corrección — el cotizador es solo cotizador

Revisá y simplificá el modelo de sinergia/optimización de cuadrillas del Cotizador Eléctrico PWA - IEBA (documentos `MODELO_SINERGIA_PROBABILISTICA.md` y `gestionDeOptimizacion.md`). Decisión de producto: **esta app cotiza, no planifica obra**. Hay que eliminar todo el aparato estocástico fino (σ por tarea, descomposición sistemático/idiosincrático, Z_p, régimen horario detallado, ventana fija, búsqueda iterativa de operarios óptimos) — no reubicarlo en un modo separado, sino sacarlo del alcance de la aplicación.

## Diagnóstico

Al cotizar no se conoce con certeza el estado real de la obra — esa incertidumbre de fondo es mucho mayor que cualquier precisión que un modelo estadístico fino pueda aportar. Afinar σ por tarea, correlación obra/día, o el óptimo de cuadrilla vía búsqueda iterativa agrega complejidad y superficie de bugs sin mejorar el número que se le muestra al cliente. La organización de la ejecución en obra (cuadrilla, días, régimen horario) es un problema real, pero es un problema *distinto* al de cotizar, y no es el que esta aplicación resuelve. No corresponde construir un "modo planificación" dentro del cotizador para eso.

## Cambios requeridos

### 1. Reemplazar el cálculo de riesgo por un margen global simple

Eliminar por completo σ_i, Z_p, σ_total y toda su descomposición. Reemplazar por:

```
Costo_cotizado = (Costo_MOD(μ_sinérgico) + Costo_materiales) × (1 + margen_riesgo)
```

Donde `margen_riesgo` es un porcentaje configurable por nivel de confianza elegido por el usuario (ej. Bajo: +10%, Medio: +20%, Alto: +35% — valores de partida, no derivados de una distribución normal). Se aplica sobre el costo directo total (mano de obra + materiales), no solo sobre horas, porque el riesgo de obra real también implica roturas y cambios de cantidad de material, no solo demoras.

`margen_riesgo` debe quedar documentado como un parámetro configurable que se recalibra con datos históricos reales (comparando lo cotizado contra el costo final de obras terminadas), no como una constante fija en el código. No hace falta especificar el mecanismo exacto de recalibración en este documento — alcanza con dejar sentado que es un parámetro vivo.

En "Modo Cotización" (el único modo de la app), el porcentaje de `margen_riesgo` aplicado debe ser visible para el usuario, no oculto en el cálculo interno. Verificar antes de aplicar esta fórmula que `Costo_materiales` no incluya ya algún margen o contingencia propio (ej. en la Oferta o en el precálculo de insumos) — si lo tiene, hay que decidir explícitamente si `margen_riesgo` se aplica solo sobre la diferencia no cubierta o si se elimina el margen de materiales existente para no contar riesgo dos veces.

### 2. Definir cómo se determina la cantidad de operarios para μ_sinérgico

El bono de tándem que compone `μ_sinérgico` depende de cuántos operarios trabajan en la tarea/grupo de tareas. Al eliminar la búsqueda iterativa de operarios óptimos, esto no puede quedar sin definición. Reemplazarlo por: el usuario ingresa manualmente la cantidad de operarios al armar la cotización (por presupuesto o por grupo de tareas, lo que sea más simple de integrar al flujo actual), con un valor por defecto configurable (ej. 2). No hay optimización automática de `n` — es un dato de entrada, no una salida del cálculo.

### 3. Conservar solo lo determinístico de la sinergia

Mantener sin cambios el cálculo de `μ_sinérgico` (consolidación de setup + bono de trabajo en tándem cuando se combinan tareas), porque representa un ahorro real de tiempo y no depende de ningún supuesto estadístico. Esta es la única parte del modelo de "sinergia de tareas" que sobrevive.

### 4. Eliminar del alcance de la app

- Todo el contenido de regímenes horarios (diurno/extra/finde/nocturno), ventana fija / parada de planta, y cálculo de cuadrilla óptima vía búsqueda iterativa: sacarlo del documento y del código, no dejarlo detrás de un flag ni documentado como "fase futura". No es un problema que este cotizador vaya a resolver.
- Dejar registrada explícitamente la limitación resultante: la app no diferencia tarifa de mano de obra por régimen horario (nocturno, fin de semana, feriado) — se asume siempre jornada estándar diurna en el cálculo de costo de mano de obra. Si en el futuro hace falta cotizar trabajo fuera de horario, alcanza con un multiplicador de tarifa simple y configurable; no requiere reintroducir el modelo de régimen horario completo.
- Los tipos TypeScript asociados exclusivamente a esto (`RegimenHorarioObra`, `ConfiguracionRegimenHorario`, campos de ventana fija en `PlanificacionCuadrilla`, etc.) se eliminan o se simplifican para reflejar solo lo que sobrevive (μ_sinérgico + margen_riesgo global).
- No agregar ningún flag de modo (`modoCalculo` o similar) — no hay dos modos, hay uno solo.

## Qué entregar

Los documentos reescritos (o consolidados en uno solo, si es más prolijo) reflejando el modelo simplificado: μ_sinérgico determinístico (con n de operarios como dato de entrada manual) + margen de riesgo global configurable y visible, sin ningún rastro del modelo estocástico fino ni de régimen horario/ventana fija/optimización de cuadrilla. Incluir los tipos TypeScript resultantes y qué se elimina del código existente si ya había algo implementado en esa dirección.

Incluir también un breve listado de qué secciones/conceptos se eliminaron de los documentos originales (ej. "sección 3.2 Regímenes Horarios", "sección 3.3 Ventana Fija", tipos `RegimenHorarioObra` y `ConfiguracionRegimenHorario"), para poder chequear que no queden referencias rotas en otros documentos o módulos del proyecto que los mencionen.
