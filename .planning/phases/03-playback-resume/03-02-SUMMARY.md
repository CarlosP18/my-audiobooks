---
phase: 03-playback-resume
plan: 02
subsystem: playback
tags: [time-readout, skip-controls, end-of-book, geist-mono, tdd]

dependency-graph:
  requires:
    - "lib/format.ts formatTimeRemaining (mirrored exactly by the new formatElapsed)"
    - "lib/playback.ts (Plan 01's POSITION_SAVE_THROTTLE_MS/shouldPersist module, extended here)"
    - "app/player/[id]/page.tsx (Plan 01's resolvedBook/bookRef/audioRef/effect-keying conventions)"
    - "components/player/transport-controls.tsx (Plan 01's play/pause button, extended to a three-control row)"
  provides:
    - "lib/format.ts export formatElapsed"
    - "lib/playback.ts exports SKIP_SECONDS, clampSeek"
    - "app/player/[id]/page.tsx elapsed state (consumed by Plan 03's scrub bar)"
    - "components/player/transport-controls.tsx onSkipBack/onSkipForward props"
  affects:
    - "app/player/[id]/page.tsx (three new effects: elapsed-init, UI-tick, ended-handler; two new handlers)"

tech-stack:
  added: []
  patterns:
    - "Live UI tick decoupled from the durable-write throttle: a dedicated timeupdate listener tracks the last whole-second value in a ref and calls setElapsed only when it changes, independent of the existing 5s shouldPersist-gated Dexie write"
    - "clampSeek as the single shared boundary function for both the ±15s skip handlers and the end-of-book ended handler — same clamp, two call sites, mechanically tested once"
    - "Symmetric formatter pairing: formatElapsed mirrors formatTimeRemaining's exact rounding-before-branching discipline, diverging only in the trailing word"

key-files:
  created: []
  modified:
    - "lib/format.ts"
    - "lib/playback.ts"
    - "scripts/library-logic.test.mjs"
    - "app/player/[id]/page.tsx"
    - "components/player/transport-controls.tsx"

decisions:
  - "elapsed is set explicitly inside handleSkipBack/handleSkipForward and the ended handler (not left to the next timeupdate tick) so the readout responds in the same tick as the user's tap or the terminal event, matching the plan's 'respond immediately' instruction."
  - "The end-of-book ended listener also calls setElapsed(Math.floor(audio.duration)) — a small Rule-2-adjacent addition beyond the plan's literal wording, for symmetry with the skip handlers and so the readout reflects 100% immediately rather than waiting on a timeupdate that may not fire again after ended."

metrics:
  duration: ~6 min
  completed: 2026-08-12

status: complete

actuals:
  tokens: 3922
  tasks: 2
  commits: 4
---

# Phase 3 Plan 2: Elapsed/remaining readout and 15-second skip controls Summary

Added the live elapsed/remaining time readout (word-based, minute-granularity, Geist Mono — the first on-screen use of the mono font) and the full three-control transport row (skip-back 15s / play-pause / skip-forward 15s), plus D-04's end-of-book terminal state that persists the book's stored position at its full duration rather than resetting it to zero.

## What Was Built

**Task 1 — Elapsed and remaining time on the player screen (PLAY-04):**
- `lib/format.ts`: `formatElapsed(secondsElapsed)`, structurally identical to the existing `formatTimeRemaining` — same round-to-whole-minutes-before-the-hour-boundary rule, differing only in the trailing word ("elapsed" vs "remaining"). Seven exact-equality `node --test` cases added covering the under-one-minute form, minutes-only form, hours form, the UI spec's `20m elapsed` / `5h 10m remaining` worked example, the `3599s → "1h 0m elapsed"` rounding edge, and `0s`.
- `app/player/[id]/page.tsx`: an `elapsed` state (whole seconds) initialized from the resolved record's stored `position` in an effect keyed on `resolvedBook?.id` — correct before the `<audio>` element has loaded metadata. A dedicated `timeupdate` listener (separate effect, also keyed on `resolvedBook?.id`) drives a roughly-once-per-second UI tick: it floors `audio.currentTime`, compares against the last observed whole second (tracked in a ref), and only calls `setElapsed` when that value actually changes — deliberately independent of the existing 5-second `shouldPersist`-gated database write. Renders a `justify-between` flex row in `font-mono`, Label typography, `#A3A3A3`, positioned between the title and the transport row (leaving the gap Plan 03's scrub bar will fill). The remaining value is `formatTimeRemaining(Math.max(duration - elapsed, 0))`, floored so it can never go negative.

**Task 2 — 15-second skip controls and the end-of-book terminal state (PLAY-02, D-04):**
- `lib/playback.ts`: `SKIP_SECONDS = 15` and `clampSeek(seconds, duration)` bounding a candidate value between 0 and `duration` inclusive. Five exact-equality test cases: interior pass-through, below-zero clamp to 0, past-duration clamp to `duration`, and both inclusive boundaries.
- `components/player/transport-controls.tsx`: extended from a single play/pause circle to the full three-control row (`items-center`, `gap-6`). Each skip button is a `44×44px` (`min-h-11 min-w-11`) tap target wrapping a `RotateCcw`/`RotateCw` icon (28px, `#F5F5F5`, `aria-hidden`) with a composited `"15"` numeral — an `absolute inset-0` span reusing Label typography at `font-mono`/weight 600, visually reduced via `transform: scale(0.7)`, nudged with `pt-[3px]`. Locked `aria-label`s `"Skip back 15 seconds"` / `"Skip forward 15 seconds"`. Neither button renders a `disabled` attribute or class — both stay enabled at the boundaries by design.
- `app/player/[id]/page.tsx`: `handleSkipBack`/`handleSkipForward` read `audio.currentTime`, apply `SKIP_SECONDS`, route the target through `clampSeek` bounded by the resolved record's `duration`, assign it back to `audio.currentTime`, and set `elapsed` to the same clamped value immediately — both handlers stay fully synchronous (no `await`), matching `handleTogglePlay`'s iOS gesture-unlock discipline. A new `ended`-listener effect, keyed on `resolvedBook?.id`, persists `position` as `audio.duration` through the same partial-field `db.books.update` path Plan 01 established (never a whole-record write, never a value that returns the book to the beginning — the `PLAY-06` prohibition), and sets `elapsed` to the floored duration so the readout shows the completed state without waiting on another `timeupdate`. The play/pause button reverts to its Play icon through the existing `play`/`pause` event listeners, unchanged.

## TDD Gate Compliance

Both tasks followed RED → GREEN as separate commits, verified by actually removing the new export before running the test (not just writing the test and trusting it would fail):

- Task 1: `a0b4a9b` (`test(03-02): add failing tests for formatElapsed`, confirmed `SyntaxError: no export named formatElapsed` before commit) → `f324105` (`feat(03-02): elapsed/remaining time readout`, 21/21 passing).
- Task 2: `ca24708` (`test(03-02): add failing tests for SKIP_SECONDS/clampSeek`, confirmed `SyntaxError` before commit) → `bc276f6` (`feat(03-02): SKIP_SECONDS and clampSeek`, 27/27 passing) → `eb611d9` (wiring: transport-controls.tsx + page.tsx skip handlers/ended listener — not itself a new `node --test` case, since skip/end-of-book DOM behavior is exercised by the human-check block, not the pure-function harness).

No REFACTOR commits were needed — both `feat` commits landed cleanly against their preceding `test` commit with no follow-up cleanup.

## Deviations from Plan

**1. [Rule 2 - minor addition] `ended` handler also updates the `elapsed` state, not just the Dexie write**
- **Found during:** Task 2 implementation.
- **Issue:** The plan's `<action>` text for the `ended` handler describes only the Dexie position write ("persists the stored position as the audio element's duration ... Playback simply stops"). It does not explicitly mention updating the `elapsed` React state.
- **Fix:** Added `setElapsed(Math.floor(audio.duration))` inside the `ended` handler, symmetric with how the skip handlers update `elapsed` immediately rather than waiting for the next `timeupdate`. Without this, the readout's elapsed value would only catch up once a future `timeupdate` fires (which may not happen again after `ended`), leaving elapsed briefly stale relative to the now-100%-complete book.
- **Files modified:** `app/player/[id]/page.tsx`.
- **Commit:** eb611d9.

No other deviations — the rest of the plan was executed as written.

## Known Stubs

None. Every readout value and control is wired to real state; no hardcoded/placeholder values.

## Auth Gates

None encountered — this app has no backend/auth (single-user, client-only PWA), unchanged from Plan 01.

## Verification

- `pnpm test:logic`: 27/27 pass, including all 7 `formatElapsed` cases and all 5 `clampSeek`/`SKIP_SECONDS` cases from both tasks' behavior blocks.
- `pnpm lint`: passes, no errors.
- `pnpm build`: passes, `/player/[id]` route still emitted; the same pre-existing CSS-optimizer warning noted in `03-01-SUMMARY.md` (traced to bracket-looking text in planning `.md` files being picked up by Tailwind's content scanner) reappears, unrelated to this plan's code changes, out of scope per the deviation rules' scope boundary.
- All automated `<verify>` grep assertions from both tasks pass (confirmed via direct shell checks matching the plan's `<verify><automated>` blocks exactly).
- The `<human-check>` blocks in both tasks (physical iPhone: readout legibility/no-jitter over ~90s of playback; skip-during-playback continuity at both boundaries; the composited "15" numeral's legibility at real pixel density; a short test book played to completion showing 100%/under-one-minute-remaining on return to the library) require a physical device not available in this execution environment. Per `workflow.human_verify_mode: "end-of-phase"` and this plan's own `environment_constraints`, these are deferred to end-of-phase device verification and harvested into `03-UAT.md` at that time — not a blocking checkpoint for this plan.

## Self-Check: PASSED

- `lib/format.ts` exports `formatElapsed` — FOUND (`grep -q 'export function formatElapsed' lib/format.ts`)
- `lib/playback.ts` exports `SKIP_SECONDS`/`clampSeek` — FOUND
- `app/player/[id]/page.tsx` — FOUND, imports and uses both new modules
- `components/player/transport-controls.tsx` — FOUND, three-control row with locked aria-labels
- Commit a0b4a9b — FOUND (`git log --oneline --all`)
- Commit f324105 — FOUND
- Commit ca24708 — FOUND
- Commit bc276f6 — FOUND
- Commit eb611d9 — FOUND
