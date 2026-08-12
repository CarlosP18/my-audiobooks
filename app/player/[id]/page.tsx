"use client";

// The player route (D-01): a dedicated Client Component screen for a
// single book, reached by tapping a library row. This task (03-01) wires
// the entire playback path end-to-end on one route: id validation, the
// Dexie lookup, the blob-to-object-URL lifecycle, <audio> event wiring,
// throttled position persistence, and position restore on load. The
// loading shell, the not-found state, the artwork placeholder, and the
// title's line-clamp are 03-02's job (Task 2 of this plan) — until then
// an unresolved or invalid id renders nothing below the header.
//
// "use client" for the same reasons app/page.tsx is: useLiveQuery, refs
// for the <audio> element, and DOM event handlers all require it.
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import type { Book } from "@/lib/db";
import { shouldPersist } from "@/lib/playback";
import { TransportControls } from "@/components/player/transport-controls";

export default function PlayerPage() {
  const params = useParams<{ id: string }>();

  // T-03-01: validate the route param before it ever reaches Dexie. A
  // non-integer or non-positive id is treated the same as "no such
  // book" (03-RESEARCH.md Security Domain V5) — there's no separate
  // invalid-id path, only the not-found rendering 03-02 adds.
  const parsedId = Number(params.id);
  const bookId =
    Number.isInteger(parsedId) && parsedId > 0 ? parsedId : undefined;

  const book = useLiveQuery(
    () => (bookId === undefined ? undefined : db.books.get(bookId)),
    [bookId],
  );

  // useLiveQuery hands back a fresh object identity on every position
  // write (every 5s, D-02) — every book-derived effect below is keyed
  // ONLY on the book's own numeric id (book?.id), never on `book` itself
  // (03-RESEARCH.md Pitfall B). This ref lets those effects read the
  // latest resolved record (its blob, its id) without adding the whole
  // `book` object to their dependency arrays — refs are exempt from the
  // exhaustive-deps rule, so this satisfies lint without weakening the
  // dependency array.
  const bookRef = useRef<Book | undefined>(undefined);
  // Refs must not be written during render (react-hooks/refs) — sync it
  // in its own effect, declared first so it runs before the effects
  // below in the same commit and they always read the current render's
  // value.
  useEffect(() => {
    bookRef.current = book;
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Object URL lifecycle (03-RESEARCH.md Pattern 2 / Pitfall B): created
  // once per book id, revoked in this effect's own cleanup. This is
  // load-bearing — depending on the whole `book` object here would
  // revoke and recreate the URL every 5 seconds and cut off the <audio>
  // element mid-playback.
  useEffect(() => {
    const current = bookRef.current;
    if (!current) return;
    const url = URL.createObjectURL(current.blob);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [book?.id]);

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
  }, [book?.id]);

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
  }, [book?.id]);

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
  }, [book?.id]);

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

  return (
    <div
      className="flex flex-col min-h-dvh"
      style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
    >
      <header className="px-6 pt-8">
        <Link
          href="/"
          aria-label="Back to library"
          className="-m-2.5 inline-flex min-h-11 min-w-11 items-center justify-center p-2.5"
        >
          <ChevronLeft
            size={24}
            className="text-[#F5F5F5]"
            aria-hidden="true"
          />
        </Link>
      </header>

      {book && (
        <>
          <audio ref={audioRef} src={objectUrl ?? undefined} preload="metadata" />
          <h1
            className="mt-8 px-6 text-center text-[20px] font-semibold leading-[1.2] text-[#F5F5F5]"
            aria-label={book.title}
          >
            {book.title}
          </h1>
          <div className="mt-12 px-6">
            <TransportControls
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
            />
          </div>
        </>
      )}
    </div>
  );
}
