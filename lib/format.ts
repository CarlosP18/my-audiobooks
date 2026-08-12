// Progress-line formatting for the LIBR-04 percent/time-remaining display,
// locked by 02-UI-SPEC.md's "Percent / time-remaining line" boundary rules
// and D-06's example. Lives in its own module (rather than inline in
// app/page.tsx) so it's mechanically testable from `node --test` without
// rendering React.
//
// Kept to plain functions/simple type annotations (no enums, namespaces,
// or parameter properties) so scripts/library-logic.test.mjs can import it
// directly under Node's built-in type stripping.

export function percentComplete(position: number, duration: number): number {
  if (!Number.isFinite(duration) || duration === 0) return 0;
  return Math.round((position / duration) * 100);
}

export function formatTimeRemaining(secondsRemaining: number): string {
  if (secondsRemaining < 60) return "<1m remaining";

  // Round to whole minutes BEFORE branching on the hour boundary — this is
  // deliberate: it prevents a 3599-second remainder (59.98min) rendering as
  // a nonsensical "59m" when it should round up into the hours form.
  const totalMinutes = Math.round(secondsRemaining / 60);

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m remaining`;
  }

  return `${totalMinutes}m remaining`;
}

// Symmetric with formatTimeRemaining above (03-UI-SPEC.md Layout step 4) —
// same rounding discipline, differing only in the trailing word, so the
// player's elapsed readout and the library row's remaining readout speak
// the same word-based, minute-granularity vocabulary.
export function formatElapsed(secondsElapsed: number): string {
  if (secondsElapsed < 60) return "<1m elapsed";

  // Round to whole minutes BEFORE branching on the hour boundary — same
  // reasoning as formatTimeRemaining's identical comment: prevents a
  // 3599-second value (59.98min) rendering as a nonsensical "59m" instead
  // of rounding up into the hours form.
  const totalMinutes = Math.round(secondsElapsed / 60);

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m elapsed`;
  }

  return `${totalMinutes}m elapsed`;
}
