import type { ReactNode } from "react";
import type { SocialLinkKind } from "@/src/domain/entities/SocialLinks";

// Our own simple drawings, one per kind, on a 24-unit grid in the current color. Nothing
// is loaded from the networks themselves.
const drawings: Record<SocialLinkKind, ReactNode> = {
  linkedin: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8 10.5v6M8 7.6v.1M11.5 16.5v-6M11.5 13c0-1.6 1-2.6 2.4-2.6s2.1 1 2.1 2.6v3.5" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <path d="M17 7v.1" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10.2 9.2 4.6 2.8-4.6 2.8Z" fill="currentColor" />
    </>
  ),
  x: <path d="M4.5 4.5h4l11 15h-4ZM19.5 4.5l-6.2 6.8M10.7 12.7 4.5 19.5" />,
  facebook: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M13 20.5v-8.2c0-1.6.8-2.6 2.5-2.6M10.3 13.2h5" />
    </>
  ),
  tiktok: (
    <path d="M13 4v10.5a3.2 3.2 0 1 1-3.2-3.2M13 4c.4 2.4 2 4 4.5 4.3" />
  ),
  threads: (
    <path d="M16.8 11.2c-.4-2.6-2.1-3.8-4.4-3.8-3 0-4.6 2.1-4.6 4.8s1.6 4.8 4.6 4.8c2.4 0 3.8-1.3 3.8-3.1 0-2.1-2-2.8-4-2.4-1.5.3-2.2 1.2-2 2.2.2 1 1.3 1.5 2.4 1.3M18.8 7.5C17.5 5 15.2 3.5 12.3 3.5 7.2 3.5 4 7.1 4 12.2s3.2 8.3 8.3 8.3c3.6 0 6.2-1.7 7.2-4.7" />
  ),
  bluesky: (
    <path d="M12 11c-1.5-2.9-5-6.4-7-6.4-1 0-1.1 1.3-.9 2.6.3 2.3 1 4.2 3.7 4.6-2.8.5-3.4 2.3-1.7 4 2.6 2.6 4.4.4 5.9-2.6 1.5 3 3.3 5.2 5.9 2.6 1.7-1.7 1.1-3.5-1.7-4 2.7-.4 3.4-2.3 3.7-4.6.2-1.3.1-2.6-.9-2.6-2 0-5.5 3.5-7 6.4Z" />
  ),
  behance: (
    <path d="M3.5 7.5h4.2a2.2 2.2 0 0 1 0 4.4H3.5Zm0 4.4h4.8a2.3 2.3 0 0 1 0 4.6H3.5ZM14.5 13.8h6c0-2.3-1.3-3.8-3-3.8s-3 1.6-3 3.4 1.3 3.3 3.1 3.3c1.2 0 2.1-.5 2.6-1.4M15 7.5h5" />
  ),
  flickr: (
    <>
      <circle cx="7.5" cy="12" r="3.5" fill="currentColor" />
      <circle cx="16.5" cy="12" r="3.5" />
    </>
  ),
  vimeo: (
    <path d="M3.5 9.3 5 10.6c1-.8 1.6-1 2-.6.7.8 1.4 6.5 3.2 8.3 1.4 1.4 3.6-.4 6-3.6 2.6-3.5 3.4-6.6 2.4-8-1-1.2-3.5-.9-5 2.4 1.8-1 3-.6 2.2 1.4-.8 2-2.6 4.5-3.2 4.4-.8 0-1.4-6.5-2.9-7.8-1.4-1.2-3.2.4-6.2 3.2Z" />
  ),
  pinterest: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.6 20.2 12.4 13M10.9 15.5c.6.6 1.4.9 2.3.9 2.3 0 3.8-2 3.8-4.5 0-2.6-2.1-4.4-4.8-4.4-3 0-5 2.1-5 4.6 0 1 .4 2 1.1 2.4" />
    </>
  ),
  website: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c-2.4 2.3-3.5 5.2-3.5 8.5s1.1 6.2 3.5 8.5c2.4-2.3 3.5-5.2 3.5-8.5S14.4 5.8 12 3.5Z" />
    </>
  ),
  other: (
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
  ),
};

/** The drawing of a network, decorative: the link around it carries the name. */
export function SocialIcon({
  kind,
  size = 20,
}: {
  kind: SocialLinkKind;
  size?: number;
}) {
  return (
    <svg
      className="social-icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-kind={kind}
    >
      {drawings[kind]}
    </svg>
  );
}
