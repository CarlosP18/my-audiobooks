// Import validation + write pipeline. The Dexie write in `importFile` is
// kept as a single tight `db.books.add()` call with no unrelated awaits
// interleaved between async prep (duration read, title cleanup) and the
// write itself — see 02-RESEARCH.md Pitfall 3 ("IndexedDB transactions in
// Safari can abort around await boundaries"). The write's catch block
// matches on both `QuotaExceededError` and `AbortError` because Dexie has
// been observed surfacing a full disk as either one depending on engine —
// see Pitfall 4.
import { db } from "@/lib/db";
import { cleanTitle } from "@/lib/title";
import { readAudioDuration } from "@/lib/duration";

export const ACCEPTED_EXTENSIONS = [".mp3", ".m4a", ".m4b"];

// Gate on the filename extension, not `file.type`: iOS Safari reports the
// MIME type for `.m4b` inconsistently (sometimes empty, sometimes
// video-flavored), so branching on it would reject genuine audiobooks
// (02-RESEARCH.md Pitfall 2).
export function isAcceptedAudioFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export class ImportError extends Error {}

export async function importFile(file: File): Promise<number> {
  if (!isAcceptedAudioFile(file)) {
    throw new ImportError(
      `Couldn't import "${file.name}" — only MP3, M4A, and M4B files are supported.`,
    );
  }

  // All async prep completes BEFORE the write — readAudioDuration rejects
  // (rather than resolving a fallback) on an unreadable/corrupted file, so
  // importFile never calls db.books.add() for a file with no valid
  // duration (02-UI-SPEC.md's Duration-read-failure resolution).
  let duration: number;
  try {
    duration = await readAudioDuration(file);
  } catch {
    throw new ImportError(
      `Couldn't import "${file.name}" — the file may be corrupted or unsupported.`,
    );
  }
  const title = cleanTitle(file.name);

  try {
    const id = await db.books.add({
      blob: file,
      title,
      filename: file.name,
      importedAt: Date.now(),
      fileSize: file.size,
      duration,
      position: 0,
    });
    // Book.id is typed optional (auto-generated primary key), but a
    // successful add() always assigns a real numeric id.
    return id as number;
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "QuotaExceededError" || err.name === "AbortError")
    ) {
      throw new ImportError(`Not enough storage to import "${file.name}".`);
    }
    throw new ImportError(`Couldn't import "${file.name}". Try again.`);
  }
}
