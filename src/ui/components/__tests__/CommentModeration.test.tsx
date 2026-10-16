import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PendingComment } from "@/src/domain/entities/PhotoComment";
import { User } from "@/src/domain/entities/User";
import { CommentError } from "@/src/domain/errors/CommentError";
import {
  approveComment,
  deleteComment,
  getPendingComments,
} from "@/src/infrastructure/commentServices";
import { SessionPorts } from "@/src/ui/hooks/useSession";
import { SessionProvider } from "../SessionProvider";
import CommentModeration from "../CommentModeration";

vi.mock("@/src/infrastructure/commentServices", () => ({
  getPendingComments: { execute: vi.fn() },
  approveComment: { execute: vi.fn() },
  deleteComment: { execute: vi.fn() },
}));

const admin = new User({ id: "usr_admin", email: "admin@example.com", role: "ADMIN" });
const viewer = new User({ id: "usr_1", email: "ana@example.com", role: "VIEWER" });

const pending = (id: string, overrides: Partial<PendingComment> = {}): PendingComment => ({
  id,
  photo: { id: "pho_1", title: "Virgencita" },
  authorName: "Ana G.",
  body: `Comment ${id}`,
  createdAt: new Date("2026-10-17T18:00:00.000Z"),
  ...overrides,
});

function show(user: User | null) {
  const ports: SessionPorts = {
    getCurrentUser: vi.fn().mockResolvedValue(user),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
  render(
    <SessionProvider ports={ports}>
      <CommentModeration />
    </SessionProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPendingComments.execute).mockResolvedValue([
    pending("a"),
    pending("b", { authorName: null }),
  ]);
  vi.mocked(approveComment.execute).mockResolvedValue();
  vi.mocked(deleteComment.execute).mockResolvedValue();
});

describe("CommentModeration", () => {
  it("is for the administrator only", async () => {
    show(viewer);
    expect(await screen.findByText(/administrator to review comments/)).toBeInTheDocument();
    expect(getPendingComments.execute).not.toHaveBeenCalled();
  });

  it("lists pending comments with their photo and author", async () => {
    show(admin);
    expect(await screen.findByText("Comment a")).toBeInTheDocument();
    expect(screen.getByText("Ana G.")).toBeInTheDocument();
    expect(screen.getByText("Deleted user")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Virgencita" })[0]).toHaveAttribute(
      "href",
      "/photo/pho_1",
    );
  });

  it("approves or deletes a comment and takes it out of the queue", async () => {
    show(admin);
    await screen.findByText("Comment a");

    await userEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]);
    expect(approveComment.execute).toHaveBeenCalledWith("a");
    await waitFor(() => expect(screen.queryByText("Comment a")).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(deleteComment.execute).toHaveBeenCalledWith("b");
    expect(await screen.findByText("No comments are waiting for review.")).toBeInTheDocument();
  });

  it("keeps a comment whose action failed and says why", async () => {
    vi.mocked(approveComment.execute).mockRejectedValue(new CommentError("notFound"));
    show(admin);
    await screen.findByText("Comment a");

    await userEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent("no longer exists");
    expect(screen.getByText("Comment a")).toBeInTheDocument();
  });

  it("offers to retry a queue that could not load", async () => {
    vi.mocked(getPendingComments.execute).mockRejectedValueOnce(new Error("down"));
    show(admin);

    expect(await screen.findByText("Could not load the pending comments.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(await screen.findByText("Comment a")).toBeInTheDocument();
  });
});
