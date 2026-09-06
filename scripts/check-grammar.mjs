/**
 * Regression tests for the German analysis.
 *
 * These are the sentences that were getting wrong answers, kept here so they
 * keep getting right ones. Run with `npm run check:grammar`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "grammar-"));
execFileSync(
  "npx",
  ["tsc", "src/lib/cases.ts", "src/lib/grammar.ts", "src/lib/types.ts",
   "--outDir", out, "--module", "esnext", "--target", "es2022",
   "--moduleResolution", "bundler", "--skipLibCheck"],
  { stdio: "inherit" },
);
for (const file of ["grammar.js", "cases.js"]) {
  const path = join(out, file);
  writeFileSync(path, readFileSync(path, "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.js"'));
}

const { analyseSentence } = await import(join(out, "grammar.js"));
const { findCase } = await import(join(out, "cases.js"));

let failures = 0;
const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}${ok ? "" : `\n        expected ${expected}\n        got      ${actual}`}`);
};

const roleOf = (sentence, word) => {
  const note = analyseSentence(sentence, "de").words.find((w) => w.word.toLowerCase() === word);
  return note ? note.role : "(not flagged)";
};

console.log("\nWord roles");
const power = "Nach versuchten Angriffen auf das Stromnetz in Ostsachsen dauert der Polizeieinsatz dort an.";
// The bug that started this: "an" at a full stop is half a verb, not a preposition.
check('"an" at the end of a clause is a separable prefix', roleOf(power, "an"), "Separable prefix");
check('"Nach" is read as a preposition, not as part of "suchen nach"', roleOf(power, "nach"), "Preposition");
check('"auf" belongs to Angriffe', roleOf(power, "auf"), "Part of a fixed pair");
check('"teil" is a separable prefix', roleOf("Er nimmt an der Konferenz teil.", "teil"), "Separable prefix");
check('"auf" in warten auf is a fixed pair', roleOf("Wir warten auf die Entscheidung.", "auf"), "Part of a fixed pair");
check('"mit" is a plain preposition', roleOf("Sie spricht mit dem Minister.", "mit"), "Preposition");

console.log("\nSplit verbs are named");
const split = analyseSentence(power, "de").words.find((w) => w.word.toLowerCase() === "an");
check("andauern is reconstructed", /andauern/.test(split?.detail ?? ""), "true");

console.log("\nCase in context");
const kase = (s, w, g) => {
  const f = findCase(s, w, g);
  return f ? `${f.kasus}${f.certain ? "" : "?"}` : "none";
};
check("auf das Stromnetz", kase(power, "Stromnetz", "n"), "accusative");
check("in dem Garten", kase("Das Kind spielt in dem Garten.", "Garten", "m"), "dative");
check("in den Garten", kase("Er geht in den Garten.", "Garten", "m"), "accusative");
check("wegen des Wetters", kase("Wegen des Wetters bleibt die Schule zu.", "Wetters", "n"), "genitive");
check("mit ihren Kollegen", kase("Sie traf sich mit ihren Kollegen.", "Kollegen"), "dative");
check("im Bundestag", kase("Die Debatte fand im Bundestag statt.", "Bundestag", "m"), "dative");
check("no marker, no claim", kase("Er fährt nach Ostsachsen.", "Ostsachsen"), "dative");
check("bare noun with nothing in front", kase("Stromnetze sind Ziele.", "Ziele"), "none");

console.log(failures ? `\n${failures} failing\n` : "\nAll good\n");
process.exit(failures ? 1 : 0);
