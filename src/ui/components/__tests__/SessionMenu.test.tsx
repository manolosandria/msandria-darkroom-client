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
const { SessionProvider } = await import("../SessionProvider");

// The menu reads the session the provider holds, so it is always rendered inside one,
// exactly as the layout does it.
function renderMenu() {
  return render(
    <SessionProvider>
      <SessionMenu />
    </SessionProvider>,
  );
}

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
    renderMenu();

    await waitFor(() =>
      expect(screen.getByTestId("google-signin-button")).toBeInTheDocument(),
    );
  });

  it("greets the signed-in visitor by name", async () => {
    getCurrentUser.mockResolvedValue(viewer);

    renderMenu();

    expect(await screen.findByText("Visitante")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Your account"));
    expect(screen.getByRole("link", { name: "Account settings" })).toHaveAttribute("href", "/account");
  });

  it("marks the administrator", async () => {
    getCurrentUser.mockResolvedValue(admin);

    renderMenu();

    expect(await screen.findByText("Admin")).toBeInTheDocument();
  });

  // The badge only reflects what the API said; it grants nothing by itself.
  it("does not mark a registered visitor as administrator", async () => {
    getCurrentUser.mockResolvedValue(viewer);

    renderMenu();

    await screen.findByText("Visitante");
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("signs out and tells Google not to sign the visitor back in", async () => {
    getCurrentUser.mockResolvedValue(admin);
    renderMenu();
    await userEvent.click(await screen.findByLabelText("Your account"));
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
    renderMenu();
    await userEvent.click(await screen.findByLabelText("Your account"));
    const button = await screen.findByRole("button", { name: "Sign out" });

    await userEvent.click(button);

    expect(await screen.findByText("Could not sign out")).toBeInTheDocument();
  });

  it("lets the visitor retry when the API is unreachable", async () => {
    getCurrentUser.mockRejectedValueOnce(new Error("boom"));
    getCurrentUser.mockResolvedValue(viewer);
    renderMenu();

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Visitante")).toBeInTheDocument();
  });

  // Flashing a sign-in button at someone who is already signed in reads as having
  // been logged out.
  // Collapsing the menu under a press on its own text crashed Chromium tabs.
  it("stays open when its plain text, such as the Admin label, is pressed", async () => {
    getCurrentUser.mockResolvedValue(admin);
    renderMenu();
    await userEvent.click(await screen.findByLabelText("Your account"));
    const menu = screen.getByText("Admin").closest("details")!;

    await userEvent.click(screen.getByText("Admin"));
    await userEvent.click(screen.getByText("manolo@example.com"));

    expect(menu.open).toBe(true);
  });

  it("closes when pressing outside it or tabbing away", async () => {
    getCurrentUser.mockResolvedValue(admin);
    render(
      <SessionProvider>
        <SessionMenu />
        <button type="button">Elsewhere</button>
      </SessionProvider>,
    );
    await userEvent.click(await screen.findByLabelText("Your account"));
    const menu = screen.getByText("Admin").closest("details")!;

    await userEvent.click(document.body);
    expect(menu.open).toBe(false);

    await userEvent.click(screen.getByLabelText("Your account"));
    expect(menu.open).toBe(true);
    screen.getByRole("button", { name: "Elsewhere" }).focus();
    expect(menu.open).toBe(false);
  });

  it("shows nothing while the first answer is on its way", () => {
    getCurrentUser.mockReturnValue(new Promise(() => {}));

    renderMenu();

    expect(screen.queryByTestId("google-signin-button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });
});
