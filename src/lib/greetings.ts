import type { UiLang } from "./i18n";

/**
 * The corner that says hello.
 *
 * A reading app you open every morning should recognise the hour, and it can
 * do something more useful than that while it is there: greet you the way the
 * language actually greets. German has a different hello in Hamburg, Munich
 * and Zurich, and none of them is "Guten Tag". Those are the words a learner
 * will meet in a shop long before they meet them in a grammar book, so each
 * one carries a note saying where it is said and what it is doing.
 */

export type Bucket = "dawn" | "morning" | "midday" | "afternoon" | "evening" | "night" | "lateNight";

/** Which sky to draw beside the greeting. */
export const BUCKET_ICON: Record<Bucket, "sunrise" | "sun" | "sunset" | "moon" | "stars"> = {
  dawn: "sunrise",
  morning: "sunrise",
  midday: "sun",
  afternoon: "sun",
  evening: "sunset",
  night: "moon",
  lateNight: "stars",
};

/**
 * What is worth saying about a greeting. Keys rather than sentences, so the
 * note reads in the reader's own language like everything else.
 */
export type HintKey =
  | "allDayNorth"
  | "helloAndGoodbye"
  | "greetGod"
  | "oneSyllable"
  | "aroundLunch"
  | "endOfWork"
  | "haveYouEaten"
  | "nightShift"
  | "shortForm"
  | "swissHello"
  | "howAreYou"
  | "austrianFormal"
  | "sleepWell"
  | "toEveryone";

export interface Greeting {
  text: string;
  lang: "de" | "en" | "vi";
  /** Where it is actually said, when it belongs to one corner of the map. */
  region?: string;
  hint?: HintKey;
}

const GREETINGS: Record<Bucket, Greeting[]> = {
  dawn: [
    { text: "Guten Morgen", lang: "de" },
    { text: "Moin", lang: "de", region: "Norddeutschland", hint: "allDayNorth" },
    { text: "Early start", lang: "en" },
    { text: "Chào buổi sớm", lang: "vi" },
    { text: "Frühaufsteher", lang: "de" },
    { text: "Grüezi", lang: "de", region: "Schweiz", hint: "swissHello" },
    { text: "Xin chào", lang: "vi", hint: "toEveryone" },
  ],
  morning: [
    { text: "Guten Morgen", lang: "de" },
    { text: "Moin Moin", lang: "de", region: "Hamburg & Bremen", hint: "allDayNorth" },
    { text: "Good morning", lang: "en" },
    { text: "Chào buổi sáng", lang: "vi" },
    { text: "Morgen", lang: "de", hint: "shortForm" },
    { text: "Grüß Gott", lang: "de", region: "Bayern & Österreich", hint: "greetGod" },
    { text: "Servus", lang: "de", region: "Bayern & Österreich", hint: "helloAndGoodbye" },
    { text: "Ăn cơm chưa?", lang: "vi", hint: "haveYouEaten" },
    { text: "Na?", lang: "de", region: "Berlin", hint: "oneSyllable" },
  ],
  midday: [
    { text: "Mahlzeit", lang: "de", hint: "aroundLunch" },
    { text: "Good afternoon", lang: "en" },
    { text: "Chào buổi trưa", lang: "vi" },
    { text: "Grüezi mitenand", lang: "de", region: "Schweiz", hint: "swissHello" },
    { text: "Tach", lang: "de", region: "Rheinland & Ruhrgebiet", hint: "shortForm" },
    { text: "Servus", lang: "de", region: "Bayern & Österreich", hint: "helloAndGoodbye" },
  ],
  afternoon: [
    { text: "Guten Tag", lang: "de" },
    { text: "Good afternoon", lang: "en" },
    { text: "Chào buổi chiều", lang: "vi" },
    { text: "Schönen Nachmittag", lang: "de" },
    { text: "Habe die Ehre", lang: "de", region: "Österreich", hint: "austrianFormal" },
    { text: "Grüß dich", lang: "de" },
    { text: "Khoẻ không?", lang: "vi", hint: "howAreYou" },
    { text: "Alright?", lang: "en", region: "England", hint: "howAreYou" },
  ],
  evening: [
    { text: "Guten Abend", lang: "de" },
    { text: "Good evening", lang: "en" },
    { text: "Chào buổi tối", lang: "vi" },
    { text: "Feierabend", lang: "de", hint: "endOfWork" },
    { text: "N'Abend", lang: "de", hint: "shortForm" },
    { text: "Moin", lang: "de", region: "Norddeutschland", hint: "allDayNorth" },
  ],
  night: [
    { text: "Gute Nacht", lang: "de" },
    { text: "Still up", lang: "en" },
    { text: "Chào buổi tối muộn", lang: "vi" },
    { text: "Schlaf gut", lang: "de", hint: "sleepWell" },
    { text: "Ngủ ngon", lang: "vi", hint: "sleepWell" },
  ],
  lateNight: [
    { text: "Nachtschicht", lang: "de", hint: "nightShift" },
    { text: "Late one", lang: "en" },
    { text: "Khuya rồi", lang: "vi" },
    { text: "Noch wach?", lang: "de" },
  ],
};

/** What each hint says, in each language the app speaks. */
const HINTS: Record<UiLang, Record<HintKey, string>> = {
  en: {
    allDayNorth: "said at any hour, not only in the morning",
    helloAndGoodbye: "hello and goodbye, the same word",
    greetGod: "literally greet God, and nobody means it literally",
    oneSyllable: "a whole conversation in one syllable",
    aroundLunch: "what offices say around lunch, to anyone, about nothing",
    endOfWork: "the word for the moment work ends",
    haveYouEaten: "have you eaten yet, which is how Vietnamese asks how you are",
    nightShift: "night shift, more literal than it sounds",
    shortForm: "the short form everyone actually uses",
    swissHello: "the Swiss hello, said to strangers and shopkeepers alike",
    howAreYou: "how are you, asked without expecting an answer",
    austrianFormal: "old-fashioned, courtly, and still used",
    sleepWell: "sleep well",
    toEveryone: "the all-purpose hello, safe with anyone",
  },
  de: {
    allDayNorth: "zu jeder Tageszeit, nicht nur morgens",
    helloAndGoodbye: "Begrüßung und Abschied, dasselbe Wort",
    greetGod: "wörtlich grüße Gott, wörtlich meint es niemand",
    oneSyllable: "ein ganzes Gespräch in einer Silbe",
    aroundLunch: "sagt man im Büro zur Mittagszeit, zu allen, über nichts",
    endOfWork: "das Wort für den Moment, in dem die Arbeit endet",
    haveYouEaten: "hast du schon gegessen, so fragt man auf Vietnamesisch nach dem Befinden",
    nightShift: "Nachtschicht, wörtlicher als es klingt",
    shortForm: "die Kurzform, die alle wirklich benutzen",
    swissHello: "der Schweizer Gruß, für Fremde wie für Ladenbesitzer",
    howAreYou: "wie geht's, gefragt ohne eine Antwort zu erwarten",
    austrianFormal: "altmodisch, höfisch und immer noch in Gebrauch",
    sleepWell: "schlaf gut",
    toEveryone: "der Allzweckgruß, passt bei jedem",
  },
  vi: {
    allDayNorth: "chào cả ngày, không riêng buổi sáng",
    helloAndGoodbye: "vừa là chào gặp vừa là chào tạm biệt",
    greetGod: "nghĩa đen là chào Chúa, nhưng không ai hiểu theo nghĩa đen",
    oneSyllable: "cả một câu chuyện gói trong một âm tiết",
    aroundLunch: "câu dân văn phòng nói vào giờ trưa, với bất kỳ ai, về không gì cả",
    endOfWork: "từ chỉ đúng khoảnh khắc hết giờ làm",
    haveYouEaten: "ăn cơm chưa, cách người Việt hỏi thăm nhau",
    nightShift: "ca đêm, nghĩa đen hơn ta tưởng",
    shortForm: "dạng rút gọn mà ai cũng dùng",
    swissHello: "lời chào kiểu Thụy Sĩ, dùng với người lạ lẫn người bán hàng",
    howAreYou: "khoẻ không, hỏi mà không chờ câu trả lời",
    austrianFormal: "cổ kính, trang trọng, và vẫn còn được dùng",
    sleepWell: "ngủ ngon",
    toEveryone: "lời chào dùng được với mọi người",
  },
};

/** One line of reading advice per part of the day. */
const ADVICE: Record<UiLang, Record<Bucket, string>> = {
  en: {
    dawn: "Two or three stories now beat twenty at lunch.",
    morning: "Start with one German piece before the day fills up.",
    midday: "A short read beats scrolling.",
    afternoon: "Pick something longer than a headline.",
    evening: "The best hour for a long article.",
    night: "One article, then stop. That is a good habit.",
    lateNight: "Reading now counts double. So does sleeping.",
  },
  de: {
    dawn: "Zwei oder drei Artikel jetzt sind mehr wert als zwanzig mittags.",
    morning: "Fang mit einem deutschen Text an, bevor der Tag voll wird.",
    midday: "Ein kurzer Text ist besser als Scrollen.",
    afternoon: "Nimm etwas Längeres als eine Schlagzeile.",
    evening: "Die beste Stunde für einen langen Artikel.",
    night: "Ein Artikel, dann Schluss. Das ist eine gute Gewohnheit.",
    lateNight: "Lesen zählt jetzt doppelt. Schlafen auch.",
  },
  vi: {
    dawn: "Hai ba bài lúc này hơn hai mươi bài lúc trưa.",
    morning: "Bắt đầu bằng một bài tiếng Đức trước khi ngày kín lịch.",
    midday: "Một bài ngắn vẫn hơn lướt vô định.",
    afternoon: "Chọn thứ gì dài hơn một cái tiêu đề.",
    evening: "Giờ đẹp nhất cho một bài dài.",
    night: "Một bài rồi dừng. Đó là thói quen tốt.",
    lateNight: "Đọc lúc này tính gấp đôi. Ngủ cũng vậy.",
  },
};

export const hintText = (hint: HintKey, lang: UiLang) => HINTS[lang][hint];
export const adviceFor = (bucket: Bucket, lang: UiLang) => ADVICE[lang][bucket];

export function bucketFor(hour: number): Bucket {
  if (hour < 5) return "lateNight";
  if (hour < 8) return "dawn";
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour < 18) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

/**
 * Picks a greeting for the given moment. The choice is stable within an hour,
 * so a re-render does not shuffle the text under the reader's eyes, but it
 * changes across visits.
 */
export function greetingFor(date: Date): Greeting {
  const bucket = bucketFor(date.getHours());
  const options = GREETINGS[bucket];
  const seed = date.getFullYear() * 1000 + dayOfYear(date) * 24 + date.getHours();
  return options[seed % options.length];
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}
