"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useScrollActivity } from "@/hooks/useScrollActivity";
import { getReadingNow } from "@/lib/reading";
import { ArrowUpIcon } from "./Icons";

export function ScrollToTop() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [hasContinueBar, setHasContinueBar] = useState(false);

  // The reader already dims its header and font-size toolbar while settled,
  // so this button falls in with them there; everywhere else has no other
  // chrome to fade in step with, so it stays at full opacity as before.
  const isReader = Boolean(pathname?.startsWith("/read"));
  const chromeActive = useScrollActivity();

  useEffect(() => {
    const syncReading = () => {
      const active = Boolean(getReadingNow()) && pathname !== "/" && !pathname?.startsWith("/read");
      setHasContinueBar(active);
    };
    syncReading();
    window.addEventListener("pn:reading", syncReading);
    return () => window.removeEventListener("pn:reading", syncReading);
  }, [pathname]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setVisible(window.scrollY > 360);
          ticking = false;
        });
        ticking = true;
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!visible) return null;

  const dimmed = isReader && !chromeActive;

  // Position cleanly above ReaderToolbar on /read, or above ContinueReading on /saved /vocab /sources,
  // or above the bottom tab bar on mobile Newsstand.
  const positionClasses = isReader
    ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 sm:bottom-[4.75rem] sm:right-6"
    : hasContinueBar
      ? "bottom-[calc(8.5rem+env(safe-area-inset-bottom))] right-4 sm:bottom-24 sm:right-6"
      : "bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 sm:bottom-6 sm:right-6";

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      title="Scroll to top"
      className={`glass-strong animate-popover fixed z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border shadow-[var(--shadow)] transition-all duration-200 hover:scale-105 hover:border-accent/40 active:scale-95 sm:h-11 sm:w-11 ${positionClasses} ${
        dimmed ? "opacity-25 hover:opacity-100 focus-within:opacity-100" : "opacity-100"
      }`}
    >
      <ArrowUpIcon className="text-fg transition-colors hover:text-accent" width={18} height={18} />
    </button>
  );
}

