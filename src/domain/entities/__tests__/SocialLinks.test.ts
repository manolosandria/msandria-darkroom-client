import { describe, expect, it } from "vitest";
import {
  cleanSocialLinks,
  publicSocialLinks,
  socialLinkName,
  socialLinkProblem,
} from "../SocialLinks";
import { withSiteDefaults } from "../SiteSettings";

const link = { kind: "website" as const, url: "https://example.com" };

describe("social links", () => {
  it("accepts https addresses to a named domain", () => {
    for (const url of [
      "https://www.linkedin.com/in/someone",
      "https://youtube.com/@someone?si=1#top",
      "https://blog.example.co.uk:8443/a/b",
    ])
      expect(socialLinkProblem({ ...link, url })).toBeNull();
  });

  it("explains why an address or a name would be refused", () => {
    expect(socialLinkProblem({ ...link, url: " " })).toBe("Add the address.");
    expect(socialLinkProblem({ ...link, url: "http://example.com" })).toMatch(
      /https:\/\//,
    );
    expect(socialLinkProblem({ ...link, url: "javascript:alert(1)" })).toMatch(
      /https:\/\//,
    );
    for (const url of [
      "https://user:pass@example.com",
      "https://example.com@evil.com",
      "https://localhost/a",
      "https://example.com/a b",
      'https://example.com/"><x>',
      "https://example.com/\\evil",
    ])
      expect(socialLinkProblem({ ...link, url })).toMatch(/without a user name/);
    expect(
      socialLinkProblem({ ...link, url: `https://example.com/${"a".repeat(500)}` }),
    ).toMatch(/under 500/);
    expect(socialLinkProblem({ kind: "other", url: link.url })).toBe(
      "Name this link.",
    );
    expect(socialLinkProblem({ ...link, label: "x".repeat(61) })).toMatch(/under 60/);
    expect(socialLinkProblem({ ...link, label: "a\u0007b" })).toMatch(/hidden/);
  });

  it("names a link by its own name or its network", () => {
    expect(socialLinkName({ kind: "instagram", url: link.url })).toBe("Instagram");
    expect(socialLinkName({ kind: "other", url: link.url, label: " Shop " })).toBe(
      "Shop",
    );
  });

  it("trims links for the API and drops empty names", () => {
    expect(
      cleanSocialLinks([
        { kind: "x", url: " https://x.com/a ", label: "  " },
        { kind: "other", url: link.url, label: " Blog " },
      ]),
    ).toEqual([
      { kind: "x", url: "https://x.com/a" },
      { kind: "other", url: link.url, label: "Blog" },
    ]);
  });

  it("shows only stored links that are known and safe", () => {
    expect(publicSocialLinks(undefined)).toEqual([]);
    expect(
      publicSocialLinks([
        link,
        null,
        { kind: "myspace", url: link.url },
        { kind: "website", url: "javascript:alert(1)" },
        { kind: "website", url: link.url, label: 3 },
      ]),
    ).toEqual([link]);
    expect(withSiteDefaults({}).socialLinks).toEqual([]);
    expect(withSiteDefaults({ socialLinks: [link] }).socialLinks).toEqual([link]);
  });
});
