"use client";

import { useRef, useState, type KeyboardEvent } from "react";

type FileUploadDropzoneProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  accept?: string;
  multiple?: boolean;
  label: string;
  description?: string;
  inputId?: string;
};

function mergeFiles(existing: File[], incoming: FileList | File[], multiple: boolean) {
  const next = Array.from(incoming);
  if (!multiple) {
    return next.slice(0, 1);
  }

  const seen = new Set(existing.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  const merged = [...existing];

  for (const file of next) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(file);
  }

  return merged;
}

export function FileUploadDropzone({
  files,
  onFilesChange,
  disabled = false,
  accept,
  multiple = true,
  label,
  description,
  inputId = "file-upload-input",
}: FileUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(incoming: FileList | File[]) {
    if (disabled) {
      return;
    }

    onFilesChange(mergeFiles(files, incoming, multiple));
  }

  function openFilePicker() {
    if (disabled) {
      return;
    }
    inputRef.current?.click();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={label}
        onClick={openFilePicker}
        onKeyDown={handleKeyDown}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!disabled) {
            setIsDragging(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!disabled) {
            setIsDragging(true);
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(false);

          if (event.dataTransfer.files.length > 0) {
            handleFiles(event.dataTransfer.files);
          }
        }}
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
            : isDragging
              ? "border-slate-500 bg-slate-100"
              : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
        }`}
      >
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="mt-1 text-xs text-slate-500">or click to browse</p>
        {description ? (
          <p className="mt-2 max-w-md text-[11px] text-slate-500">{description}</p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            handleFiles(event.target.files);
          }
          event.target.value = "";
        }}
      />

      {files.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-700">
              {files.length} file{files.length === 1 ? "" : "s"} selected
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onFilesChange([])}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
            {files.map((file) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="truncate text-xs text-slate-600"
                title={file.name}
              >
                {file.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
