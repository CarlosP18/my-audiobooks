"use client";

// Renders one book: title, real progress bar, percent/time-remaining line,
// and swipe-to-delete (D-07/D-08/LIBR-05). No gesture library — plain
// touch-event handlers on the row container, per 02-02-PLAN.md Task 3.
import { useRef, useState } from "react";
import type { MouseEvent, TouchEvent } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { deleteBook } from "@/lib/db";
import { percentComplete, formatTimeRemaining } from "@/lib/format";
import type { BookMeta } from "@/lib/db";

// 02-02-PLAN.md Claude's Discretion #3: 48px latch threshold, 96px panel
// width — comfortably holds the Trash2 icon plus the "Delete" label at a
// 44px-plus tap target.
const PANEL_WIDTH = 96;
const SWIPE_LATCH_THRESHOLD = 48;

type LibraryRowProps = {
  book: BookMeta;
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

  // Swipe state (D-07): translateX 0 = resting, -PANEL_WIDTH = latched
  // open. touchStart/Y and the dragging flag are refs (not state) since
  // they're read-then-discarded per gesture, not rendered directly.
  const [panelOpen, setPanelOpen] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  function closePanel() {
    setPanelOpen(false);
    setDragX(null);
  }

  function handleTouchStart(event: TouchEvent<HTMLLIElement>) {
    const touch = event.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isDragging.current = false;
  }

  function handleTouchMove(event: TouchEvent<HTMLLIElement>) {
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    if (!isDragging.current) {
      // Suppress the gesture when the vertical delta dominates, so the
      // swipe never fights the page's own scrolling.
      if (Math.abs(deltaY) >= Math.abs(deltaX)) return;
      isDragging.current = true;
    }

    const base = panelOpen ? -PANEL_WIDTH : 0;
    const next = Math.min(0, Math.max(-PANEL_WIDTH, base + deltaX));
    setDragX(next);
  }

  function handleTouchEnd() {
    if (!isDragging.current) {
      isDragging.current = false;
      return;
    }
    isDragging.current = false;
    const finalX = dragX ?? (panelOpen ? -PANEL_WIDTH : 0);
    if (finalX <= -SWIPE_LATCH_THRESHOLD) {
      setPanelOpen(true);
    } else {
      setPanelOpen(false);
    }
    setDragX(null);
  }

  function handleForegroundClick(event: MouseEvent<HTMLAnchorElement>) {
    // Touching anywhere else in the row while the panel is revealed closes
    // it without deleting anything — and, now that the foreground is a
    // navigation link to the player (D-01), without navigating either.
    if (panelOpen) {
      event.preventDefault();
      closePanel();
    }
  }

  async function handleDelete() {
    if (book.id === undefined) return;
    // deleteBook is idempotent — no existence check needed. It removes the
    // Blob and metadata together in one transaction (lib/db.ts), so it can
    // never orphan storage even though they now live in separate tables.
    // useLiveQuery re-renders the list on its own; no manual
    // refetch/optimistic removal.
    await deleteBook(book.id);
  }

  const translateX = dragX ?? (panelOpen ? -PANEL_WIDTH : 0);

  return (
    <li
      className="relative rounded-[8px] min-h-11 overflow-hidden"
      aria-label={book.title}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Revealed delete action panel (D-07) — right-aligned, full row
          height, Destructive background. This is the ONLY place a delete
          icon exists in the row; there is no permanently-visible delete
          icon at rest. It is also the AlertDialogTrigger — deletion is
          unreachable without the confirmation below. */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-[#DC2626]"
        style={{ width: PANEL_WIDTH }}
      >
        <AlertDialog
          onOpenChange={(open) => {
            if (!open) closePanel();
          }}
        >
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="flex h-full w-full flex-col items-center justify-center gap-1"
            >
              <Trash2
                size={20}
                className="text-[#F5F5F5]"
                aria-hidden="true"
              />
              <span className="text-[14px] leading-[1.5] text-[#F5F5F5]">
                Delete
              </span>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete book</AlertDialogTitle>
              {/* Copy locked verbatim per D-08 — the cleaned display title
                  is interpolated, never the raw filename. */}
              <AlertDialogDescription>
                {`Delete book: Remove '${book.title}' and free its storage? This can't be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Link
        href={`/player/${book.id}`}
        className="relative block bg-[#171717] p-4"
        style={{
          transform: `translateX(${translateX}px)`,
          // dragX is non-null only while a touch is actively moving the
          // row — snap instantly to follow the finger, then transition
          // smoothly once the gesture ends and dragX resets to null.
          transition: dragX === null ? "transform 150ms ease-out" : "none",
        }}
        onClick={handleForegroundClick}
      >
        <p className="text-base leading-[1.5] text-[#F5F5F5] truncate">
          {book.title}
        </p>
        <Progress value={percent} className="my-2" />
        <p className="text-[14px] leading-[1.5] text-[#A3A3A3]">
          {percent}% — {remaining}
        </p>
      </Link>
    </li>
  );
}
