import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { User } from "@/src/domain/entities/User";

const getCurrentUser = vi.fn();
const signIn = vi.fn();
const signOut = vi.fn();
const disableGoogleAutoSelect = vi.fn();

// The wired-up services are replaced so the menu is exercised without an API.
vi.mock("@/src/infrastructure/sessionServices", () => ({
  googleClientId: "client-123",
  getCurrentUser: { execute: () => getCurrentUser() },
  signIn: { execute: (token: string) => signIn(token) },
  signOut: { execute: () => signOut() },
}));

vi.mock("@/src/infrastructure/googleIdentity", () => ({
  GOOGLE_IDENTITY_SRC: "https://accounts.google.com/gsi/client",
  isGoogleIdentityReady: () => false,
  renderGoogleButton: vi.fn(),
  disableGoogleAutoSelect: () => disableGoogleAutoSelect(),
}));

const { default: SessionMenu } = await import("../SessionMenu");

const admin = new User({
  id: "usr_admin",
  email: "manolo@example.com",
  name: "Manolo Sandria",
  role: "ADMIN",
});

const viewer = new User({
  id: "usr_viewer",
  email: "visitante@example.com",
  name: "Visitante",
  role: "VIEWER",
});

beforeEach(() => {
  getCurrentUser.mockResolvedValue(null);
  signIn.mockResolvedValue(viewer);
  signOut.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SessionMenu", () => {
  it("offers Google sign-in to a visitor without a session", async () => {
    render(<SessionMenu />);

    await waitFor(() =>
      expect(screen.getByTestId("google-signin-button")).toBeInTheDocument(),
    );
  });

  it("greets the signed-in visitor by name", async () => {
    getCurrentUser.mockResolvedValue(viewer);

    render(<SessionMenu />);

    expect(await screen.findByText("Visitante")).toBeInTheDocument();
  });

  it("marks the administrator", async () => {
    getCurrentUser.mockResolvedValue(admin);

    render(<SessionMenu />);

    expect(await screen.findByText("Admin")).toBeInTheDocument();
  });

  // The badge only reflects what the API said; it grants nothing by itself.
  it("does not mark a registered visitor as administrator", async () => {
    getCurrentUser.mockResolvedValue(viewer);

    render(<SessionMenu />);

    await screen.findByText("Visitante");
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("signs out and tells Google not to sign the visitor back in", async () => {
    getCurrentUser.mockResolvedValue(admin);
    render(<SessionMenu />);
    const button = await screen.findByRole("button", { name: "Sign out" });

    await userEvent.click(button);

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(disableGoogleAutoSelect).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByTestId("google-signin-button")).toBeInTheDocument(),
    );
  });

  it("keeps the visitor signed in when signing out failed", async () => {
    getCurrentUser.mockResolvedValue(admin);
    signOut.mockRejectedValue(new Error("boom"));
    render(<SessionMenu />);
    const button = await screen.findByRole("button", { name: "Sign out" });

    await userEvent.click(button);

    expect(await screen.findByText("Could not sign out")).toBeInTheDocument();
  });

  it("lets the visitor retry when the API is unreachable", async () => {
    getCurrentUser.mockRejectedValueOnce(new Error("boom"));
    getCurrentUser.mockResolvedValue(viewer);
    render(<SessionMenu />);

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Visitante")).toBeInTheDocument();
  });

  // Flashing a sign-in button at someone who is already signed in reads as having
  // been logged out.
  it("shows nothing while the first answer is on its way", () => {
    getCurrentUser.mockReturnValue(new Promise(() => {}));

    render(<SessionMenu />);

    expect(screen.queryByTestId("google-signin-button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });
});
