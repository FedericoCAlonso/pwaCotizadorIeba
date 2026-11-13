# Cotizador Eléctrico IEBA (PWA)

PWA standalone offline-first para cotización de trabajos eléctricos, basada en React, TypeScript, Vite PWA y Dexie (IndexedDB).

## Copia de seguridad y restauración ante rollback (`old` / `v1-final`)

**Importante:** IndexedDB / Dexie no permite bajar de versión una base de datos ya abierta con una versión de esquema superior (por ejemplo, de `v9` a `v8` en `old` / `v1-final`). Si necesitás volver a ejecutar la rama `old` o el tag `v1-final` en un navegador que ya migró a `v9`, seguí estos pasos:

### 1. Exportar respaldo JSON antes de probar cambios
En la aplicación, abrí el menú **Utilidades (ícono de engranaje)** en la barra superior (o el menú **Más** en móvil) y hacé clic en **"Respaldar datos (JSON)"**. Esto descarga un archivo `Cotizador-IEBA-Backup-YYYY-MM-DD.json` con todas las tablas locales.

### 2. Si necesitás volver a `old` (`v1-final`)
Si la base local quedó en `v9` y volvés a `old` (`v8`), IndexedDB rechazará abrir `CotizadorIebaDB` con `VersionError`:

1. **Asegurate de tener tu archivo JSON respaldado** (del paso 1 o de Google Drive / Carpeta Local).
2. **Eliminá la base IndexedDB del navegador** para limpiar el número de versión `v9`:
   - En Chrome/Edge/Brave: `DevTools (F12)` → pestaña **Application** → **Storage** → **IndexedDB** → seleccioná `CotizadorIebaDB` → **Delete database**.
   - También podés desregistrar el Service Worker y limpiar el almacenamiento del sitio desde **Application → Clear site data** si querés forzar la recarga completa de `old`.
3. **Levantá la versión `old` (`v1-final`)**: al recargar, Dexie creará nuevamente `CotizadorIebaDB` en `v8`.
4. **Restaurá tu respaldo JSON**: abrí **Utilidades → Restaurar datos (JSON)** (o el proveedor de sincronización correspondiente) y seleccioná tu archivo `.json`. La app recargará con todos tus catálogos y cotizaciones intactos.
