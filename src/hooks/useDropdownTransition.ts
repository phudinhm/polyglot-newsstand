"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keeps a `.t-dropdown` popover mounted long enough for its close transition
 * to play, instead of vanishing the instant `open` goes false.
 *
 * Adapts the transitions-dev "Menu dropdown" orchestration to React: that
 * snippet assumes the element is always in the DOM and toggles classes on
 * it directly, but this app conditionally renders popovers (`{open && ...}`),
 * which would unmount before `.is-closing` ever got a frame to animate.
 * Mirroring the mount to a short tail after `open` flips false gives the
 * close scale-down somewhere to happen.
 */
export function useDropdownTransition(open: boolean, closeMs = 150) {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<"is-open" | "is-closing">(open ? "is-open" : "is-closing");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (open) {
      setMounted(true);
      // Paint once at the pre-open (collapsed) state before flipping to
      // .is-open, so the open transition actually plays instead of snapping.
      const raf = requestAnimationFrame(() => setState("is-open"));
      return () => cancelAnimationFrame(raf);
    }
    if (!mounted) return;
    setState("is-closing");
    timer.current = setTimeout(() => setMounted(false), closeMs);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closeMs]);

  return { mounted, dropdownState: state };
}
