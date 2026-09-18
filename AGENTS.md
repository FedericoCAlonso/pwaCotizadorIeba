# Normas de Calidad, Arquitectura y Directivas del Proyecto (Cotizador IEBA)

Este documento define las directivas y normas de ingeniería de software obligatorias para todo agente de IA y desarrollador que opere en este repositorio. Cualquier cambio, refactorización o nueva funcionalidad debe apegarse estrictamente a estos principios.

---

## 1. Arquitectura de Software: MVVM Estricto y Separación de Responsabilidades

El proyecto sigue una arquitectura desacoplada basada en el patrón **Model-View-ViewModel (MVVM)**:

### 1.1 Vistas (Views - Archivos `.tsx` en `src/components/` o `src/views/`)
- **Propósito único**: Renderizar interfaz de usuario (UI), capturar eventos de usuario y enlazar propiedades del ViewModel.
- **Reglas**:
  - **PROHIBIDO** incluir lógica de negocio pesada, algoritmos de cálculo de costos/presupuestos o cálculos matemáticos complejos en línea dentro del JSX.
  - **PROHIBIDO** realizar llamadas directas a la base de datos (Dexie) o almacenamiento desde componentes de presentación cuando exista un ViewModel o servicio que deba gestionarlo.
  - **Límite de tamaño**: Ningún componente de vista debe exceder las **400 - 500 líneas de código (LOC)**. Si un componente supera ese límite, debe modularizarse de inmediato.

### 1.2 Modularización Obligatoria de Componentes UI
Cuando un componente crezca o tenga múltiples responsabilidades visuales, aplicar la siguiente descomposición por submódulos:
- **Modales y Diálogos**: Deben extraerse a componentes satélite dedicados (`*Modals.tsx`, `*Dialog.tsx`).
- **Formularios Multi-Pestaña o Secciones Complejas**: Cada pestaña o grupo de campos debe residir en su propio subcomponente (`*Tab.tsx`, `*Section.tsx`).
- **Filas de Tablas / Listas Complejas**: Acordeones, desgloses o sub-paneles deben separarse en subcomponentes dedicados (`Item*Section.tsx`, `*Row.tsx`).
- **Barras de Herramientas y Acciones Flotantes**: Extraer en componentes dedicados (`*Toolbar.tsx`, `*SpeedDial.tsx`).

### 1.3 ViewModels y Hooks de Lógica (`src/viewmodels/use*ViewModel.ts`)
- **Propósito**: Orquestar el estado de la vista, exponer datos formateados y controladores de eventos (`handle*`, `on*`).
- **Reglas**:
  - No deben contener código JSX ni manipulación directa del DOM.
  - Deben ser testeables de forma aislada mediante `@testing-library/react` (`renderHook`) o Vitest.
  - Encapsular operaciones sobre listas, filtros, ordenamientos y llamadas a la capa de persistencia.
  - **PROHIBIDO** incrustar lógica de generación o exportación masiva de documentos (Excel, PDF) directamente en el ViewModel; deben delegarse a los motores especializados en `src/core/exportUtils.ts` o `src/core/pdfExportUtils.ts`.

### 1.4 Motores de Dominio y Cálculo (`src/core/calculations.ts`, `src/services/`, motores puros)
- **Propósito**: Cálculos de costos, precios, insumos, sugerencias, sinergias y reglas de negocio.
- **Reglas**:
  - Deben ser **funciones puras de TypeScript** (`.ts`), 100% desacopladas de React y del ciclo de vida de componentes.
  - Deterministas y con cobertura de pruebas unitarias para todos los casos borde.

---

## 2. Principios de Calidad de Software SOLID

El código debe adherir a los cinco principios SOLID de manera continua en todas las capas del sistema:

### 2.1 S - Single Responsibility Principle (SRP - Responsabilidad Única)
- Cada módulo, clase, función o hook debe tener una sola razón para cambiar y una responsabilidad bien delimitada.
- **Capa de Base de Datos (`src/db/database.ts`)**: Su responsabilidad exclusiva es definir esquemas, tablas, hooks globales y semillero inicial. Está **PROHIBIDO** incluir utilidades de parsing de archivos (CSV, XLSX) o lógicas ajenas a la persistencia en `database.ts`.
- **Capa de Exportación (`src/core/exportUtils.ts`, `pdfExportUtils.ts`)**: Es la única encargada de formatear y generar archivos binarios/documentos (Excel, PDF, CSV). Las vistas y ViewModels deben invocar estas funciones sin cargar librerías pesadas directamente.
- **Code-Splitting y Dynamic Imports**: Utilizar importación dinámica (`await import('exceljs')`, etc.) en motores de exportación para no inflar el bundle principal.

### 2.2 O - Open/Closed Principle (OCP - Abierto para Extensión, Cerrado para Modificación)
- El sistema debe permitir extender funcionalidades sin modificar las clases o motores centrales existentes.
- **Patrón Registro**: En subsistemas extensibles (como proveedores de sincronización, motores de búsqueda de precios o calculadoras específicas), utilizar registros desacoplados (`ISyncProviderRegistry`, `SyncProviderRegistry`) en lugar de `switch` hardcodeados o constructores fijos.
- Para agregar un nuevo proveedor o plugin, basta con implementar su interfaz correspondiente y registrarlo en el registry.

### 2.3 L - Liskov Substitution Principle (LSP - Sustitución de Liskov)
- Cualquier implementación de una interfaz o contrato (ej. `SyncProvider`) debe poder reemplazar a la abstracción base sin alterar el comportamiento esperado ni introducir efectos secundarios indeseados.
- Los métodos contractuales (`connect()`, `readMasterPayload()`, `writeMasterPayload()`, etc.) deben respetar fielmente las precondiciones, poscondiciones y contratos asíncronos definidos por la interfaz base.

### 2.4 I - Interface Segregation Principle (ISP - Segregación de Interfaces)
- Ningún consumidor debe ser forzado a depender de métodos o propiedades que no utiliza.
- Diseñar interfaces pequeñas y cohesivas. Si una capacidad es opcional o específica de ciertos adaptadores (como la gestión de tokens OAuth en proveedores en la nube), debe crearse una interfaz segregada y específica (ej. `TokenAuthenticableSyncProvider`) en lugar de inflar la interfaz general forzando métodos vacíos o excepciones.

### 2.5 D - Dependency Inversion Principle (DIP - Inversión de Dependencias)
- Los módulos de alto nivel (orquestadores de sincronización, servicios del negocio) no deben depender directamente de implementaciones concretas de bajo nivel; ambos deben depender de abstracciones (interfaces).
- Las dependencias deben inyectarse mediante constructores, fábricas o registries (`constructor(registry: ISyncProviderRegistry = defaultRegistry)`), facilitando la testabilidad unitaria mediante mocks y eliminando el acoplamiento rígido.

---

## 3. Estándares de Código, Limpieza y Tolerancia Cero al Código Muerto

1. **Tipado Estricto**:
   - Prohibido el uso de `any` salvo excepciones técnicas debidamente justificadas.
   - Utilizar tipos e interfaces declarados en `src/types/` o en el módulo correspondiente.
2. **Seguridad frente a nulos**:
   - Uso defensivo de encadenamiento opcional (`?.`) y coalescencia nula (`??`).
   - Validar entradas y conversiones numéricas con `Number()` o validadores auxiliares (`safeNum()`) para evitar `NaN`.
3. **Tolerancia Cero a Código Muerto, Inservible o Contradictorio**:
   - Al refactorizar o reemplazar un componente, vista, función o servicio, el código anterior obsoleto DEBE eliminarse de inmediato en la misma entrega.
   - **PROHIBIDO** dejar archivos huérfanos sin importar en el árbol de dependencias de la aplicación.
   - **PROHIBIDO** dejar funciones, variables o importaciones sin uso que incrementen el bundle o la carga cognitiva.
   - **PROHIBIDO** mantener lógicas contradictorias que calculen precios, redondeos o sincronizaciones de formas divergentes.
   - Conservar comentarios y documentación técnica útil que explique decisiones de arquitectura complejas.

---

## 4. Calidad de Testing y Verificación Obligatoria (Quality Gates)

Antes de dar por finalizada cualquier modificación o entrega:
1. **Ejecutar Tests Unitarios**:
   ```bash
   npm test
   ```
   - El 100% de la suite de pruebas debe pasar satisfactoriamente (`0` fallos).
   - Cualquier nueva funcionalidad o ViewModel debe acompañarse de sus correspondientes pruebas unitarias (`*.test.ts` o `*.test.tsx`).
2. **Ejecutar Verificación de Compilación y Tipos**:
   ```bash
   npm run build
   ```
   - Debe compilar sin errores de TypeScript (`tsc`) y generar el bundle de Vite con código de salida `0`.
   - Verificar la ausencia de advertencias de imports dinámicos inefectivos (`[INEFFECTIVE_DYNAMIC_IMPORT]`).
3. **Cero Regresiones**:
   - No se aceptan cambios que rompan compatibilidad con datos existentes en IndexedDB (Dexie) ni funcionalidades en producción.
