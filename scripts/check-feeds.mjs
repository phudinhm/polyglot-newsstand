/**
 * Feed parsing, against the shapes that broke in the wild.
 *
 * These are not hypotheticals: each fixture here reproduces a failure a reader
 * actually hit, reported by the app's own source check. Run with
 * `npm run check:feeds`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Compiled inside the project so the parser resolves from node_modules the
// same way it does at runtime.
const out = mkdtempSync(join(process.cwd(), ".check-"));
process.on("exit", () => rmSync(out, { recursive: true, force: true }));
execFileSync("npx", ["tsc", "src/lib/rss.ts", "--outDir", out, "--module", "esnext",
  "--target", "es2022", "--moduleResolution", "bundler", "--skipLibCheck"], { stdio: "inherit" });
for (const file of readdirSync(out).filter((f) => f.endsWith(".js"))) {
  const path = join(out, file);
  writeFileSync(path, readFileSync(path, "utf8").replace(/from "(\.\/[\w/]+)"/g, 'from "$1.js"'));
}
const { parseFeed, stripHtml } = await import(join(out, "rss.js"));

let failures = 0;
const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}${ok ? "" : `\n        expected ${expected}\n        got      ${actual}`}`);
};

const source = {
  id: "test", name: "Test", lang: "de", category: "top", level: "medium",
  feed: "https://example.com/feed", site: "https://example.com",
};

console.log("\nA feed that declares its own entities");
// Several German publishers ship a DOCTYPE declaring the HTML entity set.
// Every declared entity is scanned against every text value, and the parser's
// default budget of 1000 expansions is spent long before the feed ends. This
// took out Nachrichtenleicht, the Guardian and Business Insider at once, and
// the reader was told the publisher had not answered.
const declared = ["auml", "ouml", "uuml", "szlig", "ndash", "bdquo", "ldquo", "hellip"];
const doctype = `<!DOCTYPE rss [${declared.map((n, i) => `<!ENTITY ${n} "&#${228 + i};">`).join("")}]>`;
const heavy = `<?xml version="1.0" encoding="UTF-8"?>${doctype}<rss version="2.0"><channel><title>Test</title>${
  Array.from({ length: 60 }, (_, i) => `<item>
    <title>Warnstreik in den Seeh&auml;fen &ndash; L&ouml;hne und Zulagen ${i}</title>
    <link>https://example.com/${i}</link>
    <description>Gr&ouml;&szlig;ere Betriebe &auml;u&szlig;ern sich nicht &hellip; &bdquo;faire&ldquo; Schichten.</description>
  </item>`).join("")
}</channel></rss>`;
// Before the fix this threw and the whole feed was dropped; parseFeed caps
// each source at 40 items, so a healthy parse of a 60-item feed returns 40.
check("the feed parses rather than being dropped", parseFeed(heavy, source).length, 40);

console.log("\nCharacter references become characters");
// A German headline arriving as "Seeh&auml;fen" is wrong on the shelf, wrong
// read aloud, and wrong when the word underneath gets looked up.
check("named letters", stripHtml("Warnstreik in den Seeh&auml;fen"), "Warnstreik in den Seehäfen");
check("sharp s", stripHtml("Gr&ouml;&szlig;ere Betriebe"), "Größere Betriebe");
check("typography", stripHtml("L&ouml;hne &ndash; und &bdquo;faire&ldquo; Schichten"), "Löhne \u2013 und \u201efaire\u201c Schichten");
check("decimal references", stripHtml("Seeh&#228;fen"), "Seehäfen");
check("hex references", stripHtml("Seeh&#xE4;fen"), "Seehäfen");
check("currency", stripHtml("Kosten: 12&nbsp;Mio. &euro;"), "Kosten: 12 Mio. €");
check("case is not flattened", stripHtml("&Auml;pfel und &auml;hnliches"), "Äpfel und ähnliches");
check("the six it already knew", stripHtml("Zoll &amp; Handel &lt;live&gt;"), "Zoll & Handel <live>");
check("an unknown name is left alone", stripHtml("a &notarealentity; b"), "a &notarealentity; b");
check("tags still go", stripHtml("<p>Ein <b>kurzer</b> Anriss.</p>"), "Ein kurzer Anriss.");

console.log("\nOrdinary feeds still parse");
const plain = `<?xml version="1.0"?><rss version="2.0"><channel><title>Plain</title>
  <item><title>Erste Meldung</title><link>https://example.com/1</link>
    <description>Ein kurzer Anriss.</description>
    <pubDate>Sun, 06 Sep 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
const plainItems = parseFeed(plain, source);
check("one item", plainItems.length, 1);
check("title", plainItems[0].title, "Erste Meldung");

const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title>
  <entry><title>Zweite Meldung</title><link href="https://example.com/2"/>
    <summary>Noch ein Anriss.</summary><updated>2026-09-06T08:00:00Z</updated></entry></feed>`;
check("atom", parseFeed(atom, source)[0]?.title, "Zweite Meldung");

console.log(failures ? `\n${failures} failing\n` : "\nAll good\n");
process.exit(failures ? 1 : 0);
