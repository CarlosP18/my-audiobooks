# My Audiobooks

## What This Is

A personal Progressive Web App (PWA), installable on iPhone via "Add to Home Screen," that works like Audible but keeps every audio file on the device itself — no server, no account, no database. Carlos imports his own audiobook files, builds a personal library, and resumes playback exactly where he left off each time he reopens the app.

## Core Value

Resume playback exactly where you left off, every time — reliably, offline, entirely on-device.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Install as a PWA on iPhone via Safari "Add to Home Screen"
- [ ] Import audio files via the iOS file picker (any common audio format — mp3, m4b/m4a, etc.)
- [ ] Library view listing all imported audiobooks
- [ ] Playback screen: play/pause, seek forward/back
- [ ] Automatically save and restore playback position per audiobook
- [ ] Delete an audiobook from the library to free up storage
- [ ] Works fully offline once installed (no network dependency)

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
| Build as a PWA, not a native app | No Mac/Xcode available; installable via Safari without the App Store; fastest path to something usable | — Pending |
| No backend/database | Single user, files stay on-device, avoids server complexity and cost | — Pending |
| Store audio as Blobs in IndexedDB | Only browser storage mechanism that can hold large binary audio files alongside structured metadata (library, progress) | — Pending |
| Host on Vercel | Free, HTTPS out of the box, integrates cleanly with a Next.js app and GitHub | — Pending |

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
*Last updated: 2026-08-07 after initialization*
