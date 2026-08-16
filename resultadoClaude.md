# Diagnóstico & Plan de Alineación Material Design 3 (M3) — Cotizador IEBA

## 1. Diagnóstico de Tokens de Diseño Actuales

La estructura de tokens actual se compone de:

1. **`src/index.css`**:
   - Define un conjunto parcial de variables CSS `--md-sys-color-*` dentro de `:root` (Light) y `.dark` (Dark).
   - **Limitación actual**: Solo tiene 25 variables asignadas de forma fija (no contiene las 13 tonalidades HCT completas por rol: 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100).
2. **`tailwind.config.js`**:
   - Mapea las utilidades Tailwind (`primary`, `on-primary`, `surface-container-low`, `outline-variant`, etc.) a `var(--md-sys-color-*)`.
3. **Colores y estilos inline dispersos**:
   - Varios componentes usan clases Tailwind con colores arbitrarios (`bg-purple-500/15`, `bg-amber-500/10`, `text-emerald-500`) y bordes duros `border border-outline-variant/20` que contradicen el principio de elevación por tonalidad de superficie de M3.

---

## 2. Inventario de Componentes: "Chip / Badge" vs. "Botón / Acción"

| Tipo de Componente | Ejemplos en la App | Forma M3 requerida | Estado actual | Corrección M3 |
| :--- | :--- | :--- | :--- | :--- |
| **Chips / Badges Informativos** *(Etiquetas no interactivas)* | - Rol de Contacto: `"Cliente"`, `"Proveedor"`<br>- Condición IVA: `"Responsable Inscripto"`<br>- Estado de Presupuesto: `"Borrador"`, `"Enviado"`<br>- Contadores: `"3 materiales"`, `"4 opt"`, `"⚙️ 2"`<br>- Tags de atributos: `"seccion: 2.5 mm²"`<br>- Tipo de Comprobante: `"Factura B"` | **8dp fijo** (`rounded-lg` / `rounded-md`) | `rounded-full` (Stadium) ❌ | `rounded-lg` (8dp) ✅ |
| **Botones / Acciones** *(Clickeables / Disparadores)* | - Primarios: `"Nueva Categoría"`, `"Emitir"`, `"Guardar"`<br>- Contextuales: `"Pedir RFQ"`, `"Cargar Tarea"`, `"Ítem Ad-Hoc"`<br>- FABs / Speed Dial: `"Alta Rápida"`, `"Ficha Completa"`<br>- Filter Chips (seleccionables con acción) | **Stadium / Full** (`rounded-full`) | `rounded-full` ✅ | Mantener `rounded-full` ✅ |

---

## 3. Matriz Tonal M3 Propuesta (Seed: Oliva / Dorado `#755B00`)

A partir del color semilla de marca, la paleta tonal completa M3 genera:

```css
/* Escala Tonal Primary (Oliva / Dorado) */
--md-ref-palette-primary-0: #000000;
--md-ref-palette-primary-10: #241a00;
--md-ref-palette-primary-20: #3e2e00;
--md-ref-palette-primary-30: #594400;
--md-ref-palette-primary-40: #755b00; /* Seed Light */
--md-ref-palette-primary-80: #eec148; /* Seed Dark */
--md-ref-palette-primary-90: #ffdf97;
--md-ref-palette-primary-100: #ffffff;

/* Escala Tonal Secondary (Oliva Cálido) */
--md-ref-palette-secondary-10: #231b04;
--md-ref-palette-secondary-20: #392f15;
--md-ref-palette-secondary-40: #695e40;
--md-ref-palette-secondary-80: #d6c69f;
--md-ref-palette-secondary-90: #f3e2b9;

/* Escala Tonal Tertiary (Verde Salvia / Tierra) */
--md-ref-palette-tertiary-10: #062109;
--md-ref-palette-tertiary-20: #1b361c;
--md-ref-palette-tertiary-40: #496547;
--md-ref-palette-tertiary-80: #afcfaa;
--md-ref-palette-tertiary-90: #cbebc4;

/* Asignación de Roles Semánticos */
/* Botón Primario: bg-primary text-on-primary */
/* Badge "Cliente": bg-secondary-container text-on-secondary-container */
/* Badge "Proveedor": bg-tertiary-container text-on-tertiary-container */
/* Fondo General: bg-surface (Light: #FFF8F1, Dark: #16130B) */
/* Cards: bg-surface-container-low (Light: #F9F2EA, Dark: #1F1B13) */
/* Cards Hover / Activas: bg-surface-container-high (Light: #EDE6DE, Dark: #2E2A21) */
/* Excepción Brand externa: WhatsApp #25D366 (no pertenece al sistema M3) */
```

---

## 4. Superficies por Tono & State Layers M3

1. **Superficies por tono, no por borde**:
   - Reemplazo de los bordes duros `border border-outline-variant/20` que separan las cards por contraste tonal:
     - Fondo de página: `--md-sys-color-surface`
     - Cards y contenedores: `--md-sys-color-surface-container-low`
     - Cards en estado hover/activo: `--md-sys-color-surface-container-high` / `--md-sys-color-surface-container-highest`
2. **State Layers (Hover, Focus, Pressed)**:
   - Capas de interacción estándar M3 sobre botones y cards: opacidad del 8% en hover, 12% en focus y 12% en pressed.
3. **Touch Targets mínimos**:
   - Asegurar un área clickeable mínima de **48x48px** en botones e icon buttons (utilizando padding `p-3` y `min-w-[48px] min-h-[48px]`, manteniendo el ícono visual en 16–20px).

---

## 5. Antes vs. Después: Tarjeta de "Familias & Categorías"

### ❌ Antes (Actual)
```tsx
<div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all flex flex-col justify-between shadow-sm">
  <div>
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-primary/10 text-primary rounded-xl">
          <Layers className="w-4 h-4" />
        </div>
        <h4 className="font-bold text-on-surface text-base">{cat.nombre}</h4>
      </div>
      {/* ❌ Error: Badge informativo con rounded-full (stadium) */}
      <span className="text-[11px] font-medium text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-full shrink-0">
        {matCount} materiales
      </span>
    </div>

    <div className="mt-3">
      <div className="flex flex-wrap gap-1.5">
        {cat.atributosSugeridos.map((at, idx) => (
          /* ❌ Error: Badges con bordes y rounded-full */
          <span key={idx} className="inline-flex items-center gap-1 text-[10px] bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-md border border-outline-variant/20 font-mono">
            <span>{at.etiqueta || at.clave}</span>
            <span className="text-[9px] bg-primary/15 text-primary px-1 rounded-full font-bold">
              {at.opciones.length} opt
            </span>
          </span>
        ))}
      </div>
    </div>
  </div>

  <div className="mt-4 pt-3 border-t border-outline-variant/20 flex justify-end gap-1">
    {/* ❌ Error: Touch target menor a 48x48px (p-1.5 = 28px) */}
    <button className="p-1.5 text-on-surface-variant hover:text-primary rounded-lg transition-colors">
      <Edit2 className="w-3.5 h-3.5" />
    </button>
  </div>
</div>
```

### ✅ Después (M3 Estricto)
```tsx
/* ✅ Superficie por tono sin borde, hover por cambio de container-high, radio de card 24dp (rounded-3xl) */
<div className="bg-surface-container-low hover:bg-surface-container-high active:bg-surface-container-highest rounded-3xl p-5 transition-colors flex flex-col justify-between">
  <div>
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <div className="p-2.5 bg-primary-container text-on-primary-container rounded-2xl">
          <Layers className="w-5 h-5" />
        </div>
        <h4 className="font-bold text-on-surface text-base">{cat.nombre}</h4>
      </div>
      {/* ✅ Chip M3 informativo: 8dp (rounded-lg), sin borde, fondo surface-container-highest */}
      <span className="text-[11px] font-medium text-on-surface-variant bg-surface-container-highest px-2.5 py-1 rounded-lg shrink-0 select-none">
        {matCount} materiales
      </span>
    </div>

    <div className="mt-3.5">
      <div className="flex flex-wrap gap-1.5">
        {cat.atributosSugeridos.map((at, idx) => (
          /* ✅ Chips informativos: 8dp (rounded-lg), fondo tonal surface-container, sin bordes finos */
          <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] bg-surface-container text-on-surface-variant px-2.5 py-1 rounded-lg font-mono">
            <span>{at.etiqueta || at.clave} {at.unidad ? `(${at.unidad})` : ''}</span>
            {at.opciones && at.opciones.length > 0 && (
              <span className="text-[10px] bg-secondary-container text-on-secondary-container px-1.5 py-0.2 rounded-md font-bold">
                {at.opciones.length} opt
              </span>
            )}
            {at.dependencias && at.dependencias.length > 0 && (
              <span className="text-[10px] bg-tertiary-container text-on-tertiary-container px-1.5 py-0.2 rounded-md font-bold">
                ⚙️ {at.dependencias.length}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  </div>

  {/* ✅ Touch targets M3: Icon Buttons con área clickeable mínima de 48x48px y state layers */}
  <div className="mt-4 pt-3 flex justify-end gap-1">
    <button
      className="min-w-[48px] min-h-[48px] p-3 text-on-surface-variant hover:text-primary hover:bg-surface-variant active:bg-surface-container-highest rounded-full transition-colors flex items-center justify-center cursor-pointer"
      title="Editar Categoría"
      aria-label={`Editar categoría ${cat.nombre}`}
    >
      <Edit2 className="w-4 h-4" />
    </button>
    <button
      className="min-w-[48px] min-h-[48px] p-3 text-on-surface-variant hover:text-error hover:bg-error-container/30 active:bg-error-container/50 rounded-full transition-colors flex items-center justify-center cursor-pointer"
      title="Eliminar Categoría"
      aria-label={`Eliminar categoría ${cat.nombre}`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
</div>
```
