---
phase: 02-import-library
plan: 02
subsystem: ui
tags: [radix, alert-dialog, progress, swipe-to-delete, dexie, react]

# Dependency graph
requires:
  - phase: 02-import-library
    plan: "02-01"
    provides: "lib/db.ts (Dexie chokepoint, Book shape), lib/format.ts (percentComplete/formatTimeRemaining), app/page.tsx's inline row and useLiveQuery-backed list this plan extracted and expanded"
provides:
  - "components/ui/alert-dialog.tsx — hand-vendored Radix alert-dialog primitives (9 named exports)"
  - "components/ui/progress.tsx — hand-vendored Radix progress bar rendering the Accent token"
  - "components/library-row.tsx — real progress bar, truncating title, swipe-to-delete, D-08 confirmation, db.books.delete"
  - "components/import-trigger.tsx — shared file-picker trigger (empty-state tap target + header Plus button)"
  - "app/page.tsx — composes the extracted components, header trigger gated on populated state"
affects: ["02-03", "phase-3-playback"]

# Actuals (#2632)
actuals:
  tokens: 5655
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: ["@radix-ui/react-alert-dialog@1.1.23", "@radix-ui/react-progress@1.1.16"]
  patterns:
    - "Hand-vendored components/ui/* primitives (no shadcn CLI) because registry.ui.shadcn.com is proxy-blocked in this environment — same Radix wrapping and new-york composition the CLI would generate, authored in-repo instead of fetched"
    - "No cn()/clsx/tailwind-merge/class-variance-authority anywhere in this repo — class strings composed with plain template literals, keeping the dependency surface to exactly the four packages 02-RESEARCH.md approved"
    - "Plain touch-event swipe gesture (no gesture library): startX/startY captured on touchstart, horizontal delta clamped to the panel width on touchmove, latch-vs-spring-back decided on touchend against a 48px threshold, vertical-dominant deltas suppressed so it never fights page scroll"
    - "Delete is reachable only through Radix AlertDialogAction — the swipe-revealed panel is the AlertDialogTrigger, never a direct db.books.delete call from a touch/click handler"

key-files:
  created:
    - components/ui/alert-dialog.tsx
    - components/ui/progress.tsx
    - components/library-row.tsx
    - components/import-trigger.tsx
  modified:
    - app/page.tsx
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Hand-authored both components/ui/* files instead of running npx shadcn add, per 02-02-PLAN.md's environment_constraints — registry.ui.shadcn.com returns 403 in this sandbox (re-confirmed, consistent with Phase 1's 01-01-SUMMARY.md finding). Installed the two Radix primitives directly from registry.npmjs.org at the exact researched versions instead."
  - "Fixed an ESLint react-hooks/refs violation (Cannot access refs during render) by deriving the swipe-panel's CSS transition from the dragX state value (null = not dragging) rather than reading isDragging.current inside the render/style object — documented under Deviations below."
  - "Tap-to-close: touching the row's foreground content while the delete panel is revealed closes it without deleting anything, satisfying the plan's 'touching anywhere else... closes the revealed panel' requirement at the single-row scope this task's file boundary (components/library-row.tsx only) allows. Cross-row auto-close (tapping a different row closes this one) would require lifting swipe state to app/page.tsx, which is out of this task's file scope — not implemented, flagged for a future plan if it proves necessary in practice."

patterns-established:
  - "Storage-boundary comment-header convention (from lib/db.ts) extended to components/ui/alert-dialog.tsx and components/ui/progress.tsx, documenting why they're hand-vendored rather than CLI-generated, so Phase 3 doesn't rediscover the shadcn-registry block."

requirements-completed: [LIBR-01, LIBR-03, LIBR-04, LIBR-05]

coverage:
  - id: D1
    description: "Each library row renders a real Radix Progress bar and a percent/time-remaining line, both computed from the book's stored position and duration — never a hardcoded literal"
    requirement: "LIBR-04"
    verification:
      - kind: unit
        ref: "grep -c 'percentComplete' components/library-row.tsx && grep -c 'formatTimeRemaining' components/library-row.tsx"
        status: pass
      - kind: integration
        ref: "pnpm build && pnpm lint && pnpm test:logic (all pass)"
        status: pass
      - kind: manual_procedural
        ref: "Physical-iPhone check: long-title truncation, Accent bar fill, header Plus visibility (Task 2 human-check)"
        status: unknown
    human_judgment: true
    rationale: "No physical iPhone is available in this environment; visual/touch-target confirmation cannot be substituted by automated checks. Logged to WINDOWS.md entry #3."
  - id: D2
    description: "Swiping a row reveals a Destructive delete action with no permanently-visible delete icon at rest; tapping it shows the D-08 confirmation verbatim; confirming calls db.books.delete exactly once, freeing the Blob and metadata together; cancelling deletes nothing and resets the panel"
    requirement: "LIBR-05"
    verification:
      - kind: unit
        ref: "grep -c 'db.books.delete' components/library-row.tsx (1 real call site) && grep -cF \"and free its storage? This can\" components/library-row.tsx"
        status: pass
      - kind: unit
        ref: "grep -rn 'window.confirm' components app lib (no matches)"
        status: pass
      - kind: manual_procedural
        ref: "Physical-iPhone check: swipe reveal/spring-back, verbatim dialog text, cancel/confirm behavior, post-relaunch persistence of deletion (Task 3 human-check)"
        status: unknown
    human_judgment: true
    rationale: "Touch-gesture feel and cross-session persistence are only meaningfully provable on the real installed PWA, not this sandbox. Logged to WINDOWS.md entry #3."
  - id: D3
    description: "The phase's dependency surface stays exactly the four packages 02-RESEARCH.md approved — no clsx/tailwind-merge/class-variance-authority added despite hand-authoring shadcn-shaped components"
    requirement: "N/A (supply-chain constraint, threat T-02-SC)"
    verification:
      - kind: unit
        ref: "node -e checking package.json dependencies/devDependencies for clsx, tailwind-merge, class-variance-authority (none present) and for @radix-ui/react-alert-dialog + @radix-ui/react-progress (both present)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 2: Real Library Row, Swipe-to-Delete Summary

**The tracer's inline row becomes a fully managed component: a hand-vendored Radix `Progress` bar renders the Accent token for the first time, titles truncate with an accessible full-text `aria-label`, and a plain-touch-event swipe reveals a Destructive delete panel gated by a hand-vendored `AlertDialog` carrying the D-08 confirmation verbatim before `db.books.delete` frees the book's Blob and metadata in one call.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-09
- **Completed:** 2026-08-09
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 7 (4 new, 1 modified, plus `package.json`/`pnpm-lock.yaml`)

## Accomplishments
- Hand-vendored `components/ui/alert-dialog.tsx` and `components/ui/progress.tsx` wrapping `@radix-ui/react-alert-dialog@1.1.23` and `@radix-ui/react-progress@1.1.16` — the shadcn registry is proxy-blocked here, so both files are authored in-repo instead of CLI-generated, with identical component API surface and styled to the locked dark-neutral tokens. No `cn()` helper, no `clsx`/`tailwind-merge`/`class-variance-authority` — the dependency surface stays exactly the four packages 02-RESEARCH.md approved.
- Extracted `components/library-row.tsx` (real `Progress` bar, single-line truncating title, full-title `aria-label`) and `components/import-trigger.tsx` (one file-picker implementation serving both the empty-state tappable copy and the populated-state header `Plus` button), slimming `app/page.tsx` down to composition.
- Wired swipe-to-delete entirely with plain touch events (no gesture library): 48px latch threshold, 96px Destructive panel, vertical-dominant deltas suppressed so the gesture never fights page scroll. The panel is the `AlertDialogTrigger` — there is no delete icon visible in the row's resting state (D-07).
- The confirmation dialog reproduces D-08's copy character-for-character with the cleaned title interpolated; confirming calls `db.books.delete` exactly once (Blob + metadata co-located, so one call frees both); cancelling closes the dialog and resets the swipe panel without deleting anything.
- `pnpm build`, `pnpm lint`, and `pnpm test:logic` (10/10) all pass after every task; `pnpm verify:pwa` still passes the same 25/27 assertions as Plan 02-01 (the 2 expected failures are pre-existing and unrelated to this plan — see Issues Encountered).

## Task Commits

Each task was committed atomically:

1. **Task 1: Vendor the Radix alert-dialog and progress primitives** — `7d30105` (feat)
2. **Task 2: Extract the real library row and the shared import trigger** — `a3d67af` (feat)
3. **Task 3: Swipe-to-delete with the locked confirmation, freeing the book's storage** — `8081f57` (feat)

**Plan metadata:** pending (this SUMMARY's own commit)

## Files Created/Modified
- `components/ui/alert-dialog.tsx` - hand-vendored Radix alert-dialog, 9 named exports, Destructive `#DC2626` on the confirm action
- `components/ui/progress.tsx` - hand-vendored Radix progress, Accent `#E8B34A` fill (first on-screen use of this token)
- `components/library-row.tsx` - one book: title, progress bar, percent/time-remaining line, swipe-to-delete, confirmation, `db.books.delete`
- `components/import-trigger.tsx` - shared file-picker trigger, `variant="empty" | "header"`
- `app/page.tsx` - composes the extracted components; header trigger renders only when the library is populated
- `package.json` / `pnpm-lock.yaml` - adds `@radix-ui/react-alert-dialog@1.1.23`, `@radix-ui/react-progress@1.1.16`

## Decisions Made
- Hand-authored both `components/ui/*` files instead of `npx shadcn add` — the registry host is unreachable in this environment (re-confirmed, matching Phase 1's finding), and the plan's `environment_constraints` explicitly anticipated this as an acquisition-path change, not a scope reduction.
- Derived the swipe panel's CSS `transition` from the `dragX` state value rather than a ref read inside the render/style object, after ESLint's `react-hooks/refs` rule flagged the original ref-in-render approach — see Deviations.
- Left cross-row auto-close (tapping a different row closing this one's revealed panel) unimplemented — the task's file scope is `components/library-row.tsx` only, and that behavior requires state lifted to `app/page.tsx`. Tap-to-close within the same row is implemented and covers the common case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `react-hooks/refs` ESLint violation in the swipe transition style**
- **Found during:** Task 3 (`components/library-row.tsx`), running `pnpm lint`
- **Issue:** The initial implementation read `isDragging.current` directly inside the row's inline `style` object during render, to decide whether to animate the swipe transition. ESLint's `react-hooks/refs` rule (new in this React 19 toolchain) flagged this as "Cannot access refs during render" — refs are meant to be read in event handlers/effects, not render.
- **Fix:** Replaced the ref read with a check against the existing `dragX` state (`null` when not actively dragging), which was already being set correctly on touch move/end and is safe to read during render.
- **Files modified:** `components/library-row.tsx`
- **Verification:** `pnpm lint` exits 0; `pnpm build` still passes; swipe behavior unchanged (dragX's null/non-null transitions exactly track the same moments isDragging.current would have).
- **Committed in:** `8081f57` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 lint/type-safety bug)
**Impact on plan:** Necessary for the plan's own stated acceptance criteria (`pnpm lint` exits 0). No scope creep — no new files, no behavior change.

## Issues Encountered

**`pnpm verify:pwa http://localhost:3000` still fails the same 2 of 27 assertions Plan 02-01 recorded — expected, not a new regression.** Running the plan-level verification item 3 against a production build (`pnpm build && pnpm start`) passes 25/27, identical to Plan 02-01's result: the two failures (`HTML contains 'No audiobooks yet'` / `HTML contains 'Import an audiobook to start listening.'`) are both client-rendered text that cannot appear in the raw, un-hydrated SSR HTML `curl` fetches, by the same `useLiveQuery()`-undefined-first-render design documented in 02-01-SUMMARY.md's Issues Encountered. This plan changed nothing about that rendering boundary — the empty-state branch and its exact copy are still present and reachable in `app/page.tsx`, now via `ImportTrigger`'s children instead of an inline `<p>`. Already logged to `.planning/WINDOWS.md` (entry #2, opened by Plan 02-01); no duplicate entry added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The library row is now fully real: a working Accent-colored progress bar, truncating titles, and a swipe-to-delete path that frees storage in one Dexie call — all four of this plan's success criteria (LIBR-04, LIBR-03, D-07/D-08, LIBR-05) are code-complete and gated by automated checks.
- Plan 02-03 can now add the transient import-placeholder row and the inline dismissible error banner on top of this composed `app/page.tsx` without further row-level refactoring.
- **Blocker carried forward, unresolved:** the standing Phase 2 blocker in STATE.md ("IndexedDB Blob storage behavior on iOS Safari... must be validated on a real device") remains open. This plan adds new physical-device-only checks (swipe feel, progress-bar fill, dialog copy, post-relaunch deletion persistence) to that same standing gap — see WINDOWS.md entry #3.

## PHYSICAL-DEVICE VERIFICATION STILL REQUIRED (relay to user)

Tasks 2 and 3's `<verify>` blocks each include a `human-check` item requiring a physical iPhone, which could not be performed in this sandboxed environment. **Neither is marked passed, and neither has been fabricated — both are explicit open items, now logged in `.planning/WINDOWS.md` (entry #3):**

> Import three books with deliberately long filenames on the installed iPhone PWA. Confirm every title stays on one line with an ellipsis and never wraps or pushes the row taller, the progress bar renders at zero fill in the amber Accent, the line below reads zero percent with a plausible time remaining, and the header Plus button is present now that the library is populated but was absent when it was empty.
>
> On the installed iPhone PWA with several books imported: swipe a row left and confirm the red panel is revealed without the page scrolling sideways; swipe back right and confirm it closes with nothing deleted. Swipe again, tap Delete, and confirm the dialog reads exactly "Delete book: Remove '{that book's cleaned title}' and free its storage? This can't be undone." Tap Cancel and confirm the book is still there and the panel reset. Repeat and tap Delete, and confirm the row vanishes immediately with no refresh. Then force-quit and relaunch to confirm the deleted book is gone for good and the others survive.

Every automated check in Tasks 1-3 passed (build, lint, structural grep gates, `test:logic`, and `verify:pwa`'s 25/27 installability assertions — see Issues Encountered above for the 2 expected exceptions, unchanged from Plan 02-01). Only these device-dependent checks remain outstanding.

## Self-Check: PASSED

All 4 newly-created files found on disk; all 3 commit hashes (`7d30105`, `a3d67af`, `8081f57`) found in git log.

---
*Phase: 02-import-library*
*Completed: 2026-08-09*
