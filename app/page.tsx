"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { BookAudio } from "lucide-react";
import { db } from "@/lib/db";
import { importFile } from "@/lib/import";
import { ImportTrigger } from "@/components/import-trigger";
import { LibraryRow } from "@/components/library-row";

// The "My Library" screen, now composed from extracted components. This is
// the app's first client component (needed for useLiveQuery + the file
// input), evolving Plan 02-01's inline-row version rather than replacing
// it. The root container, header block, and empty-state JSX tree below are
// preserved verbatim from Phase 1 — only the empty-state body copy is now
// rendered as ImportTrigger's children (D-01), with zero visual change.
//
// Row rendering is now delegated to components/library-row.tsx (real
// Progress bar, swipe-to-delete). The picker itself lives in
// components/import-trigger.tsx, shared between the empty-state tap target
// and the populated-state header Plus button. Plan 02-03 adds the
// placeholder row and the inline error banner — neither is added here.
export default function LibraryPage() {
  // useLiveQuery() returns undefined on first read (both on the server,
  // where IndexedDB doesn't exist, and on the client's first render before
  // the async read resolves) — this identity is what keeps the SSR and
  // first client render in sync and avoids a hydration mismatch.
  const books = useLiveQuery(() =>
    db.books.orderBy('importedAt').reverse().toArray(),
  );

  async function handleFilesPicked(files: FileList) {
    // Each selected file's import runs independently — one file's outcome
    // (success or failure) cannot block or roll back another's, per
    // Claude's Discretion #4 (multi-select) in 02-01-PLAN.md. Error
    // surfacing (D-03's inline banner) is wired in plan 02-03; this plan
    // proves the row/progress/delete slice on top of the happy path.
    await Promise.all(
      Array.from(files).map((file) =>
        importFile(file).catch(() => {
          /* inline error banner arrives in plan 02-03 */
        }),
      ),
    );
  }

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
          <ImportTrigger variant="empty" onFilesPicked={handleFilesPicked}>
            Import an audiobook to start listening.
          </ImportTrigger>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <header className="px-6 pt-8 flex items-center justify-between">
        <h1 className="text-[28px] font-semibold leading-[1.2] text-[#F5F5F5]">
          My Library
        </h1>
        <ImportTrigger variant="header" onFilesPicked={handleFilesPicked} />
      </header>
      <ul className="flex-1 flex flex-col gap-2 px-6 pt-6 pb-8">
        {books.map((book) => (
          <LibraryRow key={book.id} book={book} />
        ))}
      </ul>
    </div>
  );
}
