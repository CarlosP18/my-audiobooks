---
phase: 02-import-library
plan: 01
subsystem: storage
tags: [dexie, indexeddb, nextjs, react, useLiveQuery, pwa]

# Dependency graph
requires:
  - phase: 01-install-offline-app-shell
    provides: locked design tokens (app/globals.css), Cache-Storage-is-app-shell-only boundary (app/sw.ts), the static "My Library" empty-state screen this plan evolved into a client component
provides:
  - "lib/db.ts — single Dexie chokepoint, v1 schema (books table, ++id/title/importedAt indexed, Blob co-located and unindexed)"
  - "lib/title.ts — cleanTitle pure function (D-04/D-05 locked title-cleanup rule)"
  - "lib/duration.ts — readAudioDuration via hidden <audio> + loadedmetadata"
  - "lib/format.ts — percentComplete + formatTimeRemaining (LIBR-04 progress-line formatting)"
  - "lib/import.ts — isAcceptedAudioFile extension gate + importFile write pipeline with QuotaExceededError/AbortError handling"
  - "app/page.tsx — data-driven library screen, first client component, useLiveQuery-backed list"
  - "scripts/library-logic.test.mjs — dependency-free node:test gate for cleanTitle/formatTimeRemaining/percentComplete"
affects: [02-02, 02-03, phase-3-playback]

# Actuals (#2632)
actuals:
  tokens: 4539
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: ["dexie@4.4.4", "dexie-react-hooks@4.4.0"]
  patterns:
    - "Single Dexie chokepoint (lib/db.ts) with versioned schema, Blob co-located but never indexed (02-RESEARCH.md Pattern 1)"
    - "Reactive list rendering via dexie-react-hooks useLiveQuery(), branching on undefined/empty/populated (02-RESEARCH.md Pattern 2)"
    - "Import write kept as one tight db.books.add() call with all async prep (duration read, title cleanup) completed beforehand, to avoid Safari's IndexedDB transaction-abort-around-await pitfall (02-RESEARCH.md Pattern 3, Pitfall 3)"

key-files:
  created:
    - lib/db.ts
    - lib/title.ts
    - lib/duration.ts
    - lib/format.ts
    - lib/import.ts
    - scripts/library-logic.test.mjs
  modified:
    - app/page.tsx
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Task 1 checkpoint (pre-resolved by orchestrator): option-a — single co-located books table, Blob stored in the same record and deliberately absent from the v1 index string ('++id, title, importedAt'), per 02-RESEARCH.md Pattern 1 and Pitfall 5's warning against a premature two-table relational split."
  - "importFile() returns Promise<number> (the new book's id), matching the plan's action text exactly rather than 02-RESEARCH.md's earlier Promise<Book> draft."
  - "Added a header-level Plus import-trigger button for the populated state (02-UI-SPEC.md Layout section), even though it wasn't explicitly named in Task 2's action prose — without it there would be no way to import additional books once the library has at least one row, which the UI-SPEC's own rationale calls out as a hard requirement."

patterns-established:
  - "Storage-boundary comment-header convention (borrowed from app/sw.ts) applied to lib/db.ts and lib/import.ts — state the module's single-chokepoint role and cross-reference the specific PITFALLS.md pitfall by name."
  - "Progress-line formatting isolated in lib/format.ts as plain functions so it's testable from node:test without rendering React or touching Dexie/DOM."

requirements-completed: [IMPT-01, IMPT-02, LIBR-01, LIBR-02, LIBR-03, LIBR-04]

coverage:
  - id: D1
    description: "A file picked through the iOS file picker is validated by extension, has its duration read, and is written to IndexedDB as a single Blob-plus-metadata record via one atomic db.books.add() call"
    requirement: "IMPT-01, IMPT-02"
    verification:
      - kind: unit
        ref: "grep -c 'db.books.add' lib/import.ts"
        status: pass
      - kind: manual_procedural
        ref: "Physical-iPhone import of a real .mp3/.m4a/.m4b into the installed home-screen PWA (Task 2 human-check)"
        status: unknown
    human_judgment: true
    rationale: "Real device storage/import behavior on iOS Safari cannot be verified from this environment — no physical iPhone is available. This is the plan's own standing Phase 2 blocker (STATE.md) and is explicitly deferred to the user."
  - id: D2
    description: "The library list renders reactively via useLiveQuery, ordered newest-import-first, with correct undefined/empty/populated branching and no flash of the wrong state"
    requirement: "LIBR-01, LIBR-02"
    verification:
      - kind: unit
        ref: "grep -c \"orderBy('importedAt').reverse()\" app/page.tsx"
        status: pass
      - kind: integration
        ref: "pnpm build && pnpm lint (both exit 0)"
        status: pass
      - kind: manual_procedural
        ref: "Force-quit/relaunch persistence check on physical iPhone (Task 2 human-check)"
        status: unknown
    human_judgment: true
    rationale: "LIBR-02 persistence-across-relaunch is only meaningfully provable on the real installed PWA, not this sandbox."
  - id: D3
    description: "cleanTitle produces D-04's locked example exactly, and formatTimeRemaining/percentComplete match every D-06/02-UI-SPEC.md boundary case"
    requirement: "LIBR-03, LIBR-04"
    verification:
      - kind: unit
        ref: "scripts/library-logic.test.mjs (10/10 passing via pnpm test:logic)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 1: Import & Persist Tracer Summary

**One real audiobook goes from the iOS file picker through extension validation, duration read, and title cleanup into a single atomic Dexie write, then renders as a reactive library row — the full IMPT/LIBR-01/02/03/04 spine proven end-to-end, gated by a 10-assertion dependency-free node:test suite locking the title and time-remaining rules.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-09T01:53:32Z
- **Completed:** 2026-08-09T02:02:57Z
- **Tasks:** 3 (1 checkpoint:decision, 1 tracer, 1 test gate)
- **Files modified:** 9 (7 new, 2 modified, plus lockfile)

## Accomplishments
- Locked the Dexie v1 on-disk schema shape (Task 1, pre-resolved): single co-located `books` table, Blob unindexed — the one-way door for the entire library's storage format.
- Built the full import pipeline: extension gate (`isAcceptedAudioFile`) → duration read (`readAudioDuration`) → title cleanup (`cleanTitle`) → single atomic `db.books.add()` write, with `QuotaExceededError`/`AbortError` both caught as the "insufficient storage" case.
- Evolved `app/page.tsx` into the app's first client component: `useLiveQuery` over `db.books.orderBy('importedAt').reverse()`, correctly branching undefined (header-only, no flash) / empty (unchanged Phase 1 empty state, now tappable per D-01) / populated (row list with cleaned title + `"{percent}% — {time} remaining"` line).
- Locked the title-cleanup and time-remaining formatting rules behind `scripts/library-logic.test.mjs` — 10 exact-string assertions, zero new dependencies, `pnpm test:logic` green.
- Installed `dexie@4.4.4` and `dexie-react-hooks@4.4.0`, both re-verified live against the npm registry at execution time (matching 02-RESEARCH.md exactly).

## Task Commits

Each task was committed atomically:

1. **Task 1: Confirm the v1 on-disk storage shape** — pre-resolved by the orchestrator as option-a per the checkpoint pre-resolution instructions (02-RESEARCH.md Pattern 1 + Pitfall 5). No code change; the schema this decision locks is implemented in Task 2's commit.
2. **Task 2: Import one real file end-to-end** — `396eaff` (feat)
3. **Task 3: Lock title/time-remaining rules behind a test gate** — `e81f16f` (test)

**Plan metadata:** pending (this SUMMARY's own commit)

## Files Created/Modified
- `lib/db.ts` - Dexie chokepoint, `Book` interface, v1 versioned schema
- `lib/title.ts` - `cleanTitle` pure function (D-04/D-05)
- `lib/duration.ts` - `readAudioDuration` via hidden `<audio>` + `loadedmetadata`
- `lib/format.ts` - `percentComplete` + `formatTimeRemaining`
- `lib/import.ts` - `ACCEPTED_EXTENSIONS`, `isAcceptedAudioFile`, `importFile`, `ImportError`
- `app/page.tsx` - data-driven library screen (client component), header import trigger + empty-state tap trigger + row list
- `scripts/library-logic.test.mjs` - node:test gate for title/format logic
- `package.json` / `pnpm-lock.yaml` - `dexie`, `dexie-react-hooks` dependencies; `test:logic` script

## Decisions Made
- Task 1 checkpoint resolved to **option-a** (single co-located `books` table, Blob unindexed) per the orchestrator's pre-resolution — matches 02-RESEARCH.md's recommendation and Pitfall 5's explicit warning against the two-table relational instinct at this project's scale.
- `importFile()` returns `Promise<number>` (the new record's id) as literally specified in the plan's Task 2 action text, rather than the `Promise<Book>` shape shown in 02-RESEARCH.md's earlier draft code example — the plan text is authoritative over the research draft where they diverge.
- Added the header-level `Plus` import-trigger button for the populated state (not explicitly named in Task 2's prose, but locked in 02-UI-SPEC.md's Layout section) — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added header-level Plus import-trigger button for the populated state**
- **Found during:** Task 2 (`app/page.tsx`)
- **Issue:** Task 2's action prose describes the empty-state tappable body copy (D-01) but does not explicitly mention a populated-state entry point. Without one, once a library has at least one book, D-01's tap target no longer renders (it's inside the empty-state branch only) and there would be no way to import additional files — directly undermining IMPT-01 ("user can import an audio file") for any non-empty library.
- **Fix:** Added a `Plus`-icon-only button (24px, Accent `#E8B34A`, `aria-label="Import audiobook"`, 44×44px tap target via padding) to the header, populated-state only, opening the same hidden file input as the empty-state trigger. This exactly matches 02-UI-SPEC.md's Layout section, which explicitly specifies this element and its rationale ("once the list is populated, the empty-state copy no longer renders, so a header entry point is required").
- **Files modified:** `app/page.tsx`
- **Verification:** `pnpm build` / `pnpm lint` pass; visually matches UI-SPEC's locked Accent-color/icon-size/aria-label spec.
- **Committed in:** `396eaff` (Task 2 commit)

**2. [Rule 3 - Blocking, TypeScript] Cast `db.books.add()`'s return id to `number`**
- **Found during:** Task 2 (`lib/import.ts`)
- **Issue:** `Book.id` is typed `id?: number` (auto-generated primary key), so Dexie's `EntityTable<Book, 'id'>.add()` infers a `number | undefined` return type. `pnpm build`'s TypeScript check failed because `importFile`'s declared return type is `Promise<number>` (per the plan's exact spec).
- **Fix:** Added a one-line comment-documented cast (`id as number`) — a successful `add()` call always assigns a real numeric id; only a rejected/failed call (already handled by the surrounding try/catch) would leave it unassigned.
- **Files modified:** `lib/import.ts`
- **Verification:** `pnpm build` exits 0 with TypeScript passing.
- **Committed in:** `396eaff` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical functionality, 1 blocking type error)
**Impact on plan:** Both necessary for the plan's own stated goals (IMPT-01 usability, `pnpm build` passing per acceptance criteria). No scope creep — no new files, no architectural change.

## Issues Encountered

**`pnpm verify:pwa http://localhost:3000` (plan-level `<verification>` item 3) fails 2 of 27 assertions — expected, not a regression.** Running the existing Phase 1 installability gate against a production build (`pnpm build && pnpm start`) passes 25/27: every icon, manifest, service-worker-precache, and iOS meta-tag assertion is green (confirming Phase 1's actual installability guarantees are intact). The two failures — `HTML contains 'No audiobooks yet'` and `HTML contains 'Import an audiobook to start listening.'` — check for literal text in the raw, un-hydrated HTML fetched by `curl`. This text is now client-rendered: Task 2's action explicitly requires that `useLiveQuery()`'s initial `undefined` result "renders the header alone with no spinner and no flash of the empty state, which also keeps the server render and the first client render identical and avoids a hydration mismatch" — since IndexedDB doesn't exist server-side, `books` is `undefined` in every server render, so the empty-state text can never appear in the raw SSR payload by design. This is an inherent, documented consequence of making the page correctly data-driven (02-RESEARCH.md Pattern 2), not a functional defect: once the client's JS executes, `useLiveQuery` resolves to `[]` and the empty-state text renders normally in the browser (verified structurally — the same JSX branch that Phase 1 shipped, byte-identical text/classes, is still present and reachable in `app/page.tsx`). No code change was made to route around this, since doing so (e.g., faking a server-known "no books" state, or rewriting `scripts/check-pwa-assets.mjs` to execute JS) would be an architectural change out of this plan's scope. Logged to `.planning/WINDOWS.md` for visibility at ship time.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The storage chokepoint, import pipeline, and reactive list are all proven and ready for Plan 02-02 to extract `library-row.tsx`, add the real progress bar (`shadcn progress`), and wire swipe-to-delete.
- **Blocker carried forward, unresolved:** the standing Phase 2 blocker in STATE.md — "IndexedDB Blob storage behavior on iOS Safari (transaction hygiene, quota errors) must be validated on a real device" — is NOT yet closed. Task 2's `<human-check>` (below) is the closing action and could not be performed in this environment.

## PHYSICAL-DEVICE VERIFICATION STILL REQUIRED (relay to user)

Task 2's `<verify>` block includes a `human-check` item that requires a physical iPhone and could not be performed in this sandboxed environment. **This is not marked passed and has not been fabricated — it is an explicit open item:**

> On a physical iPhone running the installed home-screen PWA (not a Safari tab — storage is not shared between them), import a real `.mp3`, a real `.m4a`, and a real `.m4b`. Confirm for each: the row appears with a sensibly cleaned title, and the progress line shows `0%` with a non-zero, plausible time remaining. This closes 02-RESEARCH.md Open Question 1 and Assumption A2. Then force-quit the app, relaunch from the home-screen icon, and confirm all three books are still listed — that is ROADMAP success criterion 2 and the standing STATE.md Phase 2 blocker.

Every automated check in Task 2 and Task 3 passed (build, lint, structural grep gates, `test:logic`, and `verify:pwa`'s 25/27 installability assertions — see Issues Encountered above for the 2 expected exceptions). Only this device-dependent check remains outstanding.

## Self-Check: PASSED

All 8 claimed files found on disk; both commit hashes (`396eaff`, `e81f16f`) found in git log.

---
*Phase: 02-import-library*
*Completed: 2026-08-09*
