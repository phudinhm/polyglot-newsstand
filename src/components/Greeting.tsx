"use client";

import { useEffect, useState } from "react";
import { greetingFor, type Greeting as GreetingValue } from "@/lib/greetings";

/**
 * The corner that says hello.
 *
 * Rendered only after mount: the server has no idea what time it is where the
 * reader is, and a greeting that flickers from "Good evening" to "Guten Morgen"
 * on hydration would be worse than none.
 */
export function Greeting({ count }: { count: number }) {
  const [value, setValue] = useState<GreetingValue | null>(null);
  const [today, setToday] = useState("");

  useEffect(() => {
    const now = new Date();
    setValue(greetingFor(now));
    setToday(
      now.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    );
    // Re-greet if the app is left open across an hour boundary.
    const timer = setInterval(() => setValue(greetingFor(new Date())), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-[3.75rem]">
      {value ? (
        <>
          <h1
            lang={value.lang}
            className="text-[1.6rem] font-bold leading-tight tracking-tight sm:text-3xl"
          >
            {value.text}
            <span className="text-accent">.</span>
          </h1>
          <p className="mt-1 text-[13px] text-muted sm:text-sm">
            {today}
            {count > 0 && (
              <>
                <span aria-hidden> · </span>
                {count} stories on the shelf
              </>
            )}
            <span className="hidden sm:inline">
              <span aria-hidden> · </span>
              {value.sub}
            </span>
          </p>
        </>
      ) : (
        <>
          <div className="skeleton h-8 w-48" />
          <div className="skeleton mt-2 h-4 w-64" />
        </>
      )}
    </div>
  );
}
