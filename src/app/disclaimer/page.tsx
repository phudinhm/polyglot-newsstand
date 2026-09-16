import Link from "next/link";

export const metadata = {
  title: "Disclaimer",
  description: "What Polyglot Newsstand is, and what it is not.",
};

/**
 * A static page rather than a modal or a footer paragraph: a disclaimer a
 * reader has to be able to link to, bookmark, or point someone else at.
 */
export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:pt-12">
      <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight sm:text-[2rem]">
        Disclaimer
      </h1>
      <p className="mt-2 text-sm text-muted">Last updated September 2026.</p>

      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-fg">
        <p>
          Polyglot Newsstand is a personal project, built for language learners who want to
          read real news in German, English and Vietnamese, one line at a time, with
          translation and vocabulary tools alongside it.
        </p>

        <p>
          <strong className="font-semibold">
            It is for personal and educational use only, and is not operated for commercial
            purposes.
          </strong>{" "}
          It carries no advertising, charges nothing, and does not resell or redistribute the
          articles it displays.
        </p>

        <p>
          Every headline, summary and article shown here belongs to the publisher it links
          back to. This app only fetches what those publishers already make available through
          their own public feeds, and every article opens through to the original source,
          where that publisher&apos;s own presentation, advertising and paywall, if any, apply.
          Nothing is hosted, cached for redistribution, or claimed as this app&apos;s own work.
        </p>

        <p>
          Polyglot Newsstand is not affiliated with, endorsed by, or sponsored by any of the
          publishers listed on the{" "}
          <Link href="/sources" className="underline underline-offset-2">
            Sources
          </Link>{" "}
          page. Translations and simplified readings are produced automatically to help a
          learner follow the story, and can be imprecise; they are not a substitute for the
          original text and are not intended as a professional or certified translation.
        </p>

        <p className="text-muted">Built by Minh Phu Dinh.</p>
      </div>
    </div>
  );
}
