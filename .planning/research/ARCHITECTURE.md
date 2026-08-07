# Architecture Research

**Domain:** Client-only Next.js PWA for local audio storage/playback (personal audiobook player)
**Researched:** 2026-08-07
**Confidence:** HIGH

## Standard Architecture

This is a well-established pattern class: "offline-first PWA with IndexedDB as the database." There is no backend, so the usual client/server split collapses — IndexedDB plays the role a database+API would normally play, and React state plays the role a client-side cache would normally play. The architecture is fully client-side; Next.js here is essentially a static-shell/bundler+router, not a data-fetching framework.

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PWA Shell (Next.js)                          │
│  manifest.json/app/manifest.ts, service worker (Serwist), app icons  │
├─────────────────────────────────────────────────────────────────────┤
│                              UI Layer                                │
│  ┌────────────┐   ┌────────────┐   ┌──────────────┐                 │
│  │ Import flow│   │  Library   │   │ Player screen │                │
│  │ (file      │   │  list view │   │ (audio elem,  │                 │
│  │  picker)   │   │            │   │  controls)    │                 │
│  └─────┬──────┘   └─────┬──────┘   └──────┬────────┘                 │
│        │                │                  │                        │
├────────┴────────────────┴──────────────────┴─────────────────────────┤
│                    Storage Access Layer (single module)              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  db.ts — wraps idb: addBook(), listBooks(), getBook(),         │  │
│  │  getBlob(), updatePosition(), deleteBook()                     │  │
│  └───────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                         IndexedDB (browser)                          │
│  ┌──────────────┐  ┌──────────────────┐                             │
│  │ books store  │  │ (blob stored      │                             │
│  │ (metadata +  │  │  inline as a      │                             │
│  │  position)   │  │  field on record) │                             │
│  └──────────────┘  └──────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| PWA shell | Installability, offline app-shell caching, icons | `app/manifest.ts` (Next.js metadata route) + Serwist-generated service worker; iOS reads `apple-touch-icon`, not manifest icons |
| Import flow | Get a `File` from the user, extract basic metadata, hand off to storage layer | `<input type="file" accept="audio/*">` (native iOS picker), reads `File` object directly (a `File` *is* a `Blob`) |
| Storage access layer (`db.ts`) | Single chokepoint for all IndexedDB reads/writes; owns schema, versioning, migrations | Thin wrapper around `idb` (Jake Archibald's library) exposing typed async functions |
| IndexedDB | Durable source of truth for both binary audio and metadata/position | One object store (`books`) holding `{id, title, blob, duration, addedAt, position, lastPlayedAt}` |
| Library list | Subscribes to storage layer, renders books, triggers delete/select | React component; fetches list on mount + after mutations (no live subscription needed at this scale) |
| Player screen | Owns the `<audio>` element, playback UI state (playing/paused, currentTime), persists position | React component; creates object URL from blob on mount, debounced writes back to storage layer |

## Recommended Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── manifest.ts             # PWA manifest (metadata route)
│   ├── sw.ts                   # Serwist service worker entry
│   ├── layout.tsx              # Root layout, apple-touch-icon links, viewport meta
│   ├── page.tsx                # Library view (home route)
│   └── player/[id]/page.tsx    # Player screen for one book
├── lib/
│   ├── db.ts                   # IndexedDB access layer (idb wrapper) — the only file that imports `idb`
│   ├── db.schema.ts            # Types: Book, PlaybackPosition; DB_VERSION + upgrade callback
│   └── audio.ts                # Helpers: createObjectURL lifecycle, duration probing
├── components/
│   ├── ImportButton.tsx        # File picker trigger + import pipeline
│   ├── BookCard.tsx            # Single library item (thumbnail, title, progress bar, delete)
│   ├── LibraryList.tsx         # Maps books → BookCard, empty state
│   └── PlayerControls.tsx      # Play/pause, seek, scrubber
├── hooks/
│   ├── useBooks.ts             # Loads/refreshes book list from db.ts
│   └── usePlaybackPersistence.ts  # Debounced currentTime → db.ts writes
public/
├── icons/                      # apple-touch-icon.png, 192/512 PNGs for manifest
```

### Structure Rationale

- **`lib/db.ts` as a single chokepoint:** every other component (import, library, player) reads/writes through this one module. No component ever calls `indexedDB.open()` or `idb` functions directly. This is the load-bearing boundary in this architecture — it's what lets you swap storage strategy later (e.g., add OPFS for audio blobs) without touching UI code.
- **`components/` vs `hooks/`:** presentational/interaction components stay dumb; data lifecycle (loading, debounced persistence) lives in hooks so the player UI can be built and restyled without re-touching persistence logic.
- **One route per book (`/player/[id]`)** rather than a single-page player modal: gives you real browser back-navigation, a natural place to fetch-by-id, and works cleanly with `history.pushState`-based PWA navigation on iOS.
- **`app/manifest.ts` + `app/sw.ts` (Serwist), not `next-pwa`:** `next-pwa` is effectively unmaintained and requires the webpack build path; Serwist is the actively maintained successor, is built for the App Router, and works with Turbopack. Use it for the installability layer.

## Architectural Patterns

### Pattern 1: Storage layer as the source of truth, React state as a cache

**What:** IndexedDB holds the durable truth (book list, blobs, playback position). React component state (`useState`/`useReducer`) holds only the *in-memory working copy* needed to render — e.g., `currentTime` ticking every animation frame, `isPlaying`. There is no server, so there's no need for a client cache library (React Query, SWR) with revalidation semantics — just load-on-mount and write-through-on-change.
**When to use:** Any client-only app where the browser storage IS the backend.
**Trade-offs:** Simpler than a full state-management library, but you must be disciplined about *never* letting a component treat its local state as authoritative for anything that must survive a reload (position, library contents) — always write it back to `db.ts` on the relevant lifecycle events (unmount, pagehide, debounced interval).

**Example:**
```typescript
// hooks/usePlaybackPersistence.ts
export function usePlaybackPersistence(bookId: string, audioRef: RefObject<HTMLAudioElement>) {
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let lastSaved = 0;
    const THROTTLE_MS = 5000; // write at most every 5s during playback

    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSaved >= THROTTLE_MS) {
        lastSaved = now;
        db.updatePosition(bookId, audio.currentTime); // fire-and-forget
      }
    };

    // Always flush on pause / seek-end / tab hide / unmount — these are
    // low-frequency, high-value moments, unlike `timeupdate` which fires ~4x/sec.
    const flush = () => db.updatePosition(bookId, audio.currentTime);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('pause', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });

    return () => {
      flush(); // save on unmount/navigation away
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('pause', flush);
    };
  }, [bookId, audioRef]);
}
```

### Pattern 2: Single object store with Blob stored inline as a field

**What:** Store each audiobook as one IndexedDB record: `{id, title, blob, mimeType, sizeBytes, durationSec, position, addedAt, lastPlayedAt}`. IndexedDB natively supports storing `Blob`/`File` objects as a field value (structured clone algorithm handles it) — no need for a separate blob store or manual chunking for files in the hundreds-of-MB range typical of audiobooks.
**When to use:** Files well under ~1-2GB (typical audiobook files: tens to low-hundreds of MB). This project's files fit comfortably.
**Trade-offs:** Simpler schema, one transaction covers metadata+blob together (atomic). The only reason to split into two stores (metadata store + blob store) is if you frequently need to list/query metadata without touching blobs — worth doing here anyway, see Anti-Pattern 1 below, because reading a `Book` for the library list should not have to deserialize its Blob.

### Pattern 3: Debounce/throttle writes, not every `timeupdate` tick

**What:** The `timeupdate` event fires ~4 times/second during playback. Writing to IndexedDB on every tick is wasteful and can cause jank (structured-clone + transaction overhead). Instead: throttle writes to every 3-5 seconds during active playback, AND always flush immediately on `pause`, `seeking`→`seeked` completion, `visibilitychange` (tab/app backgrounded), and component unmount/navigation.
**When to use:** Any persisted "resume position" feature.
**Trade-offs:** A throttle-plus-flush-on-important-events strategy means worst-case position drift is bounded by the throttle interval (e.g., up to 5s of playback lost if the app is killed mid-interval without a pagehide event firing) — acceptable for a personal audiobook app. If perfect accuracy mattered, you'd flush on every `pause`/backgrounding event only (no periodic write) since those cover the realistic "user stopped listening" cases; the periodic write is really insurance against an unclean kill.

## Data Flow

### Import Flow

```
User taps "Add Book" → <input type="file" accept="audio/*"> (iOS file picker)
    ↓ (user picks file)
onChange handler receives FileList → File object (File extends Blob)
    ↓
Read basic metadata: File.name, File.type, File.size
    (optionally: create <audio> element with the blob URL briefly to read .duration)
    ↓
db.addBook({ id: crypto.randomUUID(), title, blob: file, mimeType, sizeBytes, durationSec, position: 0, addedAt: Date.now() })
    ↓ (single IndexedDB transaction, put into `books` store)
Library list refetches/refreshes → new BookCard appears
```

### Playback Position Flow

```
Library list → user taps a book → navigate to /player/[id]
    ↓
Player screen mounts → db.getBook(id) → { blob, position, ... }
    ↓
audioUrl = URL.createObjectURL(blob)   // done once per mount
    ↓
<audio src={audioUrl}> → on `loadedmetadata`: audio.currentTime = book.position  (RESTORE)
    ↓
User plays → `timeupdate` fires repeatedly
    ↓ (throttled to every 3-5s, plus flush on pause/hide/unmount — see Pattern 3)
db.updatePosition(id, audio.currentTime)   // single-field IndexedDB update, not full record rewrite
    ↓
On unmount: URL.revokeObjectURL(audioUrl)  // free memory; do this in a cleanup effect
```

### Key Data Flows

1. **Import → Storage:** One-directional, one-shot. `File` object flows straight from the picker into IndexedDB via `db.addBook()`. No intermediate global state needed — the library list simply re-reads from IndexedDB after the write resolves.
2. **Storage → Library list:** Read-only, on-mount + after-mutation refresh (add/delete). No need for reactive/live queries at this scale (a personal library of tens of books) — a manual `refetch()` after any mutating `db.*` call is simpler than wiring up `liveQuery`-style subscriptions.
3. **Storage ↔ Player:** Bidirectional but asymmetric — read once on mount (get blob + last position), write repeatedly but throttled (position updates) via the debounce/flush pattern above.

## Scaling Considerations

Scaling in the traditional sense (concurrent users, request volume) does not apply — this is a single-user, single-device app. The relevant "scale" axes are library size and file size.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Personal library, <50 books, files <300MB each | Current design as-is: single `books` store, load full list on mount, no pagination needed |
| Library grows past a few hundred books | Split into two stores (`booksMeta`, `bookBlobs`) so listing doesn't touch blob data; add an index on `addedAt` for sort |
| Individual files approach ~1GB+ (e.g., very long unabridged audiobooks) | Verify iOS Safari's practical IndexedDB write limit for a single Blob field on-device (varies with free disk space); consider Origin Private File System (OPFS) as an alternative blob store if IndexedDB struggles with very large single writes — but only if problems are actually observed |

### Scaling Priorities

1. **First real risk: iOS storage eviction, not performance.** iOS aggressively evicts an origin's IndexedDB + Cache Storage together if the PWA/site goes unused for about 7 days, *unless* persistent storage was granted. **Call `navigator.storage.persist()` early** (ideally right after first successful import) — Safari generally grants it for installed (home-screen) PWAs. This is a correctness issue, not a performance one, and belongs in an early phase, not "later."
2. **Second: write-cost of large single-record updates.** Because metadata (including `position`) lives on the same record as the audio `blob` in the simple single-store design, a naive `db.updatePosition()` that reads-modifies-writes the *entire record* (blob included) on every save is expensive. **Split into `booksMeta` and `bookBlobs` stores from day one** if straightforward, or ensure `updatePosition` uses a targeted approach (still an `idb` full-record put under the hood, but confirm the blob field isn't needlessly re-cloned) — this is worth deciding during the storage-layer build phase rather than retrofitting.

## Anti-Patterns

### Anti-Pattern 1: Storing playback position and the audio Blob in the same store when the position updates frequently

**What people do:** Put everything (title, blob, position) in one record and call `store.put(fullRecord)` every time the position changes.
**Why it's wrong:** Every position write forces IndexedDB to re-clone/re-write the full record, including the large binary blob, via structured clone — this is the single biggest source of jank/battery drain in a naive implementation, and directly collides with the debounce strategy above (defeats the purpose of throttling if each throttled write is still moving hundreds of MB).
**Instead:** Split into two object stores: `booksMeta` (small, frequently updated: title, position, addedAt, durationSec) and `bookBlobs` (large, write-once: id → blob). Position updates only touch `booksMeta`. This single decision has outsized impact on perceived performance and should be made in the storage-layer phase, before UI is built on top of it.

### Anti-Pattern 2: Recreating `URL.createObjectURL()` on every render or leaking them

**What people do:** Call `URL.createObjectURL(blob)` inside the render body or an effect with the wrong dependency array, generating a new blob URL (and leaking the old one, which holds memory until `revokeObjectURL` or page unload) every re-render.
**Why it's wrong:** Each unrevoked object URL keeps the underlying blob's memory alive. On a memory-constrained mobile Safari tab, repeatedly leaking large audio blob URLs will eventually crash or reload the tab (losing playback state).
**Instead:** Create the object URL exactly once per book-load in an effect keyed on the book id, and call `URL.revokeObjectURL()` in that effect's cleanup function.

### Anti-Pattern 3: Treating this as a "real" full-stack app and reaching for server-state libraries

**What people do:** Pull in React Query/SWR/Redux "because that's what data-fetching apps use," or add API routes in Next.js that just proxy to... nothing (there's no server data).
**Why it's wrong:** Adds indirection and bundle size for zero benefit — there is no network latency to hide, no cache invalidation across clients (single device, single tab most of the time), and no server round-trip to dedupe.
**Instead:** Plain `useState`/`useEffect` + a thin `lib/db.ts` module is sufficient. If IndexedDB read/write ergonomics get annoying, reach for `idb` (a thin Promise wrapper around the native API), not a data-fetching framework.

### Anti-Pattern 4: Building the player UI before the storage layer is solid

**What people do (relevant to build order):** Start with a pretty player screen using a hardcoded/local file, then bolt on IndexedDB persistence at the end.
**Why it's wrong:** Resume-position-on-reload is the app's stated Core Value. If storage plumbing (schema, `idb` wrapper, debounce/flush persistence, `navigator.storage.persist()`) isn't validated first, you risk discovering iOS-specific storage quirks (eviction, quota, Blob support edge cases) after UI work is already built on shaky assumptions.
**Instead:** See suggested build order below — storage plumbing and installability are Phase 1, before any UI polish.

## Integration Points

### External Services

None. This app has zero external service dependencies by design (no backend, no auth, no analytics assumed). The only "external" integration is the browser platform itself (iOS Safari's PWA/IndexedDB/MediaSession implementations).

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| iOS Safari file picker | Native `<input type="file" accept="audio/*">` | No File System Access API on iOS Safari — must use the classic file input; user re-picks via Files app/iCloud/local storage, iOS returns a `File` handle, no persistent file-system reference is kept (this is exactly why the Blob must be copied into IndexedDB, not referenced by path) |
| iOS MediaSession API (optional, later phase) | `navigator.mediaSession.setActionHandler(...)`, `metadata` | Enables lock-screen/Control-Center playback controls and title display; not required for MVP but a natural "differentiator" phase once core playback/persistence works |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Import flow ↔ Storage layer | Direct async function calls (`db.addBook(...)`) | Import flow never touches `idb` directly; only calls `lib/db.ts` exports |
| Storage layer ↔ Library list | Direct async function calls (`db.listBooksMeta()`) on mount + manual refetch after mutations | No live-query subscription needed at personal-library scale; simplest option given no concurrent writers (single tab, single user) |
| Storage layer ↔ Player screen | `db.getBook(id)` (read on mount), `db.updatePosition(id, time)` (throttled writes) | Player never mutates a full `Book` record for position updates — only touches the meta store field (see Anti-Pattern 1) |
| Library list ↔ Player screen | Next.js route param (`/player/[id]`) — no shared React state/context needed | Each screen independently reads what it needs from the storage layer via the `id` in the URL; avoids prop-drilling or a global store |
| PWA shell (service worker) ↔ everything else | Passive — caches the app shell (JS/CSS/routes) for offline load; does NOT need to intercept or cache IndexedDB reads (those work offline natively) | Keep the service worker's scope to app-shell caching only; audio blobs live in IndexedDB, not the Cache API, so there's no need for the SW to know about audiobook data at all |

## Suggested Build Order (for a solo dev shipping incrementally)

This directly maps to the "storage plumbing and installability before UI polish" principle:

1. **Phase 0 — Installability skeleton:** Next.js app, `app/manifest.ts`, Serwist service worker, icons, deployed to Vercel, confirm "Add to Home Screen" works and the app opens standalone (no Safari chrome) on an actual iPhone. This validates the riskiest platform assumption first — if installability is broken, nothing else matters.
2. **Phase 1 — Storage plumbing:** `lib/db.ts` with `idb`, schema (two stores: `booksMeta` + `bookBlobs`, per Anti-Pattern 1), `navigator.storage.persist()` call, and a throwaway test harness (even a temporary debug page) proving you can add a file, read it back, and get a working Blob after a full page reload. This is the highest-risk, highest-value phase — validate it in isolation before any real UI.
3. **Phase 2 — Import flow + Library list:** Wire the file picker to `db.addBook()`, build the library list UI reading from `db.listBooksMeta()`, add delete. Now there's a usable (if playback-less) app.
4. **Phase 3 — Player + resume position:** `<audio>` element, object URL lifecycle (Anti-Pattern 2), play/pause/seek controls, and the debounce/flush persistence pattern (Pattern 1/3) wired to `db.updatePosition()`. This delivers the Core Value.
5. **Phase 4 (optional, differentiator) — MediaSession/lock-screen controls, polish:** Only after the above is proven solid on-device. Nice-to-have, not required for the stated MVP scope.

Rationale for this order: Phases 0-1 are pure platform/storage risk with no product payoff yet — deliberately front-loaded because failure here (e.g., discovering IndexedDB Blobs behave unexpectedly on iOS, or installability doesn't work) would invalidate assumptions baked into later UI work. Phases 2-3 build the minimum vertical slice needed to satisfy every "Active" requirement in PROJECT.md. Phase 4 is explicitly deferred (matches "Out of Scope" / deferred items already noted in PROJECT.md).

## Sources

- [Best Practices for Persisting Application State with IndexedDB — web.dev](https://web.dev/articles/indexeddb-best-practices) — HIGH confidence (official Google web.dev docs); informs Anti-Pattern 1 (avoid monolithic record writes) and Pattern 2/3
- [idb library — Jake Archibald, referenced via web.dev](https://web.dev/articles/indexeddb-best-practices) — HIGH confidence; recommended Promise-based IndexedDB wrapper
- [Storage quotas and eviction criteria — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — HIGH confidence (MDN); informs `navigator.storage.persist()` recommendation and eviction-risk scaling priority
- [Updates to Storage Policy — WebKit blog](https://webkit.org/blog/14403/updates-to-storage-policy/) — HIGH confidence (official WebKit/Safari engineering blog); iOS 7-day eviction-without-interaction policy, persistent storage exemption for installed PWAs
- [PWA iOS Limitations and Safari Support — MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — MEDIUM confidence (third-party blog, but consistent with WebKit's own policy post); iOS Safari cache/IndexedDB approximate storage figures
- [next-pwa (GitHub) vs Serwist — multiple 2025 sources](https://github.com/shadowwalker/next-pwa) — MEDIUM confidence (community consensus across several independent write-ups); next-pwa is effectively unmaintained, Serwist is the maintained App Router-compatible successor
- [Aurora Scharff — Dynamically Generating PWA App Icons in Next.js 16 with Serwist](https://aurorascharff.no/posts/dynamically-generating-pwa-app-icons-nextjs-16-serwist/) — MEDIUM confidence; confirms `app/manifest.ts` + Serwist pattern for App Router
- [MDN — HTMLMediaElement `timeupdate` event / `currentTime`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event) — HIGH confidence; basis for the throttle/flush persistence pattern
- iOS file input behavior (native `<input type="file">`, no File System Access API on Safari) — HIGH confidence, general WebKit platform knowledge; confirms why files must be copied into IndexedDB rather than referenced by path

---
*Architecture research for: Client-only Next.js PWA, local audio storage/playback*
*Researched: 2026-08-07*
