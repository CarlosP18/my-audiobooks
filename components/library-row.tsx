"use client";

// Renders one book: title, real progress bar, percent/time-remaining line.
// Task 3 (same plan) extends this file with the swipe-to-delete gesture and
// the delete confirmation dialog — this task only extracts the row shape
// Plan 02-01 proved inline in app/page.tsx.
import { Progress } from "@/components/ui/progress";
import { percentComplete, formatTimeRemaining } from "@/lib/format";
import type { Book } from "@/lib/db";

type LibraryRowProps = {
  book: Book;
};

export function LibraryRow({ book }: LibraryRowProps) {
  // Every Phase 2 import has position 0, so this always renders 0% fill and
  // a "0% — {full duration} remaining" line — the correct, honest state
  // until Phase 3 advances position. Computed from stored values, never
  // short-circuited to a constant.
  const percent = percentComplete(book.position, book.duration);
  const remaining = formatTimeRemaining(
    Math.max(book.duration - book.position, 0),
  );

  return (
    <li
      className="relative bg-[#171717] rounded-[8px] p-4 min-h-11 overflow-hidden"
      aria-label={book.title}
    >
      <p className="text-base leading-[1.5] text-[#F5F5F5] truncate">
        {book.title}
      </p>
      <Progress value={percent} className="my-2" />
      <p className="text-[14px] leading-[1.5] text-[#A3A3A3]">
        {percent}% — {remaining}
      </p>
    </li>
  );
}
