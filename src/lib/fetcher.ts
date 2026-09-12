const DEFAULT_UA =
  process.env.USER_AGENT ??
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

/**
 * fetch with a hard timeout and a browser-ish header set. Several publishers
 * return 403 to bare fetch calls, so we look like a normal reader.
 */
export async function fetchText(
  url: string,
  { timeoutMs = 10_000, accept = "*/*" }: { timeoutMs?: number; accept?: string } = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": DEFAULT_UA,
        accept,
        "accept-language": "de,en;q=0.9",
      },
      // We do our own caching; Next's fetch cache would pin stale feeds.
      cache: "no-store",
    });
    if (!res.ok) {
      throw new FetchError(`Upstream responded ${res.status}`, res.status);
    }
    return await res.text();
  } catch (err) {
    if (err instanceof FetchError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new FetchError(`Timed out after ${timeoutMs}ms`);
    }
    throw new FetchError(err instanceof Error ? err.message : "Network error");
  } finally {
    clearTimeout(timer);
  }
}

/** Only http(s), and never a private address: these URLs come from the client. */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError("Not a valid URL", 400);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new FetchError("Only http and https URLs are supported", 400);
  }
  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "[::1]";
  if (blocked) {
    throw new FetchError("Refusing to fetch a private address", 400);
  }
  return url;
}
