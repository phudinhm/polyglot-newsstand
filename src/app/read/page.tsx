import Link from "next/link";
import { Reader } from "@/components/Reader";
import type { SourceLang } from "@/lib/types";

export const metadata = { title: "Reading" };

export default async function ReadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const url = pick("u");
  const lang: SourceLang = pick("lang") === "en" ? "en" : "de";
  const sourceId = pick("src");

  if (!url) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">No article selected</h1>
        <p className="mt-2 text-sm text-muted">
          Pick a story from the newsstand and it will open here.
        </p>
        <Link href="/" className="btn btn-primary mt-5 inline-flex">
          Go to the newsstand
        </Link>
      </div>
    );
  }

  return <Reader url={url} lang={lang} sourceId={sourceId} />;
}
