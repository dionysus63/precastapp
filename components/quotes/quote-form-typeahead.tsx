"use client";

import { useEffect, useRef, useState, useTransition } from "react";

type QuoteFormTypeaheadProps<T> = {
  inputId?: string;
  /** Text shown in the input while the dropdown is closed. */
  selectedLabel: string;
  placeholder?: string;
  /** Items shown before the first search resolves (edit-mode seed). */
  initialItems?: T[];
  /** Server action that resolves matching items. Must be referentially stable. */
  searchItems: (query: string) => Promise<T[]>;
  itemKey: (item: T) => string;
  itemLabel: (item: T) => string;
  onSelect: (item: T | null) => void;
  /** When set, renders a "clear selection" row with this label. */
  clearLabel?: string | null;
  emptyLabel?: string;
  disabled?: boolean;
  inputClassName: string;
};

/**
 * Debounced typeahead over a server action. Replaces the full-catalog
 * `<select>` pickers in the quote form: options are fetched on demand while
 * the user types instead of being preloaded with the page.
 */
export function QuoteFormTypeahead<T>({
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
}: QuoteFormTypeaheadProps<T>) {
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
    if (event.key === "Enter") {
      // Keep Enter from submitting the surrounding quote form.
      event.preventDefault();
      if (open && items.length > 0) {
        handleSelect(items[0]!);
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
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-lg">
          {clearLabel ? (
            <button
              type="button"
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
        </div>
      ) : null}
    </div>
  );
}
