import { BookAudio } from "lucide-react";

// The "My Library" screen in its final empty-library layout (D-04) — this is
// the screen Phase 2 fills in, not a placeholder Phase 2 discards. Per D-05
// there is no offline banner, connectivity indicator, or install-instruction
// UI: nothing here depends on the network, so it renders identically online
// and offline.
export default function LibraryPage() {
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
        <p className="text-base leading-[1.5] text-[#A3A3A3]">
          Import an audiobook to start listening.
        </p>
      </div>
    </div>
  );
}
