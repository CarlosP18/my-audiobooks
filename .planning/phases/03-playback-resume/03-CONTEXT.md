# Phase 3: Playback & Resume - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

User can play any imported audiobook with full transport controls (play/pause, ±15s skip, scrub-to-seek), see elapsed/remaining time update live, and have playback position saved automatically and frequently enough that reopening the app after a full close resumes from very close to the last spot. This is the app's core value proposition. Background/lock-screen playback (Media Session API, staying audible with the screen locked) is explicitly deferred to v2 (PLAY2-02) — this phase only needs to work reliably in the foreground.

</domain>

<decisions>
## Implementation Decisions

### Player Entry Point
- **D-01:** Tapping a library row navigates to a dedicated player screen/route (e.g. `/player/[id]`), not an inline-expanded row. Gives a shareable/back-button-able URL, and keeps exactly one `<audio>` element active at a time without extra visibility-tracking logic. — **Reversibility:** costly — reversible in principle, but switching to inline-expansion later touches routing, navigation history, and how the library screen and player share audio state.

### Position Save Frequency (PLAY-05)
- **D-02:** Position is written to IndexedDB every 5 seconds during active playback, in addition to on pause and on visibility-change/backgrounding. Matches the research pitfalls doc's explicit recommendation (throttle 5-15s; never write on every `timeupdate` tick, which fires ~4x/sec and risks IndexedDB transaction contention). — **Reversibility:** reversible — a pure timing constant.

### Scrub Bar Behavior (PLAY-03)
- **D-03:** Dragging the scrub bar pauses/mutes audio for the duration of the drag; the actual seek happens once on release. Matches standard podcast/audiobook player UX and avoids repeated seeks on a native `<audio>` element causing choppy playback. — **Reversibility:** reversible.

### End of Book
- **D-04:** When playback reaches 100%, it stops and `position` is set to `duration` (book shown as completed) rather than auto-resetting to 0. Honest terminal state — a book doesn't silently loop back to "just started." — **Reversibility:** reversible.

### Claude's Discretion
- Exact play-button tap-to-audio-start handling to satisfy the iOS gesture-unlock constraint (PITFALLS.md Pitfall 3): `.play()` must be called synchronously inside the tap handler, not after an `await`. The `<audio src>` (via `URL.createObjectURL(blob)`) should be prepared ahead of the tap where possible so `.play()` only needs to resume — implementation detail for research/planner, not a user-facing gray area.
- Whether/how far to implement Media Session API metadata (`navigator.mediaSession.metadata`, action handlers) now vs. deferring entirely to PLAY2-02. PITFALLS.md recommends wiring basic metadata "from day one" even though full background-audio reliability is v2 scope — research should reconcile this tension and the planner should not let it expand this phase's scope beyond foreground playback.
- Exact behavior at library-boundary edge cases for ±15s skip (e.g., skipping back within the first 15s clamps to 0; skipping forward within the last 15s clamps to `duration`, doesn't skip past end-of-book state from D-04).
- How/whether the library screen's per-row progress bar reflects position live while a book is playing in the background player route, vs. only updating on next visit to the library screen — technical/UX-adjacent detail, not asked about since it doesn't change the phase's core deliverable.
- Visual design of the player screen (layout, transport control styling, scrub bar appearance) — covered by the phase's UI-SPEC (ROADMAP.md marks this phase `UI hint: yes`), not this discussion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (this project)
- `.planning/research/PITFALLS.md` — Pitfall 3 (gesture-unlock: `.play()` must be synchronous inside the tap handler), Pitfall on background/lock-screen playback limitations (informs why this phase stays foreground-only), Performance Traps section (throttle position saves 5-15s — backs D-02; load Blob via `URL.createObjectURL`, never into memory first; revoke object URLs on book switch), "Looks Done But Isn't" checklist (play button first-tap verification, resume-after-force-quit verification)
- `.planning/research/ARCHITECTURE.md` — component boundaries; confirms player is this phase's job, storage layer (`lib/db.ts`) already exists from Phase 2
- `.planning/research/STACK.md` — native `<audio>` element chosen for playback (no player library)
- `.planning/research/FEATURES.md` — confirms PLAY-01–06 are v1 table-stakes; PLAY2-01 (bookmarks) and PLAY2-02 (MediaSession/lock-screen, spike first) are v2/deferred

### Project-Level
- `.planning/PROJECT.md` — Core Value ("Resume playback exactly where you left off, every time") is literally this phase's goal; Key Decisions table (Dexie/IndexedDB storage already validated in Phase 2)
- `.planning/REQUIREMENTS.md` — PLAY-01 through PLAY-06 definitions; PLAY2-02 explicitly deferred with "spike first" note

### Phase 2 (inherited)
- `lib/db.ts` — existing `Book` interface already has a `position: number` (seconds) field, written as 0 by every Phase 2 import; this phase is what advances it. No schema change needed — v1 Dexie schema is a locked, one-way decision (see Phase 2 context) and must not be edited in place.
- `.planning/phases/02-import-library/02-CONTEXT.md` — D-06 (progress line shows both percent and time remaining, "45% — 2h 15m remaining") — this phase's player screen should stay consistent with that library-row format for elapsed/remaining time display (PLAY-04)
- `components/library-row.tsx` — existing progress bar + percent/time-remaining rendering pattern (`lib/format.ts`'s `percentComplete`/`formatTimeRemaining`) to reuse on the player screen

### Phase 1 (inherited)
- `.planning/phases/01-install-offline-app-shell/01-UI-SPEC.md` — locked design tokens (dark-neutral palette, typography, spacing) the player screen must reuse

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/format.ts` — `percentComplete()` and `formatTimeRemaining()` helpers already exist (built for the library row) and directly apply to the player screen's elapsed/remaining time display (PLAY-04).
- `lib/db.ts` — single Dexie chokepoint (`db.books`); the player will read one book by id and write `position` updates through the same table — no new storage module needed.
- `app/globals.css` — locked design tokens, reuse directly.

### Established Patterns
- No gesture library was introduced in Phase 2 (plain touch-event handlers for swipe-to-delete in `library-row.tsx`) — the scrub bar likely follows the same plain-DOM-events approach rather than pulling in a new dependency, though this is for research/planner to confirm.
- `lib/db.ts`'s "single Dexie chokepoint" comment explicitly anticipates this phase's position-tracking writes.

### Integration Points
- New: a player route (`app/player/[id]/page.tsx` or similar, per D-01) that reads a book by id from `db.books` and renders transport controls.
- `components/library-row.tsx` becomes a tap target that navigates to the player route (currently only handles swipe-to-delete and static progress display).

</code_context>

<specifics>
## Specific Ideas

- Position save cadence: every 5 seconds during playback, plus on pause and on visibility-change/backgrounding (D-02).
- End-of-book: stops playback and sets `position = duration`, book reads as completed rather than looping to 0 (D-04).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Background/lock-screen playback (Media Session API, staying audible with screen locked) is already tracked as PLAY2-02 in REQUIREMENTS.md v2, not a new idea from this discussion.

</deferred>

---

*Phase: 3-Playback & Resume*
*Context gathered: 2026-08-11*
