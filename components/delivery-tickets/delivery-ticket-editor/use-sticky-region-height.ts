"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Measures the sticky header so dependent sticky elements (the JOB quote
 * table header, the walk-in "On this ticket" panel) pin just below it.
 * Re-measures whenever the ticket type or the selected quote changes (the
 * header swaps between the walk-in and job variants).
 */
export function useStickyRegionHeight(
  ticketType: "JOB" | "WALK_IN",
  quote: unknown,
) {
  const [stickyRegionHeight, setStickyRegionHeight] = useState(0);
  const stickyRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = stickyRegionRef.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      setStickyRegionHeight(Math.ceil(element.getBoundingClientRect().height));
    };
    const frame = window.requestAnimationFrame(updateHeight);
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ticketType, quote]);

  return { stickyRegionRef, stickyRegionHeight };
}
