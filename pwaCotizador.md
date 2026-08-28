# Cotizador Eléctrico IEBA — Descripción General, Arquitectura y Funcionalidades

## 1. Descripción General

**Cotizador Eléctrico IEBA** es una **Progressive Web App (PWA) Offline-First, desacoplada y de alta precisión** diseñada para electricistas matriculados, contratistas, ingenieros y profesionales del sector electromecánico (instalaciones residenciales, comerciales, industriales y servicios técnicos especializados).

Su objetivo primordial es resolver los desafíos de cómputo métrico, análisis de precios unitarios (APU), costeo de mano de obra y emisión de cotizaciones formales en contextos de alta volatilidad inflacionaria y dispersión de precios. Permite estructurar presupuestos confiables y detallados en cuestión de minutos mediante la reutilización de ensambles técnicos, la parametrización matemática de tareas, la gestión de logística de compras y el desglose de márgenes comerciales.

### Principios Fundamentales de Diseño:
- **100% Offline-First con Sincronización Híbrida Multi-Proveedor:** Opera de manera completamente autónoma sin conexión a Internet utilizando **IndexedDB** a través de **Dexie.js (Schema v6)**. Ofrece sincronización descentralizada mediante el sistema de archivos local (**File System Access API**), **Google Drive**, exportación/importación **JSON**, y sincronización opcional a la nube mediante **Firebase / Firestore** con control de cuota (*Circuit Breaker*).
- **Arquitectura MVVM Desacoplada:** Clara separación entre la capa de presentación (React + Tailwind CSS M3), los controladores de estado y lógica de vista (*ViewModels*), los servicios de datos y el motor central de cálculo puro (*Core Calculations & Math Engine*).
- **Modelo Técnico Desglosado en Tres Capas:** Separación explícita entre la ficha técnico-normativa sin marca ni precio (`Material`), la versión comercial de mercado (`Producto`) y las cotizaciones puntuales por distribuidor (`Oferta`).
- **Ensambles Paramétricos y Motor Matemático Seguro:** Modelado de Tareas Tipo mediante parámetros de entrada, variables intermedias en cascada y fórmulas matemáticas/lógicas evaluadas por un parser AST seguro sin recurrir a `eval()` o `Function()`.
- **Análisis de Precios Unitarios (APU) y Gastos Focalizados:** Prorrateo riguroso de Gastos Generales (absolutos y porcentuales) a nivel global o por capítulo de obra, determinando el Coeficiente de Pase ($K$) y el precio de venta unitario cerrado de cada ítem.
- **Inmutabilidad de Presupuestos (Snapshotting):** Al emitir o guardar un presupuesto, los precios de materiales, tarifas de mano de obra y costos indirectos se congelan en estructuras inmutables (`InsumoSnapshot`, `ManoObraSnapshot`, `CostoIndirectoSnapshot`), impidiendo que variaciones futuras en el catálogo alteren cotizaciones ya presentadas.
- **Aritmética Monetaria Precisa:** Funciones de redondeo bancario (`roundMoney`) en todas las capas del motor financiero para evitar errores acumulativos de punto flotante IEEE 754.
- **Navegación Móvil Nativa PWA:** Pila unificada de retroceso (*Back Stack*) que captura el botón físico/gesto de retroceso de Android, gestiona modales anidados y previene salidas accidentales de la aplicación con doble toque de confirmación.

---

## 2. Arquitectura del Sistema

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             VISTA (React 18)                             │
│   Presupuestos · Insumos · Mano de Obra · Tareas Tipo · Contactos · Logística  │
│   Componentes UI (Material Design 3) · Modales Anidados · FormulaInput  │
└────────────────────────────────────▲─────────────────────────────────────┘
                                     │ (Hooks / Observables)
┌────────────────────────────────────▼─────────────────────────────────────┐
│                       VIEWMODELS (Capa de Aplicación)                    │
│   usePresupuestoEditorViewModel    │   usePresupuestoDetailViewModel     │
│   useTareasTipoViewModel           │   useInsumosManagerViewModel        │
│   useConfigViewModel               │   usePwaBackNavigation             │
└────────────────────────────────────▲─────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼─────────────────────────────────────┐
│                    CORE MOTOR & LÓGICA DE DOMINIO                         │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────┐  │
│  │ calculations.ts      │  │ mathEvaluator.ts     │  │ material       │  │
│  │ (APU, Sinergia,      │  │ (AST Parser, Ternario│  │ Matching.ts    │  │
│  │  K, Impuestos, EMA)  │  │  y Funciones)        │  │ (Filtros DCI)  │  │
│  └──────────────────────┘  └──────────────────────┘  └────────────────┘  │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────┐  │
│  │ pdfExportUtils.ts    │  │ exportUtils.ts       │  │ modalBackStack │  │
│  │ (jsPDF Vectorial A4) │  │ (ExcelJS Multihoja)  │  │ (Hardware Nav) │  │
│  └──────────────────────┘  └──────────────────────┘  └────────────────┘  │
└────────────────────────────────────▲─────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼─────────────────────────────────────┐
│                  PERSISTENCIA & SINCRONIZACIÓN HÍBRIDA                   │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Dexie.js (Schema v6) — IndexedDB Local                             │  │
│  │ (Soft Deletes / Tombstones · Timestamps _updatedAt · Transacciones) │  │
│  └─────────────────────────────────▲──────────────────────────────────┘  │
│                                    │                                     │
│  ┌─────────────────────────────────▼──────────────────────────────────┐  │
│  │ SyncEngine & MergeEngine (LWW — Last Write Wins)                   │  │
│  │ ├─ Local File System Provider (File System Access API)             │  │
│  │ ├─ Google Drive Provider (OAuth2 API + AppData Folder)             │  │
│  │ ├─ Manual JSON Provider (Importación / Exportación Backup)         │  │
│  │ └─ Firebase / Firestore Provider (Delta Sync + Circuit Breaker)    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Persistencia Local y Esquema de Base de Datos (Dexie.js)
El almacenamiento primario reside en el cliente mediante **IndexedDB** administrado por **Dexie.js**. A lo largo de la evolución del proyecto, el esquema ha evolucionado a través de 6 versiones, consolidando:

- `categoriasMaterial`: Catálogo de 13 familias normativas con supercategorías y plantillas de atributos técnicos sugeridos.
- `materiales`: Fichas técnico-normativas con atributos normalizados, reglas de estimación y banderas de estado (`activo`, `requiereCotizacionDirecta`, `fichaIncompleta`).
- `productos`: Marcas y modelos asociados a materiales con nivel de calidad (`premium`, `estandar`, `economico`) y marca preferida.
- `ofertas`: Cotizaciones de proveedores con precio neto, alícuota de IVA, precio final, presentación de compra/factor de empaque y fuente de actualización.
- `solicitudesCotizacion`: Solicitudes RFQ enviadas a proveedores con seguimiento de respuestas.
- `manoObra`: Tarifario horario por especialidad técnica.
- `costosIndirectos`: Catálogo de gastos fijos, porcentuales y paramétricos con destino configurable.
- `tareasTipo`: Ensambles de trabajo paramétricos con inputs, variables calculadas, fórmulas de honorarios, despieces dinámicos, horas setup y cuadrilla recomendada.
- `contactos`: Directorio unificado 360° (Clientes, Proveedores y Subcontratistas) con roles múltiples, etiquetas (*Tags*), personas de contacto y condiciones financieras.
- `presupuestos`: Obras cotizadas con capítulos, partidas, desglose APU, gastos específicos, simulación de cuadrilla, esquema de pago e hitos.
- `registrosTrabajo`: Registro diario de tiempos y avance en obra para calibración EMA de productividad.
- `config`: Configuración global de la empresa, datos fiscales, alícuotas, multiplicadores, temas visuales y proveedores de sincronización.

Todas las tablas soportan **borrado lógico (*Soft Delete / Tombstones*)** mediante el campo `deleted: boolean` y control de versiones temporal con `updatedAt` y `_updatedAt` en milisegundos.

### 2.2. Motor de Sincronización Descentralizado y Fusión Last-Write-Wins (LWW)
La aplicación cuenta con un motor de sincronización (`syncEngine.ts`) desacoplado en proveedores:
1. **Local File System Provider:** Sincroniza directamente contra una carpeta seleccionada por el usuario en su disco local mediante la **File System Access API** del navegador.
2. **Google Drive Provider:** Resguarda y sincroniza el archivo maestro (`cotizador_ieba_master.json`) en la cuenta de Google Drive del usuario mediante tokens OAuth2.
3. **Manual JSON Provider:** Permite exportaciones e importaciones de respaldo completas con un clic.
4. **Firebase / Firestore Provider:** Sincronización delta con detección de estados fuera de línea y *Circuit Breaker* que aísla automáticamente los intentos de red si se excede la cuota diaria del plan Spark.

El **Merge Engine** (`mergeEngine.ts`) realiza una reconciliación bidireccional basada en **Last-Write-Wins (LWW)** comparando los timestamps de cada registro entre la base local y el payload remoto, resolviendo inserciones, actualizaciones y tombstones de eliminación sin pérdida de datos.

---

## 3. Estructura del Código Fuente

```
src/
├── App.tsx                           # Contenedor raíz, enrutamiento por tabs y modal back stack
├── index.css                         # Variables de tema Material Design 3 y estilos base
├── main.tsx                          # Punto de entrada de la aplicación
├── config/
│   ├── appConfig.json                # Catálogos maestros, listas de selección y opciones por defecto
│   ├── bdDefault.json                # Base de datos semilla inicial de respaldo
│   └── firebase.ts                   # Inicialización y configuración de Firebase SDK
├── contexts/
│   ├── AuthContext.tsx               # Contexto de autenticación y estado de sincronización
│   ├── ConfirmContext.tsx            # Diálogos modales de confirmación interactivos
│   └── ToastContext.tsx              # Notificaciones visuales tipo Toast
├── core/
│   ├── calculations.ts               # Motor central de cálculo financiero, APU, cuadrilla, EMA y K
│   ├── calculations.test.ts          # Suite de pruebas automatizadas del motor de cálculo
│   ├── exportUtils.ts                # Generador de hojas de cálculo Excel multihoja (ExcelJS)
│   ├── exportUtils.test.ts           # Pruebas de exportación a Excel
│   ├── materialMatching.ts           # Motor de resolución dinámica de insumos por atributos
│   ├── mathEvaluator.ts              # Parser y evaluador seguro de expresiones aritméticas y lógicas
│   ├── mathEvaluator.test.ts         # Pruebas del evaluador matemático y operador ternario
│   ├── modalBackStack.ts             # Pila de retroceso para gestión de hardware back button
│   ├── pdfExportUtils.ts             # Generador de presupuestos en PDF vectorial A4 (jsPDF)
│   ├── sampleData.ts                 # Datos iniciales fuertemente tipados y constantes de dominio
│   ├── searchUtils.ts                # Búsqueda difusa y normalización de texto
│   └── types.ts                      # Tipos de dominio, interfaces TypeScript y enums
├── data/
│   └── helpMessages.json             # Contenido del Centro de Ayuda y guía interactiva de uso
├── db/
│   └── database.ts                   # Definición de clases Dexie, schemas v1..v6 y migraciones
├── hooks/
│   ├── useAppConfig.ts               # Hook de acceso a la configuración del sistema
│   ├── useAppOptions.ts              # Opciones desplegables centralizadas sin magic strings
│   ├── useEscapeKey.ts               # Interceptación de tecla Escape
│   ├── useInsumosMap.ts              # Mapa reactivo de materiales, productos y ofertas consolidadas
│   ├── useKeyboardShortcuts.ts       # Manejador global de atajos de teclado
│   ├── useModalKeyboardNavigation.ts # Navegación accesible por teclado en modales
│   ├── usePwaBackNavigation.ts       # Hook de gestión de botón atrás en dispositivos móviles PWA
│   └── useTheme.ts                   # Conmutador de tema visual (Dark / Light / System)
├── services/
│   ├── mergeEngine.ts                # Motor de reconciliación y fusión Last-Write-Wins
│   ├── syncEngine.ts                 # Orquestador del motor de sincronización multi-proveedor
│   ├── syncService.ts                # Proveedor de sincronización con Firestore
│   ├── syncTypes.ts                  # Interfaces y tipos de payload de sincronización
│   └── providers/
│       ├── GoogleDriveProvider.ts    # Integración con Google Drive API
│       ├── LocalFileSystemProvider.ts# Integración con File System Access API
│       └── ManualJsonProvider.ts     # Manejador de backups JSON
├── viewmodels/
│   ├── useConfigViewModel.ts         # ViewModel de configuración y ajustes globales
│   ├── useInsumosManagerViewModel.ts # ViewModel del gestor de materiales, productos y ofertas
│   ├── usePresupuestoDetailViewModel.ts # ViewModel de visualización y exportación de cotizaciones
│   ├── usePresupuestoEditorViewModel.ts # ViewModel del editor integral de presupuestos y APU
│   └── useTareasTipoViewModel.ts     # ViewModel del laboratorio de Tareas Tipo y calibración
└── components/
    ├── Header.tsx                    # Barra de navegación principal y estado de sync
    ├── InsumosManager.tsx            # Gestor del catálogo de materiales y precios
    ├── ManoObraManager.tsx           # Gestor de tarifas de mano de obra y catálogo de gastos
    ├── TareasTipoManager.tsx         # Laboratorio de Tareas Tipo y simulación
    ├── ContactosManager.tsx          # Directorio unificado 360° (Clientes y Proveedores)
    ├── SolicitudesCotizacionManager.tsx # Gestor de solicitudes RFQ
    ├── PresupuestosList.tsx          # Listado, filtrado y búsqueda de presupuestos
    ├── PresupuestoEditor.tsx         # Editor de presupuestos, capítulos y partidas
    ├── PresupuestoDetail.tsx         # Vista de detalle, impresión y exportación
    ├── RegistroTrabajoManager.tsx    # Carga de partes diarios de obra
    ├── LogisticaManager.tsx          # Módulo de compras consolidadas y pedidos
    ├── ConfigModal.tsx               # Modal de configuración de la empresa y parámetros
    ├── HelpCenterModal.tsx           # Centro de ayuda y conocimiento interactivo
    ├── KeyboardShortcutsModal.tsx    # Modal de referencia de atajos de teclado
    ├── common/                       # Componentes de entrada y fórmulas con IntelliSense
    ├── contactos/                    # Tarjetas y formularios de contactos
    ├── insumos/                      # Modales de edición de materiales, productos y ofertas
    ├── presupuesto/                  # Subcomponentes del editor de cotizaciones
    └── tareasTipo/                   # Submódulos del laboratorio de tareas tipo
```

---

## 4. Modelo Financiero y Motor de Cálculo

El sistema implementa un modelo de cálculo por capas estructurado bajo la metodología de **Análisis de Precios Unitarios (APU)**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. COSTO DIRECTO GLOBAL (C)                                                 │
│    C = Σ(Insumos / Materiales) + Σ(Mano de Obra) + Σ(Servicios / Honorarios)│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 2. GASTOS GENERALES E INDIRECTOS (GG)                                       │
│    GG = Σ(Gastos Fijos) + Σ(Gastos Paramétricos) + Σ(Gastos % × C)          │
│    Base de Costo de Obra = C + GG                                           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 3. BENEFICIO COMERCIAL / MARGEN (B)                                         │
│    B = %Beneficio × (C + GG)                                                │
│    Subtotal Sin Impuestos (S) = C + GG + B                                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 4. IMPUESTOS (IVA, IIBB, Tasas)                                             │
│    Impuestos = Σ(Alícuota_i % × S)                                          │
│    PRECIO FINAL = S + Impuestos                                             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 5. COEFICIENTE DE PASE (K) & PRORRATEO POR RENGLÓN                          │
│    K = PRECIO FINAL / C                                                     │
│    Incidencia_i = CostoDirecto_i / C                                        │
│    PrecioVentaCliente_i = K × CostoDirecto_i                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.1. Fórmulas de Cálculo
- **Costo Directo del Ítem ($CD_i$):**
  $$CD_i = (\text{Costo Insumos}_i + \text{Costo Mano de Obra}_i \times \text{Modificador Condición} + \text{Servicios Tercerizados}_i + \text{Honorarios}_i) \times \text{Cantidad}_i + \text{Costo Fijo Operativo}_i$$

- **Costo Global de la Obra ($C$):**
  $$C = \sum_{i=1}^{N} CD_i$$

- **Prorrateo de Gastos Generales Absolutos ($GG_{\text{abs}}$):**
  $$\text{Incidencia}_i = \frac{CD_i}{C}$$
  $$GG_{\text{abs}, i} = GG_{\text{abs, total}} \times \text{Incidencia}_i$$

- **Subtotal y Precio de Venta Cerrado por Partida:**
  $$\text{Base Costo}_i = CD_i + GG_{\text{abs}, i}$$
  $$\text{Subtotal}_i = \text{Base Costo}_i \times (1 + \%GG_{\text{pct}}) \times (1 + \%B)$$
  $$\text{Precio Final}_i = \text{Subtotal}_i \times (1 + \% \text{Impuestos})$$
  $$\text{Precio Unitario Cliente}_i = \frac{\text{Precio Final}_i}{\text{Cantidad}_i}$$

### 4.2. Tratamiento Fiscal y Canónico de Precios (GMT)
El sistema opera con **Base Neta Gravable** como valor canónico interno de todos los materiales y servicios.
- Al cargar precios con IVA incluido, se realiza la conversión automática a base neta:
  $$\text{Precio Neto} = \frac{\text{Precio Final}}{1 + \frac{\text{Alícuota IVA}}{100}}$$
- Al cotizar con Factura A, los precios se presentan netos en el cuerpo de la cotización y el IVA se discrimina al pie.
- Al cotizar con Factura B, Factura C o Presupuesto X, los precios unitarios absorben los impuestos correspondientes para entregar valores finales directos al cliente.

---

## 5. Módulos y Funcionalidades Detalladas

### 5.1. Editor Integral de Presupuestos y Partidas
- **Organización por Capítulos:** Creación y ordenamiento de capítulos de obra (ej. *Capítulo 1: Acometida y Tableros*, *Capítulo 2: Canalizaciones*, *Capítulo 3: Cableado y Bocas*).
- **Tipos de Partidas:**
  - **Tareas Tipo / Ensambles:** Inclusión de tareas prearmadas del catálogo o configuradas con inputs paramétricos.
  - **Materiales Directos:** Selección directa de materiales del catálogo con cálculo paramétrico opcional.
  - **Servicios Tercerizados / Subcontratos:** Inclusión de trabajos de terceros con costo propio y margen individual.
  - **Ítems Libres / Ad-Hoc:** Creación de partidas personalizadas de única vez sin necesidad de poblar el catálogo maestro.
- **Edición In-Situ de Tareas:** Posibilidad de abrir el editor de composición técnica de una tarea directamente desde la fila del presupuesto y alterar sus materiales, horas o parámetros únicamente para esa cotización.
- **Fórmulas en Cantidad:** Soporte para expresiones matemáticas en el campo de cantidad (ej. `= 12 * 3.5 + 4`).
- **Selector de Condición de Obra:** Multiplicador dinámico de mano de obra (*Normal x1.0*, *Dificultosa x1.25*, *Favorable x0.9*).
- **Planificador de Cuadrilla & Sinergia de Obra (`PlanificadorCuadrillaCard`):**
  - Simula y compara 4 configuraciones de cuadrilla (*Mínima*, *Óptima*, *Rápida*, *Personalizada*).
  - Calcula el factor de sinergia de obra (ahorro de tiempos por trabajo en paralelo), jornadas estimadas (días base 8 hs), costo de movilidad diaria vs costo de operarios y nivel de riesgo de parate.
  - Aplica automáticamente la optimización y el factor de sinergia a la mano de obra del presupuesto.
- **Gastos Focalizados y Paramétricos:** Asignación de gastos fijos, porcentuales o calculados por fórmula (ej. logística por distancia, seguros, viáticos) a nivel global o vinculados a un capítulo específico.

### 5.2. Laboratorio de Tareas Tipo (APU y Parametrización)
El laboratorio de tareas (`TareasTipoManager.tsx`) se divide en 4 submódulos:
1. **Catálogo de Tareas:** Administración de ensambles estándar y servicios profesionales.
2. **Simulación What-If:** Análisis de sensibilidad interactivo que evalúa el impacto de subas porcentuales en materiales, paritarias salariales u horas extra sobre el costo y precio de venta.
3. **Calibración EMA de Rendimientos:** Ajuste de horas estimadas en base a registros históricos de campo utilizando Media Móvil Exponencial:
   $$\text{Factor EMA}_{t} = \alpha \times \left(\frac{\text{Horas Reales}}{\text{Horas Estimadas}}\right) + (1 - \alpha) \times \text{Factor EMA}_{t-1}$$
4. **Auditoría de Rentabilidad:** Semáforo de salud de tareas que detecta insumos con precios desactualizados o faltantes.

#### Características Avanzadas de Tareas Tipo:
- **Naturalezas de Trabajo:**
  - `instalacion`: Obra eléctrica convencional compuesta por insumos y mano de obra.
  - `servicio_profesional`: Protocolos de medición reglamentarios (ej. **Protocolo SRT 900/15 de Puesta a Tierra y Continuidad**), informes técnicos DCI, peritajes y certificaciones con **Honorarios Paramétricos** calculados por fórmula (ej. `= honorario_base + jabalinas * 25000`).
  - `servicio_tercerizado`: Subcontratos estandarizados.
- **Parámetros de Entrada:** Variables tipadas (`numero`, `select`, `boolean`) con condiciones lógicas de visibilidad multinivel (ej. `requiere_certificacion == 1`).
- **Variables Internas en Cascada:** Fórmulas matemáticas intermedias que facilitan cálculos complejos (ej. `modulos_din = 4 + circuitos * 2`).
- **Slots Dinámicos de Insumos con Filtros por Atributo:** Selección automática de materiales según atributos técnicos requeridos (ej. busca en *Termomagnéticas* un material con `polos == 2` y `In >= calibre_principal`).
- **Horas Setup de Alistamiento:** Distinción entre horas fijas de preparación de herramientas/replanteo y horas netas de rendimiento unitario.
- **Cláusulas Técnicas y Exclusiones Automáticas:** Textos legales predefinidos de resguardo técnico (ej. Cláusula AEA 90364 para adecuación de instalaciones existentes).

### 5.3. Motor Matemático y Evaluador Seguro (`mathEvaluator.ts`)
Diseñado para eliminar el uso inseguro de `eval()`, cuenta con un parser de descenso recursivo que construye un árbol de sintaxis abstracta (AST) y evalúa:
- **Operador Ternario Estándar:** `condicion ? valor_si_verdadero : valor_si_falso` con evaluación de cortocircuito (*Short-Circuit*).
- **Operadores de Comparación y Lógicos:** `<`, `<=`, `>`, `>=`, `==`, `!=`, `&&` (o `and`), `||` (o `or`), `!` (o `not`).
- **Aritmética Booleana Directa:** Expresiones como `100 + (altura > 3) * 25`.
- **Funciones Matemáticas y de Decisión:** `si(c, v1, v2)`, `if(c, v1, v2)`, `ceil()`, `floor()`, `round()`, `trunc()`, `int()`, `abs()`, `min()`, `max()`, `sqrt()`.
- **Componente `FormulaInput` con IntelliSense:** Menú desplegable contextual que sugiere variables, parámetros y funciones a medida que el usuario escribe, con soporte multilínea y barra de chips táctiles para dispositivos móviles.

### 5.4. Catálogo Estructurado de Materiales, Productos y Ofertas
- **13 Familias Normativas:** Cables, Caños y Tuberías, Bandejas Portacables, Cablecanales, Cajas, Módulos y Llaves, Bastidores y Tapas, Termomagnéticas, Diferenciales, Tableros, Iluminación, Puesta a Tierra, Terminales y Fijación.
- **Motor de Reglas Condicionales entre Atributos:** Permite definir dependencias dinámicas (ej. Si *Norma* = `IRAM 247-3`, bloquea conductores a `1` y filtra secciones a unipolares).
- **Presentaciones de Compra y Empaque:** Presets automáticos de empaque (*Rollo x 100m, Bobina x 500m, Tira x 3m, Caja x 100u, Bolsa x 25kg*) con cálculo de precio por empaque vs precio unitario de consumo.
- **Cómputo Métrico Paramétrico de Materiales (`ParametricMaterialModal`):**
  - Estimación por superficie cubierta ($m^2$) y factor de densidad.
  - Estimación por metros de cañería y cantidad de conductores simultáneos con % de bajadas.
  - Estimación por cantidad de bocas y distancia promedio.
  - Factores de desperdicio, curvas, colas de empalme y error de trazado.
- **Semáforo de Vencimiento de Precios:** Indicadores visuales según la antigüedad de la oferta (*Verde $\le 30$ días, Amarillo $31-60$ días, Rojo $> 60$ días*).
- **Búsqueda Online de Precios:** Acceso con un solo clic a búsquedas optimizadas en MercadoLibre y tiendas del gremio.
- **Navegación Focalizada (`MaterialFilterContext`):** Permite saltar desde un presupuesto o tarea al catálogo mostrando exclusivamente los insumos involucrados, actualizar precios y volver al presupuesto en un solo toque.

### 5.5. Directorio Unificado de Contactos 360°
- **Gestión Unificada:** Clientes, Proveedores y Subcontratistas administrados bajo el modelo `Contacto`.
- **Roles Múltiples:** Un mismo contacto puede actuar simultáneamente como Cliente y Proveedor.
- **Etiquetas M3 (*Chips*):** Categorización ágil por etiquetas personalizadas con autocompletado global.
- **Directorio de Personas de la Empresa:** Registro de múltiples contactos internos (Titular, Jefe de Compras, Técnico de Ventas) con números de WhatsApp, teléfono y correo electrónico.
- **Acciones Rápidas con Deep Links:** Botones para iniciar chats directos en WhatsApp (`wa.me/`), llamadas telefónicas (`tel:`) o correos (`mailto:`).
- **Ficha Financiera:** Registro de condiciones comerciales de cobro/pago, plazos, CBU/CVU/Alias bancario, banco y CUIT de la cuenta.
- **Pestañas Contextuales:** Historial de Presupuestos emitidos y Solicitudes RFQ asociadas al contacto.

### 5.6. Módulo de Logística y Compras Consolidadas (`LogisticaManager.tsx`)
- **Consolidación Inteligente de Materiales:** Agrupa y totaliza todos los insumos necesarios para ejecutar las obras aprobadas y enviadas seleccionadas.
- **Desglose por Proveedor Sugerido:** Asigna automáticamente cada material al proveedor con la oferta vigente más conveniente.
- **Acciones de Envío Rápido:** Copia de lista de materiales al portapapeles formateada para pedidos, envío directo por WhatsApp y generación de solicitud por correo electrónico.

### 5.7. Solicitud de Cotización a Proveedores (RFQ)
- **Armado de Pedidos RFQ:** Selección de materiales y cantidades estimadas agrupadas por proveedor.
- **Generación de Mensaje Listo para WhatsApp/Email:** Texto plano estructurado y prolijo listo para copiar y enviar a distribuidores.
- **Carga de Cotizaciones:** Registro de respuestas que genera automáticamente una nueva `Oferta` en el catálogo con fuente `cotizacion_directa`.

### 5.8. Control y Registro de Trabajo Real
- **Partes Diarios de Obra:** Carga rápida desde el celular de unidades ejecutadas y horas reales consumidas por el equipo de trabajo.
- **Registro de Causas de Desvío:** Tipificación de desvíos (*Material, Diseño/Cliente, Clima, Error de cálculo, Otro*) que nutren el algoritmo de calibración EMA.

---

## 6. Salidas Profesionales y Exportación

### 6.1. Exportación a PDF Vectorial Formal (A4)
Implementado mediante `jsPDF` y `jspdf-autotable`:
- Membrete formal con datos fiscales y logotipo de la empresa emisora.
- Recuadro de metadatos (Nº Presupuesto, Fecha, Validez, Tipo de Comprobante).
- Ficha del cliente y ubicación del trabajo.
- Tabla itemizada con capítulos, descripciones técnicas, unidades, cantidades y precios.
- Opciones de emisión: Modo Comercial Limpio (solo totales de venta) o Modo Desglose Técnico (con detalle de costos directos).
- Resumen financiero con subtotales, discriminación de IVA (si corresponde), referencia en USD y esquema de pagos/hitos.
- Inclusión automática de notas al cliente y cláusulas técnicas de resguardo.

### 6.2. Exportación a Hoja de Cálculo Excel Multihoja (`exceljs`)
Genera libros de trabajo con formato corporativo estructurado en 2 hojas:
1. **Hoja 1: Presupuesto Comercial:** Presentación profesional para el cliente con encabezados estilizados, detalle de partidas, subtotales, impuestos y condiciones comerciales.
2. **Hoja 2: Cómputo y Desglose Técnico (APU):** Análisis exhaustivo para el contratista con desglose de insumos unitarios, horas de mano de obra por categoría, servicios tercerizados, prorrateo de gastos generales, beneficio neto y cálculo del Coeficiente de Pase ($K$).

---

## 7. Productividad, Atajos y Experiencia de Usuario

### 7.1. Atajos de Teclado Globales
- `+` o `N`: Crear nuevo registro (Presupuesto, Insumo, Tarea, Contacto según pantalla activa).
- `Ctrl+S` / `Cmd+S`: Guardar formulario o presupuesto actual de forma inmediata.
- `Escape`: Cerrar modal activo o volver a la vista de lista.
- `/` o `Ctrl+K`: Enfocar barra de búsqueda global.
- `Alt + 1..8`: Navegación directa entre los 8 módulos principales:
  - `Alt + 1`: Presupuestos
  - `Alt + 2`: Catálogo de Materiales & Precios
  - `Alt + 3`: Directorio de Contactos 360°
  - `Alt + 4`: Registro de Trabajo en Obra
  - `Alt + 5`: Laboratorio de Tareas Tipo (APU)
  - `Alt + 6`: Mano de Obra & Gastos
  - `Alt + 7`: Solicitudes RFQ
  - `Alt + 8`: Logística & Compras
- `?` o `F1`: Abrir ventana interactiva de atajos de teclado.

### 7.2. Centro de Ayuda y Onboarding (`helpMessages.json`)
- Asistente de inicio rápido de 4 pasos para nuevos usuarios (*Insumos $\rightarrow$ Mano de Obra $\rightarrow$ Tareas Tipo $\rightarrow$ Presupuestos*).
- Centro de conocimiento interactivo organizado en 7 categorías temáticas con manuales de usuario y referencias técnicas normativas.

### 7.3. Navegación Móvil y Mobile Back Navigation
- Interceptación del botón Atrás del hardware de Android y gestos táctiles mediante `usePwaBackNavigation.ts`.
- Cierre ordenado de modales apilados sin perder el borrador de cotización.
- Mensaje de confirmación toast con doble toque para salir de la PWA.

---

## 8. Configuración Centralizada y Cero Magic Strings

Toda la parametrización del sistema se encuentra fuertemente tipada y centralizada:
- **`src/config/appConfig.json`:** Define las listas maestras de opciones (`categories`, `units`, `condicionesIVA`, `tiposFactura`, `estadosPresupuesto`, `condicionesTrabajo`, `motivosDesvio`, `tiposProveedor`, `tiposCostoIndirecto`, `mediosPago`, `modalidadesPago`, `tiposAjustePrecio`) y la configuración por defecto de la empresa.
- **`src/core/sampleData.ts`:** Exporta constantes fuertemente tipadas y datos semilla consumidos homogéneamente por la UI y los ViewModels.
- **Eliminación Total de Magic Strings:** Los componentes consumen valores a través del hook `useAppOptions()`, garantizando consistencia y facilidad para incorporar nuevas opciones normativas.

---

## 9. Tecnologías y Librerías Utilizadas

| Categoría | Tecnología / Librería | Propósito |
|---|---|---|
| **Frontend Core** | React 18, TypeScript, Vite 8 | Base de la interfaz reactiva y tipado estático |
| **Estilos & Diseño** | Tailwind CSS 3, Lucide React | Sistema de diseño Material 3 y conjunto de iconos |
| **Persistencia Local** | Dexie.js 4, Dexie React Hooks | Base de datos IndexedDB local offline (Schema v6) |
| **Sincronización** | File System Access API, Google Drive API, Firebase Firestore | Sincronización descentralizada y multi-proveedor |
| **Generación PDF** | jsPDF 4, jsPDF-AutoTable 5 | Emisión de cotizaciones vectoriales en A4 |
| **Generación Excel** | ExcelJS 4 | Generación de planillas de cálculo multihoja con formato APU |
| **Lectura QR/Barras**| html5-qrcode 2 | Escaneo de códigos de materiales mediante cámara |
| **Evaluación Matemática** | Parser AST propio (`mathEvaluator.ts`) | Evaluación segura de fórmulas, ternarios y funciones sin `eval()` |
| **PWA & Service Worker** | vite-plugin-pwa 1.3, Workbox | Instalabilidad en escritorio/móvil y caché offline |
| **Testing Automatizado** | Vitest 4, Testing Library | Pruebas unitarias de cálculos, evaluador, merge engine y viewmodels |
