"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/hooks/useT";
import type { StringKey } from "@/lib/i18n";
import { getSaved, getVocab } from "@/lib/store";
import { SettingsDrawer } from "./SettingsDrawer";
import { ContinueReading } from "./ContinueReading";
import { BookmarkIcon, CardsIcon, NewspaperIcon, SlidersIcon } from "./Icons";
import { ScrollToTop } from "./ScrollToTop";

const NAV: { href: string; key: StringKey; Icon: typeof NewspaperIcon; badgeKey?: "saved" | "vocab" }[] = [
  { href: "/", key: "nav.newsstand", Icon: NewspaperIcon },
  { href: "/saved", key: "nav.saved", Icon: BookmarkIcon, badgeKey: "saved" },
  { href: "/vocab", key: "nav.vocabulary", Icon: CardsIcon, badgeKey: "vocab" },
  { href: "/sources", key: "nav.sources", Icon: SlidersIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [counts, setCounts] = useState<{ saved: number; vocab: number }>({ saved: 0, vocab: 0 });
  // The reader hides the chrome so nothing competes with the article.
  const isReader = pathname?.startsWith("/read");

  useEffect(() => {
    const sync = () => {
      setCounts({
        saved: getSaved().length,
        vocab: getVocab().length,
      });
    };
    sync();
    window.addEventListener("pn:store", sync);
    return () => window.removeEventListener("pn:store", sync);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : Boolean(pathname?.startsWith(href));

  return (
    <>
      {!isReader && (
        <header className="glass sticky top-0 z-30 border-b border-border pt-[env(safe-area-inset-top)] transition-colors">
          <div className="mx-auto flex h-[var(--header-height)] max-w-5xl items-center gap-3 px-4">
            <Link href="/" className="group flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon.svg"
                alt=""
                width={30}
                height={30}
                className="shrink-0 rounded-lg shadow-xs transition-transform duration-200 group-hover:scale-105"
              />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[14px] font-semibold tracking-tight transition-colors group-hover:text-accent sm:text-[15px]">
                  Polyglot Newsstand
                </span>
                <span className="block truncate text-[10.5px] text-muted sm:text-[11px]">
                  {t("app.slogan")}
                </span>
              </span>
            </Link>

            <nav className="ml-auto hidden items-center gap-1 sm:flex" aria-label="Main navigation">
              {NAV.map(({ href, key, Icon, badgeKey }) => {
                const active = isActive(href);
                const badge = badgeKey ? counts[badgeKey] : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-all ${
                      active
                        ? "bg-[color-mix(in_srgb,var(--accent)_13%,transparent)] font-medium text-accent ring-1 ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
                        : "text-muted hover:bg-surface-2/70 hover:text-fg"
                    }`}
                  >
                    <Icon width={17} height={17} />
                    <span>{t(key)}</span>
                    {badge > 0 && (
                      <span
                        className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10.5px] font-semibold tabular-nums leading-tight ${
                          active
                            ? "bg-accent text-accent-fg"
                            : "bg-surface-2 text-muted"
                        }`}
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="btn ml-auto px-2.5 py-1.5 sm:ml-1"
              aria-label={t("settings.title")}
            >
              <SlidersIcon width={16} height={16} />
              <span className="hidden md:inline">{t("nav.reading")}</span>
            </button>
          </div>
        </header>
      )}

      <main id="main" className={isReader ? "" : "pb-24 sm:pb-8"}>
        {children}
      </main>

      {!isReader && (
        <>
          <ContinueReading />
          <nav
            className="glass-strong fixed inset-x-0 bottom-0 z-30 border-t border-border pb-[env(safe-area-inset-bottom)] sm:hidden"
            aria-label="Mobile navigation"
          >
            <div className="flex items-stretch justify-around px-1">
              {NAV.map(({ href, key, Icon, badgeKey }) => {
                const active = isActive(href);
                const badge = badgeKey ? counts[badgeKey] : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-all active:scale-95 ${
                      active ? "text-accent" : "text-muted hover:text-fg"
                    }`}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute top-0 h-0.5 w-7 rounded-full bg-accent"
                      />
                    )}
                    <span className="relative">
                      <Icon width={20} height={20} />
                      {badge > 0 && (
                        <span className="absolute -right-2.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9.5px] font-bold tabular-nums text-accent-fg shadow-xs">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </span>
                    <span className="truncate max-w-[4.5rem]">{t(key)}</span>
                  </Link>
                );
              })}

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-muted transition-all hover:text-fg active:scale-95"
                aria-label={t("settings.title")}
              >
                <SlidersIcon width={20} height={20} />
                <span className="truncate max-w-[4.5rem]">{t("nav.reading")}</span>
              </button>
            </div>
          </nav>
        </>
      )}

      <ScrollToTop />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

