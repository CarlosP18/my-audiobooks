---
status: testing
phase: 03-playback-resume
source: [03-VERIFICATION.md]
started: 2026-08-12T01:40:00Z
updated: 2026-08-12T01:40:00Z
---

## Current Test

number: 1
name: Cold-launch gesture-unlock + 3-min stutter + force-quit/relaunch resume accuracy
expected: |
  (1) Audio starts on the FIRST tap, not the second, from a cold launch.
  (2) No audible stutter/gap/dropout on the ~5s write cadence during 3+ continuous
  minutes of a large real audiobook (150-300MB), and Safari does not reload the
  app for memory pressure. (3) Book reopens paused, within 5s of where it stopped,
  resumes from that point on tap — never restarts at 0:00, never auto-plays.
awaiting: user response

## Tests

### 1. Cold-launch gesture-unlock + 3-min stutter + force-quit/relaunch resume accuracy
expected: On a physical iPhone, with the app installed to the home screen: (1) launch it from the home-screen icon, tap an imported book, tap play ONCE from a cold launch. (2) Let it play >=3 continuous minutes using a large real audiobook file (150-300MB). (3) Press pause, force-quit from the app switcher, relaunch from the home-screen icon, reopen the same book. Expected: (1) Audio starts on the FIRST tap, not the second. (2) No audible stutter/gap/dropout on the ~5s write cadence, and Safari does not reload the app for memory pressure. (3) Book reopens paused, within 5s of where it stopped, resumes from that point on tap — never restarts at 0:00, never auto-plays.
result: [pending]

### 2. Long-title clamp / not-found state / no flash
expected: On a physical iPhone in the installed app: (1) open a book with a very long title. (2) Return to the library, swipe-delete a book, then use the browser back gesture to its player URL. (3) Watch the screen closely while opening any book. Expected: (1) Title wraps to at most 2 lines and ellipses, no overflow/collision. (2) "Book not found" block with the locked copy renders, Back to Library returns to the library. (3) No flash of "Book not found" or an empty player before real content appears.
result: [pending]

### 3. Time readout legibility and stability
expected: On a physical iPhone in the installed app, open a book already partway through and watch the readout line for ~90 seconds of playback. Expected: Both values legible in a monospaced face, visually distinct from surrounding Geist Sans. Elapsed climbs, remaining falls. Neither jitters, flickers, or shifts layout horizontally; the two do not collide on a narrow screen.
result: [pending]

### 4. Skip continuity, numeral legibility, end-of-book state
expected: On a physical iPhone in the installed app: (1) tap skip-back repeatedly at the very beginning, skip-forward repeatedly near the end. (2) Check the "15" numeral on both buttons at arm's length. (3) Let a short (~1 min) test book play to its end, return to the library. Expected: (1) Skipping never throws, never goes silent, never jumps past the end into a restart; audio keeps playing across skips. (2) Numeral legible, sits inside the arrow's open arc, no overlap with the arrowhead. (3) Book stops at the end and stays stopped; library row shows 100% complete and an under-one-minute remaining value, not 0%.
result: [pending]

### 5. Scrub bar: gesture-unlock resume, drag precision, tap-on-track, end-of-book recovery
expected: On a physical iPhone, app installed, large real audiobook loaded: (1) start playback, drag the scrub bar while playing, release. (2) Pause, then drag and release. (3) Drag slowly across the full bar width, watch the readout. (4) Tap once directly on the track away from the thumb. (5) Drag from near center; separately try to drag the page itself while touching the bar. (6) Play a short book to its end, drag the bar backward, release. Expected: (1) Audio quiets during drag, resumes from the released point with NO second tap, no stutter/restart-from-zero — OR the documented paused fallback if iOS refuses the resume call. (2) Book stays paused; thumb/readout show the new position; no audio starts. (3) Thumb tracks the finger smoothly, no lag/snap-back; elapsed/remaining reflect the dragged position. (4) Playback jumps to the tapped point. (5) Thumb is easy to grab/drag precisely; page does not scroll, no text selection appears. (6) Book plays again from the earlier point.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
