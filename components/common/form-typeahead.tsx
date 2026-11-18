"use client";

import { useEffect, useRef, useState, useTransition } from "react";

type FormTypeaheadProps<T> = {
  inputId?: string;
  selectedLabel: string;
  placeholder?: string;
  initialItems?: T[];
  searchItems: (query: string) => Promise<T[]>;
  itemKey: (item: T) => string;
  itemLabel: (item: T) => string;
  onSelect: (item: T | null) => void;
  clearLabel?: string | null;
  emptyLabel?: string;
  disabled?: boolean;
  inputClassName: string;
  /** When true, Enter selects the first match without submitting a parent form. */
  preventEnterSubmit?: boolean;
  /**
   * Lets what was typed be the answer itself (a job that is not on file):
   * a last row in the list offers it, and Enter takes it when nothing
   * matches.
   */
  freeText?: {
    /** The row's wording for the typed text, e.g. `Use "Smith yard" as typed`. */
    label: (query: string) => string;
    onUse: (query: string) => void;
  };
};

export function FormTypeahead<T>({
  inputId,
  selectedLabel,
  placeholder,
  initialItems = [],
  searchItems,
  itemKey,
  itemLabel,
  onSelect,
  clearLabel = null,
  emptyLabel = "No matches found.",
  disabled = false,
  inputClassName,
  preventEnterSubmit = true,
  freeText,
}: FormTypeaheadProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<T[]>(initialItems);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSearching, startSearchTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handle = setTimeout(() => {
      startSearchTransition(async () => {
        const results = await searchItems(query);
        setItems(results);
        setHasLoaded(true);
      });
    }, 300);

    return () => clearTimeout(handle);
  }, [open, query, searchItems, startSearchTransition]);

  function closeDropdown() {
    setOpen(false);
    setQuery("");
  }

  function handleSelect(item: T | null) {
    onSelect(item);
    closeDropdown();
  }

  const typedText = query.trim();

  function handleUseTyped() {
    freeText?.onUse(typedText);
    closeDropdown();
  }

  function handleContainerBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
      closeDropdown();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeDropdown();
      return;
    }
    if (event.key === "Enter" && preventEnterSubmit) {
      event.preventDefault();
      if (open && items.length > 0) {
        handleSelect(items[0]!);
      } else if (open && freeText && typedText && !isSearching && hasLoaded) {
        handleUseTyped();
      }
    }
  }

  const showSpinner = isSearching || !hasLoaded;

  return (
    <div
      ref={containerRef}
      onBlur={handleContainerBlur}
      className="relative"
    >
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? `${inputId ?? "typeahead"}-listbox` : undefined}
        autoComplete="off"
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) {
            setOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        className={inputClassName}
      />
      {open ? (
        <div
          id={`${inputId ?? "typeahead"}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-lg"
        >
          {clearLabel ? (
            <button
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => handleSelect(null)}
              className="block w-full px-3 py-1.5 text-left text-slate-500 hover:bg-slate-50"
            >
              {clearLabel}
            </button>
          ) : null}
          {items.map((item) => (
            <button
              key={itemKey(item)}
              type="button"
              role="option"
              aria-selected={itemLabel(item) === selectedLabel}
              onClick={() => handleSelect(item)}
              className="block w-full px-3 py-1.5 text-left text-slate-900 hover:bg-slate-50"
            >
              {itemLabel(item)}
            </button>
          ))}
          {showSpinner ? (
            <p className="px-3 py-1.5 text-slate-400">Searching…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-1.5 text-slate-500">{emptyLabel}</p>
          ) : null}
          {freeText && typedText ? (
            <button
              type="button"
              role="option"
              aria-selected={false}
              onClick={handleUseTyped}
              className="block w-full border-t border-slate-100 px-3 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50"
            >
              {freeText.label(typedText)}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
