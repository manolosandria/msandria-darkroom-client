import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { User } from "@/src/domain/entities/User";
import { SessionPorts } from "@/src/ui/hooks/useSession";
import { SessionProvider } from "../SessionProvider";
import { AdminOnly } from "../AdminOnly";

const admin = new User({ id: "usr_admin", email: "admin@example.com", role: "ADMIN" });
const viewer = new User({ id: "usr_1", email: "ana@example.com", role: "VIEWER" });

function show(getCurrentUser: SessionPorts["getCurrentUser"]) {
  const ports: SessionPorts = { getCurrentUser, signIn: vi.fn(), signOut: vi.fn() };
  render(
    <SessionProvider ports={ports}>
      <AdminOnly to="edit Home">
        <p>The editor</p>
      </AdminOnly>
    </SessionProvider>,
  );
}

describe("AdminOnly", () => {
  it("says it is asking for the session first", () => {
    show(() => new Promise(() => {}));
    expect(screen.getByRole("status")).toHaveTextContent("Loading session…");
    expect(screen.queryByText("The editor")).not.toBeInTheDocument();
  });

  it("shows its content to the administrator", async () => {
    show(vi.fn().mockResolvedValue(admin));
    expect(await screen.findByText("The editor")).toBeInTheDocument();
  });

  it("tells anyone else what signing in as the administrator allows", async () => {
    show(vi.fn().mockResolvedValue(viewer));
    expect(
      await screen.findByText(
        "Sign in as the gallery's administrator to edit Home.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("The editor")).not.toBeInTheDocument();
  });

  it("offers to ask again when the API could not be reached", async () => {
    const getCurrentUser = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(admin);
    show(getCurrentUser);
    await userEvent.click(await screen.findByRole("button", { name: "Try Again" }));
    expect(await screen.findByText("The editor")).toBeInTheDocument();
  });
});
