# **Plan de Reestructuración — Fase 3: Entradas, Salidas y Flujos de Carga Ágil**

## **Contexto y Objetivo**

Habiendo resuelto la arquitectura base (Fase 1), la usabilidad móvil (Fase 2), y contando ya con backup JSON y generación de PDF, esta **Fase 3** se enfoca en la interoperabilidad de datos y la velocidad de operación desde teclado. El objetivo es permitir la carga masiva desde Excel de proveedores (creación y actualización), compartir documentos sin fricción, y habilitar un modo de "Carga Continua" 100% por teclado.  
*Instrucción para el agente de IA:* Implementar estos componentes maximizando el uso de APIs nativas del navegador y flujos sin fricción, manteniendo la dependencia de librerías al mínimo (utilizando SheetJS para Excel).

## ---

**1\. Flujo de Carga Continua (Keyboard-First)**

> * **Propósito:** Permitir la carga de decenas de ítems (Alta Rápida, o detalle de presupuesto) sin quitar las manos del teclado.  
> * **Comportamiento esperado:**  
  * Navegación natural con Tab entre los campos del formulario.  
  * Al presionar Enter en el último campo (o en cualquier momento si los campos obligatorios están completos), el sistema **guarda el registro actual, limpia el formulario e inmediatamente hace foco (autofocus) en el primer campo** para ingresar el siguiente ítem.  
  * Debe existir un toggle o checkbox visual (ej. "Modo Carga Continua") para activar/desactivar este comportamiento, evitando cierres accidentales del modal/formulario en flujos normales.  
> * **Implementación técnica:** Manejo de eventos onKeyDown para capturar la tecla Enter, prevenir el comportamiento por defecto (submit que recarga o cierra el modal), ejecutar la función de guardado asíncrono y aplicar un ref.current.focus() al input inicial.

## ---

**2\. Importación Inteligente de Catálogos (XLSX / CSV)**

> * **Propósito:** Cargar catálogos completos (Materiales, Productos, Ofertas) o actualizar listas de precios directamente desde los archivos que envían los proveedores.  
> * **2.1 Asistente de Mapeo de Columnas (Column Mapper):**  
  * Al subir un archivo, el sistema extrae la primera fila (cabeceras).  
  * Se presenta una UI donde el usuario empareja los campos del sistema con las columnas del Excel (ej. *Material \-\> Columna "Descrip", Precio \-\> Columna "Precio Final"*).  
> * **2.2 Pantalla de Previsualización (Dry-Run):**  
  * Antes de escribir en la base de datos local (IndexedDB), el sistema procesa el Excel en memoria basándose en el mapeo.  
  * Muestra un resumen de impacto: *"Se crearán X Materiales, Y Productos, Z Ofertas. W filas ignoradas por falta de datos requeridos."*  
  * El usuario debe confirmar explícitamente la operación para volcar los datos.

## ---

**3\. Integraciones Nativas Web (Cero Dependencias)**

> * **3.1 Agenda Nativa (Web Contact Picker API):**  
  * En los formularios de creación de Cliente o Proveedor, agregar un botón "Importar de contactos".  
  * Utilizar navigator.contacts.select(\['name', 'tel', 'email'\]) (soportado en móviles) para abrir la agenda del teléfono, seleccionar un contacto y autocompletar los inputs de Nombre y Teléfono.  
  * Incluir fallback grácil (ocultar botón o mostrar aviso) en navegadores de escritorio que no soporten la API.  
> * **3.2 Compartir Directo (Web Share API):**  
  * En la vista de un presupuesto emitido, reemplazar/complementar la descarga pasiva con un botón "Compartir" utilizando navigator.share({ title, text, files }).  
  * Esto abre el modal nativo del sistema operativo (iOS/Android) permitiendo enviar el PDF o el XLSX directamente a WhatsApp, Telegram o correo electrónico, eliminando el paso de ir a la carpeta de descargas.

## ---

**4\. Exportación de Presupuestos (Interoperabilidad)**

> * **XLSX Aplanado:** Función para exportar un presupuesto emitido en formato tabla de Excel.  
> * Estructura simple: *Ítem, Descripción, Cantidad, Unidad, Precio Unitario, Subtotal*.  
> * Ideal para entregar a arquitectos o contratistas principales que integran el presupuesto en plantillas generales de dirección de obra.

## ---

**Orden de Ejecución Sugerido para el Agente**

| Paso | Módulo | Detalle de Tarea   |
| :---- | :---- | :---- |
| **1** | Modo Carga Continua | Implementar control de teclado (Tab/Enter), reset de form y autofocus en modales de alta. |
| **2** | APIs Nativas Web | Implementar navigator.share para presupuestos y navigator.contacts para proveedores/clientes. |
| **3** | Exportación Presupuesto | Usar SheetJS para generar el XLSX aplanado del presupuesto (adicional al PDF). |
| **4** | Importador Inteligente | Desarrollar el lector de XLSX, la UI de mapeo de columnas y la previsualización antes de guardar en IndexedDB. |

