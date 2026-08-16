# Plan de Modificación: Categorías de Trabajo/Tarea Configurables

## 1. Diagnóstico y Objetivo

Actualmente la constante `CATEGORIA_TAREA` está hardcodeada en el archivo [types.ts](file:///d:/Federico/Repos/pwaCotizadorIeba/src/core/types.ts). Dado que cada electricista o empresa opera en nichos distintos (viviendas, industrias, energías renovables, redes), las categorías de trabajos deben ser totalmente configurables.

El objetivo es trasladar la definición de categorías al archivo global de configuración ([appConfig.json](file:///d:/Federico/Repos/pwaCotizadorIeba/src/config/appConfig.json)) y a la base de datos IndexedDB (`db.config`), permitiendo agregar, editar, eliminar y restaurar categorías desde la interfaz del sistema.

---

## 2. Cambios Propuestos por Componente

### 2.1 Modelo de Datos & Configuración

1. **[types.ts](file:///d:/Federico/Repos/pwaCotizadorIeba/src/core/types.ts)**:
   - Añadir la propiedad `categoriasTarea?: string[]` a la interfaz `AppConfig`.
   - Remover/deprecar la constante fija `CATEGORIA_TAREA`.

2. **[appConfig.json](file:///d:/Federico/Repos/pwaCotizadorIeba/src/config/appConfig.json)**:
   - Agregar el listado por defecto `"categoriasTarea": ["Bocas", "Circuitos", "Tableros", "Acometidas", "Medición"]` tanto en el objeto raíz como en `defaultAppConfig`.

3. **[sampleData.ts](file:///d:/Federico/Repos/pwaCotizadorIeba/src/core/sampleData.ts)**:
   - Exportar `BASE_TAREA_CATEGORIES: string[]` cargado desde la configuración por defecto.

---

### 2.2 Interfaz de Usuario & Administración

1. **[ConfigModal.tsx](file:///d:/Federico/Repos/pwaCotizadorIeba/src/components/ConfigModal.tsx)**:
   - Incluir una sección para gestionar las categorías de tareas/trabajos.
   - Permitir al usuario:
     - Ver las categorías actuales.
     - Agregar una nueva categoría personalizada.
     - Editar/Renombrar una categoría existente.
     - Eliminar categorías no utilizadas.
     - Restaurar las categorías por defecto de fábrica.

2. **[TareasTipoManager.tsx](file:///d:/Federico/Repos/pwaCotizadorIeba/src/components/TareasTipoManager.tsx)**:
   - Reemplazar la constante estática por la lectura dinámica de `config?.categoriasTarea || BASE_TAREA_CATEGORIES`.
   - Actualizar los filtros de búsqueda y los formularios modal de creación/edición de plantillas.

3. **[SaveAsTareaTipoModal.tsx](file:///d:/Federico/Repos/pwaCotizadorIeba/src/components/SaveAsTareaTipoModal.tsx)**:
   - Consultar en tiempo real la configuración almacenada en IndexedDB para popular el selector de categorías al guardar un trabajo como plantilla.

---

## 3. Plan de Verificación

- **Compilación**: Ejecutar chequeo de tipos para asegurar que no queden referencias a la constante removida.
- **Pruebas Funcionales**:
  1. Verificar que al abrir la app se muestren las categorías por defecto.
  2. Crear una nueva categoría desde el modal de configuración (ej: `"Solar / Fotovoltaica"`).
  3. Comprobar que aparezca en el diseñador de tareas tipo y en el modal de guardado de plantillas.
  4. Modificar y eliminar una categoría y verificar la persistencia de cambios al recargar.
