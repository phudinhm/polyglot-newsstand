"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/hooks/useT";
import { getSaved, toggleSaved } from "@/lib/store";
import type { SavedArticle } from "@/lib/types";
import { readerHref, timeAgo } from "@/lib/format";
import { TrashIcon } from "./Icons";

export function SavedClient() {
  const [items, setItems] = useState<SavedArticle[]>([]);
  const t = useT();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(getSaved());
    setReady(true);
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("saved.title")}</h1>
        <p className="mt-1 text-sm text-muted">
          Stories you set aside. They stay on this device, so nothing you read is sent anywhere.
        </p>
      </header>

      {ready && !items.length && (
        <div className="card p-8 text-center">
          <p className="font-medium">Nothing saved yet.</p>
          <p className="mt-1 text-sm text-muted">
            Use the bookmark button while reading to keep an article for later.
          </p>
          <Link href="/" className="btn btn-primary mt-4 inline-flex">
            Back to the newsstand
          </Link>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.url} className="card flex items-start gap-3 p-3.5">
            <Link
              href={readerHref({ url: item.url, lang: item.lang })}
              className="min-w-0 flex-1"
            >
              <div className="mb-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                <span className="font-medium uppercase tracking-wide text-accent">
                  {item.sourceName || "Saved"}
                </span>
                <span aria-hidden>·</span>
                <span className="uppercase">{item.lang}</span>
                <span aria-hidden>·</span>
                <span>saved {timeAgo(item.savedAt)}</span>
              </div>
              <h2 className="text-[15px] font-semibold leading-snug">{item.title}</h2>
            </Link>
            <button
              type="button"
              onClick={() => {
                toggleSaved(item);
                setItems(getSaved());
              }}
              className="btn shrink-0 px-2 py-1.5"
              aria-label={`Remove ${item.title}`}
            >
              <TrashIcon width={15} height={15} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
