import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { User } from "@/src/domain/entities/User";
import { manageContact } from "@/src/infrastructure/contactServices";
import { SessionPorts } from "@/src/ui/hooks/useSession";
import { SessionProvider } from "../SessionProvider";
import Curator from "../Curator";
import {
  CuratorNotificationsProvider,
  useCuratorNotifications,
} from "../CuratorNotifications";

vi.mock("../UploadPanel", () => ({ default: () => <p>Upload workshop</p> }));
vi.mock("../ManagePhotos", () => ({ default: () => <p>Photo library</p> }));
vi.mock("../ManageCollections", () => ({
  default: () => <p>Collection editor</p>,
}));
vi.mock("../CommentModeration", () => ({
  default: () => <p>Moderation queue</p>,
}));
vi.mock("../ContactInbox", () => ({ default: () => <p>Contact inbox</p> }));
vi.mock("@/src/infrastructure/contactServices", () => ({
  manageContact: { notifications: vi.fn() },
}));

const admin = new User({
  id: "usr_admin",
  email: "admin@example.com",
  role: "ADMIN",
});
const viewer = new User({
  id: "usr_1",
  email: "ana@example.com",
  role: "VIEWER",
});

function show(user: User | null, children = <Curator />) {
  const ports: SessionPorts = {
    getCurrentUser: vi.fn().mockResolvedValue(user),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
  render(
    <SessionProvider ports={ports}>
      <CuratorNotificationsProvider>{children}</CuratorNotificationsProvider>
    </SessionProvider>,
  );
}

function Counts() {
  const counts = useCuratorNotifications();
  return <p>{counts ? `${counts.comments}/${counts.inbox}` : "none"}</p>;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(manageContact.notifications).mockResolvedValue({
    comments: 2,
    inbox: 1,
  });
});
afterEach(() => vi.clearAllMocks());

describe("Curator", () => {
  it("restores the last tab after a remount", async () => {
    sessionStorage.setItem("curatorSection", "Collections");
    show(admin);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Collections" }),
      ).toHaveAttribute("aria-current", "page"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Photos" }));
    expect(sessionStorage.getItem("curatorSection")).toBe("Photos");
  });

  it("falls back to Upload when the stored tab is invalid", () => {
    sessionStorage.setItem("curatorSection", "unknown");
    show(admin);
    expect(screen.getByRole("button", { name: "Upload" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
  it("opens on Upload and switches between its sections", async () => {
    show(admin);
    expect(screen.getByRole("button", { name: "Upload" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Upload workshop")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Photos" }));
    expect(screen.getByText("Photo library")).toBeVisible();
    expect(screen.getByText("Upload workshop")).not.toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Collections" }));
    expect(screen.getByText("Collection editor")).toBeVisible();
    // A visited section keeps its state while hidden.
    expect(screen.getByText("Photo library")).not.toBeVisible();
  });

  it("badges the moderation queue and the inbox with what is pending", async () => {
    show(admin);
    expect(
      await screen.findByRole("button", { name: "Moderation2" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inbox1" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Inbox1" }));
    expect(screen.getByText("Contact inbox")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Moderation2" }));
    expect(screen.getByText("Moderation queue")).toBeInTheDocument();
  });
});

describe("CuratorNotificationsProvider", () => {
  it("asks nothing for a visitor", async () => {
    show(viewer, <Counts />);
    await waitFor(() => expect(screen.getByText("none")).toBeInTheDocument());
    expect(manageContact.notifications).not.toHaveBeenCalled();
  });

  it("refreshes when a curator action asks for it, and hides counts it cannot load", async () => {
    show(admin, <Counts />);
    expect(await screen.findByText("2/1")).toBeInTheDocument();

    vi.mocked(manageContact.notifications).mockResolvedValueOnce({
      comments: 0,
      inbox: 1,
    });
    act(() => {
      window.dispatchEvent(new Event("curator:refresh"));
    });
    expect(await screen.findByText("0/1")).toBeInTheDocument();

    vi.mocked(manageContact.notifications).mockRejectedValueOnce(
      new Error("down"),
    );
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(await screen.findByText("none")).toBeInTheDocument();
  });
});
