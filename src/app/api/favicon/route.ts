import { SOURCES } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Publisher icons, fetched by us rather than by the browser.
 *
 * Asking the reader's browser for each publisher's favicon would tell every
 * one of them what is on the shelf, and a third-party icon service would learn
 * the same thing. This proxies a small, cached image instead, and only for
 * hosts in our own catalogue, so it cannot be used as a general image proxy.
 *
 * It never fails: a publisher without a reachable icon gets a generated
 * monogram. An endpoint that 404s would leave broken images and a console full
 * of network errors on every page.
 */
const ALLOWED_HOSTS = new Set(
  SOURCES.map((s) => {
    try {
      return new URL(s.site).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }).filter(Boolean),
);

const CANDIDATES = ["/favicon.ico", "/apple-touch-icon.png", "/favicon.png"];
const MAX_BYTES = 120_000;
const PER_TRY_MS = 3_500;
/** Three slow candidates in a row would be worse than no icon at all. */
const TOTAL_BUDGET_MS = 5_000;

/**
 * Publishers that gave us nothing, remembered for an hour. Without this every
 * card on the shelf would pay the full timeout again on the next request.
 */
const misses = new Map<string, number>();
const MISS_TTL_MS = 60 * 60 * 1000;
const CACHE = "public, max-age=604800, s-maxage=2592000, immutable";
const UA =
  process.env.USER_AGENT ??
  "Mozilla/5.0 (compatible; PolyglotNewsstand/1.0; +https://github.com/phudinhm/polyglot-newsstand)";

const TILE_COLOURS = [
  "#8a6f4e", "#4f6d63", "#6b6a86", "#8a5a4a",
  "#4d6079", "#7a7150", "#5d7a6a", "#7b5d6e",
];

function monogram(label: string): Response {
  const words = label.replace(/[^\p{L}\p{N}\s.-]/gu, " ").split(/[\s.-]+/).filter(Boolean);
  const initials = (
    words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)
  ).toUpperCase();

  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) | 0;
  const colour = TILE_COLOURS[Math.abs(hash) % TILE_COLOURS.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${colour}"/><text x="32" y="43" text-anchor="middle" font-family="system-ui, sans-serif" font-size="30" font-weight="700" fill="#ffffff">${initials}</text></svg>`;

  return new Response(svg, {
    headers: { "content-type": "image/svg+xml", "cache-control": CACHE },
  });
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const domain = params.get("domain")?.toLowerCase().replace(/^www\./, "") ?? "";
  const label = params.get("name") || domain || "?";

  // Not one of ours: draw something rather than reaching out to a stranger.
  if (!domain || !ALLOWED_HOSTS.has(domain)) return monogram(label);

  const missedAt = misses.get(domain);
  if (missedAt && Date.now() - missedAt < MISS_TTL_MS) return monogram(label);

  const started = Date.now();
  for (const path of CANDIDATES) {
    if (Date.now() - started > TOTAL_BUDGET_MS) break;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PER_TRY_MS);
      const res = await fetch(`https://${domain}${path}`, {
        signal: controller.signal,
        headers: { "user-agent": UA, accept: "image/*" },
        redirect: "follow",
      });
      clearTimeout(timer);
      if (!res.ok) continue;

      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) continue;

      const buffer = await res.arrayBuffer();
      if (!buffer.byteLength || buffer.byteLength > MAX_BYTES) continue;

      return new Response(buffer, {
        headers: { "content-type": type, "cache-control": CACHE },
      });
    } catch {
      // Try the next candidate path.
    }
  }

  misses.set(domain, Date.now());
  return monogram(label);
}
