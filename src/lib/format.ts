/** Short, human relative time: "12 min", "3 h", "Tue". */
export function timeAgo(iso?: string): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDate(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function readerHref(params: {
  url: string;
  lang: string;
  source?: string;
}): string {
  const search = new URLSearchParams({ u: params.url, lang: params.lang });
  if (params.source) search.set("src", params.source);
  return `/read?${search.toString()}`;
}
