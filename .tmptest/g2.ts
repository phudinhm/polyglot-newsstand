import { analyseSentence } from "./grammar.ts";
for (const c of [
  "Die Strompreise sind gesunken.",
  "Am Montag hat sich die Ministerin mit ihren Kollegen im Bundestag getroffen.",
  "Wegen der hohen Kosten muss das Unternehmen sparen.",
]) {
  const s = analyseSentence(c, "de");
  console.log("\n---", c);
  if (s.trivial) { console.log("  (nothing to say)"); continue; }
  for (const cl of s.clauses) console.log(`  [${cl.kind}]${cl.finiteVerb ? ` verb=${cl.finiteVerb}` : ""}`);
  for (const w of s.words) console.log(`  ${w.word} — ${w.role}: ${w.detail}`);
  for (const n of s.notes) console.log("  note:", n);
}
