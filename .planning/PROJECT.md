# My Audiobooks

## What This Is

A personal Progressive Web App (PWA), installable on iPhone via "Add to Home Screen," that works like Audible but keeps every audio file on the device itself — no server, no account, no database. Carlos imports his own audiobook files, builds a personal library, and resumes playback exactly where he left off each time he reopens the app.

## Core Value

Resume playback exactly where you left off, every time — reliably, offline, entirely on-device.

## Requirements

### Validated

- [x] Install as a PWA on iPhone via Safari "Add to Home Screen" — Phase 1, confirmed on a physical iPhone
- [x] Works fully offline once installed (no network dependency) — Phase 1, confirmed on a physical iPhone in airplane mode
- [x] Import audio files via the iOS file picker (any common audio format — mp3, m4b/m4a, etc.) — Phase 2, confirmed on a physical iPhone
- [x] Library view listing all imported audiobooks — Phase 2, confirmed on a physical iPhone
- [x] Delete an audiobook from the library to free up storage — Phase 2, confirmed on a physical iPhone (incl. persistence across relaunch)

### Active

- [ ] Playback screen: play/pause, seek forward/back
- [ ] Automatically save and restore playback position per audiobook

### Out of Scope

- Multi-device sync — single device (personal iPhone) only, no backend/account needed
- Native iOS app (Swift/Xcode/App Store) — no Mac available in this environment; PWA chosen for speed and simplicity
- Chapters, variable playback speed, sleep timer — deferred, can add later once the basics work
- Cloud backup / streaming from a server — audio stays local to the device by design
- Multi-user / authentication — personal single-user app

## Context

- Target device: iPhone, Safari, installed as a home-screen PWA
- Files come from the user's own audiobook collection in varying formats; no assumption of a single format
- Audio files can be large (hundreds of MB each) — storage management (deletion) matters
- No backend/server needed for v1 — everything lives client-side (browser storage: IndexedDB for both files and metadata)
- Will be deployed to Vercel for a stable HTTPS URL to install from

## Constraints

- **Platform**: iPhone Safari only — no need for cross-browser or Android support
- **No native app**: environment has no Mac/Xcode access — must be a web-based PWA
- **No backend**: single personal user, avoid server/db complexity — client-side storage only
- **Storage**: iOS Safari PWA storage is not infinite and can in theory be evicted by the OS — acceptable risk for personal use; no backup/export required for v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build as a PWA, not a native app | No Mac/Xcode available; installable via Safari without the App Store; fastest path to something usable | Validated — Phase 1, installs and launches standalone on a real iPhone |
| No backend/database | Single user, files stay on-device, avoids server complexity and cost | Validated — Phase 2, import/library/delete all work entirely client-side |
| Store audio as Blobs in IndexedDB (single co-located `books` table, Blob unindexed) | Only browser storage mechanism that can hold large binary audio files alongside structured metadata (library, progress); co-locating the Blob with its metadata in one record means delete can never orphan storage | Validated — Phase 2, single-table Dexie v1 schema is a locked, one-way decision (changing it later needs a migration) |
| Host on Vercel | Free, HTTPS out of the box, integrates cleanly with a Next.js app and GitHub | Validated — Phase 1, live at https://my-audiobooks.vercel.app; connected via GitHub integration for continuous deployment since Phase 2 |
| Use inline styles (not Tailwind arbitrary-value classes) for the alert-dialog's fixed positioning | A Radix `AlertDialogContent` centered with `left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)]` rendered as a broken narrow right-edge strip on a physical iPhone PWA, not reproducible from source review; inline styles can't be dropped by any build step | Validated — Phase 2, re-tested on the same physical iPhone after the fix and confirmed correct |

## Current State

**Phase 2 (Import & Library) complete.** Carlos can import real `.mp3`/`.m4a`/`.m4b` files via the iOS file picker, see them appear in a library list with a cleaned title, progress bar, and placeholder row during import, swipe to delete with a confirmation dialog, and everything persists correctly across a full app relaunch — all confirmed on a physical iPhone. There is no player yet (position is always 0%); that's Phase 3 (Playback & Resume).

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-09 after Phase 2 completion*
