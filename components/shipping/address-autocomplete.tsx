"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { AddressSuggestion } from "@/lib/shipping/geocode";

type AddressAutocompleteProps = {
  inputId?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectSuggestion: (suggestion: AddressSuggestion) => void;
  /** Fired when focus leaves the widget without a suggestion being picked. */
  onSettled?: () => void;
  suggest: (query: string) => Promise<AddressSuggestion[]>;
  placeholder?: string;
  inputClassName: string;
};

/**
 * Free-text address input with search-as-you-type suggestions. Unlike
 * FormTypeahead, the typed text is the value — an address that never matches
 * a suggestion is still a valid entry.
 */
export function AddressAutocomplete({
  inputId,
  value,
  onChangeText,
  onSelectSuggestion,
  onSettled,
  suggest,
  placeholder,
  inputClassName,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchSeq = useRef(0);
  // Suggestions fetch only after the user types, not on plain focus.
  const typedSinceFocus = useRef(false);

  useEffect(() => {
    if (!open || !typedSinceFocus.current) return;
    const query = value.trim();
    if (query.length < 3) return;
    const seq = ++searchSeq.current;
    const handle = setTimeout(() => {
      startSearchTransition(async () => {
        const results = await suggest(query);
        if (seq === searchSeq.current) {
          setItems(results);
        }
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [open, value, suggest, startSearchTransition]);

  function closeDropdown() {
    setOpen(false);
    setItems([]);
    typedSinceFocus.current = false;
  }

  function handleContainerBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
      closeDropdown();
      onSettled?.();
    }
  }

  return (
    <div ref={containerRef} onBlur={handleContainerBlur} className="relative">
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={
          open ? `${inputId ?? "address"}-suggestions` : undefined
        }
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          typedSinceFocus.current = true;
          if (event.target.value.trim().length < 3) {
            // Too short to suggest: drop stale suggestions and invalidate any
            // in-flight fetch so it can't repopulate them.
            searchSeq.current++;
            setItems([]);
          }
          onChangeText(event.target.value);
          if (!open) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closeDropdown();
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (open && items.length > 0) {
              onSelectSuggestion(items[0]!);
              closeDropdown();
            }
          }
        }}
        className={inputClassName}
      />
      {open && (items.length > 0 || isSearching) ? (
        <div
          id={`${inputId ?? "address"}-suggestions`}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-lg"
        >
          {items.map((item) => (
            <button
              key={`${item.label}|${item.latitude}|${item.longitude}`}
              type="button"
              role="option"
              aria-selected={item.label === value}
              onClick={() => {
                onSelectSuggestion(item);
                closeDropdown();
              }}
              className="block w-full px-3 py-1.5 text-left text-slate-900 hover:bg-slate-50"
            >
              {item.label}
            </button>
          ))}
          {isSearching ? (
            <p className="px-3 py-1.5 text-slate-400">Searching…</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
