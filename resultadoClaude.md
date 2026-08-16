# Diagnóstico & Plan de Alineación Material Design 3 (M3) — Cotizador IEBA

## 1. Diagnóstico de Tokens de Diseño

La estructura de tokens se centraliza en:

1. **`src/index.css`**:
   - Contiene la definición de las **13 paradas tonales reales** (0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100) para las familias `Primary`, `Secondary`, `Tertiary`, `Neutral`, `Neutral-Variant` y `Error`.
   - Asigna los roles semánticos del sistema `--md-sys-color-*` para **Light Theme** y **Dark Theme**.
   - Implementa la utilidad `.state-layer` con pseudo-elemento `::after` proyectando sobre `currentColor` con opacidades canónicas (8% hover / 12% focus / 12% pressed).
2. **`tailwind.config.js`**:
   - Mapea las utilidades Tailwind (`primary`, `on-primary`, `surface-container-low`, `outline-variant`, etc.) a `var(--md-sys-color-*)`.

---

## 2. Inventario de Componentes: "Chip / Badge" vs. "Botón / Acción"

| Tipo de Componente | Ejemplos en la App | Forma M3 | Radio M3 | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **Chips / Badges Informativos** *(Etiquetas no interactivas)* | - Rol de Contacto: `"Cliente"`, `"Proveedor"`<br>- Condición IVA: `"Responsable Inscripto"`<br>- Estado de Presupuesto: `"Borrador"`, `"Enviado"`<br>- Contadores: `"3 materiales"`, `"4 opt"`, `"⚙️ 2"`<br>- Tags de atributos: `"seccion: 2.5 mm²"`<br>- Tipo de Comprobante: `"Factura B"` | **Shape Small** | **8dp fijo** (`rounded-lg`) | Corregido ✅ |
| **Botones / Acciones** *(Clickeables / Disparadores)* | - Primarios: `"Nueva Categoría"`, `"Emitir"`, `"Guardar"`<br>- Contextuales: `"Pedir RFQ"`, `"Cargar Tarea"`, `"Ítem Ad-Hoc"`<br>- FABs / Speed Dial: `"Alta Rápida"`, `"Ficha Completa"`<br>- Filter Chips (seleccionables con acción) | **Shape Full** | **Stadium** (`rounded-full`) | Corregido ✅ |
| **Cards & Contenedores** *(Superficies modulares)* | - Tarjetas de Categoría, Material, Tarea y Contacto<br>- Diálogos modales y drawers | **Shape Large** | **16dp** (`rounded-2xl`) | Corregido ✅ |

---

## 3. Matriz Tonal M3 Completa (Seed: Oliva / Dorado `#755B00`)

```css
/* Escala Tonal Primary (Oliva / Dorado) */
--md-ref-palette-primary-0: #000000;
--md-ref-palette-primary-10: #241a00;
--md-ref-palette-primary-20: #3e2e00;
--md-ref-palette-primary-30: #594400;
--md-ref-palette-primary-40: #755b00; /* Seed Light */
--md-ref-palette-primary-50: #927200;
--md-ref-palette-primary-60: #b18c00;
--md-ref-palette-primary-70: #d1a600;
--md-ref-palette-primary-80: #eec148; /* Seed Dark */
--md-ref-palette-primary-90: #ffdf97;
--md-ref-palette-primary-95: #ffeed0;
--md-ref-palette-primary-99: #fffbf7;
--md-ref-palette-primary-100: #ffffff;

/* Escala Tonal Secondary (Oliva Cálido) */
--md-ref-palette-secondary-0: #000000;
--md-ref-palette-secondary-10: #231b04;
--md-ref-palette-secondary-20: #392f15;
--md-ref-palette-secondary-30: #504629;
--md-ref-palette-secondary-40: #695e40;
--md-ref-palette-secondary-50: #827657;
--md-ref-palette-secondary-60: #9d906f;
--md-ref-palette-secondary-70: #b8aa88;
--md-ref-palette-secondary-80: #d4c6a2;
--md-ref-palette-secondary-90: #f1e2bd;
--md-ref-palette-secondary-95: #fff0cc;
--md-ref-palette-secondary-99: #fffbf7;
--md-ref-palette-secondary-100: #ffffff;

/* Escala Tonal Tertiary (Verde Salvia / Tierra) */
--md-ref-palette-tertiary-0: #000000;
--md-ref-palette-tertiary-10: #062109;
--md-ref-palette-tertiary-20: #1b361c;
--md-ref-palette-tertiary-30: #314d31;
--md-ref-palette-tertiary-40: #486548;
--md-ref-palette-tertiary-50: #607e5f;
--md-ref-palette-tertiary-60: #799877;
--md-ref-palette-tertiary-70: #94b391;
--md-ref-palette-tertiary-80: #afcfab;
--md-ref-palette-tertiary-90: #cbebc6;
--md-ref-palette-tertiary-95: #dafadb;
--md-ref-palette-tertiary-99: #f6fff4;
--md-ref-palette-tertiary-100: #ffffff;

/* Asignación de Roles Semánticos */
/* Botón Primario: bg-primary text-on-primary */
/* Badge "Cliente": bg-secondary-container text-on-secondary-container */
/* Badge "Proveedor": bg-tertiary-container text-on-tertiary-container */
/* Fondo General: bg-surface (Light: #FFF8F1, Dark: #1F1B13) */
/* Cards: bg-surface-container-low (Light: #F8EFE2, Dark: #1F1B13) */
/* Cards Hover: bg-surface-container-high (Light: #E8E2D4, Dark: #373229) */
/* Excepción Brand externa: WhatsApp #25D366 (no pertenece al sistema M3) */
```

---

## 4. Superficies por Tono & State Layers M3

1. **Superficies por tono, no por borde**:
   - Reemplazo de los bordes duros `border border-outline-variant/20` que separan las cards por contraste tonal:
     - Fondo de página: `--md-sys-color-surface`
     - Cards y contenedores: `--md-sys-color-surface-container-low` (16dp `rounded-2xl`)
     - Cards en estado hover: `--md-sys-color-surface-container-high`
2. **State Layers (Hover, Focus, Pressed)**:
   - Utilidad `.state-layer` proyectando sobre `currentColor` mediante pseudo-elemento `::after`: opacidad 8% en hover, 12% en focus y 12% en pressed.
3. **Touch Targets mínimos**:
   - Área clickeable mínima de **48x48px** en icon buttons táctiles (`min-w-[48px] min-h-[48px] p-3`).

---

## 5. Código de Referencia: Tarjeta de "Familias & Categorías"

```tsx
/* ✅ Superficie por tono sin borde, hover por cambio de container-high, radio de card 16dp (rounded-2xl) */
<div className="bg-surface-container-low hover:bg-surface-container-high rounded-2xl p-5 transition-colors flex flex-col justify-between">
  <div>
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <div className="p-2.5 bg-primary-container text-on-primary-container rounded-xl">
          <Layers className="w-4 h-4" />
        </div>
        <h4 className="font-bold text-on-surface text-base">{cat.nombre}</h4>
      </div>
      {/* ✅ Chip M3 informativo: 8dp (rounded-lg), sin borde, fondo surface-container-highest */}
      <span className="text-[11px] font-medium text-on-surface-variant bg-surface-container-highest px-2.5 py-0.5 rounded-lg shrink-0 select-none">
        {matCount} materiales
      </span>
    </div>

    <div className="mt-3.5">
      <div className="flex flex-wrap gap-1.5">
        {cat.atributosSugeridos.map((at, idx) => (
          /* ✅ Chips informativos: 8dp (rounded-lg), fondo tonal surface-container, sin bordes finos */
          <span key={idx} className="inline-flex items-center gap-1 text-[11px] bg-surface-container text-on-surface-variant px-2.5 py-0.5 rounded-lg font-mono select-none">
            <span>{at.etiqueta || at.clave} {at.unidad ? `(${at.unidad})` : ''}</span>
            {at.opciones && at.opciones.length > 0 && (
              <span className="text-[10px] bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded-md font-bold">
                {at.opciones.length} opt
              </span>
            )}
            {at.dependencias && at.dependencias.length > 0 && (
              <span className="text-[10px] bg-tertiary-container text-on-tertiary-container px-1.5 py-0.5 rounded-md font-bold">
                ⚙️ {at.dependencias.length}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  </div>

  {/* ✅ Touch targets M3: Icon Buttons con área clickeable mínima de 48x48px y state layers */}
  <div className="mt-4 pt-3 border-t border-outline-variant/15 flex justify-end gap-1">
    <button
      onClick={() => handleOpenEditCat(cat)}
      className="min-w-[48px] min-h-[48px] p-3 text-on-surface-variant hover:text-primary rounded-full state-layer transition-colors flex items-center justify-center cursor-pointer"
      title="Editar Categoría"
      aria-label={`Editar categoría ${cat.nombre}`}
    >
      <Edit2 className="w-4 h-4" />
    </button>
    <button
      onClick={() => handleDeleteCat(cat.id)}
      className="min-w-[48px] min-h-[48px] p-3 text-on-surface-variant hover:text-error rounded-full state-layer transition-colors flex items-center justify-center cursor-pointer"
      title="Eliminar Categoría"
      aria-label={`Eliminar categoría ${cat.nombre}`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
</div>
```
