# Phase 2: Import & Library - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-08
**Phase:** 2-Import & Library
**Areas discussed:** Import flow, Title cleanup rule, Progress indicator, Delete

---

## Import Flow

| Option | Description | Selected |
|--------|-------------|----------|
| El texto se vuelve el botón | 'Import an audiobook to start listening' pasa a ser un botón/link tappable en el mismo lugar. | ✓ |
| Botón separado siempre visible | Botón flotante o en el header, visible también con la biblioteca poblada. | |
| Vos decidís | Claude elige el patrón. | |

**User's choice:** El texto se vuelve el botón

| Option | Description | Selected |
|--------|-------------|----------|
| Fila placeholder con progreso | Fila con spinner/barra mientras copia, se convierte en el libro real al terminar. | ✓ |
| Pantalla de carga bloqueante | Modal o pantalla completa hasta que termina la copia. | |
| Vos decidís | Claude elige la implementación más simple. | |

**User's choice:** Fila placeholder con progreso

| Option | Description | Selected |
|--------|-------------|----------|
| Mensaje inline junto al control de import | Texto de error visible cerca del import, descartable, no bloquea la app. | ✓ |
| Vos decidís | Claude elige un patrón de error razonable. | |

**User's choice:** Mensaje inline junto al control de import
**Notes:** Las tres preguntas de esta área se resolvieron con la opción recomendada en cada caso.

---

## Título (limpieza de nombre de archivo)

| Option | Description | Selected |
|--------|-------------|----------|
| Quitar extensión + guiones/underscores a espacios + Title Case | 'the_great_gatsby-01.mp3' → 'The Great Gatsby 01'. Determinístico. | ✓ |
| Igual pero sin Title Case | Solo quita extensión y reemplaza separadores, preserva mayúsculas/minúsculas originales. | |
| Vos decidís | Claude elige la regla más simple. | |

**User's choice:** Quitar extensión + guiones/underscores a espacios + Title Case

| Option | Description | Selected |
|--------|-------------|----------|
| Solo limpieza básica | Sin parsing de patrones tipo 'Autor - Libro' — evita falsos positivos. | ✓ |
| Intentar separar números de track/capítulo iniciales | Si el archivo empieza con un número, lo separa. | |

**User's choice:** Solo limpieza básica
**Notes:** Parsing de patrones tipo "Autor - Título" o "01 - Capítulo" queda explícitamente fuera de v1 (no es un deferred idea — es una decisión de no implementarlo, con META-01 como la vía v2 real vía metadata de archivo).

---

## Indicador de progreso en la lista

| Option | Description | Selected |
|--------|-------------|----------|
| Porcentaje | '45% completado' — simple, no depende de la duración exacta. | |
| Tiempo restante | '2h 15m restantes' — requiere conocer la duración total del archivo. | |
| Ambos | Mostrar los dos juntos, ej. '45% — 2h 15m restantes'. | ✓ |

**User's choice:** Ambos
**Notes:** Requiere leer la duración del audio en el momento de import y guardarla como metadata — queda como detalle técnico para research/planner (ver CONTEXT.md Claude's Discretion).

---

## Borrado de libro

| Option | Description | Selected |
|--------|-------------|----------|
| Swipe-to-delete | Patrón nativo de iOS — deslizar revela un botón de borrar. | ✓ |
| Ícono/botón de borrar visible | Ícono de basura siempre visible en cada fila. | |
| Vos decidís | Claude elige el patrón más consistente con shadcn/ui. | |

**User's choice:** Swipe-to-delete

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmar tal cual | "Delete book: Remove '{title}' and free its storage? This can't be undone." — ya redactado en Phase 1's UI-SPEC. | ✓ |
| Cambiar la redacción | El usuario escribe el texto exacto. | |

**User's choice:** Confirmar tal cual
**Notes:** El copy placeholder de Phase 1 queda confirmado y locked para Phase 2.

---

## Claude's Discretion

- Estilo visual exacto de la fila placeholder durante el import (spinner vs barra, styling específico) — dentro de los tokens de diseño de Phase 1.
- Redacción exacta del mensaje de error de import inline.
- Si el file picker de iOS permite selección múltiple, iterar el mismo flujo de copia/error por archivo es una implementación aceptable, no un cambio de alcance.
- Esquema exacto de Dexie.js (tablas, índices) — decisión técnica, no de UX.
- Cómo se lee/guarda la duración del audio para el tiempo restante (D-06) — detalle técnico.

## Deferred Ideas

None — discussion stayed within phase scope.
