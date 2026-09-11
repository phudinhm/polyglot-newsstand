"use client";

import {
  ADJECTIVE_ENDINGS,
  ARTICLE_GENDER,
  CASE_GERMAN,
  CASE_SHORT,
  DEFINITE,
  findAdjective,
  findCase,
  normalise,
  type Case,
  type Gender,
} from "@/lib/cases";
import { caseReason, DECLENSION_TEXT, GENDER_TEXT } from "@/lib/explain";
import type { TargetLang } from "@/lib/types";

const CASES: Case[] = ["nominative", "accusative", "dative", "genitive"];
const GENDERS: Gender[] = ["m", "f", "n", "pl"];

const UI = {
  en: {
    heading: "In this sentence",
    likeliest: "likeliest reading",
    articles: "The definite article by case and gender",
    endings: "Adjective endings in this pattern",
    declension: (kind: string) => `${kind} endings`,
  },
  vi: {
    heading: "Trong câu này",
    likeliest: "cách đọc dễ xảy ra nhất",
    articles: "Mạo từ xác định theo cách và giống",
    endings: "Đuôi tính từ theo mẫu này",
    declension: (kind: string) => `đuôi ${kind}`,
  },
} as const;

function Table({
  rows,
  activeCase,
  activeGender,
  caption,
  label,
}: {
  rows: Record<Case, Record<Gender, string>>;
  activeCase: Case;
  activeGender?: Gender;
  caption: string;
  label: (gender: Gender) => string;
}) {
  return (
    <div className="mt-2.5 overflow-x-auto">
      <table className="w-full min-w-[16rem] border-collapse text-[12px] tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-muted">
            <th scope="col" className="w-10 pb-1 text-left font-medium" />
            {GENDERS.map((g) => (
              <th
                key={g}
                scope="col"
                className={`pb-1 text-center font-medium ${g === activeGender ? "text-accent" : ""}`}
              >
                {label(g)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CASES.map((c) => (
            <tr key={c} className={c === activeCase ? "" : "text-muted"}>
              <th
                scope="row"
                className={`py-0.5 pr-2 text-left font-medium ${c === activeCase ? "text-accent" : ""}`}
              >
                {CASE_SHORT[c]}
              </th>
              {GENDERS.map((g) => {
                const hit = c === activeCase && g === activeGender;
                return (
                  <td
                    key={g}
                    lang="de"
                    className={`py-0.5 text-center ${
                      hit
                        ? "rounded-md bg-accent font-semibold text-accent-fg"
                        : c === activeCase || g === activeGender
                          ? "font-medium text-fg"
                          : ""
                    }`}
                  >
                    {rows[c][g]}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Shell({
  ui,
  kasus,
  subtitle,
  certain,
  children,
}: {
  ui: (typeof UI)[TargetLang];
  kasus: Case;
  subtitle: string;
  certain: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          {ui.heading}
        </span>
        <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[12px] font-semibold text-accent">
          {CASE_GERMAN[kasus]}
        </span>
        <span className="text-[12px] text-muted">
          {subtitle}
          {certain ? "" : ` · ${ui.likeliest}`}
        </span>
      </div>
      {children}
    </div>
  );
}

/**
 * Why this word is wearing this ending.
 *
 * Two different questions hide behind that, and answering the wrong one is
 * worse than saying nothing. For a noun it is the article: which case, and
 * what that case plus the noun's gender do to der, die or das. For an
 * adjective the noun's gender is not the adjective's own, and the real
 * question is which of the three ending patterns applies, which depends on
 * what the determiner in front has already marked. Each gets its own table,
 * with the answer lit up where the rule and this sentence meet.
 */
export function CaseCard({
  sentence,
  word,
  surface,
  article,
  plural,
  isAdjective,
  target,
}: {
  sentence: string;
  /** The dictionary form, used in the explanation. */
  word: string;
  /** The form as it appears in the text, used to find it in the sentence. */
  surface: string;
  /** "der", "die" or "das" from the dictionary, for nouns only. */
  article?: string;
  /** The dictionary's plural spelling, for nouns only. */
  plural?: string;
  isAdjective?: boolean;
  target: TargetLang;
}) {
  const ui = UI[target];

  if (isAdjective) {
    const found = findAdjective(sentence, surface);
    if (!found) return null;

    const kind = DECLENSION_TEXT[target][found.declension];
    const phrase = [found.determiner, surface, found.noun].filter(Boolean).join(" ");

    return (
      <Shell
        ui={ui}
        kasus={found.kasus}
        subtitle={[ui.declension(kind), found.gender ? GENDER_TEXT[target][found.gender] : ""]
          .filter(Boolean)
          .join(" · ")}
        certain={Boolean(found.ending)}
      >
        {found.reason && (
          <p className="mt-1.5 text-[13px] leading-relaxed">
            {caseReason(found.reason, found.kasus, target)}
          </p>
        )}

        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          {target === "vi" ? (
            <>
              {found.determiner ? (
                <>
                  Sau{" "}
                  <span className="font-medium text-fg" lang="de">
                    {found.determiner}
                  </span>
                  , tính từ chia theo mẫu <span className="font-medium text-fg">{kind}</span>
                </>
              ) : (
                <>
                  Không có mạo từ đứng trước, nên tính từ tự mang cách và chia theo mẫu{" "}
                  <span className="font-medium text-fg">{kind}</span>
                </>
              )}
              {found.ending ? (
                <>
                  , và ở {CASE_GERMAN[found.kasus]} đuôi là{" "}
                  <span className="font-medium text-fg" lang="de">
                    {found.ending}
                  </span>
                  . Vì vậy:{" "}
                  <span className="font-medium text-fg" lang="de">
                    {phrase}
                  </span>
                  .
                </>
              ) : (
                ". Giống của danh từ chưa xác định được, nên hãy xem cột tương ứng trong bảng."
              )}
            </>
          ) : (
            <>
              {found.determiner ? (
                <>
                  After{" "}
                  <span className="font-medium text-fg" lang="de">
                    {found.determiner}
                  </span>{" "}
                  the adjective follows the <span className="font-medium text-fg">{kind}</span>{" "}
                  pattern
                </>
              ) : (
                <>
                  With no determiner in front, the adjective carries the case itself and follows the{" "}
                  <span className="font-medium text-fg">{kind}</span> pattern
                </>
              )}
              {found.ending ? (
                <>
                  , and in the {CASE_GERMAN[found.kasus]} that ending is{" "}
                  <span className="font-medium text-fg" lang="de">
                    {found.ending}
                  </span>
                  . So:{" "}
                  <span className="font-medium text-fg" lang="de">
                    {phrase}
                  </span>
                  .
                </>
              ) : (
                ". The noun's gender is not pinned down here, so read across the row."
              )}
            </>
          )}
        </p>

        <Table
          rows={ADJECTIVE_ENDINGS[found.declension]}
          activeCase={found.kasus}
          activeGender={found.gender}
          caption={ui.endings}
          label={(g) => (g === "pl" ? "pl" : DEFINITE.nominative[g])}
        />
      </Shell>
    );
  }

  // A neuter, feminine or masculine noun in the plural declines exactly
  // like every other plural - "der Urteile", not "des Urteile" - so the
  // singular gender from the dictionary is the wrong thing to narrow by
  // once the tapped word is actually the plural spelling.
  const isPlural = Boolean(plural) && normalise(surface) === normalise(plural ?? "");
  const gender = isPlural ? "pl" : article ? ARTICLE_GENDER[article] : undefined;
  const finding = findCase(sentence, surface, gender);
  if (!finding) return null;

  const shown = finding.gender ?? gender;
  const sameForm = shown && DEFINITE[finding.kasus][shown] === DEFINITE.nominative[shown];
  // The headword is always the singular dictionary form, which is the wrong
  // spelling to show once the table being read is the plural row.
  const displayNoun = shown === "pl" && plural ? plural : word;

  return (
    <Shell
      ui={ui}
      kasus={finding.kasus}
      subtitle={shown ? GENDER_TEXT[target][shown] : ""}
      certain={finding.certain}
    >
      <p className="mt-1.5 text-[13px] leading-relaxed">
        {caseReason(finding.reason, finding.kasus, target)}
      </p>

      {shown && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          {target === "vi" ? (
            <>
              <span className="font-medium text-fg" lang="de">
                {word}
              </span>{" "}
              thuộc {GENDER_TEXT.vi[shown]}. Đứng một mình là{" "}
              <span className="font-medium text-fg" lang="de">
                {DEFINITE.nominative[shown]} {displayNoun}
              </span>
              {sameForm ? (
                <>
                  , và {GENDER_TEXT.vi[shown]} giữ nguyên{" "}
                  <span className="font-medium text-fg" lang="de">
                    {DEFINITE.nominative[shown]}
                  </span>{" "}
                  cả ở {CASE_GERMAN[finding.kasus]}. Chỉ giống đực mới đổi.
                </>
              ) : (
                <>
                  , ở đây thành{" "}
                  <span className="font-medium text-fg" lang="de">
                    {DEFINITE[finding.kasus][shown]} {displayNoun}
                  </span>
                  .
                </>
              )}
            </>
          ) : (
            <>
              <span className="font-medium text-fg" lang="de">
                {word}
              </span>{" "}
              is {GENDER_TEXT.en[shown]}. On its own it is{" "}
              <span className="font-medium text-fg" lang="de">
                {DEFINITE.nominative[shown]} {displayNoun}
              </span>
              {sameForm ? (
                <>
                  , and {GENDER_TEXT.en[shown]} nouns keep{" "}
                  <span className="font-medium text-fg" lang="de">
                    {DEFINITE.nominative[shown]}
                  </span>{" "}
                  in the {CASE_GERMAN[finding.kasus]} as well. Only masculine changes there.
                </>
              ) : (
                <>
                  , which becomes{" "}
                  <span className="font-medium text-fg" lang="de">
                    {DEFINITE[finding.kasus][shown]} {displayNoun}
                  </span>{" "}
                  here.
                </>
              )}
            </>
          )}
        </p>
      )}

      <Table
        rows={DEFINITE}
        activeCase={finding.kasus}
        activeGender={shown}
        caption={ui.articles}
        label={(g) => (g === "pl" ? "pl" : DEFINITE.nominative[g])}
      />
    </Shell>
  );
}
