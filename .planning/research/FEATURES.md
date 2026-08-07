# Feature Research

**Domain:** Personal audiobook player (single-user PWA, on-device storage, iPhone/Safari)
**Researched:** 2026-08-07
**Confidence:** MEDIUM

## Context Note

This research is scoped specifically to what changes when you strip an audiobook player down to **one user, one device, no account, no store**. Commercial players (Audible, Apple Books, Libby, Pocket Casts, Overcast) bundle a lot of features that exist to serve DRM, catalog browsing, purchasing, or multi-device sync — none of which apply here. The goal is to identify the smaller set of *playback-mechanics* features that make a personal player pleasant to use daily, independent of the deferred items (chapters, speed, sleep timer, sync, accounts) which are already excluded.

## Feature Landscape

### Table Stakes (Users Expect These)

Features a personal build would regret skipping — not because "apps have them" but because daily use breaks down without them.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Skip forward/back by fixed increment (15s or 30s) | Precise re-listening (missed a sentence, dozed off) is the single most common in-book interaction. Dragging a scrub bar for this is annoying on a phone. Industry default is either 15s (Apple Books, Libby, BookBeat) or 30s (Audible) — no universal standard, but every mainstream app has *one* of these. | LOW | Two buttons around play/pause: `currentTime -= 15` / `currentTime += 15` (or 30). Pick one; don't build a settings screen for it in v1 — hardcode 15s or 30s. |
| Elapsed / remaining time display during playback | Without this, "how much is left" requires guessing from the scrub bar position. Core to the audiobook use case (long-form, session-based listening). | LOW | `duration - currentTime`, formatted `H:MM:SS`. Needs `duration` available, which requires metadata to load (see dependency notes). |
| Scrub bar / seek control | Users expect to jump to an arbitrary point (e.g., "I know roughly where I stopped"), not just step through with skip buttons. | LOW–MEDIUM | Standard `<input type="range">` bound to `currentTime`/`duration`, or custom draggable bar. Already implied by PROJECT.md's "seek forward/back." |
| Per-book progress indicator in the library list | With more than a couple of books in the library, the list itself needs to show "which ones am I mid-way through" and "how far" — otherwise every book looks identical until opened. | LOW | Simple: store `lastPosition` and `duration`, render a thin progress bar or "42% · 3h 10m left" per row. Depends on position-saving (already in scope) plus duration capture. |
| Automatic, frequent position saving (not just on pause/close) | iOS Safari can suspend or evict a PWA at any time (backgrounding, memory pressure, tab discard). If position is only saved on an explicit pause/close event, a crash or OS-initiated kill loses progress — directly undermines the stated Core Value ("resume exactly where you left off, every time"). | LOW–MEDIUM | Save on `pause`, on `beforeunload`/`visibilitychange`, and periodically (e.g., every 5–15s via `timeupdate` throttled) while playing. This is a refinement of the already-in-scope "save and restore playback position," not a new feature — but easy to under-build if only wired to the pause button. |
| Title/author identification per book (not raw filenames) | Personal libraries accumulate files with inconsistent names (`book1.mp3`, `Part_02_final.m4b`). A library that just lists filenames becomes hard to scan once it has more than ~5 books. | LOW (filename fallback) / MEDIUM (real tag parsing) | Cheapest version: let the user rename on import, or clean up the filename heuristically (strip extension, replace underscores). Fuller version: parse ID3/M4B metadata tags (title/author/cover) with a library like `music-metadata` or `jsmediatags`. Recommend starting with filename-based display and treating tag parsing as a fast-follow. |
| Reliable "resume where I left off" on reopening a book | Distinct from *saving* position — this is about the player correctly seeking to the saved position the moment a book is opened/loaded, every time, including after the PWA was fully closed and relaunched days later. | LOW–MEDIUM | Mechanically simple (seek `currentTime` on `loadedmetadata`), but must be tested against iOS Safari's storage-eviction behavior (see Pitfalls research) — this is the feature the whole app exists to deliver, so it deserves explicit UAT, not just an assumption that "IndexedDB persists." |

**Deliberately excluded from this table despite being common in commercial apps**, because the user already deferred them: variable playback speed, sleep timer, chapter navigation/markers.

### Differentiators (Competitive Advantage — Read: "Nice, Likely v1.x")

Not required for a usable v1, but each addresses a real friction point that will surface once the library grows past a handful of books, or once real-world files (which are messier than a single clean mp3) show up.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cover art display (extracted from file metadata) | Visual scanning of a library is much faster than reading text rows, especially on a small phone screen. | MEDIUM | Requires a tag-parsing library; fall back to a generic placeholder icon when no embedded art exists. |
| Multi-file / multi-track audiobook grouping (one "book" spans several audio files, e.g. `Part 1.mp3`...`Part 12.mp3`) | Many real-world audiobook files — especially anything ripped from CD or downloaded outside Audible — are distributed as a folder of numbered files, not one file per book. If the app only supports single-file import, a chunk of the user's actual collection won't fit the model cleanly. | MEDIUM–HIGH | Needs a data model change: a "book" becomes a list of tracks with continuous position tracking across track boundaries (so resume/skip work seamlessly across files). Worth flagging now even though deferred, because it affects the library data model chosen in v1 — retrofitting later is more painful than designing for it loosely from the start. |
| Library sort/search (by title, recently added, recently played) | Becomes useful once the library exceeds ~10–15 books; irrelevant at 3–5 books. | LOW | Simple client-side array sort/filter — no backend involved. |
| Background / lock-screen playback controls (MediaSession API: play/pause/skip from Control Center or lock screen) | Audiobooks are commonly listened to hands-free (walking, driving, chores) — needing to keep the app open and the screen unlocked to control playback is a real usability gap for that use case. | HIGH | Safari supports the MediaSession API for lock-screen controls, but iOS PWA background audio is documented as unreliable: playback can stop when the app is backgrounded, lock-screen controls are inconsistently shown, and paused audio in the background may stop functioning entirely after ~30s until the app is foregrounded again. This is a platform limitation (iOS Safari PWA specifically), not just an implementation cost — treat as an experiment/spike, not a guaranteed v1.x feature. |
| Storage usage indicator (how much of device storage the library consumes) | The user explicitly called out storage as a constraint (large files, deletion matters). Knowing "the library currently uses 4.2 GB" makes the deletion feature meaningful instead of a shot in the dark. | LOW–MEDIUM | `navigator.storage.estimate()` gives an approximate usage/quota; pair with per-book file size shown in the library list. |
| Bookmarks (multiple saved positions within a book, beyond the single auto-resume point) | Useful for "I want to re-find this specific passage later," distinct from the single continuous resume position. | LOW–MEDIUM | Deliberately adjacent to (but simpler than) the deferred "chapters" feature — a bookmark is just a named timestamp, no chapter-table parsing required. Could be a good, cheap v1.x add if resume-position alone feels insufficient in practice. |
| Import progress/feedback for large files | Audiobook files can be hundreds of MB; if IndexedDB writes take several seconds with no feedback, the import screen will look frozen/broken. | LOW | A simple spinner/progress bar tied to the file read + IndexedDB write is enough; no need for a full upload-manager UI. |

### Anti-Features (Deliberately Do Not Build)

These are standard in commercial audiobook apps but are actively pointless — or actively unwanted — for a personal, single-file-storage, single-user tool.

| Feature | Why Commercial Apps Have It | Why Problematic Here | Alternative |
|---------|------------------------------|----------------------|-------------|
| Store/purchase flow, catalog browsing | Core monetization path for Audible/Apple Books/Libby. | There's nothing to buy — files come from the user's own collection via the file picker. Building any of this is pure wasted effort and adds attack surface (payment, catalog data) for zero benefit. | File-picker import only, as already scoped. |
| User accounts / login / authentication | Needed to tie a purchased library and sync state to a person across devices. | Single device, single user, no server — there is no "who is logged in" concept to manage. Adding auth is complexity with no corresponding requirement. | None needed — PWA installed locally is the identity. |
| Multi-device sync (cloud position sync, cross-device library) | Lets a user start on phone, continue on desktop/car. | Explicitly out of scope per PROJECT.md — this is a single-iPhone tool by design; the moment sync exists, a backend/DB and conflict resolution logic exist too. | If ever needed later, treat as a distinct milestone with its own backend decision — not a bolt-on. |
| Social features (reviews, ratings, sharing "now listening," friend activity) | Engagement/retention mechanics for a commercial product with many users. | There is no other user to interact with. This is a solo tool. | None. |
| Recommendations / discovery ("you might also like") | Drives catalog engagement and upsell. | No catalog exists to recommend from — the "library" is exactly and only what the user manually imported. | None. |
| DRM / license management | Required by publishers for purchased commercial audio content. | Files are the user's own; there's no license to enforce, and adding DRM machinery would only get in the user's own way. | None — plain file storage. |
| Streaming from a remote server / CDN | Lets commercial apps avoid shipping huge files to every device and enables sync. | PROJECT.md explicitly chooses on-device storage, no backend, no network dependency for playback. Streaming would reintroduce exactly the server complexity that was deliberately avoided. | Local Blob storage in IndexedDB, as already decided. |
| Listening stats / streaks / achievements / leaderboards | Engagement/gamification for retention in a consumer product. | Nobody to compete with or report to; adds UI and state-tracking surface for a vanity feature with no user benefit here. | None. Progress-per-book (table stakes above) already answers "where am I," which is the only stat that matters. |
| Multi-user profiles (e.g., family sharing, kids' profiles) | Common in Audible/Libby for household accounts. | Single user by definition. | None. |

## Feature Dependencies

```
Skip forward/back (15/30s)
    └──requires──> Seek (already in scope)

Elapsed/remaining time display
    └──requires──> Duration metadata available (audio loadedmetadata event)

Per-book progress indicator (library list)
    └──requires──> Position-saving (in scope) + Duration metadata

Reliable auto-resume on reopen
    └──requires──> Library persistence across restarts (IndexedDB — already decided)
    └──requires──> Frequent/robust position saving (not just on explicit pause)

Cover art display
    └──requires──> Metadata tag parsing (differentiator)
        └──requires──> Title/author display (can ship without tag parsing, using filenames)

Multi-file/multi-track book grouping ──conflicts with── Simple "one file = one book" data model
    (if added later, requires reworking the book/track data model — cheaper to loosely
     accommodate a "book has N files" shape from the start than to retrofit)

Background/lock-screen playback (MediaSession API) ──enhances──> Skip forward/back, Play/pause
    (adds hands-free control surface to controls that already exist; does not gate them)

Storage usage indicator ──enhances──> Delete a book (in scope)
    (makes the existing delete feature meaningful by showing what's being reclaimed)

Bookmarks ──adjacent to, but does NOT require── Chapters (deferred)
    (a bookmark is a single manual timestamp; chapters require parsing a chapter table —
     do not let bookmark work bleed into chapter-parsing scope)
```

### Dependency Notes

- **Elapsed/remaining time and per-book progress both require duration metadata**, which is only available once the browser's audio element fires `loadedmetadata` (or, for some formats/containers, only after enough of the file has been read). This is a real dependency worth sequencing early — verify duration extraction works reliably across the user's actual file formats (mp3, m4b, m4a) before building UI on top of it.
- **Reliable auto-resume depends on more than IndexedDB persistence** — it depends on the app saving position *often enough* that an unexpected close (iOS backgrounding/eviction, browser tab discard) doesn't roll progress back meaningfully. Treat "save periodically while playing" as part of the core resume feature, not an optional enhancement.
- **Multi-file/multi-track book support conflicts with a naive "one file = one book" model.** Even though it's explicitly a v1.x/differentiator item, it's worth a five-minute design decision now (e.g., "a book has an array of one-or-more file references") so that adding multi-file support later doesn't require a data migration. This is a low-cost hedge, not a scope increase.
- **Background/lock-screen playback is the one differentiator with a real platform risk**, per current research: iOS Safari PWAs have documented issues with audio continuing reliably once backgrounded, and lock-screen controls appearing inconsistently. Recommend treating this as a spike/experiment rather than committing it to a roadmap phase with a fixed complexity estimate — the actual complexity depends on how well workarounds hold up on the target iOS version.
- **Bookmarks and chapters are easy to conflate** — both involve "a timestamp with a label" conceptually, but chapters require deriving a chapter table from the source file, which is explicitly deferred. If bookmarks are ever built, keep them a purely user-created, manual feature with no relationship to file-embedded chapter data.

## MVP Definition

### Launch With (v1)

This matches what's already active in PROJECT.md, refined by the table-stakes findings above:

- [ ] Import audio files via iOS file picker — already scoped
- [ ] Library view listing all imported audiobooks, persisted across app restarts — already scoped
- [ ] Play/pause — already scoped
- [ ] Skip forward/back by a fixed increment (recommend 15s, matching the more common default across Apple Books/Libby) — refines "seek forward/back" into a concrete, low-effort control
- [ ] Scrub bar for arbitrary seeking — refines "seek forward/back"
- [ ] Elapsed/remaining time display during playback — cheap, high-value, avoid skipping
- [ ] Per-book progress indicator in the library list — cheap, prevents an otherwise-identical-looking list of books
- [ ] Frequent automatic position saving (on pause, on visibility change, and periodically during playback) — this is what actually delivers the Core Value; a version that only saves on explicit pause is a regression risk
- [ ] Delete a book from the library — already scoped
- [ ] Title display using filename (cleaned up) as a minimum viable identification scheme — unblocks a usable library without requiring tag-parsing work

### Add After Validation (v1.x)

- [ ] Real metadata parsing (title/author/cover art from file tags) — once basic filename-based library is proven annoying in practice
- [ ] Multi-file/multi-track book support — once the user hits a real audiobook distributed as multiple files and the single-file model breaks down
- [ ] Library sort/search — once the library grows past ~10 books and scanning a flat list becomes tedious
- [ ] Storage usage indicator — once the user starts running into iOS storage pressure or wants to make deletion decisions with real numbers
- [ ] Bookmarks — if auto-resume-only proves insufficient for "I want to find this passage again"

### Future Consideration (v2+)

- [ ] Background/lock-screen playback controls (MediaSession API) — defer until there's confidence it can be made reliable on the target iOS version; treat as a spike before committing to a phase
- [ ] Chapters, variable playback speed, sleep timer — already explicitly deferred by the user in PROJECT.md
- [ ] Import progress feedback for very large files — only if large-file imports prove to feel broken/frozen in practice

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Skip forward/back (15s/30s) | HIGH | LOW | P1 |
| Scrub bar / seek | HIGH | LOW | P1 |
| Elapsed/remaining time display | HIGH | LOW | P1 |
| Per-book progress indicator | HIGH | LOW | P1 |
| Frequent auto-save of position | HIGH | LOW–MEDIUM | P1 |
| Filename-based title display | MEDIUM | LOW | P1 |
| Metadata tag parsing (title/author/cover) | MEDIUM | MEDIUM | P2 |
| Multi-file/multi-track book support | MEDIUM–HIGH (depends on user's actual files) | MEDIUM–HIGH | P2 |
| Library sort/search | LOW–MEDIUM | LOW | P2 |
| Storage usage indicator | MEDIUM | LOW–MEDIUM | P2 |
| Bookmarks | LOW–MEDIUM | LOW–MEDIUM | P3 |
| Background/lock-screen playback | HIGH (if it can be made reliable) | HIGH (platform-risk) | P3 |
| Import progress feedback | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch — these are the table stakes identified above
- P2: Should have, add when possible — differentiators with clear value and manageable cost
- P3: Nice to have, future consideration — either lower value, higher/uncertain cost, or platform risk

## Competitor Feature Analysis

| Feature | Audible | Apple Books (audiobooks) | Our Approach |
|---------|---------|---------------------------|--------------|
| Skip interval | 30s default, customizable 10–90s | 15s default, customizable (10/15/30/45/60s) | Hardcode one value (15s recommended) for v1 — no settings UI needed for a single user who can just get used to one number |
| Library organization | Cloud catalog, purchased titles, collections | Cloud library synced to Apple ID | Flat local list of imported files, sorted by recently-added by default |
| Resume position | Cross-device cloud sync | Cross-device cloud sync (iCloud) | Single-device, local IndexedDB — same *experience* (resume exactly where you left off) without any of the sync infrastructure |
| Purchasing/store | Core feature | Core feature (Apple Books Store) | Not built — no catalog exists |
| Chapters | Full chapter navigation | Full chapter navigation | Deferred by user decision |
| Speed control | Yes, prominent | Yes, prominent | Deferred by user decision |
| Sleep timer | Yes | Yes | Deferred by user decision |
| Lock-screen controls | Reliable (native app, full OS integration) | Reliable (native app, full OS integration) | Uncertain on iOS Safari PWA — treat as a v2+ spike, not an assumed feature |

## Sources

- [BookBeat: How do I forward or rewind in an audio book?](https://support.bookbeat.com/hc/en-gb/articles/360000723289-How-do-I-forward-or-rewind-in-an-audio-book) — MEDIUM confidence (web search, cross-checked against multiple app-specific sources agreeing on 15s vs 30s split)
- [iPhone Life: How to Change Skip Backward/Forward in Apple Books](https://www.iphonelife.com/content/how-to-change-how-far-you-skip-backward-and-forward-audio-books-ibooks) — MEDIUM confidence
- [Libby Help: Rewinding or fast-forwarding](https://help.libbyapp.com/en-us/6114.htm) — MEDIUM confidence
- [dbushell.com: iOS Web Apps and Media Session API](https://dbushell.com/2023/03/20/ios-pwa-media-session-api/) — MEDIUM confidence, corroborated by independent forum/bug reports on background-audio unreliability
- [Apple Developer Forums: iOS Audio Lockscreen Problem in PWA](https://developer.apple.com/forums/thread/762582) — MEDIUM confidence (developer-reported, consistent with other sources)
- [WebKit Bugzilla #261858: autoplay/media session controls not working in standalone PWA](https://bugs.webkit.org/show_bug.cgi?id=261858) — HIGH confidence for the specific bug it documents (primary source, WebKit issue tracker)
- Domain knowledge of Audible, Apple Books, Libby, Pocket Casts, Overcast feature sets (general product familiarity, not independently re-verified per app in this research pass)

---
*Feature research for: Personal audiobook player PWA (iPhone/Safari, single-user, on-device storage)*
*Researched: 2026-08-07*
