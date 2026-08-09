"use client";

import { useRef } from "react";
import type { ChangeEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookAudio, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { importFile } from "@/lib/import";
import { percentComplete, formatTimeRemaining } from "@/lib/format";

// The "My Library" screen, now data-driven. This is the app's first client
// component (needed for useLiveQuery + the file input), evolving Phase 1's
// static empty-state layout rather than replacing it. The root container,
// header block, and empty-state JSX tree below are preserved verbatim from
// Phase 1 — only the empty-state body copy gains a tappable button wrapper
// (D-01) with zero visual change.
//
// Row rendering here is intentionally minimal: title + percent/time-
// remaining line only. Plan 02-02 extracts library-row.tsx and adds the
// real progress bar and swipe-to-delete; plan 02-03 adds the placeholder
// row and the inline error banner. Neither is added here.
const ACCEPT_HINT = "audio/mpeg,.mp3,audio/mp4,.m4a,.m4b";

export default function LibraryPage() {
  // useLiveQuery() returns undefined on first read (both on the server,
  // where IndexedDB doesn't exist, and on the client's first render before
  // the async read resolves) — this identity is what keeps the SSR and
  // first client render in sync and avoids a hydration mismatch.
  const books = useLiveQuery(() =>
    db.books.orderBy('importedAt').reverse().toArray(),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    fileInputRef.current?.click();
  }

  async function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;
    // Each selected file's import runs independently — one file's outcome
    // (success or failure) cannot block or roll back another's, per
    // Claude's Discretion #4 (multi-select) in 02-01-PLAN.md. Error
    // surfacing (D-03's inline banner) is wired in plan 02-03; this
    // tracer slice proves the happy path end-to-end.
    await Promise.all(
      Array.from(files).map((file) =>
        importFile(file).catch(() => {
          /* inline error banner arrives in plan 02-03 */
        }),
      ),
    );
    event.target.value = "";
  }

  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept={ACCEPT_HINT}
      multiple
      className="hidden"
      onChange={handleFilesSelected}
    />
  );

  if (books === undefined) {
    return (
      <div className="flex flex-col min-h-dvh">
        <header className="px-6 pt-8">
          <h1 className="text-[28px] font-semibold leading-[1.2] text-[#F5F5F5]">
            My Library
          </h1>
        </header>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="flex flex-col min-h-dvh">
        <header className="px-6 pt-8">
          <h1 className="text-[28px] font-semibold leading-[1.2] text-[#F5F5F5]">
            My Library
          </h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <BookAudio size={64} className="text-[#A3A3A3]" aria-hidden="true" />
          <h2 className="text-xl font-semibold leading-[1.2] text-[#F5F5F5]">
            No audiobooks yet
          </h2>
          <button
            type="button"
            onClick={openPicker}
            aria-label="Import audiobook"
            className="text-base leading-[1.5] text-[#A3A3A3] p-3 -m-3"
          >
            Import an audiobook to start listening.
          </button>
        </div>
        {hiddenFileInput}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <header className="px-6 pt-8 flex items-center justify-between">
        <h1 className="text-[28px] font-semibold leading-[1.2] text-[#F5F5F5]">
          My Library
        </h1>
        <button
          type="button"
          onClick={openPicker}
          aria-label="Import audiobook"
          className="p-[10px] -m-[10px]"
        >
          <Plus size={24} className="text-[#E8B34A]" aria-hidden="true" />
        </button>
      </header>
      <ul className="flex-1 flex flex-col gap-2 px-6 pt-6 pb-8">
        {books.map((book) => {
          const percent = percentComplete(book.position, book.duration);
          const remaining = formatTimeRemaining(
            Math.max(book.duration - book.position, 0),
          );
          return (
            <li
              key={book.id}
              className="bg-[#171717] rounded-[8px] p-4 min-h-11"
              aria-label={book.title}
            >
              <p className="text-base leading-[1.5] text-[#F5F5F5] truncate">
                {book.title}
              </p>
              <p className="text-[14px] leading-[1.5] text-[#A3A3A3]">
                {percent}% — {remaining}
              </p>
            </li>
          );
        })}
      </ul>
      {hiddenFileInput}
    </div>
  );
}
