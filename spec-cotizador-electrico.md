# Especificación — Cotizador Eléctrico (app standalone, IEBA)

## 0. Objetivo

Aplicación **completamente independiente** (no forma parte de una suite acoplada) para generar cotizaciones de trabajos eléctricos de forma rápida, con:

- **Gestión de costos correcta** (el problema central): separar insumos, mano de obra, costos indirectos y utilidad, con precios que no se pudran con la inflación.
- **Reutilización de datos**: catálogo de insumos, tareas tipo, clientes y presupuestos anteriores como base para nuevos — todo autocontenido dentro de esta misma app.
- Salida profesional (PDF).

La app tiene su propia base de datos y sus propios modelos de `Cliente`/`Proyecto` (más livianos que los que puedas tener en otras herramientas eléctricas que desarrolles por separado, como un compositor de esquemas o un modelador de tableros). No depende de esas otras apps para funcionar. Si en algún momento querés un punto de encuentro entre herramientas, la idea es resolverlo después con un **integrador liviano** ("dummy" — ver sección 4.3), no acoplando esta app a las demás desde el diseño.

Este documento está pensado para pasarlo directamente a los agentes de Google Antigravity como especificación base. Incluye modelo de dominio, decisiones de arquitectura y un roadmap de MVP.

---

## 1. El núcleo del problema: modelo de costos

La cotización de un electricista NO es "precio de lista + margen". Es una composición de capas, y cada capa tiene su propia lógica de actualización:

```
Costo de una Partida = Σ(Insumos × cantidad) + Σ(Mano de obra × horas) + Costos indirectos asignados
Precio de venta = Costo × (1 + margen) + impuestos aplicables
```

### 1.1 Insumo (Material)

```python
class Insumo(BaseModel):
    id: str
    nombre: str                    # "Cable unipolar 2.5mm2 IRAM 247-3"
    unidad: str                    # "m", "u", "kg"
    categoria: str                 # "cableado", "protecciones", "canalizacion", ...
    proveedor_preferido: str | None
    precio_actual: Decimal
    fecha_actualizacion: datetime
    historial_precios: list[PrecioHistorico]  # ver 1.4
    codigo_proveedor: str | None   # para reconciliar con listas de proveedores
```

**Por qué separado de la Partida**: el mismo cable aparece en decenas de partidas distintas. Actualizás el precio del insumo una vez, y se propaga (a los presupuestos *futuros*, nunca a los ya emitidos — ver snapshot en 1.5).

### 1.2 Mano de obra

No es una tarifa única. Necesitás al menos:

```python
class CategoriaManoDeObra(BaseModel):
    id: str
    nombre: str            # "Oficial electricista", "Ayudante", "Técnico DCI"
    costo_hora: Decimal    # tu costo real (no lo que cobrás)
    fecha_actualizacion: datetime
```

Separar **costo** de **precio de venta** es clave: el costo hora te sirve para saber si un trabajo es rentable; el precio hora que cobrás incluye tu margen y tu escasez (sos vos, solo, con capacidad limitada).

### 1.3 Costos indirectos / estructura

Esto es lo que más se suele olvidar y es lo que te está complicando la vida seguramente:

```python
class CostoIndirecto(BaseModel):
    id: str
    nombre: str             # "Combustible/viáticos", "Amortización herramientas",
                             # "Seguro/ART", "Monotributo", "Software (ieBA Suite, etc)"
    tipo: Literal["fijo_mensual", "porcentual_sobre_costo", "por_visita"]
    valor: Decimal
```

Estos se prorratean sobre las partidas (ej: "+8% en concepto de gastos generales" o un monto fijo por visita/traslado). Sin esto, **el margen que creés tener no es el margen real**.

### 1.4 Precio versionado (crítico en Argentina)

Los precios de insumos no son un número, son una serie temporal. Necesitás:

```python
class PrecioHistorico(BaseModel):
    fecha: datetime
    precio: Decimal
    fuente: str    # "lista proveedor X", "actualización manual", "índice CAC"
```

Esto te permite:
- Saber cuánto valía algo cuando cotizaste (auditoría, reclamos de clientes).
- Ver la velocidad de aumento por categoría (cableado sube distinto que protecciones).
- Eventualmente automatizar alertas: "este insumo no se actualiza hace 45 días, revisar".

**Estrategia de actualización recomendada para el MVP**: carga manual rápida (import de lista de precios de proveedor vía CSV/Excel, algo simple, no OCR todavía) + posibilidad de indexar un insumo a un índice de referencia (dólar oficial/blue, o % manual mensual) para insumos que no actualizás seguido pero necesitás que no queden obsoletos.

### 1.5 Snapshot inmutable al cotizar

**Regla de oro**: un presupuesto emitido nunca cambia sus precios aunque el insumo se actualice después. Cuando el usuario "cierra" una cotización, se copian (no se referencian) los precios usados:

```python
class ItemPresupuesto(BaseModel):
    partida_id: str
    descripcion: str
    cantidad: Decimal
    insumos_snapshot: list[InsumoSnapshot]   # precio congelado al momento de cotizar
    mano_obra_snapshot: list[ManoObraSnapshot]
    costo_total: Decimal
    precio_venta: Decimal
```

Esto evita el clásico problema de "¿por qué el presupuesto viejo ahora muestra otro precio?".

### 1.6 Partida y "tarea tipo" (la clave de la reutilización)

Acá está el mayor ahorro de tiempo. En lugar de armar cada ítem desde cero, definís **ensambles reutilizables**:

```python
class TareaTipo(BaseModel):
    id: str
    nombre: str   # "Punto de luz completo", "Boca de tomacorriente 20A",
                   # "Circuito TUG completo (10 bocas)", "Tablero seccional 12 módulos"
    insumos: list[tuple[insumo_id: str, cantidad_por_unidad: Decimal]]
    mano_obra: list[tuple[categoria_id: str, horas_por_unidad: Decimal]]
    unidad: str    # "u", "m", "punto"
    notas_tecnicas: str | None   # referencia a AEA 90364 si aplica
```

Cotizar un tablero nuevo se convierte en: elegís "Tablero seccional 12 módulos" × cantidad, "Punto de luz" × 8, "Boca TUG" × 10, etc. El sistema calcula insumos + mano de obra automáticamente, vos ajustás cantidades específicas si hace falta.

Con el tiempo, este catálogo de tareas tipo se vuelve tu activo más valioso — es tu know-how de cuánto cable, cuántas horas, qué protecciones lleva cada cosa, capturado una sola vez.

---

## 2. Reutilización de datos (más allá de costos)

- **Cliente / Proyecto**: reusar tal cual tu modelo existente de ieBA Suite. Un presupuesto se asocia a un `Cliente` y opcionalmente a un `Proyecto`.
- **Presupuesto como plantilla**: "duplicar presupuesto anterior" para un cliente recurrente o un trabajo similar, ajustando cantidades.
- **Catálogo de insumos y tareas tipo**: compartido entre todos los presupuestos, no se duplica.
- **Integración con Tablero/Circuito**: si ya modelaste el tablero de un proyecto con tu domain model, el cotizador podría generar automáticamente el borrador de ítems a partir de los `Circuito` definidos (esto es una fase 2, no MVP — ver roadmap).

---

## 3. Modelo de Presupuesto (documento final)

```python
class Presupuesto(BaseModel):
    id: str
    numero: str                 # correlativo, ej "IEBA-2026-0034"
    cliente_id: str
    proyecto_id: str | None
    fecha_emision: datetime
    validez_dias: int           # típico 15-30 días dado el contexto inflacionario
    items: list[ItemPresupuesto]
    costos_indirectos_aplicados: list[CostoIndirectoSnapshot]
    subtotal_costo: Decimal
    margen_promedio: Decimal
    impuestos: ImpuestosAplicados   # monotributo no discrimina IVA; consider si sos RI
    total: Decimal
    condiciones_pago: str
    estado: Literal["borrador", "enviado", "aprobado", "rechazado", "vencido"]
    pdf_generado_url: str | None
```

Un dato importante para tu contexto (moneda inestable): considerá mostrar el total también en una referencia estable (ej. equivalente USD informativo) y dejar explícito en el PDF la validez de X días — esto es standard en el rubro en Argentina y evita fricción con el cliente.

---

## 4. Arquitectura técnica sugerida

Coherente con el resto de ieBA Suite:

- **Stack**: React + TypeScript + Vite + Firebase Auth + Firestore, PWA con service worker.
- **Offline-first**: importante porque vas a cotizar en el momento, en la obra, sin señal confiable. Usar Firestore con persistencia offline habilitada (`enableIndexedDbPersistence`) para que el catálogo de insumos/tareas tipo esté disponible sin conexión, y la sincronización sea automática al recuperar señal.
- **Colecciones Firestore sugeridas**:
  - `insumos` (con subcolección o campo embebido `historial_precios`)
  - `categoriasManoDeObra`
  - `costosIndirectos`
  - `tareasTipo`
  - `presupuestos` (con `items` embebidos si no son excesivamente largos; Firestore soporta bien documentos con arrays moderados)
  - `clientes` / `proyectos` (reusar colecciones existentes de ieBA Suite si ya existen)
- **Validación de dominio**: igual que el resto de la suite, definir estos modelos en Pydantic v2 del lado de referencia/diseño, y traducir a Zod en el frontend TypeScript para validación consistente.
- **Generación de PDF**: librería cliente (ej. `@react-pdf/renderer` o `pdf-lib`) para no depender de backend; mantiene el espíritu "herramienta standalone" del resto de la suite.
- **Formato compartido**: si el cotizador necesita interoperar con otras tools de la suite (ej. tomar un `Proyecto` con `Tablero`/`Circuito` ya cargado), seguí el mismo "shared format" desacoplado que definiste para el resto de las herramientas — el cotizador lee esos datos, no los posee.

---

## 5. Roadmap sugerido

**MVP (uso real en semanas, no meses):**
1. CRUD de Insumos (con carga manual + import CSV).
2. CRUD de Categorías de mano de obra y Costos indirectos.
3. CRUD de Tareas tipo (ensambles).
4. Armado de Presupuesto: seleccionar/crear ítems, cantidades, cálculo automático de costo → margen → precio.
5. Snapshot inmutable al emitir.
6. Export a PDF con tu identidad de marca (IEBA).
7. Asociación a Cliente existente.
8. Pantalla simple de carga de `RegistroTrabajo` (horas reales por tarea) — ver sección 6.5.

**Fase 2:**
- Duplicar presupuesto como plantilla.
- Indexación automática de insumos a un índice de referencia.
- Reporte de desviación de horas estimadas vs. reales por Tarea Tipo (sección 6.2).
- Reporte de variación de precios por categoría de insumo (sección 6.3).
- Integración con `Tablero`/`Circuito` para generar ítems automáticamente desde el modelo eléctrico ya cargado.
- Estados de seguimiento (enviado/aprobado/vencido) con recordatorios.

**Fase 3 (medio-largo plazo, como ya definiste para ieBA Suite en general):**
- Análisis de cotizaciones: conversión, margen cotizado vs. margen real, segmentación por tipo de trabajo (sección 6.4).
- Multi-usuario si escalás a más electricistas trabajando bajo IEBA.
- Reportes de márgenes por categoría de trabajo.

---

## 6. Estadística y aprendizaje continuo (retroalimentación de costos)

Esta es la pieza que convierte al cotizador de "calculadora" en "sistema que aprende de tu propio trabajo". Se apoya en tres ejes: tiempos reales, variación de precios, y comportamiento de las cotizaciones.

### 6.1 Registro de trabajo real (la fuente de todo)

Sin este dato no hay estadística posible. La idea es que sea **liviano de cargar** (si pedís demasiado detalle, no lo vas a completar nunca):

```python
class RegistroTrabajo(BaseModel):
    id: str
    presupuesto_id: str | None       # si el trabajo viene de un presupuesto cotizado
    proyecto_id: str | None
    tarea_tipo_id: str | None        # referencia a la Tarea Tipo del catálogo, si aplica
    descripcion: str
    fecha: date
    horas_reales: Decimal
    categoria_mano_obra_id: str
    cantidad_ejecutada: Decimal      # ej: "8" si eran 8 bocas realmente instaladas
    insumos_reales: list[tuple[str, Decimal]] | None   # opcional — carga más laboriosa,
                                                          # solo si querés afinar también el costo de material
    condicion: Literal["normal", "dificultosa", "favorable"] | None  # obra vieja, embutido, altura, etc.
    notas: str | None
```

En la práctica: al cerrar una tarea (o al final del día), cargás "hice 8 bocas TUG, 3.5 horas, condición normal". Con eso ya alcanza para la primera capa de análisis.

### 6.2 Análisis de horas reales vs. estimadas (calibración de mano de obra)

```python
class AnalisisDesviacionTarea(BaseModel):
    tarea_tipo_id: str
    horas_estimadas_unidad: Decimal   # lo que dice hoy la Tarea Tipo
    horas_reales_promedio: Decimal    # promedio de RegistroTrabajo asociados
    desviacion_estandar: Decimal
    n_muestras: int
    desviacion_pct: Decimal           # (real - estimado) / estimado
    sugerencia: Literal["mantener", "revisar", "actualizar"] | None
```

Regla práctica para la "sugerencia": no recalibrar con 1-2 datos sueltos (una obra difícil te arruina el promedio). Un umbral razonable: **n ≥ 5 muestras** y desviación sostenida (no un outlier) antes de sugerir actualizar la Tarea Tipo — y siempre como sugerencia, nunca como sobreescritura automática. Vos decidís si la desviación es real o fue una obra particular.

Reporte útil: tabla ordenada por `desviacion_pct` descendente — te muestra primero las tareas donde más te estás equivocando al cotizar, que es donde más plata estás dejando (o perdiendo).

### 6.3 Análisis de variación de precios de insumos

Ya tenés el `historial_precios` por insumo (sección 1.4); acá se trata de explotarlo:

```python
class AnalisisVariacionPrecio(BaseModel):
    insumo_id: str
    categoria: str
    variacion_pct_30d: Decimal
    variacion_pct_90d: Decimal
    variacion_pct_interanual: Decimal
    tasa_promedio_mensual: Decimal
    dias_desde_ultima_actualizacion: int   # para detectar precios "dormidos"
```

Reportes útiles:
- **Ranking por categoría** ("cableado" vs "protecciones" vs "canalización") — te dice qué rubros hay que revisar con más frecuencia porque suben más rápido, y cuáles podés dejar tranquilos.
- **Alertas de precio dormido**: insumos que no se actualizan hace más de X días, para no cotizar con precios viejos sin darte cuenta.
- Esto también te sirve para decidir, insumo por insumo, si conviene indexarlo a un índice de referencia (dólar, CAC) en vez de actualizarlo a mano — los que más varían son los mejores candidatos.

### 6.4 Análisis de cotizaciones (conversión y margen real)

```python
class AnalisisCotizaciones(BaseModel):
    periodo: str                      # "2026-Q3"
    total_emitidas: int
    total_aprobadas: int
    tasa_conversion_pct: Decimal
    margen_promedio_cotizado: Decimal
    margen_promedio_real: Decimal     # requiere RegistroTrabajo + insumos_reales cargados
    monto_promedio_aprobado: Decimal
    segmentacion: dict[str, "AnalisisCotizaciones"] | None  # por tipo de trabajo, por cliente, etc.
```

Esto responde tres preguntas que hoy probablemente contestás "a ojo":
- ¿Qué % de lo que cotizás se aprueba? (si es muy alto, probablemente estás cobrando barato)
- ¿El margen que cobrás en el papel es el margen que realmente te queda? (la brecha entre "margen cotizado" y "margen real" es, en la práctica, el indicador más importante de todo el sistema)
- ¿Qué tipo de trabajo te conviene más perseguir? (segmentando por tipo de tarea o rango de monto)

### 6.5 Alcance recomendado

Esto es naturalmente **Fase 2/3**, pero conviene diseñar `RegistroTrabajo` desde el MVP aunque el análisis no esté — es mucho más fácil empezar a acumular datos desde el día uno que tener que migrar retroactivamente. Sugerencia concreta:

- **MVP**: agregar una pantalla simple de carga de `RegistroTrabajo` (sin insumos reales, solo horas), aunque los reportes estadísticos todavía no existan. Es el "costo cero" de empezar a juntar la materia prima de todo este capítulo.
- **Fase 2**: reportes de desviación de horas (6.2) y variación de precios (6.3), que son cálculos directos sobre datos ya existentes.
- **Fase 3**: análisis de cotizaciones con margen real (6.4), que requiere que la carga de `insumos_reales` esté más consolidada como hábito.

---

## 7. Análisis financiero: financiar la obra y evaluar medios de pago

Esto ataca un problema distinto al de costeo: no es "cuánto cuesta", sino **"quién pone la plata mientras tanto"**. Vos adelantás materiales y horas; el cliente te paga con un desfasaje (adelanto + certificados + saldo, o encima con cheques a plazo). Ese desfasaje, en un contexto de inflación alta, no es gratis — y hoy seguramente lo estás calculando a ojo.

Hay dos preguntas separadas que conviene no mezclar:

1. **¿Cuánto tengo que financiar yo, y por cuánto tiempo?** (flujo de caja de la obra)
2. **Si el cliente me paga con cheque o me pide cuotas, ¿qué condición me conviene y cuánto tendría que recargar?** (evaluación de medios de pago)

### 7.1 Esquema de cobro (formaliza lo que hoy es un string libre)

En la sección 3 el `Presupuesto` tenía `condiciones_pago: str`. Para obras más grandes conviene modelarlo:

```python
class HitoPago(BaseModel):
    id: str
    descripcion: str                 # "Adelanto", "Certificado N°1 - 30% avance", "Saldo final"
    condicion_liberacion: str        # "contra firma", "avance de obra certificado", "recepción final"
    porcentaje: Decimal              # % del total del presupuesto
    fecha_estimada: date | None
    medio_pago_esperado: Literal["efectivo", "transferencia", "cheque", "otro"]
    plazo_cheque_dias: int | None    # si medio_pago_esperado == "cheque"

class EsquemaPago(BaseModel):
    presupuesto_id: str
    modalidad: Literal["pago_unico", "adelanto_saldo", "certificados_avance", "cuotas"]
    fondo_reparo_pct: Decimal | None  # retención de garantía hasta recepción final (típico 5-10%)
    hitos: list[HitoPago]
```

Incluí `fondo_reparo_pct` porque en obras de cierto tamaño es standard retener un % hasta la recepción final — si lo omitís del modelo, después te va a faltar plata que "en el papel" ya habías cobrado.

### 7.2 Flujo de caja de la obra (¿cuánto necesito financiar?)

Cruza lo que **pagás vos** (compra de materiales, mano de obra, según cuándo efectivamente ejecutás cada `ItemPresupuesto`) contra lo que **cobrás** (`HitoPago`), fecha por fecha:

```python
class PuntoFlujoCaja(BaseModel):
    fecha: date
    egreso: Decimal          # lo que pagás ese día/semana (insumos, mano de obra)
    ingreso: Decimal         # lo que cobrás ese día/semana
    saldo_acumulado: Decimal # negativo = estás financiando la obra de tu bolsillo

class AnalisisFlujoCaja(BaseModel):
    presupuesto_id: str
    puntos: list[PuntoFlujoCaja]
    necesidad_maxima_financiamiento: Decimal   # el peor punto del saldo acumulado
    dias_exposicion: int                        # cuántos días estás "abajo cero"
```

Con esto el sistema puede avisarte, al armar el presupuesto: *"con este esquema de cobro vas a estar financiando hasta $X durante Y días"* — antes de firmar, no después de descubrirlo en la obra.

**Dato clave que hay que pedirte para esto**: una estimación de cuándo pensás ejecutar cada partida (o al menos, en qué semana del proyecto), porque el desembolso de materiales/mano de obra no es todo el día 1 — se distribuye a lo largo de la obra. Si no querés cargar ese detalle, una alternativa simple para el MVP es asumir una distribución pareja del costo a lo largo de la duración estimada de la obra.

### 7.3 Evaluación de cheques (¿descontar ahora o esperar?)

Cuando el cliente paga con cheque diferido, la decisión real es: ¿lo descontás en el banco/factoring ya (menos plata, pero líquida ya) o esperás el vencimiento a valor nominal (toda la plata, pero con el riesgo de que la inflación te la coma, y el riesgo de que no se pague)?

```python
class EvaluacionCheque(BaseModel):
    monto_nominal: Decimal
    dias_plazo: int
    tasa_descuento_bancaria_anual: Decimal | None   # tasa de descuento/factoring disponible
    inflacion_esperada_periodo: Decimal | None       # tu estimación (o índice de referencia)
    valor_presente_si_descuenta: Decimal             # nominal descontado a la tasa bancaria
    valor_real_esperado_si_espera: Decimal           # nominal ajustado por inflación esperada
    diferencia: Decimal                               # cuál conviene y por cuánto
```

**Datos que el sistema te tiene que pedir para esto** (por cheque, o por defecto configurable):
- Monto y plazo del cheque.
- Tasa de descuento que te ofrece tu banco o una casa de descuento de cheques (varía, así que mejor pedirla que asumirla).
- Tu estimación de inflación esperada para el período (podés poner un valor por defecto basado en el último dato de inflación mensual conocido, pero editable — esto cambia todo el tiempo).
- Si el cheque es de un banco/librador confiable o no (un flag simple de riesgo de incobrabilidad, no hace falta modelar esto con precisión actuarial).

### 7.4 Si el cliente pide financiamiento en cuotas (¿cuánto recargar?)

Acá el sistema no decide por vos, pero te da un número de referencia para no regalar plata sin darte cuenta:

```python
class PropuestaFinanciamientoCliente(BaseModel):
    monto_a_financiar: Decimal
    plazo_dias: int
    inflacion_esperada_periodo: Decimal
    costo_oportunidad_anual: Decimal   # qué rendiría esa plata en algo simple (plazo fijo, etc.)
    prima_riesgo_pct: Decimal          # tu criterio: cliente nuevo vs conocido, monto, historial
    recargo_sugerido_pct: Decimal      # inflación + costo oportunidad + prima de riesgo, prorrateado al plazo
    monto_total_financiado: Decimal
```

La lógica del MVP puede ser simple y aditiva (`recargo ≈ inflación_esperada + costo_oportunidad + prima_riesgo`, prorrateada al plazo) — no hace falta un modelo financiero sofisticado para que ya sea muchísimo mejor que "le pongo un 10% porque sí". Lo importante es que el sistema te obligue a poner un número en cada componente en vez de saltear el análisis.

### 7.5 Alcance recomendado

- **MVP**: `EsquemaPago` con hitos (7.1) — esto ya mejora la claridad de lo que hoy es texto libre, y es la base de todo lo demás.
- **Fase 2**: flujo de caja de la obra (7.2) y evaluación de cheques (7.3) — son cálculos directos una vez que tenés el esquema de pago y el costeo.
- **Fase 3**: propuesta de financiamiento al cliente (7.4), que conviene madurar después de tener un poco de historial real de cuánto varían tus insumos e inflación (se alimenta de los datos de la sección 6.3).

*Aclaración: este módulo te da los números para decidir, no reemplaza tu criterio ni es asesoramiento financiero formal — las tasas de descuento y la inflación esperada las tenés que cargar vos (o actualizar un valor de referencia periódicamente).*

---

## 8. Nota para prompting de los agentes en Antigravity

Cuando le pases tareas a los agentes, conviene:
- Darles este documento completo como contexto, no fragmentado.
- Pedirles que implementen primero los modelos de dominio (Pydantic/Zod) y los valgan con tests antes de tocar UI — es donde más plata se pierde si hay errores de cálculo.
- Ser explícito en que el snapshot de precios es inmutable — es la parte más fácil de "optimizar mal" por un agente que no entienda el motivo de negocio.
- Pedir que la lógica de cálculo de costos viva en funciones puras testeables, separadas de los componentes React — para que vos (arquitecto/dominio) puedas auditar el cálculo sin leer JSX.
