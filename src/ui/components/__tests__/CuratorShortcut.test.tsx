import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CuratorShortcut } from "../CuratorPill";
import { announceCuratorSection } from "@/src/ui/curatorChannel";
import { defaultSiteSettings } from "@/src/domain/entities/SiteSettings";
import { SiteSettingsProvider } from "../SiteSettingsProvider";

const path = vi.hoisted(() => ({ current: "/curator" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

describe("The Curator pill beside the account", () => {
  afterEach(() =>
    act(() => announceCuratorSection(null)),
  );

  it("is lit inside Curator, says CURATOR with the open tab and switches tabs in place", async () => {
    path.current = "/curator";
    const asked: string[] = [];
    const listen = (event: Event) =>
      asked.push((event as CustomEvent<string>).detail);
    window.addEventListener("curator:show", listen);
    render(<CuratorShortcut pending={2} />);
    act(() => announceCuratorSection("Upload"));

    const pill = screen.getByRole("button", {
      name: "Curator and site pages: Upload",
    });
    expect(pill.closest(".curator-pill")).toHaveAttribute("data-lit");
    expect(within(pill).getByText("Curator")).toBeInTheDocument();
    await userEvent.click(pill);
    const menu = screen.getByRole("navigation", { name: "Curator sections" });
    expect(within(menu).getByRole("button", { name: "Upload" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // The header's chevron, not the menu, brings Curator's tabs back.
    expect(
      within(menu).queryByRole("button", { name: "Show Curator's tabs" }),
    ).toBeNull();
    await userEvent.click(within(menu).getByRole("button", { name: "Variants" }));
    expect(asked).toEqual(["Variants"]);
    expect(pill).toHaveAttribute("aria-expanded", "false");
    window.removeEventListener("curator:show", listen);
  });

  it("names the page outside Curator, stays off and marks the page in its site links", async () => {
    path.current = "/gallery";
    render(<CuratorShortcut />);
    const pill = screen.getByRole("button", {
      name: "Curator and site pages: Gallery",
    });
    expect(pill.closest(".curator-pill")).not.toHaveAttribute("data-lit");
    // CURATOR is said inside Curator only.
    expect(within(pill).queryByText("Curator")).toBeNull();
    await userEvent.click(pill);
    const site = screen.getByRole("group", { name: "Site" });
    expect(within(site).getByRole("link", { name: "Gallery" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(screen.getByRole("group", { name: "Curator" })).getByRole("link", {
        name: "Gallery",
      }),
    ).toHaveAttribute("href", "/curator?section=Gallery");
  });

  it.each([
    ["/photo/a", "Photo"],
    ["/profile/a", "Profile"],
    ["/account", "Account"],
    ["/sign-in/email", "Menu"],
  ])("calls %s %s", (pathname, name) => {
    path.current = pathname;
    render(<CuratorShortcut />);
    expect(
      screen.getByRole("button", { name: `Curator and site pages: ${name}` }),
    ).toBeInTheDocument();
  });

  it("gives a visitor the site's pages alone, under the page's name", async () => {
    path.current = "/collections";
    render(<CuratorShortcut admin={false} />);
    const pill = screen.getByRole("button", { name: "Site pages: Collections" });
    expect(pill.closest(".curator-pill")).toHaveClass("is-visitor");
    expect(within(pill).queryByText("Curator")).toBeNull();
    await userEvent.click(pill);
    expect(screen.queryByRole("group", { name: "Admin" })).toBeNull();
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  it("offers the owner's profiles elsewhere beside Contact, for visitors too", async () => {
    path.current = "/";
    const service = {
      get: vi.fn().mockResolvedValue({
        ...defaultSiteSettings,
        socialLinks: [{ kind: "youtube", url: "https://youtube.com/@someone" }],
      }),
    };
    render(
      <SiteSettingsProvider service={service}>
        <CuratorShortcut admin={false} />
      </SiteSettingsProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Site pages: Home" }));
    const site = screen.getByRole("group", { name: "Site" });
    const youtube = await within(site).findByRole("link", {
      name: "YouTube (opens in a new tab)",
    });
    expect(youtube).toHaveAttribute("target", "_blank");
    expect(youtube).toHaveAttribute("rel", "noopener noreferrer");
  });
});
