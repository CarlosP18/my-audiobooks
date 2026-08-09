---
status: testing
phase: 02-import-library
source: [02-VERIFICATION.md]
started: 2026-08-09T03:05:00Z
updated: 2026-08-09T03:05:00Z
---

## Current Test

number: 1
name: Import mp3/m4a/m4b end-to-end
expected: |
  Importing a real .mp3, .m4a, and .m4b file each produces a library row with a
  cleaned title and a plausible, non-zero progress line, with no manual refresh.
awaiting: user response

## Tests

### 1. Import mp3/m4a/m4b end-to-end
expected: Importing a real .mp3, .m4a, and .m4b file each produces a library row with a cleaned title and a plausible, non-zero progress line, with no manual refresh.
result: [pending]

### 2. Persistence across relaunch
expected: Force-quit and relaunch the installed app (ideally after a device reboot) — all previously imported books are still listed.
result: [pending]

### 3. Swipe-to-delete
expected: Swipe a row left — the Destructive delete panel reveals without scrolling the page. Tap Delete — the confirmation dialog shows the exact locked text: "Delete book: Remove '{title}' and free its storage? This can't be undone." Tap Cancel — book and list unchanged. Repeat and confirm — row vanishes immediately. Relaunch — deletion held.
result: [pending]

### 4. Import placeholder row
expected: Importing a large file shows a placeholder row immediately (cleaned title, spinner, "Importing…") that resolves into the real row with no visual jump — on both an empty and a populated library.
result: [pending]

### 5. Import failure banner
expected: Picking a non-audio file shows the correct dismissible error banner variant. Multi-selecting a valid + invalid file together banners only the invalid one. A successful import afterward clears the banner.
result: [pending]

### 6. Long title truncation
expected: A long filename-derived title truncates on a single line without resizing the row.
result: [pending]

### 7. Progress bar color + header import button
expected: The progress bar renders in the Accent amber token (#E8B34A). The header "Plus" import button appears only once the library is populated (not on the empty state, which uses the tappable body copy instead).
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
