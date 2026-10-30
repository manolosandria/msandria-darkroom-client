import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    expect(screen.getByRole("link", { name: "Gallery" })).toHaveAttribute(
      "href",
      "/gallery",
    );
  });

  it("offers the upload page to the administrator", async () => {
    getCurrentUser.mockResolvedValue(accountOf("ADMIN"));

    renderHeader();

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Curator" })).toHaveAttribute(
        "href",
        "/curator",
      ),
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

  describe("folding away", () => {
    function fold() {
      return screen.getByRole("link", { name: "Gallery" }).closest(".site-header__fold");
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
      await screen.findByRole("link", { name: /Curator/ });

      fireEvent.click(screen.getByRole("button", { name: "Hide header" }));

      expect(
        screen.getByRole("button", { name: "Show header, 3 pending notifications" }),
      ).toBeInTheDocument();
    });
  });
});
