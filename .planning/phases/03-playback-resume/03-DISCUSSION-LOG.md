# Phase 3: Playback & Resume - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-11
**Phase:** 3-Playback & Resume
**Areas discussed:** Player entry point, Position save frequency, Scrub bar behavior, End of book

---

## Player Entry Point

| Option | Description | Selected |
|--------|-------------|----------|
| Pantalla dedicada | Navigates to its own route (e.g. `/player/[id]`) with a shareable URL; native back-button behavior; only one `<audio>` element active at a time | ✓ |
| Inline expandido | Player appears inside the library screen without navigating; requires extra scroll/visibility handling | |
| Tú decides | Left to Claude's technical judgment | |

**User's choice:** Pantalla dedicada (Recomendado)
**Notes:** None.

---

## Position Save Frequency

| Option | Description | Selected |
|--------|-------------|----------|
| Cada 5s | Balance between precision on forced-close and write frequency | ✓ |
| Cada 15s | Fewer writes, up to 15s of progress could be lost on forced close | |
| Cada 1s | Maximum precision, more frequent writes than needed | |

**User's choice:** Cada 5s (Recomendado)
**Notes:** Matches the research pitfalls doc's explicit throttle-5-15s recommendation.

---

## Scrub Bar Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Pausa durante arrastre, busca al soltar | Standard podcast/audiobook player pattern; avoids choppy audio from repeated seeks | ✓ |
| Sigue sonando en tiempo real | Audio repositions continuously while dragging; more "live" but riskier with a native `<audio>` element | |

**User's choice:** Pausa durante arrastre, busca al soltar (Recomendado)
**Notes:** None.

---

## End of Book

| Option | Description | Selected |
|--------|-------------|----------|
| Se detiene y queda marcado como completado | `position = duration`, playback stops; honest terminal state | ✓ |
| Se reinicia la posición a 0 automáticamente | Loops back to start, could surprise the user | |
| Tú decides | Left to Claude's technical judgment | |

**User's choice:** Se detiene y queda marcado como completado (Recomendado)
**Notes:** None.

---

## Claude's Discretion

- iOS gesture-unlock handling for the play button (`.play()` called synchronously inside the tap handler, source prepared ahead of time where possible).
- Whether/how far to implement Media Session API metadata now vs. fully deferring to PLAY2-02 — flagged for research to reconcile against PITFALLS.md's "wire basic metadata from day one" recommendation.
- Exact ±15s skip clamping behavior at the start/end of a book.
- Whether the library screen's progress bar reflects live position while playing, vs. only on next visit.
- Visual/layout design of the player screen — deferred to this phase's UI-SPEC (gsd-ui-phase), not this discussion.

## Deferred Ideas

None — discussion stayed within phase scope. Background/lock-screen playback is already tracked as PLAY2-02 in REQUIREMENTS.md v2.
