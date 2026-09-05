"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SettingsDrawer } from "./SettingsDrawer";
import { BookmarkIcon, CardsIcon, NewspaperIcon, SlidersIcon } from "./Icons";

const NAV = [
  { href: "/", label: "Newsstand", Icon: NewspaperIcon },
  { href: "/saved", label: "Saved", Icon: BookmarkIcon },
  { href: "/vocab", label: "Vocabulary", Icon: CardsIcon },
  { href: "/sources", label: "Sources", Icon: SlidersIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The reader hides the chrome so nothing competes with the article.
  const isReader = pathname?.startsWith("/read");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : Boolean(pathname?.startsWith(href));

  return (
    <>
      {!isReader && (
        <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span
                aria-hidden
                className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-[13px] font-bold text-accent-fg"
              >
                PN
              </span>
              <span className="hidden sm:inline">Polyglot Newsstand</span>
            </Link>

            <nav className="ml-auto hidden items-center gap-1 sm:flex">
              {NAV.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                    isActive(href)
                      ? "bg-surface-2 font-medium text-fg"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  <Icon />
                  {label}
                </Link>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="btn ml-auto px-2.5 py-1.5 sm:ml-0"
              aria-label="Reading settings"
            >
              <SlidersIcon />
              <span className="hidden md:inline">Reading</span>
            </button>
          </div>
        </header>
      )}

      <main id="main">{children}</main>

      {!isReader && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
          <div className="flex">
            {NAV.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] ${
                  isActive(href) ? "text-accent" : "text-muted"
                }`}
              >
                <Icon width={20} height={20} />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
