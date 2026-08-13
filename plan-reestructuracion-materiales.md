# Plan de reestructuración — Catálogo de Materiales, Productos y Ofertas

## Contexto y decisión de arranque

El proyecto no está en producción: no hay usuarios ni presupuestos reales que preservar. Por lo tanto:

- **No se implementa lógica de migración de datos.** Se reescribe el modelo directamente.
- **Firestore (nube de prueba):** borrar las colecciones afectadas (`materiales`/`insumos` actuales, `presupuestos` de prueba si referencian el modelo viejo) antes de desplegar el nuevo esquema. No hay necesidad de preservarlas.
- **IndexedDB (Dexie, local):** bump de la versión del schema de Dexie. No hace falta escribir una función de `upgrade()` que transforme datos viejos — alcanza con que la nueva versión defina las tablas nuevas; los datos de prueba anteriores quedan huérfanos y se pueden limpiar con un `db.delete()` + recarga en cada entorno de desarrollo.
- **`sampleData.ts`:** reescribir con datos de ejemplo que reflejen el modelo nuevo (2-3 categorías, algunos materiales, productos y ofertas de ejemplo), no adaptar los existentes.

Instrucción explícita para el agente: **no escribir código de migración ni de compatibilidad con el esquema anterior**. Cualquier función `migrate`, `legacy`, o similar debe evitarse — es trabajo innecesario en este momento.

---

## Modelo de datos nuevo

### 1. `CategoriaMaterial`
Agrupador que sugiere qué atributos técnicos tiene sentido cargar para esa familia de materiales.

```
CategoriaMaterial {
  id: string
  nombre: string                    // "Cables", "Protecciones", "Canalizaciones", etc.
  atributosSugeridos: AtributoTemplate[]
}

AtributoTemplate {
  clave: string                     // "seccion", "In", "Id", "polos", "norma"
  etiqueta: string                  // texto visible en el formulario
  unidad?: string                   // "mm²", "A", "mA"
  tipo: 'texto' | 'numero'
}
```

No es un schema rígido/obligatorio — es una plantilla de sugerencias para autocompletar el alta. El material puede tener atributos fuera de la plantilla.

### 2. `Material`
La ficha técnico-normativa, sin marca ni precio.

```
Material {
  id: string
  categoriaId: string
  nombre: string                    // autogenerado desde atributos, editable a mano
  norma?: string                    // "IRAM-NM 247-3"
  unidadVenta: string               // "m", "u", "kg", "rollo x100m"
  atributos: { clave: string, valor: string }[]
  notas?: string
  activo: boolean                   // false = obsoleto/discontinuado, no aparece en autocompletado
}
```

### 3. `Producto`
Implementación de marca de un Material. Un Material puede tener 0, 1 o N productos.

```
Producto {
  id: string
  materialId: string                // FK, obligatorio
  marca: string
  modelo: string
  codigoFabricante?: string
  tierCalidad?: 'premium' | 'estandar' | 'economico'
  notas?: string                    // ej: "mejor comportamiento térmico"
  esPreferido: boolean              // default sugerido al resolver el Material
}
```

### 4. `Oferta` (reemplaza el historial de precios actual)
Precio de un proveedor, para un Producto o directamente para un Material sin marca definida.

```
Oferta {
  id: string
  materialId: string                 // FK, siempre presente
  productoId?: string                // FK opcional — null = precio genérico sin marca
  proveedorId: string
  precio: number
  fecha: Date
  fuente: 'indice' | 'manual' | 'cotizacion_directa'
  tipoAjustePrecio?: string          // referencia a TIPOS_AJUSTE_PRECIO cuando fuente = 'indice'
  solicitudCotizacionId?: string     // FK opcional, si vino de una RFQ
}
```

### 5. Ítem de presupuesto (ajuste al modelo existente)

```
ItemPresupuesto {
  ...campos existentes...
  materialId: string                 // siempre presente, trazabilidad técnica garantizada
  productoId?: string                // presente si se resolvió con marca
  ofertaId?: string                  // presente si el precio vino del catálogo
  precioManual?: number              // presente si se tipeó a mano
  // snapshot de precio congelado ya existe en el modelo actual — sin cambios ahí
}
```

Regla de negocio: `ofertaId` y `precioManual` son mutuamente excluyentes; exactamente uno debe estar presente al guardar el ítem.

### 6. `Proveedor` (contactos dinámicos)

```
Proveedor {
  id: string
  razonSocial: string
  cuit?: string
  tipoProveedor: string              // TIPOS_PROVEEDOR existente
  contactos: Contacto[]
  notas?: string
}

Contacto {
  id: string
  nombrePersona: string
  rol?: string                       // "Ventas", "Administración", "Técnico"
  canales: CanalContacto[]
}

CanalContacto {
  tipo: 'telefono' | 'whatsapp' | 'email' | 'web'
  valor: string
  esPrincipal: boolean
}
```

UI: helper que genera `https://wa.me/<numero>` y `mailto:<email>` a partir de `CanalContacto`, sin lógica de backend ni credenciales.

### 7. `SolicitudCotizacion` (nueva)

```
SolicitudCotizacion {
  id: string
  proveedorId: string
  estado: 'borrador' | 'enviada' | 'respondida' | 'vencida'
  fechaCreacion: Date
  fechaEnvio?: Date
  items: SolicitudCotizacionItem[]
}

SolicitudCotizacionItem {
  materialId: string
  productoId?: string                // si se pide una marca específica
  cantidad?: number
  precioRespuesta?: number           // cargado manualmente tras la respuesta del proveedor
  ofertaGeneradaId?: string          // FK a la Oferta creada al confirmar el precio
}
```

Flujo funcional (ya definido en la conversación): seleccionar materiales pendientes → armar solicitud → generar texto plano para enviar por WhatsApp/email → cargar precio de respuesta manualmente ítem por ítem → cada carga genera una `Oferta` con `fuente: 'cotizacion_directa'`.

---

## Fases de implementación (orden sugerido para el agente)

1. **Tipos y modelo de datos**: definir las interfaces de arriba en el core del proyecto, reemplazando las actuales de insumo/material único.
2. **Schema Dexie v2**: nuevas tablas (`categoriasMaterial`, `materiales`, `productos`, `ofertas`, `solicitudesCotizacion`), bump de versión, sin `upgrade()` de transformación.
3. **Firestore**: definir las nuevas colecciones equivalentes; borrar las colecciones de prueba viejas (manual, antes de desplegar).
4. **`sampleData.ts`**: reescribir con 2-3 categorías y materiales de ejemplo, con sus productos y ofertas.
5. **Motor de cálculo**: adaptar `calculations.ts`/`calculations.test.ts` para que el snapshot de precio de un ítem tome `oferta.precio` o `precioManual` indistintamente, sin cambiar la lógica de redondeo bancario existente.
6. **UI — Catálogo de Materiales**: alta con selección de categoría → sugerencia de atributos → nombre autogenerado editable.
7. **UI — Catálogo de Productos**: alta rápida asociada a un Material, marcado de producto preferido.
8. **UI — Ofertas/Precios**: semáforo de vencimiento ya existente, ahora aplicado a nivel Oferta (sin cambios de lógica, solo de FK).
9. **UI — Selector de ítem en presupuesto**: buscar por Material → resolver a Producto+Oferta preferidos (editable) o precio manual.
10. **Proveedores**: refactor de ficha a contactos dinámicos + botones de WhatsApp/email con deep link.
11. **Solicitud de Cotización**: pantalla de armado, generación de texto para envío, carga manual de respuestas, generación de Ofertas.
12. **Exportación**: reemplazar exportación CSV por JSON (backup completo) y XLSX multi-hoja (Materiales / Productos / Ofertas / Proveedores relacionadas por ID) usando SheetJS.

## Fuera de alcance por ahora (backlog, no bloquea esta reestructuración)

- Integración con API de Mercado Libre — queda como botón de búsqueda externa (link pre-armado), no integración de datos.
- Lista de compras agregada por proveedor entre presupuestos.
- Alertas de margen bajo.
- Estrategia formal de resolución de conflictos de sync Firestore (definir criterio antes de habilitar sync multi-dispositivo real, no antes de esta reestructuración).
