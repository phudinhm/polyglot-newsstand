import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ThemeScript } from "@/components/ThemeScript";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Polyglot Newsstand",
    template: "%s · Polyglot Newsstand",
  },
  description:
    "The news, one line at a time. Read German, English and Vietnamese journalism sentence by sentence, with translation on tap and a reading environment built for long sessions.",
  applicationName: "Polyglot Newsstand",
  manifest: "/manifest.webmanifest",
  icons: {
    // iOS ignores SVG for the home-screen icon, so the PNG has to be there.
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "Newsstand", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4ecd8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d0f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 btn"
        >
          Skip to content
        </a>
        <AppShell>{children}</AppShell>
        <footer className="mx-auto max-w-5xl px-4 pb-24 pt-10 text-xs text-muted sm:pb-10">
          <p>
            Headlines and article text belong to the publishers linked from each story.
            Polyglot Newsstand shows them for personal reading and language practice, and always
            links back to{" "}
            <Link href="/sources" className="underline underline-offset-2">
              the original source
            </Link>
            .
          </p>
          <p className="mt-2">Built by Minh Phu Dinh.</p>
        </footer>
      </body>
    </html>
  );
}
