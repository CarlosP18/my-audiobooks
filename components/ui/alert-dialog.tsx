"use client";

// Hand-vendored alert-dialog primitive, standing in for `npx shadcn add
// alert-dialog` (registry.ui.shadcn.com is proxy-blocked in this
// environment — see 02-01-SUMMARY.md and 02-02-PLAN.md's
// environment_constraints). Same Radix primitive and new-york composition
// shadcn's CLI would generate, hand-authored instead of fetched. There is
// no `cn()` helper in this project (see 02-02-PLAN.md Claude's Discretion
// #1) — class strings are composed with plain template literals so a
// caller-supplied `className` is appended to the defaults.
import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className = "", ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={`fixed inset-0 z-50 bg-[#0A0A0A]/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ${className}`}
    {...props}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className = "", style, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      // Centering/sizing is inline, not Tailwind arbitrary-value classes
      // (`left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
      // w-[calc(100%-2rem)] max-w-sm`) — on a physical iPhone PWA those
      // compound utilities rendered the dialog as a narrow, full-height
      // right-edge strip instead of a centered card (observed on-device,
      // not reproducible from source alone). Inline styles can't be
      // dropped by any build-time CSS step, so this removes that failure
      // mode entirely regardless of its exact cause.
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "calc(100% - 2rem)",
        maxWidth: "24rem",
        ...style,
      }}
      className={`z-50 rounded-[8px] bg-[#171717] p-4 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ${className}`}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`flex flex-col gap-2 text-center sm:text-left ${className}`}
    {...props}
  />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end ${className}`}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className = "", ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={`text-[20px] font-semibold leading-[1.2] text-[#F5F5F5] ${className}`}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className = "", ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={`text-base leading-[1.5] text-[#F5F5F5] ${className}`}
    {...props}
  />
));
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName;

// No `buttonVariants` import here — see 02-02-PLAN.md Claude's Discretion #2:
// that would require components/ui/button.tsx plus class-variance-authority,
// another unaudited package. 02-UI-SPEC.md's Delete Confirmation Dialog
// section already specifies the exact appearance of both buttons below.
const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className = "", ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={`inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[#DC2626] px-4 text-[14px] leading-[1.5] text-[#F5F5F5] ${className}`}
    {...props}
  />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className = "", ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={`inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[#171717] px-4 text-[14px] leading-[1.5] text-[#F5F5F5] ${className}`}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
