"use client";

import { useCallback, useRef } from "react";

/**
 * Lets a mouse's vertical wheel drive a horizontal chip row.
 *
 * A trackpad already scrolls these sideways with a two-finger swipe, but a
 * plain mouse only has a vertical wheel, so on desktop these rows looked
 * scrollable and were not. Taking over the wheel only when the row is
 * actually wider than its box, and only for straight vertical scrolling,
 * leaves page scrolling and trackpad gestures alone.
 *
 * A callback ref, not a plain ref plus a mount-only effect: the rows this
 * attaches to render empty (and so render nothing) until their data has
 * loaded, and a mount-only effect would run against that first, absent node
 * and never get another chance once the real one appeared.
 */
export function useHorizontalScroll<T extends HTMLElement>() {
  const cleanup = useRef<() => void>(() => {});

  return useCallback((el: T | null) => {
    cleanup.current();
    cleanup.current = () => {};
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0 || e.deltaY === 0) return;
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    cleanup.current = () => el.removeEventListener("wheel", onWheel);
  }, []);
}
