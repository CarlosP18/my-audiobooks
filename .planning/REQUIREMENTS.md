# Requirements: My Audiobooks

**Defined:** 2026-08-07
**Core Value:** Resume playback exactly where you left off, every time — reliably, offline, entirely on-device.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Install

- [x] **INST-01**: User can install the app to the iPhone home screen via Safari "Add to Home Screen"
- [x] **INST-02**: App launches in standalone mode (no browser chrome) when opened from the home screen
- [x] **INST-03**: App works fully offline once installed — no network dependency for core playback

### Import

- [ ] **IMPT-01**: User can import an audio file via the iOS file picker, regardless of format (mp3, m4b, m4a, etc.)
- [ ] **IMPT-02**: Imported file is copied into the app's internal storage, not just referenced

### Library

- [ ] **LIBR-01**: User can see a list of all imported audiobooks
- [ ] **LIBR-02**: Library persists across app restarts and device reboots
- [ ] **LIBR-03**: Library list shows a cleaned-up title derived from the filename (not the raw filename)
- [ ] **LIBR-04**: Library list shows per-book progress (percent complete or time remaining)
- [ ] **LIBR-05**: User can delete an audiobook from the library to free up storage

### Player

- [ ] **PLAY-01**: User can play and pause the current audiobook
- [ ] **PLAY-02**: User can skip backward/forward by a fixed 15-second increment
- [ ] **PLAY-03**: User can seek to an arbitrary point via a scrub bar
- [ ] **PLAY-04**: Player displays elapsed and remaining time for the current audiobook
- [ ] **PLAY-05**: Playback position is saved automatically and frequently — on pause, on visibility change, and periodically during playback (not only on explicit pause)
- [ ] **PLAY-06**: Reopening an audiobook resumes playback from the last saved position, including after the app was fully closed and relaunched later

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Metadata

- **META-01**: Library shows title/author/cover art parsed from embedded file tags (ID3/M4B) instead of the filename

### Library Management

- **LIBR2-01**: User can sort/search the library
- **LIBR2-02**: Library shows storage usage per book and in total

### Player

- **PLAY2-01**: User can save manual bookmarks within a book
- **PLAY2-02**: Background/lock-screen playback controls via the MediaSession API (spike first — documented iOS Safari PWA platform risk)

### Multi-File Books

- **MULT-01**: A single audiobook can span multiple audio files/tracks with continuous position tracking across them

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-device sync | Single-device personal tool by design — no backend or account system exists to sync through |
| User accounts / authentication | Single user, single device — there's no "who is logged in" concept to manage |
| Store / purchase flow, catalog browsing | Audiobooks come from the user's own collection via the file picker — nothing to buy or browse |
| Social features (reviews, sharing, activity) | Solo tool, no other users to interact with |
| Recommendations / discovery | No catalog exists to recommend from |
| DRM / license management | Files are the user's own — no license to enforce |
| Streaming from a remote server | On-device storage was deliberately chosen to avoid backend complexity and network dependency |
| Listening stats / streaks / achievements | No engagement mechanic needed for a personal single-user tool |
| Multi-user profiles | Single user by definition |
| Chapters (file-embedded chapter navigation) | Deferred by user decision |
| Variable playback speed | Deferred by user decision |
| Sleep timer | Deferred by user decision |
| Native iOS app (Swift/Xcode/App Store) | No Mac/Xcode available in the dev environment; PWA chosen for install speed and simplicity |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INST-01 | Phase 1 | Complete |
| INST-02 | Phase 1 | Complete |
| INST-03 | Phase 1 | Complete |
| IMPT-01 | Phase 2 | Pending |
| IMPT-02 | Phase 2 | Pending |
| LIBR-01 | Phase 2 | Pending |
| LIBR-02 | Phase 2 | Pending |
| LIBR-03 | Phase 2 | Pending |
| LIBR-04 | Phase 2 | Pending |
| LIBR-05 | Phase 2 | Pending |
| PLAY-01 | Phase 3 | Pending |
| PLAY-02 | Phase 3 | Pending |
| PLAY-03 | Phase 3 | Pending |
| PLAY-04 | Phase 3 | Pending |
| PLAY-05 | Phase 3 | Pending |
| PLAY-06 | Phase 3 | Pending |

**Coverage:**

- v1 requirements: 16 total
- Mapped to phases: 16 (Phase 1: 3, Phase 2: 7, Phase 3: 6)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-07*
*Last updated: 2026-08-07 after roadmap creation*
