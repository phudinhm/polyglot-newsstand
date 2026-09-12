import { NextResponse } from "next/server";
import { TtlCache } from "@/lib/cache";
import { extractArticle } from "@/lib/extract";
import { assertSafeUrl, FetchError, fetchText } from "@/lib/fetcher";
import { isGoogleNewsUrl, resolveGoogleNewsUrl } from "@/lib/googleNews";
import type { Article, SourceLang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const articleCache = new TtlCache<Article>(30 * 60 * 1000, 300);

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const target = params.get("url");
  const requested = params.get("lang");
  const lang: SourceLang = requested === "en" ? "en" : requested === "vi" ? "vi" : "de";

  if (!target) {
    return NextResponse.json({ error: "Missing ?url" }, { status: 400 });
  }

  try {
    const rawSafe = assertSafeUrl(target);
    const requestedUrl = rawSafe.toString();
    const cacheKey = `${requestedUrl}|${lang}`;
    const cached = articleCache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    // If this is an obfuscated Google News redirect link, decode it to the real publisher's URL
    let fetchUrl = requestedUrl;
    if (isGoogleNewsUrl(requestedUrl)) {
      fetchUrl = await resolveGoogleNewsUrl(requestedUrl);
    }
    const safeFetch = assertSafeUrl(fetchUrl);
    const fetchUrlString = safeFetch.toString();

    // Check cache for the decoded URL if different
    if (fetchUrlString !== requestedUrl) {
      const decodedCached = articleCache.get(`${fetchUrlString}|${lang}`);
      if (decodedCached) {
        articleCache.set(cacheKey, decodedCached);
        return NextResponse.json(decodedCached);
      }
    }

    // Some publishers answer 406 to a specific Accept header but serve the
    // same page happily to a plain one, so a rejection earns a second try.
    let html: string;
    try {
      html = await fetchText(fetchUrlString, {
        timeoutMs: 15_000,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      });
    } catch (first) {
      const status = first instanceof FetchError ? first.status : undefined;
      if (status !== 406 && status !== 403) throw first;
      html = await fetchText(fetchUrlString, { timeoutMs: 15_000, accept: "*/*" });
    }
    const article = extractArticle(html, fetchUrlString, lang);

    if (!article.blocks.length) {
      return NextResponse.json(
        {
          error:
            "This publisher does not let us read the article text. Open it on their site, or pick another source.",
          url: fetchUrlString,
        },
        { status: 422 },
      );
    }

    articleCache.set(cacheKey, article);
    if (fetchUrlString !== requestedUrl) {
      articleCache.set(`${fetchUrlString}|${lang}`, article);
    }
    return NextResponse.json(article, {
      headers: { "cache-control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    });
  } catch (err) {
    const status = err instanceof FetchError && err.status ? err.status : 502;
    return NextResponse.json(
      {
        error:
          status === 403 || status === 401
            ? "The publisher blocked this request, which usually means a paywall."
            : err instanceof Error
              ? err.message
              : "Could not load the article.",
      },
      { status: status === 403 || status === 401 ? 451 : status },
    );
  }
}
