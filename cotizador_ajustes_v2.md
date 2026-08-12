# Cotizador IEBA — Ajustes de Especificación (v2)

Este documento complementa `pwaCotizador.md` con definiciones puntuales sobre tres módulos: calibración de mano de obra, gestión de precios de materiales, y servicios tercerizados. Reemplaza/precisa las secciones 3.4, 3.6 y 3.8 del spec original.

---

## 1. Calibración de Mano de Obra (afecta sección 3.8)

Objetivo: corregir las horas estimadas de las Tareas Tipo en base a horas reales cargadas, sin requerir volumen estadístico alto.

### 1.1 Factor de corrección por EMA (Media Móvil Exponencial)

- Cada Tarea Tipo tiene un `factorCorreccion` que arranca en `1.0`.
- Al cargar un registro de horas reales, se recalcula:

```
factorNuevo = factorAnterior * (1 - α) + (horasReales / horasEstimadas) * α
```

- `α` (peso del dato nuevo) configurable, sugerido inicial: `0.3`.
- Las horas mostradas/usadas en cotización = `horasEstimadasBase * factorCorreccion`.
- El factor se persiste por Tarea Tipo y se actualiza incrementalmente — no se recalcula desde cero cada vez (no hace falta guardar todo el historial para este cálculo, solo el factor vigente).

### 1.2 Modificador por Condición de Obra — separado del factor EMA

- No mezclar la condición de obra dentro del mismo factor que corrige la tarea. Va como multiplicador aparte aplicado en el momento de cotizar:
  - `Normal`: x1.0
  - `Dificultosa`: x1.25
  - `Favorable`: x0.9
- Estos valores son **globales y configurables**, no aprendidos por tarea en esta etapa (no hay volumen suficiente para eso).
- Horas finales en cotización = `horasEstimadasBase * factorCorreccion * modificadorCondicion`.

### 1.3 Campo de motivo de desvío

- Al cargar un registro de horas reales, agregar un campo opcional `motivoDesvio` (enum): `Material`, `Diseño/Cliente`, `Clima`, `Error de cálculo`, `Otro`.
- Este campo **no participa del cálculo del factor EMA** — es informativo, para uso manual al revisar la Tarea Tipo. Permite decidir si conviene ajustar la tarea base o si fue un evento puntual no representativo.

### 1.4 Indicador de dispersión

- Además de mostrar `Estimado vs. Real` (ya existe en la vista de Registro), agregar un indicador simple de dispersión entre los registros reales cargados por Tarea Tipo (ej. desvío estándar o rango min/max de la relación real/estimado).
- Uso: señal visual para el usuario, no altera el cálculo automático. Una tarea con alta dispersión sugiere revisar manualmente el % de imprevistos aplicado a esa tarea específica.

---

## 2. Gestión de Precios de Materiales (afecta sección 3.2)

Objetivo: evitar que el catálogo se desactualice silenciosamente, sin requerir relevamiento telefónico constante.

### 2.1 Indicador de vencimiento de precio

- En la vista de Catálogo de Materiales, agregar marca visual (semáforo/badge) por ítem según antigüedad de `Última Act.`:
  - Verde: actualizado dentro del umbral configurado (sugerido: 30 días).
  - Amarillo: entre 30 y 60 días.
  - Rojo: más de 60 días sin actualizar.
- Umbral configurable en Configuración de Empresa.
- Debe ser filtrable/ordenable en la tabla de Materiales (para poder ver rápido "qué está vencido").

### 2.2 Ajuste por índice de referencia (extiende el botón "Aumento %" ya existente)

- Al aplicar un ajuste masivo de precios, en vez de solo pedir un % a mano, permitir asociarlo a un índice de referencia:
  - Dólar Blue / Dólar Oficial (ya hay estructura de cotización de referencia en 3.10, reutilizar).
  - IPC (carga manual del valor vigente si no hay API disponible).
  - Índice propio del usuario ("canasta eléctrica"), como valor numérico simple cargado manualmente.
- Al guardar un ajuste, registrar en el historial de precio versionado: precio nuevo, fecha, y el valor del índice usado como referencia en ese momento (no solo el % aplicado).
- El ajuste sugerido por índice **no se aplica automáticamente** — se muestra como propuesta editable antes de confirmar, dado que los precios reales tienen resistencia a redondeo.
- Este mecanismo es el que reemplaza la necesidad de llamar al proveedor para la mayoría de los ítems. La llamada real queda reservada para ítems marcados como excepción (ver 2.3).

### 2.3 Marca de "ítem de cotización puntual" (excepción)

- Agregar flag opcional en Insumos: `requiereCotizacionDirecta` (booleano).
- Pensado para ítems tipo tableros especiales, grupos electrógenos — cosas que sí ameritan llamar al proveedor cada vez.
- Estos ítems quedan exceptuados del ajuste masivo por índice (no tiene sentido ajustarlos por fórmula si de todos modos se recotizan a mano).

### 2.4 Ítem no catalogado (ad-hoc dentro de un presupuesto)

- Permitir agregar a un presupuesto un ítem con precio manual que **no se guarda en el Catálogo de Materiales** ni genera historial de precio versionado.
- Uso: cosas cotizadas una sola vez que no ameritan quedar en el catálogo reutilizable.
- Debe quedar snapshoteado en el presupuesto igual que cualquier otro ítem (coherente con la inmutabilidad ya definida en el spec original), pero sin tocar la tabla de Insumos.

---

## 3. Servicios Tercerizados (entidad nueva — no existía en el spec original)

Objetivo: modelar subcontrataciones como una categoría de costo propia, distinta de Insumos y Mano de Obra.

### 3.1 Por qué entidad separada

No encaja como Insumo (no es catálogo reutilizable con historial de precio versionado — se recotiza cada vez), ni como Mano de Obra (no es una categoría horaria interna), ni como Costo Indirecto (es directo y específico de la obra puntual, no prorrateo estructural).

### 3.2 Modelo de datos

Nueva entidad `ServicioTercerizado`, asociable a una Cotización (a nivel ítem/partida, igual que Insumos y Mano de Obra):

- `proveedorId`: referencia al Directorio de Proveedores existente (3.7). Agregar tipo/flag al proveedor: `Material` y/o `Servicio` (un proveedor puede ser ambos).
- `descripcion`: texto libre.
- `costo`: generalmente monto global (no cantidad × precio unitario, aunque no bloquear esa opción si aplica).
- `margenPropio`: override opcional del margen general de la cotización — el margen sobre tercerización suele ser distinto (menor) al margen sobre trabajo propio.
- `validezCotizacionTercero`: fecha de validez de la cotización del subcontratista, **independiente** de la validez del presupuesto propio (puede vencer antes).

### 3.3 Impacto en la fórmula de costos (actualiza sección 2 del spec original)

```
Costo Directo = Σ(Insumos) + Σ(Mano de obra interna) + Σ(Servicios Tercerizados)
```

El resto de la cadena (Costos Indirectos → Margen → Impuestos) no cambia, pero el margen aplicado a la porción de Servicios Tercerizados debe poder diferir del margen general (ver `margenPropio` arriba).

### 3.4 Conexión con Hitos Financieros (sección 3.6)

- Cada Servicio Tercerizado debería poder asociarse a una fecha/hito de pago al subcontratista, independiente de los hitos de cobro al cliente.
- Esto es relevante para la evaluación de descuento de cheques: el caso típico de riesgo de cash flow es pagarle al tercero antes de cobrar el hito correspondiente del cliente. El módulo de Hitos Financieros necesita ver este egreso para que la evaluación tenga sentido.

---

## 4. Alcance del Módulo Financiero (precisa sección 3.6)

- No requiere cronograma/Gantt. Modelar hitos como **offsets relativos al inicio de obra**, no como fechas derivadas de una red de tareas con dependencias.
- Datos mínimos necesarios:
  - Duración total estimada del trabajo (un número, en semanas — puede derivarse sumando horas de Tareas Tipo entre capacidad de ejecución, o cargarse a mano).
  - Hitos de cobro como offset desde el inicio (ej. "Adelanto: al firmar", "Certificado: día 15", "Saldo: entrega").
  - Hitos de pago a terceros (ver 3.4 arriba), para la evaluación de descuento de cheques.
- Evaluación de descuento de cheque = comparación entre fecha esperada de cobro y fecha de compromiso de pago, cálculo de tasa efectiva. No requiere más estructura que eso.
