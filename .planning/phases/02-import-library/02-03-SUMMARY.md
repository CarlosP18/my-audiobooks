---
phase: 02-import-library
plan: 03
subsystem: ui
tags: [dexie, react, import-pipeline, error-handling]

# Dependency graph
requires:
  - phase: 02-import-library
    plan: "02-02"
    provides: "components/library-row.tsx (row shape/dimensions to match), app/page.tsx's composed useLiveQuery-backed list this plan wraps with per-file orchestration"
provides:
  - "lib/import.ts — ImportErrorReason (4-member union) and ImportError class carrying reason + filename, typed at every throw site"
  - "components/import-error-banner.tsx — dismissible D-03 banner rendering the four locked copy variants, never the Destructive color"
  - "components/import-placeholder-row.tsx — transient in-flight row (D-02), spinner + 'Importing…', no fabricated percentage"
  - "app/page.tsx — per-file import orchestration: independent pipeline per picked file, id-keyed placeholders, single replacing error banner"
affects: ["phase-3-playback"]

# Actuals (#2632)
actuals:
  tokens: 3482
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed failure taxonomy (ImportErrorReason discriminated union + ImportError class) decouples the four locked UI-SPEC copy variants from the pipeline's internal error messages, so lib/import.ts and components/import-error-banner.tsx can't drift out of sync by editing one side's string"
    - "In-flight import state lives in app/page.tsx component state (not Dexie) keyed by a locally generated numeric id, never filename — placeholders render above persisted rows in the same list container so D-02's empty-library-first-row case falls out of the same rendering path as the populated case"
    - "Populated-state layout (header Plus trigger + row list) renders whenever persisted books OR in-flight imports are non-zero, per 02-UI-SPEC.md's Layout section explicitly defining 'populated' to include the transient placeholder row — the empty state is now gated on both counts being zero"

key-files:
  created:
    - components/import-error-banner.tsx
    - components/import-placeholder-row.tsx
  modified:
    - lib/import.ts
    - app/page.tsx

key-decisions:
  - "Banner independently maps ImportErrorReason + filename to copy (not err.message directly) — matches Claude's Discretion #2 in 02-03-PLAN.md: a typed reason keyed by the component, not string-matched from the thrown message, keeps the UI-SPEC's locked copy table and the pipeline's error messages from drifting apart even though today they happen to read identically."
  - "Populated-state layout (header trigger + list) is shown whenever `books.length > 0 || inFlight.length > 0`, not gated on persisted books alone — 02-UI-SPEC.md's Layout section text ('Populated state (1+ books, including the transient placeholder row)') already resolves this rather than leaving it to discretion, so an empty library with one file mid-import shows the header Plus button and the placeholder as the list's only row."
  - "No new id-generation dependency (no crypto.randomUUID) — a simple useRef<number> counter is enough for locally-scoped, single-session placeholder keys and keeps the phase's dependency surface unchanged."

patterns-established:
  - "Per-deliverable error taxonomy pattern: a service module (lib/import.ts) exports a typed reason enum + a custom Error subclass carrying it; the presentation layer (import-error-banner.tsx) owns the copy-mapping switch, not the service module — reusable for any future typed-failure UI in this app."

requirements-completed: [IMPT-01, IMPT-02, LIBR-01]

coverage:
  - id: D1
    description: "A placeholder row appears immediately (with the cleaned title, no fabricated percentage) for each in-flight import, on both the empty and populated library, and resolves into the real row without a visual jump once the write succeeds"
    requirement: "LIBR-01"
    verification:
      - kind: unit
        ref: "grep -c 'LoaderCircle' components/import-placeholder-row.tsx && grep -cF 'Importing' components/import-placeholder-row.tsx && grep -c 'animate-spin' components/import-placeholder-row.tsx && grep -c '#E8B34A' components/import-placeholder-row.tsx"
        status: pass
      - kind: unit
        ref: "! grep -q 'percentComplete' components/import-placeholder-row.tsx && ! grep -q 'formatTimeRemaining' components/import-placeholder-row.tsx"
        status: pass
      - kind: integration
        ref: "pnpm build && pnpm lint && pnpm test:logic && pnpm verify:pwa http://localhost:3000 (all pass; verify:pwa at the same pre-existing 25/27, see Issues Encountered)"
        status: pass
      - kind: manual_procedural
        ref: "Physical-iPhone check: placeholder appears/resolves without jump on empty and populated library (Task 2 human-check items 1-2)"
        status: unknown
    human_judgment: true
    rationale: "No physical iPhone is available in this environment; the visual no-jump resolution and empty-library first-row behavior can only be meaningfully confirmed on the real installed PWA. Logged to WINDOWS.md entry #4."
  - id: D2
    description: "Every import failure carries a typed cause and the banner renders the exact locked copy for each of the four causes on the Secondary surface (never Destructive) with a working, always-visible-until-acknowledged dismiss control; a later success or manual dismissal clears it, and a new failure replaces rather than stacks"
    requirement: "IMPT-01"
    verification:
      - kind: unit
        ref: "grep -c 'ImportError' lib/import.ts && grep -cF 'only MP3, M4A, and M4B files are supported.' components/import-error-banner.tsx && grep -cF 'Not enough storage to import' components/import-error-banner.tsx && grep -cF 'the file may be corrupted or unsupported.' components/import-error-banner.tsx && grep -cF 'Try again.' components/import-error-banner.tsx && grep -cF 'aria-label=\"Dismiss error\"' components/import-error-banner.tsx"
        status: pass
      - kind: unit
        ref: "! grep -q 'DC2626' components/import-error-banner.tsx"
        status: pass
      - kind: integration
        ref: "pnpm build && pnpm lint && pnpm test:logic (all pass)"
        status: pass
      - kind: manual_procedural
        ref: "Physical-iPhone check: non-audio pick raises correct dismissible variant, mixed multi-select imports valid file while reporting only the invalid one, banner clears on next success (Task 2 human-check items 3-5)"
        status: unknown
    human_judgment: true
    rationale: "Real-device Files-app picker behavior for non-audio selections and multi-select combinations cannot be simulated in this sandbox. Logged to WINDOWS.md entry #4."
  - id: D3
    description: "A file whose duration cannot be read is treated as a failed import and never written as a partial record with an unknown duration; multi-select runs each file's pipeline independently so one failure never blocks or rolls back the others"
    requirement: "IMPT-02"
    verification:
      - kind: unit
        ref: "grep -c 'db.books.add' lib/import.ts (single call site, unchanged position relative to the duration read/catch)"
        status: pass
      - kind: integration
        ref: "pnpm build && pnpm test:logic (TypeScript + existing logic tests pass; importFile's early-throw structure on the extension gate and duration rejection is unchanged from Plan 02-01, only the throw arguments changed)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 3: Placeholder Row and Inline Error Banner Summary

**A typed `ImportErrorReason` taxonomy in `lib/import.ts` drives four locked copy variants in a dismissible `ImportErrorBanner`, while `app/page.tsx` now runs each picked file's import as an independent, id-keyed pipeline that shows a spinner-and-"Importing…" placeholder row until the write resolves — closing the phase's last silent-failure gap.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-09
- **Completed:** 2026-08-09
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 4 (2 new, 2 modified)

## Accomplishments
- `lib/import.ts` exports `ImportErrorReason` (`"unsupported-format" | "insufficient-storage" | "unreadable-file" | "generic"`) and an `ImportError` class carrying that reason plus the offending filename; every existing throw site now raises the correctly-typed reason instead of only a message string. The single `db.books.add()` write and its no-unrelated-awaits structure (Plan 02-01's Pitfall 3/4 guarantees) are unchanged.
- `components/import-error-banner.tsx` maps a typed reason + filename to one of the four copy variants locked verbatim in `02-UI-SPEC.md`'s Import Failure table, on the Secondary surface (`#171717`) with an `X` dismiss control (`aria-label="Dismiss error"`, 44×44px hit area) — deliberately never the Destructive color, reserved exclusively for the delete action per the Color section's lock.
- `components/import-placeholder-row.tsx` renders the cleaned title immediately (synchronous, no wait on the async duration read) plus a spinning `LoaderCircle` in Accent (`#E8B34A`) and "Importing…" text — no percentage, matching the row container's exact surface/rounding/padding/min-height so it resolves into the real row without a visual jump.
- `app/page.tsx` now starts each picked file's pipeline independently on selection (no `Promise.all`, no shared await), keying in-flight placeholders by a locally generated counter id rather than filename so same-named files from different folders don't collide. Placeholders render above persisted rows in the same list, so the empty-library case shows the placeholder as the first and only row — the empty state itself is now gated on `books.length === 0 && inFlight.length === 0`, per `02-UI-SPEC.md`'s definition of "populated" as including the placeholder row.
- Exactly one error banner shows at a time: the newest failure always replaces whatever is currently displayed, it clears automatically on the next successful import, and it clears on manual dismiss. It never auto-times-out.
- `pnpm build`, `pnpm lint`, `pnpm test:logic` (10/10), and `pnpm verify:pwa` (25/27, same 2 pre-existing expected failures as Plans 02-01/02-02) all pass. Zero new dependencies added.

## Task Commits

Each task was committed atomically:

1. **Task 1: Give import failures a typed cause and a locked inline banner** - `dd6d882` (feat)
2. **Task 2: Show work in flight and wire the per-file import pipeline** - `b807767` (feat)

**Plan metadata:** pending (this SUMMARY's own commit)

## Files Created/Modified
- `lib/import.ts` - adds `ImportErrorReason` union and `ImportError` class; every throw site now carries a typed reason and filename alongside its message
- `components/import-error-banner.tsx` - new: dismissible inline banner, four locked copy variants keyed by typed reason, no Destructive color
- `components/import-placeholder-row.tsx` - new: transient in-flight row, spinner + "Importing…", row-shape parity with `library-row.tsx`
- `app/page.tsx` - per-file orchestration: independent pipeline per picked file, id-keyed placeholder state, single-slot error banner state, empty state gated on zero persisted books AND zero in-flight imports

## Decisions Made
- The banner computes copy from `(reason, filename)` independently rather than rendering `ImportError.message` directly — keeps the UI-SPEC's locked copy table as the single source of truth for what's shown, decoupled from whatever wording the pipeline's own error messages happen to carry (Claude's Discretion #2, 02-03-PLAN.md).
- Populated-state layout (header `Plus` trigger + row list) renders whenever there's at least one persisted book **or** at least one in-flight import, not gated on persisted books alone — directly following `02-UI-SPEC.md`'s Layout section text defining "populated" to include the transient placeholder row, not left as an open discretion call.
- Used a `useRef<number>` counter for placeholder ids instead of `crypto.randomUUID()` — simpler, zero new API surface, and sufficient for keys scoped to a single client session.
- Did not touch `components/import-trigger.tsx` — its `event.target.value = ""` reset (required by the plan's action text) was already present from Plan 02-02, so re-picking the same file already fires a fresh change event with no change needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed a literal Destructive hex from an explanatory code comment**
- **Found during:** Task 1 (`components/import-error-banner.tsx`), running the plan's own `! grep -q "DC2626"` verification gate
- **Issue:** The file's header comment explained the no-Destructive-color rule by citing the literal hex `#DC2626` for clarity, which itself matched the plan's grep assertion that the string must appear nowhere in the file (a self-referential trap: the comment describing the prohibition violated the prohibition's own text-match check).
- **Fix:** Reworded the comment to reference "the Destructive color token" without spelling out its hex value; the prohibition and its rationale are unchanged, only the literal string is gone.
- **Files modified:** `components/import-error-banner.tsx`
- **Verification:** `! grep -q "DC2626" components/import-error-banner.tsx` passes; `pnpm build`/`pnpm lint` unaffected.
- **Committed in:** `dd6d882` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a verification-gate false-positive on a comment, not a behavior bug)
**Impact on plan:** Cosmetic only — no scope change, no functional difference. Necessary to pass the plan's own stated acceptance criterion.

## Issues Encountered

**`pnpm verify:pwa http://localhost:3000` still fails the same 2 of 27 assertions Plans 02-01/02-02 recorded — expected, not a new regression.** The two failures (`HTML contains 'No audiobooks yet'` / `HTML contains 'Import an audiobook to start listening.'`) are both client-rendered text absent from the raw, un-hydrated SSR HTML `curl` fetches, per the same `useLiveQuery()`-undefined-first-render design documented in 02-01-SUMMARY.md. This plan changed nothing about that rendering boundary. Already logged to `.planning/WINDOWS.md` (entry #2, opened by Plan 02-01); no duplicate entry added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 2's import pipeline now reports honestly in every state: happy path (Plan 02-01), populated row with real progress and swipe-to-delete (Plan 02-02), and now in-flight and failure states (this plan). All three plans in Phase 2 are code-complete and automated-check-clean.
- **This is the final plan in Phase 2.** After this plan, only the phase's end-of-phase physical-device human-verification pass remains (`human_verify_mode: end-of-phase` per `.planning/config.json`) — no further automated work is scoped for this phase.
- **Blocker carried forward, unresolved:** the standing Phase 2 blocker in STATE.md ("IndexedDB Blob storage behavior on iOS Safari... must be validated on a real device") remains open. This plan adds the D-02/D-03 device-only checks (placeholder no-jump resolution, non-audio-pick banner variant, mixed multi-select behavior, banner auto-clear on success) to that same standing gap — see WINDOWS.md entry #4.
- Phase 3 (Playback & Resume) can build on a fully data-driven, honestly-reporting library screen with no known stubs or silently-swallowed failures.

## PHYSICAL-DEVICE VERIFICATION STILL REQUIRED (relay to user)

Task 2's `<verify>` block includes a `human-check` item requiring a physical iPhone, which could not be performed in this sandboxed environment. **Not marked passed, not fabricated — logged as an explicit open item in `.planning/WINDOWS.md` (entry #4):**

> On the installed iPhone PWA: (1) import a large audiobook and confirm a placeholder row with a spinning amber icon and "Importing…" appears immediately with the cleaned title already readable, then resolves into the real row without the row jumping or resizing. (2) Do the same on an empty library and confirm the placeholder is the first and only row. (3) Pick a non-audio file such as a photo or PDF and confirm the banner reads the MP3/M4A/M4B variant naming that file, that it is dismissible, and that the app stays fully usable. (4) Multi-select one valid audio file and one non-audio file together and confirm the valid one imports while the invalid one raises its own banner. (5) Import successfully afterward and confirm the banner clears on its own.

Every automated check in Tasks 1-2 passed (build, lint, structural grep gates, `test:logic` 10/10, and `verify:pwa`'s 25/27 installability assertions — the 2 expected exceptions are pre-existing and unrelated to this plan, see Issues Encountered above). Only this device-dependent check remains outstanding, alongside the Plan 02-01/02-02 device checks already logged in WINDOWS.md entries #1 and #3. Per this project's `end-of-phase` verification mode, all of Phase 2's device checks (this plan's and the two prior plans') should be run together in one physical-device pass before the phase is considered fully closed.

## Self-Check: PASSED

All 4 files found on disk (`lib/import.ts`, `components/import-error-banner.tsx`, `components/import-placeholder-row.tsx`, `app/page.tsx`); both commit hashes (`dd6d882`, `b807767`) found in git log.

---
*Phase: 02-import-library*
*Completed: 2026-08-09*
