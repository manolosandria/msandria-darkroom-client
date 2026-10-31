import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { User } from "@/src/domain/entities/User";
import { AccountDeletionError } from "@/src/domain/errors/AccountDeletionError";
import {
  deleteAccount,
  getAccountDeletionPreview,
  updatePublicName,
} from "@/src/infrastructure/sessionServices";
import { disableGoogleAutoSelect } from "@/src/infrastructure/googleIdentity";
import { SessionProvider, useSessionValue } from "../SessionProvider";
import AccountSettings from "../AccountSettings";

vi.mock("@/src/infrastructure/sessionServices", () => ({
  deleteAccount: { execute: vi.fn() },
  getAccountDeletionPreview: { execute: vi.fn() },
  updatePublicName: { execute: vi.fn() },
}));
// The profile has its own tests; here it only waits.
vi.mock("@/src/infrastructure/profileServices", () => ({
  manageProfile: { mine: () => new Promise(() => {}) },
}));
vi.mock("@/src/infrastructure/googleIdentity", () => ({
  disableGoogleAutoSelect: vi.fn(),
}));
const admin = new User({
  id: "admin",
  email: "admin@example.com",
  role: "ADMIN",
});
const ports = {
  getCurrentUser: vi.fn(async (): Promise<User | null> => admin),
  signIn: vi.fn(),
  signOut: vi.fn(),
};
function SessionStatus() {
  const { user } = useSessionValue();
  return <p>{user ? "Session active" : "Session cleared"}</p>;
}
function show() {
  render(
    <SessionProvider ports={ports}>
      <AccountSettings />
      <SessionStatus />
    </SessionProvider>,
  );
}
async function confirm() {
  await userEvent.click(
    await screen.findByRole("button", { name: "Delete my account" }),
  );
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(
    screen.getByRole("button", { name: "Permanently delete my account" }),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  ports.getCurrentUser.mockResolvedValue(admin);
  vi.mocked(getAccountDeletionPreview.execute).mockResolvedValue({
    isLastAdmin: false,
  });
  vi.mocked(deleteAccount.execute).mockResolvedValue();
});
describe("AccountSettings", () => {
  it("does not expose deletion while signed out", async () => {
    ports.getCurrentUser.mockResolvedValue(null);
    show();
    expect(
      await screen.findByText("Sign in to manage your account."),
    ).toBeInTheDocument();
    expect(getAccountDeletionPreview.execute).not.toHaveBeenCalled();
  });
  it("requires confirmation and allows cancelling without a request", async () => {
    vi.mocked(getAccountDeletionPreview.execute).mockResolvedValue({
      isLastAdmin: true,
    });
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete my account" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "You are the last administrator",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "contact the database administrator",
    );
    expect(
      screen.getByRole("button", { name: "Permanently delete my account" }),
    ).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(deleteAccount.execute).not.toHaveBeenCalled();
    expect(screen.getByText("Session active")).toBeInTheDocument();
  });
  it("allows the last administrator to delete after acknowledging the warning", async () => {
    vi.mocked(getAccountDeletionPreview.execute).mockResolvedValue({
      isLastAdmin: true,
    });
    show();
    await confirm();
    expect(deleteAccount.execute).toHaveBeenCalledWith(true);
    expect(
      await screen.findByText(
        "Your account has been deleted and all your sessions have ended.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Session cleared")).toBeInTheDocument();
    expect(disableGoogleAutoSelect).toHaveBeenCalledOnce();
  });
  it("deletes a regular account without acknowledging a last administrator warning", async () => {
    show();
    await confirm();
    expect(deleteAccount.execute).toHaveBeenCalledWith(false);
    expect(screen.getByText("Session cleared")).toBeInTheDocument();
  });
  it("keeps the session on failure and only retries on another explicit click", async () => {
    vi.mocked(deleteAccount.execute).mockRejectedValueOnce(
      new Error("offline"),
    );
    show();
    await confirm();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not delete your account",
    );
    expect(screen.getByText("Session active")).toBeInTheDocument();
    expect(disableGoogleAutoSelect).not.toHaveBeenCalled();
    expect(deleteAccount.execute).toHaveBeenCalledTimes(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Permanently delete my account" }),
    );
    await screen.findByText(
      "Your account has been deleted and all your sessions have ended.",
    );
    expect(deleteAccount.execute).toHaveBeenCalledTimes(2);
  });
  it("shows a newly required last administrator warning and requires a fresh acknowledgement", async () => {
    vi.mocked(deleteAccount.execute).mockRejectedValueOnce(
      new AccountDeletionError("lastAdmin"),
    );
    show();
    await confirm();
    expect(
      await screen.findByText(/You are the last administrator/),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", {
      name: "Permanently delete my account",
    });
    expect(button).toBeDisabled();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(deleteAccount.execute).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(button);
    await screen.findByText(
      "Your account has been deleted and all your sessions have ended.",
    );
    expect(deleteAccount.execute).toHaveBeenLastCalledWith(true);
  });
  it("refreshes the preview after a concurrent account change without replaying deletion", async () => {
    vi.mocked(deleteAccount.execute).mockRejectedValueOnce(
      new AccountDeletionError("changed"),
    );
    vi.mocked(getAccountDeletionPreview.execute)
      .mockResolvedValueOnce({ isLastAdmin: false })
      .mockResolvedValue({ isLastAdmin: true });
    show();
    await confirm();
    await waitFor(() =>
      expect(getAccountDeletionPreview.execute).toHaveBeenCalledTimes(2),
    );
    expect(
      await screen.findByText(/You are the last administrator/),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(deleteAccount.execute).toHaveBeenCalledTimes(1);
  });
  it("offers retry if the warning cannot be loaded and never enables an uninformed deletion", async () => {
    vi.mocked(getAccountDeletionPreview.execute).mockRejectedValueOnce(
      new Error("offline"),
    );
    show();
    expect(
      await screen.findByText("Could not load account deletion details."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete my account" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /retry|try again/i }),
    );
    expect(
      await screen.findByRole("button", { name: "Delete my account" }),
    ).toBeInTheDocument();
  });
  it("lets the account choose its public name and adopts the saved account", async () => {
    const named = (current: string) =>
      new User({
        id: "admin",
        email: "admin@example.com",
        role: "ADMIN",
        publicName: {
          style: current === "Slow Lens" ? "ALIAS" : "FULL_NAME",
          alias: current === "Slow Lens" ? current : null,
          choices: { FULL_NAME: "Manolo Sandria", ...(current === "Slow Lens" ? { ALIAS: current } : {}) },
          current,
        },
      });
    ports.getCurrentUser.mockResolvedValue(named("Manolo Sandria"));
    vi.mocked(updatePublicName.execute).mockResolvedValue(named("Slow Lens"));
    show();

    await userEvent.click(await screen.findByRole("radio", { name: /alias of your own/ }));
    await userEvent.type(screen.getByRole("textbox", { name: "Alias" }), "Slow Lens");
    await userEvent.click(screen.getByRole("button", { name: "Save public name" }));

    expect(await screen.findByText("Public name saved.")).toBeInTheDocument();
    expect(ports.getCurrentUser).toHaveBeenCalledTimes(1);
  });
});
