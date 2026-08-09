# Phase 2: Import & Library - Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 11
**Analogs found:** 11 / 11 (all analogs are from this repo's own Phase 1 code, or RESEARCH.md drafts cross-checked against Phase 1 conventions; two files — `lib/db.ts`, `components/ui/*` — have no true in-repo analog since this is the first phase adding a storage layer and shadcn components)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `lib/db.ts` | model/config | CRUD | none in-repo (first Dexie usage) — `app/sw.ts` for "single chokepoint module with locked comment-driven boundary" convention | role-match (structural convention only) |
| `lib/utils.ts` | utility | transform | none in-repo yet — required by `components.json`'s `utils` alias; standard shadcn `cn()` helper | no analog (scaffold-required file) |
| `lib/title.ts` | utility | transform | none in-repo — pure function, no analog needed | no analog (fully locked by CONTEXT D-04/D-05) |
| `lib/duration.ts` | utility | transform | none in-repo — browser API wrapper | no analog |
| `lib/import.ts` | service | CRUD + file-I/O | none in-repo — first async write pipeline | no analog (use RESEARCH.md Pattern 3 verbatim, adapted to repo conventions) |
| `app/page.tsx` (rewrite) | component (page) | request-response + CRUD (reactive read) | `app/page.tsx` (Phase 1 version, this same file) | exact (direct evolution of existing file) |
| `components/import-trigger.tsx` | component | event-driven | `app/page.tsx`'s empty-state block (Phase 1) for tap-target/copy conventions | role-match |
| `components/library-row.tsx` | component | CRUD (delete) + display | `app/page.tsx`'s empty-state block for token usage; RESEARCH.md's `library-row.tsx` excerpt for alert-dialog wiring | role-match |
| `components/import-placeholder-row.tsx` | component | streaming (transient UI state) | `components/library-row.tsx` (sibling, same phase) for row container shape | role-match |
| `components/import-error-banner.tsx` | component | event-driven | `app/layout.tsx` for token/style conventions (no closer analog exists) | partial-match |
| `components/ui/alert-dialog.tsx`, `components/ui/progress.tsx` | component (generated) | display | shadcn CLI output (`npx shadcn add`) — not hand-written, no in-repo analog | no analog (CLI-generated, config already correct in `components.json`) |

## Pattern Assignments

### `lib/db.ts` (model/config, CRUD)

**Analog:** No direct in-repo analog (first real persistence layer). Structural convention borrowed from `app/sw.ts` (`/workspace/my-audiobooks/app/sw.ts`) — a single, heavily-commented chokepoint module that explicitly documents storage-boundary rules in a header comment, and from RESEARCH.md's Pattern 1 (already drafted for this exact file).

**Repo convention to copy** (`app/sw.ts` lines 1-14): every storage-boundary file in this repo opens with a comment block explaining *why* this module is the single point of contact for its storage tier, and cross-references PITFALLS.md/SKELETON.md by name:
```typescript
// The app-shell precache manifest is injected here at build time by
// @serwist/next (see next.config.ts, swSrc -> swDest). Cache Storage on
// this worker holds static app-shell assets ONLY (JS/CSS/HTML/manifest/
// icons) — never route audio bytes or any user data through this file.
// See PITFALLS.md Pitfall 6 and SKELETON.md Architectural Constraint 2.
```
Apply the same commenting convention to `lib/db.ts`: state that this is the single Dexie chokepoint, that `blob` is deliberately unindexed, and cross-reference PITFALLS.md Pitfall 5.

**Core schema pattern** (from RESEARCH.md Code Examples, Pattern 1 — use verbatim, this is already locked and researched):
```typescript
import Dexie, { type EntityTable } from 'dexie';

export interface Book {
  id?: number;
  blob: Blob;
  title: string;
  filename: string;
  importedAt: number;
  fileSize: number;
  duration: number;
  position: number;
}

const db = new Dexie('MyAudiobooksDB') as Dexie & {
  books: EntityTable<Book, 'id'>;
};

db.version(1).stores({
  books: '++id, title, importedAt',
});

export { db };
```

**Import alias convention:** `components.json` aliases (`/workspace/my-audiobooks/components.json` lines 13-19) confirm `@/lib/*` is the resolved import path — use `import { db } from '@/lib/db'` everywhere, matching the alias already configured for this repo.

---

### `lib/utils.ts` (utility, transform)

**Analog:** None in-repo — this file does not exist yet despite `components.json` declaring the `utils` alias (`"utils": "@/lib/utils"`, line 15). It will be auto-created by `npx shadcn add alert-dialog` (shadcn CLI generates this file if missing) with the standard `cn()` helper:
```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```
No manual pattern-matching needed — let the shadcn CLI generate it; do not hand-write it first or the CLI may skip/conflict.

---

### `lib/title.ts` (utility, transform)

**Analog:** None — pure function, fully locked by CONTEXT.md D-04/D-05. Use RESEARCH.md's Code Examples verbatim:
```typescript
export function cleanTitle(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  const spaced = withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced.replace(/\w\S*/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );
}
```
No changes needed against repo conventions — this file has no JSX/React dependency, so Phase 1 has no equivalent to diff against. Match Phase 1's comment style (concise, decision-ID-referencing) when annotating: reference D-04.

---

### `lib/duration.ts` (utility, transform)

**Analog:** None — browser API wrapper. Use RESEARCH.md's Code Examples verbatim (hidden `<audio>` + `loadedmetadata`):
```typescript
export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    audio.preload = 'metadata';
    audio.src = url;
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    });
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read audio metadata'));
    });
  });
}
```
Per UI-SPEC.md's "Duration-read-failure resolution" section, this rejection path is what triggers the `import-error-banner`'s "corrupted or unsupported" copy variant — the caller (`lib/import.ts`) must NOT write a partial book record on this rejection.

---

### `lib/import.ts` (service, CRUD + file-I/O)

**Analog:** None in-repo (first async write pipeline) — use RESEARCH.md's Pattern 3 (Code Examples, "Import + storage write") as the base, combined with the extension validator:
```typescript
const ACCEPTED_EXTENSIONS = ['.mp3', '.m4a', '.m4b'];

export function isAcceptedAudioFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

async function importFile(file: File): Promise<Book> {
  const duration = await readAudioDuration(file);
  const title = cleanTitle(file.name);
  try {
    const id = await db.books.add({
      blob: file, title, filename: file.name,
      importedAt: Date.now(), fileSize: file.size, duration, position: 0,
    });
    return { id, blob: file, title, filename: file.name, importedAt: Date.now(), fileSize: file.size, duration, position: 0 };
  } catch (err) {
    if (err instanceof Error && (err.name === 'QuotaExceededError' || err.name === 'AbortError')) {
      throw new ImportError('Not enough storage to import this file.');
    }
    throw new ImportError('Could not import this file.');
  }
}
```
**Error-message alignment:** UI-SPEC.md locks four exact copy variants keyed by failure cause (unsupported format / insufficient storage / corrupted file / generic) — `lib/import.ts` should throw a typed `ImportError` (or discriminated error) that `components/import-error-banner.tsx` can map to the exact copy table in `02-UI-SPEC.md` lines 84-87, not the generic strings shown in RESEARCH.md's draft (which predates the UI-SPEC's four-variant lock).

---

### `app/page.tsx` (component/page, request-response + reactive CRUD read)

**Analog:** This exact file, Phase 1 version (`/workspace/my-audiobooks/app/page.tsx`, 27 lines) — Phase 2 directly evolves it, not a copy-from-elsewhere situation.

**What to preserve verbatim from Phase 1** (lines 10-26): the root container classes, header structure, and — critically — the empty-state JSX tree including exact token classes:
```tsx
<div className="flex flex-col min-h-dvh">
  <header className="px-6 pt-8">
    <h1 className="text-[28px] font-semibold leading-[1.2] text-[#F5F5F5]">
      My Library
    </h1>
  </header>
  <div className="flex-1 flex flex-col items-center justify-center gap-2">
    <BookAudio size={64} className="text-[#A3A3A3]" aria-hidden="true" />
    <h2 className="text-xl font-semibold leading-[1.2] text-[#F5F5F5]">
      No audiobooks yet
    </h2>
    <p className="text-base leading-[1.5] text-[#A3A3A3]">
      Import an audiobook to start listening.
    </p>
  </div>
</div>
```
**What changes:** add `'use client'` directive (Phase 1's page.tsx has no directive since it's a static server component; Phase 2 needs `useLiveQuery`, so it becomes a client component — this is a structural change from the analog, not a token change). Wrap the `<p>` body copy in the `import-trigger.tsx` tappable element (D-01) with zero visual change. Add the header `Plus` button (populated state only) per UI-SPEC.md lines 37. Add the `useLiveQuery`-driven branch (`books === undefined` → header only; `books.length === 0` → existing empty state; else → row list) per RESEARCH.md Pattern 2.

**Import convention to preserve:** Phase 1 imports icons directly from `lucide-react` at the top (`import { BookAudio } from "lucide-react";`, line 1) — follow this exact style for `Plus`, `Trash2`, `LoaderCircle`, `X` in the new components, no aliasing/renaming.

---

### `components/import-trigger.tsx` (component, event-driven)

**Analog:** `app/page.tsx`'s empty-state block (Phase 1) for the exact token classes the tappable text must preserve; no existing trigger/button component exists in this repo to copy interaction wiring from — build the `<input type="file">` + hidden trigger pattern from RESEARCH.md's architecture diagram (lines 128-134 of `02-RESEARCH.md`) and UI-SPEC's exact accept string:
```tsx
<input type="file" accept="audio/mpeg,.mp3,audio/mp4,.m4a,.m4b" multiple />
```
**Visual-parity constraint (UI-SPEC.md line 38):** the empty-state `<button>` wrapping the body copy must have **zero visual change** vs. Phase 1's `<p>` — same classes (`text-base leading-[1.5] text-[#A3A3A3]`), just changed to a semantic `<button>` element with invisible padding for the 44×44px tap target.

---

### `components/library-row.tsx` (component, CRUD delete + display)

**Analog:** RESEARCH.md's own Code Examples "Delete confirmation" excerpt (already drafted for this exact file) — cross-check import path and styling against repo conventions:
```tsx
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
```
This import path matches `components.json`'s alias config exactly (`"ui": "@/components/ui"`) — no adjustment needed. **Color tokens must use the CSS custom properties already defined in `app/globals.css`** (`--color-accent: #e8b34a`, `--color-destructive: #dc2626`) rather than RESEARCH.md's raw hex literals (`className="bg-[#DC2626]"`) — Phase 1's own `app/page.tsx` uses raw hex arbitrary-value classes too (`text-[#F5F5F5]`), so either raw-hex-arbitrary-value or the CSS var is consistent with repo precedent; prefer raw hex to match Phase 1's exact established convention (`text-[#A3A3A3]`, `text-[#F5F5F5]` pattern) rather than introducing `var(--color-*)` Tailwind utilities for the first time.

**Row container tokens** (UI-SPEC.md lines 97-99): Secondary surface `bg-[#171717]`, `rounded-[8px]` matching Phase 1's rounding convention (no rounding class currently in Phase 1's page.tsx, so this is a new-but-token-locked value), `p-4` (16px `md`), `min-h-11` (44px).

---

### `components/import-placeholder-row.tsx` (component, streaming/transient UI state)

**Analog:** `components/library-row.tsx` (sibling, same phase — same Secondary-surface row container) for shape/dimension parity, per UI-SPEC.md line 63 ("identical...row shape/dimensions...so the row does not visually jump when it resolves"). Use `LoaderCircle` from `lucide-react` with a spin animation (Tailwind `animate-spin`), Accent color `text-[#E8B34A]`, matching Phase 1's `size={64}` prop-based icon sizing convention (`<BookAudio size={64} ... />`) but at 16px per UI-SPEC.md line 65.

---

### `components/import-error-banner.tsx` (component, event-driven)

**Analog:** No close structural analog in Phase 1 (first inline-dismissible-banner component) — token usage borrowed from `app/layout.tsx`/`app/globals.css` directly. Secondary-surface (`bg-[#171717]`) matching `library-row.tsx`'s surface, `md` (16px) padding, dismiss `X` from `lucide-react` at `text-[#A3A3A3]` (Muted-foreground, matching Phase 1's `text-[#A3A3A3]` convention for secondary text). Four copy variants are locked verbatim in `02-UI-SPEC.md` lines 84-87 — copy them exactly, do not paraphrase.

---

### `components/ui/alert-dialog.tsx`, `components/ui/progress.tsx` (generated components)

**Analog:** None — generated by `npx shadcn add alert-dialog` and `npx shadcn add progress` per `components.json`'s existing preset (`style: new-york`, `baseColor: neutral`, already configured in Phase 1, zero components added yet). Do not hand-write these; run the CLI commands and use the generated output as-is, then reference them via the `@/components/ui/*` alias in `library-row.tsx`.

---

## Shared Patterns

### Color tokens (raw hex arbitrary values, not Tailwind CSS-var utilities)
**Source:** `app/page.tsx` (Phase 1) — `text-[#F5F5F5]`, `text-[#A3A3A3]` (lines 12, 18, 21)
**Apply to:** All new components (`library-row.tsx`, `import-placeholder-row.tsx`, `import-error-banner.tsx`, `import-trigger.tsx`) — use the exact same raw-hex Tailwind arbitrary-value syntax established in Phase 1, even though `app/globals.css` also defines `--color-*` CSS custom properties. Phase 1 never actually consumes those custom properties via `var()` in JSX; it uses raw hex directly in `className`. Follow that precedent for consistency, unless the planner decides to standardize on CSS vars project-wide (out of scope for pattern-mapping, flag for planner discretion).

### Spacing tokens
**Source:** `app/page.tsx` (Phase 1) — `px-6 pt-8` (24px/32px, matching `lg`/`xl` scale), `gap-2` (8px, matching `sm`)
**Apply to:** All new layout code — Tailwind's default spacing scale (`px-6` = 24px, `gap-2` = 8px) happens to align with the locked `lg`/`sm` tokens in `02-UI-SPEC.md`; continue using Tailwind's built-in spacing utilities (not custom `spacing-md` etc. utility classes, even though `app/globals.css` defines `--spacing-*` vars) since Phase 1 never wires those into `@theme inline`'s spacing scale (only color/font/text vars are wired there, per `app/globals.css` lines 25-57) — Tailwind's default px-N/gap-N utilities remain the actual mechanism.

### Icon usage
**Source:** `app/page.tsx` line 1, 17 — `import { BookAudio } from "lucide-react";` then `<BookAudio size={64} className="text-[#A3A3A3]" aria-hidden="true" />`
**Apply to:** All new icon usage (`Plus`, `Trash2`, `LoaderCircle`, `X`) — direct import from `lucide-react`, explicit `size` prop, explicit color via `className`, `aria-hidden="true"` when decorative (omit `aria-hidden` when the icon is the sole content of an interactive control needing `aria-label`, per UI-SPEC.md's `aria-label="Import audiobook"` / `aria-label="Dismiss error"` requirements).

### Client-component boundary
**Source:** `app/layout.tsx` is a server component (no `'use client'`); `app/page.tsx` (Phase 1) is also a server component (fully static). Phase 2's `app/page.tsx` is the **first** client component in the app (needs `useLiveQuery`, file input state, swipe gesture state).
**Apply to:** `app/page.tsx` gets `'use client'` at the top; all interactive sub-components (`import-trigger.tsx`, `library-row.tsx`, `import-placeholder-row.tsx`, `import-error-banner.tsx`) also need `'use client'` since they use hooks/event handlers. `lib/db.ts`, `lib/title.ts`, `lib/duration.ts`, `lib/import.ts` are plain TS modules with no `'use client'` needed (imported into client components, not rendered as components themselves).

### Comment-header convention for storage-boundary files
**Source:** `app/sw.ts` lines 6-9 — every file establishing a storage/data boundary opens with a comment explaining the boundary rule and cross-referencing the specific PITFALLS.md pitfall number or SKELETON.md constraint by name.
**Apply to:** `lib/db.ts` (cross-ref PITFALLS.md Pitfall 5, "single Dexie chokepoint, blob deliberately unindexed"), `lib/import.ts` (cross-ref Pitfall 3/4, "no unrelated awaits between duration read and db.books.add").

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/db.ts` | model/config | CRUD | First Dexie/IndexedDB usage in this repo — no prior data-persistence module exists; RESEARCH.md's Pattern 1 is the primary source instead. |
| `lib/utils.ts` | utility | transform | Standard shadcn-CLI-generated scaffold file, not hand-authored; will be created automatically by `npx shadcn add`. |
| `components/ui/alert-dialog.tsx`, `components/ui/progress.tsx` | component | display | CLI-generated by shadcn, first components added since Phase 1 initialized (but never populated) `components.json`. |

## Metadata

**Analog search scope:** `/workspace/my-audiobooks/app/*`, `/workspace/my-audiobooks/components.json`, `/workspace/my-audiobooks/package.json` (no `lib/` or `components/` directories exist yet in this repo — confirmed via `ls`)
**Files scanned:** `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/sw.ts`, `app/icon-glyph.tsx`, `components.json`, `package.json`
**Pattern extraction date:** 2026-08-08
