"use client";

import { useEffect, useRef } from "react";
import { sanitizeRichText } from "@/lib/rich-text";

const toolbarButtonClassName =
  "rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClassName?: string;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className = "",
  minHeightClassName = "min-h-[4.5rem]",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const sanitized = sanitizeRichText(value);
    if (editor.innerHTML !== sanitized) {
      editor.innerHTML = sanitized;
    }
  }, [value]);

  function emitChange() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    onChange(sanitizeRichText(editor.innerHTML));
  }

  function applyCommand(command: "bold" | "italic" | "underline") {
    editorRef.current?.focus();
    document.execCommand(command, false);
    emitChange();
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emitChange();
  }

  return (
    <div className={className}>
      <div className="mb-1 flex flex-wrap gap-1">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyCommand("bold")}
          className={toolbarButtonClassName}
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyCommand("italic")}
          className={`${toolbarButtonClassName} italic`}
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyCommand("underline")}
          className={`${toolbarButtonClassName} underline`}
        >
          U
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
        onPaste={handlePaste}
        className={`rich-text-editor w-full resize-y rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm outline-none focus:border-slate-400 ${minHeightClassName}`}
      />
    </div>
  );
}
