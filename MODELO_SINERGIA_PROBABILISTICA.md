# Modelo de Sinergia Probabilística y Planificación de Cuadrilla

> **Cotizador Eléctrico PWA - IEBA**  
> Documento técnico y metodológico sobre la composición estocástica de mano de obra y optimización de cuadrillas bajo normativa AEA 90364 y metodología APU.

---

## 1. Introducción y Justificación Técnica

En la presupuestación tradicional de instalaciones eléctricas, el cálculo de mano de obra suele realizarse mediante una **suma determinista lineal**:

$$H_{\text{total\_lineal}} = \sum_{i=1}^n H_i$$

Donde cada ítem $H_i$ asume que la tarea se ejecuta en forma aislada e independiente. Sin embargo, en la ejecución real de una obra electromecánica, esta hipótesis produce **distorsiones de costo**:
1. **Sobredimensión de tiempos de preparación (Setup):** Cada tarea individual incluye tiempos de alistamiento de herramientas, replanteo, preparación de puesto y limpieza final. Al realizar varias tareas en una misma jornada, estos tiempos no se multiplican por $n$, sino que se consolidan.
2. **Efecto Tándem (Oficial + Ayudante):** Tareas simultáneas complementarias (como pasar cintas pasacables y enhebrar conductores con lubricante, o canaletear y montar cañería) aumentan la productividad conjunta respecto a la suma de trabajos individuales.
3. **Dispersión Estocástica e Incertidumbre:** Las horas reales no son un número fijo, sino una **variable aleatoria** sujeta a la antigüedad del inmueble, el estado de las cañerías existentes y la accesibilidad.

Para resolver esto con rigor de ingeniería de costos, el sistema implementa una **Composición Probabilística Estocástica (PERT / Teorema Central del Límite)**.

---

## 2. Fundamento Matemático del Modelo

### 2.1. Modelado de Tareas como Variables Aleatorias

Cada partida o tarea $i$ se modela como una variable aleatoria con distribución normal:

$$H_i \sim \mathcal{N}(\mu_i, \sigma_i^2)$$

- **$\mu_i$ (Media nominal esperada):** Horas teóricas calculadas por catálogo o tarea tipo.
- **$\sigma_i$ (Desvío estándar / Incertidumbre):** Refleja la variabilidad inherente según las condiciones ambientales de la obra:

$$\sigma_i = \mu_i \times \text{CV}_{\text{base}} \times F_{\text{complejidad}}$$

Donde:
- $\text{CV}_{\text{base}} = 0.12$ ($12\%$ de coeficiente de variación base para tareas eléctricas estándar).
- $F_{\text{complejidad}}$ modula la incertidumbre a partir de los factores reales configurados:
  - **Estado de canalización:** Nuevo ($+0\%$), Regular ($+25\%$), Muy deteriorado / Obstruido ($+50\%$).
  - **Accesibilidad:** Buena / Abierta ($+0\%$), Espacio reducido / Entrepiso ($+20\%$).
  - **Altura de trabajo:** $<2.5\text{ m}$ ($+0\%$), $2.5\text{ a }4\text{ m}$ ($+20\%$), $>4\text{ m}$ ($+40\%$).

---

### 2.2. Suma Estocástica y Ley de los Grandes Números

Al combinar $n$ tareas compatibles en una misma obra, la incertidumbre total acumulada se calcula mediante la raíz de la suma de varianzas:

$$\mu_{\text{teórico}} = \sum_{i=1}^n \mu_i$$

$$\sigma_{\text{total}} = \sqrt{\sum_{i=1}^n \sigma_i^2}$$

#### El Efecto de Diversificación del Riesgo
El **Coeficiente de Variación Relativo ($\text{CV}_{\text{total}}$)** de la obra disminuye con la cantidad de tareas:

$$\text{CV}_{\text{total}} = \frac{\sigma_{\text{total}}}{\mu_{\text{teórico}}} \propto \frac{1}{\sqrt{n}}$$

> 💡 **Conclusión:** A mayor cantidad de ítems compatibles combinados en la cotización, **menor es la probabilidad porcentual de pasarse del tiempo estimado global**, permitiendo ajustar el precio con mayor agresividad sin incrementar el riesgo de pérdida.

---

## 3. Consolidación de Tiempos de Setup y Eficiencia en Tándem

La sinergia media esperada ($\mu_{\text{sinérgico}}$) se compone de:

1. **Ahorro de Tiempos de Setup:**  
   - Setup aislado sumado: $S_{\text{aislado}} = \sum \min(1.0\text{ h}, \max(0.25\text{ h}, H_i \times 0.15))$.
   - Setup consolidado de obra: $S_{\text{consolidado}} = 1.0\text{ h} + 0.15\text{ h} \times (n - 1)$.
   - Ahorro neto: $\Delta S = \max(0, S_{\text{aislado}} - S_{\text{consolidado}})$.

2. **Bono de Trabajo en Tándem (Cuadrilla Óptima de 2 Operarios):**  
   - En tareas de tracción de cables y montaje, la cuadrilla Oficial + Ayudante reduce los tiempos muertos en un $5\%$ adicional: $B_{\text{tándem}} = 0.05 \times \mu_{\text{teórico}}$.

$$\mu_{\text{óptima}} = \mu_{\text{teórico}} - \Delta S - B_{\text{tándem}}$$

---

## 4. Estimación por Niveles de Confianza Probabilística ($Z_\alpha$)

Para cotizar con precisión según el apetito de riesgo del instalador y el tipo de cliente, el sistema evalúa la duración final bajo diferentes percentiles de la distribución normal estándar:

$$H_{\text{cotizadas}}(p) = \mu_{\text{sinérgico}} + Z_p \cdot \sigma_{\text{total}}$$

$$\text{Factor de Sinergia Aplicado} = \frac{H_{\text{cotizadas}}(p)}{\mu_{\text{teórico}}}$$

| Nivel de Confianza ($p$) | Valor $Z_p$ | Perfil Estratégico | Escenario de Aplicación |
| :--- | :---: | :--- | :--- |
| **50% (Competitivo)** | $0.00$ | **Media Pura / Agresivo** | Licitaciones muy disputadas donde el cliente define 100% por precio y las condiciones de obra son predecibles. |
| **80% (Equilibrado)** | $0.84$ | **Estándar Recomendado** | Equilibrio óptimo entre precio competitivo y cobertura estadística del 80% de posibles demoras o imprevistos. |
| **90% (Conservador)** | $1.28$ | **Alta Cobertura** | Obras en inmuebles antiguos con cañerías existentes de riesgo o clientes exigentes. |
| **95% (Blindado)** | $1.64$ | **Cero Riesgo** | Obras críticas, comerciales o nocturnas donde cualquier sobrecosto de tiempo sería inaceptable. |

---

## 5. Simulación de Estrategias de Cuadrilla

El sistema evalúa en tiempo real tres esquemas operativos combinando el costo de **Mano de Obra Directa (MOD)** con el costo de **Logística y Movilidad Diaria**:

### A) Cuadrilla Mínima (1 Oficial solo)
- **Rendimiento:** 8 horas-hombre / jornada.
- **Factor Sinergia:** $1.00$ (sin tándem).
- **Riesgo Operativo:** Muy bajo (1 hora de parate = 1 hora de salario).
- **Desventaja:** Mayor cantidad de días de obra $\to$ se disparan los gastos de movilidad, combustible y viáticos diarios.

### B) Cuadrilla Óptima (1 Oficial + 1 Ayudante) — *Recomendada*
- **Rendimiento:** 16 horas-hombre / jornada.
- **Factor Sinergia:** $0.75 \text{ a } 0.88$ según nivel de confianza y cantidad de ítems compatibles.
- **Riesgo Operativo:** Bajo.
- **Ventaja:** Punto de equilibrio ideal: minimiza el costo total de ejecución (MOD + Logística) y reduce a la mitad los días de intervención.

### C) Cuadrilla Rápida / Crash (2 Oficiales + 2 Ayudantes)
- **Rendimiento:** 32 horas-hombre / jornada.
- **Factor Sinergia:** $\approx 0.95 \text{ a } 1.05$ (penalidad por coordinación de equipo según Ley de Brooks).
- **Riesgo Operativo:** Alto (1 hora de parate por falta de materiales = 4 horas de salario muerto).
- **Ventaja:** Tiempo de entrega récord (ideal para comercios que deben abrir o paradas de planta).

---

## 6. Criterio Estricto de Compatibilidad

Para evitar sinergias ficticias en presupuestos inconexos, la optimización solo se activa si se cumplen dos condiciones:
1. $\text{Cantidad de Ítems} > 1$.
2. Al menos **2 ítems** requieren mano de obra real ($\text{costoManoObra} > 0$ o $\text{manoObraSnapshot} \neq \emptyset$).

Si no se cumple la compatibilidad, el factor de sinergia permanece estrictamente en $1.00$.

---

## 7. Módulos de Código Fuente

- **Motor de Cálculo Estocástico:** [`src/core/calculations.ts`](src/core/calculations.ts) (`calcularOptimizacionCuadrilla`, `sonItemsCompatiblesParaSinergia`, `Z_SCORES_CONFIANZA`).
- **Definiciones de Tipos:** [`src/core/types.ts`](src/core/types.ts) (`NivelConfianzaSinergia`, `PlanificacionCuadrilla`, `OpcionCuadrillaSimulada`).
- **Componente Interactivo UI:** [`src/components/presupuesto/PlanificadorCuadrillaCard.tsx`](src/components/presupuesto/PlanificadorCuadrillaCard.tsx).
- **Suite de Pruebas Unitarias:** [`src/core/calculations.test.ts`](src/core/calculations.test.ts).
