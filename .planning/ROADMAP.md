# Roadmap: My Audiobooks

## Overview

My Audiobooks ships as three vertical slices, each one a fully usable increment on a real iPhone. Phase 1 proves the riskiest platform assumption first — that the app can actually be installed to the home screen and launched standalone, offline — before any product feature is built on top of it. Phase 2 turns that shell into a real personal library: importing files from the iOS file picker, copying them into on-device storage, and showing a persistent, manageable list of books. Phase 3 delivers the app's entire reason for existing — a player with full transport controls that reliably remembers and restores playback position, even across a full app close and relaunch. By the end of Phase 3, Carlos can import his own audiobooks, close the app, walk away, and come back days later to exactly where he left off.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Install & Offline App Shell** - Installable, standalone, offline-launching PWA shell on iPhone (completed 2026-08-08)
- [ ] **Phase 2: Import & Library** - Import audiobook files and manage a persistent on-device library
- [ ] **Phase 3: Playback & Resume** - Full playback controls with reliable auto-resume — the app's core value

## Phase Details

### Phase 1: Install & Offline App Shell

**Goal**: User can install the app to their iPhone home screen and launch it as a standalone, offline-capable app shell.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: INST-01, INST-02, INST-03
**Success Criteria** (what must be TRUE):

  1. From Safari, the user can use "Add to Home Screen" and a correctly branded icon (not a generic or broken icon) appears on the iPhone home screen.
  2. Launching the app from the home-screen icon opens it in standalone mode, with no Safari address bar or browser chrome visible.
  3. With the device in airplane mode, opening the installed app still loads the app shell successfully instead of showing a browser offline error.

**Plans:** 2/2 plans complete

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold the repo and render the branded, installable "My Library" shell with every iOS manifest/icon/meta prerequisite (INST-01, INST-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Add the Serwist offline service worker, deploy to the HTTPS origin, and verify install/standalone/airplane-mode on a real iPhone (INST-01, INST-02, INST-03)

**UI hint**: yes

### Phase 2: Import & Library

**Goal**: User can import their own audiobook files and manage a persistent, on-device library of them.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: IMPT-01, IMPT-02, LIBR-01, LIBR-02, LIBR-03, LIBR-04, LIBR-05
**Success Criteria** (what must be TRUE):

  1. From the library screen, the user can pick an audio file (mp3, m4a, m4b, or other common format) via the iOS file picker, and it appears in the library once import completes.
  2. Closing the app fully and reopening it later (including after a device reboot) still shows every previously imported book in the library, fully playable — the file itself was copied into app storage, not just referenced.
  3. Each book in the library screen shows a cleaned-up, human-readable title derived from its filename, not the raw filename.
  4. Each book in the library screen shows a progress indicator (percent complete or time remaining).
  5. The user can delete a book from the library screen, freeing its storage, and it disappears from the list immediately.

**Plans:** 1/3 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Import one file end-to-end into a persistent library: Dexie schema, title cleanup, duration read, and a data-driven library screen (IMPT-01, IMPT-02, LIBR-01, LIBR-02, LIBR-03, LIBR-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-02-PLAN.md — Real library row and swipe-to-delete: hand-vendored Radix alert-dialog and progress, truncating titles, and a delete that frees storage (LIBR-01, LIBR-03, LIBR-04, LIBR-05)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 02-03-PLAN.md — Honest import reporting: in-flight placeholder rows and the four-variant inline failure banner (IMPT-01, IMPT-02, LIBR-01)

**UI hint**: yes

### Phase 3: Playback & Resume

**Goal**: User can play any imported audiobook with full transport controls, and playback always resumes exactly where they left off — delivering the app's core value.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, PLAY-06
**Success Criteria** (what must be TRUE):

  1. From the player screen, the user can play and pause the current audiobook.
  2. The user can skip backward or forward by a fixed 15-second increment.
  3. The user can drag a scrub bar to seek to any arbitrary point in the audiobook.
  4. The player screen displays elapsed and remaining time that updates as playback progresses.
  5. Playback position is saved automatically and frequently — on pause, on backgrounding/visibility change, and periodically during playback — so reopening a book after fully closing and relaunching the app resumes playback from very close to the last position.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Install & Offline App Shell | 2/2 | Complete    | 2026-08-08 |
| 2. Import & Library | 1/3 | In Progress|  |
| 3. Playback & Resume | 0/TBD | Not started | - |
