// Dependency-free node:test gate for the LIBR-03 title-cleanup rule (D-04)
// and the LIBR-04 time-remaining boundary rules (D-06 / 02-UI-SPEC.md).
// Uses only Node built-ins — node:test and node:assert/strict — imported
// via relative .ts paths, which Node 22.22 strips at load with no flag,
// transpiler, or dependency (verified at plan time).
//
// Deliberately does NOT import lib/db.ts, lib/import.ts, or
// lib/duration.ts: those pull in Dexie and DOM globals that don't exist
// in a bare Node process, and none of their logic is under test here.
//
// Every expected string below is asserted exactly (not pattern-matched),
// so a copy change in 02-UI-SPEC.md's contract fails loudly instead of
// silently passing a loose regex.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTitle } from "../lib/title.ts";
import {
  percentComplete,
  formatTimeRemaining,
  formatElapsed,
} from "../lib/format.ts";
import { shouldPersist } from "../lib/playback.ts";

// --- cleanTitle (D-04) ---

test("cleanTitle strips extension, replaces separators, and Title Cases (D-04 locked example)", () => {
  assert.equal(cleanTitle("the_great_gatsby-01.mp3"), "The Great Gatsby 01");
});

test("cleanTitle collapses repeated separators and mixed case to single spaces, Title Cased", () => {
  assert.equal(
    cleanTitle("MY__book---TITLE_02.m4b"),
    "My Book Title 02",
  );
});

test("cleanTitle with no extension and no separators returns it Title Cased, otherwise unchanged", () => {
  assert.equal(cleanTitle("audiobook"), "Audiobook");
});

// --- formatTimeRemaining (D-06 / 02-UI-SPEC.md boundary rules) ---

test("formatTimeRemaining renders the 5h30m worked example (19800s)", () => {
  assert.equal(formatTimeRemaining(19800), "5h 30m remaining");
});

test("formatTimeRemaining renders the 2h15m example from D-06 (8100s)", () => {
  assert.equal(formatTimeRemaining(8100), "2h 15m remaining");
});

test("formatTimeRemaining renders the 45m minutes-only worked example (2700s)", () => {
  assert.equal(formatTimeRemaining(2700), "45m remaining");
});

test("formatTimeRemaining renders the under-one-minute form (59s)", () => {
  assert.equal(formatTimeRemaining(59), "<1m remaining");
});

test("formatTimeRemaining rounds 3599s up into the hours form rather than a 60-minute value", () => {
  assert.equal(formatTimeRemaining(3599), "1h 0m remaining");
});

// --- percentComplete ---

test("percentComplete(0, 19800) is 0", () => {
  assert.equal(percentComplete(0, 19800), 0);
});

test("percentComplete(0, 0) is 0 rather than NaN", () => {
  assert.equal(percentComplete(0, 0), 0);
});

// --- formatElapsed (PLAY-04 / 03-UI-SPEC.md Layout step 4, symmetric with
// formatTimeRemaining above) ---

test("formatElapsed renders the under-one-minute form (59s)", () => {
  assert.equal(formatElapsed(59), "<1m elapsed");
});

test("formatElapsed renders the minutes-only worked example (2700s)", () => {
  assert.equal(formatElapsed(2700), "45m elapsed");
});

test("formatElapsed renders the 2h15m hours form (8100s)", () => {
  assert.equal(formatElapsed(8100), "2h 15m elapsed");
});

test("formatElapsed renders the 5h30m hours form (19800s)", () => {
  assert.equal(formatElapsed(19800), "5h 30m elapsed");
});

test("formatElapsed renders the 20m left-hand side of the UI spec's worked example (1200s)", () => {
  assert.equal(formatElapsed(1200), "20m elapsed");
});

test("formatElapsed rounds 3599s up into the hours form rather than a 60-minute value", () => {
  assert.equal(formatElapsed(3599), "1h 0m elapsed");
});

test("formatElapsed renders the under-one-minute form at the very start (0s)", () => {
  assert.equal(formatElapsed(0), "<1m elapsed");
});

// --- shouldPersist (D-02 / PLAY-05 locked 5-second throttle) ---

test("shouldPersist returns false when the elapsed gap is below the 5000ms threshold", () => {
  assert.equal(shouldPersist(1000, 4000), false);
});

test("shouldPersist returns true when the elapsed gap is exactly 5000ms", () => {
  assert.equal(shouldPersist(0, 5000), true);
});

test("shouldPersist returns true when the elapsed gap is above 5000ms", () => {
  assert.equal(shouldPersist(0, 5001), true);
});

test("shouldPersist returns true for the first-write sentinel (lastSavedAtMs = 0)", () => {
  assert.equal(shouldPersist(0, 10000), true);
});
