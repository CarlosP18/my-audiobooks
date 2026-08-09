"use client";

// Inline, dismissible import-failure banner (D-03). Maps the typed
// ImportErrorReason from lib/import.ts to one of the four copy variants
// locked verbatim in 02-UI-SPEC.md's "Import Failure — Inline Error
// Banner" table — reproduced character-for-character below, never
// paraphrased or merged.
//
// Deliberately does NOT use the Destructive color token: that red is
// reserved exclusively for the delete action in this phase
// (02-UI-SPEC.md's Color section), and reusing it here for a non-
// destructive informational message would break that reservation. No red
// belongs anywhere in this file.
import { X } from "lucide-react";
import type { ImportErrorReason } from "@/lib/import";

type ImportErrorBannerProps = {
  reason: ImportErrorReason;
  filename: string;
  onDismiss: () => void;
};

function copyForReason(reason: ImportErrorReason, filename: string): string {
  switch (reason) {
    case "unsupported-format":
      return `Couldn't import "${filename}" — only MP3, M4A, and M4B files are supported.`;
    case "insufficient-storage":
      return `Not enough storage to import "${filename}".`;
    case "unreadable-file":
      return `Couldn't import "${filename}" — the file may be corrupted or unsupported.`;
    case "generic":
      return `Couldn't import "${filename}". Try again.`;
  }
}

export function ImportErrorBanner({
  reason,
  filename,
  onDismiss,
}: ImportErrorBannerProps) {
  return (
    <div className="relative bg-[#171717] rounded-[8px] p-4">
      <p className="text-base leading-[1.5] text-[#F5F5F5] pr-8">
        {copyForReason(reason, filename)}
      </p>
      {/* No timeout — a storage or format problem stays visible until the
          user acknowledges it manually or a later import succeeds
          (app/page.tsx clears this on success). */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="absolute top-0 right-0 p-[14px]"
      >
        <X size={16} className="text-[#A3A3A3]" aria-hidden="true" />
      </button>
    </div>
  );
}
