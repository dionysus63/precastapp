"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { updateTicketDeliveryDate } from "@/app/delivery-tickets/actions";
import { reloadAfterAction } from "@/lib/reload-after-action";

type DeliveryTileMenuProps = {
  ticketId: string;
  ticketNumber: string;
  /** Current delivery day as YYYY-MM-DD (the date input's value format). */
  deliveryDateIso: string | null;
  /**
   * "icon": bare 16px gear for the schedule tiles. "pill": bordered button
   * sized like the Print/Submittals pills in the loads tables.
   */
  appearance?: "icon" | "pill";
};

const MENU_WIDTH = 224;
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

type MenuPosition = { top: number; left: number };

/**
 * Where to put the popover so it sits under the gear's right edge and stays
 * inside the viewport. Fixed positioning keeps it clear of the section
 * card's overflow clipping, so a tile at the bottom of a column still opens.
 */
function placeMenu(anchor: DOMRect, menuHeight: number): MenuPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = anchor.right - MENU_WIDTH;
  left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(left, viewportWidth - MENU_WIDTH - VIEWPORT_MARGIN),
  );

  let top = anchor.bottom + MENU_GAP;
  if (top + menuHeight > viewportHeight - VIEWPORT_MARGIN) {
    const above = anchor.top - MENU_GAP - menuHeight;
    top = above >= VIEWPORT_MARGIN ? above : Math.max(VIEWPORT_MARGIN, top);
  }

  return { top, left };
}

/**
 * Gear menu on a delivery hub schedule tile: quick edits that stay on the
 * hub instead of opening the ticket. Today it holds the delivery date; add
 * further actions as more <MenuField> blocks (or buttons) inside the popover.
 */
export function DeliveryTileMenu({
  ticketId,
  ticketNumber,
  deliveryDateIso,
  appearance = "icon",
}: DeliveryTileMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [date, setDate] = useState(deliveryDateIso ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
    setError(null);
  }, []);

  function toggle() {
    if (open) {
      close();
      return;
    }
    setDate(deliveryDateIso ?? "");
    setError(null);
    setOpen(true);
  }

  // Measure after the popover renders so it can flip above the gear when
  // there is no room below. Re-place on scroll/resize since it is fixed.
  useEffect(() => {
    if (!open) return;
    function place() {
      const anchor = buttonRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const height = menuRef.current?.offsetHeight ?? 0;
      setPosition(placeMenu(anchor, height));
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Click outside or Escape closes the popover without saving.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const dateChanged = date !== "" && date !== (deliveryDateIso ?? "");

  function saveDate() {
    if (!dateChanged || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await updateTicketDeliveryDate(ticketId, date);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      // The tile moves to another day column, so reload the hub.
      reloadAfterAction();
    });
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={`Quick edit ${ticketNumber}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title="Quick edit"
        className={
          appearance === "pill"
            ? `inline-flex items-center justify-center rounded-md border border-slate-200 px-2 py-1 text-slate-700 transition-colors hover:bg-slate-50 ${
                open ? "bg-slate-50" : ""
              }`
            : `inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 ${
                open ? "bg-slate-100 text-slate-700" : ""
              }`
        }
      >
        <GearIcon />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="dialog"
          aria-label={`Quick edit ${ticketNumber}`}
          style={{
            position: "fixed",
            width: MENU_WIDTH,
            top: position?.top ?? 0,
            left: position?.left ?? 0,
            // Hidden until measured so the first paint doesn't jump.
            visibility: position ? "visible" : "hidden",
          }}
          className="z-50 rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-lg"
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
              event.preventDefault();
              saveDate();
            }
          }}
        >
          <p className="mb-2 font-mono text-[10px] font-semibold text-slate-500">
            {ticketNumber}
          </p>

          <MenuField label="Delivery date" htmlFor={`${menuId}-date`}>
            <div className="flex items-center gap-1.5">
              <input
                id={`${menuId}-date`}
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                disabled={pending}
                autoFocus
                className="block min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm disabled:opacity-60"
              />
              <button
                type="button"
                onClick={saveDate}
                disabled={!dateChanged || pending}
                className="shrink-0 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Saving…" : "Move"}
              </button>
            </div>
          </MenuField>

          {error ? (
            <p className="mt-2 text-[10px] text-red-600">{error}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** One labelled row of the quick-edit popover. */
function MenuField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
