---
phase: 03-playback-resume
plan: 03
subsystem: playback
tags: [scrub-bar, radix-slider, drag-lifecycle, package-legitimacy-gate]

dependency-graph:
  requires:
    - "components/ui/alert-dialog.tsx (hand-vendoring shape precedent: forwardRef per part, displayName, template-literal className)"
    - "components/ui/progress.tsx (track/fill color tokens: #171717 / #E8B34A)"
    - "components/library-row.tsx (nullable drag-state idiom: useState<number | null>)"
    - "lib/playback.ts clampSeek (Plan 02)"
    - "lib/format.ts formatElapsed (Plan 02)"
    - "app/player/[id]/page.tsx elapsed state, audioRef (Plan 01/02)"
  provides:
    - "components/ui/slider.tsx exports Slider, SliderTrack, SliderRange, SliderThumb"
    - "components/player/scrub-bar.tsx export ScrubBar"
    - "app/player/[id]/page.tsx handleSeek handler, ScrubBar wired into the populated render"
  affects:
    - "app/player/[id]/page.tsx (renders ScrubBar between title and time readout; readout's top margin reduced from 48px to 8px, since the scrub bar now owns that break)"

tech-stack:
  added:
    - "@radix-ui/react-slider 1.4.7 — approved at Task 1's package-legitimacy checkpoint"
  patterns:
    - "onValueChange (continuous, drag) vs onValueCommit (once, release) split for D-03's pause-on-drag/seek-on-release lifecycle"
    - "audioRef passed directly into ScrubBar rather than split across page-owned pause/seek/resume callbacks, keeping the D-03 ordering inside one component"
    - "Nullable dragValue state (null = not dragging, fall back to live position) — the same idiom library-row.tsx already uses for its swipe offset"

key-files:
  created:
    - "components/ui/slider.tsx"
    - "components/player/scrub-bar.tsx"
  modified:
    - "package.json"
    - "pnpm-lock.yaml"
    - "app/player/[id]/page.tsx"

decisions:
  - "Package legitimacy checkpoint (Task 1) was APPROVED by a human after reviewing live registry metadata: @radix-ui/react-slider@1.4.7's time.modified (2026-07-31) matched the exact same publish date already on record for the two already-trusted Radix siblings (@radix-ui/react-progress, @radix-ui/react-alert-dialog), repository.url resolved to github.com/radix-ui/primitives, and no character-level naming anomaly was found. The [SUS] 'too-new'/'unknown-downloads' flag from 03-RESEARCH.md's automated checker was confirmed as routine monorepo release cadence, not a slopsquat signal. The native <input type=\"range\"> fallback specified in the plan's rejection path was NOT taken."
  - "aria-label=\"Seek\" and aria-valuetext (formatElapsed-derived) placed on SliderThumb, not the Slider root — the thumb is the element carrying role=\"slider\" via Radix, so that's where a screen reader looks for the accessible name/value text."

metrics:
  duration: ~6 min (active execution; excludes the human-review wait at the Task 1 checkpoint)
  completed: 2026-08-12

status: complete

actuals:
  tokens: 2364
  tasks: 3
  commits: 2
---

# Phase 3 Plan 3: Drag-to-seek scrub bar Summary

Added the last transport affordance the player was missing: a full-width drag-to-seek scrub bar implementing D-03's pause-on-drag/seek-on-release lifecycle, built on a hand-vendored `@radix-ui/react-slider` primitive whose install was gated behind an explicit human legitimacy-approval checkpoint.

## What Was Built

**Task 1 — Package legitimacy gate (checkpoint:human-verify, gate="blocking-human"):**
- Ran the automated pre-checkpoint block: confirmed `@radix-ui/react-slider` was absent from `package.json` before any install, then pulled live registry metadata (`version=1.4.7`, `time.modified=2026-07-31T15:50:02.692Z`, `repository.url=git+https://github.com/radix-ui/primitives.git`, `dist-tags: latest 1.4.7 / next 1.5.0-rc.1785512840124`).
- Surfaced this to the coordinator alongside the corroborating context from `03-RESEARCH.md`: the candidate's `time.modified` is the *exact same day* already on record for the two Radix siblings this project already trusts and has installed (`@radix-ui/react-progress`, `@radix-ui/react-alert-dialog`).
- **Decision: APPROVED.** The human reviewed the checkpoint and authorized the install based on the matching publish-date pattern, correct repo/org, and no naming anomaly. Recorded here per the plan's requirement that the shipped path (approved vs. rejection-path fallback) be documented explicitly — the approved path shipped; the native `<input type="range">` fallback was not used.

**Task 2 — Install and hand-vendor the slider primitive:**
- `pnpm add @radix-ui/react-slider` (precondition `pnpm view @radix-ui/react-slider version` confirmed registry reachability first).
- Read the installed package's own `node_modules/@radix-ui/react-slider/dist/index.d.ts` before writing against it (per `03-RESEARCH.md` Open Question 2) — confirmed the exact sub-component names (`Root`/`Track`/`Range`/`Thumb`, aliased from `Slider`/`SliderTrack`/`SliderRange`/`SliderThumb`) and the exact callback signatures (`onValueChange?(value: number[])`, `onValueCommit?(value: number[])`, both declared on the `Slider`/`Root` component alongside `min`/`max`/`step`/`value`).
- `components/ui/slider.tsx`: hand-vendored compound primitive matching `components/ui/alert-dialog.tsx`'s exact shape — `"use client"`, a header comment explaining the hand-vendoring (shadcn registry proxy-blocked), one `React.forwardRef` per sub-part typed with `React.ElementRef`/`React.ComponentPropsWithoutRef`, a `displayName` per part sourced from the primitive's own `displayName`, and a single `export { ... }` block. Colors match `components/ui/progress.tsx`'s locked tokens exactly: track `bg-[#171717]`, filled range and thumb `bg-[#E8B34A]`. Root carries `touch-none select-none` (load-bearing on iOS — without them a drag scrolls the page or selects text instead of moving the thumb). Thumb adds a visible `focus-visible` ring since the slider is the one control on this screen with a meaningful keyboard interaction. No class-merging utility package added.

**Task 3 — Scrub bar with D-03's lifecycle, wired into the player:**
- `components/player/scrub-bar.tsx`: exports `ScrubBar`, taking `audioRef` (nullable ref to the `<audio>` element), `duration`, `position` (the page's live `elapsed` state — never the stored `position` field, so the thumb never lags the 5-second write cadence), and `onSeek`.
- Holds `dragValue` (`useState<number | null>`, null = not dragging) and `wasPlayingRef` (a ref, not state, so recording it never triggers a mid-drag render) — the same nullable-drag idiom `components/library-row.tsx` already uses for its swipe offset.
- `onValueChange` (fires continuously during drag): on the first move (`dragValue === null`), captures whether the element was playing into `wasPlayingRef` and pauses it; every move (including the first) updates `dragValue` only — the audio element's `currentTime` is never touched here.
- `onValueCommit` (fires exactly once, on release): bounds the committed value through `clampSeek(v, duration)`, assigns it to `audio.currentTime` (the single seek for the whole gesture), calls `onSeek` with the same value so the page's `elapsed` state and the readout update immediately, then resumes playback only if `wasPlayingRef.current` was true, then clears `dragValue` back to `null`. Everything from the `clampSeek` call through the `audio?.play()` call is synchronous with no promise boundary, preserving iOS's gesture-unlock context for the resume call (`03-RESEARCH.md` Pitfall C).
- `aria-label="Seek"` and `aria-valuetext={formatElapsed(Math.floor(displayedValue))}` are set on `SliderThumb` (the element carrying `role="slider"`, where a screen reader looks for the accessible name/value text) rather than the `Slider` root.
- `app/player/[id]/page.tsx`: imports and renders `ScrubBar` between the book title and the time readout — `mt-12 px-6` for the scrub bar (48px break, 24px horizontal padding), with the readout's own top margin reduced from `mt-12` to `mt-2` (8px, since the scrub bar now owns the larger break). A new `handleSeek(seconds)` handler sets the same `elapsed` state the skip handlers already set. No other page behavior touched — object-URL lifecycle, throttled persistence, play/pause, skip handlers, `ended` listener, and the loading/not-found branches are all unchanged.

## Deviations from Plan

None — the plan was executed exactly as written, including the approved (non-fallback) package path.

## Known Stubs

None. The scrub bar is fully wired: real audio-element seeking, real `clampSeek` bounding, real live-position tracking via the page's `elapsed` state.

## Auth Gates

None encountered — this app has no backend/auth (single-user, client-only PWA), unchanged from Plans 01/02.

## Package Legitimacy Checkpoint

**Task 1 result: APPROVED.** See "What Was Built" and "Decisions" above for the full registry-metadata evidence reviewed and the reasoning. The native `<input type="range">` fallback specified in the plan's rejection path was not needed and was not built.

## Verification

- `pnpm lint`: passes, no errors (checked after Task 2 and again after Task 3).
- `pnpm build`: passes, `/player/[id]` route still emitted; the same pre-existing CSS-optimizer warning noted in `03-01-SUMMARY.md`/`03-02-SUMMARY.md` (bracket-looking text in planning `.md` files picked up by Tailwind's content scanner) reappears, unrelated to this plan's code changes.
- `pnpm test:logic`: 27/27 pass (unchanged from Plan 02 — this plan added no new pure function; `clampSeek` was already covered by Plan 02's exact-value test cases and is consumed as-is here).
- All automated `<verify>` grep/count assertions from both Task 2 and Task 3 pass, including the load-bearing count check that `components/player/scrub-bar.tsx` assigns `audio.currentTime` on exactly one non-comment line (the commit callback) — confirmed via direct shell check.
- The Task 3 `<human-check>` block (physical iPhone: Pitfall C's named "scrub while playing, release" test; scrub while paused; smooth drag tracking; tap-anywhere-on-track; no page-scroll/text-selection during drag; end-of-book backward-scrub recovery) requires a physical device not available in this execution environment. Per `workflow.human_verify_mode: "end-of-phase"` and this plan's own `environment_constraints`, it is deferred to end-of-phase device verification and harvested into `03-UAT.md` at that time — not a blocking checkpoint for this plan. (Task 1's checkpoint, by contrast, WAS a genuine blocking mid-plan halt, per the plan's explicit exception, and was resolved above before Tasks 2-3 ran.)

## Self-Check: PASSED

- `components/ui/slider.tsx` — FOUND
- `components/player/scrub-bar.tsx` — FOUND
- `app/player/[id]/page.tsx` — FOUND, imports and renders `ScrubBar`
- `package.json` — FOUND, `@radix-ui/react-slider: 1.4.7` present in dependencies
- Commit d9017e8 (Task 2: install + vendor slider) — FOUND (`git log --oneline --all`)
- Commit 821eaf8 (Task 3: scrub bar + page wiring) — FOUND (`git log --oneline --all`)
