import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { User, UserRole } from "@/src/domain/entities/User";
import { SessionPorts } from "@/src/ui/hooks/useSession";
import MainHeader from "../MainHeader";
import { SessionProvider } from "../SessionProvider";
import { writeHeaderHidden } from "@/src/ui/headerPreference";

const getCurrentUser = vi.fn();
const notifications = vi.hoisted(() => ({
  current: null as { comments: number; inbox: number } | null,
}));

vi.mock("../CuratorNotifications", () => ({
  useCuratorNotifications: () => notifications.current,
}));

const sessionPorts: SessionPorts = {
  getCurrentUser: () => getCurrentUser(),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

vi.mock("@/src/infrastructure/sessionServices", () => ({
  googleClientId: "client-123",
  getCurrentUser: { execute: vi.fn() },
  signIn: { execute: vi.fn() },
  signOut: { execute: vi.fn() },
}));

vi.mock("@/src/infrastructure/googleIdentity", () => ({
  GOOGLE_IDENTITY_SRC: "https://accounts.google.com/gsi/client",
  isGoogleIdentityReady: () => false,
  renderGoogleButton: vi.fn(),
  disableGoogleAutoSelect: vi.fn(),
}));

function renderHeader() {
  return render(
    <SessionProvider ports={sessionPorts}>
      <MainHeader />
    </SessionProvider>,
  );
}

function accountOf(role: UserRole) {
  return new User({ id: `usr_${role}`, email: "manolo@example.com", role });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  window.localStorage.clear();
  notifications.current = null;
  act(() => writeHeaderHidden(false));
});

describe("MainHeader", () => {
  it("always offers the gallery", async () => {
    getCurrentUser.mockResolvedValue(null);

    renderHeader();

    expect(
      within(
        screen.getByRole("navigation", { name: "Main navigation" }),
      ).getByRole("link", { name: "Gallery" }),
    ).toHaveAttribute("href", "/gallery");
    // The page menu beside the account holds the same links for small screens, and
    // the three bars that used to open them are gone.
    expect(
      within(screen.getByRole("navigation", { name: "Site pages" })).getByRole(
        "link",
        { name: "Gallery" },
      ),
    ).toHaveAttribute("href", "/gallery");
    expect(screen.queryByRole("button", { name: "Open the menu" })).toBeNull();
  });

  it("leaves Curator to the pill instead of the header's links", async () => {
    getCurrentUser.mockResolvedValue(accountOf("ADMIN"));

    renderHeader();

    await screen.findByRole("button", { name: /^Curator and site pages/ });
    expect(
      within(
        screen.getByRole("navigation", { name: "Main navigation" }),
      ).queryByRole("link", { name: "Curator" }),
    ).toBeNull();
  });

  it("keeps Curator folded at hand for the administrator, off outside Curator", async () => {
    getCurrentUser.mockResolvedValue(accountOf("ADMIN"));

    renderHeader();

    // Outside Curator it names the page on show and stays off.
    const pill = await screen.findByRole("button", {
      name: "Curator and site pages: Home",
    });
    expect(pill.closest(".curator-pill")).not.toHaveAttribute("data-lit");
    await userEvent.click(pill);
    const menu = screen.getByRole("navigation", { name: "Curator sections" });
    expect(within(menu).getByRole("link", { name: "Variants" })).toHaveAttribute(
      "href",
      "/curator?section=Variants",
    );
    // The site's own pages come first, so the pill stands in for a folded header.
    expect(
      within(within(menu).getByRole("group", { name: "Site" })).getByRole("link", {
        name: "Gallery",
      }),
    ).toHaveAttribute(
      "href",
      "/gallery",
    );
  });

  // Hiding the link is only tidiness. The API turns down a publish from anyone but
  // the administrator, whatever the header chose to show.
  it("does not offer it to a registered visitor", async () => {
    getCurrentUser.mockResolvedValue(accountOf("VIEWER"));

    renderHeader();

    await screen.findByLabelText("Your account");
    expect(screen.queryByRole("link", { name: "Curator" })).not.toBeInTheDocument();
  });

  it("does not offer it to a visitor without a session", async () => {
    getCurrentUser.mockResolvedValue(null);

    renderHeader();

    await waitFor(() =>
      expect(screen.getByTestId("google-signin-button")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("link", { name: "Curator" })).not.toBeInTheDocument();
  });

  it("keeps the account in the corner and docks the logo once scrolled", async () => {
    getCurrentUser.mockResolvedValue(null);
    renderHeader();
    expect(
      screen.queryByRole("link", { name: "Manolo Sandria — home", hidden: false }),
    ).toBeInTheDocument();
    expect(document.querySelector(".site-header__dock-pill")).toBeNull();

    act(() => {
      Object.defineProperty(window, "scrollY", { value: 400, configurable: true });
      window.dispatchEvent(new Event("scroll"));
    });

    expect(document.querySelector(".site-header__dock-pill")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Show header" })).toBeInTheDocument();
    // Only scrolled: the header keeps its place in the page.
    expect(document.querySelector(".site-header__fold")).not.toHaveAttribute("inert");
    act(() => {
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      window.dispatchEvent(new Event("scroll"));
    });
    expect(document.querySelector(".site-header__dock-pill")).toBeNull();
  });

  describe("bringing a scrolled-away header back", () => {
    function scrollTo(y: number) {
      act(() => {
        Object.defineProperty(window, "scrollY", { value: y, configurable: true });
        window.dispatchEvent(new Event("scroll"));
      });
    }
    function narrow(matches: boolean) {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query.includes("min-width") ? !matches : matches,
        media: query,
      }));
    }
    const header = () => document.querySelector(".site-header");

    afterEach(() => {
      vi.unstubAllGlobals();
      scrollTo(0);
    });

    it("stays compact on a narrow screen: no chevron, and scrolling docks it", () => {
      getCurrentUser.mockResolvedValue(null);
      narrow(true);
      renderHeader();
      expect(screen.queryByRole("button", { name: /header/ })).toBeNull();
      scrollTo(400);
      expect(header()).toHaveAttribute("data-docked", "true");
      scrollTo(0);
      expect(header()).not.toHaveAttribute("data-docked");
    });

    it("ignores a fold remembered on a wide screen", () => {
      getCurrentUser.mockResolvedValue(null);
      localStorage.setItem("headerHidden", "true");
      narrow(true);
      renderHeader();
      expect(header()).toHaveAttribute("data-hidden", "false");
      expect(header()).not.toHaveAttribute("data-docked");
      localStorage.removeItem("headerHidden");
    });

    it("returns to the top on a wide screen", () => {
      getCurrentUser.mockResolvedValue(null);
      narrow(false);
      const scroll = vi.fn();
      window.scrollTo = scroll as typeof window.scrollTo;
      renderHeader();
      scrollTo(400);

      fireEvent.click(screen.getByRole("button", { name: "Show header" }));

      expect(scroll).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });
  });

  describe("folding away", () => {
    function fold() {
      return document.querySelector(".site-header__fold");
    }

    it("hides the header and hands focus to the Menu tab", async () => {
      getCurrentUser.mockResolvedValue(null);
      renderHeader();

      fireEvent.click(screen.getByRole("button", { name: "Hide header" }));

      const reveal = screen.getByRole("button", { name: "Show header" });
      expect(reveal).toHaveAttribute("aria-expanded", "false");
      expect(fold()).toHaveAttribute("inert");
      await waitFor(() => expect(reveal).toHaveFocus());
    });

    it("brings it back and returns focus to the hide control", async () => {
      getCurrentUser.mockResolvedValue(null);
      renderHeader();
      fireEvent.click(screen.getByRole("button", { name: "Hide header" }));

      fireEvent.click(screen.getByRole("button", { name: "Show header" }));

      const hide = screen.getByRole("button", { name: "Hide header" });
      expect(hide).toHaveAttribute("aria-expanded", "true");
      expect(fold()).not.toHaveAttribute("inert");
      await waitFor(() => expect(hide).toHaveFocus());
    });

    it("remembers the choice for the next page", () => {
      getCurrentUser.mockResolvedValue(null);
      const { unmount } = renderHeader();
      fireEvent.click(screen.getByRole("button", { name: "Hide header" }));
      unmount();

      renderHeader();

      expect(window.localStorage.getItem("headerHidden")).toBe("true");
      expect(fold()).toHaveAttribute("inert");
      // Arriving with the header already hidden is not animated.
      expect(fold()?.parentElement).not.toHaveAttribute("data-animated");
    });

    it("still folds when the browser refuses storage", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      getCurrentUser.mockResolvedValue(null);
      renderHeader();

      fireEvent.click(screen.getByRole("button", { name: "Hide header" }));

      expect(fold()).toHaveAttribute("inert");
      expect(screen.getByRole("button", { name: "Show header" })).toBeInTheDocument();
    });

    it("tells the administrator about pending work on the folded tab", async () => {
      getCurrentUser.mockResolvedValue(accountOf("ADMIN"));
      notifications.current = { comments: 2, inbox: 1 };
      renderHeader();
      await screen.findByRole("button", { name: /^Curator and site pages/ });

      fireEvent.click(screen.getByRole("button", { name: "Hide header" }));

      expect(
        screen.getByRole("button", { name: "Show header, 3 pending notifications" }),
      ).toBeInTheDocument();
    });
  });
});
