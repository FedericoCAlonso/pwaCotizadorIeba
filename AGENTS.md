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

### 1.4 Motores de Dominio y Cálculo (`src/services/`, motores puros de cálculo)
- **Propósito**: Cálculos de costos, precios, insumos, sugerencias, sinergias y reglas de negocio.
- **Reglas**:
  - Deben ser **funciones puras de TypeScript** (`.ts`), 100% desacopladas de React y del ciclo de vida de componentes.
  - Deterministas y con cobertura de pruebas unitarias para todos los casos borde.

---

## 2. Estándares de Código y TypeScript

1. **Tipado Estricto**:
   - Prohibido el uso de `any` salvo excepciones técnicas debidamente justificadas.
   - Utilizar tipos e interfaces declarados en `src/types/` o en el módulo correspondiente.
2. **Seguridad frente a nulos**:
   - Uso defensivo de encadenamiento opcional (`?.`) y coalescencia nula (`??`).
   - Validar entradas y conversiones numéricas con `Number()` o validadores auxiliares para evitar `NaN`.
3. **Limpieza y Código Muerto**:
   - Prohibido dejar componentes obsoletos, funciones sin uso o archivos duplicados. Al refactorizar o reemplazar un componente, el código anterior no utilizado debe eliminarse de inmediato.
   - Conservar comentarios y documentación técnica útil que explique decisiones de arquitectura complejas.

---

## 3. Calidad de Testing y Verificación Obligatoria (Quality Gates)

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
3. **Cero Regresiones**:
   - No se aceptan cambios que rompan compatibilidad con datos existentes en IndexedDB (Dexie) ni funcionalidades en producción.
