#!/usr/bin/env node
/**
 * Feed health check.
 *
 * Publishers move and retire RSS URLs without notice, so run this whenever the
 * newsstand looks thin:
 *
 *   npm run check:sources
 *   npm run check:sources -- --lang de
 *
 * It reports the HTTP status, the item count and the response time for every
 * feed in src/lib/sources.ts, so a dead entry is obvious at a glance.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sourcesPath = join(here, "..", "src", "lib", "sources.ts");

const args = process.argv.slice(2);
const langFilter = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : null;
const strict = args.includes("--strict");
const TIMEOUT_MS = 15_000;
const CONCURRENCY = 6;

const UA =
  process.env.USER_AGENT ??
  "Mozilla/5.0 (compatible; PolyglotNewsstand/1.0; +https://github.com/phudinhm/polyglot-newsstand)";

/** The catalog is plain data, so a targeted regex beats pulling in a TS loader. */
function parseSources(ts) {
  const out = [];
  const objects = ts.split(/\n\s{2}\{\n/).slice(1);
  for (const chunk of objects) {
    const pick = (key) => new RegExp(`${key}:\\s*"([^"]+)"`).exec(chunk)?.[1];
    const id = pick("id");
    const feed = pick("feed");
    if (id && feed) out.push({ id, name: pick("name") ?? id, lang: pick("lang") ?? "?", feed });
  }
  return out;
}

async function check(source) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(source.feed, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": UA,
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        "accept-language": "de,en;q=0.9",
      },
    });
    const body = await res.text();
    const items = (body.match(/<item[\s>]|<entry[\s>]/g) ?? []).length;
    return {
      ...source,
      ok: res.ok && items > 0,
      status: res.status,
      items,
      ms: Date.now() - started,
      note: res.ok && items === 0 ? "responded but contained no items" : "",
    };
  } catch (err) {
    return {
      ...source,
      ok: false,
      status: 0,
      items: 0,
      ms: Date.now() - started,
      note: err.name === "AbortError" ? `timed out after ${TIMEOUT_MS}ms` : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

const ts = await readFile(sourcesPath, "utf8");
let sources = parseSources(ts);
if (langFilter) sources = sources.filter((s) => s.lang === langFilter);

if (!sources.length) {
  console.error("No sources found. Has src/lib/sources.ts changed shape?");
  process.exit(1);
}

console.log(`Checking ${sources.length} feeds\n`);

const results = [];
for (let i = 0; i < sources.length; i += CONCURRENCY) {
  const batch = await Promise.all(sources.slice(i, i + CONCURRENCY).map(check));
  for (const r of batch) {
    results.push(r);
    const mark = r.ok ? "ok  " : "FAIL";
    const detail = r.ok ? `${String(r.items).padStart(3)} items` : r.note || `HTTP ${r.status}`;
    console.log(
      `${mark}  ${r.lang}  ${r.id.padEnd(18)} ${String(r.ms).padStart(5)}ms  ${detail}`,
    );
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} feeds healthy.`);
if (failed.length) {
  console.log("\nNeeds attention:");
  for (const f of failed) console.log(`  ${f.id} (${f.name})\n    ${f.feed}\n    ${f.note || `HTTP ${f.status}`}`);
  console.log("\nEdit or remove these in src/lib/sources.ts.");
}
process.exit(strict && failed.length ? 1 : 0);
