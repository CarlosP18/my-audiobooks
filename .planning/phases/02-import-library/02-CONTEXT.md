# Phase 2: Import & Library - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

User can import their own audiobook files via the iOS file picker and manage a persistent, on-device library of them: import, list with cleaned-up titles and progress, and delete. No playback yet (Phase 3) — LIBR-04's "progress" is whatever position value exists (0% for a freshly imported book; Phase 3 is what actually advances it). Storage is Dexie.js/IndexedDB per project-level research, holding both the audio Blobs and library metadata.

</domain>

<decisions>
## Implementation Decisions

### Import Flow
- **D-01:** The Phase 1 empty-state body copy ("Import an audiobook to start listening.") becomes the tappable import trigger itself — no separate button or icon is added. It opens the iOS file picker directly. — **Reversibility:** reversible — pure UI, easy to add a dedicated button later if the library grows other entry points.
- **D-02:** While a picked file is being copied into internal storage, a placeholder row appears in the library list showing progress (spinner or progress bar), and resolves into the real book row once the copy completes. This applies even on an empty library (the placeholder is the first/only row).
- **D-03:** On import failure (unsupported format, insufficient storage, or any copy error), show an inline, dismissible error message near the import control. Do not block the rest of the app; no full-screen error state.

### Title Cleanup Rule (LIBR-03)
- **D-04:** Cleanup algorithm is deterministic and simple: strip the file extension, replace underscores and dashes with spaces, collapse repeated whitespace, then apply Title Case. Example: `the_great_gatsby-01.mp3` → `The Great Gatsby 01`.
- **D-05:** No special-case parsing for patterns like `Author - Title.m4b` or `01 - Chapter.mp3` (leading track numbers, author/title splitting, etc.). Basic cleanup only — avoids false positives on titles that happen to contain a dash or leading digits, and keeps the rule fully predictable. This may be revisited in a v2 metadata-parsing pass (META-01, already deferred).

### Progress Indicator (LIBR-04)
- **D-06:** Each library row shows **both** percent complete and time remaining together (e.g., "45% — 2h 15m remaining"), not just one. Requires knowing each audio file's total duration (read at import time, stored as metadata) — deferred to research/planner to confirm the reliable way to read duration client-side (e.g., via a hidden `<audio>` element's `loadedmetadata` event) since this must work across whatever formats IMPT-01 accepts.

### Delete (LIBR-05)
- **D-07:** Swipe-to-delete is the interaction pattern — swiping a library row reveals a delete action, matching native iOS list conventions. No permanently-visible delete icon per row.
- **D-08:** Confirmation copy is locked verbatim from Phase 1's UI-SPEC placeholder: **"Delete book: Remove '{title}' and free its storage? This can't be undone."** — swipe reveals the action, tapping it shows this confirmation before the delete actually runs.

### Claude's Discretion
- Exact placeholder-row visual treatment during import copy (spinner vs progress bar, exact styling) — within the dark-neutral design tokens locked in Phase 1's UI-SPEC (`app/globals.css`).
- Exact wording of the inline import-failure error message (D-03) — no specific copy was requested beyond "inline, dismissible, near the import control."
- Whether the iOS file picker allows multi-select — IMPT-01/ROADMAP success criteria are phrased around a single file at a time; if iOS's native picker defaults to allowing multiple selection, looping the same per-file copy/error flow over each selected file is an acceptable implementation choice, not a scope change.
- Exact Dexie.js schema (tables, indexes) for storing Blobs + metadata — a technical/architecture decision, not a user-facing gray area; research and planner own this.
- How book duration is read/stored to support D-06's time-remaining display — technical implementation detail for research/planner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (this project)
- `.planning/research/STACK.md` — storage recommendation: Dexie.js v4.4.x as the single IndexedDB wrapper for both audio Blobs and library metadata (one storage-layer module)
- `.planning/research/PITFALLS.md` — IndexedDB transaction hygiene and Blob storage quirks on iOS Safari; storage eviction (~7 days idle) risk; Cache Storage vs IndexedDB boundary (Phase 1's service worker must never touch this data — already enforced, see 01-PATTERNS.md)
- `.planning/research/ARCHITECTURE.md` — component boundaries: file import → storage layer (Dexie) → library list, build order confirms storage/import is this phase's job
- `.planning/research/FEATURES.md` — table-stakes vs deferred features; confirms per-book progress and cleaned title are v1 table-stakes (this phase), metadata tag parsing (META-01) is v1.x/deferred
- `.planning/research/SUMMARY.md` — synthesized roadmap implications

### Project-Level
- `.planning/PROJECT.md` — Core Value, constraints (no backend, on-device storage only), updated Current State (Phase 1 complete, live at https://my-audiobooks.vercel.app)
- `.planning/REQUIREMENTS.md` — IMPT-01, IMPT-02, LIBR-01 through LIBR-05 definitions

### Phase 1 (inherited)
- `.planning/phases/01-install-offline-app-shell/01-CONTEXT.md` — D-01 through D-07: app identity, dark-neutral theme, Next.js/Tailwind/shadcn/pnpm stack — all still binding for Phase 2's UI
- `.planning/phases/01-install-offline-app-shell/01-UI-SPEC.md` — locked design tokens (colors, typography, spacing) this phase's library/import UI must reuse; the delete-confirmation copy (D-08 above) was first drafted here as a placeholder, now confirmed
- `.planning/phases/01-install-offline-app-shell/01-PATTERNS.md` — greenfield scaffold map; Cache Storage vs IndexedDB separation pattern this phase must honor when introducing IndexedDB for the first time
- `.planning/phases/01-install-offline-app-shell/SKELETON.md` — architectural constraints inherited from Phase 1 (deployed origin binds IndexedDB, no middleware without explicit route exclusion, etc.)

</canonical_refs>

<code_context>
## Existing Code Insights

Repo has a working Next.js App Router shell from Phase 1 (`app/layout.tsx`, `app/page.tsx`, `app/globals.css`) with locked design tokens (dark-neutral palette, 4 typography roles, 7-step spacing scale) and shadcn/ui initialized (style: new-york, baseColor: neutral, zero components added yet). `app/page.tsx` currently renders the permanent empty state this phase must replace with a real, data-driven library list.

### Reusable Assets
- Design tokens in `app/globals.css` — colors, typography, spacing all locked, reuse directly for library rows and import UI.
- `components.json` (shadcn registry, already configured) — Phase 2 is the first phase to actually add shadcn components (e.g., Button for delete-confirmation dialog, if needed).

### Established Patterns
- Cache Storage (Serwist service worker) is strictly app-shell-only — this phase introduces the FIRST real data storage (IndexedDB via Dexie) and must not let it collide with or be confused for the service worker's cache.

### Integration Points
- `app/page.tsx` becomes the data-driven library screen (currently static empty state).
- New: a storage module (likely `lib/db.ts` per STATE.md's carried-forward research decision) that Phase 3's player will also depend on for position tracking.

</code_context>

<specifics>
## Specific Ideas

- Delete confirmation copy locked verbatim (D-08): "Delete book: Remove '{title}' and free its storage? This can't be undone."
- Title cleanup example given during discussion: `the_great_gatsby-01.mp3` → `The Great Gatsby 01` (D-04).
- Progress display example: "45% — 2h 15m remaining" (D-06).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Filename pattern-specific parsing — author/title splitting, track-number stripping — was explicitly discussed and declined for v1 per D-05, not deferred as a future idea; metadata-based title/author parsing already exists as META-01 in REQUIREMENTS.md v2.)

</deferred>

---

*Phase: 2-Import & Library*
*Context gathered: 2026-08-08*
