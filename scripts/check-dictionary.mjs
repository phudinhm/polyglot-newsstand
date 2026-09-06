/**
 * Fixture tests for the Wiktionary parsing.
 *
 * Wiktionary is built from strict templates and loose prose, and this is the
 * layer that turns one into the other. The fixture is a trimmed copy of a real
 * page, so a template change shows up here rather than in the app.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "dict-"));
execFileSync("npx", ["tsc", "src/lib/dictionary.ts", "--outDir", out, "--module", "esnext",
  "--target", "es2022", "--moduleResolution", "bundler", "--skipLibCheck"],
  { stdio: "inherit" });

// tsc emits the import specifiers verbatim, which Node will not resolve.
for (const file of readdirSync(out).filter((f) => f.endsWith(".js"))) {
  const path = join(out, file);
  writeFileSync(path, readFileSync(path, "utf8").replace(/from "(\.\/[\w/]+)"/g, 'from "$1.js"'));
}

const { parseGerman } = await import(join(out, "dictionary.js"));

const STROMNETZ = `
== Stromnetz ({{Sprache|Deutsch}}) ==
=== {{Wortart|Substantiv|Deutsch}}, {{n}} ===

{{Deutsch Substantiv Übersicht
|Genus=n
|Nominativ Singular=Stromnetz
|Nominativ Plural=Stromnetze
|Genitiv Singular=Stromnetzes
}}

{{Aussprache}}
:{{IPA}} {{Lautschrift|ˈʃtʁoːmˌnɛt͡s}}

{{Bedeutungen}}
:[1] Gesamtheit der Leitungen, über die elektrische Energie verteilt wird

{{Beispiele}}
:[1] „Das ''Stromnetz'' in Ostsachsen war stundenlang unterbrochen.“<ref>Quelle</ref>
:[1] Ein stabiles ''Stromnetz'' ist die Grundlage der Versorgung.
:[1] kurz

{{Charakteristische Wortkombinationen}}
:[1] das Stromnetz ausbauen, ein stabiles Stromnetz
`;

let failures = 0;
const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}${ok ? "" : `\n        expected ${expected}\n        got      ${actual}`}`);
};

const entry = parseGerman("Stromnetz", STROMNETZ);
console.log("\nGerman noun page");
check("article", entry.article, "das");
check("plural", entry.plural, "Stromnetze");
check("singular", entry.singular, "Stromnetz");
check("pronunciation", entry.ipa, "ˈʃtʁoːmˌnɛt͡s");
check("definition", entry.senses[0].definitions[0].startsWith("Gesamtheit der Leitungen"), "true");

console.log("\nExamples");
check("two usable examples, the short one dropped", entry.examples.length, 2);
check("markers and italics stripped",
  entry.examples[0].text,
  "„Das Stromnetz in Ostsachsen war stundenlang unterbrochen.“");
check("footnote removed", /Quelle/.test(entry.examples[0].text), "false");
check("second example", entry.examples[1].text, "Ein stabiles Stromnetz ist die Grundlage der Versorgung.");

console.log("\nCollocations");
check("split on commas", entry.collocations.length, 2);
check("first phrase", entry.collocations[0], "das Stromnetz ausbauen");

console.log(failures ? `\n${failures} failing\n` : "\nAll good\n");
process.exit(failures ? 1 : 0);
