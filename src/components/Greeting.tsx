"use client";

import { useEffect, useState } from "react";
import {
  adviceFor,
  BUCKET_ICON,
  bucketFor,
  greetingFor,
  hintText,
  type Bucket,
  type Greeting as GreetingValue,
} from "@/lib/greetings";
import { useLang, useT } from "@/hooks/useT";
import { MoonIcon, StarsIcon, SunIcon, SunriseIcon, SunsetIcon } from "./Icons";

const ICONS = {
  sunrise: SunriseIcon,
  sun: SunIcon,
  sunset: SunsetIcon,
  moon: MoonIcon,
  stars: StarsIcon,
};

/**
 * The corner that says hello.
 *
 * Rendered only after mount: the server has no idea what time it is where the
 * reader is, and a greeting that flickers from "Good evening" to "Guten Morgen"
 * on hydration would be worse than none.
 */
export function Greeting({ count }: { count: number }) {
  const t = useT();
  const lang = useLang();
  const [value, setValue] = useState<GreetingValue | null>(null);
  const [bucket, setBucket] = useState<Bucket>("midday");
  const [icon, setIcon] = useState<keyof typeof ICONS>("sun");
  const [today, setToday] = useState("");

  useEffect(() => {
    const apply = () => {
      const now = new Date();
      setValue(greetingFor(now));
      setBucket(bucketFor(now.getHours()));
      setIcon(BUCKET_ICON[bucketFor(now.getHours())]);
      setToday(
        now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
      );
    };
    apply();
    // Re-greet if the app is left open across an hour boundary.
    const timer = setInterval(apply, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const Icon = ICONS[icon];

  return (
    <div className="min-h-[3.75rem]">
      {value ? (
        <>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent"
            >
              <Icon width={19} height={19} />
            </span>
            <h1
              lang={value.lang}
              className="text-[1.6rem] font-bold leading-tight tracking-tight sm:text-[1.9rem]"
            >
              {value.text}
              <span className="text-accent">.</span>
            </h1>
          </div>

          {(value.region || value.hint) && (
            <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[12px] text-muted">
              {value.region && (
                <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium">
                  {value.region}
                </span>
              )}
              {value.hint && <span>{hintText(value.hint, lang)}</span>}
            </p>
          )}
          <p className="mt-1.5 text-[13px] text-muted sm:text-sm">
            {today}
            {count > 0 && (
              <>
                <span aria-hidden> · </span>
                {count} {t("feed.stories")}
              </>
            )}
            <span className="hidden sm:inline">
              <span aria-hidden> · </span>
              {adviceFor(bucket, lang)}
            </span>
          </p>
        </>
      ) : (
        <>
          <div className="skeleton h-9 w-52" />
          <div className="skeleton mt-2 h-4 w-64" />
        </>
      )}
    </div>
  );
}
