"use client";

import { ArrowLeftIcon } from "./Icons";

/**
 * The one back control used everywhere a page needs to say "go back to
 * where this came from" - the reader's header and the source page used to
 * each style their own (a .btn icon button here, a plain underlined text
 * link there), so leaving one page for another meant the same action
 * suddenly looked like a different one.
 */
export function BackButton({
  onClick,
  label,
  showLabel = false,
  className = "",
}: {
  onClick: () => void;
  label: string;
  /** Show the label as visible text next to the icon, not just as aria-label/title. */
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn min-h-11 ${showLabel ? "!px-2.5 !py-1.5" : "btn-icon"} ${className}`}
      aria-label={label}
      title={showLabel ? undefined : label}
    >
      <ArrowLeftIcon width={16} height={16} />
      {showLabel && <span>{label}</span>}
    </button>
  );
}
