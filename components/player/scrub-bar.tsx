"use client";

// D-03's drag lifecycle (03-CONTEXT.md, 03-RESEARCH.md Pattern 3): pause on
// the first move of a drag, track the dragged value locally without ever
// touching the audio element's playback position, then seek exactly once
// and conditionally resume on release. The pause/seek/resume ordering is
// one indivisible unit — audioRef is passed in rather than split across
// three page-owned callbacks, so this component (not the page) owns the
// ordering that D-03's whole substance depends on.
//
// dragValue's null-means-not-dragging idiom mirrors components/library-row.tsx's
// swipe-offset state; wasPlayingRef is a ref (not state) because recording
// it must never trigger a render mid-drag.
import { useRef, useState } from "react";
import { Slider, SliderTrack, SliderRange, SliderThumb } from "@/components/ui/slider";
import { clampSeek } from "@/lib/playback";
import { formatElapsed } from "@/lib/format";

type ScrubBarProps = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  duration: number;
  position: number;
  onSeek: (seconds: number) => void;
};

export function ScrubBar({ audioRef, duration, position, onSeek }: ScrubBarProps) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const wasPlayingRef = useRef(false);

  const displayedValue = dragValue ?? position;

  return (
    <Slider
      min={0}
      max={duration}
      step={1}
      value={[displayedValue]}
      onValueChange={([v]) => {
        const audio = audioRef.current;
        if (dragValue === null) {
          // First move of this drag — capture the pre-drag playing state
          // and pause. This is the only place that state is read; release
          // honors it, never re-derives it.
          wasPlayingRef.current = !!audio && !audio.paused;
          audio?.pause();
        }
        // Displayed position only — the audio element's currentTime is
        // never assigned here. Seeking on every drag tick is exactly what
        // D-03 exists to prevent (choppy native-audio seeking).
        setDragValue(v);
      }}
      onValueCommit={([v]) => {
        const audio = audioRef.current;
        const target = clampSeek(v, duration);
        if (audio) {
          // The single seek for this whole gesture.
          audio.currentTime = target;
        }
        // Update the page's own elapsed state immediately — a paused book
        // won't fire another timeupdate to do this for us.
        onSeek(target);
        // Resume only if the book was playing before the drag began. No
        // await, no promise boundary anywhere above this line: this call
        // must stay inside the same synchronous release-event call stack
        // to preserve iOS's gesture-unlock context (03-RESEARCH.md Pitfall C).
        if (wasPlayingRef.current) {
          audio?.play();
        }
        setDragValue(null);
      }}
    >
      <SliderTrack>
        <SliderRange />
      </SliderTrack>
      <SliderThumb
        aria-label="Seek"
        aria-valuetext={formatElapsed(Math.floor(displayedValue))}
      />
    </Slider>
  );
}
