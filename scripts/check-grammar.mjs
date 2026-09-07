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
  ["tsc", "src/lib/cases.ts", "src/lib/grammar.ts", "src/lib/explain.ts", "src/lib/types.ts",
   "--outDir", out, "--module", "esnext", "--target", "es2022",
   "--moduleResolution", "bundler", "--skipLibCheck"],
  { stdio: "inherit" },
);
for (const file of ["grammar.js", "cases.js", "explain.js"]) {
  const path = join(out, file);
  writeFileSync(path, readFileSync(path, "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.js"'));
}

const { analyseSentence } = await import(join(out, "grammar.js"));
const { findCase, findAdjective, declensionAfter } = await import(join(out, "cases.js"));
const { noteRole, noteDetail, caseReason, sentenceNoteText } = await import(join(out, "explain.js"));

let failures = 0;
const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}${ok ? "" : `\n        expected ${expected}\n        got      ${actual}`}`);
};

const noteFor = (sentence, word) =>
  analyseSentence(sentence, "de").words.find((w) => w.word.toLowerCase() === word);
const roleOf = (sentence, word) => {
  const note = noteFor(sentence, word);
  return note ? noteRole(note, "en") : "(not flagged)";
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

console.log("\nWords that only look like prepositions");
// The reported case: zu in front of an infinitive is not a dative preposition.
const debt = "Der Schuldenberg der USA ist so gigantisch, dass es schwieriger wird, freiwillige Gläubiger zu finden.";
check('"zu" before an infinitive', roleOf(debt, "zu"), "Infinitive marker");
check('"zu" before an adjective means too', roleOf("Das Haus ist zu klein.", "zu"), "Intensifier");
check('"zu" before an article is a preposition', roleOf("Sie geht zu dem Haus.", "zu"), "Preposition");
check('"während" as a conjunction is not flagged', roleOf("Während er schlief, klingelte das Telefon.", "während"), "(not flagged)");
check('"während" with a noun is a preposition', roleOf("Während des Krieges floh die Familie.", "während"), "Preposition");
check('"um" opening an infinitive clause', roleOf("Er kam, um freiwillige Gläubiger zu finden.", "um"), "Infinitive clause");
check('"um" with a noun is a preposition', roleOf("Sie stritten um das Geld.", "um"), "Preposition");

console.log("\nsein, haben and werden are not always auxiliaries");
check('"ist" with an adjective is the main verb', roleOf(debt, "ist"), "Main verb");
check('"wird" with an adjective is the main verb', roleOf(debt, "wird"), "Main verb");
check('"hat" with a participle is an auxiliary',
  roleOf("Die Ministerin hat sich mit ihren Kollegen getroffen.", "hat"), "Perfect auxiliary");
check('"hat" with an object is the main verb', roleOf("Er hat ein Auto.", "hat"), "Main verb");
check('"wird" with a participle is passive', roleOf("Das Haus wird gebaut.", "wird"), "Passive auxiliary");
check('"wird" with an infinitive is future', roleOf("Er wird morgen kommen.", "wird"), "Future auxiliary");
check('"ist" with a participle is an auxiliary', roleOf("Sie ist nach Berlin gefahren.", "ist"), "Perfect auxiliary");
check('a modal is still a modal', roleOf("Er muss das Buch lesen.", "muss"), "Modal verb");

console.log("\nInfinitive clauses");
const clauses = analyseSentence(debt, "de").clauses;
check("three clauses", clauses.length, 3);
check("the last one is an Infinitivsatz", clauses[2].kind, "infinitive");
check("and claims no finite verb", clauses[2].finiteVerb ?? "none", "none");
check("the dass clause is subordinate", clauses[1].kind, "subordinate");
check("its verb is at the end", clauses[1].finiteVerb, "wird");
// The note used to claim "um … zu" on any infinitive clause, um or no um.
const debtNotes = analyseSentence(debt, "de").notes.map((n) => sentenceNoteText(n, "en"));
check("no um in the sentence, no um in the note", debtNotes.some((n) => n.includes("um …")), "false");
check("the bare infinitive clause is named", debtNotes.some((n) => n.includes("no subject of its own")), "true");
const purpose = analyseSentence("Er kam, um Gläubiger zu finden.", "de").notes.map((n) => sentenceNoteText(n, "en"));
check("um … zu is named when it is there", purpose.some((n) => n.includes("um … zu")), "true");
check("notes speak Vietnamese too",
  analyseSentence(debt, "de").notes.some((n) => /mệnh đề/.test(sentenceNoteText(n, "vi"))), "true");

console.log("\nSplit verbs are named");
const split = noteFor(power, "an");
check("andauern is reconstructed", /andauern/.test(noteDetail(split, "en")), "true");

console.log("\nExplanations follow the reader's language");
check("Vietnamese role", noteRole(split, "vi"), "Tiền tố tách rời");
check("Vietnamese detail names the verb", /andauern/.test(noteDetail(split, "vi")), "true");
check("Vietnamese detail has no English left", /preposition|split off/i.test(noteDetail(split, "vi")), "false");
const mit = noteFor("Sie traf sich mit ihren Kollegen.", "mit");
check("Vietnamese preposition detail", /Dativ/.test(noteDetail(mit, "vi")), "true");
const nach = findCase(power, "Angriffen");
check("Vietnamese case reason", /luôn đi với/.test(caseReason(nach.reason, nach.kasus, "vi")), "true");
check("English case reason", /always takes/.test(caseReason(nach.reason, nach.kasus, "en")), "true");

console.log("\nAdjective endings");
// The reported case: klein is an adjective, so the article table is the wrong
// lesson. What matters is which ending pattern the determiner selects.
const cemetery = "Auf dem kleinen Friedhof hängen sieben davon.";
const adj = findAdjective(cemetery, "kleinen");
check("case", adj?.kasus, "dative");
check("declension after a definite article", adj?.declension, "weak");
check("ending", adj?.ending, "-en");
check("noun it describes", adj?.noun, "Friedhof");
check("determiner", adj?.determiner, "dem");
const strong = findAdjective("Er trinkt kalten Kaffee.", "kalten");
// Nothing marks the case there, so no claim is made rather than a guess.
check("nothing marks the case, so no claim", strong ? strong.declension : "none", "none");
// Here the preposition does mark it, and the ending it wears settles the rest.
const bare = findAdjective(power, "versuchten");
check("strong pattern with no determiner", bare?.declension, "strong");
check("dative from the preposition", bare?.kasus, "dative");
check("plural from the ending it wears", bare?.gender, "pl");
check("ending", bare?.ending, "-en");
const mixed = findAdjective("Das ist ein kleines Haus.", "kleines");
check("after ein the pattern is mixed", mixed?.declension, "mixed");
check("mixed nominative neuter", mixed?.ending, "-es");
check("weak after dieser", declensionAfter("dieser"), "weak");
check("mixed after keinem", declensionAfter("keinem"), "mixed");
check("strong with nothing", declensionAfter(undefined), "strong");

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
