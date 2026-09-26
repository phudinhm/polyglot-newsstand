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

/**
 * The same four destinations render twice - a text+icon row on desktop, an
 * icon-over-label tab bar on a phone - because the two layouts genuinely
 * differ in shape. One component for both keeps the active-state logic (the
 * only part that must actually agree between them) in a single place,
 * rather than two className strings that can quietly drift apart.
 */
function NavLink({
  href,
  label,
  Icon,
  active,
  variant,
}: {
  href: string;
  label: string;
  Icon: typeof NewspaperIcon;
  active: boolean;
  variant: "desktop" | "mobile";
}) {
  if (variant === "mobile") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors ${
          active ? "text-accent" : "text-muted"
        }`}
      >
        <Icon width={20} height={20} />
        {label}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
        active ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg"
      }`}
    >
      <Icon />
      {label}
    </Link>
  );
}

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
        <header className="glass sticky top-0 z-30 border-b border-border pt-[env(safe-area-inset-top)]">
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
                <NavLink
                  key={href}
                  href={href}
                  label={t(key)}
                  Icon={Icon}
                  active={isActive(href)}
                  variant="desktop"
                />
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
          {/*
            Nearly opaque rather than the header's lighter glass: the feed
            scrolls underneath this bar all day, and at 88% the headlines
            passing behind it stayed legible enough to read as clutter.
          */}
          <nav className="glass-strong fixed inset-x-0 bottom-0 z-30 border-t border-border pb-[env(safe-area-inset-bottom)] sm:hidden">
            <div className="flex">
              {NAV.map(({ href, key, Icon }) => (
                <NavLink
                  key={href}
                  href={href}
                  label={t(key)}
                  Icon={Icon}
                  active={isActive(href)}
                  variant="mobile"
                />
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
