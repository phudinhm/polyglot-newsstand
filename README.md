# Polyglot Newsstand

A reading-first newsstand for German and English news, built for people who want the pleasure of
reading real journalism while quietly working on a language. Every article opens line by line: tap a
sentence to see it in English or Vietnamese, tap a word to look it up and keep it.

It runs anywhere Next.js runs and deploys to Vercel with no database, no account and no build step
beyond `next build`.

---

## What it does

**Reading**

- One shelf for many publications. German and English feeds sit side by side, filtered by language,
  category, month and a reading-difficulty label, sorted newest first by default.
- A front page rather than a list: a lead story with its preview image, then day headings and
  cards carrying each publisher's thumbnail.
- The header, tab bar and floating controls are frosted glass, and the page carries a faint paper
  grain so it reads as a sheet rather than a screen. Both can be switched off.
- A greeting in the corner that changes with the hour and rotates through German, English and
  Vietnamese.
- A continue-reading bar follows you around the app while an article is open, with a progress ring,
  so wandering off to the vocabulary list costs nothing.
- Pick the paper first and the story second: every source has its own page listing what it has
  published, reachable by tapping the publication name on any card.
- Articles are stripped of navigation, cookie walls and related-story rails, then rebuilt as clean
  paragraphs of sentences.
- Four backgrounds: Paper, Sepia, Slate and Ink, plus a System option that follows your device.
- A floating toolbar inside the reader for the two things you actually reach for mid-article: text
  size and background.
- Full typographic control: text size, line spacing, line width in characters, letter spacing, and a
  serif or sans reading face. German text is hyphenated automatically, which matters when a single
  compound noun can run to thirty characters.
- Works the same on a phone and on a desktop, including a bottom navigation bar, safe-area padding
  and an installable web app manifest.

**Practice**

- **Line by line** is the default layout: each sentence is its own row with its own translation
  underneath. **Flowing text** keeps the original paragraph shape if you prefer it.
- Tap or click a line for its translation. Turn on bilingual mode to see every translation at once.
- Double click or long press a word to look it up, then save it in one tap. The sentence you met it
  in is saved with it, because context is what makes a word stick.
- Words already in your vocabulary are underlined as you read, so you can see your own progress in
  the text itself.
- Export your vocabulary to CSV, which imports directly into Anki or Quizlet, or to JSON.
- Keyboard shortcuts for desktop reading: `j` and `k` to move between lines, `t` or `Enter` to
  translate the current line, `Escape` to clear.

**Sources**

73 curated feeds, weighted towards learners at both ends:

| Level | German | English |
| --- | --- | --- |
| Easy | Nachrichtenleicht (Leichte Sprache) | VOA Learning English |
| Medium | DW, tagesschau, ZDF heute, taz, Tagesspiegel, NDR, WDR, euronews, Golem, kicker | BBC, Guardian, NPR, Al Jazeera, DW English, The Verge, euronews |
| Advanced | ZEIT, SPIEGEL, FAZ, SZ, WELT, NZZ, derStandard, Deutschlandfunk, Handelsblatt, WirtschaftsWoche, manager magazin, heise | NYT, FT, CNBC, MarketWatch, HBR, MIT Sloan, McKinsey, IMF, POLITICO EU, MIT Tech Review, The Atlantic, Ars Technica, Nature, SPIEGEL International |

Business and research are deliberately well covered on both sides: Handelsblatt, WirtschaftsWoche,
manager magazin and tagesschau Wirtschaft in German; Business Insider, HBR, MIT Sloan Management
Review, the World Economic Forum, McKinsey, the IMF and World Bank blogs in English.

**Suggestions and health.** The Sources page proposes what to add next and says why, leaning on the
shelf you have already built while correcting two imbalances: a learner with nothing easy to read,
and a shelf that has drifted into one language. **Check my sources** fetches every feed on your
shelf and reports which ones answered, so "where did The Guardian go" becomes a specific answer
rather than a mystery.

**Adding your own.** The Sources page takes any RSS, Atom or RDF feed. It will also follow a
publisher that has no working feed at all, or a standing topic search, by routing through the
public Google News RSS endpoint. One-click follows are included for Deloitte, PwC, KPMG, EY, BCG,
Bain and Statista, which is the practical way to read the advisory firms. Anything you add stays in
your browser.

Deutsche Welle publishes the same stories in German and English, which makes it easy to read one
version and check yourself against the other.

---

## Quick start

```bash
git clone https://github.com/phudinhm/polyglot-newsstand.git
cd polyglot-newsstand
npm install
npm run dev
```

Open http://localhost:3000. It works immediately with no configuration: translation falls back to
the free MyMemory endpoint, which needs no key.

Optional but recommended:

```bash
cp .env.example .env.local   # then add a DeepL or Google key
```

---

## Translation providers

The app tries providers in order and falls through on any failure, so a missing key or an exhausted
quota degrades rather than breaks.

| Provider | Environment variable | Why you would choose it |
| --- | --- | --- |
| DeepL | `DEEPL_API_KEY` | The best German output by a clear margin. Free tier covers 500,000 characters a month, which is a lot of reading. Free keys end in `:fx` and the right endpoint is selected automatically. |
| Google Cloud Translation v2 | `GOOGLE_TRANSLATE_API_KEY` | Broadest coverage and dependable Vietnamese. Billed per character. |
| LibreTranslate | `LIBRETRANSLATE_URL`, `LIBRETRANSLATE_API_KEY` | Self-hosted, so nothing leaves your own infrastructure. |
| MyMemory | none, or `MYMEMORY_EMAIL` to raise the quota | The zero-configuration default. Rate limited, fine for casual reading. |

A practical setup: DeepL for German to English, Google for anything to Vietnamese. Add both keys and
the chain handles it, since a target DeepL cannot serve simply falls through to Google.

Translations are cached in three places, so the same sentence is only ever paid for once: in memory
on the server, in `localStorage` in your browser, and by Vercel's edge cache for feeds and articles.

---

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository. The framework is detected as
   Next.js and no build settings need changing.
3. Under **Settings → Environment Variables**, add any translation keys you want. None are required.
4. Deploy. The three API routes run on the Node.js runtime, which the article extractor needs.

There is nothing to provision beyond that. No database, no queue, no cron.

---

## How it works

```
src/
  app/
    api/feed/route.ts       fetches every selected feed in parallel, dedupes, sorts by time
    api/article/route.ts    fetches one article, extracts readable text, splits into sentences
    api/translate/route.ts  rate-limited translation with provider fallback and caching
    page.tsx                the newsstand
    read/page.tsx           the reader
    sources, vocab, saved   shelf management, vocabulary, read-it-later
  lib/
    sources.ts    the curated catalogue, one object per feed
    rss.ts        RSS 2.0, Atom and RDF into one shape
    extract.ts    Readability plus linkedom, then paragraphs into sentences
    segment.ts    sentence and word segmentation, the core of line-by-line reading
    translate/    provider implementations and the fallback chain
    settings.ts   reading preferences, stored in localStorage
    store.ts      vocabulary and saved articles, stored in localStorage
```

Two details are worth knowing about:

**Publisher chrome.** Readability keeps the visually hidden labels news sites ship for screen
readers, and because they carry no spacing they arrive glued together, like
`BenachrichtigungPfeil nach linksMerklisteAbspielenPause`. `src/lib/extract.ts` drops them by shape
rather than by wordlist: real prose puts a space after a lowercase letter, never a capital.

**Sentence segmentation.** `Intl.Segmenter` does the initial split, but its German rules break after
abbreviations and ordinals, turning `Die Regierung hat z. B. am 1. Januar neue Regeln erlassen.`
into five fragments. `src/lib/segment.ts` repairs that with an abbreviation list and a set of merge
rules, so a line is always a sentence a learner can actually read.

**Nothing about your reading leaves your device.** Settings, vocabulary, saved articles and cached
translations all live in `localStorage`. There is no account, no analytics and no server-side user
record. The only outbound calls are to the publishers' feeds and to your chosen translation provider.

---

## Keeping the sources healthy

Publishers retire and move RSS URLs without notice. When the newsstand looks thin:

```bash
npm run check:sources             # check every feed
npm run check:sources -- --lang de # German feeds only
npm run check:sources -- --strict  # exit non-zero on any failure, for CI
```

It prints the status, item count and response time for each feed, then lists whatever needs
attention. Edit or remove those entries in `src/lib/sources.ts`. Adding a source is one object in
the same file, and it appears on the Sources page immediately.

---

## Known limits

- **Paywalls.** Some publishers return only a teaser or block extraction entirely. The reader says
  so plainly and links to the original rather than pretending. FT and parts of SZ and Handelsblatt
  behave this way.
- **Word lookup is translation, not a dictionary.** A single word is sent to the translation
  provider, so you get a meaning in context but not gender, plural or case information. Adding a
  proper dictionary source is the obvious next step.
- **Fonts are system fonts** by default, which keeps the app fast and private. To use a typeface
  such as Literata or Inter, add `next/font/google` in `src/app/layout.tsx` and point
  `--font-reading-serif` at it in `src/app/globals.css`.

---

## Roadmap

- Dictionary lookups with grammatical detail for German, including article, plural and verb forms
- Audio: sentence-level text to speech for listening practice
- Spaced repetition over the saved vocabulary rather than export only
- A difficulty estimate per article, computed from sentence length and word frequency
- Optional sync across devices for anyone who wants it, off by default

---

## Legal note

Polyglot Newsstand fetches publicly published RSS feeds and article pages for personal reading and
language practice, and links back to the original on every article. It stores no article text on a
server beyond a short-lived cache. Text and images remain the property of the publishers. If you
deploy this publicly, review the terms of the publications you include.
