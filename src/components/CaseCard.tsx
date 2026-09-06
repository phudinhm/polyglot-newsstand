"use client";

import {
  ARTICLE_GENDER,
  CASE_GERMAN,
  CASE_SHORT,
  DEFINITE,
  GENDER_LABEL,
  findCase,
  type Case,
  type Gender,
} from "@/lib/cases";

const CASES: Case[] = ["nominative", "accusative", "dative", "genitive"];
const GENDERS: Gender[] = ["m", "f", "n", "pl"];

/**
 * Why this word is wearing this ending.
 *
 * "Dative" on its own teaches nothing. What a reader needs is the chain: this
 * preposition forces this case, this noun has this gender, and those two
 * together are why the article in front of it looks the way it does. The table
 * is the same one every German course hands out, with the answer lit up in it
 * so the rule and the instance are visible at once.
 */
export function CaseCard({
  sentence,
  word,
  article,
}: {
  sentence: string;
  word: string;
  /** "der", "die" or "das" from the dictionary, when the word is a noun. */
  article?: string;
}) {
  const gender = article ? ARTICLE_GENDER[article] : undefined;
  const finding = findCase(sentence, word, gender);
  if (!finding) return null;

  const shown = finding.gender ?? gender;

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          In this sentence
        </span>
        <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[12px] font-semibold text-accent">
          {CASE_GERMAN[finding.kasus]}
        </span>
        <span className="text-[12px] text-muted">
          {finding.kasus}
          {shown ? ` · ${GENDER_LABEL[shown]}` : ""}
          {finding.certain ? "" : " · likeliest reading"}
        </span>
      </div>

      <p className="mt-1.5 text-[13px] leading-relaxed">{finding.reason}</p>

      {shown && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          <span className="font-medium text-fg" lang="de">
            {word}
          </span>{" "}
          is {GENDER_LABEL[shown]}. On its own it is{" "}
          <span className="font-medium text-fg" lang="de">
            {DEFINITE.nominative[shown]} {word}
          </span>
          {DEFINITE[finding.kasus][shown] === DEFINITE.nominative[shown] ? (
            <>
              , and {GENDER_LABEL[shown]} nouns keep{" "}
              <span className="font-medium text-fg" lang="de">
                {DEFINITE.nominative[shown]}
              </span>{" "}
              in the {finding.kasus} as well. Only masculine changes there.
            </>
          ) : (
            <>
              , which becomes{" "}
              <span className="font-medium text-fg" lang="de">
                {DEFINITE[finding.kasus][shown]} {word}
              </span>{" "}
              here.
            </>
          )}
        </p>
      )}

      <div className="mt-2.5 overflow-x-auto">
        <table className="w-full min-w-[16rem] border-collapse text-[12px] tabular-nums">
          <caption className="sr-only">The definite article by case and gender</caption>
          <thead>
            <tr className="text-muted">
              <th scope="col" className="w-10 pb-1 text-left font-medium" />
              {GENDERS.map((g) => (
                <th
                  key={g}
                  scope="col"
                  className={`pb-1 text-center font-medium ${g === shown ? "text-accent" : ""}`}
                >
                  {g === "pl" ? "pl" : DEFINITE.nominative[g]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CASES.map((c) => (
              <tr key={c} className={c === finding.kasus ? "" : "text-muted"}>
                <th
                  scope="row"
                  className={`py-0.5 pr-2 text-left font-medium ${c === finding.kasus ? "text-accent" : ""}`}
                >
                  {CASE_SHORT[c]}
                </th>
                {GENDERS.map((g) => {
                  const hit = c === finding.kasus && g === shown;
                  return (
                    <td
                      key={g}
                      lang="de"
                      className={`py-0.5 text-center ${
                        hit
                          ? "rounded-md bg-accent font-semibold text-accent-fg"
                          : c === finding.kasus || g === shown
                            ? "font-medium text-fg"
                            : ""
                      }`}
                    >
                      {DEFINITE[c][g]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
