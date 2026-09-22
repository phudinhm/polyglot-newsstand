"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useScrollActivity } from "@/hooks/useScrollActivity";
import { ArrowUpIcon } from "./Icons";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  // The reader already dims its header and font-size toolbar while settled,
  // so this button falls in with them there; everywhere else has no other
  // chrome to fade in step with, so it stays at full opacity as before.
  const isReader = pathname?.startsWith("/read");
  const chromeActive = useScrollActivity();

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setVisible(window.scrollY > 380);
          ticking = false;
        });
        ticking = true;
      }
    };

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

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      title="Scroll to top"
      className={`glass-strong fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border shadow-[var(--shadow)] transition-all duration-200 hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6 sm:h-11 sm:w-11 ${
        dimmed ? "opacity-25 hover:opacity-100 focus-within:opacity-100" : "opacity-100"
      }`}
    >
      <ArrowUpIcon className="text-fg transition-colors hover:text-accent" width={18} height={18} />
    </button>
  );
}
