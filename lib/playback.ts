// Pure, DOM-free, Dexie-free playback helpers for the player route
// (app/player/[id]/page.tsx). Lives in its own module — same reasoning as
// lib/format.ts's header comment — so this is mechanically testable from
// `node --test` with no React render and no <audio> element involved.
//
// Kept to plain functions and simple type annotations (no enums,
// namespaces, or parameter properties) so scripts/library-logic.test.mjs
// can import it directly under Node's built-in type stripping.

// D-02, locked (03-CONTEXT.md): position is written to IndexedDB at most
// once per 5 seconds during active playback, on top of the explicit
// pause / visibilitychange / unmount flush events, which always write
// immediately regardless of this throttle.
export const POSITION_SAVE_THROTTLE_MS = 5000;

// Returns true when enough time has elapsed since the last successful
// position write that a new one should happen. `lastSavedAtMs` of 0 is
// the "never saved yet this session" sentinel and always returns true,
// since any realistic `nowMs` (Date.now()) is far more than
// POSITION_SAVE_THROTTLE_MS past the epoch.
export function shouldPersist(lastSavedAtMs: number, nowMs: number): boolean {
  return nowMs - lastSavedAtMs >= POSITION_SAVE_THROTTLE_MS;
}

// PLAY-02, locked increment for both skip controls.
export const SKIP_SECONDS = 15;

// Bounds a candidate seek target between 0 and the book's duration,
// inclusive on both ends. Shared by the ±15s skip handlers and, from the
// other side of the same boundary, D-04's end-of-book terminal state —
// no handler can ever assign a negative or beyond-duration current time.
export function clampSeek(seconds: number, duration: number): number {
  return Math.min(Math.max(seconds, 0), duration);
}
