"use client";

// Transient row shown while a picked file is being copied into storage
// (D-02). Container matches components/library-row.tsx's Secondary
// surface, rounding, padding, and minimum height exactly, so the row does
// not visually jump when it resolves into the real populated row.
//
// No swipe handler, no delete affordance — there is no stored record yet
// to delete. Renders an indeterminate spinner, never a percentage: the
// copy is a single atomic db.books.add() call with no byte-level progress
// events (02-UI-SPEC.md's "Import Flow — Placeholder Row" section), so any
// number here would be invented data presented to the user as measurement.
import { LoaderCircle } from "lucide-react";

type ImportPlaceholderRowProps = {
  title: string;
};

export function ImportPlaceholderRow({ title }: ImportPlaceholderRowProps) {
  return (
    <li
      className="relative rounded-[8px] min-h-11 overflow-hidden bg-[#171717] p-4"
      aria-label={`Importing ${title}`}
    >
      {/* Title cleanup is a synchronous string transform on the filename
          and does not wait on the async duration read, so the cleaned
          title is available and shown immediately. */}
      <p className="text-base leading-[1.5] text-[#F5F5F5] truncate">
        {title}
      </p>
      <div className="flex items-center gap-1 mt-2">
        <LoaderCircle
          size={16}
          className="text-[#E8B34A] animate-spin"
          aria-hidden="true"
        />
        <span className="text-[14px] leading-[1.5] text-[#A3A3A3]">
          Importing…
        </span>
      </div>
    </li>
  );
}
