# Phase 3: Playback & Resume - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 5
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/player/[id]/page.tsx` | route/controller (Client Component page) | request-response + event-driven (audio events, live query) | `app/page.tsx` | role-match (same client-component + useLiveQuery shape, different route type) |
| `components/player/transport-controls.tsx` | component | event-driven (DOM/audio events) | `components/import-trigger.tsx` (button/tap-target shape) + `components/library-row.tsx` (icon+aria-label button pattern) | role-match |
| `components/player/scrub-bar.tsx` | component | event-driven (drag/commit) | `components/library-row.tsx` (touch-event handling precedent) + `components/ui/progress.tsx` (Radix primitive + value-to-fill pattern) | role-match |
| `components/ui/slider.tsx` | UI primitive (hand-vendored Radix) | transform (props → styled DOM) | `components/ui/progress.tsx` | exact (same hand-vendoring pattern) |
| `components/library-row.tsx` (touch point → nav trigger) | component (modified) | request-response (navigation) | itself (existing file), `components/import-trigger.tsx` (button `onClick` pattern) for the nav trigger's tap handler shape | exact (self-modification) |

## Pattern Assignments

### `app/player/[id]/page.tsx` (route, request-response + event-driven)

**Analog:** `app/page.tsx` (`/workspace/my-audiobooks/app/page.tsx`)

**Imports pattern** (lines 1-13):
```tsx
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { BookAudio } from "lucide-react";
import { db } from "@/lib/db";
```
For the player page, swap in `useParams` from `next/navigation`, `Link` from `next/link`, and the new player components. Per RESEARCH.md Pattern 1, use `useParams<{ id: string }>()` (not `use(params)`) since this page is `"use client"` like `app/page.tsx`.

**Loading-state pattern** (lines 98-108): `useLiveQuery` returns `undefined` on first read — render only a minimal shell (header only, no flash of populated/not-found state):
```tsx
if (books === undefined) {
  return (
    <div className="flex flex-col min-h-dvh">
      <header className="px-6 pt-8">
        <h1 className="text-[28px] font-semibold leading-[1.2] text-[#F5F5F5]">
          My Library
        </h1>
      </header>
    </div>
  );
}
```
Player page equivalent: render only the back-button header while `useLiveQuery(() => db.books.get(bookId))` is `undefined`; once resolved-but-`undefined` (not-found state, distinct from loading), render the "Book not found" block per UI-SPEC.

**Root container / header rhythm** (lines 142-149): flex-column `min-h-dvh`, header with `px-6 pt-8` — reuse directly for the player root and header row (per UI-SPEC Layout section).

**State orchestration pattern** (lines 45-96): local component state (`useState`) alongside `useLiveQuery` for anything that isn't persisted — e.g. `dragValue` in the scrub bar, `objectUrl` in the player page — mirrors how `app/page.tsx` keeps `inFlight`/`importError` in React state separate from the Dexie-backed `books` list.

**Error/db-write handling:** `app/page.tsx` uses `.then()/.catch()/.finally()` fire-and-forget promise chains (lines 72-90) rather than try/catch — the player's `db.books.update(...)` position writes (Pattern 4 in RESEARCH.md) should follow the same fire-and-forget style, no try/catch wrapper, consistent with this codebase's established error-handling posture (no centralized error type exists; `ImportError` is the only typed error and is import-specific).

---

### `components/player/transport-controls.tsx` (component, event-driven)

**Analog:** `components/import-trigger.tsx` (button/tap-target shape) and `components/library-row.tsx` (icon-button + aria-label pattern)

**Icon button pattern** (`import-trigger.tsx` lines 66-78):
```tsx
<button
  type="button"
  onClick={openPicker}
  aria-label="Import audiobook"
  className="p-[10px] -m-[10px]"
>
  <Plus size={24} className="text-[#E8B34A]" aria-hidden="true" />
</button>
```
Apply this shape for play/pause and ±15s skip buttons: `<button type="button" onClick={...} aria-label="...">` wrapping a lucide icon with `aria-hidden="true"`, using inline padding/negative-margin (or `min-h-11 min-w-11` per UI-SPEC) to hit the 44×44px tap target without inflating the visible icon size.

**Delete-button icon+label composite pattern** (`library-row.tsx` lines 137-151) — same "icon inside a button with additional overlay/label content" shape needed for the ±15s skip buttons' "15" numeral overlay (`RotateCcw`/`RotateCw` icon + absolutely-positioned numeral span), matching UI-SPEC's transform-scaled Label overlay approach:
```tsx
<button type="button" className="flex h-full w-full flex-col items-center justify-center gap-1">
  <Trash2 size={20} className="text-[#F5F5F5]" aria-hidden="true" />
  <span className="text-[14px] leading-[1.5] text-[#F5F5F5]">Delete</span>
</button>
```

**Synchronous tap-handler requirement (critical):** per RESEARCH.md Pattern 2 / PITFALLS.md Pitfall 3, the play/pause handler must call `audioRef.current?.play()` / `.pause()` synchronously with zero `await` before it — this is a hard constraint not present in any existing analog (no prior tap handler in this codebase calls a gesture-gated browser API), so it must be implemented fresh per RESEARCH.md Code Examples, not copied from an existing handler.

---

### `components/player/scrub-bar.tsx` (component, event-driven)

**Analog:** `components/library-row.tsx` (touch-event/drag-state precedent) + `components/ui/progress.tsx` (Radix primitive wrapper + value→fill styling)

**Drag-state-as-ref-plus-nullable-useState pattern** (`library-row.tsx` lines 48-52, 66-96):
```tsx
const [dragX, setDragX] = useState<number | null>(null);
const touchStartX = useRef(0);
const isDragging = useRef(false);
// ... onTouchMove computes next value, setDragX(next)
// ... onTouchEnd resolves final state, setDragX(null)
const translateX = dragX ?? (panelOpen ? -PANEL_WIDTH : 0);
```
Directly maps to the scrub bar's own `dragValue` state: `const [dragValue, setDragValue] = useState<number | null>(null)`, with `value={[dragValue ?? position]}` as shown in RESEARCH.md Pattern 3 — same "null means not actively dragging, fall back to source-of-truth value" idiom already established in this codebase.

**Radix primitive wrapper + value-driven fill** (`components/ui/progress.tsx` lines 8-26): the `Slider` wrapper in `components/ui/slider.tsx` should follow the identical `forwardRef` + `React.ComponentPropsWithoutRef` shape shown there, styled with the same track/fill color tokens (`bg-[#171717]` track, `bg-[#E8B34A]` fill) — see UI primitive section below.

**Radix dual-callback drag/commit pattern:** no existing analog in this codebase (first Radix Slider usage) — implement per RESEARCH.md Pattern 3 (`onValueChange` for pause-and-track-only, `onValueCommit` for seek-and-resume), using the `wasPlayingRef` pattern shown there. This is the one genuinely new interaction pattern this phase introduces; `library-row.tsx`'s touch handling is the closest conceptual precedent (pause-during-interaction / commit-on-release rhythm) but is hand-rolled `TouchEvent` code, not directly copyable since the Slider primitive replaces it wholesale per RESEARCH.md's "Don't Hand-Roll" guidance.

---

### `components/ui/slider.tsx` (UI primitive, hand-vendored Radix)

**Analog:** `components/ui/progress.tsx` (`/workspace/my-audiobooks/components/ui/progress.tsx`) — exact match, same hand-vendoring pattern (registry.ui.shadcn.com proxy-blocked; `npx shadcn add` cannot be used).

**Full pattern to copy** (lines 1-29):
```tsx
"use client";

// Hand-vendored progress primitive, standing in for `npx shadcn add
// progress` (registry.ui.shadcn.com is proxy-blocked in this environment —
// see 02-02-PLAN.md environment_constraints).
import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className = "", value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={`relative h-1 w-full overflow-hidden rounded-full bg-[#171717] ${className}`}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-[#E8B34A] transition-transform"
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
```
For `slider.tsx`, replace `ProgressPrimitive` with `* as SliderPrimitive from "@radix-ui/react-slider"`, export `Slider.Root`/`Track`/`Range`/`Thumb` sub-components each wrapped in `React.forwardRef` following the exact same `className` composition style (plain template literals, no `cn()` helper — this project deliberately has none, per `alert-dialog.tsx`'s comment). Track: `h-1 rounded-full bg-[#171717]`; Range (filled): `bg-[#E8B34A]`; Thumb: 20px circle, `bg-[#E8B34A]`, no border — per UI-SPEC.

**Multi-part primitive composition precedent:** `components/ui/alert-dialog.tsx` (lines 1-149) shows the pattern for vendoring a primitive with multiple composed sub-parts (Root/Trigger/Portal/Overlay/Content/Header/Footer/Title/Description/Action/Cancel), each a separate `forwardRef`-wrapped export with its own `displayName` assignment and default `className` merged with an optional caller-supplied `className`. `slider.tsx` needs the same multi-export shape (`Slider`, `SliderTrack`, `SliderRange`, `SliderThumb` or similar) since Radix Slider is also a compound component, not a single-root primitive like `Progress`.

---

### `components/library-row.tsx` (modified — tap-to-navigate)

**Analog:** itself (existing file) + `components/import-trigger.tsx`'s `onClick` handler shape for the new tap-to-navigate behavior.

**Current structure to preserve:** swipe-to-delete (`onTouchStart`/`onTouchMove`/`onTouchEnd`, lines 59-96) and the `handleForegroundClick` (lines 98-102) that currently only closes an open delete panel. The new navigation trigger must be layered onto the *foreground content div* (lines 171-189, the `<div className="relative bg-[#171717] p-4" ... onClick={handleForegroundClick}>`), not the outer `<li>`, so swipe gestures are unaffected.

**Navigation pattern to add:** wrap the foreground content in a `next/link` `<Link href={\`/player/${book.id}\`}>` (matching UI-SPEC's back-button pattern, which explicitly uses `Link href="/"` rather than `router.push`/`router.back()` for determinism) OR extend `handleForegroundClick` to call `router.push` after the existing panel-close check — `handleForegroundClick`'s existing early-return-on-panel-open logic (`if (panelOpen) closePanel();`) must gate navigation too, so tapping to dismiss an open delete panel does not simultaneously navigate to the player.

---

## Shared Patterns

### Design tokens / color / typography
**Source:** inherited verbatim from `01-UI-SPEC.md`/`02-UI-SPEC.md`/`app/globals.css`, already used throughout `library-row.tsx`, `progress.tsx`, `alert-dialog.tsx`.
**Apply to:** all new player files. Key literals already in use and to be reused as-is: `bg-[#0A0A0A]` (Dominant), `bg-[#171717]` (Secondary), `text-[#E8B34A]` (Accent), `text-[#F5F5F5]` (Foreground), `text-[#A3A3A3]` (Muted-foreground), `bg-[#DC2626]` (Destructive — not used this phase).

### No `cn()` helper
**Source:** `components/ui/alert-dialog.tsx` line 9-10 comment.
**Apply to:** `components/ui/slider.tsx` and any new component accepting a `className` prop — compose with plain template literals (`` `default-classes ${className}` ``), never introduce `clsx`/`cn`.

### Hand-vendoring Radix primitives
**Source:** `components/ui/progress.tsx`, `components/ui/alert-dialog.tsx`.
**Apply to:** `components/ui/slider.tsx`. Pattern: `"use client"` directive, header comment explaining why hand-vendored (registry proxy-blocked), `import * as XPrimitive from "@radix-ui/react-x"`, `React.forwardRef` per sub-component, `displayName` assignment, default styling classes merged with caller `className` via template literal, single `export { ... }` at bottom.

### `useLiveQuery` + Dexie read/write chokepoint
**Source:** `app/page.tsx` (`useLiveQuery(() => db.books...)`), `components/library-row.tsx` (`db.books.delete(book.id)`).
**Apply to:** `app/player/[id]/page.tsx` — `useLiveQuery(() => db.books.get(bookId))` for the read; `db.books.update(book.id, { position })` for writes (per RESEARCH.md Pattern 4). All Dexie access stays behind the single `db` export from `lib/db.ts` — no new storage module.

### `lib/format.ts` reuse
**Source:** `lib/format.ts` (`percentComplete`, `formatTimeRemaining`), consumed today by `components/library-row.tsx` lines 40-43.
**Apply to:** the player's time readout. `formatTimeRemaining` is reused as-is for the "remaining" side; a new symmetric `formatElapsed()` must be added to `lib/format.ts` (not a new file) mirroring the same rounding-before-branching rule, per UI-SPEC's Time Readout section.

### Touch/gesture handling precedent vs. Radix
**Source:** `components/library-row.tsx` lines 59-96 (hand-rolled `TouchEvent` swipe).
**Apply to:** contrast reference only — the scrub bar does NOT copy this hand-rolled approach; it uses `@radix-ui/react-slider`'s `onValueChange`/`onValueCommit` instead (RESEARCH.md's explicit "Don't Hand-Roll" call). Kept here as a shared pattern entry because it establishes precedent for *why* plain DOM touch events are the norm elsewhere in this codebase, clarifying that the scrub bar is a deliberate exception, not an inconsistency.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| N/A | — | — | All five files have at least a role-match analog in the existing codebase; the only genuinely new interaction code (Radix Slider drag/commit wiring, `<audio>` event wiring, iOS gesture-unlock-safe tap handlers) has no prior analog in this codebase and must be implemented fresh from `03-RESEARCH.md`'s Architecture Patterns 2-4 and Code Examples sections, which downstream planning should cite directly for those specific pieces. |

## Metadata

**Analog search scope:** `/workspace/my-audiobooks/app/`, `/workspace/my-audiobooks/components/`, `/workspace/my-audiobooks/lib/`
**Files scanned:** `app/page.tsx`, `app/layout.tsx`, `components/library-row.tsx`, `components/import-trigger.tsx`, `components/ui/progress.tsx`, `components/ui/alert-dialog.tsx`, `lib/format.ts`, `lib/db.ts`
**Pattern extraction date:** 2026-08-12
