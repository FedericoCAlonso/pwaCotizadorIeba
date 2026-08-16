# Documento Maestro — Ecosistema de Herramientas IEBA

**Última actualización:** Agosto 2026
**Autor:** Federico — IEBA

---

## 1. Visión General

IEBA no construye una app monolítica, sino un **ecosistema de PWAs independientes**, cada una resolviendo un problema operativo puntual del electricista (o, a futuro, de otros gremios técnicos). Cada herramienta tiene su propio codebase, su propia base de datos y su propio ciclo de vida. No hay acoplamiento arquitectónico entre ellas; lo que las une es la marca, el dominio de distribución y, eventualmente, una capa comercial común.

Esta decisión reemplaza el enfoque anterior de "hub unificado" (ieBA Suite), abandonado por generar complejidad de integración innecesaria antes de validar el valor de cada herramienta por separado.

**Principio rector:** primero herramienta útil y gratuita, adopción orgánica real, y recién después — condicionado a esa adopción — capa de negocio.

---

## 2. Objetivos

### 2.1 Objetivo operativo (corto plazo)
Dar al instalador eléctrico una herramienta de bolsillo rápida y sin fricción para cotizar con precisión, armar listas de materiales profesionales y comunicarse mejor con clientes y proveedores. Eliminar el error de cálculo de costos y ahorrar tiempo de oficina.

### 2.2 Objetivo de producto (mediano plazo)
Validar, mediante uso real (dogfooding) y distribución orgánica entre colegas, que las herramientas generan apego genuino — medido en uso sostenido, no solo instalaciones.

### 2.3 Objetivo estratégico-comercial (largo plazo, condicional)
Si la validación anterior es positiva, evolucionar el Cotizador hacia un marketplace B2B de licitación inversa: los vendedores de materiales pagan un abono mensual por acceder a las listas estandarizadas generadas por la red de usuarios. Este paso **no se ejecuta por defecto** — está supeditado a que exista tracción real.

### 2.4 Objetivo de plataforma (visión de largo plazo)
Replicar el patrón (no el código) a otros gremios técnicos: cada oficio con su propia PWA especializada en su taxonomía y flujo de trabajo, reunidas bajo una misma página de distribución.

---

## 3. Arquitectura técnica transversal

Decisiones que aplican a todas las PWAs del ecosistema, salvo excepción justificada por herramienta:

- **Offline-first**, sin dependencia de servidor para el uso diario.
- **Dexie.js / IndexedDB** como almacenamiento local principal.
- **Firebase Auth** para identidad de usuario (no Firestore como base de sincronización).
- **Backup opcional a Google Drive personal** del usuario — no hay sincronización multi-dispositivo automática ni base de datos centralizada en la nube en esta fase.
- Cada PWA es instalable de forma nativa multiplataforma (Android, iOS, desktop) sin mantener builds nativos separados.
- Empaquetado opcional como **TWA (Trusted Web Activity)** vía Bubblewrap/PWABuilder para publicación en Google Play cuando la herramienta esté validada.

Esta arquitectura prioriza costo de mantenimiento mínimo y control del usuario sobre sus propios datos, coherente con el perfil de un instalador independiente que no quiere depender de infraestructura de terceros para trabajar en obra.

---

## 4. Herramientas del ecosistema (estado actual)

| Herramienta | Estado | Función |
|---|---|---|
| **Cotizador IEBA** | En desarrollo activo | Presupuestos, APU, catálogo de materiales, contactos |
| **El Croquizador** | Desarrollado (origen del ecosistema) | Sketching de planos / relevamiento |
| **El Cosito del Coso** | Desarrollado | Identificación de materiales por nombre coloquial, listas de compra |
| **PWA de muebles (sheet materials)** | Escopeada, no iniciada | Corte paramétrico, nesting, BOM y costo para MDF/melamina |

Cada una vive en su propio subdominio o ruta (ej. `cotizador.ieba.com.ar`), manteniendo el aislamiento de codebase y base de datos.

---

## 5. Plan de acción — Cotizador IEBA (herramienta ancla)

### Etapa 1 — Consolidación del motor base y UI *(actual)*
1.1 Refactor visual bajo Material Design 3 (limpieza de UI, filtros colapsables).
1.2 Bottom navigation definitivo: Presupuestos | Materiales | Contactos | Registro | Más.
1.3 Cierre del modelo de datos: categorías de materiales, sistema de tags en Dexie.

### Etapa 2 — Tracción y reconocimiento de marca
2.1 Diseño del PDF y del mensaje de WhatsApp de salida, pensados como publicidad pasiva de marca en cada envío.
2.2 Dogfooding intensivo: uso propio en obras y cotizaciones reales para pulir el flujo de trabajo. **Esta etapa es también donde se valida la hipótesis de circulación orgánica** — no se asume, se prueba.
2.3 Distribución inicial a colegas de confianza. Publicación como TWA en Google Play para bajar la fricción de instalación y habilitar descubrimiento orgánico.
2.4 Instrumentación de uso: Firebase Analytics (DAU/MAU, eventos como "presupuesto generado", "PDF exportado") + evento `appinstalled` para medir adopción real, no solo visitas.
2.5 Botón de apoyo voluntario ("cafecito") — discreto, contextualizado al valor entregado, sin fricción de cobro. Sirve además como señal temprana de apego genuino, más honesta que cualquier métrica de analytics.

### Etapa 3 — Integración B2B y monetización *(condicional a resultados de Etapa 2)*
3.1 Backend liviano de lead-gen para capturar y distribuir listas de materiales ("Enviar al Mercado").
3.2 Sistema de bidding: vendedores responden, conexión directa por WhatsApp al ganador.
3.3 Suscripción mensual fija a vendedores de mostrador para acceso prioritario a listas de "Compra Inmediata".

---

## 6. Estrategia de distribución del ecosistema

- **Página índice** en ieba.com.ar (ej. `/herramientas`) listando todas las PWAs disponibles, con card, descripción corta y link directo a cada subdominio. Mantiene el descubrimiento centralizado sin acoplar el código.
- Cada card detecta instalabilidad (`beforeinstallprompt`) y ajusta el CTA ("Instalar" vs "Abrir").
- Nota explicativa para usuarios de iOS, donde la instalación es manual (compartir → agregar a inicio) y el soporte de push es más limitado.
- Publicación en Google Play como TWA, priorizada para las herramientas que ya pasaron dogfooding — no antes.

---

## 7. Señales de decisión (evitar avanzar de fase "a ojo")

Antes de iniciar la Etapa 3 (monetización B2B), definir umbrales concretos y medibles, por ejemplo:
- Usuarios activos mensuales sostenidos por N meses consecutivos.
- Cantidad de presupuestos/listas generadas por semana.
- Tasa de retorno de usuarios (no solo instalaciones nuevas).
- Señal cualitativa: aparición espontánea del formato IEBA en mostradores no vinculados directamente a Federico.

*(Pendiente: fijar los números concretos una vez haya datos de Etapa 2.)*

---

## 8. Exclusiones deliberadas (scope guardrails)

- Sin comisión por porcentaje de venta ni pasarela de pago transaccional entre instalador y proveedor.
- Sin expansión multi-gremio dentro de una misma app — cada oficio, su propia PWA.
- Sin funcionalidad de Gantt/planificación de obra en el Cotizador.
- Sin arquitectura de hub/integración de código entre PWAs — la integración, si existe, es solo de distribución (página índice) o eventualmente un "integrador tonto" liviano, nunca acoplamiento de base.

---

## 9. Próximos pasos inmediatos

1. Terminar Etapa 1 del Cotizador (modelo de datos + UI).
2. Instrumentar Firebase Analytics antes de la distribución a colegas, para tener línea de base desde el día uno.
3. Sumar botón de cafecito al footer/menú "Más".
4. Bocetar la página índice de herramientas cuando haya al menos dos PWAs en estado presentable.
5. Definir los umbrales numéricos de la sección 7 una vez arranque el dogfooding real.
