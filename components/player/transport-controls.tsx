"use client";

// Full three-control transport row for the player screen (03-UI-SPEC.md
// Layout step 5): skip-back 15s, play/pause, skip-forward 15s. Plan 01
// built only the center play/pause circle; this plan (03-02) adds the
// two skip controls on either side inside this row's flex layout.
//
// State is driven entirely by props: the page owns `isPlaying` (derived
// from the <audio> element's own play/pause events, not the tap itself)
// and the actual audio.play()/audio.pause() call, so that call can stay
// synchronous inside the tap handler with nothing in between — required
// for iOS Safari's gesture-unlock rule (03-RESEARCH.md Pattern 2). The
// skip handlers must stay synchronous for the same reason.
//
// Both skip controls are always enabled — clamping at the boundaries
// (lib/playback.ts clampSeek) is silent by design, so neither button has
// a disabled visual state in this phase (03-UI-SPEC.md Layout step 5).
import { Play, Pause, RotateCcw, RotateCw } from "lucide-react";

type TransportControlsProps = {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
};

// The "15" numeral composited on top of each skip icon. Not a new
// typography token — Label role (14px/600/Geist Mono), scaled down via a
// CSS transform to render at ~10px, nudged down slightly to sit inside
// the icon's open arc (03-UI-SPEC.md Typography's explicit "no new size
// or weight" note).
function SkipNumeral() {
  return (
    <span
      className="absolute inset-0 flex items-center justify-center pt-[3px] font-mono text-[14px] font-semibold text-[#F5F5F5]"
      style={{ transform: "scale(0.7)" }}
      aria-hidden="true"
    >
      15
    </span>
  );
}

export function TransportControls({
  isPlaying,
  onTogglePlay,
  onSkipBack,
  onSkipForward,
}: TransportControlsProps) {
  return (
    <div className="flex items-center justify-center gap-6">
      <button
        type="button"
        onClick={onSkipBack}
        aria-label="Skip back 15 seconds"
        className="relative flex min-h-11 min-w-11 items-center justify-center"
      >
        <RotateCcw size={28} className="text-[#F5F5F5]" aria-hidden="true" />
        <SkipNumeral />
      </button>

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

      <button
        type="button"
        onClick={onSkipForward}
        aria-label="Skip forward 15 seconds"
        className="relative flex min-h-11 min-w-11 items-center justify-center"
      >
        <RotateCw size={28} className="text-[#F5F5F5]" aria-hidden="true" />
        <SkipNumeral />
      </button>
    </div>
  );
}
