"use client";

// Play/pause transport button row for the player screen (03-UI-SPEC.md
// Layout step 5). This task renders only the center play/pause circle —
// 03-02-PLAN.md extends this same file to add the ±15s skip buttons on
// either side inside this row's flex layout; the `gap-6` spacing already
// leaves room for them.
//
// State is driven entirely by props: the page owns `isPlaying` (derived
// from the <audio> element's own play/pause events, not the tap itself)
// and the actual audio.play()/audio.pause() call, so that call can stay
// synchronous inside the tap handler with nothing in between — required
// for iOS Safari's gesture-unlock rule (03-RESEARCH.md Pattern 2).
import { Play, Pause } from "lucide-react";

type TransportControlsProps = {
  isPlaying: boolean;
  onTogglePlay: () => void;
};

export function TransportControls({
  isPlaying,
  onTogglePlay,
}: TransportControlsProps) {
  return (
    <div className="flex items-center justify-center gap-6">
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#E8B34A]"
      >
        {isPlaying ? (
          <Pause size={32} className="text-[#0A0A0A]" aria-hidden="true" />
        ) : (
          <Play size={32} className="text-[#0A0A0A]" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
