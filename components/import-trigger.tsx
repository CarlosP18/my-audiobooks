"use client";

// Shared file-picker trigger for both import entry points (02-UI-SPEC.md
// Layout): the empty-state tappable body copy (D-01) and the populated
// state's header Plus button. Both render forms share one hidden
// <input type="file"> and one onFilesPicked callback so there is exactly
// one picker implementation to keep in sync with format/multi-select rules.
import { useRef } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { Plus } from "lucide-react";

const ACCEPT_HINT = "audio/mpeg,.mp3,audio/mp4,.m4a,.m4b";

type ImportTriggerProps = {
  variant: "empty" | "header";
  onFilesPicked: (files: FileList) => void;
  children?: ReactNode;
};

export function ImportTrigger({
  variant,
  onFilesPicked,
  children,
}: ImportTriggerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    fileInputRef.current?.click();
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFilesPicked(files);
    }
    event.target.value = "";
  }

  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept={ACCEPT_HINT}
      multiple
      className="hidden"
      onChange={handleChange}
    />
  );

  if (variant === "empty") {
    return (
      <>
        <button
          type="button"
          onClick={openPicker}
          aria-label="Import audiobook"
          className="text-base leading-[1.5] text-[#A3A3A3] p-3 -m-3"
        >
          {children}
        </button>
        {hiddenFileInput}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        aria-label="Import audiobook"
        className="p-[10px] -m-[10px]"
      >
        <Plus size={24} className="text-[#E8B34A]" aria-hidden="true" />
      </button>
      {hiddenFileInput}
    </>
  );
}
