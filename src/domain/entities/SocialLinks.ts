/** Networks with a drawing of their own; `website` is a personal site, `other` anything else. */
export const socialLinkKinds = [
  "linkedin",
  "instagram",
  "youtube",
  "x",
  "facebook",
  "tiktok",
  "threads",
  "bluesky",
  "behance",
  "flickr",
  "vimeo",
  "pinterest",
  "website",
  "other",
] as const;
export type SocialLinkKind = (typeof socialLinkKinds)[number];

/** A link from the site to one of the owner's profiles elsewhere. */
export type SocialLink = { kind: SocialLinkKind; url: string; label?: string };

export const socialLinkNames: Record<SocialLinkKind, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X",
  facebook: "Facebook",
  tiktok: "TikTok",
  threads: "Threads",
  bluesky: "Bluesky",
  behance: "Behance",
  flickr: "Flickr",
  vimeo: "Vimeo",
  pinterest: "Pinterest",
  website: "Website",
  other: "Other",
};

/** As many as the API keeps. */
export const maxSocialLinks = 12;
export const maxSocialLinkUrl = 500;
export const maxSocialLinkLabel = 60;

// The same rule as the API: https to a named domain, no credentials (the host takes no
// `@`), no spaces, quotes, angle brackets, backslashes or control characters.
const httpsUrl =
  /^https:\/\/(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}(?::[0-9]{1,5})?(?:[/?#][^\s\\<>"'`\u0000-\u001f\u007f]*)?$/;
// eslint-disable-next-line no-control-regex
const controlCharacters = /[\u0000-\u001f\u007f]/;

/** Why a link would be refused, or `null` when it can be saved. */
export function socialLinkProblem(link: SocialLink): string | null {
  const url = link.url.trim();
  if (!url) return "Add the address.";
  if (url.length > maxSocialLinkUrl)
    return `Keep the address under ${maxSocialLinkUrl} characters.`;
  if (!url.toLowerCase().startsWith("https://"))
    return "Use an address that starts with https://.";
  if (!httpsUrl.test(url))
    return "Use a full https:// address to a domain, without a user name, password or spaces.";
  const label = link.label?.trim() ?? "";
  if (link.kind === "other" && !label) return "Name this link.";
  if (label.length > maxSocialLinkLabel)
    return `Keep the name under ${maxSocialLinkLabel} characters.`;
  if (controlCharacters.test(link.label ?? "")) return "Remove hidden characters from the name.";
  return null;
}

/** What a screen reader and a tooltip call the link. */
export const socialLinkName = (link: SocialLink) =>
  link.label?.trim() || socialLinkNames[link.kind];

/** The links as the API takes them: trimmed, an empty name left out. */
export function cleanSocialLinks(links: SocialLink[]): SocialLink[] {
  return links.map(({ kind, url, label }) => {
    const name = label?.trim();
    return { kind, url: url.trim(), ...(name ? { label: name } : {}) };
  });
}

/** Stored links the site can show: a known kind and a safe address. */
export function publicSocialLinks(links: unknown): SocialLink[] {
  if (!Array.isArray(links)) return [];
  return links.filter(
    (link): link is SocialLink =>
      Boolean(link) &&
      typeof link === "object" &&
      (socialLinkKinds as readonly string[]).includes(link.kind) &&
      typeof link.url === "string" &&
      (link.label === undefined || typeof link.label === "string") &&
      socialLinkProblem(link) === null,
  );
}
