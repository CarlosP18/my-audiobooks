# Phase 2: Import & Library - Research

**Researched:** 2026-08-08
**Domain:** Client-side file import (iOS Safari file picker) + persistent on-device storage (Dexie/IndexedDB) for a Next.js PWA
**Confidence:** MEDIUM (core Dexie/shadcn API shapes cross-checked across multiple independent sources and official docs snippets returned by search; iOS-Safari-specific behavioral claims — file picker MIME quirks, IndexedDB transaction hygiene — remain WebSearch-sourced, not device-verified, consistent with the project's own PITFALLS.md caveat that real-device testing is the only ground truth for this domain)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Import Flow**
- **D-01:** The Phase 1 empty-state body copy ("Import an audiobook to start listening.") becomes the tappable import trigger itself — no separate button or icon is added. It opens the iOS file picker directly. — Reversibility: reversible.
- **D-02:** While a picked file is being copied into internal storage, a placeholder row appears in the library list showing progress (spinner or progress bar), and resolves into the real book row once the copy completes. This applies even on an empty library (the placeholder is the first/only row).
- **D-03:** On import failure (unsupported format, insufficient storage, or any copy error), show an inline, dismissible error message near the import control. Do not block the rest of the app; no full-screen error state.

**Title Cleanup Rule (LIBR-03)**
- **D-04:** Cleanup algorithm is deterministic and simple: strip the file extension, replace underscores and dashes with spaces, collapse repeated whitespace, then apply Title Case. Example: `the_great_gatsby-01.mp3` → `The Great Gatsby 01`.
- **D-05:** No special-case parsing for patterns like `Author - Title.m4b` or `01 - Chapter.mp3`. Basic cleanup only. May be revisited in a v2 metadata-parsing pass (META-01, already deferred).

**Progress Indicator (LIBR-04)**
- **D-06:** Each library row shows **both** percent complete and time remaining together (e.g., "45% — 2h 15m remaining"), not just one. Requires knowing each audio file's total duration (read at import time, stored as metadata) — deferred to research/planner to confirm the reliable way to read duration client-side.

**Delete (LIBR-05)**
- **D-07:** Swipe-to-delete is the interaction pattern — swiping a library row reveals a delete action, matching native iOS list conventions. No permanently-visible delete icon per row.
- **D-08:** Confirmation copy is locked verbatim: **"Delete book: Remove '{title}' and free its storage? This can't be undone."** — swipe reveals the action, tapping it shows this confirmation before the delete actually runs.

### Claude's Discretion
- Exact placeholder-row visual treatment during import copy (spinner vs progress bar, exact styling) — within the dark-neutral design tokens locked in Phase 1's UI-SPEC (`app/globals.css`).
- Exact wording of the inline import-failure error message (D-03) — no specific copy requested beyond "inline, dismissible, near the import control."
- Whether the iOS file picker allows multi-select — looping the same per-file copy/error flow over each selected file is an acceptable implementation choice, not a scope change.
- Exact Dexie.js schema (tables, indexes) for storing Blobs + metadata — research and planner own this. **(See Architecture Patterns below.)**
- How book duration is read/stored to support D-06's time-remaining display. **(See Code Examples below.)**

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Filename pattern-specific parsing (author/title splitting, track-number stripping) was explicitly discussed and declined for v1 per D-05, not deferred (metadata-based parsing exists as META-01, already in REQUIREMENTS.md v2).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPT-01 | User can import an audio file via the iOS file picker, regardless of format (mp3, m4b, m4a, etc.) | File Picker Behavior section — `accept` attribute cannot reliably filter on iOS; validate post-selection by extension, not just MIME. Multi-select behavior and looping pattern documented. |
| IMPT-02 | Imported file is copied into the app's internal storage, not just referenced | Dexie schema design + Code Examples — `File`/`Blob` read via the picker and `put()` directly into a Dexie table (never a file-system reference/path). |
| LIBR-01 | User can see a list of all imported audiobooks | Dexie schema (`books` table) + `dexie-react-hooks` `useLiveQuery()` pattern for reactive list rendering. |
| LIBR-02 | Library persists across app restarts and device reboots | IndexedDB via Dexie is the persistence layer (already the project's locked storage decision per STACK.md); Pitfall section documents the one real risk (iOS 7-day eviction, inherited from PITFALLS.md, not re-litigated here) and versioned-schema requirement. |
| LIBR-03 | Library list shows a cleaned-up title derived from the filename (not the raw filename) | Title cleanup algorithm is fully locked by D-04/D-05 — a pure string function, no external research needed; documented in Code Examples for completeness. |
| LIBR-04 | Library list shows per-book progress (percent complete or time remaining) | Audio Duration Reading section — hidden `<audio>` element + `loadedmetadata` pattern to capture duration at import time, stored in the metadata record; progress % derives from `position / duration` once Phase 3 introduces real position writes (0% for all Phase 2 imports). |
| LIBR-05 | User can delete an audiobook from the library to free up storage | shadcn `alert-dialog` component (confirmation) + Dexie `delete()` call removing both the Blob and metadata record; swipe gesture is a plain touch-event pattern, no library needed. |

</phase_requirements>

## Summary

This phase introduces the app's first real persistence layer. The project-level STACK.md decision to use **Dexie.js 4.4.x** as a single IndexedDB wrapper for both audio Blobs and metadata is confirmed current (verified against the live npm registry: `dexie@4.4.4`, `dexie-react-hooks@4.4.0`) and should not be revisited. The core technical risk this phase must actively defend against — flagged in STATE.md and PITFALLS.md — is iOS Safari's comparatively immature IndexedDB implementation: transactions that auto-close around `await` boundaries, `QuotaExceededError` (and Dexie sometimes surfacing it as `AbortError` instead), and the general rule that Blobs must be stored as raw `Blob` objects in their own table, never nested inside a larger metadata object or serialized to `ArrayBuffer`.

The import flow has two file-picker realities that shape the plan: iOS Safari does **not** reliably filter the native picker UI by the `accept` attribute (users can and will pick non-audio files via "Browse"), so validation must happen client-side after selection, by file extension as the primary signal (not `File.type`, which iOS Safari populates inconsistently — sometimes empty string, sometimes `video/mp4` for `.m4b` files despite them being audio). Duration must be read client-side with no server: the reliable, cross-format-compatible approach is assigning the picked file (via `URL.createObjectURL`) to a hidden `<audio>` element and reading `.duration` off the `loadedmetadata` event — this works for mp3/m4a/m4b since it uses the browser's native decoder, the same one `<audio>` playback will use in Phase 3.

This is also the first phase to add real shadcn/ui components on top of Phase 1's initialized-but-empty `components.json` (`style: new-york`, `baseColor: neutral`). The delete confirmation maps directly to shadcn's `alert-dialog` component; the import placeholder-row progress indicator maps to shadcn's `progress` component (or a plain spinner, at Claude's discretion per CONTEXT.md).

**Primary recommendation:** Build one storage chokepoint (`lib/db.ts`) with a Dexie schema split into two tables — `books` (Blob, indexed only on lightweight fields) — from day one with an explicit versioned schema (`db.version(1).stores(...)`), wrap every write in try/catch treating `QuotaExceededError`/`AbortError` as an expected, user-facing failure (D-03), and read duration via a hidden `<audio>` element at import time before the file ever touches IndexedDB.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File selection (iOS file picker) | Browser / Client | — | `<input type="file">` is a pure client-side DOM API; no server exists in this project (PROJECT.md: no backend). |
| File type/extension validation | Browser / Client | — | Must happen after selection since iOS doesn't reliably filter picker choices; runs entirely in JS before any storage write. |
| Audio duration extraction | Browser / Client | — | Hidden `<audio>` element decodes metadata locally; no network round-trip possible or desired. |
| Blob + metadata persistence | Database / Storage (IndexedDB via Dexie) | — | The project's only storage tier — no backend API layer exists between the UI and IndexedDB (confirmed: PROJECT.md "no backend," STACK.md "one storage-layer module"). |
| Title cleanup transform | Browser / Client | — | Pure string function (D-04), runs at import time before the metadata record is written; no persistence of raw filename needed beyond what's already in the File object during that session. |
| Library list rendering | Browser / Client (React, via Frontend Server SSR shell) | Database / Storage (read) | `app/page.tsx` (Next.js App Router client component) reads live Dexie state via `useLiveQuery()`; Next.js's SSR tier renders only the static shell, not book data (no data exists at build/request time server-side — IndexedDB is client-only). |
| Delete confirmation + execution | Browser / Client | Database / Storage (write) | shadcn `alert-dialog` runs entirely client-side; the actual delete is a Dexie `.delete()` call against the same client-side database. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `dexie` | 4.4.4 [VERIFIED: npm registry `npm view dexie version` → `4.4.4`] | IndexedDB wrapper for audio Blobs + metadata in one database | Already the project's locked decision (STACK.md, carried into CLAUDE.md's injected stack section) — promise-based API with built-in versioned schema migrations, avoids raw IndexedDB callback boilerplate. Confirmed still the current published version. |
| `dexie-react-hooks` | 4.4.0 [VERIFIED: npm registry `npm view dexie-react-hooks version` → `4.4.0`] | `useLiveQuery()` reactive bindings for the library list | Project's STACK.md cited an older `1.1.x` guess (websearch snippet, LOW confidence at the time); registry now shows `4.4.0` tracking Dexie's own major version, with `peerDependencies: { dexie: ">=4.2.0-alpha.1 <5.0.0", react: ">=16" }` — compatible with the installed `dexie@4.4.4` and `react@19.2.8`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-alert-dialog` | 1.1.23 [VERIFIED: npm registry `npm view @radix-ui/react-alert-dialog version`] | Underlying primitive shadcn's `alert-dialog` component wraps | Auto-installed by `npx shadcn add alert-dialog` — not installed directly; listed for legitimacy-audit transparency. |
| `@radix-ui/react-progress` | 1.1.16 [VERIFIED: npm registry `npm view @radix-ui/react-progress version`] | Underlying primitive shadcn's `progress` component wraps | Auto-installed by `npx shadcn add progress`, only if the placeholder-row visual (D-02, Claude's discretion) uses a progress bar rather than a spinner. |
| `class-variance-authority` | ^0.7.x [ASSUMED — version not directly queried; already a transitive shadcn dependency pattern from Phase 1's `components.json` init] | Variant styling used internally by shadcn-generated components (e.g. destructive vs default button variants inside alert-dialog) | Auto-installed alongside any shadcn component add; no direct action needed. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dexie for Blob storage | Origin Private File System (OPFS) | Already rejected at project level (STACK.md) — only revisit if profiling shows a measured IndexedDB bottleneck; not a Phase 2 concern. |
| Hidden `<audio>` element for duration | `music-metadata-browser` / similar tag-parsing library | Would also enable META-01 (title/author from embedded tags) but that's explicitly v2/deferred; adding a parsing dependency now to only extract duration is unjustified — the native `loadedmetadata` approach needs zero new dependencies. |
| shadcn `alert-dialog` for delete confirmation | Plain `window.confirm()` | `window.confirm()` cannot be styled to match the locked dark-neutral design tokens and reads as a jarring native browser dialog inside an installed PWA — shadcn's version is the only path consistent with Phase 1's design system lock-in. |

**Installation:**
```bash
pnpm add dexie dexie-react-hooks
npx shadcn add alert-dialog
npx shadcn add progress   # only if the placeholder row uses a progress bar, not a spinner
```

**Version verification:** Confirmed live against the npm registry during this research session (`npm view <pkg> version`), not training-data guesses. `dexie-react-hooks` in particular had drifted from the project's own STACK.md-cited `1.1.x` (LOW confidence at the time it was written) to the actual current `4.4.0` — re-verify at install time regardless, since Dexie ships frequently.

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|------|-----------|-------------|---------|-------------|
| `dexie` | npm | latest version published 2026-06-16 | ~2.1M/week [CITED: npmjs.com/package/dexie via WebSearch snippet] — tool's own downloads lookup returned `null` (network-restricted in this sandbox) | `github.com/dexie/Dexie.js` | SUS (tool-reported: `unknown-downloads`) | **Approved** — already the project's locked stack decision (STACK.md, in use conceptually since Phase 1's CLAUDE.md injection); cross-checked download count independently confirms an extremely well-established package. No `checkpoint:human-verify` needed given prior project-level lock-in, but flagged here for transparency. |
| `dexie-react-hooks` | npm | latest version published 2026-03-18 | shares `dexie`'s repo/maintainer; downloads lookup also returned `null` | `github.com/dexie/Dexie.js` (monorepo) | SUS (tool-reported: `unknown-downloads`) | **Approved** — same monorepo/maintainer as `dexie`, no postinstall script, official companion package documented on `dexie.org`. |
| `@radix-ui/react-alert-dialog` | npm | latest version published 2026-07-24 | ~10.9M/week [CITED: npmtrends.com/socket.dev via WebSearch snippet] | `github.com/radix-ui/primitives` | SUS (tool-reported: `too-new` + `unknown-downloads`) | **Approved** — "too-new" reflects the *latest version's* publish date (Radix ships very frequently), not the package's founding date; cross-checked downloads confirm this is one of the most widely used React primitive libraries and is the direct dependency shadcn's own `alert-dialog add` command installs. |
| `@radix-ui/react-progress` | npm | latest version published 2026-07-24 | not independently queried this session; same publisher/repo as `@radix-ui/react-alert-dialog` above | `github.com/radix-ui/primitives` | SUS (tool-reported: `too-new` + `unknown-downloads`) | **Approved** — same reasoning as `@radix-ui/react-alert-dialog`; only installed if the progress-bar visual is chosen over a spinner. |
| `class-variance-authority` | npm | first observed 2024-11-26 | not independently queried this session | `github.com/joe-bell/cva` | SUS (tool-reported: `unknown-downloads`) | **Approved, [ASSUMED] provenance** — standard transitive dependency of every shadcn component; not a package the plan installs directly. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** all five packages above — every SUS verdict in this audit stems from the legitimacy-check tool being unable to reach the npm downloads API in this sandboxed research session (`weeklyDownloads: null`, reason `unknown-downloads`), not from any actual red flag (no packages are newly created, none have suspicious postinstall scripts — confirmed empty via `npm view <pkg> scripts.postinstall`, all resolve to well-known, actively-maintained GitHub orgs). Independent WebSearch cross-checks for `dexie` and `@radix-ui/react-alert-dialog` found multi-million weekly download counts. Given this, and that `dexie`/`dexie-react-hooks` are already locked project-level decisions (not new discoveries), **the planner may skip an explicit `checkpoint:human-verify` task for these five packages**, but should note in the plan that the legitimacy tool's automated check was inconclusive (network-restricted) rather than clean, in case the execution environment has different network access and returns a cleaner verdict.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser / Client (app/page.tsx — React client component)            │
│                                                                        │
│  [Empty-state text / Import trigger] (D-01)                          │
│         │ tap                                                        │
│         ▼                                                            │
│  <input type="file" accept="audio/*,.mp3,.m4a,.m4b" multiple>        │
│         │ user picks file(s) via iOS Files app / Browse              │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ Per-file import pipeline (looped if multi-select)         │        │
│  │  1. Validate extension (mp3/m4a/m4b) — reject others  ──┐ │        │
│  │     (D-03: inline dismissible error, no full-screen)  │ │        │
│  │  2. Insert placeholder row into library UI (D-02)      │ │        │
│  │  3. Read duration: hidden <audio> + loadedmetadata     │ │        │
│  │  4. Clean title: strip ext → replace _/- → collapse    │ │        │
│  │     ws → Title Case (D-04, D-05)                       │ │        │
│  │  5. db.books.add({ blob: File, title, duration, ... }) │ │        │
│  │     wrapped in try/catch for QuotaExceededError/        │ │        │
│  │     AbortError (D-03 surfaces as inline error)          │ │        │
│  └───────────────────────┬───────────────────────────────┘ │        │
│                           ▼                                 │        │
│              ┌─────────────────────────┐                    │        │
│              │   lib/db.ts (Dexie)      │◀───── reject ──────┘        │
│              │   IndexedDB, single      │                             │
│              │   origin-scoped database │                             │
│              │   table: books           │                             │
│              └────────────┬─────────────┘                            │
│                           │ useLiveQuery()                            │
│                           ▼                                           │
│              ┌─────────────────────────┐                             │
│              │  Library list render     │                             │
│              │  (title, %, time-left)   │                             │
│              │  swipe → AlertDialog →   │                             │
│              │  db.books.delete(id)     │                             │
│              └─────────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘

Note: no network boundary crosses this diagram — no backend exists (PROJECT.md constraint).
Service Worker / Cache Storage (Phase 1) is a parallel, untouched tier — audio bytes
NEVER route through it (PITFALLS.md Pitfall 6, 01-PATTERNS.md).
```

### Recommended Project Structure
```
app/
├── page.tsx           # becomes the data-driven library screen (replaces Phase 1 static empty state)
lib/
├── db.ts              # Dexie instance + schema (single storage chokepoint, per SKELETON.md's inherited constraint)
├── title.ts           # pure title-cleanup function (D-04/D-05) — easily unit-testable in isolation
├── duration.ts         # readAudioDuration(file: File): Promise<number> helper (hidden <audio> pattern)
components/
├── ui/                # shadcn-generated: alert-dialog.tsx, progress.tsx (added this phase)
├── library-row.tsx    # per-book row: title, progress/time-remaining, swipe-to-delete
├── import-trigger.tsx # wraps the empty-state text / file input (D-01)
```

### Pattern 1: Single Dexie chokepoint with versioned schema, Blob and metadata co-located but never indexed together

**What:** One `books` table holds both the audio `Blob` and its metadata in a single record, but the schema's index string only lists the small scalar fields — never the Blob property itself.

**When to use:** From the very first version declaration — retrofitting `onupgradeneeded`/version bumps onto an unversioned schema after real user data exists is explicitly called out as a high-risk mistake in this project's own PITFALLS.md (Pitfall 5) and Technical Debt Patterns table.

**Example:**
```typescript
// lib/db.ts
// Source: Dexie.js official docs pattern (dexie.org/docs/Tutorial/Design — schema/versioning)
// cross-checked via WebSearch snippet of dexie.org content [CITED: dexie.org/docs/Tutorial/Design]
import Dexie, { type EntityTable } from 'dexie';

export interface Book {
  id?: number;           // auto-incrementing primary key (++id)
  blob: Blob;             // the audio file's raw bytes — NOT indexed
  title: string;           // cleaned title (D-04)
  filename: string;        // original filename, kept for reference/debugging
  importedAt: number;       // Date.now() at import time
  fileSize: number;         // blob.size in bytes
  duration: number;          // seconds, read via hidden <audio> at import (LIBR-04)
  position: number;          // playback position in seconds — 0 for every Phase 2 import;
                              // Phase 3 is what advances this (per CONTEXT.md phase boundary)
}

const db = new Dexie('MyAudiobooksDB') as Dexie & {
  books: EntityTable<Book, 'id'>;
};

// v1 schema — only scalar/indexable fields listed; `blob` is deliberately absent
// from the index string (Dexie only allows indexing string/number/Date/Array types,
// and indexing large binary data provides no query benefit while adding write cost).
db.version(1).stores({
  books: '++id, title, importedAt',
});

export { db };
```

### Pattern 2: Reactive library list via `useLiveQuery`

**What:** `dexie-react-hooks`'s `useLiveQuery()` re-runs a Dexie query and re-renders automatically whenever the underlying table changes (import completes, delete happens) — no manual state plumbing.

**When to use:** For `app/page.tsx`'s library list and any component that reads book data reactively.

**Example:**
```typescript
// Source: dexie.org/docs/dexie-react-hooks/useLiveQuery() [CITED: dexie.org, via WebSearch snippet]
'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export default function LibraryPage() {
  const books = useLiveQuery(() => db.books.toArray(), []);
  // books is undefined during the initial async read, then an array (possibly empty)
  // — this distinction matters for correctly rendering the Phase 1 empty state
  // vs. a genuinely loading state.
  if (books === undefined) return null; // or a lightweight loading placeholder
  if (books.length === 0) return <EmptyState />; // Phase 1's locked copy, unchanged
  return <ul>{books.map((b) => <LibraryRow key={b.id} book={b} />)}</ul>;
}
```

### Pattern 3: Defensive import transaction — synchronous, single-table, explicit error handling

**What:** Keep the entire import write as one direct `table.add()` call with no unrelated `await` interleaved inside the same logical operation, and explicitly catch quota/abort errors.

**When to use:** Every write to `db.books` — this project's single highest-risk operation given "hundreds of MB" files (PROJECT.md) landing in Safari's less battle-tested IndexedDB implementation.

**Example:**
```typescript
// Source: pattern synthesized from Dexie error-handling docs + PITFALLS.md Pitfall 5's
// "keep transactions short/synchronous" guidance [CITED: dexie.org via WebSearch snippet
// for bulkPut/add error semantics; PITFALLS.md is this project's own prior research]
async function importFile(file: File): Promise<Book> {
  // 1 & 2: do all async prep (duration read, title cleanup) BEFORE the Dexie write,
  // so the actual db.books.add() call is not interleaved with unrelated awaits.
  const duration = await readAudioDuration(file);
  const title = cleanTitle(file.name);

  try {
    const id = await db.books.add({
      blob: file, // File is a Blob subtype — Dexie stores it directly
      title,
      filename: file.name,
      importedAt: Date.now(),
      fileSize: file.size,
      duration,
      position: 0,
    });
    return { id, blob: file, title, filename: file.name, importedAt: Date.now(), fileSize: file.size, duration, position: 0 };
  } catch (err) {
    // Dexie has been observed surfacing storage-full conditions as either
    // QuotaExceededError OR AbortError depending on browser — handle both explicitly
    // rather than assuming QuotaExceededError alone (Dexie GitHub issue #776, WebSearch-sourced).
    if (err instanceof Error && (err.name === 'QuotaExceededError' || err.name === 'AbortError')) {
      throw new ImportError('Not enough storage to import this file.');
    }
    throw new ImportError('Could not import this file.');
  }
}
```

### Anti-Patterns to Avoid
- **Storing the Blob field in the index string:** `db.version(1).stores({ books: '++id, blob, title' })` — indexing a Blob provides no query benefit and forces Dexie to attempt structured-clone indexing on binary data, adding write cost for nothing [CITED: dexie.org / medium.com Dexie blog on this exact pattern, via WebSearch].
- **Awaiting unrelated promises between the duration read and the `db.books.add()` call:** widens the window in which Safari's stricter transaction-closing behavior can interfere; always finish all async prep, then perform the write as its own tight operation.
- **Trusting `File.type` for format validation:** iOS Safari has been reported to populate `.type` inconsistently for `.m4b` files (sometimes empty, sometimes `video/mp4` even though the file is audio) — validate primarily by file extension, with MIME as a secondary signal only.
- **Reading the whole Blob into an `ArrayBuffer` to "process" it before storing:** unnecessary for import (only duration is needed, via `<audio>`, not manual byte parsing) and directly contradicts STACK.md's explicit "What NOT to Use" guidance on `ArrayBuffer` serialization cost.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB transaction/schema management | Raw `indexedDB.open()` + manual `onupgradeneeded` | Dexie.js (already locked stack decision) | Dexie's versioned `.stores()` API and promise-based transactions eliminate an entire class of manual callback bugs that are exactly the kind Safari's stricter transaction behavior punishes hardest. |
| Reactive UI updates on data change | Manual `useState` + re-fetch after every import/delete | `dexie-react-hooks`'s `useLiveQuery()` | Automatically tracks which queries are affected by a write and re-renders only those components — avoids a whole category of stale-list bugs. |
| Destructive-action confirmation dialog | Custom modal component or `window.confirm()` | shadcn `alert-dialog` (Radix-based) | Radix handles focus trapping, escape-key dismissal, and screen-reader semantics correctly out of the box; `window.confirm()` can't be styled to match the locked design tokens. |
| Audio duration extraction | Manual binary parsing of ID3/MP4 atoms per format | Hidden `<audio>` element + `loadedmetadata` | The browser's native media decoder already handles mp3/m4a/m4b container parsing correctly and consistently — reimplementing per-format duration parsing is significant, fragile, unnecessary work for a value the platform already exposes for free. |

**Key insight:** Every "don't hand-roll" item above maps to a capability the browser platform or the already-locked Dexie dependency provides natively — this phase's actual net-new code should be limited to the storage schema, the title-cleanup pure function (which genuinely is simple enough to hand-roll per D-04/D-05), and UI wiring.

## Common Pitfalls

### Pitfall 1: iOS Safari's `accept` attribute does not filter the native file picker
**What goes wrong:** Developer sets `<input type="file" accept="audio/*">` and assumes iOS will only show audio files in the Files app browser, the way Android's picker does. iOS Safari does not implement this filtering — users see the full Photos/Files chooser and can select any file type.
**Why it happens:** Documented, longstanding iOS Safari behavior (STACK.md's own "What NOT to Use" table already flags this at project level; re-confirmed here via independent WebSearch on the `accept` attribute spec/compat behavior).
**How to avoid:** Set `accept="audio/mpeg,.mp3,audio/mp4,.m4a,.m4b"` as a best-effort hint (still worth setting — it helps on the rare occasion it does narrow results, and costs nothing), but treat it as non-authoritative. Always validate the picked file's extension (and, secondarily, MIME type) after selection, before writing to IndexedDB, and reject with the inline error from D-03 if it doesn't match.
**Warning signs:** Import "succeeds" for a picked `.jpg` or `.pdf`, producing a broken library row with no playable audio.

### Pitfall 2: `File.type` is unreliable for `.m4b` files specifically
**What goes wrong:** Code branches on `file.type === 'audio/mp4'` or similar and silently misclassifies `.m4b` audiobook files, since iOS Safari has documented inconsistency reporting MIME type for this specific extension (sometimes empty string, sometimes video-flavored MIME types even though the container only holds audio) [CITED: github.com/advplyr/audiobookshelf issue #3310, via WebSearch].
**Why it happens:** `.m4b` shares its container format with `.m4a`/`.mp4`; browsers infer MIME from OS-level file association data that iOS doesn't always populate consistently for this less-common extension.
**How to avoid:** Validate primarily by extension (`.mp3`, `.m4a`, `.m4b` — case-insensitive), falling back to MIME type only as a secondary signal, never as the sole gate. This directly supports IMPT-01's "regardless of format" requirement.
**Warning signs:** A real `.m4b` audiobook gets rejected by the import validator even though it's a perfectly valid file the user obviously intended to import.

### Pitfall 3: IndexedDB transactions in Safari can abort around `await` boundaries
**What goes wrong:** Async prep work (duration read, title cleanup) gets interleaved with the actual Dexie write, or multiple unrelated Dexie operations get chained with awaits in between — Safari's stricter transaction-closing behavior can silently abort the transaction, losing the write with no obvious error in casual testing.
**Why it happens:** Documented in this project's own PITFALLS.md (Pitfall 5), consistent with independent WebSearch findings on IndexedDB transaction lifetime and the general advice to keep transactions short-lived and free of unrelated interleaved awaits.
**How to avoid:** Complete all async prep (duration read via `<audio>`, title cleanup) *before* calling `db.books.add()`, so the write itself is a single, tight async call with no unrelated work interleaved (see Code Examples Pattern 3).
**Warning signs:** Import appears to succeed in rapid manual testing but occasionally "loses" a book under real usage; only reproduces on physical iPhone, never in desktop dev tools.

### Pitfall 4: Quota-exceeded errors surface inconsistently across browsers/engines
**What goes wrong:** Code only catches `QuotaExceededError` by name, but Dexie has been observed to sometimes throw `AbortError` instead when storage runs out, depending on the underlying browser engine [CITED: github.com/dfahlander/Dexie.js issue #776, via WebSearch] — an import that fails due to full storage falls through to a generic/uncaught error path instead of D-03's inline "insufficient storage" message.
**Why it happens:** IndexedDB's spec allows implementation variance in exactly which DOMException is thrown for a quota failure; Safari and Dexie's abstraction layer don't perfectly normalize this.
**How to avoid:** Catch both `QuotaExceededError` and `AbortError` explicitly in the import write path and treat both as the same "insufficient storage" user-facing case (D-03). See Code Examples Pattern 3.
**Warning signs:** Import fails on a nearly-full device with an unhandled promise rejection in the console rather than the intended inline error UI.

### Pitfall 5: Storing the Blob nested inside a large parent object, or duplicating it across tables
**What goes wrong:** A schema that stores metadata and Blob in *separate* tables joined by ID (mirroring a relational instinct) forces two round-trips and two writes per import, doubling the surface area for the transaction-abort pitfall above, for no benefit given this project's simple one-record-per-book access pattern.
**Why it happens:** Relational-database habits (normalize everything) don't map well to Dexie/IndexedDB's document-per-record model; PITFALLS.md's own advice ("keep audio blob and lightweight metadata as separate records/stores") was written with a different risk in mind (avoiding blob-touching reads on the list view) — but `useLiveQuery(() => db.books.toArray())` on a single table already avoids reading blob bytes unnecessarily *if the query only projects needed fields*, so a single co-located table is simpler and still safe as long as list rendering doesn't pull the Blob into memory for display.
**How to avoid:** Single `books` table (Pattern 1 above) is sufficient for this phase's scale (a personal library, not thousands of records); if list-rendering performance ever becomes a measured problem, split at that point rather than pre-optimizing now — consistent with STACK.md's own "don't reach for OPFS until you hit a measured problem" philosophy.
**Warning signs:** N/A for Phase 2's expected scale — flagged here only so the planner doesn't over-engineer a two-table split prematurely.

## Code Examples

### Title cleanup (D-04/D-05 — fully locked, pure function)
```typescript
// lib/title.ts
// Source: locked algorithm per CONTEXT.md D-04 — not externally researched,
// documented here for completeness/consistency with other Code Examples.
export function cleanTitle(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  const spaced = withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced.replace(/\w\S*/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );
}
// cleanTitle('the_great_gatsby-01.mp3') === 'The Great Gatsby 01'  (matches D-04's example verbatim)
```

### Reading audio duration client-side (LIBR-04 / D-06)
```typescript
// lib/duration.ts
// Source: pattern synthesized from multiple independent WebSearch results describing
// the standard hidden-<audio>-element + loadedmetadata technique [CITED: multiple
// community sources cross-checked, e.g. ourcodeworld.com, ietf/MDN HTMLMediaElement
// duration semantics — MDN's HTMLMediaElement.duration is the authoritative API surface]
export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    audio.preload = 'metadata';
    audio.src = url;
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url); // avoid leaking the object URL (STACK.md/PITFALLS.md pattern)
      resolve(audio.duration);
    });
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read audio metadata'));
    });
  });
}
```
Note: this uses the exact same native decode path (`<audio src="blob:...">`) that Phase 3's playback engine will use, per STACK.md's core-technology recommendation — no format-specific handling needed for mp3/m4a/m4b since all three are natively decodable by Safari's `<audio>` element [ASSUMED — Safari's native audio-format support for mp3/AAC-in-M4A/M4B is well-established platform capability, not independently re-verified against a live Safari build this session; STACK.md's Sources section already treats HTML5 `<audio>` as the settled playback engine for this exact format set].

### Import + storage write (IMPT-01, IMPT-02)
```typescript
// lib/import.ts
// Source: synthesizes Pattern 1 (schema) + Pattern 3 (defensive write) above
const ACCEPTED_EXTENSIONS = ['.mp3', '.m4a', '.m4b'];

export function isAcceptedAudioFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  // Deliberately extension-first per Pitfall 2 above — MIME (file.type) is not
  // trustworthy enough on iOS Safari to gate on alone.
}
```

### Delete confirmation (LIBR-05 / D-07 / D-08)
```tsx
// components/library-row.tsx (excerpt)
// Source: shadcn/ui alert-dialog usage pattern [CITED: ui.shadcn.com/docs/components/alert-dialog
// content surfaced via WebSearch snippet — direct WebFetch to ui.shadcn.com was blocked by this
// session's network egress policy; component API shape cross-checked against multiple independent
// community write-ups referencing the same official structure]
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

function DeleteConfirm({ title, onConfirm }: { title: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {/* revealed by swipe gesture per D-07 — trigger is the revealed delete action, not a visible icon */}
        <button className="text-[#DC2626]">Delete</button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete book</AlertDialogTitle>
          {/* Copy locked verbatim per D-08 */}
          <AlertDialogDescription>
            {`Delete book: Remove '${title}' and free its storage? This can't be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-[#DC2626]">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `class-variance-authority` version pattern (`^0.7.x`) — not independently version-queried this session | Standard Stack | Low — it's a transitive shadcn dependency, installed automatically; if the actual current version differs, `shadcn add` will pull the correct one regardless of what's stated here. |
| A2 | Safari's native `<audio>` element reliably decodes mp3, AAC-in-M4A, and M4B containers well enough for `loadedmetadata`/`duration` to populate correctly for all three, without device verification this session | Code Examples — "Reading audio duration" | If any format fails to populate `duration` reliably on-device, LIBR-04's time-remaining display would need a fallback (e.g., show percent-only, or "duration unknown"); this should be an explicit real-device verification step per this project's own PITFALLS.md "Looks Done But Isn't" checklist philosophy. |
| A3 | shadcn `alert-dialog`/`progress` component internal API surface (prop names: `AlertDialogTrigger`, `AlertDialogAction`, etc.) — sourced from WebSearch snippets of `ui.shadcn.com`, not a direct fetch (blocked by this session's egress policy) | Code Examples — "Delete confirmation" | Low-medium — if the actual current shadcn component API has renamed exports or changed the default styling classes, the code example needs adjustment at implementation time; running `npx shadcn add alert-dialog` will pull the authoritative current source directly into the repo regardless, so this is a documentation-accuracy risk, not a functional blocker. |
| A4 | `@radix-ui/react-alert-dialog` and `@radix-ui/react-progress` "too-new" legitimacy flags are tooling false positives (reflecting latest-version publish date, not package age) | Package Legitimacy Audit | Low — cross-checked via WebSearch showing ~10.9M weekly downloads for the alert-dialog primitive; if this reasoning is wrong, the planner should still gate behind a `checkpoint:human-verify` as the protocol's default SUS handling requires. |

**If this table is empty:** N/A — table populated above.

## Open Questions

1. **Does iOS Safari's native `<audio>` element populate `duration` correctly and promptly for all three target formats (mp3, m4a, m4b) via the `loadedmetadata` event, or does any format need a workaround (e.g., `durationchange` event, or a brief seek-to-end trick for streams with unknown duration)?**
   - What we know: The general `<audio>` + `loadedmetadata` pattern is well-documented and standard across browsers; STACK.md already commits to `<audio>` as this project's playback engine, implying the platform's decode support for these formats is assumed sound.
   - What's unclear: No direct device test was run this session (consistent with this project's standing PITFALLS.md caveat that simulator/desktop testing is insufficient for this domain generally).
   - Recommendation: Treat as a real-device verification item in the phase's acceptance criteria — import a representative mp3, m4a, and m4b file on a physical iPhone and confirm the time-remaining display renders a sane, non-zero duration for each, before considering LIBR-04 done.

2. **Should the library list query (`useLiveQuery`) project only lightweight fields, or is reading full `Book` records (including the `blob` field) via `toArray()` acceptable at this project's expected scale?**
   - What we know: PITFALLS.md's Performance Traps section warns against reading blob bytes just to render a list; Dexie's `toArray()` on the single-table schema in Pattern 1 will include the `blob` field in every returned object even though the list UI doesn't need it.
   - What's unclear: Whether this actually causes a measurable performance issue at "a personal library" scale (likely single-digit to low-double-digit books), versus being a premature optimization.
   - Recommendation: Ship the simple `toArray()` version for Phase 2 (per the "don't reach for complexity until measured" philosophy already established in STACK.md); if list-render jank is observed with a handful of large books, switch to `db.books.orderBy('importedAt').toArray()` combined with `Table.each()`/explicit projection, or split into two tables at that point — not before.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js/pnpm toolchain | Building/running the Next.js app | ✓ [VERIFIED: package.json `packageManager: "pnpm@10.33.0"`, existing lockfile present] | pnpm 10.33.0 | — |
| npm registry access | Verifying/installing `dexie`, `dexie-react-hooks`, shadcn components | ✓ [VERIFIED: `npm view dexie version` succeeded this session] | — | — |
| Physical iPhone | Device verification of file picker, duration reading, IndexedDB writes (per PITFALLS.md's standing "simulator is insufficient" guidance) | Not verifiable from this research session | — | None — this is an accepted, explicit acceptance-criteria requirement carried from PITFALLS.md/STATE.md, not a blocker to planning. |

**Missing dependencies with no fallback:** None that block planning or implementation — the physical-iPhone verification requirement is a phase acceptance-criteria item, not a build-time dependency.

**Missing dependencies with fallback:** None applicable this phase.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Single-user, no-backend, no-account app (PROJECT.md constraint) — no authentication surface exists. |
| V3 Session Management | No | Same reasoning — no sessions, no server. |
| V4 Access Control | No | No multi-user/role concept; the only "access control" is OS-level (the device itself). |
| V5 Input Validation | Yes | File-type/extension validation before any write to IndexedDB (Pitfall 1/2 above) — reject non-audio files rather than attempting to process them; validate file size against `navigator.storage.estimate()` before attempting a write where feasible, to fail gracefully rather than mid-write. |
| V6 Cryptography | No | No secrets, tokens, or credentials exist anywhere in this app's data model. |
| V8 Data Protection (partial) | Yes, narrowly | IndexedDB data is unencrypted at rest by the browser (standard behavior, not a gap this app can close) — this is an accepted risk consistent with PROJECT.md's "personal device only" threat model; no action needed beyond documenting it. |
| V12 Files and Resources | Yes | Treat every picked `File` object as untrusted input: validate extension before use, never `eval`/execute file contents, never construct a filesystem path from user-controlled filename text (Dexie/IndexedDB storage sidesteps this entirely since there's no server-side filesystem involved). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/non-audio file passed through import pipeline, causing the hidden `<audio>` element or later Phase 3 playback to error unpredictably | Tampering (of expected data shape) | Extension-based validation before any storage write (Pitfall 1/2); reject with D-03's inline error rather than attempting best-effort processing of an unrecognized file. |
| Supply-chain risk from a compromised npm dependency exfiltrating/corrupting IndexedDB library data | Tampering / Information Disclosure | Already documented at project level in PITFALLS.md's Security Mistakes table — keep the dependency surface minimal (this phase adds exactly `dexie`, `dexie-react-hooks`, and two shadcn component files, all legitimacy-audited above); no third-party CDN scripts. |
| Storage exhaustion (many/large imports) causing `QuotaExceededError`/`AbortError` to surface as an unhandled rejection, potentially leaving a partially-written record | Denial of Service (of the app's own storage) | Explicit try/catch around every `db.books.add()` call (Pattern 3, Pitfall 4); Dexie's `add()` is atomic per-record, so a caught quota error should not leave a half-written `Book` object — confirm this holds during implementation testing. |

## Sources

### Primary (HIGH confidence)
- None this session — network egress restrictions in this sandbox blocked direct fetches to `dexie.org` and `ui.shadcn.com`; no Context7/MCP documentation tools were available in this environment (fell back to WebSearch per the tool-selection fallback rule).

### Secondary (MEDIUM confidence)
- npm registry direct queries (`npm view dexie version`, `npm view dexie-react-hooks version`, `npm view @radix-ui/react-alert-dialog version`, `npm view @radix-ui/react-progress version`, plus `scripts.postinstall` and `repository.url` checks) — live, verified this session.
- [Dexie.js — Design/Tutorial docs](https://dexie.org/docs/Tutorial/Design) — schema/indexing/versioning guidance, surfaced via WebSearch snippet (direct fetch blocked).
- [Dexie.js — useLiveQuery() docs](https://dexie.org/docs/dexie-react-hooks/useLiveQuery()) — reactive query pattern, via WebSearch snippet.
- [Dexie.js — Table.bulkPut() docs](https://dexie.org/docs/Table/Table.bulkPut()) — error-handling semantics, via WebSearch snippet.
- [shadcn/ui — alert-dialog docs](https://ui.shadcn.com/docs/components/alert-dialog) — component structure/install command, via WebSearch snippet (direct fetch blocked).
- [MDN — Storage_API/Storage_quotas_and_eviction_criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — QuotaExceededError semantics, already cited at project level in PITFALLS.md.
- This project's own `.planning/research/STACK.md` and `.planning/research/PITFALLS.md` — treated as authoritative prior research per CONTEXT.md's canonical_refs, not re-derived from scratch.

### Tertiary (LOW confidence)
- [github.com/advplyr/audiobookshelf issue #3310](https://github.com/advplyr/audiobookshelf/issues/3310) — iOS Safari MIME/extension quirk for `.m4b` files, single community report (though directly relevant field experience for this exact file format).
- [github.com/dfahlander/Dexie.js issue #776](https://github.com/dfahlander/Dexie.js/issues/776) — "Dexie throws AbortError instead of QuotaExceededError" — single GitHub issue, not independently reproduced this session.
- npmtrends.com/socket.dev weekly-download figures for `dexie` and `@radix-ui/react-alert-dialog` — third-party aggregator snapshots, used only to cross-check the legitimacy tool's inconclusive `unknown-downloads` verdicts, not as a primary technical source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Dexie/dexie-react-hooks/Radix versions directly verified against the live npm registry this session, not training-data guesses.
- Architecture: MEDIUM — Dexie schema/transaction patterns cross-checked across multiple independent WebSearch sources and consistent with this project's own prior PITFALLS.md research, but no direct official-docs fetch was possible (network egress blocked).
- Pitfalls: MEDIUM — iOS-Safari-specific claims (file picker MIME behavior, transaction abort timing) are WebSearch-sourced and consistent with this project's own standing PITFALLS.md caveat that real-device testing is the only ground truth; not independently device-verified in this research session.

**Research date:** 2026-08-08
**Valid until:** 2026-09-07 (30 days — npm package versions and iOS Safari behavior can drift; re-verify `dexie`/`dexie-react-hooks`/shadcn versions at planning/implementation time if this research is consumed later than that window)

---
*Phase: 2-Import & Library*
*Researched: 2026-08-08*
