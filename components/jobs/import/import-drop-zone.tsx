"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";

/** Only real files from the desktop light the zone up (not page drags). */
export function dragHasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/**
 * A dashed area to drag PDFs onto, with a browse fallback. `multiple`
 * decides whether one or many files are taken from a drop.
 */
export function ImportDropZone({
  onFiles,
  multiple,
  label,
  hint,
  compact = false,
}: {
  onFiles: (files: File[]) => void;
  multiple: boolean;
  label: string;
  hint?: ReactNode;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hot, setHot] = useState(false);

  function take(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0) {
      return;
    }
    onFiles(multiple ? files : files.slice(0, 1));
  }

  return (
    <div
      onDragOver={(event) => {
        if (!dragHasFiles(event)) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setHot(true);
      }}
      onDragLeave={() => setHot(false)}
      onDrop={(event) => {
        if (!dragHasFiles(event)) {
          return;
        }
        event.preventDefault();
        setHot(false);
        take(event.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-center text-xs transition-colors ${
        compact ? "px-3 py-3" : "px-4 py-6"
      } ${
        hot
          ? "border-sky-500 bg-sky-50 text-sky-900"
          : "border-slate-300 bg-slate-50 text-slate-600"
      }`}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
      </svg>
      <span className="font-semibold">{label}</span>
      <span>
        or{" "}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="font-semibold text-sky-700 hover:underline"
        >
          browse your computer
        </button>
      </span>
      {hint ? <span className="text-[11px] text-slate-500">{hint}</span> : null}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
