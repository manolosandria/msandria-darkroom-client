import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const path = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

const mine = vi.fn();
vi.mock("@/src/infrastructure/profileServices", () => ({
  manageProfile: { mine: () => mine() },
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
  mine.mockRejectedValue(new Error("offline"));
  getCurrentUser.mockResolvedValue(null);
  signIn.mockResolvedValue(viewer);
  signOut.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  path.current = "/";
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

    expect((await screen.findAllByText("Visitante"))[0]).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Your account"));
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/account");
  });

  it("shows the initial and links to the visitor's public profile", async () => {
    getCurrentUser.mockResolvedValue(viewer);

    renderMenu();

    await userEvent.click(await screen.findByLabelText("Your account"));
    expect(mine).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("V").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile/usr_viewer",
    );
  });

  it("marks the administrator", async () => {
    getCurrentUser.mockResolvedValue(admin);

    renderMenu();

    expect(await screen.findByText("Admin")).toBeInTheDocument();
  });

  it("rings the administrator's account and offers Curator's backdrop inside Curator", async () => {
    getCurrentUser.mockResolvedValue(admin);
    path.current = "/curator";

    renderMenu();

    const account = await screen.findByLabelText("Your account");
    expect(account.closest("details")).toHaveAttribute("data-admin");
    // Inside Curator the name folds away until pointed at, to free the editors.
    expect(account.closest("details")).toHaveAttribute("data-compact");
    const backdrop = screen.getByRole("radiogroup", { name: "Backdrop" });
    fireEvent.click(screen.getByRole("radio", { name: "Dusk backdrop" }));
    expect(screen.getByRole("radio", { name: "Dusk backdrop" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(backdrop).toBeInTheDocument();
  });

  it("keeps the backdrop out of the menu outside Curator", async () => {
    getCurrentUser.mockResolvedValue(admin);

    renderMenu();

    const account = await screen.findByLabelText("Your account");
    expect(screen.queryByRole("radiogroup", { name: "Backdrop" })).toBeNull();
    expect(account.closest("details")).not.toHaveAttribute("data-compact");
  });

  it("opens when the mouse points at it, stays open on the press that follows and closes on leaving", async () => {
    getCurrentUser.mockResolvedValue(viewer);

    renderMenu();

    const summary = await screen.findByLabelText("Your account");
    const details = summary.closest("details")!;
    fireEvent.pointerEnter(details, { pointerType: "mouse" });
    expect(details.open).toBe(true);
    fireEvent.click(summary);
    expect(details.open).toBe(true);
    fireEvent.pointerLeave(details, { pointerType: "mouse" });
    expect(details.open).toBe(false);
    // Touch keeps to presses.
    fireEvent.pointerEnter(details, { pointerType: "touch" });
    expect(details.open).toBe(false);
  });

  // The badge only reflects what the API said; it grants nothing by itself.
  it("does not mark a registered visitor as administrator", async () => {
    getCurrentUser.mockResolvedValue(viewer);

    renderMenu();

    await screen.findAllByText("Visitante");
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Your account").closest("details"),
    ).not.toHaveAttribute("data-admin");
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

    expect((await screen.findAllByText("Visitante"))[0]).toBeInTheDocument();
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
