import { ReactNode } from "react";

// Small line drawings for the property tabs of Home and Gallery, so a tab is read at
// a glance and the row fits a narrow column.
const icon = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const propertyTabIcons: Record<string, ReactNode> = {
  Text: icon(<path d="M5 6h14M12 6v13M9 19h6" />),
  Palette: icon(
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2s-1-1.6-1-2.6 1-1.4 2-1.4h2a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z" />
      <circle cx="7.5" cy="11" r="1.2" />
      <circle cx="10" cy="7" r="1.2" />
      <circle cx="15" cy="7.5" r="1.2" />
    </>,
  ),
  Typography: icon(
    <path d="M4 19 9.5 5h1L16 19M6.3 14h7.4M17 19v-6m0 0a2.5 2.5 0 0 1 5 0v6" />,
  ),
  Highlight: icon(
    <>
      <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </>,
  ),
  Carousel: icon(
    <>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <path d="M3 9v6M21 9v6" />
    </>,
  ),
  Composition: icon(
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 13h9V4M15 9h3" />
    </>,
  ),
  Style: icon(
    <>
      <path d="m14 4 6 6-9 9H5v-6l9-9Z" />
      <path d="m12 6 6 6" />
    </>,
  ),
  Page: icon(
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>,
  ),
  Filters: icon(<path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" />),
  Photos: icon(
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="m3 16 5-5 4 4 3-3 6 6" />
      <circle cx="16" cy="9" r="1.3" />
    </>,
  ),
  Introduction: icon(<path d="M5 5h14M5 9h14M5 13h9M5 17h6" />),
  Visitors: icon(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.5M17.5 14.5A5 5 0 0 1 20.5 19" />
    </>,
  ),
};
