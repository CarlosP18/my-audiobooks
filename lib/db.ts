import Dexie, { type EntityTable } from "dexie";

// The single Dexie chokepoint for this app: every read and write against
// IndexedDB goes through the exports below — no other module opens
// IndexedDB directly.
//
// v2 SCHEMA SPLIT (Phase 3 production fix): v1 co-located the audio Blob
// and frequently-written metadata (position) in one `books` record. Under
// real-device conditions this meant every 5-second position write during
// playback re-touched the same record that also carried a 150-300MB Blob,
// and IndexedDB serializes same-store transactions — so that write could
// block the very next read (reopening the library, opening another book),
// appear to freeze the UI, delay the play button past the point where a
// tap still counts as a fresh user gesture on iOS, and lose the position
// write entirely if the app was killed before a slow write committed.
// This is exactly what ARCHITECTURE.md's original Anti-Pattern 1 warned
// against; the v1 single-table shape was a locked decision that turned
// out to be wrong under load and is corrected here, not worked around.
//
// `books` now holds ONLY small, frequently-written metadata. `blobs` holds
// ONLY the audio Blob, written once at import and read once per player
// session — never touched by a position write again.
export interface BookMeta {
  id?: number; // auto-incrementing primary key (++id)
  title: string; // cleaned title (D-04)
  filename: string; // original filename, kept for reference/debugging
  importedAt: number; // Date.now() at import time
  fileSize: number; // blob.size in bytes
  duration: number; // seconds, read via hidden <audio> at import (LIBR-04)
  position: number; // playback position in seconds (PLAY-05/06)
}

export interface BookBlob {
  id?: number; // matches the owning BookMeta.id — not auto-incrementing,
  // always set explicitly on insert so the two tables share a primary key.
  blob: Blob;
}

// Joined shape for callers (the player) that need both the metadata and
// the audio bytes together. Never stored as-is; assembled by
// getBookWithBlob() from the two tables below.
export interface Book extends BookMeta {
  blob: Blob;
}

const db = new Dexie("MyAudiobooksDB") as Dexie & {
  books: EntityTable<BookMeta, "id">;
  blobs: EntityTable<BookBlob, "id">;
};

// v1 schema — retained verbatim for existing installs to upgrade from.
// MUST NOT be edited in place.
db.version(1).stores({
  books: "++id, title, importedAt",
});

// v2 schema — splits `blob` out of `books` into its own table (see comment
// above). The upgrade migrates every existing record: the Blob moves into
// `blobs` keyed by the same id, and the metadata record is rewritten
// without the `blob` field. Runs once, automatically, the first time an
// upgraded app opens an existing v1 database.
db.version(2)
  .stores({
    books: "++id, title, importedAt",
    blobs: "id",
  })
  .upgrade(async (tx) => {
    const rows = await tx.table("books").toArray();
    for (const row of rows) {
      if (row.blob) {
        await tx.table("blobs").put({ id: row.id, blob: row.blob });
        const meta = { ...row };
        delete meta.blob;
        await tx.table("books").put(meta);
      }
    }
  });

// Assembles the joined Book shape the player needs. Returns undefined if
// either half is missing (a deleted book, or a malformed/stale id) — the
// player route treats that identically to "not found" either way.
export async function getBookWithBlob(id: number): Promise<Book | undefined> {
  const meta = await db.books.get(id);
  if (!meta) return undefined;
  const blobRecord = await db.blobs.get(id);
  if (!blobRecord) return undefined;
  return { ...meta, blob: blobRecord.blob };
}

// Writes both halves atomically in one IndexedDB transaction, so an import
// can never leave metadata without its Blob or vice versa.
export async function addBook(input: {
  blob: Blob;
  title: string;
  filename: string;
  importedAt: number;
  fileSize: number;
  duration: number;
}): Promise<number> {
  return db.transaction("rw", db.books, db.blobs, async () => {
    const id = await db.books.add({
      title: input.title,
      filename: input.filename,
      importedAt: input.importedAt,
      fileSize: input.fileSize,
      duration: input.duration,
      position: 0,
    });
    await db.blobs.put({ id: id as number, blob: input.blob });
    return id as number;
  });
}

// Deletes both halves atomically — the single call sites in
// components/library-row.tsx used to rely on the v1 single-record delete
// for this guarantee; the transaction here preserves it across two tables.
export async function deleteBook(id: number): Promise<void> {
  await db.transaction("rw", db.books, db.blobs, async () => {
    await db.books.delete(id);
    await db.blobs.delete(id);
  });
}

export { db };
