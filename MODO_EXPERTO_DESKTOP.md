# Propuesta de Arquitectura y Diseño: Modo Experto Desktop (Keyboard-First)

## 1. Visión y Objetivo
El **Modo Experto Desktop** es una funcionalidad pensada para usuarios avanzados (*power users*) que operan la aplicación en entornos de oficina con teclado físico y pantalla completa. 

El objetivo es permitir la creación, edición y estructuración de presupuestos completos **sin levantar las manos del teclado** y sin depender de ventanas modales o clics con el mouse, reduciendo el tiempo de armado de cotizaciones extensas de varios minutos a segundos.

---

## 2. Viabilidad Arquitectónica en PWA Cotizador IEBA
La aplicación cuenta con una arquitectura desacoplada basada en capas:
- **Motor de Dominio y Cálculo ([`src/core/calculations.ts`](src/core/calculations.ts))**: Cálculos determinísticos puros de cascada de costos ($C \to GG \to B \to S \to \text{Impuestos} \to K$), horas de mano de obra y snapshots de materiales.
- **Modelos Canónicos ([`src/core/types.ts`](src/core/types.ts))**: Definición limpia de `Presupuesto`, `ItemPresupuesto`, `CapituloPresupuesto`, `GastoPresupuestoConfig`, etc.
- **Capa ViewModel ([`src/viewmodels/usePresupuestoEditorViewModel.ts`](src/viewmodels/usePresupuestoEditorViewModel.ts))**: Gestión reactiva del estado y persistencia en IndexedDB (Dexie).

Por lo tanto, un editor basado en texto estructurado o comandos de barra diagonal (`/`) no requiere reconstruir la lógica de la aplicación; es simplemente un **adaptador de entrada alternativo (View)** que alimenta el mismo estado del `Presupuesto`.

---

## 3. Enfoques de Implementación Evaluados

### Enfoque A: "Slash Commands" / Bloques Notacionales (Estilo Notion / Linear) — *Recomendado*
El usuario escribe sobre un lienzo estructurado donde cada línea representa un elemento semántico del presupuesto:
1. Al escribir **`/`** en una línea en blanco, se despliega una paleta contextual en el cursor (*caret*):
   - `/tarea [búsqueda]`: Busca en el catálogo de `TareasTipo` (ej. `/boca`, `/termomagnetica`).
   - Presionar `Enter` inserta la partida y posiciona automáticamente el foco en la columna de cantidad.
   - Presionar `Enter` nuevamente crea la siguiente línea sin tocar el mouse.
2. Al escribir **`# `** o **`## `**, la línea se convierte automáticamente en un **Capítulo** del presupuesto.
3. Al escribir **`/gasto`**, permite seleccionar o definir un gasto operativo o logística en línea.

### Enfoque B: Markdown Computacional / DSL (Estilo Soulver / TaskPaper / LaTeX)
El presupuesto completo se representa como un documento de texto plano enriquecido, con un parser bidireccional en tiempo real:

```text
# Obra: Torre Bellini - Juncal 1234, 4° B
@cliente: Estudio Arq. Federico Gómez
@factura: Factura A
@validez: 15 dias

## 1. Acometida y Tablero Principal
- 1 u * "Tablero Seccional Embutir 24 Módulos"
- 2 u * "Disyuntor Diferencial 2x40A 30mA"
- 8 u * "Termomagnética Bipolar 16A Curva C"

## 2. Tendido y Bocas
- 36 u * "Boca de Iluminación Techo / Pared"
- 24 u * "Tomacorriente Doble con Tierra"

@gasto: "Flete y Traslado de Materiales" = $ 45.000
@margen: 35%
@riesgo: medio
```

**Ventajas clave del Enfoque B:**
- **Interoperabilidad total**: Posibilidad de redactar borradores en el bloc de notas, recibir una lista por correo electrónico o WhatsApp, pegarla en el editor y tener la cotización calculada al instante.
- **Portabilidad**: Exportar o respaldar la cotización como texto legible para humanos.

---

## 4. Interacción y Ergonomía del Teclado
- **Cero latencia**: Autocompletado difuso (*fuzzy search*) contra la base de datos de tareas e insumos en memoria (`insumosMap`).
- **Navegación**:
  - `Tab` / `Shift+Tab`: Moverse entre nombre de partida, cantidad y unidad.
  - `Ctrl + Enter` / `Cmd + Enter`: Emitir o previsualizar el presupuesto.
  - `Alt + ↑` / `Alt + ↓`: Reordenar partidas o capítulos.
  - `Escape`: Cerrar sugerencias y volver al modo de escritura.

---

## 5. Panel Lateral de Computación en Vivo (Inspector)
Mientras el usuario edita el documento de texto, un panel lateral derecho reactivo muestra:
- **Costo Directo** acumulado en tiempo real (Materiales + Mano de Obra).
- **Factor K** y desglose de Gastos Generales y Beneficio.
- **Precio Final de Venta** en ARS y su equivalente en moneda extranjera (USD).
- Alertas inmediatas de margen bajo o inconsistencias (ej: partida sin cantidad).

---

## 6. Estado en el Roadmap
- **Estado**: Propuesta conceptual archivada y validada arquitectónicamente.
- **Próxima etapa**: Diseño de especificación de gramática / parser cuando se prioricen las optimizaciones exclusivas para entorno Desktop.
