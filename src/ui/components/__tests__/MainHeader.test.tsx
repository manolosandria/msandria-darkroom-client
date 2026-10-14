import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { User, UserRole } from "@/src/domain/entities/User";
import { SessionPorts } from "@/src/ui/hooks/useSession";
import MainHeader from "../MainHeader";
import { SessionProvider } from "../SessionProvider";

const getCurrentUser = vi.fn();

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
      expect(screen.getByRole("link", { name: "Upload" })).toHaveAttribute(
        "href",
        "/upload",
      ),
    );
  });

  // Hiding the link is only tidiness. The API turns down a publish from anyone but
  // the administrator, whatever the header chose to show.
  it("does not offer it to a registered visitor", async () => {
    getCurrentUser.mockResolvedValue(accountOf("VIEWER"));

    renderHeader();

    await screen.findByText("manolo@example.com");
    expect(screen.queryByRole("link", { name: "Upload" })).not.toBeInTheDocument();
  });

  it("does not offer it to a visitor without a session", async () => {
    getCurrentUser.mockResolvedValue(null);

    renderHeader();

    await waitFor(() =>
      expect(screen.getByTestId("google-signin-button")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("link", { name: "Upload" })).not.toBeInTheDocument();
  });
});
