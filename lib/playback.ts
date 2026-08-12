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
