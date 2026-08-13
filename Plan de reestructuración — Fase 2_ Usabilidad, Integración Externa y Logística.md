# **Plan de Reestructuración — Fase 2: Usabilidad, Integración Externa y Logística**

## **Contexto y Objetivo**

Con la Fase 1 en marcha (reestructuración del catálogo en el esquema de tres niveles Materiales, Productos y Ofertas, más las Solicitudes de Cotización), esta **Fase 2** abarca las mejoras de usabilidad en obra, la optimización para dispositivos móviles, la integración ligera con referencias externas de mercado y el módulo de logística/alertas del Cotizador Eléctrico IEBA.  
*Instrucción para el agente de IA:* Implementar los componentes y flujos de esta fase manteniendo la arquitectura desacoplada, 100% offline-first con Dexie/IndexedDB y sin dependencias de backend ni APIs externas complejas.

## ---

**1\. Usabilidad Móvil y Carga Ágil (Optimización para Obra)**

### **1.1 Modo "Alta Rápida" (Ficha Incompleta)**

> * **Propósito:** Permitir dar de alta materiales o productos en segundos desde el celular estando en obra o sobre una escalera, postergando la catalogación normativa formal.  
> * **Campos del formulario de Alta Rápida:**  
  * nombre (texto libre, obligatorio)  
  * unidadVenta (selector rápido: m, u, rollo x100m, etc.)  
  * precio y proveedorId (opcionales)  
> * **Comportamiento del sistema:**  
  * Se crea el Material (y opcionalmente el Producto / Oferta) asignando automáticamente el flag fichaIncompleta: true.  
  * El ítem queda inmediatamente disponible para usarse en presupuestos en curso.  
  * En la pantalla de catálogo, los ítems con fichaIncompleta: true muestran una etiqueta/badge de aviso ("Pendiente de completar") y un filtro rápido para revisarlos y categorizarlos más tarde desde la computadora.

### **1.2 Smart Autocomplete por Frecuencia y Recienticidad de Uso**

> * Los selectores de materiales, productos y tareas tipo no deben ordenar únicamente por orden alfabético.  
> * Implementar un índice de uso que incremente un contador frecuenciaUso y actualice ultimoUsoFecha cada vez que se selecciona un ítem en un presupuesto.  
> * El autocompletado ordenará los resultados priorizando: 1º Frecuencia/Recienticidad, 2º Coincidencia de texto alfabética.

### **1.3 UI Tactil: Steppers, Inputmode y Favorites Bar**

> * **Inputs numéricos:** Forzar la propiedad inputmode="decimal" en todos los campos de cantidades y precios para desplegar automáticamente el teclado numérico cómodo en iOS y Android.  
> * **Steppers táctiles:** Botones grandes de incremento/decremento (+ y \-) con área de toque adecuada para pulgar (≥ 48px).  
> * **Favorites Bar (Accesos Directos):** Bloque superior desplegable en el armador de presupuestos con los 6 o 8 materiales/tareas más utilizados por el profesional (ej. *Cable unipolar 1.5mm²*, *Térmica 16A*, *Caja rectangular*, *Toma doble*), permitiendo agregarlos a la cotización con un solo toque.

### **1.4 Duplicación Rápida**

> * Acción "Crear similar a..." presente en las vistas de Material, Producto, TareaTipo y Presupuesto, que clona la estructura precargando el formulario para su edición rápida.

## ---

**2\. Integración Ligera con Mercado Libre (Referencia de Precios)**

### **2.1 Botón de Búsqueda Externa**

> * **No se utiliza la API oficial de Mercado Libre** (evita flujos OAuth, filtrados erróneos por región o publicaciones no normalizadas).  
> * En la ficha de detalle de cada Material o Producto, agregar el botón: **"Buscar referencia en Mercado Libre"**.  
> * **Funcionamiento:** Genera dinámicamente la URL y la abre en una nueva pestaña del navegador:  
>   `https://listado.mercadolibre.com.ar/${encodeURIComponent(queryBusqueda)}`Donde queryBusqueda toma el nombre canónico del Material o la combinación marca \+ modelo del Producto.  
> * **Soporte para enlace directo opcional:** En la entidad Producto, agregar el campo opcional urlMercadoLibre?: string. Si el usuario guardó una URL específica de una publicación que suele monitorear, el botón abrirá directamente esa publicación puntual.

## ---

**3\. Módulo de Logística: Lista de Compras Agregada por Proveedor**

### **3.1 Consolidación de Insumos**

> * **Entrada:** Uno o varios presupuestos seleccionados (por ejemplo, presupuestos en estado *Aprobado* o *En Ejecución*).  
> * **Proceso:**  
  1. Extraer todos los ítems de los presupuestos seleccionados.  
  2. Multiplicar las cantidades individuales por la cantidad de tareas/unidades de la obra.  
  3. Agrupar los ítems por materialId / productoId para obtener el total consolidado de materiales a comprar.  
  4. Clasificar cada grupo según el proveedorId de la Oferta seleccionada o el proveedor preferido asignado al producto.  
> * **Salida:** Vista organizada por Proveedor con la lista de insumos totales a pedir (ej. *Proveedor A: 300m Cable 2.5mm², 10 Térmicas 16A / Proveedor B: 5 Gabinetes 12 módulos*).  
> * **Acción rápida:** Botón para generar la orden en texto plano y enviarla directamente por WhatsApp o Email utilizando los deep links del proveedor.

## ---

**4\. Banderas de Estado, Alertas de Margen y Descontinuados**

### **4.1 Materiales Obsoletos / Discontinuados**

> * Se utiliza el campo booleano activo: boolean definido en el esquema de Material y Producto.  
> * Si activo \=== false:  
  * El ítem \*\*NO\*\* aparece en las búsquedas ni en los selectores al armar presupuestos nuevos.  
  * El ítem \*\*SÍ\*\* se conserva intacto en la base de datos para no romper la integridad de presupuestos históricos o reportes pasados.

### **4.2 Alerta de Margen Bajo (Rentabilidad Controlada)**

> * En la configuración de la empresa (appConfig.json / defaultAppConfig), agregar el parámetro:  
>   `umbralMargenMinimoAdvertencia: 20 // Porcentaje configurable (default: 20%)`  
> * Al calcular el presupuesto (calculations.ts), evaluar la relación entre el Costo Total Obra y el Precio de Venta.  
> * Si el margen neto efectivo cae por debajo del umbral configurado (debido a descuentos manuales, ajustes de dificultad o suba de costos directos), mostrar una advertencia visual (banner/warning en amarillo/rojo) en el resumen del presupuesto antes de emitir o exportar el PDF.

## ---

**5\. Estrategia de Sincronización Firestore (Multi-dispositivo / Offline)**

### **5.1 Regla de Resolución de Conflictos**

> * La estrategia oficial para la sincronización entre IndexedDB (Dexie) y Firebase Firestore será \*\*Last-Write-Wins (LWW)\*\* basada en timestamps UTC a nivel de documento.  
> * Cada entidad mantendrá los campos:  
>   `createdAt: string // ISO Timestamp UTC`  
>   `updatedAt: string // ISO Timestamp UTC`  
> * Al sincronizar, si existe conflicto entre el registro local y la nube, prevalecerá el registro con el updatedAt más reciente, evitando ventanas de diálogo complejas de merge manual.

## ---

**Orden de Ejecución Sugerido para el Agente**

| Paso | Módulo / Pantalla | Detalle de Tarea   |
| :---- | :---- | :---- |
| **1** | UI / Formulario de Materiales | Implementar flag fichaIncompleta, formulario de Alta Rápida de 3 campos y badge visual. |
| **2** | UI / Inputs & Steppers | Aplicar inputmode="decimal", steppers táctiles grandes y Favorites Bar en el armador de presupuestos. |
| **3** | Búsqueda ML | Agregar botón "Buscar referencia en Mercado Libre" en ficha de Material/Producto con URL codificada y campo urlMercadoLibre opcional. |
| **4** | Lógica / Autocomplete | Agregar índice de frecuencia de uso (frecuenciaUso, ultimoUsoFecha) en selectores. |
| **5** | Módulo de Logística | Crear vista de Lista de Compras Consolidada agrupada por Proveedor a partir de presupuestos seleccionados. |
| **6** | Motor de Cálculo / Config | Agregar umbralMargenMinimoAdvertencia en config y aviso visual de margen bajo en el presupuesto. |
| **7** | Sync / Firestore | Asegurar timestamps updatedAt UTC en todas las entidades para resolución de conflictos por Last-Write-Wins. |

