# 📋 Backlog de Mejoras y Roadmap de Características a Futuro

Este documento consolida la visión estratégica del **Cotizador PWA IEBA**, su comparativa competitiva frente a los líderes del mercado de *Field Service Management* (**Jobber** y **Housecall Pro**), y el roadmap estructurado de funcionalidades a incorporar en futuras iteraciones.

---

## 🧭 Visión Estratégica & Diferenciación

| Eje | Cotizador PWA IEBA | Jobber / Housecall Pro |
| :--- | :--- | :--- |
| **Enfoque Principal** | **Técnico y de Ingeniería de Costos**: Despiece real de materiales, horas hombre UOCRA, rendimientos, mermas y cuadrillas. | **Comercial / CRM / Facturación básica**: Listas planas de precios fijos (*Price Books*) sin APU profundo. |
| **Velocidad de Carga** | **Modo Experto DSL**: Tipeo continuo en YAML con atajos (`Alt+Enter`, `Alt+M`, `Alt+G`) y fórmulas en cascada (`calculos:`). | **Formularios con clics**: Lento para obras técnicas complejas de más de 15 ítems. |
| **Contexto Local (Argentina)** | **Nativo y Bimonetario**: Cotización USD (MEP/Oficial) + ARS, validez en días, Facturas A/B/C, discriminación de alícuotas IVA (21% / 10.5%). | **Moneda e inflación fija**: Incompatible con la coyuntura económica argentina. |
| **Disponibilidad & Privacidad** | **100% Offline-First**: Dexie / IndexedDB con latencia 0 ms, opera en subsuelos y obras sin señal. | **Cloud-only**: Fuerte dependencia de conexión permanente. |
| **Modelo de Negocio** | **Costo $0 mensual**: Sin suscripciones por usuario o porcentaje de cobro. | **$50 a $250+ USD/mes** por usuario + comisiones de pasarela. |

---

## 🎯 Roadmap de Features a Futuro (Priorizado)

### 📌 Fase 1: Conversión Comercial y Experiencia del Cliente Final
- [ ] **Cotizaciones Multi-Opción (Tiered Quoting / "Good - Better - Best")**:
  - Permitir presentar 2 o 3 alternativas dentro del mismo presupuesto (ej: *Opción Estándar* con materiales certificados convencionales vs. *Opción Premium* con materiales de primera línea Schneider/Prysmian y protecciones adicionales contra sobretensión).
  - El cliente visualiza y compara los alcances y totales de cada alternativa en el mismo documento.
- [ ] **Portal del Cliente Web & Aprobación con Firma Digital**:
  - Generación de un enlace web seguro/liviano o código QR para que el cliente abra la cotización en su dispositivo móvil.
  - El cliente puede seleccionar opcionales, firmar con el dedo en pantalla (*Canvas signature*) y pulsar *"Aprobar Presupuesto"*.
  - Alerta y registro de fecha/hora de aceptación del documento.
- [ ] **Generación de Mensaje Directo de WhatsApp con Resumen Ejecutivo**:
  - Botón para enviar un resumen prolijo con formato WhatsApp (emojis, desglose claro, enlace al PDF o portal) directamente a la persona de contacto seleccionada.

---

### 📌 Fase 2: Relevamiento Técnico y Multimedia en Obra
- [ ] **Módulo Fotográfico de Relevamiento in Situ**:
  - Posibilidad de adjuntar o tomar fotos directamente desde la cámara del celular (ej: *estado del tablero existente*, *acometida*, *canalizaciones actuales*).
  - Inclusión de las fotos en una sección de "Diagnóstico Inicial / Relevamiento" dentro del PDF técnico.
- [ ] **Adjuntos Técnicos y Esquemas Unifilares**:
  - Incorporar planos PDF, esquemas de distribución de tableros o fichas técnicas de los equipos presupuestados como anexos al presupuesto.

---

### 📌 Fase 3: Seguimiento Automatizado y Gestión Comercial
- [ ] **Automatización de Seguimiento (Follow-Up)**:
  - Notificaciones en la app recordando contactar a clientes cuyos presupuestos llevan X días en estado *"Enviado"* sin respuesta.
  - Plantillas de recordatorio predefinidas para enviar por WhatsApp con un solo clic.
- [ ] **Tablero Kanban de Estados de Presupuestos**:
  - Vista visual por columnas: *Borrador -> Enviado -> En Negociación -> Aprobado -> Rechazado / Vencido*.
  - Arrastrar y soltar presupuestos para actualizar su estado.

---

### 📌 Fase 4: Operaciones, Control Presupuestado vs. Real y Avance de Obra
- [ ] **Control de Desvíos (Presupuestado vs. Real)**:
  - A partir del despiece técnico de la partida (APU), registrar las compras reales de materiales y las horas de mano de obra efectivamente trabajadas.
  - Panel de desvíos: alertar si el costo de los insumos o las horas consumidas superaron la estimación inicial, con recálculo del margen comercial final obtenido.
- [ ] **Certificaciones Parciales y Avance de Obra**:
  - Para obras medianas o grandes, permitir emitir certificaciones quincenales o mensuales por porcentaje de avance por capítulo o partida.
- [ ] **Calendario y Planificación de Cuadrillas**:
  - Cronograma de asignación de operarios y oficiales por obra y jornada.

---

### 📌 Fase 5: Integraciones Fiscales y Financieras
- [ ] **Facturación Electrónica AFIP / ARCA**:
  - Emisión de Facturas A, B o C directamente desde el presupuesto aprobado mediante Web Services de AFIP.
- [ ] **Gestión de Cobranzas y Pagos Parciales**:
  - Registro de anticipos (ej: 50% acopio de materiales), pagos contra avance y saldo final de obra.
