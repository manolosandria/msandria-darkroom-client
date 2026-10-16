import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { clearCommentDrafts } from "@/src/ui/commentDrafts";
import { SessionProvider } from "../SessionProvider";
import { COMMENT_PROMPTS, PhotoComments, SEND_DELAY_MS } from "../PhotoComments";

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
  clearCommentDrafts();
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

  it("shows nothing but the invitation when there are no comments yet", async () => {
    show(null);
    expect(await screen.findByText("Sign in to leave a comment.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("offers to retry when the comments cannot load", async () => {
    vi.mocked(getPhotoComments.execute).mockRejectedValueOnce(new Error("down"));
    vi.mocked(getPhotoComments.execute).mockResolvedValueOnce([comment()]);
    show(null);

    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByText("What light")).toBeInTheDocument();
    expect(getPhotoComments.execute).toHaveBeenCalledTimes(2);
  });

  describe("writing", () => {
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      vi.mocked(postComment.execute).mockResolvedValue(
        comment({ id: "cmt_2", authorName: "Ana G.", body: "Lovely", status: "PENDING", mine: true }),
      );
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const wait = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

    it("sends on Enter after a moment, shows it pending and explains moderation", async () => {
      show(viewer());

      const box = await screen.findByRole("textbox", { name: "Comment" });
      expect(screen.getByText("Ana G.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Post comment" })).toBeDisabled();
      await user.type(box, "Lovely{Enter}");

      expect(box).toHaveValue("");
      expect(screen.getByText("Sending…")).toBeInTheDocument();
      expect(screen.getByText(/moderator will review it/)).toBeInTheDocument();
      expect(postComment.execute).not.toHaveBeenCalled();
      await wait(SEND_DELAY_MS);

      expect(postComment.execute).toHaveBeenCalledWith("pho_1", "Lovely");
      expect(await screen.findByText("Awaiting moderation")).toBeInTheDocument();
      expect(screen.getByText("Lovely")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("once it is approved");
    });

    it("sends with the arrow button too", async () => {
      show(viewer());

      await user.type(await screen.findByRole("textbox", { name: "Comment" }), "Lovely");
      await user.click(screen.getByRole("button", { name: "Post comment" }));
      await wait(SEND_DELAY_MS);

      expect(postComment.execute).toHaveBeenCalledWith("pho_1", "Lovely");
    });

    it("sends at once when the visitor confirms", async () => {
      show(viewer());

      await user.type(await screen.findByRole("textbox", { name: "Comment" }), "Lovely{Enter}");
      await user.click(screen.getByRole("button", { name: "Send now" }));

      expect(postComment.execute).toHaveBeenCalledWith("pho_1", "Lovely");
      expect(await screen.findByText("Awaiting moderation")).toBeInTheDocument();
      await wait(SEND_DELAY_MS);
      expect(postComment.execute).toHaveBeenCalledTimes(1);
    });

    it("keeps an unsent draft for the photo when the panel comes back", async () => {
      show(viewer());
      await user.type(await screen.findByRole("textbox", { name: "Comment" }), "Half a thought");
      cleanup();

      show(viewer());

      expect(await screen.findByRole("textbox", { name: "Comment" })).toHaveValue("Half a thought");
      expect(postComment.execute).not.toHaveBeenCalled();
    });

    it("breaks the line on Shift+Enter instead of sending", async () => {
      show(viewer());

      const box = await screen.findByRole("textbox", { name: "Comment" });
      await user.type(box, "Soft{Shift>}{Enter}{/Shift}light");

      expect(box).toHaveValue("Soft\nlight");
      expect(screen.queryByText("Sending…")).not.toBeInTheDocument();
    });

    it("gives the text back to correct it before it is sent", async () => {
      show(viewer());

      const box = await screen.findByRole("textbox", { name: "Comment" });
      await user.type(box, "Lovley{Enter}");
      await user.click(screen.getByRole("button", { name: "Edit" }));
      await wait(SEND_DELAY_MS);

      expect(box).toHaveValue("Lovley");
      expect(postComment.execute).not.toHaveBeenCalled();
    });

    it("cancels a comment before it is sent", async () => {
      show(viewer());

      const box = await screen.findByRole("textbox", { name: "Comment" });
      await user.type(box, "Never mind{Enter}");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await wait(SEND_DELAY_MS);

      expect(box).toHaveValue("");
      expect(screen.queryByText("Never mind")).not.toBeInTheDocument();
      expect(postComment.execute).not.toHaveBeenCalled();
    });

    it("still sends a comment waiting to go when the panel closes", async () => {
      show(viewer());

      await user.type(await screen.findByRole("textbox", { name: "Comment" }), "Lovely{Enter}");
      cleanup();

      expect(postComment.execute).toHaveBeenCalledWith("pho_1", "Lovely");
    });

    it.each([
      [new CommentError("rejected"), "cannot include links"],
      [new RateLimitError(20), "Try again in 20 seconds"],
      [new Error("down"), "Could not reach the API"],
    ])("keeps the text and explains a refusal (%s)", async (failure, message) => {
      vi.mocked(postComment.execute).mockRejectedValue(failure);
      show(viewer());

      const box = await screen.findByRole("textbox", { name: "Comment" });
      await user.type(box, "see www.spam{Enter}");
      await wait(SEND_DELAY_MS);

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(box).toHaveValue("see www.spam");
    });

    it("rotates its invitation while the box is empty", async () => {
      show(viewer());

      const box = await screen.findByRole("textbox", { name: "Comment" });
      expect(box).toHaveAttribute("placeholder", COMMENT_PROMPTS[0]);
      await wait(4000);
      expect(box).toHaveAttribute("placeholder", COMMENT_PROMPTS[1]);
    });

    it("counts characters only when the limit is near", async () => {
      show(viewer());

      const box = await screen.findByRole("textbox", { name: "Comment" });
      fireEvent.change(box, { target: { value: "a".repeat(10) } });
      expect(screen.queryByText("10/1000")).not.toBeInTheDocument();
      fireEvent.change(box, { target: { value: "a".repeat(900) } });
      expect(screen.getByText("900/1000")).toBeInTheDocument();
    });
  });

  it("links the pencil to the account to change the public name", async () => {
    show(viewer());
    expect(await screen.findByRole("link", { name: "Change public name" })).toHaveAttribute(
      "href",
      "/account",
    );
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

  it("offers to cancel an own comment still awaiting moderation", async () => {
    vi.mocked(getPhotoComments.execute).mockResolvedValue([
      comment({ mine: true, status: "PENDING" }),
    ]);
    vi.mocked(deleteComment.execute).mockResolvedValue();
    show(viewer());

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

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
