import type { SourceLang, TargetLang } from "./types";

/**
 * Spells out a numeral the way a reader in that language would say it, so a
 * number can be tapped and heard exactly like any other word instead of
 * sitting outside the vocabulary system.
 *
 * Deliberately not a certified number-to-text engine: it covers the
 * magnitudes a news article actually uses (up to hundreds of billions, or
 * hundreds of billions/tỷ for Vietnamese) and accepts a small grammatical
 * rough edge on rare compounds like "...101 Millionen" in German, where the
 * trailing "eins" should agree with the following noun's gender. Anything
 * larger, or anything that doesn't parse as a plain number, returns null so
 * the caller can fall back to showing nothing rather than a wrong reading.
 */

type Lang = SourceLang | TargetLang;

const ONES_DE = ["", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
const TEENS_DE = [
  "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn",
  "sechzehn", "siebzehn", "achtzehn", "neunzehn",
];
const TENS_DE = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];

function chunkDE(n: number): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let out = "";
  if (h > 0) out += ONES_DE[h] + "hundert";
  if (rest > 0) {
    if (rest < 10) out += rest === 1 ? "eins" : ONES_DE[rest];
    else if (rest < 20) out += TEENS_DE[rest - 10];
    else {
      const t = Math.floor(rest / 10);
      const o = rest % 10;
      out += (o > 0 ? ONES_DE[o] + "und" : "") + TENS_DE[t];
    }
  }
  return out;
}

function integerToWordsDE(n: number): string {
  if (n === 0) return "null";
  const groups: number[] = [];
  let x = n;
  while (x > 0) {
    groups.unshift(x % 1000);
    x = Math.floor(x / 1000);
  }
  const singular = ["", "tausend", "Million", "Milliarde", "Billion"];
  const plural = ["", "tausend", "Millionen", "Milliarden", "Billionen"];
  const total = groups.length;
  const parts: string[] = [];
  groups.forEach((g, i) => {
    if (g === 0) return;
    const scale = total - 1 - i;
    if (scale === 0) parts.push(chunkDE(g));
    else if (scale === 1) parts.push((g === 1 ? "ein" : chunkDE(g)) + "tausend");
    else parts.push(`${g === 1 ? "eine" : chunkDE(g)} ${g === 1 ? singular[scale] : plural[scale]}`);
  });
  return parts.join(" ");
}

const ONES_EN = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const TEENS_EN = [
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS_EN = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function chunkEN(n: number): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(ONES_EN[h], "hundred");
  if (rest > 0) {
    if (rest < 10) parts.push(ONES_EN[rest]);
    else if (rest < 20) parts.push(TEENS_EN[rest - 10]);
    else {
      const t = Math.floor(rest / 10);
      const o = rest % 10;
      parts.push(o > 0 ? `${TENS_EN[t]}-${ONES_EN[o]}` : TENS_EN[t]);
    }
  }
  return parts.join(" ");
}

function integerToWordsEN(n: number): string {
  if (n === 0) return "zero";
  const groups: number[] = [];
  let x = n;
  while (x > 0) {
    groups.unshift(x % 1000);
    x = Math.floor(x / 1000);
  }
  const scale = ["", "thousand", "million", "billion", "trillion"];
  const total = groups.length;
  const parts: string[] = [];
  groups.forEach((g, i) => {
    if (g === 0) return;
    const idx = total - 1 - i;
    const word = chunkEN(g);
    parts.push(idx > 0 ? `${word} ${scale[idx]}` : word);
  });
  return parts.join(" ");
}

const ONES_VN = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

function chunkVN(n: number, hasHigherGroup: boolean): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(ONES_VN[h], "trăm");
  else if (hasHigherGroup) parts.push("không", "trăm");

  if (rest === 0) {
    // nothing more to say
  } else if (rest < 10) {
    if (h > 0 || hasHigherGroup) parts.push("linh");
    parts.push(ONES_VN[rest]);
  } else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    parts.push(t === 1 ? "mười" : `${ONES_VN[t]} mươi`);
    if (o > 0) {
      if (o === 1 && t >= 2) parts.push("mốt");
      else if (o === 5 && t >= 1) parts.push("lăm");
      else parts.push(ONES_VN[o]);
    }
  }
  return parts.join(" ");
}

function integerToWordsVN(n: number): string {
  if (n === 0) return "không";
  const groups: number[] = [];
  let x = n;
  while (x > 0) {
    groups.unshift(x % 1000);
    x = Math.floor(x / 1000);
  }
  const scale = ["", "nghìn", "triệu", "tỷ"];
  if (groups.length > scale.length) return "";
  const total = groups.length;
  const parts: string[] = [];
  let seenNonzero = false;
  groups.forEach((g, i) => {
    if (g === 0) return;
    const idx = total - 1 - i;
    const word = chunkVN(g, seenNonzero);
    parts.push(idx > 0 ? `${word} ${scale[idx]}` : word);
    seenNonzero = true;
  });
  return parts.join(" ");
}

const DIGIT_WORDS: Record<Lang, string[]> = {
  de: ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"],
  en: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"],
  vi: ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"],
};

const DECIMAL_WORD: Record<Lang, string> = { de: "Komma", en: "point", vi: "phẩy" };
const PERCENT_WORD: Record<Lang, string> = { de: "Prozent", en: "percent", vi: "phần trăm" };

/** Whether a run of text looks like a plain number this module can read. */
export function looksLikeNumber(text: string): boolean {
  return /^\d[\d.,]*%?$/.test(text.trim());
}

export function numberToWords(raw: string, lang: Lang): string | null {
  const trimmed = raw.trim();
  const isPercent = trimmed.endsWith("%");
  const body = isPercent ? trimmed.slice(0, -1) : trimmed;

  // German and Vietnamese write 30.000 (dot) and 3,5 (comma); English is the
  // other way round - the article's own language decides which is which.
  const thousandsSep = lang === "en" ? "," : ".";
  const decimalSep = lang === "en" ? "." : ",";

  const decimalAt = body.lastIndexOf(decimalSep);
  const intRaw = decimalAt === -1 ? body : body.slice(0, decimalAt);
  const fracRaw = decimalAt === -1 ? null : body.slice(decimalAt + 1);

  const intDigits = intRaw.split(thousandsSep).join("");
  if (!/^\d+$/.test(intDigits)) return null;
  if (fracRaw !== null && !/^\d+$/.test(fracRaw)) return null;

  const value = Number(intDigits);
  if (!Number.isFinite(value) || value > 999_999_999_999) return null;

  const integerWords =
    lang === "de" ? integerToWordsDE(value) : lang === "en" ? integerToWordsEN(value) : integerToWordsVN(value);
  if (!integerWords) return null;

  let out = integerWords;
  if (fracRaw) {
    const fracWords = fracRaw
      .split("")
      .map((d) => DIGIT_WORDS[lang][Number(d)])
      .join(" ");
    out = `${out} ${DECIMAL_WORD[lang]} ${fracWords}`;
  }
  if (isPercent) out = `${out} ${PERCENT_WORD[lang]}`;
  return out;
}
