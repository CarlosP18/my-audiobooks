"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { BookAudio } from "lucide-react";
import { db } from "@/lib/db";
import { importFile, ImportError } from "@/lib/import";
import type { ImportErrorReason } from "@/lib/import";
import { cleanTitle } from "@/lib/title";
import { ImportTrigger } from "@/components/import-trigger";
import { LibraryRow } from "@/components/library-row";
import { ImportPlaceholderRow } from "@/components/import-placeholder-row";
import { ImportErrorBanner } from "@/components/import-error-banner";

// The "My Library" screen, now composed from extracted components. This is
// the app's first client component (needed for useLiveQuery + the file
// input), evolving Plan 02-01's inline-row version rather than replacing
// it. The root container, header block, and empty-state JSX tree below are
// preserved verbatim from Phase 1 — only the empty-state body copy is now
// rendered as ImportTrigger's children (D-01), with zero visual change.
//
// Row rendering is delegated to components/library-row.tsx (real Progress
// bar, swipe-to-delete). The picker itself lives in
// components/import-trigger.tsx, shared between the empty-state tap target
// and the populated-state header Plus button.
//
// Plan 02-03 adds per-file orchestration: an in-flight placeholder row per
// picked file (D-02) and a single dismissible error banner (D-03). Both
// live in component state, not Dexie, so — per 02-UI-SPEC.md's Layout
// section, "Populated state (1+ books, including the transient placeholder
// row)" — the populated-state layout (header trigger + row list) renders
// whenever there is at least one persisted book OR at least one in-flight
// import; the empty state renders only when both counts are zero.

type InFlightImport = {
  id: number;
  title: string;
};

type ImportErrorState = {
  reason: ImportErrorReason;
  filename: string;
};

export default function LibraryPage() {
  // useLiveQuery() returns undefined on first read (both on the server,
  // where IndexedDB doesn't exist, and on the client's first render before
  // the async read resolves) — this identity is what keeps the SSR and
  // first client render in sync and avoids a hydration mismatch.
  const books = useLiveQuery(() =>
    db.books.orderBy('importedAt').reverse().toArray(),
  );

  const [inFlight, setInFlight] = useState<InFlightImport[]>([]);
  const [importError, setImportError] = useState<ImportErrorState | null>(
    null,
  );
  // Locally generated placeholder ids, not filenames — a multi-select can
  // legitimately contain two files with the same name from different
  // folders (Claude's Discretion #3 in 02-03-PLAN.md).
  const nextIdRef = useRef(0);

  function handleFilesPicked(files: FileList) {
    // Each picked file's pipeline starts independently right here — no
    // Promise.all, no shared await — so a slow or failing file neither
    // blocks nor rolls back its siblings (IMPT-01/02 concurrency).
    Array.from(files).forEach((file) => {
      const id = nextIdRef.current++;
      const title = cleanTitle(file.name);
      setInFlight((prev) => [...prev, { id, title }]);

      importFile(file)
        .then(() => {
          // A later success clears whatever error banner is currently
          // showing (02-UI-SPEC.md: "Banner auto-clears when the user
          // successfully imports a file afterward").
          setImportError(null);
        })
        .catch((err: unknown) => {
          // Banners do not stack or queue — the newest failure always
          // replaces whatever is currently shown.
          if (err instanceof ImportError) {
            setImportError({ reason: err.reason, filename: err.filename });
          } else {
            setImportError({ reason: "generic", filename: file.name });
          }
        })
        .finally(() => {
          setInFlight((prev) => prev.filter((entry) => entry.id !== id));
        });
    });
  }

  function dismissError() {
    setImportError(null);
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

  const hasRows = books.length > 0 || inFlight.length > 0;

  if (!hasRows) {
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
          {importError && (
            <div className="w-full px-6 pt-2">
              <ImportErrorBanner
                reason={importError.reason}
                filename={importError.filename}
                onDismiss={dismissError}
              />
            </div>
          )}
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
      {importError && (
        <div className="px-6 pt-4">
          <ImportErrorBanner
            reason={importError.reason}
            filename={importError.filename}
            onDismiss={dismissError}
          />
        </div>
      )}
      <ul className="flex-1 flex flex-col gap-2 px-6 pt-6 pb-8">
        {inFlight.map((entry) => (
          <ImportPlaceholderRow key={`placeholder-${entry.id}`} title={entry.title} />
        ))}
        {books.map((book) => (
          <LibraryRow key={book.id} book={book} />
        ))}
      </ul>
    </div>
  );
}
