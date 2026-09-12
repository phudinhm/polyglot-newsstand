"use client";

import { useEffect, useState } from "react";
import { ArrowUpIcon } from "./Icons";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

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

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      title="Scroll to top"
      className="glass-strong fixed bottom-20 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border shadow-[var(--shadow)] transition-all duration-200 hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6 sm:h-11 sm:w-11"
    >
      <ArrowUpIcon className="text-fg transition-colors hover:text-accent" width={18} height={18} />
    </button>
  );
}
