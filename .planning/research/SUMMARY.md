# Project Research Summary

**Project:** my-audiobooks
**Domain:** Client-only, installable iOS PWA for local audiobook playback (no backend, no accounts, single personal user)
**Researched:** 2026-08-07
**Confidence:** MEDIUM

## Executive Summary

This is a well-understood architectural pattern — an offline-first PWA where IndexedDB plays the role of the backend database and there is no server at all — applied to a genuinely risky platform target: installed (Add to Home Screen) PWAs on iOS Safari. The core technical shape is simple (Next.js shell + Dexie-backed IndexedDB storage + native `<audio>` playback), but almost all of the real risk in this project is platform-specific iOS Safari behavior rather than application logic: manifest icons being ignored in favor of `apple-touch-icon`, storage eviction after ~7 days of inactivity with no opt-out, autoplay/gesture restrictions that break "resume where I left off" if not handled carefully, and documented unreliability of background/lock-screen audio in standalone PWAs.

The recommended approach is to build storage and installability first, before any UI polish: validate that files can be imported, persisted as Blobs, and correctly reloaded after a real page/app restart on a physical iPhone, and validate that "Add to Home Screen" produces a correctly-iconed, standalone-launching app — before investing in player UI. Use Dexie.js as the single IndexedDB wrapper, accessed only through one storage-layer module (`lib/db.ts`), with two logical concerns split apart internally: lightweight, frequently-updated metadata (title, position, duration) versus large, write-once audio Blobs — this single decision has an outsized effect on perceived performance and avoids the most common IndexedDB anti-pattern (re-cloning a multi-hundred-MB Blob on every position save). Use Serwist (not `next-pwa`, which is unmaintained and webpack-only) for the service worker, scoped strictly to app-shell caching — audio bytes belong exclusively in IndexedDB via Dexie, never in Cache Storage.

The dominant risk category is "looks done on desktop/simulator, breaks on a real iPhone": autoplay-gesture restrictions, storage eviction timing, and background/lock-screen audio behavior are all essentially untestable outside a physical device with the screen actually locking. Every phase touching playback or persistence needs an explicit real-device verification step, not just a passing desktop test. Feature scope is intentionally narrow (skip/seek, scrub bar, elapsed/remaining time, per-book progress, frequent auto-save, filename-based titles, delete) with metadata tag parsing, multi-file books, and lock-screen controls deliberately deferred to v1.x/v2 given their added complexity and (for lock-screen controls specifically) real platform uncertainty.

## Key Findings

### Recommended Stack

Next.js (App Router, 16.x) is the app framework, deployed to Vercel. Serwist replaces the unmaintained `next-pwa` for service worker generation, since it works with Next 16's default Turbopack pipeline and Next's native `app/manifest.ts`. Dexie.js is the single IndexedDB wrapper for both audio Blobs and structured metadata (audiobooks + playback progress) — chosen over raw IndexedDB or the lower-level `idb` wrapper for its promise-based API, built-in versioned schema migrations, and optional reactive `useLiveQuery()` bindings via `dexie-react-hooks`. **Dexie is the one and only storage library used across this project; it is accessed exclusively through a single storage-layer module (`lib/db.ts`), which is the architectural chokepoint described below** — there is no separate `idb`-based path, avoiding two competing storage-wrapper conventions. Playback uses the native HTML5 `<audio>` element (not Web Audio API, which would require decoding entire files into memory) plus the MediaSession API as a progressive-enhancement layer for lock-screen controls.

**Core technologies:**
- Next.js 16.x (App Router, Turbopack) — app framework and static/SSR shell, deployed to Vercel
- Serwist (`serwist` + `@serwist/next`) 9.5.x — service worker generation and app-shell precaching, Turbopack-compatible successor to `next-pwa`
- Dexie.js 4.4.x (+ `dexie-react-hooks` 1.1.x) — the single IndexedDB wrapper for audio Blobs and metadata/progress, used only via one storage-layer module
- Native `<audio>` element — playback engine, leverages browser-native streaming/seek of large local files via `blob:` object URLs
- MediaSession API (native) — lock-screen/Control Center metadata and controls, Safari ≥16.4, treated as best-effort not load-bearing

### Expected Features

Scoped specifically to a single-user, single-device, no-account, no-catalog personal player — most commercial-app features (store, accounts, sync, social, DRM, streaming, gamification) are explicitly excluded as anti-features with no benefit here.

**Must have (table stakes):**
- Skip forward/back by a fixed increment (recommend 15s)
- Scrub bar / seek control
- Elapsed/remaining time display during playback
- Per-book progress indicator in the library list
- Frequent, automatic position saving (not just on pause/close) — this is what actually delivers the app's Core Value
- Filename-based (cleaned-up) title display as the v1 identification scheme
- Reliable auto-resume to the saved position on reopening a book

**Should have (differentiators, v1.x):**
- Real metadata tag parsing (title/author/cover art)
- Multi-file/multi-track audiobook grouping — worth a loose data-model accommodation now (book = array of one-or-more file refs) even though full support is deferred
- Library sort/search
- Storage usage indicator (`navigator.storage.estimate()`)
- Bookmarks (manual timestamps, distinct from deferred chapters)

**Defer (v2+):**
- Background/lock-screen playback controls (MediaSession) — real platform risk on iOS PWA standalone mode; treat as a spike, not a committed roadmap phase
- Chapters, variable playback speed, sleep timer — already explicitly deferred by the user
- Import progress feedback for very large files — only if it proves necessary in practice

### Architecture Approach

Fully client-side "offline-first PWA with IndexedDB as the database" pattern: there is no backend, so IndexedDB (via Dexie) is the durable source of truth, and React component state is purely an in-memory working cache (e.g., ticking `currentTime`) that must always be written back through the storage layer, never treated as authoritative. Next.js is essentially a static-shell/bundler+router here, not a data-fetching framework — no React Query/SWR/Redux is needed since there's no network round-trip to hide or dedupe.

**Major components:**
1. **PWA shell** — `app/manifest.ts` + Serwist-generated service worker + `apple-touch-icon` (required separately from manifest icons for iOS) — handles installability and offline app-shell caching only, never audio data
2. **Storage layer (`lib/db.ts`)** — the single chokepoint through which every other component reads/writes; wraps Dexie, owns schema/versioning; internally splits frequently-updated small metadata (title, position, duration) from large write-once audio Blobs to avoid re-cloning multi-hundred-MB records on every position save
3. **Import flow** — native `<input type="file" accept="audio/*">`, hands the `File`/Blob straight to the storage layer with no intermediate global state
4. **Library list** — reads from the storage layer on mount + after mutations, renders per-book progress
5. **Player screen** (`/player/[id]` route) — owns the `<audio>` element and object-URL lifecycle, restores saved position on `loadedmetadata`, writes position back via a throttle-plus-flush-on-important-events pattern (throttle `timeupdate` to every 3-5s; always flush on pause/visibilitychange/unmount)

### Critical Pitfalls

1. **`manifest.json` icons are ignored on iOS** — the home-screen icon comes from `<link rel="apple-touch-icon">`; must add this explicitly (180×180px, no transparency) alongside standalone-display meta tags, or the installed app looks broken and opens with Safari chrome visible.
2. **iOS Safari evicts all site storage (the entire library) after ~7 days of no interaction**, with no reliable opt-out (`navigator.storage.persist()` has no confirmed effect on iOS). Mitigate by requiring home-screen launch (not a bookmarked tab), calling `persist()` anyway as a no-cost hedge, treating re-import as the accepted v1 recovery path, and setting user expectations in-app.
3. **`<audio>.play()` silently fails unless called synchronously inside a genuine user-gesture handler** — any `await` (e.g., an IndexedDB blob fetch) before `.play()` breaks the gesture chain on iOS. Never auto-play on open; assign the object-URL source ahead of the tap where possible, and call `.play()` as close to the tap as possible.
4. **Background/lock-screen playback stops unexpectedly when the PWA is backgrounded or the screen locks** — documented WebKit bugs and forum reports show audio stopping after roughly 30s locked in some standalone-PWA scenarios. Implement MediaSession from day one as the documented mechanism, but treat full reliability as a separately-verified, real-device acceptance criterion, not an assumption.
5. **Known Safari IndexedDB bugs cause silent data loss, transaction hangs, and quota errors** that don't reproduce on desktop Chrome — keep transactions short/synchronous (no `await` on unrelated work inside an open transaction), separate metadata from Blob records, handle `QuotaExceededError` explicitly, and version the schema from day one via Dexie's built-in versioning.

## Implications for Roadmap

Based on research, suggested phase structure (mirrors ARCHITECTURE.md's "Suggested Build Order," which is directly reusable as roadmap phases):

### Phase 1: Installability Skeleton
**Rationale:** Validates the riskiest platform assumption first — if "Add to Home Screen" install and standalone launch don't work correctly on a real iPhone, nothing built on top of it matters.
**Delivers:** Next.js app deployed to Vercel with `app/manifest.ts`, Serwist service worker, `apple-touch-icon` + standalone-mode meta tags, confirmed working via real-device "Add to Home Screen" test.
**Addresses:** N/A (infrastructure, not a FEATURES.md item)
**Avoids:** Pitfall 1 (manifest icon/standalone-mode misconfiguration)

### Phase 2: Storage Plumbing
**Rationale:** Highest-risk, highest-value phase — IndexedDB/Dexie behavior on iOS (Blob storage, schema versioning, eviction) must be validated in isolation before any UI is built on assumptions that might be wrong.
**Delivers:** `lib/db.ts` as the single Dexie chokepoint, with a versioned schema split into metadata (title, position, duration) vs. audio Blob concerns, `navigator.storage.persist()` called on first import, and a throwaway test harness proving add → reload → read-back works on a real device.
**Uses:** Dexie.js, `dexie-react-hooks`
**Implements:** Storage access layer / "storage as source of truth" architectural pattern

### Phase 3: Import Flow + Library List
**Rationale:** Builds the minimum vertical slice needed for a usable (if playback-less) app, now that storage is trustworthy.
**Delivers:** File-picker import wired to the storage layer, library list UI reading lightweight metadata only (not Blobs), delete-a-book.
**Addresses:** FEATURES.md table stakes — filename-based title display, per-book progress indicator (partial, pending duration), delete a book
**Avoids:** Pitfall 6 (routing audio through Cache Storage instead of IndexedDB)

### Phase 4: Player + Resume Position
**Rationale:** Delivers the app's stated Core Value; deliberately sequenced after storage/import so playback is built on validated persistence, not the reverse.
**Delivers:** `<audio>` element with object-URL lifecycle management, play/pause/seek/skip controls, scrub bar, elapsed/remaining time, and the throttle-plus-flush position-persistence pattern wired to `lib/db.ts`.
**Addresses:** FEATURES.md table stakes — skip forward/back, scrub bar, elapsed/remaining time, frequent auto-save, reliable auto-resume
**Avoids:** Pitfall 3 (gesture-unlock autoplay failures), Pitfall 5 (transaction hygiene for position writes)

### Phase 5 (optional, differentiator): MediaSession / Lock-Screen Controls + Polish
**Rationale:** Only pursued once core playback and persistence are proven solid on-device; treated as an experiment/spike given documented platform unreliability, not a guaranteed deliverable.
**Delivers:** MediaSession metadata + action handlers for lock-screen/Control Center controls, evaluated against real-device screen-lock testing.
**Addresses:** FEATURES.md differentiator — background/lock-screen playback controls
**Avoids:** Pitfall 4 (background audio stopping unexpectedly) — explicitly verified, not assumed

### Phase Ordering Rationale

- Phases 1-2 are pure platform/storage risk with no product payoff yet — deliberately front-loaded because failure here (icon/install broken, or IndexedDB Blob behavior surprising on iOS) would invalidate assumptions baked into all later UI work.
- Phases 3-4 build the minimum vertical slice needed to satisfy every "Active" requirement in PROJECT.md, in dependency order (can't have a player without a library, can't have a library without storage).
- Phase 5 is explicitly optional/deferred, matching both FEATURES.md's prioritization (P3, platform-risk) and PROJECT.md's existing deferred-items list.
- v1.x differentiators (metadata tag parsing, multi-file books, sort/search, storage usage indicator, bookmarks) are intentionally excluded from this v1 phase structure and should be considered only after the above phases are validated in real-world use.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Installability Skeleton):** iOS-specific manifest/icon/standalone-mode behavior is a common source of subtle misconfiguration; verify current Serwist + Next 16 Turbopack integration details at implementation time (STACK.md notes this moves fast and versions should be re-verified).
- **Phase 4 (Player + Resume Position):** Autoplay-gesture and position-persistence timing details are iOS-version-sensitive and under-documented by Apple; the discuss/plan step should explicitly scope real-device verification steps as acceptance criteria, not just "play button works."
- **Phase 5 (MediaSession/Lock-screen):** Genuinely uncertain platform behavior (documented WebKit bugs, inconsistent across iOS versions) — treat as a spike with its own research pass before committing implementation detail to a plan.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Storage Plumbing):** Dexie + IndexedDB Blob storage split is a well-documented pattern (HIGH-confidence architecture research); standard schema/versioning approach applies directly.
- **Phase 3 (Import Flow + Library List):** Straightforward CRUD-over-Dexie UI work with no platform-specific ambiguity beyond what Phase 2 already resolves.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core technology choices (Next.js, Serwist, Dexie, native `<audio>`) are well-supported by official/vendor docs, but exact package versions and Serwist/Turbopack compatibility details were sourced via websearch snippets, not direct registry/doc verification — re-check at `npm install` time. |
| Features | MEDIUM | Table-stakes/anti-feature reasoning is sound domain analysis, but specific claims (e.g., 15s vs 30s skip-interval convention) rest on a handful of support-doc sources, not systematic competitive testing. |
| Architecture | HIGH | Cross-checked against official web.dev, MDN, and WebKit engineering sources; the storage-layer chokepoint and metadata/Blob-split patterns are consistent with documented IndexedDB best practices. |
| Pitfalls | MEDIUM | Cross-checked across MDN, WebKit blog, Apple Developer Forums, WebKit Bugzilla, and multiple independent community write-ups, but several primary sources (webkit.org, dbushell.com) could not be directly fetched in this research pass and specific numbers/behaviors should be spot-checked on a real device before being treated as certain. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **iOS Safari behavioral claims (eviction timing, autoplay-gesture restrictions, background-audio stalling) are not independently device-verified** — all are consistent across multiple independent sources but should be spot-checked on an actual iPhone early (Phase 1-2) rather than assumed correct from research alone.
- **Serwist + Next.js 16/Turbopack compatibility specifics** (whether `--webpack` is ever required) should be re-verified against current Serwist docs at implementation time, since this area is noted as fast-moving.
- **Whether home-screen-launched PWAs get any storage-eviction leniency versus a bookmarked Safari tab is unconfirmed by Apple** (LOW-confidence claim in PITFALLS.md) — treat the "always launch from home screen" guidance as a reasonable best-practice hedge, not a guaranteed fix, and don't design around it as if it were verified.
- **Exact package versions (Serwist 9.5.x, Dexie 4.4.x) were sourced from websearch snippets, not direct npm registry queries** — confirm current versions at `npm install` time rather than hardcoding what's listed in STACK.md.

## Sources

### Primary (HIGH confidence)
- web.dev — Best Practices for Persisting Application State with IndexedDB — informs storage architecture patterns
- MDN — Storage quotas and eviction criteria — iOS eviction policy basis
- WebKit blog — Updates to Storage Policy — official Safari engineering source for 7-day eviction policy
- WebKit Bugzilla #261858 — primary bug tracker for background/lock-screen audio issues

### Secondary (MEDIUM confidence)
- Next.js official docs — App Router PWA guidance
- Serwist getting-started docs — Next.js integration
- Apple Developer Forums (multiple threads) — storage persistence, lock-screen audio, gesture restrictions
- npm registry pages — Serwist, Dexie, idb version numbers (re-verify at install time)
- MagicBell / community iOS PWA limitations roundups — cross-checked against WebKit/Apple sources
- BookBeat / Libby / Apple Books support docs — skip-interval conventions

### Tertiary (LOW confidence)
- dbushell.com, overdevs.com, Medium/Prototyped individual developer blogs — iOS-specific MediaSession/background-audio field reports, not independently fetched/verified in this pass
- gist.github.com/pesterhazy IndexedDB bug list, PWA-POLICE/pwa-bugs — community-curated, directionally useful but not primary sources

---
*Research completed: 2026-08-07*
*Ready for roadmap: yes*
