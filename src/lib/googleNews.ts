import { TtlCache } from "./cache";

const googleNewsCache = new TtlCache<string>(24 * 60 * 60 * 1000, 1000);

/**
 * Detect whether a URL is an obfuscated Google News article redirect link.
 */
export function isGoogleNewsUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (host !== "news.google.com" && !host.endsWith(".news.google.com")) {
      return false;
    }
    const path = url.pathname;
    return (
      path.startsWith("/rss/articles/") ||
      path.startsWith("/articles/") ||
      path.startsWith("/read/")
    );
  } catch {
    return false;
  }
}

function getBase64Token(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last || null;
  } catch {
    return null;
  }
}

function tryExtractPlaintextUrl(base64Str: string): string | null {
  try {
    const buf = Buffer.from(base64Str, "base64");
    const str = buf.toString("latin1");
    const match = str.match(/https?:\/\/[^\s"'<>\x00-\x1f\x7f-\xff]+/);
    if (match) return match[0];
  } catch {
    // ignore
  }
  return null;
}

async function executeBatchDecode(
  sourceUrl: string,
  base64Str: string,
  signature: string,
  timestamp: string,
): Promise<string> {
  const payload = [
    "Fbv4je",
    `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${base64Str}",${timestamp},"${signature}"]`,
  ];

  const body = new URLSearchParams({
    "f.req": JSON.stringify([[payload]]),
  }).toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      body,
      cache: "no-store",
    });

    if (!res.ok) return sourceUrl;
    const text = await res.text();
    const parts = text.split("\n\n");
    if (parts.length < 2) return sourceUrl;

    const parsedData = JSON.parse(parts[1]);
    const innerJson = JSON.parse(parsedData[0][2]);
    const decodedUrl = innerJson[1];

    if (typeof decodedUrl === "string" && decodedUrl.startsWith("http")) {
      googleNewsCache.set(sourceUrl, decodedUrl);
      return decodedUrl;
    }
  } catch {
    // fallback
  } finally {
    clearTimeout(timer);
  }
  return sourceUrl;
}

/**
 * Resolve an obfuscated Google News URL (news.google.com/rss/articles/...)
 * into the real publisher destination URL.
 */
export async function resolveGoogleNewsUrl(sourceUrl: string): Promise<string> {
  if (!isGoogleNewsUrl(sourceUrl)) return sourceUrl;

  const cached = googleNewsCache.get(sourceUrl);
  if (cached) return cached;

  const base64Str = getBase64Token(sourceUrl);
  if (!base64Str) return sourceUrl;

  // Quick fallback: check if plaintext URL is embedded in base64
  const plainUrl = tryExtractPlaintextUrl(base64Str);
  if (plainUrl && (plainUrl.startsWith("http://") || plainUrl.startsWith("https://"))) {
    googleNewsCache.set(sourceUrl, plainUrl);
    return plainUrl;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const pageRes = await fetch(`https://news.google.com/rss/articles/${base64Str}`, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
        cookie:
          "SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjQwMjA2LjA3X3AwGgJkZSACGgJkZSIBAQ;",
      },
      cache: "no-store",
    }).finally(() => clearTimeout(timer));

    if (pageRes.ok) {
      const html = await pageRes.text();
      const sgMatch = html.match(/data-n-a-sg="([^"]+)"/);
      const tsMatch = html.match(/data-n-a-ts="([^"]+)"/);
      if (sgMatch && tsMatch) {
        return await executeBatchDecode(sourceUrl, base64Str, sgMatch[1], tsMatch[1]);
      }
    }

    // Try fallback articles URL format
    const fallbackController = new AbortController();
    const fallbackTimer = setTimeout(() => fallbackController.abort(), 6000);
    const fallbackRes = await fetch(`https://news.google.com/articles/${base64Str}`, {
      signal: fallbackController.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
        cookie:
          "SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjQwMjA2LjA3X3AwGgJkZSACGgJkZSIBAQ;",
      },
      cache: "no-store",
    }).finally(() => clearTimeout(fallbackTimer));

    if (fallbackRes.ok) {
      const fallbackHtml = await fallbackRes.text();
      const fbSg = fallbackHtml.match(/data-n-a-sg="([^"]+)"/);
      const fbTs = fallbackHtml.match(/data-n-a-ts="([^"]+)"/);
      if (fbSg && fbTs) {
        return await executeBatchDecode(sourceUrl, base64Str, fbSg[1], fbTs[1]);
      }
    }
  } catch {
    // fallback
  }

  return sourceUrl;
}
