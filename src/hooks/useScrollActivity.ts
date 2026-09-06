"use client";

import { useEffect, useState } from "react";

/**
 * True while the reader is scrolling, false once they have settled.
 *
 * Chrome on the page is only wanted while moving around it. Dimming rather
 * than hiding keeps everything one tap away, and avoids the layout jump that
 * a disappearing header causes.
 */
export function useScrollActivity(idleMs = 1600): boolean {
  const [active, setActive] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setActive(false), idleMs);
    };
    wake();
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("pointermove", wake, { passive: true });
    window.addEventListener("keydown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [idleMs]);

  return active;
}
