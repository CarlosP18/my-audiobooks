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
import { percentComplete, formatTimeRemaining } from "../lib/format.ts";

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
