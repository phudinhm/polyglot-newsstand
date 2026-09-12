"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useT } from "@/hooks/useT";
import type { StringKey } from "@/lib/i18n";
import { SettingsDrawer } from "./SettingsDrawer";
import { ContinueReading } from "./ContinueReading";
import { BookmarkIcon, CardsIcon, NewspaperIcon, SlidersIcon } from "./Icons";
import { ScrollToTop } from "./ScrollToTop";

const NAV: { href: string; key: StringKey; Icon: typeof NewspaperIcon }[] = [
  { href: "/", key: "nav.newsstand", Icon: NewspaperIcon },
  { href: "/saved", key: "nav.saved", Icon: BookmarkIcon },
  { href: "/vocab", key: "nav.vocabulary", Icon: CardsIcon },
  { href: "/sources", key: "nav.sources", Icon: SlidersIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The reader hides the chrome so nothing competes with the article.
  const isReader = pathname?.startsWith("/read");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : Boolean(pathname?.startsWith(href));

  return (
    <>
      {!isReader && (
        <header className="glass sticky top-0 z-30 border-b border-border">
          <div className="mx-auto flex h-[var(--header-height)] max-w-5xl items-center gap-3 px-4">
            <Link href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="" width={30} height={30} className="shrink-0 rounded-lg" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[14px] font-semibold tracking-tight sm:text-[15px]">
                  Polyglot Newsstand
                </span>
                <span className="block truncate text-[10.5px] text-muted sm:text-[11px]">
                  {t("app.slogan")}
                </span>
              </span>
            </Link>

            <nav className="ml-auto hidden items-center gap-1 sm:flex">
              {NAV.map(({ href, key, Icon }) => (
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
                  {t(key)}
                </Link>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="btn ml-auto px-2.5 py-1.5 sm:ml-0"
              aria-label={t("settings.title")}
            >
              <SlidersIcon />
              <span className="hidden md:inline">{t("nav.reading")}</span>
            </button>
          </div>
        </header>
      )}

      <main id="main" className={isReader ? "" : "pb-20 sm:pb-0"}>
        {children}
      </main>

      {!isReader && (
        <>
          <ContinueReading />
          <nav className="glass fixed inset-x-0 bottom-0 z-30 border-t border-border pb-[env(safe-area-inset-bottom)] sm:hidden">
            <div className="flex">
              {NAV.map(({ href, key, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors ${
                    isActive(href) ? "text-accent" : "text-muted"
                  }`}
                >
                  <Icon width={20} height={20} />
                  {t(key)}
                </Link>
              ))}
            </div>
          </nav>
        </>
      )}

      <ScrollToTop />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
