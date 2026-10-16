import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhotoComment } from "@/src/domain/entities/PhotoComment";
import { User } from "@/src/domain/entities/User";
import { CommentError } from "@/src/domain/errors/CommentError";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import {
  deleteComment,
  getPhotoComments,
  postComment,
} from "@/src/infrastructure/commentServices";
import { SessionPorts } from "@/src/ui/hooks/useSession";
import { SessionProvider } from "../SessionProvider";
import { PhotoComments } from "../PhotoComments";

vi.mock("@/src/infrastructure/commentServices", () => ({
  getPhotoComments: { execute: vi.fn() },
  postComment: { execute: vi.fn() },
  deleteComment: { execute: vi.fn() },
}));

const viewer = (current: string | null = "Ana G.") =>
  new User({
    id: "usr_1",
    email: "ana@example.com",
    role: "VIEWER",
    publicName: {
      style: "GIVEN_NAME_INITIAL",
      alias: null,
      choices: current ? { GIVEN_NAME_INITIAL: current } : {},
      current,
    },
  });

const comment = (overrides: Partial<ConstructorParameters<typeof PhotoComment>[0]> = {}) =>
  new PhotoComment({
    id: "cmt_1",
    authorName: "Luis M.",
    body: "What light",
    status: "APPROVED",
    createdAt: new Date("2026-10-17T18:00:00.000Z"),
    mine: false,
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
      <PhotoComments photoId="pho_1" />
    </SessionProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPhotoComments.execute).mockResolvedValue([]);
});

describe("PhotoComments", () => {
  it("shows approved comments to a visitor and invites them to sign in", async () => {
    vi.mocked(getPhotoComments.execute).mockResolvedValue([comment()]);
    show(null);

    expect(await screen.findByText("What light")).toBeInTheDocument();
    expect(screen.getByText("Luis M.")).toBeInTheDocument();
    expect(screen.getByText("Oct 17, 2026")).toBeInTheDocument();
    expect(screen.getByText("Sign in to leave a comment.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(getPhotoComments.execute).toHaveBeenCalledWith("pho_1");
  });

  it("names a deleted author without inventing one", async () => {
    vi.mocked(getPhotoComments.execute).mockResolvedValue([comment({ authorName: null })]);
    show(null);
    expect(await screen.findByText("Deleted user")).toBeInTheDocument();
  });

  it("says when there are no comments yet", async () => {
    show(null);
    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
  });

  it("offers to retry when the comments cannot load", async () => {
    vi.mocked(getPhotoComments.execute).mockRejectedValueOnce(new Error("down"));
    show(null);

    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
    expect(getPhotoComments.execute).toHaveBeenCalledTimes(2);
  });

  it("sends a comment, shows it pending and explains moderation", async () => {
    vi.mocked(postComment.execute).mockResolvedValue(
      comment({ id: "cmt_2", authorName: "Ana G.", body: "Lovely", status: "PENDING", mine: true }),
    );
    show(viewer());

    expect(await screen.findByText("Ana G.")).toBeInTheDocument();
    const box = screen.getByRole("textbox", { name: "Comment" });
    expect(screen.getByRole("button", { name: "Post comment" })).toBeDisabled();
    await userEvent.type(box, "Lovely");
    expect(screen.getByText("6/1000")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Post comment" }));

    expect(postComment.execute).toHaveBeenCalledWith("pho_1", "Lovely");
    expect(await screen.findByText("Lovely")).toBeInTheDocument();
    expect(screen.getByText("Awaiting moderation")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("once it is approved");
    expect(box).toHaveValue("");
  });

  it.each([
    [new CommentError("rejected"), "cannot include links"],
    [new RateLimitError(20), "Try again in 20 seconds"],
    [new Error("down"), "Could not reach the API"],
  ])("keeps the text and explains a refusal (%s)", async (failure, message) => {
    vi.mocked(postComment.execute).mockRejectedValue(failure);
    show(viewer());

    const box = await screen.findByRole("textbox", { name: "Comment" });
    await userEvent.type(box, "see www.spam");
    await userEvent.click(screen.getByRole("button", { name: "Post comment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(box).toHaveValue("see www.spam");
  });

  it("asks for a public name before offering the form", async () => {
    show(viewer(null));
    expect(await screen.findByRole("link", { name: "Choose a public name" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("lets the author delete their own comment", async () => {
    vi.mocked(getPhotoComments.execute).mockResolvedValue([comment({ mine: true })]);
    vi.mocked(deleteComment.execute).mockResolvedValue();
    show(viewer());

    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));

    expect(deleteComment.execute).toHaveBeenCalledWith("cmt_1");
    await waitFor(() => expect(screen.queryByText("What light")).not.toBeInTheDocument());
  });

  it("keeps a comment whose deletion failed and says why", async () => {
    vi.mocked(getPhotoComments.execute).mockResolvedValue([comment({ mine: true })]);
    vi.mocked(deleteComment.execute).mockRejectedValue(new CommentError("forbidden"));
    show(viewer());

    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("only delete your own");
    expect(screen.getByText("What light")).toBeInTheDocument();
  });
});
