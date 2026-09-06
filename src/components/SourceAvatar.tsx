"use client";

import { useState } from "react";

/** Stable, pleasant tile colours derived from the name itself. */
const TILE_COLOURS = [
  "#8a6f4e", "#4f6d63", "#6b6a86", "#8a5a4a",
  "#4d6079", "#7a7150", "#5d7a6a", "#7b5d6e",
];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s.-]/gu, " ").split(/[\s.-]+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * The publisher's own icon where we can get one, a monogram where we cannot.
 *
 * The endpoint draws the monogram itself, so there is one request either way
 * and never a broken image. The local fallback below only covers a source with
 * no site URL at all, such as a topic search the reader added.
 */
export function SourceAvatar({
  name,
  site,
  size = 20,
  className = "",
}: {
  name: string;
  site?: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  let domain = "";
  try {
    if (site) domain = new URL(site).hostname.replace(/^www\./, "");
  } catch {
    domain = "";
  }

  const style = { width: size, height: size } as const;

  if (domain && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/favicon?domain=${encodeURIComponent(domain)}&name=${encodeURIComponent(name)}`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={style}
        className={`shrink-0 rounded-[5px] bg-surface-2 object-contain ${className}`}
      />
    );
  }

  const colour = TILE_COLOURS[hash(name) % TILE_COLOURS.length];
  return (
    <span
      aria-hidden
      style={{ ...style, backgroundColor: colour, fontSize: Math.round(size * 0.42) }}
      className={`grid shrink-0 place-items-center rounded-[5px] font-bold leading-none text-white ${className}`}
    >
      {initials(name)}
    </span>
  );
}
