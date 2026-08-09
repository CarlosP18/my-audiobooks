import Dexie, { type EntityTable } from "dexie";

// The single Dexie chokepoint for this app: every read and write against
// IndexedDB goes through the `db` export below — no other module opens
// IndexedDB directly. `blob` is deliberately absent from the v1 index
// string (Dexie only indexes string/number/Date/Array types, and indexing
// large binary data adds write cost for zero query benefit). See
// PITFALLS.md Pitfall 5 ("keep transactions short, don't index Blobs") and
// 02-RESEARCH.md Pattern 1/Pitfall 5 for the full rationale behind this
// single co-located table shape (Task 1 checkpoint, option-a).
export interface Book {
  id?: number; // auto-incrementing primary key (++id)
  blob: Blob; // the audio file's raw bytes — NOT indexed
  title: string; // cleaned title (D-04)
  filename: string; // original filename, kept for reference/debugging
  importedAt: number; // Date.now() at import time
  fileSize: number; // blob.size in bytes
  duration: number; // seconds, read via hidden <audio> at import (LIBR-04)
  // playback position in seconds. Every Phase 2 import writes 0 here —
  // this is the correct, honest boundary for this phase, not an
  // unfinished feature. Phase 3 is what advances it during playback.
  position: number;
}

const db = new Dexie("MyAudiobooksDB") as Dexie & {
  books: EntityTable<Book, "id">;
};

// v1 schema — only scalar/indexable fields are listed; `blob` is
// deliberately absent from the index string. MUST NOT be edited in place
// once real user data can exist: a later field/index change adds a new
// numbered version with an upgrade path instead.
db.version(1).stores({
  books: '++id, title, importedAt',
});

export { db };
