import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { defaultSiteSettings } from "@/src/domain/entities/SiteSettings";
import { SocialLinkList } from "../SocialLinkList";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

const { SiteFooter } = await import("../SiteFooter");
const { SiteSettingsProvider } = await import("../SiteSettingsProvider");

const links = [
  { kind: "instagram" as const, url: "https://instagram.com/someone" },
  { kind: "other" as const, url: "https://blog.example.com", label: "Blog" },
];

describe("SocialLinkList", () => {
  it("opens each profile in a new tab without the referrer, named for screen readers", () => {
    render(<SocialLinkList links={links} />);
    const list = screen.getByRole("list", { name: "Elsewhere" });
    expect(list).toBeInTheDocument();
    const instagram = screen.getByRole("link", {
      name: "Instagram (opens in a new tab)",
    });
    expect(instagram).toHaveAttribute("href", "https://instagram.com/someone");
    expect(instagram).toHaveAttribute("target", "_blank");
    expect(instagram).toHaveAttribute("rel", "noopener noreferrer");
    expect(instagram).toHaveAttribute("title", "Instagram");
    expect(
      screen.getByRole("link", { name: "Blog (opens in a new tab)" }),
    ).toBeInTheDocument();
  });

  it("draws an inert row and nothing at all without links", () => {
    const { container, rerender } = render(<SocialLinkList links={links} inert />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(2);
    rerender(<SocialLinkList links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("SiteFooter", () => {
  const service = (socialLinks: typeof links) => ({
    get: vi.fn().mockResolvedValue({ ...defaultSiteSettings, socialLinks }),
  });

  it("shows the links at the end of public pages", async () => {
    pathname.value = "/gallery";
    render(
      <SiteSettingsProvider service={service(links)}>
        <SiteFooter />
      </SiteSettingsProvider>,
    );
    expect(
      await screen.findByRole("link", { name: "Instagram (opens in a new tab)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("stays away from full-window screens and from a site without links", async () => {
    pathname.value = "/photo/abc";
    const withLinks = service(links);
    const { unmount } = render(
      <SiteSettingsProvider service={withLinks}>
        <SiteFooter />
      </SiteSettingsProvider>,
    );
    await vi.waitFor(() => expect(withLinks.get).toHaveBeenCalled());
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    unmount();
    pathname.value = "/";
    const none = service([]);
    render(
      <SiteSettingsProvider service={none}>
        <SiteFooter />
      </SiteSettingsProvider>,
    );
    await vi.waitFor(() => expect(none.get).toHaveBeenCalled());
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });
});
