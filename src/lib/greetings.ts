/**
 * The corner that says hello.
 *
 * A reading app you open every morning should recognise the hour. Greetings
 * rotate across the three languages this app lives in, which quietly puts you
 * in the right frame of mind before the first headline.
 */

export type Bucket = "dawn" | "morning" | "midday" | "afternoon" | "evening" | "night" | "lateNight";

export interface Greeting {
  text: string;
  lang: "de" | "en" | "vi";
  /** A short line under the greeting, in English so it always reads. */
  sub: string;
}

const GREETINGS: Record<Bucket, Greeting[]> = {
  dawn: [
    { text: "Guten Morgen", lang: "de", sub: "The early edition is quiet. A good hour to read slowly." },
    { text: "Early start", lang: "en", sub: "Nobody has argued about any of this yet." },
    { text: "Chào buổi sớm", lang: "vi", sub: "The day has not made up its mind yet." },
    { text: "Frühaufsteher", lang: "de", sub: "Two or three stories now beat twenty at lunch." },
  ],
  morning: [
    { text: "Guten Morgen", lang: "de", sub: "Fresh headlines, still warm." },
    { text: "Good morning", lang: "en", sub: "Start with one German piece before the day fills up." },
    { text: "Chào buổi sáng", lang: "vi", sub: "A coffee and three sentences is a real session." },
    { text: "Morgen", lang: "de", sub: "The German press has been up for hours." },
    { text: "Guten Morgen", lang: "de", sub: "Nachrichtenleicht first if the head is not awake yet." },
  ],
  midday: [
    { text: "Mahlzeit", lang: "de", sub: "What Germans say around lunch, to anyone, about nothing." },
    { text: "Good afternoon", lang: "en", sub: "A short read beats scrolling." },
    { text: "Chào buổi trưa", lang: "vi", sub: "Ten minutes is enough for one article." },
  ],
  afternoon: [
    { text: "Guten Tag", lang: "de", sub: "The afternoon wires are usually the most detailed." },
    { text: "Good afternoon", lang: "en", sub: "Business desks file most of their copy about now." },
    { text: "Chào buổi chiều", lang: "vi", sub: "Pick something longer than a headline." },
    { text: "Schönen Nachmittag", lang: "de", sub: "Try one advanced piece and let the translation carry you." },
  ],
  evening: [
    { text: "Guten Abend", lang: "de", sub: "The day's reporting has settled into shape." },
    { text: "Good evening", lang: "en", sub: "Sepia or Ink reads easier from here on." },
    { text: "Chào buổi tối", lang: "vi", sub: "The best hour for a long article." },
    { text: "Feierabend", lang: "de", sub: "The word Germans use for the moment work ends." },
  ],
  night: [
    { text: "Gute Nacht", lang: "de", sub: "A smaller batch and no rush reads better at this hour." },
    { text: "Still up", lang: "en", sub: "Save a few words and let sleep do the filing." },
    { text: "Chào buổi tối muộn", lang: "vi", sub: "One article, then stop. That is a good habit." },
  ],
  lateNight: [
    { text: "Nachtschicht", lang: "de", sub: "Night shift. The German word is more literal than it sounds." },
    { text: "Late one", lang: "en", sub: "Tomorrow's front pages are already being set." },
    { text: "Khuya rồi", lang: "vi", sub: "Reading now counts double. So does sleeping." },
  ],
};

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
