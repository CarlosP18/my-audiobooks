# Phase 3: Playback & Resume - Research

**Researched:** 2026-08-11
**Domain:** Native `<audio>` element playback UI in a client-only Next.js 16 App Router PWA, backed by an existing single-table Dexie/IndexedDB record (blob + metadata + position co-located)
**Confidence:** MEDIUM (Next.js 16 App Router mechanics and the in-repo Dexie schema are VERIFIED from source; `<audio>` element event behavior and IndexedDB Blob-rewrite cost are ASSUMED/CITED via training knowledge and web search — MDN/dexie.org direct fetches were blocked by network egress in this session, so these should be spot-checked and are flagged for on-device verification)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Player Entry Point):** Tapping a library row navigates to a dedicated player screen/route (e.g. `/player/[id]`), not an inline-expanded row. Gives a shareable/back-button-able URL, and keeps exactly one `<audio>` element active at a time without extra visibility-tracking logic. Reversibility: costly.
- **D-02 (Position Save Frequency, PLAY-05):** Position is written to IndexedDB every 5 seconds during active playback, in addition to on pause and on visibility-change/backgrounding. Matches PITFALLS.md's throttle recommendation (5-15s; never write on every `timeupdate` tick). Reversibility: reversible (pure timing constant).
- **D-03 (Scrub Bar Behavior, PLAY-03):** Dragging the scrub bar pauses/mutes audio for the duration of the drag; the actual seek happens once on release. Matches standard podcast/audiobook player UX and avoids repeated seeks causing choppy playback. Reversibility: reversible.
- **D-04 (End of Book):** When playback reaches 100%, it stops and `position` is set to `duration` (book shown as completed) rather than auto-resetting to 0. Reversibility: reversible.

### Claude's Discretion

- Exact play-button tap-to-audio-start handling to satisfy the iOS gesture-unlock constraint (PITFALLS.md Pitfall 3): `.play()` must be called synchronously inside the tap handler, not after an `await`. The `<audio src>` (via `URL.createObjectURL(blob)`) should be prepared ahead of the tap where possible so `.play()` only needs to resume — implementation detail for research/planner.
- Whether/how far to implement Media Session API metadata (`navigator.mediaSession.metadata`, action handlers) now vs. deferring entirely to PLAY2-02. Research should reconcile the "wire from day one" pitfall recommendation against this phase's foreground-only scope.
- Exact behavior at library-boundary edge cases for ±15s skip (skip back near 0 clamps to 0; skip forward near the end clamps to `duration`, doesn't skip past the D-04 end-of-book state).
- How/whether the library screen's per-row progress bar reflects position live while a book is playing in the player route, vs. only updating on next visit to the library screen.
- Visual design of the player screen — covered by this phase's UI-SPEC (UI hint: yes), not this discussion.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Background/lock-screen playback (Media Session API, staying audible with screen locked) is tracked as PLAY2-02 in REQUIREMENTS.md v2, not a new idea from this discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAY-01 | User can play and pause the current audiobook | `<audio>` element wiring pattern (Code Examples), iOS gesture-unlock pitfall deep-dive (Common Pitfalls) |
| PLAY-02 | User can skip backward/forward by a fixed 15-second increment | Clamp-to-bounds pattern in Code Examples; interacts with D-04 end-of-book state |
| PLAY-03 | User can seek to an arbitrary point via a scrub bar | Radix Slider `onValueChange`/`onValueCommit` pattern maps directly to D-03 (Architecture Patterns, Don't Hand-Roll) |
| PLAY-04 | Player displays elapsed and remaining time for the current audiobook | Reuse `lib/format.ts` (`percentComplete`, `formatTimeRemaining`); `timeupdate` event wiring (Code Examples) |
| PLAY-05 | Playback position is saved automatically and frequently (pause, visibility change, periodic) | D-02 5s throttle + flush-on-event pattern (Architecture Patterns); IndexedDB Blob-rewrite cost pitfall (Common Pitfalls) |
| PLAY-06 | Reopening an audiobook resumes playback from the last saved position, including after a full close/relaunch | `loadedmetadata` → seek-to-saved-position pattern (Code Examples); Runtime State Inventory below (nothing extra to migrate — schema already has `position`) |
</phase_requirements>

## Summary

This phase adds exactly one new route (`app/player/[id]/page.tsx`) and its supporting components on top of an already-solid Phase 2 foundation: `lib/db.ts`'s single Dexie `books` table already has a `position: number` field written as `0` by every import, and `lib/format.ts` already has the exact percent/time-remaining helpers the player needs to reuse. Next.js 16's App Router requires dynamic-route `params` to be read as a `Promise` in Server Components, but this page must be a Client Component (`"use client"`, matching every other interactive screen in this codebase) — for a Client Component page, `useParams()` from `next/navigation` is simpler than the `use(params)` pattern shown in Next's own docs, because it returns the id synchronously with no `Suspense` requirement (verified against `node_modules/next/dist/docs` in this repo). Playback itself is the native `<audio>` element (no library, per STACK.md) sourced from a `URL.createObjectURL(blob)` created once per book-load and revoked on unmount/book-switch.

The single highest-risk implementation detail is **not** storage schema or routing — it's the interaction between three already-known constraints: (1) iOS Safari requires `audio.play()` to be called synchronously inside the tap handler with no intervening `await` (PITFALLS.md Pitfall 3), (2) the player needs to load a book's Blob from IndexedDB before it has anything to play, and (3) D-02 requires writing `position` to the *same* Dexie record that holds the (potentially 100-300MB) audio Blob, every 5 seconds, during playback. This research resolves (1)/(2) with a "prepare the source on mount, only call `.play()` in the tap handler" pattern, and flags (3) as a **new, previously-undocumented risk** this project's own PITFALLS.md and ARCHITECTURE.md did not fully account for: the actual locked v1 schema (single `books` table, blob + position co-located) is exactly the shape ARCHITECTURE.md's Anti-Pattern 1 warned against, and Dexie's `update()` cannot avoid touching the Blob field at the IndexedDB API level. This must be treated as an explicit on-device verification item in the plan (see Common Pitfalls, Pitfall A).

For the scrub bar (D-03: pause-on-drag, seek-on-release), this codebase already has a precedent for two different approaches to touch interaction: hand-rolled `TouchEvent` handlers (`library-row.tsx`'s swipe-to-delete) and a vendored Radix primitive (`components/ui/progress.tsx`, because `npx shadcn add` is proxy-blocked in this environment). Radix's `Slider` primitive (`@radix-ui/react-slider`) exposes `onValueChange` (fires continuously while dragging) and `onValueCommit` (fires once, only on pointer/touch release) — this maps to D-03's exact requirement with zero custom pointer-tracking code, and Phase 1's own UI-SPEC.md already reserved this exact package for Phase 3 ("Phase 3 (Slider, Button)"). It must be hand-vendored the same way `progress.tsx` was (shadcn registry is proxy-blocked), and its 1.4.7 release is very recent — flagged `[SUS]` by the automated legitimacy check purely on publish-recency grounds, but corroborated as routine monorepo churn by the identical publish cadence of the two Radix packages already trusted and installed in this repo (see Package Legitimacy Audit).

**Primary recommendation:** Build the player as a Client Component route using `useParams()` (not `use(params)`), reuse `lib/format.ts` as-is, hand-vendor `@radix-ui/react-slider` for the scrub bar (`onValueChange` for live thumb position, `onValueCommit` for D-03's seek-on-release), wire `<audio>` via `URL.createObjectURL` created once per book id and revoked on cleanup, and treat the 5-second position-write-into-a-blob-bearing-record cost as a named, real-device verification checkpoint rather than an assumed non-issue.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Play/pause/seek transport control | Browser / Client | — | Native `<audio>` element API, entirely client-side; no server in this app at all |
| Route param → book lookup | Browser / Client | — | `app/player/[id]/page.tsx` is a Client Component reading `id` via `useParams()`, then querying Dexie directly — no server round-trip exists in this architecture (confirmed: this app has zero backend, per ARCHITECTURE.md and STACK.md) |
| Position persistence | Database / Storage (IndexedDB via Dexie) | Browser / Client (in-memory `currentTime` as working cache) | `db.books` is the durable source of truth; React state holds only the ticking in-memory copy needed to render, per ARCHITECTURE.md Pattern 1 |
| Scrub bar drag/release semantics | Browser / Client | — | Radix Slider primitive runs entirely client-side; `onValueCommit` is a DOM-interaction concern, not a data concern |
| Elapsed/remaining time formatting | Browser / Client | — | Pure function (`lib/format.ts`), already exists, no I/O |
| Blob lifecycle (object URL create/revoke) | Browser / Client | — | `URL.createObjectURL`/`revokeObjectURL` are browser APIs with no server equivalent in this app |

*(No Frontend-Server/SSR, API/Backend, or CDN tiers exist in this project — it is a fully client-side, offline-capable PWA with zero backend, confirmed in ARCHITECTURE.md and unchanged by this phase.)*

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native `<audio>` element | browser built-in | Playback engine | Already locked in STACK.md; no player library needed for sequential playback + seek of large local files `[VERIFIED: /workspace/my-audiobooks/.planning/research/STACK.md:16]` |
| `next/navigation` `useParams()` | bundled with `next@16.3.0` | Read the `[id]` route segment in the Client Component player page | Confirmed synchronous, no-`Suspense`-required API for Client Components, per this repo's own vendored Next.js docs `[VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-params.md]` |
| `dexie` | 4.4.4 (already installed) | Read one `Book` by id, write `position` updates | Existing single chokepoint (`lib/db.ts`) — no new storage module `[VERIFIED: /workspace/my-audiobooks/lib/db.ts:1-37]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-slider` | 1.4.7 (verified on npm registry 2026-08-11; not yet installed) `[ASSUMED — package name from training knowledge, not from official docs fetched this session; existence/version confirmed via `npm view`]` | Scrub bar primitive: unstyled, accessible slider exposing `onValueChange` (continuous) and `onValueCommit` (release-only) | Use for the scrub bar exactly because `onValueCommit` implements D-03's "seek only on release" without hand-rolled pointer tracking |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@radix-ui/react-slider` | Native `<input type="range">` with separate `onInput`/`onChange` handlers | Zero new dependency, and `input`/`change` map to the same continuous/release-only split as Radix's `onValueChange`/`onValueCommit` `[ASSUMED — cross-browser behavior, web-search corroborated, not fetched from MDN this session (blocked)]`. Tradeoff: native range styling requires vendor-prefixed pseudo-elements (`::-webkit-slider-thumb`, `::-webkit-slider-runnable-track`) to override iOS's default blue-pill appearance to match the locked dark/accent design tokens, and mobile range inputs have a documented history of being fiddly to drag precisely on touch. Fall back to this only if the `[SUS]`-flagged Radix package is rejected at the `checkpoint:human-verify` gate. |
| Hand-rolled `TouchEvent` scrub bar (matching `library-row.tsx`'s swipe pattern) | — | This repo already has a working precedent for hand-rolled touch tracking, so it's not unprecedented — but swipe-to-delete only needs binary open/closed state, not continuous value + precise release-commit semantics across mouse AND touch. Radix Slider already solves the harder problem (pointer capture, keyboard arrows, ARIA `slider` role) that a scrub bar actually needs. |

**Installation:**
```bash
pnpm add @radix-ui/react-slider
```

**Version verification:** `npm view @radix-ui/react-slider version` → `1.4.7`, published 2026-07-24. Cross-checked against the two Radix packages already installed in this repo: `@radix-ui/react-progress` (published 2026-07-31) and `@radix-ui/react-alert-dialog` (published 2026-07-31) — all three show the same recent-cadence publish pattern, consistent with a routine `radix-ui/primitives` monorepo release rather than a suspicious new package. `[VERIFIED: npm registry — commands run this session]`

## Package Legitimacy Audit

| Package | Registry | Age (this version) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|---------------------|-----------|--------------|---------|-------------|
| `@radix-ui/react-slider` | npm | v1.4.7 published 2026-07-24 (~2.5 weeks old at research time); package itself is part of the long-established `radix-ui/primitives` monorepo | Not returned by the legitimacy checker (`weeklyDownloads: null`) | `github.com/radix-ui/primitives` (confirmed via `npm view`) | **SUS** (`too-new`, `unknown-downloads`) | Flagged — planner must add `checkpoint:human-verify` before `pnpm add`. Context for the human check: the identical monorepo already provides `@radix-ui/react-progress` and `@radix-ui/react-alert-dialog`, both already installed in this project and both published on the exact same day (2026-07-31) as part of the same release train — this pattern (many packages in one org, all bumped together) is normal for a monorepo and is the most likely explanation for the "too-new" flag, not a slopsquat signal. Still gate it — do not skip the checkpoint on the strength of this note alone. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `@radix-ui/react-slider` — see disposition above; planner must insert a `checkpoint:human-verify` task immediately before the `pnpm add @radix-ui/react-slider` install step, and the fallback (native `<input type="range">`, see Alternatives Considered) should be documented in that checkpoint's rejection path so the plan isn't blocked if the human declines.

*The package name `@radix-ui/react-slider` was recalled from training knowledge (a widely-known Radix primitive, and the same family already used twice in this codebase), not sourced from an official docs fetch this session — tagged `[ASSUMED]` per the package-name provenance rule even though the registry check independently confirms it exists and is not deprecated.*

## Architecture Patterns

### System Architecture Diagram

```
Library screen (app/page.tsx)
    │  user taps a LibraryRow (foreground click, not swipe-panel-open)
    ▼
next/link or router.push(`/player/${book.id}`)
    ▼
Player route: app/player/[id]/page.tsx  ("use client")
    │  useParams<{ id: string }>()  ──►  id: string
    │  useLiveQuery(() => db.books.get(Number(id)))  ──►  Book | undefined
    ▼
On book resolved (id valid) ──────────────► On book resolved as undefined (bad id)
    │                                            │
    ▼                                            ▼
useEffect: URL.createObjectURL(book.blob)    notFound() / redirect to library
    │  (create once per book.id; revoke in
    │   cleanup on id change or unmount)
    ▼
<audio ref src={objectUrl} preload="metadata">
    │
    ├─ loadedmetadata ──► audio.currentTime = book.position   (RESUME, PLAY-06)
    ├─ timeupdate      ──► update visible elapsed/remaining text (throttled UI, not just writes)
    │                       + throttled (5s) db.books.update(id, { position }) (PLAY-05, D-02)
    ├─ pause           ──► flush db.books.update(id, { position }) immediately (PLAY-05, D-02)
    ├─ ended           ──► set position = duration, stop (D-04)
    │
document visibilitychange (hidden) ──► flush db.books.update(id, { position }) (PLAY-05, D-02)
    │
Transport controls (all synchronous DOM calls inside their own tap handlers):
    ├─ Play/pause button ──► audio.play() / audio.pause()      (PLAY-01)
    ├─ ±15s skip buttons  ──► audio.currentTime = clamp(...)   (PLAY-02)
    └─ Scrub bar (Radix Slider)
           onValueChange (drag)  ──► pause audio, update local displayed time only (D-03)
           onValueCommit (release) ──► audio.currentTime = committed value, resume if was playing (D-03, PLAY-03)
```

### Recommended Project Structure

```
app/
├── player/
│   └── [id]/
│       └── page.tsx        # "use client" — orchestrates <audio>, reads/writes db.books
components/
├── player/
│   ├── transport-controls.tsx  # play/pause + ±15s buttons
│   ├── scrub-bar.tsx            # vendored Radix Slider wrapper (matches ui/progress.tsx pattern)
│   └── ui/
│       └── slider.tsx           # hand-vendored @radix-ui/react-slider primitive (registry.ui.shadcn.com is proxy-blocked, per components/ui/progress.tsx precedent)
lib/
├── format.ts                # REUSE AS-IS — percentComplete(), formatTimeRemaining() already exist
```

### Pattern 1: `useParams()` over `use(params)` for a Client Component player page

**What:** Next.js 16's own docs default to typing pages with `params: Promise<{ id: string }>` and unwrapping with `await` (Server Components) or React's `use()` (Client Components). For a page that must be `"use client"` anyway (it needs `useLiveQuery`, `useRef` for the `<audio>` element, and DOM event handlers — same reasons `app/page.tsx` is already a Client Component), `useParams()` from `next/navigation` returns the resolved params object directly with no Promise-unwrapping boilerplate and, per this repo's vendored Next docs, does not require a `Suspense` boundary unless Cache Components is enabled (`next.config.ts` in this repo does not enable it).
**When to use:** Any Client Component page reading dynamic route segments in this codebase.
**Example:**
```tsx
// Source: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-params.md
// (VERIFIED — read this session)
"use client";
import { useParams } from "next/navigation";

export default function PlayerPage() {
  const params = useParams<{ id: string }>();
  const bookId = Number(params.id);
  // ...
}
```
Compare to the Promise-based pattern Next 16's dynamic-routes doc shows for Client Components (also valid, more boilerplate):
```tsx
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md
// (VERIFIED — read this session)
"use client";
import { use } from "react";

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
}
```

### Pattern 2: Prepare the `<audio>` source ahead of the tap; only call `.play()` synchronously inside the handler

**What:** PITFALLS.md Pitfall 3 (already in this project's canon) establishes that `audio.play()` must be called with no intervening `await` inside the gesture handler. The concrete implementation split: create the object URL and assign it to `<audio src>` in a `useEffect` on mount/book-change (an async-adjacent operation that runs well before any tap), so that by the time the user taps play, `.play()` is the *only* thing the handler needs to do.
**When to use:** The play button handler, and the scrub bar's `onValueCommit` handler if it needs to resume playback after a seek.
**Example:**
```tsx
// Pattern synthesized from PITFALLS.md Pitfall 3 + ARCHITECTURE.md Pattern 1/Anti-Pattern 2
// (this project's own prior research, re-applied to Phase 3 specifics)
function PlayerPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!book) return;
    const url = URL.createObjectURL(book.blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url); // book-switch or unmount — Anti-Pattern 2
  }, [book?.id]); // keyed on id, not the whole book object (position updates must not recreate the URL)

  function handlePlayTap() {
    // Synchronous, no await before this line — the single line that must
    // run inside the real user gesture per PITFALLS.md Pitfall 3.
    audioRef.current?.play();
  }

  return <audio ref={audioRef} src={objectUrl ?? undefined} preload="metadata" />;
}
```
**Critical detail:** the `useEffect` dependency must be `book?.id`, not `book` (the whole object) — `useLiveQuery` returns a new `book` object reference on every position write (every 5s per D-02), and if the object-URL effect depended on the whole object it would recreate/revoke the blob URL every 5 seconds during playback, interrupting playback mid-stream. This is a subtle but real bug this pattern must guard against explicitly.

### Pattern 3: D-03 scrub bar via Radix Slider's dual callbacks

**What:** `onValueChange` fires on every drag-move (mouse move / touch move); `onValueCommit` fires exactly once, when the pointer/touch is released `[CITED: github.com/radix-ui/primitives discussions #2169, #903 — web-search corroborated, MEDIUM confidence, direct radix-ui.com fetch was blocked this session]`.
**When to use:** The scrub bar component.
**Example:**
```tsx
// Pattern derived from Radix Slider's documented onValueChange/onValueCommit
// split (CITED via web search — verify exact prop signature against
// installed @radix-ui/react-slider@1.4.7's TypeScript types at implementation time)
function ScrubBar({ audioRef, duration, position }: ScrubBarProps) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const wasPlayingRef = useRef(false);

  return (
    <Slider.Root
      min={0}
      max={duration}
      step={1}
      value={[dragValue ?? position]}
      onValueChange={([v]) => {
        if (dragValue === null) {
          // First move of this drag — D-03: pause for the duration of the drag
          wasPlayingRef.current = !audioRef.current?.paused;
          audioRef.current?.pause();
        }
        setDragValue(v); // update displayed thumb/time only — NOT audio.currentTime
      }}
      onValueCommit={([v]) => {
        if (audioRef.current) audioRef.current.currentTime = v; // seek exactly once, on release
        if (wasPlayingRef.current) audioRef.current?.play(); // resume if it was playing before the drag
        setDragValue(null);
      }}
    >
      <Slider.Track>
        <Slider.Range />
      </Slider.Track>
      <Slider.Thumb />
    </Slider.Root>
  );
}
```

### Pattern 4: Position persistence — throttle + flush, applied to this project's actual schema

**What:** ARCHITECTURE.md's Pattern 1/3 (already in this project's canon) describe throttling `timeupdate` writes to 5s (locked as D-02) and flushing immediately on `pause`/`visibilitychange`/unmount. Re-applying that pattern to the actual `lib/db.ts` API (not the hypothetical `db.updatePosition()` from the earlier architecture sketch):
```tsx
// Source: pattern from .planning/research/ARCHITECTURE.md Pattern 1/3
// (VERIFIED — read this session), adapted to the actual db.books API
// verified in lib/db.ts (VERIFIED: /workspace/my-audiobooks/lib/db.ts:11-37 —
// `position: number` field, single `books` table, no separate position store)
useEffect(() => {
  const audio = audioRef.current;
  if (!audio || book?.id === undefined) return;

  let lastSaved = 0;
  const THROTTLE_MS = 5000; // D-02, locked

  function flush() {
    if (book?.id === undefined) return;
    db.books.update(book.id, { position: audio!.currentTime }); // fire-and-forget
  }

  function onTimeUpdate() {
    const now = Date.now();
    if (now - lastSaved >= THROTTLE_MS) {
      lastSaved = now;
      flush();
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") flush();
  }

  audio.addEventListener("timeupdate", onTimeUpdate);
  audio.addEventListener("pause", flush);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    flush(); // save on unmount/navigation away from the player route
    audio.removeEventListener("timeupdate", onTimeUpdate);
    audio.removeEventListener("pause", flush);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}, [book?.id]);
```

### Anti-Patterns to Avoid

- **Awaiting anything before `.play()` inside a tap handler:** breaks the iOS gesture-unlock chain even though the tap was real (PITFALLS.md Pitfall 3). The object-URL/blob load must already be settled by the time the handler runs (Pattern 2).
- **Keying the object-URL effect on the whole `book` object instead of `book.id`:** `useLiveQuery` returns a new object reference on every position write; depending on the full object recreates and revokes the blob URL every 5 seconds, interrupting playback (see Pattern 2's "Critical detail").
- **Writing `position` on every `timeupdate` tick:** fires ~4x/sec; violates locked D-02 and PITFALLS.md's explicit Performance Trap.
- **Seeking `audio.currentTime` on every `onValueChange` tick during a scrub-bar drag:** causes choppy playback and defeats the reason D-03 exists — only seek in `onValueCommit`.
- **Auto-playing on mount to "resume":** never auto-play, even for PLAY-06 — always require an explicit tap (PITFALLS.md Pitfall 3's explicit guidance, and matches normal audiobook-app UX anyway). Restoring `currentTime` from the saved `position` on `loadedmetadata` is not the same as auto-playing — that part is safe and required for PLAY-06; only the actual `.play()` call must wait for a tap.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Scrub bar drag-vs-release detection | Custom `TouchEvent`/`PointerEvent` state machine tracking drag-start/move/end across both mouse and touch, plus manual ARIA `role="slider"` wiring | `@radix-ui/react-slider`'s `onValueChange`/`onValueCommit` | Radix already unifies pointer/touch/keyboard interaction and ships the accessible slider role; D-03's exact "pause on drag, seek on release" requirement maps 1:1 onto the two callbacks with no custom gesture code |
| Elapsed/remaining time formatting | A new formatter in the player component | `lib/format.ts`'s `percentComplete()`/`formatTimeRemaining()` | Already built, already tested (`scripts/library-logic.test.mjs`), and CONTEXT.md explicitly calls out reusing this for PLAY-04 to stay consistent with the library row's format |
| Object-URL memory management | Ad-hoc `useState` for the blob URL with no cleanup | `useEffect` cleanup function calling `URL.revokeObjectURL` | Already the documented Anti-Pattern 2 in this project's own ARCHITECTURE.md — an unrevoked object URL keeps the underlying Blob's memory alive, and a 100-300MB audiobook file leaking on every book-switch will exhaust mobile Safari's tab memory quickly |
| Book-not-found handling for a bad/deleted `[id]` | Silent blank screen | `notFound()` from `next/navigation`, or redirect to `/`, when `useLiveQuery` resolves the book lookup to `undefined` after the initial `undefined` (loading) state has passed | A player route reached via a stale bookmark or after LIBR-05 delete needs an explicit "book not found" path — matches the phase's `UI hint: yes` scope for state coverage |

**Key insight:** every hand-rolled piece this phase might be tempted to build (gesture tracking, time formatting, memory cleanup) either already exists in this codebase (Phase 2 built it) or is exactly what a well-known, already-partially-adopted primitive (Radix) is designed for. The only genuinely new code this phase writes is the `<audio>` event wiring itself and the Dexie read/write calls — both thin, direct uses of already-locked APIs.

## Runtime State Inventory

*Not applicable — this is a greenfield feature addition (new route, new components), not a rename/refactor/migration phase. Skipping per the trigger condition in the research protocol.*

## Common Pitfalls

### Pitfall A: Every 5-second position write re-serializes the entire `Book` record, including its multi-hundred-MB `blob` field — cost is unverified against the *actual* locked schema

**What goes wrong:** This project's own `.planning/research/ARCHITECTURE.md` (written before Phase 2 implementation) recommended splitting `booksMeta` and `bookBlobs` into two IndexedDB object stores specifically so that a frequent position write wouldn't need to touch the audio Blob (Anti-Pattern 1 in that document, in turn citing `web.dev`'s IndexedDB best-practices guide). The schema actually shipped in Phase 2 and locked (`lib/db.ts`, `[VERIFIED: /workspace/my-audiobooks/lib/db.ts:11-23]` — `Book` interface: `blob: Blob`, `position: number`, both on one record in a single `books` table, `db.version(1).stores({ books: '++id, title, importedAt' })`) did **not** take that split. CONTEXT.md explicitly states this schema "must not be edited in place" for Phase 3. That means `db.books.update(id, { position })` — the only available write path — operates on a record that also carries the Blob every single time, every 5 seconds, for the entire duration of playback.

**Why it happens:** IndexedDB has no notion of a true partial-field update at the storage-engine level — `IDBObjectStore.put()` always writes a complete structured-clone of the value you give it. Dexie's `Table.update(key, changes)` is implemented as `where(':id').equals(key).modify(changes)`, which opens a cursor, merges `changes` into the existing record in memory, and calls `cursor.update(mergedRecord)` — the merged record still has the (unchanged) `blob` field on it `[ASSUMED — Dexie internals recalled from training knowledge; dexie.org direct fetch was blocked by network egress this session and could not be independently re-confirmed]`. Whether the browser's IndexedDB engine is smart enough to recognize that the `Blob` object reference inside that merged record is byte-identical to what's already on disk (and skip re-copying the bytes, only updating the small scalar fields) versus naively re-persisting the whole thing is an engine-internal optimization that is plausible for Chromium (Blobs are stored as on-disk file handles referenced by pointer, per Chromium's own architecture docs) but is **not independently confirmed for WebKit/Safari** — and this project's own PITFALLS.md Pitfall 5 already documents Safari's IndexedDB implementation as comparatively immature with known transaction/Blob-handling bugs.

**How to avoid:** This cannot be fixed with a schema change (locked). Concrete mitigations available within Phase 3's scope:
1. Keep the write payload minimal — call `db.books.update(id, { position: audio.currentTime })` (only the changed field named in the `changes` object), never a manual read-spread-put of the whole `Book` object. This is already the natural way to call Dexie's `update()` and is what Pattern 4's code example does — don't let an implementation accidentally widen this to a full `put()`.
2. Add an explicit, named on-device verification step to the plan (not just "position saves work" — specifically: play a large real test file, ~150-300MB, for several continuous minutes on a physical iPhone, and confirm (a) no audible stutter/dropout coincides with the 5-second write boundary, (b) the Safari tab doesn't show memory-pressure reload behavior, (c) `console.time`/rough wall-clock timing around the position-write call stays well under the 5-second throttle window it's competing with).
3. If step 2 surfaces a real problem, the two lowest-risk in-scope fallbacks (still without touching the locked schema) are: increasing the throttle interval beyond 5s (would require a CONTEXT.md decision revisit, since D-02 locks 5s) or wrapping the `update()` call in a `requestIdleCallback`/microtask deferral so it doesn't compete with the `timeupdate` handler's own work — neither should be pre-emptively built without evidence step 2 shows a real problem.

**Warning signs:** Playback stutters or briefly drops out on a roughly 5-second cadence; the player becomes noticeably less smooth specifically on larger files than on small test files; Safari's tab reloads unexpectedly during long playback sessions (memory pressure).

### Pitfall B: `useLiveQuery`'s fresh object reference on every position write can silently break the object-URL lifecycle

**What goes wrong:** `db.books.update()` firing every 5 seconds (Pitfall A) means `useLiveQuery(() => db.books.get(id))` re-renders the player component with a **new** `Book` object every 5 seconds (only `position` changed, but Dexie's live query returns a fresh object identity). Any `useEffect` that creates the `URL.createObjectURL(book.blob)` and lists `book` (not `book.id`) in its dependency array will re-run every 5 seconds — revoking the currently-playing object URL and creating a new one mid-playback, which either interrupts the `<audio>` element's `src` or, worse, revokes the URL the audio element is actively streaming from.

**Why it happens:** This is a direct consequence of this codebase's already-established reactive pattern (`useLiveQuery`, used throughout `app/page.tsx`) combined with the new requirement to write frequently to the same record being displayed — a combination that didn't exist in Phase 2 (where `position` was never written after import).

**How to avoid:** Key every `book`-derived `useEffect` (object URL creation, `loadedmetadata` seek-restore) on `book?.id`, never on `book` itself. See Pattern 2's "Critical detail" and the code example there.

**Warning signs:** Playback silently stops or resets to the start every few seconds during a listening session; network/console errors referencing a revoked blob URL.

### Pitfall C: The iOS gesture-unlock constraint (PITFALLS.md Pitfall 3) applies to the scrub bar's resume-after-seek call too, not just the initial play button

**What goes wrong:** `onValueCommit`'s `audio.play()` call (Pattern 3) is triggered by a pointer-release event, which — unlike a `click`/`touchend` on a plain button — may or may not be treated as a fresh "user gesture" by iOS Safari depending on how Radix's internal pointer-capture event listeners are wired. If Radix's commit callback fires from a handler that isn't itself directly inside the browser's native gesture dispatch (e.g., if it's deferred via a microtask or React's synthetic event batching in a way that breaks the call-stack association), the resume-after-seek `.play()` call could silently fail the same way the play button would if awaited.

**Why it happens:** Same root cause as PITFALLS.md Pitfall 3, but in a less obvious call site — most implementers only think to test the primary play button for this constraint, not a secondary `.play()` call buried inside a slider's release callback.

**How to avoid:** Test the specific sequence "drag scrub bar while playing, release" on a real physical iPhone as its own named verification step, not just "play button works from cold." If it fails, the fallback is to not auto-resume from `onValueCommit` at all — leave the book paused after a scrub and require a second explicit tap on the play button (a real UX regression from D-03's implied "seek and continue" flow, but avoids relying on an unverified propagation of gesture context through a third-party component).

**Warning signs:** Scrubbing while playing leaves the book silently paused with no audio resuming, even though the scrub bar visually shows the new position.

## Code Examples

### Full `loadedmetadata` → resume pattern (PLAY-06)

```tsx
// Combines this project's own PITFALLS.md guidance (never auto-play) with
// ARCHITECTURE.md's Playback Position Flow (VERIFIED — read this session)
useEffect(() => {
  const audio = audioRef.current;
  if (!audio || !book) return;

  function onLoadedMetadata() {
    // Safe to set currentTime without a user gesture — this is a seek,
    // not a play() call, so it is not subject to PITFALLS.md Pitfall 3.
    audio!.currentTime = book!.position;
  }

  audio.addEventListener("loadedmetadata", onLoadedMetadata);
  return () => audio.removeEventListener("loadedmetadata", onLoadedMetadata);
}, [book?.id]);
```

### ±15s skip with end-of-book-aware clamping (PLAY-02, interacts with D-04)

```tsx
const SKIP_SECONDS = 15;

function skip(direction: 1 | -1) {
  const audio = audioRef.current;
  if (!audio || !book) return;
  const next = audio.currentTime + direction * SKIP_SECONDS;
  audio.currentTime = Math.min(Math.max(next, 0), book.duration);
  // Skipping forward into the last 15s clamps to `duration`, not past it —
  // consistent with D-04's "stop at duration, don't loop" end state.
}
```

### `ended` handling (D-04)

```tsx
useEffect(() => {
  const audio = audioRef.current;
  if (!audio || book?.id === undefined) return;

  function onEnded() {
    db.books.update(book!.id!, { position: audio!.duration });
    // D-04: do not reset to 0, do not auto-replay. Book now reads as
    // 100% complete via the same percentComplete()/formatTimeRemaining()
    // helpers the library row already uses.
  }

  audio.addEventListener("ended", onEnded);
  return () => audio.removeEventListener("ended", onEnded);
}, [book?.id]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Next.js dynamic route `params` as a synchronous prop | `params: Promise<{...}>`, unwrapped via `await` (Server Components) or React `use()` (Client Components) | Next.js 15.0.0-RC, carried forward into 16.3.0 (this project's installed version) `[VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md "Version History" table]` | This phase's player page must not write `{ params }: { params: { id: string } }` (Next 14-style) — that pattern is deprecated and this repo is already on 16.3.0. Use `useParams()` (this research's Pattern 1) to sidestep the Promise entirely in a Client Component. |
| `npx shadcn add <component>` to pull in new Radix-based UI primitives | Hand-vendoring: `pnpm add @radix-ui/react-*` + a manually written wrapper component matching shadcn's file shape | Established in this project's Phase 1/2 (registry.ui.shadcn.com is proxy-blocked in this dev environment) `[VERIFIED: /workspace/my-audiobooks/components/ui/progress.tsx:1-6 comment]` | The scrub bar's Radix Slider wrapper must be hand-written the same way `components/ui/progress.tsx` was, not installed via the shadcn CLI. |

**Deprecated/outdated:** Synchronous `params` access in Next.js dynamic routes — still works in 16.3.0 for backwards compatibility per the vendored docs, but is explicitly called out there as "will be deprecated in the future"; don't write new code depending on it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `@radix-ui/react-slider`'s `onValueChange`/`onValueCommit` split behaves exactly as described (continuous vs. release-only), including on iOS Safari touch | Architecture Patterns (Pattern 3), Don't Hand-Roll | If `onValueCommit` doesn't fire reliably on iOS touch release, D-03's seek-on-release behavior breaks; direct radix-ui.com docs fetch was blocked this session, so this is web-search-corroborated (MEDIUM), not independently verified from the primary source or against the exact installed 1.4.7 version's TypeScript types |
| A2 | Dexie's `Table.update()` performs a full-record `cursor.update()` internally (i.e., cannot avoid touching the `blob` field even though only `position` changed) | Common Pitfalls (Pitfall A) | If Dexie/IndexedDB actually has an optimized partial-write path that this research missed, Pitfall A's severity is overstated and the recommended on-device verification step, while still harmless to do, is lower-priority than presented; dexie.org direct fetch was blocked this session |
| A3 | The scrub bar's `onValueCommit`-triggered `.play()` call preserves iOS gesture-unlock context reliably | Common Pitfalls (Pitfall C) | If it doesn't, the fallback (require a second explicit play tap after scrubbing) is a UX regression from what D-03 implies; only resolvable by real-device testing, not further research |
| A4 | `@radix-ui/react-slider` package legitimacy: the `[SUS]`/"too-new" flag is routine monorepo release cadence, not a slopsquat risk | Package Legitimacy Audit | If wrong, a compromised package would be installed; mitigated by the required `checkpoint:human-verify` gate regardless of this assessment — the note is context for that human check, not a basis for skipping it |
| A5 | Native `<audio>` event names/timing (`timeupdate`, `loadedmetadata`, `ended`, `pause`) behave as described — this is extremely stable, long-standing browser API surface recalled from training knowledge; MDN direct fetch was blocked this session so it could not be re-verified against current MDN text | Code Examples, Architecture Patterns (Pattern 4) | Low risk given API stability, but any iOS Safari-specific quirk in event timing (e.g., `timeupdate` firing at a different cadence, or `loadedmetadata` timing differing for `blob:` URLs vs. network URLs) would not be caught until real-device testing |

**If this table is empty:** N/A — see entries above; all are flagged for real-device verification during phase execution, consistent with this project's established practice (PITFALLS.md's "Looks Done But Isn't" checklist already requires physical-iPhone verification for playback).

## Open Questions

1. **Does the library screen's per-row progress bar need to reflect position live while a book plays in the player route?**
   - What we know: CONTEXT.md explicitly leaves this to Claude's discretion; the library route (`app/page.tsx`) already uses `useLiveQuery`, so if the user navigates back to the library screen after the player has written a position update, the row will reflect it automatically (no extra code needed) — but while the player route is still mounted, `app/page.tsx` isn't mounted at all (D-01 is a full route navigation, not an overlay), so there's no "simultaneously visible" case to solve in Phase 3's single-`<audio>`-element architecture.
   - What's unclear: whether a future phase (background playback, PLAY2-02) would change this.
   - Recommendation: no special handling needed in Phase 3 — the existing `useLiveQuery` re-fetch on next visit to `/` already satisfies this by construction, given D-01's route-based (not overlay-based) player.

2. **Exact TypeScript prop signature for `@radix-ui/react-slider@1.4.7`'s `Slider.Root`, `onValueChange`, `onValueCommit`**
   - What we know: the callback split and general behavior (Pattern 3), confirmed to exist on the npm registry at this version.
   - What's unclear: exact prop names/types for this specific version were not fetched from an official source this session (radix-ui.com blocked).
   - Recommendation: planner/executor should check the installed package's `.d.ts` files directly (`node_modules/@radix-ui/react-slider`) once installed, rather than relying solely on this research's example code for exact signatures.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Build/dev tooling | ✓ | v22.22.2 | — |
| pnpm | Package manager (locked via `packageManager` field) | ✓ | 10.33.0 | — |
| `@radix-ui/react-slider` (npm registry) | Scrub bar primitive | ✓ (confirmed via `npm view`, not yet installed in this repo) | 1.4.7 | Native `<input type="range">` if the `checkpoint:human-verify` gate rejects the package (see Package Legitimacy Audit / Alternatives Considered) |
| Physical iPhone (real device) | Verifying PITFALLS.md Pitfall 3 (gesture-unlock), Pitfall A/C above, and PLAY-06 resume-after-force-quit | Not verifiable from this research environment — carried forward from STACK.md/PITFALLS.md as a non-negotiable requirement for this phase's sign-off | — | None — simulator/desktop testing is explicitly insufficient per this project's own PITFALLS.md Technical Debt Patterns table |

**Missing dependencies with no fallback:**
- Physical iPhone testing — this phase cannot be considered verified without it, consistent with prior phases' established practice in this project (STATE.md blockers/concerns already flag this).

**Missing dependencies with fallback:**
- `@radix-ui/react-slider` — native `<input type="range">` is a viable, if less polished, fallback if the package is rejected at the human-verify checkpoint.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | No accounts/auth exist anywhere in this app by design (REQUIREMENTS.md Out of Scope) |
| V3 Session Management | No | No sessions — single local device, no server |
| V4 Access Control | No | No multi-user/multi-tenant concept; the only "access control"-adjacent concern is a route param (`[id]`) resolving to a book that may not exist (e.g., after LIBR-05 delete) — handled as a not-found UX case (Don't Hand-Roll table), not an authorization concern |
| V5 Input Validation | Yes (narrow) | The `[id]` route param is an arbitrary string from the URL; must be validated as a parseable number before use as a Dexie primary key (`Number(params.id)`), and a `NaN`/out-of-range result must route to the not-found path rather than being passed to `db.books.get()` unchecked |
| V6 Cryptography | No | No cryptographic operations in this phase; audio Blobs are stored and read as-is |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Malformed/non-numeric `[id]` route param passed directly to `Number()` and then `db.books.get()` | Tampering (of app state, not data — no security boundary is actually crossed, but a malformed id could throw or produce confusing `undefined`-forever UI) | Validate `Number.isFinite(Number(params.id))` before querying; treat invalid/not-found ids identically (route to a not-found state) rather than distinguishing "malformed" from "doesn't exist" in the UI, since both are the same user-facing outcome and distinguishing them adds no real value in a single-user local app |
| Object URL (`blob:` URL) leakage across book switches | Information Disclosure (theoretical only — same-origin, same-tab; not a real cross-user/cross-origin exposure in this single-user local app) | Already covered functionally by the object-URL revoke pattern (Pattern 2) — included here because it is also, secondarily, a hygiene practice, not because there's a realistic attacker model in a single-device personal app |

*(This app has no server, no accounts, no network requests for its core functionality, and a single local user — most ASVS categories are structurally inapplicable, consistent with PITFALLS.md's own Security Mistakes section, which already notes the main residual risk in this codebase's threat model is supply-chain (a compromised npm dependency), addressed by the Package Legitimacy Audit above, not by Phase 3-specific application logic.)*

## Sources

### Primary (HIGH confidence — read directly this session)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` — Next.js 16 dynamic route param conventions, Client Component `use(params)` pattern, "Good to know" TypeScript helper guidance
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` — `PageProps` helper, params/searchParams Promise behavior, version history (params became a Promise in 15.0.0-RC)
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-params.md` — `useParams()` synchronous Client Component API, Cache Components/Suspense caveat
- `/workspace/my-audiobooks/lib/db.ts` — actual locked v1 Dexie schema (single `books` table, `blob`/`position` co-located, not indexed)
- `/workspace/my-audiobooks/lib/format.ts` — existing `percentComplete()`/`formatTimeRemaining()` to reuse for PLAY-04
- `/workspace/my-audiobooks/components/library-row.tsx` — existing hand-rolled `TouchEvent` pattern (precedent, contrast for the scrub-bar decision)
- `/workspace/my-audiobooks/components/ui/progress.tsx` — precedent for hand-vendoring a Radix primitive because the shadcn registry is proxy-blocked in this environment
- `/workspace/my-audiobooks/.planning/phases/01-install-offline-app-shell/01-UI-SPEC.md` — locked design tokens (Accent `#E8B34A` reserved for Phase 3 play/pause + active progress fill), and this document's own line explicitly anticipating "Phase 3 (Slider, Button)"
- `npm view @radix-ui/react-slider version` / `time.modified` / `repository.url`, and the same for `@radix-ui/react-progress`/`@radix-ui/react-alert-dialog` — registry-level version/publish-date/repo confirmation, run this session

### Secondary (MEDIUM confidence — web search, cross-checked)
- GitHub `radix-ui/primitives` discussions #2169 and issue #903 — `onValueChange` vs `onValueCommit` behavior description (direct radix-ui.com docs fetch blocked by network egress this session)
- Multiple community sources on native `<input type="range">` `input` (continuous) vs `change` (release-only) event semantics, consistent across browsers including iOS Safari

### Tertiary (LOW confidence — training knowledge, not independently verified this session)
- Dexie `Table.update()` internal implementation (cursor-based `modify()`, full-record `cursor.update()` call) — dexie.org direct fetch blocked this session
- IndexedDB Blob-storage-by-reference behavior in Chromium vs. unconfirmed for WebKit/Safari — MDN and Chromium source doc direct fetches either blocked or inconclusive this session
- Native `<audio>`/`HTMLMediaElement` event names and timing (`timeupdate`, `loadedmetadata`, `ended`, `pause`) — MDN direct fetch blocked this session; this is long-stable, extremely well-established browser API surface, but flagged LOW per this session's actual verification, not per real-world API stability

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — native `<audio>`, Dexie, Next.js APIs all directly confirmed either from source-of-truth files in this repo or the repo's own vendored Next.js 16 docs
- Architecture: MEDIUM-HIGH — routing/component structure is directly informed by this project's own already-verified ARCHITECTURE.md and the actual shipped `lib/db.ts`; the one genuinely new finding (Pitfall A, blob-record-rewrite cost) is appropriately flagged LOW/ASSUMED pending on-device verification
- Pitfalls: MEDIUM — PITFALLS.md's existing Pitfall 3/5 are directly reused (already project canon); this research's three new pitfalls (A/B/C) are reasoned extensions grounded in the actual locked schema and `useLiveQuery` behavior, but are not independently fetched from a primary source this session (network egress to MDN/dexie.org/radix-ui.com was blocked throughout)

**Research date:** 2026-08-11
**Valid until:** 30 days (stack is stable; re-verify `@radix-ui/react-slider`'s exact version/API and Pitfall A's on-device findings sooner if implementation is delayed)
