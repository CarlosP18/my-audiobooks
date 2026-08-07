<!-- GSD:project-start source:PROJECT.md -->

## Project

**My Audiobooks**

A personal Progressive Web App (PWA), installable on iPhone via "Add to Home Screen," that works like Audible but keeps every audio file on the device itself — no server, no account, no database. Carlos imports his own audiobook files, builds a personal library, and resumes playback exactly where he left off each time he reopens the app.

**Core Value:** Resume playback exactly where you left off, every time — reliably, offline, entirely on-device.

### Constraints

- **Platform**: iPhone Safari only — no need for cross-browser or Android support
- **No native app**: environment has no Mac/Xcode access — must be a web-based PWA
- **No backend**: single personal user, avoid server/db complexity — client-side storage only
- **Storage**: iOS Safari PWA storage is not infinite and can in theory be evicted by the OS — acceptable risk for personal use; no backup/export required for v1

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.x (App Router, Turbopack default) | App framework, deployed to Vercel | Already the team's default stack; Next 16 made Turbopack the stable default bundler, which matters because it determines which PWA tooling is compatible (see next-pwa vs Serwist below). App Router supports a native `app/manifest.ts` file for the web manifest with zero extra dependencies. |
| Serwist (`serwist` + `@serwist/next`) | 9.5.x | Service worker generation, precaching, offline app-shell caching | The actively maintained successor to `next-pwa` (which is unmaintained and requires webpack — incompatible with Next 16's default Turbopack pipeline without a `--webpack` escape hatch). Serwist is built on Workbox concepts, ships an official Next.js integration that injects the precache manifest and generates `public/sw.js` at build time, and works with Turbopack. |
| Dexie.js | 4.4.x | IndexedDB wrapper for both audio Blobs and structured metadata (library entries, playback position) | Fluent, promise-based API with built-in versioned schema migrations and reactive queries (`dexie-react-hooks`) — meaningfully less boilerplate than raw IndexedDB or the lower-level `idb` wrapper for a schema with two related tables (audiobooks + progress). One dependency handles both the giant audio Blobs and the small metadata records, avoiding two separate storage systems. |
| HTML5 `<audio>` element (native, no library) | N/A (browser built-in) | Audio playback engine | This project needs sequential playback of large local files with seek/resume — exactly what `<audio>` is built for. Web Audio API is for real-time synthesis/effects/graphs and is unnecessary complexity here; it also does not benefit from the browser's native streaming/byte-range handling of large media files the way `<audio src="blob:...">` does. |
| MediaSession API (native, no library) | N/A (browser built-in, Safari ≥16.4) | Lock-screen / Control Center playback metadata and controls | Only way to get title/cover-art and play/pause/seek controls on iOS's lock screen from a web page. Supported in Safari since 16.4 but flakier than Chrome/Android — treat as progressive enhancement, not a load-bearing feature (see Pitfalls). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dexie-react-hooks` | 1.1.x (matches Dexie 4.x) | Reactive `useLiveQuery()` bindings for React components | Use for the library list view and now-playing screen so UI auto-updates when IndexedDB records change (e.g., after import or position save), without manual state plumbing. |
| `next-pwa` / `@ducanh2912/next-pwa` | — | Older/forked PWA plugin | **Do not use** — see "What NOT to Use." Listed only for contrast with Serwist. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vercel CLI / Vercel Git integration | Deploy to stable HTTPS URL for iOS install testing | Free tier is sufficient — static/SSR Next.js app with no server-side data needs. Preview deployments get their own HTTPS URL, useful for testing "Add to Home Screen" on real hardware per branch. |
| Real iPhone (physical device) | Manual QA of PWA install, storage persistence, lock-screen behavior | **Non-negotiable.** iOS Safari PWA behavior (install flow, storage eviction, background audio, MediaSession) cannot be reliably verified in desktop Safari's responsive design mode or in simulators — many of the pitfalls below only manifest on real hardware with the screen actually locking. |

## Installation

# Core (already assumed present: next, react, react-dom)

# Client-side storage

# No packages needed for audio playback (native <audio> + MediaSession API)

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Dexie.js for Blob + metadata storage | Origin Private File System (OPFS) via `navigator.storage.getDirectory()` | If profiling shows IndexedDB Blob read/write is too slow for very large files (OPFS is reportedly 3-4x faster for large binary I/O since it avoids IndexedDB's transaction/serialization overhead). Trade-off: writable OPFS access requires `createSyncAccessHandle()` inside a dedicated Web Worker — meaningfully more implementation complexity than a Dexie `put()`. For "hundreds of MB" files and a personal single-user app, Dexie/IndexedDB Blob storage is very likely fast enough; don't reach for OPFS unless you hit a measured problem. |
| `idb` (raw promise wrapper) | Plain IndexedDB, no wrapper | Only if you want zero dependencies and are comfortable with the verbose native callback-to-promise boilerplate. Not recommended here — Dexie's migration story alone (you will add fields to the audiobook/progress schema as features grow) pays for itself immediately. |
| Serwist for service worker | Hand-written service worker (no library) | If you want maximum control over caching strategy and are willing to hand-maintain the precache manifest and `sw.js`. Reasonable for a very small app-shell, but Serwist removes a whole class of manual-invalidation bugs for negligible cost (one dependency, standard config file) — use it by default. |
| Native `<audio>` element | Web Audio API (`AudioContext` + `AudioBufferSourceNode`) | Only if you need waveform visualization, gapless chapter transitions with sample-accurate crossfade, or real-time DSP (EQ, speed-shifting with pitch correction). None of these are in scope for v1. Loading a whole audiobook file into an `AudioBuffer` also means decoding the entire file into memory up front — a bad fit for "hundreds of MB" files on an iPhone. |
| MediaSession API for lock-screen controls | Skip lock-screen controls entirely | Only if you're willing to ship without Control Center / lock-screen play-pause-seek. Given iOS PWA background audio is already fragile (see Pitfalls), MediaSession is worth implementing but must be treated as best-effort, not a hard requirement for v1 sign-off. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `next-pwa` (original, unmaintained) | No longer maintained; built for webpack. Next.js 16 defaults to Turbopack, so `next-pwa` forces you to add `--webpack` to every build/dev command, fighting the framework's default instead of working with it. | Serwist (`@serwist/next`) |
| Storing audio as raw `ArrayBuffer` in IndexedDB records | Triggers full structured-clone serialization cost on every read/write, which is the actual source of most "IndexedDB is slow for big files" complaints online. | Store as `Blob` objects — browsers persist Blob bytes to disk more directly and this sidesteps most of the overhead people attribute to "IndexedDB can't handle big files." |
| Relying on `localStorage` for playback position or any app data | 5-10MB cap, synchronous (blocks main thread), and subject to the same iOS 7-day inactive-eviction policy as everything else — with no async/Blob support, so it can't be your single storage layer anyway. | Dexie/IndexedDB for everything, including small metadata like playback position — keep one storage system. |
| Web Audio API as the primary playback pipeline | Requires decoding full files into memory (`AudioBuffer`) before playback starts — wrong model for "hundreds of MB" files and adds implementation complexity (manual play/pause/seek/currentTime bookkeeping) that `<audio>` gives you for free. | Native `<audio>` element with a `blob:` object URL sourced from the Dexie-stored Blob. |
| Assuming `navigator.storage.persist()` or `Cache Storage` guarantees data survives indefinitely on iOS | iOS's persistence heuristics are opaque and can still evict; and critically, storage is **not shared** between a Safari browser tab and the same site installed as a standalone Home Screen PWA — testing in a regular Safari tab and assuming it reflects the installed PWA's storage is a common trap. | Always develop/test against the actual installed (Add to Home Screen) PWA instance; treat persistence as best-effort per this project's own accepted constraints, not a guarantee. |
| Expecting `input[type=file][accept="audio/*"]` to filter the iOS picker to audio files | iOS Safari does not filter file-type choices the way Android does — users see Photo Library / Take Photo / Browse and must navigate manually in Files app to find audio. This is a UX reality, not a bug you can fix client-side. | Design the import flow assuming users will pick via "Browse" → Files app, and validate/reject non-audio MIME types after selection rather than relying on `accept` to prevent bad picks. |

## Stack Patterns by Variant

- Migrate the audio-file storage layer to OPFS (keep Dexie for lightweight metadata/progress)
- Because OPFS's worker-based synchronous file handles outperform IndexedDB for large binary reads/writes, but that complexity isn't justified until you have evidence IndexedDB is actually the bottleneck
- You'll need `display: standalone` in the manifest (already required for install anyway) and to re-evaluate — iOS PWA push support is a fast-moving, separate research area not covered by this milestone's scope
- Because this project's requirements explicitly exclude that scope for v1; don't build for it prematurely

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `serwist@9.5.x` / `@serwist/next@9.5.x` | `next@16.x` (Turbopack default) | Confirmed working with Turbopack for build; some Serwist docs still mention needing `--webpack` only for local service-worker dev/testing, not production builds — verify against current Serwist Next.js getting-started docs at implementation time since this moves fast. |
| `dexie@4.4.x` | `dexie-react-hooks@1.1.x` | Keep both on matching major version (Dexie 4.x); `dexie-react-hooks` is a thin `useLiveQuery` layer that tracks Dexie's own release cadence. |
| Next.js App Router `app/manifest.ts` | iOS Safari | iOS Safari does not fully honor `manifest.json`/`manifest.ts` icons for the home-screen icon — it prioritizes the `<link rel="apple-touch-icon">` meta tag. Next's `app/manifest.ts` alone is **not sufficient** for iOS; you must also add an explicit `apple-touch-icon` via `app/icon.tsx`/metadata or a static file in `app/layout.tsx`'s metadata export. |

## Sources

- [Next.js — Guides: PWAs](https://nextjs.org/docs/app/guides/progressive-web-apps) — official App Router PWA guidance — MEDIUM confidence (official docs surfaced via web search, not fetched via Context7/verified line-by-line)
- [Serwist — Getting started (@serwist/next)](https://serwist.pages.dev/docs/next/getting-started) — Next.js integration setup — LOW/MEDIUM confidence (vendor docs, not directly fetched/verified)
- [npmjs.com/package/serwist](https://www.npmjs.com/package/serwist), [npmjs.com/package/@serwist/next](https://www.npmjs.com/package/@serwist/next) — version numbers (9.5.11/9.5.12 as of research date) — LOW confidence (websearch snippet, not direct npm registry query — re-verify exact version at `npm install` time)
- [npmjs.com/package/dexie](https://www.npmjs.com/package/dexie) — version 4.4.4 — LOW confidence (websearch snippet)
- [npmjs.com/package/idb](https://www.npmjs.com/package/idb), [github.com/jakearchibald/idb](https://github.com/jakearchibald/idb) — idb v8.0.3, Jake Archibald — LOW confidence
- [npm-compare.com: dexie vs idb](https://npm-compare.com/dexie,idb) — feature/DX comparison — LOW confidence (aggregator site)
- [WebKit blog — Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) — iOS storage quota/eviction rules, home-screen exemption from 7-day cap — MEDIUM confidence (official WebKit blog)
- [MDN — Storage quotas and eviction criteria](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — cross-browser quota behavior — MEDIUM confidence (MDN)
- [Apple Developer Forums — Safari iOS PWA Data Persistence Beyond 7 Days](https://developer.apple.com/forums/thread/710157) — community-confirmed 7-day cap + home-screen exemption nuance — LOW confidence (forum thread, not official docs, but consistent with WebKit blog)
- [MDN — MediaSession](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession), [MDN — MediaSession.setActionHandler()](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setActionHandler) — API reference, setPositionState/seekto behavior — MEDIUM confidence (MDN)
- [dbushell.com — iOS Web Apps and Media Session API](https://dbushell.com/2023/03/20/ios-pwa-media-session-api/), [overdevs.com — Nailing the MediaSession API on iOS](https://overdevs.com/ios-mediasession.html) — iOS-specific MediaSession quirks — LOW confidence (individual developer blogs, but directly relevant field experience)
- [Medium/Prototyped — What we learned about PWAs and audio playback](https://medium.com/prototyped/what-we-learned-about-pwas-and-audio-playback-10a01c6aecbd) — real-world report of iOS standalone PWA audio stopping on lock/background — LOW confidence (single team's field report, but corroborated by Apple Developer Forums threads)
- [Apple Developer Forums — iOS Audio Lockscreen Problem in PWA](https://developer.apple.com/forums/thread/762582), [Apple Developer Forums — audio player doesn't play next track when screen locked](https://developer.apple.com/forums/thread/706499) — corroborating reports of WebKit bug 198277 (background audio stops in standalone PWA) — LOW confidence (forum threads, but multiple independent reports of the same WebKit bug ID)
- [MagicBell — PWA iOS Limitations and Safari Support [2026]](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — general 2026-dated iOS PWA limitations roundup — LOW confidence (third-party blog, cross-checked against WebKit/Apple sources above)
- [renderlog.in — OPFS: The Browser's Built-in Filesystem Explained](https://renderlog.in/blog/origin-private-file-system-opfs/), [barndoors.lumafield.com — 3x faster project loads with OPFS](https://barndoors.lumafield.com/3x-faster-project-loads-with-the-origin-private-file-system/) — OPFS vs IndexedDB performance for large binaries — LOW confidence (blog posts, directionally useful for the "Alternatives Considered" note, not load-bearing for the core recommendation)
- [Apple Developer Forums — File-selection-dialog thread](https://developer.apple.com/forums/thread/126850) — iOS file picker accept-attribute behavior — LOW confidence (forum thread)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
