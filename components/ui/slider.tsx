"use client";

// Hand-vendored slider primitive, standing in for `npx shadcn add slider`
// (registry.ui.shadcn.com is proxy-blocked in this environment — see
// components/ui/alert-dialog.tsx and components/ui/progress.tsx for the
// same treatment). Same Radix primitive and new-york composition shadcn's
// CLI would generate, hand-authored instead of fetched. There is no
// `cn()` helper in this project (see 02-02-PLAN.md Claude's Discretion
// #1) — class strings are composed with plain template literals so a
// caller-supplied `className` is appended to the defaults.
//
// Sub-component names and the onValueChange/onValueCommit prop signatures
// below were confirmed against node_modules/@radix-ui/react-slider/dist/index.d.ts
// after install (03-RESEARCH.md Open Question 2), not assumed from the
// research's example code.
import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className = "", ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={`relative flex w-full items-center touch-none select-none ${className}`}
    {...props}
  />
));
Slider.displayName = SliderPrimitive.Root.displayName;

const SliderTrack = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Track>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Track>
>(({ className = "", ...props }, ref) => (
  <SliderPrimitive.Track
    ref={ref}
    className={`relative h-1 w-full grow overflow-hidden rounded-full bg-[#171717] ${className}`}
    {...props}
  />
));
SliderTrack.displayName = SliderPrimitive.Track.displayName;

const SliderRange = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Range>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Range>
>(({ className = "", ...props }, ref) => (
  <SliderPrimitive.Range
    ref={ref}
    className={`absolute h-full bg-[#E8B34A] ${className}`}
    {...props}
  />
));
SliderRange.displayName = SliderPrimitive.Range.displayName;

const SliderThumb = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Thumb>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Thumb>
>(({ className = "", ...props }, ref) => (
  <SliderPrimitive.Thumb
    ref={ref}
    className={`block h-5 w-5 rounded-full bg-[#E8B34A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8B34A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] ${className}`}
    {...props}
  />
));
SliderThumb.displayName = SliderPrimitive.Thumb.displayName;

export { Slider, SliderTrack, SliderRange, SliderThumb };
