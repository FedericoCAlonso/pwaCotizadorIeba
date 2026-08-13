# Cotizador Eléctrico IEBA — Descripción General, Arquitectura y Funcionalidades

## 1. Descripción General

**Cotizador Eléctrico IEBA** es una **PWA (Progressive Web App) independiente, Offline-First y desacoplada** diseñada específicamente para electricistas, contratistas y profesionales del rubro eléctrico (instalaciones residenciales, comerciales e industriales).

Su objetivo principal es resolver el problema central del cálculo de costos y cotización en contextos inflacionarios o de alta volatilidad de precios, permitiendo armar presupuestos precisos en minutos a través de la reutilización de datos, la centralización de parámetros de configuración y el desglose estructurado de componentes financieros.

### Características Clave de Arquitectura:
- **Offline-First & Sincronización Híbrida:** Funciona de forma 100% autónoma en el navegador/dispositivo mediante **IndexedDB** y **Dexie.js**. Cuenta con soporte de sincronización opcional a la nube mediante **Firebase / Firestore**.
- **Configuración Centralizada:** Toda la parametrización de opciones, tipos fiscal-monetarios, categorías, unidades, umbrales de vencimiento, multiplicadores de dificultad y factores de calibración está declarada de forma estructurada en un archivo de configuración maestro (`appConfig.json` y `sampleData.ts`), eliminando magic strings y valores hardcoded en los componentes de UI.
- **Inmutabilidad de Presupuestos (Snapshotting):** Al emitir o guardar un presupuesto, los precios de materiales, categorías de mano de obra y costos indirectos se "congelan" en capturas inmutables (`InsumoSnapshot`, `ManoObraSnapshot`, `CostoIndirectoSnapshot`). Esto garantiza que las actualizaciones futuras en el catálogo maestro no alteren retroactivamente los presupuestos ya emitidos.
- **Modelo Monetario Preciso:** Lógica de redondeo bancario (`roundMoney`) implementada en el motor de cálculo para evitar inconsistencias acumulativas de punto flotante IEEE 754.

---

## 2. Modelo de Costos

El sistema desglosa cada partida o cotización en capas diferenciadas para reflejar la rentabilidad real del trabajo:

$$\text{Costo Directo} = \sum (\text{Insumos}) + \sum (\text{Mano de obra interna}) + \sum (\text{Servicios Tercerizados})$$

$$\text{Costo Total Obra} = \text{Costo Directo} + \text{Costos Indirectos (Gastos Generales)}$$

$$\text{Precio de Venta (sin imp.)} = \text{Costo Total Obra} + \text{Margen de Ganancia}$$

$$\text{Precio Total} = \text{Precio de Venta} + \text{Impuestos (IVA, IIBB, etc.)}$$

---

## 3. Listado de Funcionalidades

### 3.1. Gestión y Armado de Presupuestos
- **Creación y Edición Intuitiva:** Creación de cotizaciones seleccionando tareas tipo, ítems ad-hoc sin catálogo o ítems personalizados libres.
- **Modificador por Condición de Obra:** Multiplicador dinámico por nivel de dificultad (*Normal x1.0*, *Dificultosa x1.25*, *Favorable x0.9*), alimentado desde la configuración centralizada y aplicable en vivo por ítem/partida.
- **Servicios Tercerizados Subcontratados:** Asignación de servicios de terceros con costo, validez de cotización y margen propio opcional.
- **Numeración Correlativa Automática:** Generación de código único de presupuesto (ej. `IEBA-2026-0001`) configurable por prefijo.
- **Desglose Transparente:** Muestra subtotales de insumos, mano de obra, servicios tercerizados, costos directos, costos indirectos, ganancia neta e impuestos.
- **Duplicación de Presupuestos:** Permite utilizar un presupuesto previo como plantilla para nuevos trabajos.
- **Gestión de Estados:** Seguimiento del ciclo de vida del presupuesto (*Borrador*, *Enviado*, *Aprobado*, *Rechazado*, *Vencido*), desacoplado mediante `ESTADOS_PRESUPUESTO`.
- **Notas y Condicionado:** Inclusión de notas internas (privadas) y notas dirigidas al cliente (visibles en el PDF).

### 3.2. Catálogo de Insumos (Materiales) y Gestión de Vencimientos
- **Gestión de Insumos:** Registro de materiales con nombre, marca, modelo, unidad de medida (`m`, `u`, `kg`, etc.), categoría y código de proveedor.
- **Semáforo de Vencimiento de Precios:** Badge visual de antigüedad (*Verde*: $\le 30$ días, *Amarillo*: $31-60$ días, *Rojo*: $> 60$ días sin actualizar) parametrizable desde la configuración de la empresa.
- **Marca de Cotización Directa (Excepción):** Flag (`requiereCotizacionDirecta`) para materiales especiales (ej. tableros a medida o grupos electrógenos) exceptuados automáticamente de aumentos masivos por fórmula.
- **Aumento por Índice de Referencia:** Incrementos masivos guiados por Dólar Blue/Oficial, IPC o Canasta Eléctrica registradas en el historial de precios versionado (`TIPOS_AJUSTE_PRECIO`).
- **Ítems Ad-Hoc (No Catalogados):** Creación de ítems especiales de única vez dentro de un presupuesto con inmutabilidad congelada sin alterar el catálogo maestro.
- **Historial de Precios Versionado:** Registro temporal de variaciones de precio por insumo con fecha, fuente e índice de referencia.
- **Ofertas por Proveedor:** Carga de múltiples cotizaciones/ofertas de proveedores para un mismo insumo.
- **Escáner de Código de Barras / QR:** Lectura mediante la cámara del dispositivo (`html5-qrcode`).
- **Importación y Exportación Masiva:** Carga masiva mediante archivos CSV/Excel.

### 3.3. Categorías de Mano de Obra y Calibración EMA
- **Tarifario por Categoría:** Definición del costo real por hora según el perfil técnico (*Oficial Electricista*, *Ayudante*, *Técnico DCI*, *Especialista en Tableros*, etc.).
- **Calibración de Mano de Obra por EMA:** Factor de corrección por Media Móvil Exponencial ($\alpha = 0.3$ por defecto, configurable) que recalcula automáticamente las horas estimadas de las Tareas Tipo en función de las horas reales registradas.
- **Motivo de Desvío:** Registro informativo de desvíos parametrizados (`MOTIVOS_DESVIO`: *Material*, *Diseño/Cliente*, *Clima*, *Error de cálculo*, *Otro*).
- **Indicador de Dispersión:** Muestra en tiempo real de ratio mínimo, máximo y desvío estándar de ejecuciones por tarea.

### 3.4. Costos Indirectos y Gastos Generales
- **Prorrateo de Gastos Fijos y Estructura:** Configuración de costos indirectos aplicables a las obras (`TIPOS_COSTO_INDIRECTO`: *Porcentual sobre costo directo*, *Fijo mensual*, *Por visita/traslado*).
- **Selección y Snapshot por Presupuesto:** Posibilidad de activar o desactivar costos indirectos específicos y congelar su valor exacto al momento de emitir la cotización.

### 3.5. Tareas Tipo (Ensambles Reutilizables)
- **Kits/Ensamble de Trabajo:** Creación de plantillas estandarizadas (*"Punto de luz completo"*, *"Boca TUG 20A"*, *"Tablero seccional 12 módulos"*).
- **Factor EMA & Dispersión:** Muestra de factor acumulado y varianza histórica de ejecución.
- **Sustento Normativo:** Campo para incluir notas técnicas y referencias a reglamentaciones (ej. Norma AEA 90364).

### 3.6. Servicios Tercerizados (Subcontrataciones)
- **Modelado de Subcontratos:** Entidad propia `ServicioTercerizado` vinculada a partidas.
- **Clasificación de Proveedores:** Clasificación en `TIPOS_PROVEEDOR` (*Materiales*, *Servicios* o *Ambos*).
- **Margen Propio:** Posibilidad de aplicar un margen sobre el servicio tercerizado distinto al margen general de la obra.

### 3.7. Esquema de Pagos e Hitos Financieros
- **Estructuración del Cobro:** Definición de `MODALIDADES_PAGO` (*Pago Único*, *Adelanto + Saldo*, *Certificados de Avance*, *Cuotas*).
- **Desglose de Hitos:** Configuración de anticipos, entregas intermedias contra certificación y retención de fondo de reparo.
- **Medios de Pago Esperados:** Registro de condiciones mediante `MEDIOS_PAGO` (*Efectivo*, *Transferencia*, *Cheque*, *Otro*).

### 3.8. Gestión de Clientes y Proveedores
- **Directorio de Clientes:** Ficha de cliente con nombre, CUIT/DNI, condición IVA (`CONDICIONES_IVA`), teléfono, email y dirección.
- **Directorio de Proveedores:** Agenda de proveedores de materiales y subcontratistas de servicios.

### 3.9. Control y Registro de Trabajo Real
- **Carga de Horas Reales:** Registro diario/posterior de horas ejecutadas por tarea tipo.
- **Calificación de Condiciones de Obra:** Evaluación (*Normal*, *Dificultosa*, *Favorable*).

### 3.10. Salida Profesional y Exportación (PDF)
- **Generación de PDF Profesional:** Impresión / exportación directa desde el navegador utilizando `jsPDF` y `html2canvas`.
- **Desglose de Subcontratos:** Inclusión de servicios tercerizados y desglose transparente de condiciones comercializables.

### 3.11. Referencia Multimoneda Informativa
- **Referencia Extranjera:** Conversión informativa opcional del presupuesto a una moneda de referencia (ej. USD Blue / USD Oficial) con cotización configurable.

### 3.12. Personalización y Apariencia
- **Soporte Dark Mode / Light Mode:** Cambio dinámico de tema visual (Claro, Oscuro o Automático según el sistema).
- **Configuración Centralizada:** Ajuste del peso $\alpha$ de calibración EMA, umbrales de vencimiento de precios (días verde / días amarillo), impuesto IVA/IIBB, datos corporativos y moneda de referencia.

---

## 4. Estructura de Configuración y Código Limpio

La aplicación implementa un patrón de **Configuración Centralizada y Fuertemente Tipada**:

- **Archivo JSON Maestro (`src/config/appConfig.json`):** Define el catálogo por defecto de listas elegibles (`categories`, `units`, `condicionesIVA`, `tiposFactura`, `estadosPresupuesto`, `estadosRegistroTrabajo`, `condicionesTrabajo`, `motivosDesvio`, `tiposProveedor`, `tiposCostoIndirecto`, `mediosPago`, `modalidadesPago`, `tiposAjustePrecio`) y la configuración base de la empresa (`defaultAppConfig`).
- **Módulo de Muestras y Exportación de Configuración (`src/core/sampleData.ts`):** Exporta constantes fuertemente tipadas (`DEFAULT_APP_CONFIG`, `CONDICIONES_TRABAJO`, `MOTIVOS_DESVIO`, `TIPOS_PROVEEDOR`, `TIPOS_COSTO_INDIRECTO`, `MEDIOS_PAGO`, `MODALIDADES_PAGO`, `TIPOS_AJUSTE_PRECIO`) que son consumidas homogéneamente por todos los componentes de interfaz de usuario.
- **Cero Magic Strings:** Eliminación total de arreglos y literales duplicados en componentes de UI, permitiendo modificar u ordenar opciones desde el archivo de configuración.

---

## 5. Tecnologías Utilizadas

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS.
- **Iconografía:** Lucide React.
- **Base de Datos Local & Offline:** IndexedDB mediante Dexie.js + Dexie React Hooks.
- **Sincronización Nube:** Firebase / Firestore SDK.
- **PDF & Canvas:** jsPDF, html2canvas.
- **Lectura de Códigos:** html5-qrcode.
- **Testing & Cobertura:** Vitest (Suite automatizada para motor de cálculo `calculations.test.ts`).
