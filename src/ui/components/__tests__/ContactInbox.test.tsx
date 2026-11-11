import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { User } from "@/src/domain/entities/User";
import { manageContact } from "@/src/infrastructure/contactServices";
import { SessionPorts } from "@/src/ui/hooks/useSession";
import { SessionProvider } from "../SessionProvider";
import ContactInbox from "../ContactInbox";

vi.mock("@/src/infrastructure/contactServices", () => ({
  manageContact: {
    inbox: vi.fn(),
    blocked: vi.fn(),
    block: vi.fn(),
    unblock: vi.fn(),
    read: vi.fn(),
    remove: vi.fn(),
  },
}));

const message = (overrides = {}) => ({
  id: "msg_1",
  name: "Spammer",
  email: "spam@example.com",
  body: "Buy something.",
  createdAt: "2026-11-11T12:00:00.000Z",
  readAt: null,
  senderBlocked: false,
  ...overrides,
});

function show() {
  const session: SessionPorts = {
    getCurrentUser: vi.fn().mockResolvedValue(
      new User({ id: "a", email: "admin@example.com", role: "ADMIN" }),
    ),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
  render(
    <SessionProvider ports={session}>
      <ContactInbox />
    </SessionProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(manageContact.blocked).mockResolvedValue([]);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

describe("ContactInbox", () => {
  it("blocks a message's sender after asking, then shows the sender as blocked", async () => {
    vi.mocked(manageContact.inbox).mockResolvedValueOnce([message()]);
    vi.mocked(manageContact.inbox).mockResolvedValueOnce([
      message({ senderBlocked: true }),
    ]);
    vi.mocked(manageContact.block).mockResolvedValue();
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Block sender/ }));
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("spam@example.com"),
    );
    expect(manageContact.block).toHaveBeenCalledWith("msg_1");
    expect(await screen.findByText("Sender blocked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Block sender/ })).toBeNull();
  });

  it("does not block when the question is declined", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    vi.mocked(manageContact.inbox).mockResolvedValue([message()]);
    show();
    await userEvent.click(await screen.findByRole("button", { name: /Block sender/ }));
    expect(manageContact.block).not.toHaveBeenCalled();
  });

  it("lists blocked senders and unblocks one", async () => {
    vi.mocked(manageContact.inbox).mockResolvedValue([]);
    vi.mocked(manageContact.blocked)
      .mockResolvedValueOnce([
        { id: "b1", email: "spam@example.com", createdAt: "2026-11-11T12:00:00Z" },
      ])
      .mockResolvedValue([]);
    vi.mocked(manageContact.unblock).mockResolvedValue();
    show();

    const list = await screen.findByRole("region", { name: "Blocked senders" });
    expect(list).toHaveTextContent("spam@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Unblock" }));
    expect(manageContact.unblock).toHaveBeenCalledWith("b1");
    expect(
      await screen.findByText("No messages yet."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Blocked senders" })).toBeNull();
  });
});
