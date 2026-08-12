"use client";

// The player route (D-01): a dedicated Client Component screen for a
// single book, reached by tapping a library row. Task 1 wired the entire
// playback path end-to-end: id validation, the Dexie lookup, the
// blob-to-object-URL lifecycle, <audio> event wiring, throttled position
// persistence, and position restore on load. Task 2 (this revision) adds
// the three real rendering states (loading / not-found / populated) and
// the remaining visual chrome (artwork placeholder, clamped title).
//
// "use client" for the same reasons app/page.tsx is: useLiveQuery, refs
// for the <audio> element, and DOM event handlers all require it.
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, BookAudio } from "lucide-react";
import { db } from "@/lib/db";
import type { Book } from "@/lib/db";
import { shouldPersist, SKIP_SECONDS, clampSeek } from "@/lib/playback";
import { formatElapsed, formatTimeRemaining } from "@/lib/format";
import { TransportControls } from "@/components/player/transport-controls";
import { ScrubBar } from "@/components/player/scrub-bar";

// A module-level sentinel, distinct from any real query result (including
// `undefined`, which is itself a valid "book not found" result). Passed
// as useLiveQuery's defaultResult so the hook's return value can
// distinguish "first read still in flight" (LOADING) from "read settled,
// no such book" (undefined) — the same undefined-both-times ambiguity
// app/page.tsx doesn't have to solve because it has no not-found state.
const LOADING = Symbol("player-loading");

export default function PlayerPage() {
  const params = useParams<{ id: string }>();

  // T-03-01: validate the route param before it ever reaches Dexie. A
  // non-integer or non-positive id is treated identically to "no such
  // book" (03-RESEARCH.md Security Domain V5) — there's no separate
  // invalid-id path, only the not-found rendering below.
  const parsedId = Number(params.id);
  const bookId =
    Number.isInteger(parsedId) && parsedId > 0 ? parsedId : undefined;

  const queryResult = useLiveQuery(
    () => (bookId === undefined ? undefined : db.books.get(bookId)),
    [bookId],
    LOADING,
  );

  const isLoading = queryResult === LOADING;
  // Narrowed by the equality check above: anything that isn't the
  // sentinel is a settled result, either a Book or undefined (not found).
  const resolvedBook = isLoading ? undefined : queryResult;

  // useLiveQuery hands back a fresh object identity on every position
  // write (every 5s, D-02) — every book-derived effect below is keyed
  // ONLY on the book's own numeric id (resolvedBook?.id), never on the
  // whole record (03-RESEARCH.md Pitfall B). This ref lets those effects
  // read the latest resolved record (its blob, its id) without adding
  // the whole object to their dependency arrays — refs are exempt from
  // the exhaustive-deps rule, so this satisfies lint without weakening
  // the dependency array.
  const bookRef = useRef<Book | undefined>(undefined);
  // Refs must not be written during render (react-hooks/refs) — sync it
  // in its own effect, declared first so it runs before the effects
  // below in the same commit and they always read the current render's
  // value.
  useEffect(() => {
    bookRef.current = resolvedBook;
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Elapsed time in whole seconds, for the live readout (PLAY-04). Plan
  // 03's scrub bar thumb will also consume this same state — it must
  // track live playback, not the position field's 5-second-stale stored
  // copy from useLiveQuery.
  const [elapsed, setElapsed] = useState(0);
  // Tracks the last whole-second value the UI tick observed, so the tick
  // below only calls setElapsed when the rendered second actually
  // changes — roughly once per second, no timer, no re-render storm.
  const lastWholeSecondRef = useRef<number | null>(null);

  // Object URL lifecycle (03-RESEARCH.md Pattern 2 / Pitfall B): created
  // once per book id, revoked in this effect's own cleanup. This is
  // load-bearing — depending on the whole book object here would revoke
  // and recreate the URL every 5 seconds and cut off the <audio> element
  // mid-playback.
  useEffect(() => {
    const current = bookRef.current;
    if (!current) return;
    const url = URL.createObjectURL(current.blob);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [resolvedBook?.id]);

  // Restore the saved position once metadata loads. Setting `currentTime`
  // is a seek, not a play() call, so it is not subject to the iOS
  // gesture-unlock rule — safe to do here, without a tap, on cold
  // relaunch too (PLAY-06). Never call play()/pause() in this effect.
  useEffect(() => {
    const audio = audioRef.current;
    const current = bookRef.current;
    if (!audio || !current) return;

    function onLoadedMetadata() {
      const latest = bookRef.current;
      if (audio && latest) audio.currentTime = latest.position;
    }

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => audio.removeEventListener("loadedmetadata", onLoadedMetadata);
  }, [resolvedBook?.id]);

  // Initialize elapsed from the resolved record's stored position, so the
  // readout is correct on first render of a partially-listened book,
  // before the <audio> element has loaded metadata (PLAY-04).
  useEffect(() => {
    const current = bookRef.current;
    if (!current) return;
    setElapsed(Math.floor(current.position));
    lastWholeSecondRef.current = null;
  }, [resolvedBook?.id]);

  // Live UI tick (PLAY-04): updates the visible elapsed value roughly
  // once per second, deliberately independent of the 5-second database
  // -write throttle below — the visible text ticking and the durable
  // write are two different cadences with two different reasons
  // (03-UI-SPEC.md Layout step 4).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || resolvedBook?.id === undefined) return;

    function onTimeUpdate() {
      if (!audio) return;
      const wholeSecond = Math.floor(audio.currentTime);
      if (wholeSecond !== lastWholeSecondRef.current) {
        lastWholeSecondRef.current = wholeSecond;
        setElapsed(wholeSecond);
      }
    }

    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => audio.removeEventListener("timeupdate", onTimeUpdate);
  }, [resolvedBook?.id]);

  // Throttled position persistence (PLAY-05, D-02, 03-RESEARCH.md
  // Pattern 4). Every write names only the `position` field via Dexie's
  // partial-update call — never a whole-record write that would carry
  // the multi-hundred-MB audio Blob back through structured clone.
  useEffect(() => {
    const audio = audioRef.current;
    const current = bookRef.current;
    if (!audio || current?.id === undefined) return;

    let lastSavedAt = 0;

    function flush() {
      const latest = bookRef.current;
      if (!audio || latest?.id === undefined) return;
      db.books.update(latest.id, { position: audio.currentTime }).catch(() => {
        // Fire-and-forget, matching app/page.tsx's posture for Dexie
        // writes — a dropped position write is not fatal to playback.
      });
    }

    function onTimeUpdate() {
      const now = Date.now();
      if (shouldPersist(lastSavedAt, now)) {
        lastSavedAt = now;
        flush();
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flush();
    }

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("pause", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      // Flush once more on unmount/navigation away — this is what makes
      // navigating back to the library durable.
      flush();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("pause", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [resolvedBook?.id]);

  // Play state is driven by the element's own play/pause events, not the
  // tap handler, so the button's icon and aria-label stay truthful if the
  // element changes state for a reason other than a tap.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function onPlay() {
      setIsPlaying(true);
    }
    function onPause() {
      setIsPlaying(false);
    }

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [resolvedBook?.id]);

  // End-of-book terminal state (D-04, PLAY-06's prohibition counterpart):
  // when the element fires `ended`, the stored position is set to the
  // book's own duration through the same partial-field Dexie update path
  // Plan 01 established — never a whole-record write, never a value that
  // returns the book to the beginning. Playback simply stops; the
  // play/pause button reverts to Play through the play/pause listeners
  // above, which already drive that state from the element's own events.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || resolvedBook?.id === undefined) return;

    function onEnded() {
      const latest = bookRef.current;
      if (!audio || latest?.id === undefined) return;
      setElapsed(Math.floor(audio.duration));
      db.books.update(latest.id, { position: audio.duration }).catch(() => {
        // Fire-and-forget, matching this file's other Dexie writes.
      });
    }

    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [resolvedBook?.id]);

  function handleTogglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    // Synchronous, no await before this call. The object URL is already
    // assigned to `src` by the mount effect above, so there's nothing
    // left to wait for — the call sits directly in the tap event's own
    // call stack, which is what satisfies iOS Safari's gesture-unlock
    // rule (03-RESEARCH.md Pattern 2 / PITFALLS.md Pitfall 3).
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }

  // Both skip handlers stay synchronous — they run inside a tap and must
  // not introduce a promise boundary, same reason handleTogglePlay does
  // (03-RESEARCH.md Pattern 2). Every skip target is bounded by
  // clampSeek against the resolved record's own duration (PLAY-02,
  // T-03-05), and elapsed is set to the same clamped value immediately
  // so the readout responds without waiting for the next timeupdate.
  function handleSkipBack() {
    const audio = audioRef.current;
    const current = bookRef.current;
    if (!audio || !current) return;
    const target = clampSeek(audio.currentTime - SKIP_SECONDS, current.duration);
    audio.currentTime = target;
    setElapsed(Math.floor(target));
  }

  function handleSkipForward() {
    const audio = audioRef.current;
    const current = bookRef.current;
    if (!audio || !current) return;
    const target = clampSeek(audio.currentTime + SKIP_SECONDS, current.duration);
    audio.currentTime = target;
    setElapsed(Math.floor(target));
  }

  // ScrubBar (PLAY-03) owns the D-03 drag lifecycle itself; this handler
  // just keeps the page's own elapsed state in sync with the committed
  // seek, the same immediate-update discipline the skip handlers use.
  function handleSeek(seconds: number) {
    setElapsed(Math.floor(seconds));
  }

  const rootStyle = { paddingBottom: "max(24px, env(safe-area-inset-bottom))" };
  const backButton = (
    <Link
      href="/"
      aria-label="Back to library"
      className="-m-2.5 inline-flex min-h-11 min-w-11 items-center justify-center p-2.5"
    >
      <ChevronLeft size={24} className="text-[#F5F5F5]" aria-hidden="true" />
    </Link>
  );

  // Before the first read settles, render only the header — no spinner,
  // no flash of the not-found or populated state (matches the library
  // screen's identical `books === undefined` restraint, 02-UI-SPEC.md).
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-dvh" style={rootStyle}>
        <header className="px-6 pt-8">{backButton}</header>
      </div>
    );
  }

  // Settled with no record — a deleted book (LIBR-05) or a malformed id
  // that failed the Number.isInteger/positive check above render the
  // exact same state; the two outcomes are identical to a single-user
  // local app (03-RESEARCH.md Security Domain V5).
  if (resolvedBook === undefined) {
    return (
      <div className="flex flex-col min-h-dvh" style={rootStyle}>
        <header className="px-6 pt-8">{backButton}</header>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <h1 className="text-[20px] font-semibold leading-[1.2] text-[#F5F5F5]">
            Book not found
          </h1>
          <p className="text-base leading-[1.5] text-[#A3A3A3]">
            This audiobook may have been deleted. Go back to your library.
          </p>
          <Link href="/" className="text-base leading-[1.5] text-[#E8B34A]">
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh" style={rootStyle}>
      <header className="px-6 pt-8">{backButton}</header>

      <audio ref={audioRef} src={objectUrl ?? undefined} preload="metadata" />

      <div className="mt-12 px-6">
        <div className="mx-auto flex aspect-square w-full max-w-[240px] items-center justify-center rounded-[8px] bg-[#171717]">
          <BookAudio size={96} className="text-[#A3A3A3]" aria-hidden="true" />
        </div>
      </div>

      <h1
        className="mt-8 line-clamp-2 px-6 text-center text-[20px] font-semibold leading-[1.2] text-[#F5F5F5]"
        aria-label={resolvedBook.title}
      >
        {resolvedBook.title}
      </h1>

      {/* Scrub bar (PLAY-03, 03-UI-SPEC.md Layout step 4): D-03's
          pause-on-drag/seek-on-release lifecycle lives entirely inside
          ScrubBar. Thumb tracks the live `elapsed` state, not the stored
          `position` field, so it never lags behind the 5-second write
          cadence. */}
      <div className="mt-12 px-6">
        <ScrubBar
          audioRef={audioRef}
          duration={resolvedBook.duration}
          position={elapsed}
          onSeek={handleSeek}
        />
      </div>

      {/* Time readout (PLAY-04, 03-UI-SPEC.md Layout step 4). Both values
          share formatTimeRemaining's/formatElapsed's word-based,
          minute-granularity vocabulary — the library row's own phrasing
          — rather than raw mm:ss clock digits. */}
      <div className="mt-2 flex justify-between px-6 font-mono text-[14px] font-normal leading-[1.5] text-[#A3A3A3]">
        <span>{formatElapsed(elapsed)}</span>
        <span>
          {formatTimeRemaining(Math.max(resolvedBook.duration - elapsed, 0))}
        </span>
      </div>

      <div className="mt-12 px-6">
        <TransportControls
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onSkipBack={handleSkipBack}
          onSkipForward={handleSkipForward}
        />
      </div>
    </div>
  );
}
