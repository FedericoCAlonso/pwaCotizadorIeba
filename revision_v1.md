# Informe de Revisión de Calidad de Código y Arquitectura (v1)

Este documento resume el análisis de arquitectura, mantenibilidad y calidad de código del proyecto **Cotizador Eléctrico IEBA**, identificando oportunidades de mejora sin alterar la funcionalidad existente ni la estructura de datos.

---

## 1. Oportunidades de Mejora Identificadas

### 1.1. Modularización de Componentes Gigantes ("God Components")

#### **Diagnóstico**:
Varios componentes React acumulan múltiples responsabilidades (UI de listas, tablas, formularios, modales, importación/exportación y cálculos) en archivos con elevado número de líneas:
* [InsumosManager.tsx](file:///d:/Federico/Repos/pwaCotizadorIeba/src/components/InsumosManager.tsx): **~100 KB** (~1.900 líneas).
* [PresupuestoEditor.tsx](file:///d:/Federico/Repos/pwaCotizadorIeba/src/components/PresupuestoEditor.tsx): **~88 KB** (~1.600 líneas).
* [ContactosManager.tsx](file:///d:/Federico/Repos/pwaCotizadorIeba/src/components/ContactosManager.tsx): **~72 KB** (~1.400 líneas).
* [TareasTipoManager.tsx](file:///d:/Federico/Repos/pwaCotizadorIeba/src/components/TareasTipoManager.tsx): **~52 KB** (~1.100 líneas).

#### **Propuesta**:
Subdividir los componentes por sub-pantallas o sub-funciones:
* **`TareasTipoManager.tsx`**: Extraer `CatalogoSubmodulo.tsx`, `SimulacionWhatIfSubmodulo.tsx`, `CalibracionEmaSubmodulo.tsx` y `AuditoriaSubmodulo.tsx`.
* **`PresupuestoEditor.tsx`**: Extraer `PresupuestoItemRow.tsx`, `PresupuestoTotalsCard.tsx` y `PresupuestoEmisionModal.tsx`.

#### **Beneficio**:
Mejora el rendimiento reduciendo re-renders innecesarios en React, acelera los tiempos de compilación y facilita las pruebas unitarias.

---

### 1.2. Abstracción de la Capa de Datos (Custom Hooks / Repositories)

#### **Diagnóstico**:
Los componentes React realizan invocaciones directas a Dexie/IndexedDB (`db.tareasTipo.add()`, `db.config.toArray()`, `softDelete('contactos', id)`), acoplando la interfaz visual con la base de datos local.

#### **Propuesta**:
Crear custom hooks reusables en `src/hooks/`:
* `useAppConfig()`: Proporciona la configuración activa y funciones de actualización (`updateConfig()`, `restoreDefaults()`).
* `useTareasTipo()`: Gestiona el catálogo de tareas tipo y operaciones CRUD.
* `useContactos()`: Encapsula búsquedas y filtrados de clientes/proveedores.

#### **Beneficio**:
Desacopla la UI de IndexedDB. Ante una futura integración con backend cloud o API externa, la UI permanecerá intacta.

---

### 1.3. Saneamiento y Tipado Estricto en `types.ts`

#### **Diagnóstico**:
* Uso residual de `any` (ej. `Insumo.ofertas?: any[]` en [types.ts](file:///d:/Federico/Repos/pwaCotizadorIeba/src/core/types.ts#L117)).
* Campos paralelos de retrocompatibilidad (`cuitDni` vs `cuit`, `razonSocial` vs `nombre`).

#### **Propuesta**:
* Reemplazar `any[]` por `Oferta[]`.
* Definir adaptadores explícitos de migración para normalizar objetos al leer/escribir en la base de datos.

---

### 1.4. Hook Unificado de Opciones de Selección (`useAppOptions`)

#### **Diagnóstico**:
Las listas de opciones (unidades de medida, condiciones IVA, tipos de factura, categorías) se consumen desde orígenes dispares ([appConfig.json](file:///d:/Federico/Repos/pwaCotizadorIeba/src/config/appConfig.json), [sampleData.ts](file:///d:/Federico/Repos/pwaCotizadorIeba/src/core/sampleData.ts) y elementos `<select>` en JSX).

#### **Propuesta**:
Crear un hook `useAppOptions()` que centralice el acceso a todas las opciones de selección, combinando la configuración de la base de datos IndexedDB con los valores por defecto del sistema.

---

### 1.5. Reemplazo de Diálogos Nativos `alert()` y `confirm()`

#### **Diagnóstico**:
Presencia de llamadas nativas al navegador (`alert('...')`, `confirm('...')`) en componentes de gestión.

#### **Propuesta**:
Implementar un sistema de notificaciones Toast/Snackbar y modales de confirmación con diseño Material Design 3 (M3) acorde a la estética PWA de la aplicación.

---

## 2. Matriz de Prioridad Recomendada

| Prioridad | Mejora | Esfuerzo | Impacto |
| :--- | :--- | :---: | :---: |
| **Alta** | Categorías de Tarea Configurables ([cambios_v1.md](file:///d:/Federico/Repos/pwaCotizadorIeba/cambios_v1.md)) | Bajo | Alto |
| **Media** | Custom Hooks `useAppConfig()` y `useAppOptions()` | Bajo | Alto |
| **Media** | Modularización de [InsumosManager.tsx](file:///d:/Federico/Repos/pwaCotizadorIeba/src/components/InsumosManager.tsx) y [PresupuestoEditor.tsx](file:///d:/Federico/Repos/pwaCotizadorIeba/src/components/PresupuestoEditor.tsx) | Medio | Muy Alto |
| **Baja** | Reemplazar `alert()` nativos por Toasts M3 | Bajo | Medio |
