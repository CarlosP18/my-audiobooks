# Pitfalls Research

**Domain:** iOS Safari installable PWA — local-only audio library with IndexedDB blob storage and resumable playback
**Researched:** 2026-08-07
**Confidence:** MEDIUM (cross-checked across MDN, WebKit blog, Apple Developer Forums, WebKit Bugzilla, and multiple independent community write-ups; no single primary Apple source consolidates all of this, so treat specific numbers/behaviors as directionally correct and verify against a real device during Phase implementation)

## Critical Pitfalls

### Pitfall 1: manifest.json icons are ignored on iOS — the "Add to Home Screen" icon comes from `apple-touch-icon`

**What goes wrong:**
Developer configures `manifest.json` with a full `icons` array (the standard PWA approach) and assumes that's sufficient. On iOS, Safari does not read `manifest.json` icons for the home screen. It uses the `<link rel="apple-touch-icon" href="...">` tag in the document `<head>`. Without it, the installed icon is a pixelated screenshot of the page — which reads as broken/unpolished for what's meant to be a daily-use app.

**Why it happens:**
The manifest spec is a cross-platform (mostly Android/Chrome) standard; iOS's home-screen icon resolution predates broad manifest support and was never fully unified with it. Most PWA tutorials are Android-first and gloss over this.

**How to avoid:**
Add both: `manifest.json` icons (future-proofing / spec compliance) AND an explicit `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` (180×180px PNG, no transparency — iOS renders transparent pixels as black) in the root layout `<head>`. Also set `<meta name="apple-mobile-web-app-capable" content="yes">` and `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` (or `default`) for standalone display quirks, plus `<meta name="viewport" content="viewport-fit=cover">` if handling safe-area insets.

**Warning signs:**
Icon looks like a screenshot after "Add to Home Screen"; app opens inside Safari chrome (address bar visible) instead of standalone full-screen — the latter usually means `apple-mobile-web-app-capable` is missing or the manifest's `display` isn't `standalone`/`fullscreen`.

**Phase to address:**
Phase covering PWA shell/manifest setup (early, before any storage/audio work) — this is cheap to get right up front and expensive to notice late (requires re-testing install flow on device each time).

---

### Pitfall 2: iOS Safari evicts all site storage — including the entire audio library — after ~7 days of no interaction, with no way to opt out

**What goes wrong:**
Safari's Intelligent Tracking Prevention (ITP) policy deletes all client-side storage (IndexedDB, localStorage, Cache Storage, WebSQL) for an origin that the user hasn't interacted with (tap/click, not just backgrounded) in 7 days. For this app, that means: user doesn't open the audiobook app for a week (plausible — maybe they finished a book and haven't started the next), reopens it, and the entire library plus all resume positions are silently gone. There is no `StorageManager.persist()` support on iOS to request exemption (unlike desktop Chrome/Firefox/Android).

**Why it happens:**
ITP treats all site storage as potentially tracking-related and evicts uniformly; Apple does not expose an API to distinguish "app the user cares about" from "site that set a tracking cookie." This is a deliberate privacy tradeoff, not a bug — but it directly conflicts with the "personal Audible replacement" use case, which assumes durable local storage.

**How to avoid:**
This cannot be fully prevented — it must be designed around:
1. Home-screen launch, not Safari tab, is the mitigation of first resort: some evidence (unconfirmed by Apple, treat as LOW confidence) suggests PWAs launched from the home screen icon may be treated more leniently than the same origin visited in a regular Safari tab, because the home-screen launch itself counts as "interaction." Regardless, always instruct the user to install via Add to Home Screen (already a requirement) and open the app from that icon rather than bookmarking the URL in Safari.
2. Call `navigator.storage.persist()` anyway (silently ignored/no-op if unsupported) — costs nothing, may help on other engines if the user ever accesses via non-Safari on iOS (e.g., Chrome for iOS, which is also WebKit but may diverge).
3. Treat re-import as an accepted recovery path for v1 (per PROJECT.md's accepted risk) but make re-import fast and low-friction (batch file picker, not one-at-a-time).
4. Nice-to-have for v1, cheap to build: an explicit "Export library" / "Backup" feature is out of scope per PROJECT.md, but consider surfacing a lightweight warning in the UI ("Open this app at least once a week to keep your library" or similar) — a one-line static text costs nothing and sets expectations.

**Warning signs:**
Library empty or partially empty on reopen after a gap in usage; user reports "my books disappeared." Test explicitly by not touching the installed app for 7+ days (or research whether iOS Simulator/Safari dev tools expose a way to simulate eviction — as of this research, no reliable simulation method was found; real-device, real-time testing is the only confirmed way).

**Phase to address:**
Should be called out explicitly in the phase that defines the storage/data model (so the schema doesn't assume permanence), and again in whichever phase handles empty-library / first-run UX (so "empty library" has messaging that doesn't feel like an error state, since it may legitimately be an eviction event vs. a true first run).

---

### Pitfall 3: `<audio>` playback silently fails to start unless triggered synchronously inside a user-gesture event handler

**What goes wrong:**
Calling `audioElement.play()` from anywhere except directly inside a click/tap event handler (e.g., after an `await` for an IndexedDB read, inside a `setTimeout`, after a Promise resolves, or on page load) throws a `NotAllowedError` or silently no-ops on iOS Safari. This is especially easy to hit in this app's exact use case: "resume where I left off" naturally wants to auto-load and maybe auto-play on open, or the play button handler does an async IndexedDB blob fetch before calling `.play()` — breaking the gesture chain.

**Why it happens:**
iOS enforces autoplay restrction tied strictly to the call stack of a genuine user gesture. Any `await` inside the handler before `.play()` is called breaks the "user gesture" association even though the click itself was real.

**How to avoid:**
- Never auto-play on app open, even to "resume" — always require an explicit tap on a play control (this matches normal audiobook-app UX anyway).
- Structure the play handler so `audio.play()` is called synchronously in response to the tap, then handle async blob-loading either (a) beforehand — e.g., have the `<audio src>` (via `URL.createObjectURL(blob)`) already assigned before the user taps play, so play() only needs to resume/unpause, or (b) call `.play()` immediately in the handler even before the source swap finishes loading, accepting a brief buffering state, rather than awaiting the IndexedDB read first.
- If audio needs to switch tracks (e.g., loading a different chapter/book), do the `src` swap and `.load()` and keep the actual `.play()` call as close to the tap handler as possible; consider "arm" patterns (play a silent/tiny buffer synchronously on first tap to "unlock" audio context, then swap source).

**Warning signs:**
Play button appears to do nothing on first tap (works on second tap, or after switching apps and back); works fine on desktop Chrome/simulator but fails on physical iPhone — this restriction is essentially undetectable outside real iOS Safari, so desktop testing will give false confidence.

**Phase to address:**
The core playback phase — should be a named acceptance criterion ("play starts on first physical tap on a real iPhone"), not just "play button works" tested only in a desktop browser or simulator.

---

### Pitfall 4: Background/lock-screen playback stops unexpectedly when the PWA is minimized or the screen locks

**What goes wrong:**
This is arguably the single biggest risk to the app's core value proposition (an audiobook player is used with the screen off/locked or while in another app). Historically and still inconsistently across iOS versions, home-screen-installed PWAs (standalone display mode) pause audio playback when the app is backgrounded or the device is locked — behavior that differs from the same page opened as a regular Safari tab. Documented WebKit bugs (e.g., bug 261858) show issues specifically around MediaSession/lock-screen controls and autoplay breaking at track transitions, and Apple Developer Forum threads report audio ceasing after roughly 30 seconds paused on the lock screen in some standalone-PWA scenarios.

**Why it happens:**
WebKit's background execution model for installed web apps (standalone mode) is more restrictive than Safari tabs and is not fully documented or consistent release-to-release; Apple prioritizes native `AVAudioSession`-based apps for true background audio and treats web-based background audio as a lower-tier, evolving capability.

**How to avoid:**
- Implement the Media Session API (`navigator.mediaSession.metadata`, `setActionHandler` for play/pause/seekbackward/seekforward/previoustrack/nexttrack) from day one — even though it's not a complete fix, it's necessary for lock-screen controls to appear at all and is the documented mechanism Apple expects apps to use.
- Test specifically on a real physical iPhone (not simulator) with: (a) screen lock while playing, (b) app backgrounded via home gesture while playing, (c) long lock-screen duration (multiple minutes) to check for the ~30s-stall class of bug.
- Because this is a known, actively-tracked WebKit limitation rather than something fixable purely in app code, set expectations in PROJECT.md/roadmap: background/lock-screen playback reliability should be an explicit, separately-verified acceptance criterion, not assumed to "just work" because `<audio>` has a `play()` method. If reliability is unacceptably poor after implementation, the fallback (documented, not necessarily needed for v1) is that some developers pair a silent/looping audio "keep-alive" trick or accept degraded background behavior as a known iOS PWA limitation.
- Do not rely on WebRTC/Web Audio API nodes for the core playback path if avoidable — plain `<audio>` element has comparatively better background survival characteristics than more advanced Web Audio graph setups, which are known to suspend more aggressively when backgrounded.

**Warning signs:**
Playback works fine while app is in foreground but stops the moment the screen locks or another app is opened; lock-screen media controls (now-playing widget) don't appear at all, are unresponsive, or show a media title/artwork but tapping play does nothing.

**Phase to address:**
Dedicated verification step within the playback phase, explicitly requiring real-device testing (screen-lock scenario) before that phase is considered done — this is exactly the kind of "looks done in the simulator, isn't done on device" trap this domain is known for.

---

### Pitfall 5: Known Safari IndexedDB bugs cause silent data loss, transaction hangs, and quota errors that don't reproduce on desktop Chrome

**What goes wrong:**
Safari's IndexedDB implementation has a documented history of instability beyond the general eviction issue: transactions unexpectedly auto-closing/committing when idle (especially around `await`/Promise boundaries, or when the tab/app transitions to background mid-transaction), operations that hang silently with no error and no progress, an iOS 13→14 upgrade bug that corrupted index data during a migration, and a Safari 14.1.1 regression where `indexedDB.open()` failed entirely on first load. Safari also doesn't support `IDBTransaction.commit()` (a convenience method other browsers support), and large database files have been reported to grow unboundedly on disk without garbage collection.

**Why it happens:**
WebKit's IndexedDB implementation is less mature and less heavily used at scale than Chromium's; edge cases around async/await patterns (which are extremely common in modern app code) interact badly with Safari's more eager transaction-closing behavior, since IndexedDB transactions are meant to auto-commit at the end of the current microtask/event-loop turn, and Safari is stricter/buggier about this than Chrome.

**How to avoid:**
- Keep IndexedDB transactions synchronous and short-lived: do all `.get()`/`.put()`/`.delete()` calls needed for one logical operation within the same transaction without `await`ing anything else in between; don't mix an `await fetch()` or `await` on an unrelated promise inside an open transaction.
- Store each audiobook's audio Blob under its own key/object store record — do not nest blobs inside a large parent object holding all metadata, since IndexedDB structured-cloning happens on the main thread and blocks the UI proportional to object size; keep the audio blob and the lightweight metadata (title, progress position, duration) as separate records/stores so metadata reads (e.g., rendering the library list) don't pay the cost of touching blob data.
- Wrap all IndexedDB operations with explicit `onerror`/`onblocked` handlers and treat `QuotaExceededError` as an expected, handled case (surface "not enough storage" UI) rather than an unhandled rejection — this matters more here than typical apps because audio files are large (hundreds of MB) and users will realistically hit quota limits.
- Use (or vet closely) a small well-tested wrapper library (e.g., `idb` by Jake Archibald) rather than hand-rolling raw IndexedDB transaction management — it doesn't fix Safari's underlying bugs, but reduces the chance of introducing app-level bugs around promise/transaction timing that trigger Safari's stricter auto-close behavior.
- Version the database schema (`indexedDB.open(name, version)` with an `onupgradeneeded` handler) from the start, even though v1 only has one schema — retrofitting versioning after the first release is a common and painful mistake source when a second schema change is inevitably needed.

**Warning signs:**
Import/save operations that work reliably in rapid testing but occasionally "lose" a save (position doesn't persist) under real usage patterns (e.g., backgrounding the app right after seeking); errors that only reproduce on physical iPhone/real Safari, never in desktop dev tools.

**Phase to address:**
Storage/data-layer phase (define schema + version from the start) and again during resume-position persistence phase (transaction hygiene around save-on-pause/save-on-background events).

---

### Pitfall 6: Cache Storage API's ~50MB quota gets confused with IndexedDB's much larger quota — audio ends up in the wrong storage mechanism

**What goes wrong:**
Teams following generic "PWA offline" tutorials (most of which are about caching app-shell assets like JS/CSS/HTML via the Service Worker Cache API) sometimes conflate that mechanism with the storage strategy for user data. On iOS Safari, the Cache Storage API used by service workers is subject to a much smaller effective quota (reported around 50MB per partition) than IndexedDB (which can be several hundred MB to a large percentage of free disk, depending on iOS version). Attempting to cache large audio blobs via the service worker Cache API — instead of storing them in IndexedDB — will hit quota errors quickly and is the wrong tool for user-generated large binary data regardless of quota, since Cache Storage is designed for network request/response caching of app assets, not a Blob database.

**Why it happens:**
"Offline-first PWA" tutorials focus almost entirely on service-worker asset caching (workbox, next-pwa); it's easy to assume the same mechanism should hold all "offline data," conflating "make the app shell available offline" with "store the user's actual audio files offline."

**How to avoid:**
Keep the two mechanisms strictly separated: service worker + Cache Storage API is only for the Next.js app shell (JS/CSS/HTML/manifest/icons) so the app itself loads offline; IndexedDB is exclusively for audiobook Blobs and metadata/progress. Never route audio file bytes through the service worker's cache.

**Warning signs:**
`QuotaExceededError` thrown surprisingly early (well before the device is actually low on storage) when trying to cache audio — a strong signal that audio bytes are being routed through Cache Storage rather than IndexedDB.

**Phase to address:**
Storage architecture decision, ideally fixed in the phase that first wires up the service worker (should explicitly scope precache/runtime-cache rules to static assets only, with the audio import/storage phase kept fully separate).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Use `next-pwa` zero-config plugin as-is instead of a custom Serwist/manual service worker | Fast initial setup, less boilerplate | `next-pwa` has incomplete/unofficial App Router support and known issues with middleware blocking `manifest.json`/`sw.js`, and is not the actively-recommended path going forward (Serwist is the maintained successor) | Acceptable for v1 if using Pages Router or carefully verifying App Router compatibility; revisit if hitting stale-cache or registration bugs |
| Store playback position only in memory + IndexedDB write on pause/unmount, without a periodic autosave interval | Simpler code, fewer writes | If the app is killed abruptly (iOS can terminate backgrounded tabs/PWAs aggressively under memory pressure) without a clean pause/unmount event firing, the last few minutes of listening position can be lost | Acceptable for v1 given personal single-user low-stakes use, but add a periodic autosave (e.g., every 15-30s during playback) — it's cheap and meaningfully reduces lost-position frustration |
| Skip explicit IndexedDB schema versioning on day one ("we'll add it when we need it") | Slightly less setup code | Retrofitting `onupgradeneeded` migration logic after real user data already exists in the unversioned store is materially harder and riskier (risk of corrupting/losing the existing library during first migration) | Never — the `onupgradeneeded` handler costs almost nothing to add up front even with a single version |
| Treat "works in iOS Simulator / desktop Chrome DevTools device emulation" as sufficient testing for playback/gesture/lock-screen behavior | Faster iteration, no physical device needed each time | Simulator does not accurately reproduce autoplay-gesture restrictions, background audio suspension, or storage eviction timing — false confidence that ships broken behavior | Never acceptable for the playback/background-audio and storage-eviction pitfalls specifically; fine for pure UI layout iteration |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| Vercel deployment + Next.js PWA manifest/service worker | Middleware or routing config accidentally intercepts/redirects `/manifest.json` or `/sw.js`, breaking install or offline behavior in production even though it worked in local dev | Explicitly exclude `manifest.json`, `sw.js`, and icon assets from any Next.js middleware matcher; verify production URLs for these files return 200 with correct content-type after each deploy |
| `<input type="file">` for audio import | Assuming standard multi-file picker UX matches desktop; iOS file-selection dialogs have had bugs where dismissing the app (e.g., via app switcher) while the picker is open causes it to never reappear, requiring a reload | Test the actual import flow with app-switching interruptions; keep import as a simple, resumable action (user can just retry) rather than a multi-step wizard that's expensive to redo |
| Media Session API metadata/artwork | Assuming full parity with native lock-screen "Now Playing" UI (artwork, title/subtitle) works identically to native apps | Treat MediaSession as "best effort" on iOS — implement it fully (metadata + action handlers) but don't block core functionality on perfect lock-screen artwork rendering, since implementation quality has historically varied across iOS versions |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Loading the entire audio Blob into memory before creating an Object URL for playback | Noticeable delay/jank when opening a book, especially for hundreds-of-MB files; possible memory pressure crashes | Fetch the Blob record from IndexedDB and use `URL.createObjectURL(blob)` directly as the `<audio src>` rather than reading it into an ArrayBuffer/manipulating bytes in JS first; revoke the object URL (`URL.revokeObjectURL`) when switching books to avoid leaking memory | Becomes noticeable once individual files exceed roughly 100-200MB, which is explicitly the expected file size range per PROJECT.md |
| Rendering full library list by reading each book's audio Blob to display metadata | Library screen slow to load, scrolling jank as library grows | Store lightweight metadata (title, duration, progress, file size) in a separate IndexedDB record/object store from the audio Blob itself, so the library view only reads small metadata records, never blob bytes | Becomes noticeable once the library has more than a handful of books, or as soon as any single book is large |
| Saving playback position on every `timeupdate` event (fires very frequently, ~4x/sec) | Excessive IndexedDB writes, potential transaction contention/battery drain, increased odds of hitting Safari's flaky-transaction bugs under load | Throttle/debounce position saves (e.g., every 5-15 seconds, plus explicit save on pause/background/unload) rather than writing on every `timeupdate` tick | Not a hard breaking point, but is wasted work and increases exposure to the transaction-hang class of Safari bug described in Pitfall 5 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Assuming client-side-only storage means no security work is needed | While there's no server/account to compromise, IndexedDB data is still accessible to any script running on the same origin — a supply-chain-compromised npm dependency shipped in the bundle could exfiltrate or corrupt library data | Keep the dependency surface minimal (this is a strong reason to avoid heavy frameworks/analytics SDKs beyond what's needed), and don't load third-party scripts from CDNs in the same origin/scope as the app |
| Serving the app without HTTPS or misconfiguring HTTPS on a custom domain | PWA installability and service worker registration silently fail without valid HTTPS (localhost is the only exception) | Vercel provides HTTPS by default — verify the deployed URL actually uses `https://` and that there are no mixed-content issues before relying on it for install testing |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| No onboarding/hint for how to "Add to Home Screen" on iOS | Because iOS provides no native install-prompt banner (unlike Android's `beforeinstallprompt`), users who don't already know the Share-sheet gesture will simply use the app in a normal Safari tab, where it's more exposed to the 7-day eviction risk and lacks standalone chrome | Add a simple first-visit banner/instructions ("Tap the Share icon, then Add to Home Screen") shown when the app detects it's not running in standalone mode |
| Treating "storage got evicted" and "genuinely empty library, first run" as the same UI state | User can't tell whether they need to re-import everything or whether this is expected first-run behavior, leading to confusion/support burden (even if "support" is just the user themselves later) | Distinguish empty states in copy: if `localStorage`/IndexedDB metadata shows evidence of prior use (e.g., a small persistent flag written outside the evictable data, though note even that could itself be evicted) vs. true first run, tailor the empty-state message accordingly; at minimum, always word the empty-library state neutrally rather than implying an error |
| Silent playback failures on first tap due to the gesture-unlock issue (Pitfall 3) with no user feedback | User taps play, nothing happens, taps again in confusion, may think the app is broken | Ensure the play button visibly reflects loading/buffering state immediately on tap (even before actual audio starts), so a slight delay doesn't read as "broken" |

## "Looks Done But Isn't" Checklist

- [ ] **Home screen install:** Often missing the `apple-touch-icon` link tag even though `manifest.json` icons are configured — verify the actual installed icon on a physical iPhone, not just that `manifest.json` validates.
- [ ] **Standalone display mode:** Often missing `apple-mobile-web-app-capable` meta tag, so the "installed" app still opens with Safari's address bar visible — verify by fully closing Safari, then launching from the home screen icon.
- [ ] **Play button:** Often works in desktop DevTools/simulator but fails on the first real tap on a physical iPhone due to the gesture-unlock issue — verify on a real device with a cold app launch (not already-unlocked from prior interaction in the session).
- [ ] **Resume position:** Often appears to work when tested via pause-then-immediately-reopen, but fails to persist the most recent seconds of listening when the app is killed by iOS under memory pressure or after being backgrounded a long time — verify by playing, backgrounding for several minutes (or force-quitting from the app switcher), then reopening.
- [ ] **Lock-screen controls:** Often appears to work in initial testing (few seconds locked) but breaks on longer lock durations or at track-end transitions — verify with the screen locked for several minutes during playback, and again across a track/chapter change if applicable.
- [ ] **Offline mode:** Often "works offline" only for the app shell (because that's what the service worker tutorial covers) while audio playback quietly depends on network for the actual audio bytes if blob-loading logic accidentally falls back to fetching a file URL instead of reading from IndexedDB — verify by enabling Airplane Mode and confirming a previously-imported book still plays.
- [ ] **Storage quota errors:** Often unhandled (`QuotaExceededError` surfaces as an unhandled promise rejection / silent import failure) — verify the import flow shows a clear message when storage is full rather than failing silently.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|-----------------|
| Storage eviction wipes the library | LOW (per-incident, given no backup/export in v1 scope) | User re-imports audio files from their original source (device Files app, cloud drive, etc.) and re-navigates each book to its prior position from memory — genuinely lossy but low-stakes for a personal app per PROJECT.md's accepted risk |
| IndexedDB corruption from a Safari bug (e.g., failed index migration) | MEDIUM | Detect open/read failures with try/catch around all IndexedDB calls; on unrecoverable error, offer a "reset library" action that deletes and recreates the database rather than leaving the app permanently broken in a corrupted state |
| Service worker stuck serving a stale cached version after a deploy | LOW | Implement a version-check / `skipWaiting()` + `clients.claim()` pattern with a user-visible "update available, tap to refresh" prompt, or simply instruct force-refresh (which on iOS PWA usually means removing and re-adding to home screen if truly stuck) |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| manifest/icon misconfiguration | PWA shell/install setup phase | Physical iPhone: Add to Home Screen, confirm correct icon + standalone (no address bar) launch |
| Storage eviction after inactivity | Data model/storage phase + empty-state UX phase | Documented as accepted risk; verify re-import flow is fast; (optional) leave app untouched 7+ days on a test device to observe real-world behavior |
| Audio gesture-unlock failures | Core playback phase | Physical iPhone, cold launch, first tap on play must start audio |
| Background/lock-screen playback stopping | Core playback phase (dedicated verification step) | Physical iPhone: lock screen for several minutes during playback, confirm audio continues and lock-screen controls work |
| IndexedDB transaction/versioning bugs | Storage/data-layer phase | Schema versioned from v1; transactions kept synchronous/short; QuotaExceededError explicitly handled in import flow |
| Cache API vs IndexedDB confusion | Service worker setup phase | Confirm service worker precache/runtime-cache config only targets static app-shell assets, never audio blobs |

## Sources

- MDN — Storage quotas and eviction criteria: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria (MEDIUM confidence, cross-checked)
- WebKit blog — Updates to Storage Policy: https://webkit.org/blog/14403/updates-to-storage-policy/ (referenced via search; direct fetch blocked by network egress policy, treat as MEDIUM)
- Apple Developer Forums — "Safari iOS PWA Data Persistence Beyond 7 Days": https://developer.apple.com/forums/thread/710157 (MEDIUM — official channel but community-answered, not an Apple doc)
- Apple Developer Forums — "iOS Audio Lockscreen Problem in PWA": https://developer.apple.com/forums/thread/762582 (MEDIUM)
- WebKit Bugzilla #261858 — "autoplay in audio element and media session controls not working in standalone web app (pwa) when playback ends": https://bugs.webkit.org/show_bug.cgi?id=261858 (HIGH — primary bug tracker)
- WebKit blog — "New <video> Policies for iOS": https://webkit.org/blog/6784/new-video-policies-for-ios/ (referenced via search; MEDIUM)
- gist.github.com/pesterhazy — "The pain and anguish of using IndexedDB: problems, bugs and oddities" (community-curated bug list with sourced references): https://gist.github.com/pesterhazy/4de96193af89a6dd5ce682ce2adff49a (MEDIUM, cross-checked against independent Safari-bug reporting)
- The Register — coverage of Safari 15 IndexedDB cross-origin leak and Safari 14.1.1 IndexedDB regression: https://www.theregister.com/2022/01/17/safari_15_indexeddb_bug/ and https://www.theregister.com/2021/06/16/apple_safari_indexeddb_bug (MEDIUM, journalistic secondary source citing FingerprintJS research)
- dbushell.com — "iOS Web Apps and Media Session API" (referenced via search results; direct fetch blocked by network egress policy — treat specific code-level claims as LOW/unverified until confirmed independently)
- Medium (firt.dev / Maximiliano Firtman) — "There is no Persistent Storage API on iOS" (referenced via search; direct fetch blocked; Firtman is a widely-cited independent PWA/mobile-web specialist, but treat as LOW confidence pending direct verification)
- GitHub — PWA-POLICE/pwa-bugs community bug list: https://github.com/PWA-POLICE/pwa-bugs (MEDIUM, community-curated)
- next-pwa GitHub issues (App Router / manifest registration problems): https://github.com/shadowwalker/next-pwa/issues/424 and repo README: https://github.com/shadowwalker/next-pwa (MEDIUM)
- Various community write-ups on autoplay/gesture restrictions (WebKit blog, bitmovin.com, webrtchacks.com) — consistent across independent sources (MEDIUM-HIGH via cross-checking)

**Note on research method:** Several primary-source URLs (webkit.org, dbushell.com, medium.com) could not be directly fetched due to network egress restrictions in this research environment; those findings are based on WebSearch result summaries/snippets rather than full-page verification. Recommend spot-checking the WebKit Bugzilla entry and Apple Developer Forum threads directly during implementation, and validating all playback/storage/eviction behaviors against a real physical iPhone before considering any related phase complete — simulator/desktop testing is explicitly insufficient for this domain (see Technical Debt Patterns).

---
*Pitfalls research for: iOS Safari installable PWA with local audio storage and playback*
*Researched: 2026-08-07*
