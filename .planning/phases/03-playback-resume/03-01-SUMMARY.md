---
phase: 03-playback-resume
plan: 01
subsystem: playback
tags: [player-route, audio-element, indexeddb-position, tracer-slice]

dependency-graph:
  requires:
    - "lib/db.ts (Book interface, position field, single books table)"
    - "lib/format.ts (module convention followed by lib/playback.ts)"
    - "components/library-row.tsx (foreground tap target, now wired to navigate)"
  provides:
    - "app/player/[id]/page.tsx default export PlayerPage"
    - "components/player/transport-controls.tsx export TransportControls"
    - "lib/playback.ts exports POSITION_SAVE_THROTTLE_MS, shouldPersist"
  affects:
    - "components/library-row.tsx (foreground click now navigates instead of no-op)"

tech-stack:
  added: []
  patterns:
    - "useParams() over use(params) for a Client Component dynamic route"
    - "Object URL created once per book id, revoked in effect cleanup, keyed only on the resolved book's numeric id — never the whole live-query object"
    - "useLiveQuery LOADING sentinel (module-level Symbol passed as defaultResult) to distinguish 'still loading' from 'settled, no such book' when both would otherwise read as undefined"
    - "Throttle-and-flush position persistence: 5s timeupdate gate via shouldPersist, plus immediate flush on pause/visibilitychange/unmount"
    - "Play state driven by the <audio> element's own play/pause events, not the tap handler"

key-files:
  created:
    - "lib/playback.ts"
    - "app/player/[id]/page.tsx"
    - "components/player/transport-controls.tsx"
  modified:
    - "components/library-row.tsx"
    - "scripts/library-logic.test.mjs"

decisions:
  - "Object-URL/restore/persist/play-state effects are keyed on resolvedBook?.id (the settled record's own numeric id), not the raw route-derived bookId and not the whole book object — this is what lets the effects both (a) fire exactly once when the first read resolves and (b) never re-fire on the 5-second position-write-driven object identity churn from useLiveQuery."
  - "Used a module-level LOADING Symbol as useLiveQuery's third-arg defaultResult to distinguish the loading state from the settled-not-found state, instead of a separate useState flag + manual Dexie read — avoids a duplicate query and an extra render-cycle flash."
  - "Library row navigation implemented via next/link Link wrapping the existing foreground content div (not router.push), with the existing handleForegroundClick's panel-open branch now calling event.preventDefault() before closing the panel, so a tap that closes the delete panel never also navigates."

metrics:
  duration: ~10 min
  completed: 2026-08-12

status: complete

actuals:
  tokens: 4242
  tasks: 2
  commits: 2
---

# Phase 3 Plan 1: End-to-end playback and resume tracer slice Summary

Wired the entire playback path in one vertical slice — library row tap, `/player/[id]` route resolution, Dexie read, blob-to-object-URL, `<audio>` element, play/pause, throttled 5-second position write with pause/visibilitychange/unmount flush, and position restore on load — then gave the route its three real rendering states (loading, not-found, populated with clamped title and artwork placeholder).

## What Was Built

**Task 1 — End-to-end "play this book and resume it" (tracer):**
- `lib/playback.ts`: pure, DOM-free module exporting `POSITION_SAVE_THROTTLE_MS` (5000, per locked D-02) and `shouldPersist(lastSavedAtMs, nowMs)`. Four `node --test` cases added to `scripts/library-logic.test.mjs` covering below-threshold, exactly-at-threshold, above-threshold, and the first-write sentinel.
- `app/player/[id]/page.tsx`: `"use client"` route using `useParams()` (not `use(params)`), validating the route id with `Number.isInteger` + positive check before it ever reaches Dexie. `useLiveQuery` reads the book. A `bookRef` (synced in its own effect, since writing to a ref during render trips the `react-hooks/refs` lint rule) lets book-derived effects read the latest resolved record without adding the whole object to their dependency arrays.
  - Object URL: created once per resolved book id, revoked in the effect's own cleanup.
  - Position restore: a `loadedmetadata` listener sets `audio.currentTime` from the stored `position` — a seek, never a `play()` call, so it never violates the no-autoplay rule (PLAY-06).
  - Position persistence: `timeupdate` gated by `shouldPersist`, plus immediate flush on `pause`, `visibilitychange` (hidden), and unmount. Every write calls `db.books.update(id, { position })` — never a whole-record write.
  - Play/pause: the tap handler calls `audio.play()`/`audio.pause()` synchronously with nothing awaited first (iOS gesture-unlock requirement); play state is tracked from the element's own `play`/`pause` events.
- `components/player/transport-controls.tsx`: presentational play/pause button, 72×72px, Accent background, dark-on-amber icon (`#0A0A0A` on `#E8B34A`, ~10.4:1 contrast), `aria-label` toggling between "Play"/"Pause".
- `components/library-row.tsx`: foreground content div became a `next/link` `Link` to `/player/{book.id}`. `handleForegroundClick` now calls `event.preventDefault()` before closing the delete panel, so a tap that closes an open panel never also navigates. Swipe handlers (`handleTouchStart`/`Move`/`End`) on the outer `<li>` are untouched.

**Task 2 — Player screen states and chrome:**
- Distinguished "still loading" from "settled, no such book" — both of which `useLiveQuery` would otherwise report as `undefined` — via a module-level `LOADING` `Symbol` passed as `useLiveQuery`'s `defaultResult` argument. `queryResult === LOADING` means the first read hasn't resolved yet; anything else is a settled result (a `Book`, or `undefined` for not-found).
- Loading state: header only, no spinner, no flash of either other state.
- Not-found state: locked copy verbatim — "Book not found" / "This audiobook may have been deleted. Go back to your library." / "Back to Library" link to `/`. A malformed (non-integer) id and a genuinely deleted book both land here identically, matching 03-RESEARCH.md's Security Domain V5 resolution.
- Populated state: artwork placeholder (`#171717` square, `BookAudio` glyph at 96px, `#A3A3A3`, responsive max-width 240px), title in Heading typography clamped to 2 lines (`line-clamp-2`) with the untruncated title exposed via `aria-label`, and the Task 1 transport row.

## Deviations from Plan

**1. [Rule 1 - Bug] `bookRef.current = book` moved from render body into its own `useEffect`**
- **Found during:** Task 1, first `pnpm lint` run.
- **Issue:** The plan's literal example writes to the ref directly in the component body during render. This project's ESLint config includes the `react-hooks/refs` rule (React Compiler-era hooks linting), which errors on writing `ref.current` during render — "Cannot access refs during render."
- **Fix:** Moved the ref sync into a dependency-less `useEffect(() => { bookRef.current = resolvedBook; })`, declared first among the component's effects so it commits before the effects that read `bookRef.current` in the same render pass.
- **Files modified:** `app/player/[id]/page.tsx`.
- **Commit:** 4fb48e7.

**2. [Rule 1 - Bug] Object-URL/restore/persist/play-state effects keyed on `resolvedBook?.id`, not the plan's literal `book?.id` or a bare `bookId`**
- **Found during:** Task 1 design, before writing code.
- **Issue:** The plan's Pattern 4/2 code examples key these effects on `book?.id` where `book` is the raw `useLiveQuery` result. In this implementation `book`'s raw result also flows through the `LOADING` sentinel (added in Task 2), so effects had to key on `resolvedBook?.id` — the sentinel-narrowed value — to behave identically to the plan's intent (fire once on first resolution, never on the 5-second position-write churn).
- **Fix:** Used `resolvedBook?.id` throughout; behavior matches RESEARCH.md Pattern 2/4 exactly, just against the correctly-narrowed variable.
- **Files modified:** `app/player/[id]/page.tsx`.
- **Commit:** 4fb48e7, 8d0ff35.

**3. [Rule 1 - Bug] Loading-vs-not-found distinguished via a `useLiveQuery` `defaultResult` sentinel instead of a separate `useState` "settled" flag**
- **Found during:** Task 2 design.
- **Issue:** The plan suggested "a `useState` flag set from an effect that runs when the query result transitions out of its initial state, or an equivalent settled-marker." A naive settled-flag effect watching `book !== undefined` cannot distinguish "still loading" from "settled, no record" — both produce `undefined`.
- **Fix:** Passed a module-level `Symbol` as `useLiveQuery`'s third-arg `defaultResult`. Before the first resolution, `useLiveQuery` returns that sentinel; after resolution it returns the real result (`Book` or `undefined`), so `queryResult === LOADING` cleanly separates the two cases with no extra Dexie read and no separate state variable. This is "an equivalent settled-marker" per the plan's own escape hatch.
- **Files modified:** `app/player/[id]/page.tsx`.
- **Commit:** 8d0ff35.

No other deviations — the rest of the plan was executed as written.

## Known Stubs

None. All rendering states (loading, not-found, populated) resolve to real data or real navigation; no hardcoded/placeholder values.

## Auth Gates

None encountered — this app has no backend/auth (single-user, client-only PWA).

## Verification

- `pnpm lint`: passes, no errors.
- `pnpm build`: passes, emits a route for `/player/[id]`; one pre-existing CSS-optimizer warning about a literal `env(...)` string appears (traced to bracket-looking text inside `.planning/phases/03-playback-resume/03-01-PLAN.md` and `03-UI-SPEC.md` being picked up by Tailwind's content scanner) — not caused by this plan's code changes, out of scope per the deviation rules' scope boundary.
- `pnpm test:logic`: 14/14 pass, including the 4 new `shouldPersist` cases.
- All automated `<verify>` grep assertions from both tasks pass (confirmed via direct shell checks, listed in the plan's `<verify><automated>` blocks).
- The `<human-check>` blocks in both tasks (physical iPhone: cold-launch gesture-unlock, ~5s-cadence position-write stutter check, force-quit/relaunch resume; long-title clamping, swipe-delete-then-back-navigate not-found path, no state-flash on open) require a physical device not available in this execution environment. Per `workflow.human_verify_mode: "end-of-phase"` and this plan's own `environment_constraints`, these are deferred to end-of-phase device verification and harvested into `03-UAT.md` at that time — not a blocking checkpoint for this plan.

## Self-Check: PASSED

- `lib/playback.ts` — FOUND
- `app/player/[id]/page.tsx` — FOUND
- `components/player/transport-controls.tsx` — FOUND
- Commit 4fb48e7 — FOUND (`git log --oneline --all`)
- Commit 8d0ff35 — FOUND (`git log --oneline --all`)
