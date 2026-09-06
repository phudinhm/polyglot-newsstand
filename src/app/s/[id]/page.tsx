import Link from "next/link";
import { SourcePageClient } from "@/components/SourcePageClient";
import { SOURCE_BY_ID } from "@/lib/sources";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = SOURCE_BY_ID.get(decodeURIComponent(id));
  return { title: source?.name ?? "Publication" };
}

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);

  // Custom sources live in the reader's browser, so the client resolves those.
  if (!SOURCE_BY_ID.has(decoded) && !decoded.startsWith("custom:")) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">No such publication</h1>
        <p className="mt-2 text-sm text-muted">
          It may have been removed from the catalogue.
        </p>
        <Link href="/sources" className="btn btn-primary mt-5 inline-flex">
          Browse all sources
        </Link>
      </div>
    );
  }

  return <SourcePageClient id={decoded} />;
}
