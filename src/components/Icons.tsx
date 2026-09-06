import type { SVGProps } from "react";

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type P = SVGProps<SVGSVGElement>;

export const NewspaperIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 5h11v14H5a1 1 0 0 1-1-1z" />
    <path d="M15 8h4a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2h-3" />
    <path d="M7 8h5M7 11h5M7 14h3" />
  </svg>
);

export const BookmarkIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 4h12v16l-6-4-6 4z" />
  </svg>
);

export const CardsIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="6" width="13" height="13" rx="2" />
    <path d="M8 3h11a2 2 0 0 1 2 2v11" />
    <path d="M7 11h5M7 14h3" />
  </svg>
);

export const SlidersIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);

export const ArrowLeftIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const LanguagesIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 6h9M7.5 4v2M10 6c0 4-3.2 7-7 8" />
    <path d="M5 11c1.5 2.2 3.6 3.6 6 4.3" />
    <path d="M13 20l4-9 4 9M14.6 17h4.8" />
  </svg>
);

export const TrashIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" />
  </svg>
);

export const DownloadIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 4v11M8 11l4 4 4-4M5 20h14" />
  </svg>
);

export const SearchIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4-4" />
  </svg>
);

export const CheckIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 13l4 4 10-10" />
  </svg>
);

export const PlusIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ExternalIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14 5h5v5M19 5l-8 8" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </svg>
);

export const RefreshIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M20 11a8 8 0 1 0-.6 4" />
    <path d="M20 5v6h-6" />
  </svg>
);

export const SpinnerIcon = (p: P) => (
  <svg {...base} {...p} className={`animate-spin ${p.className ?? ""}`}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

export const SpeakerIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    <path d="M19 6a9 9 0 0 1 0 12" />
  </svg>
);

export const StopIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const SunriseIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3v4M5.6 9.6 4.2 8.2M18.4 9.6l1.4-1.4M3 17h18M6 17a6 6 0 0 1 12 0" />
    <path d="M9 6l3-3 3 3" />
  </svg>
);

export const SunIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const SunsetIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 7V3M5.6 9.6 4.2 8.2M18.4 9.6l1.4-1.4M3 17h18M6 17a6 6 0 0 1 12 0" />
    <path d="M9 4l3 3 3-3" />
  </svg>
);

export const MoonIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </svg>
);

export const StarsIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 4l1 2.5L10.5 8 8 9l-1 2.5L6 9 3.5 8 6 6.5z" />
    <path d="M16 12l.8 2 2.2.8-2.2.8-.8 2-.8-2-2.2-.8 2.2-.8z" />
    <path d="M13 4.5h3M14.5 3v3" />
  </svg>
);

export const HistoryIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 4v4h4" />
    <path d="M12 8v4l3 2" />
  </svg>
);
