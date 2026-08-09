"use client";

// Hand-vendored progress primitive, standing in for `npx shadcn add
// progress` (registry.ui.shadcn.com is proxy-blocked in this environment —
// see 02-02-PLAN.md environment_constraints). This is the first time the
// Accent token (#E8B34A) renders on screen anywhere in the app — Phase 1
// explicitly reserved it for this (01-UI-SPEC.md).
import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className = "", value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={`relative h-1 w-full overflow-hidden rounded-full bg-[#171717] ${className}`}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-[#E8B34A] transition-transform"
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
