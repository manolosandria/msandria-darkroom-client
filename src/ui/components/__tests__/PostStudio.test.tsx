import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Photo, PhotoVisibility } from "@/src/domain/entities/Photo";
import { Post, PostDraft } from "@/src/domain/entities/Post";
import { PostConflictError } from "@/src/domain/errors/PostConflictError";
import { useUnsavedEditor } from "../EditingWorkspace";
import PostStudio, {
  PostStudioPorts,
  postDraftOf,
  toLocalInput,
} from "../PostStudio";

const confirm = vi.fn(async () => true);
vi.mock("../EditingWorkspace", () => ({
  useEditingWorkspace: () => ({ confirm }),
  useUnsavedEditor: vi.fn(() => ({ review: vi.fn() })),
}));
vi.mock("../ClassificationCatalog", () => ({
  useClassificationCatalog: () => ({ catalog: {} }),
}));
// The picker has its own tests; here it offers each photo as a button.
vi.mock("../PhotoPicker", () => ({
  PhotoPicker: ({
    photos,
    onPick,
  }: {
    photos: Photo[];
    onPick: (photo: Photo) => void;
  }) => (
    <div>
      {photos.map((photo) => (
        <button key={photo.getId()} type="button" onClick={() => onPick(photo)}>
          {`Add ${photo.getTitle()}`}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("@/src/infrastructure/postServices", () => ({
  managePosts: {},
  browsePosts: {},
}));
vi.mock("@/src/infrastructure/photoServices", () => ({
  getManagedPhotos: {},
  uploadPhoto: {},
}));

const photo = (id: string, visibility: PhotoVisibility = "PUBLIC") =>
  new Photo({
    id,
    title: `Photo ${id}`,
    width: 1600,
    height: 1000,
    visibility,
    renditions: [{ width: 640, url: `https://img.example/${id}` }],
  });

const saved = (overrides: Partial<Post> = {}): Post => ({
  id: "post_1",
  version: 4,
  title: "A walk",
  status: "PUBLISHED",
  publishedAt: new Date("2026-11-01T18:00:00Z"),
  tags: ["trip"],
  likes: 0,
  liked: false,
  saved: false,
  blocks: [
    { kind: "TEXT", text: "Hello", style: "BODY" },
    { kind: "PHOTO", caption: null, photo: photo("g1"), hasDetail: true },
  ],
  ...overrides,
});

function setup(posts: Post[] = []) {
  const ports = {
    posts: {
      all: vi.fn(async () => posts),
      create: vi.fn(async (draft: PostDraft) =>
        saved({
          id: "new_1",
          version: 1,
          title: draft.title,
          status: draft.status,
          tags: draft.tags,
          publishedAt: draft.status === "PUBLISHED" ? new Date() : null,
          blocks: [],
        }),
      ),
      update: vi.fn(async () => saved({ version: 5, title: "Renamed" })),
      remove: vi.fn(async () => undefined),
    },
    photos: {
      execute: vi.fn(async () => [
        photo("g1"),
        photo("g2"),
        photo("private", "PRIVATE"),
        photo("only", "POSTS_ONLY"),
      ]),
    },
    upload: {
      execute: vi.fn(async ({ title }: { title: string }) => ({
        photo: photo(`up-${title}`, "POSTS_ONLY"),
        optimizationIssues: [],
      })),
    },
  };
  render(<PostStudio ports={ports as unknown as PostStudioPorts} />);
  return ports;
}

beforeEach(() => {
  vi.clearAllMocks();
  confirm.mockResolvedValue(true);
});

describe("PostStudio helpers", () => {
  it("writes a date for datetime-local and reads it back as ISO", () => {
    const date = new Date(2026, 10, 6, 9, 5);
    expect(toLocalInput(date)).toBe("2026-11-06T09:05");
    expect(toLocalInput(null)).toBe("");
    const draft = postDraftOf({
      title: "  A walk ",
      status: "DRAFT",
      publishedAt: "2026-11-06T09:05",
      tags: [],
      blocks: [{ key: "k", kind: "PHOTO", photoId: "p", caption: " Dusk " }],
    });
    expect(draft).toEqual({
      title: "A walk",
      status: "DRAFT",
      publishedAt: date.toISOString(),
      tags: [],
      blocks: [{ kind: "PHOTO", photoId: "p", caption: "Dusk" }],
    });
    expect(
      postDraftOf({ ...draftLike(), publishedAt: "not a date" }).publishedAt,
    ).toBeNull();
  });
});

const draftLike = () => ({
  title: "",
  status: "DRAFT" as const,
  publishedAt: "",
  tags: [],
  blocks: [],
});

describe("PostStudio", () => {
  it("finds posts by title or tag and combines search with the status filter", async () => {
    setup([
      saved(),
      saved({
        id: "draft",
        title: "Quiet morning",
        status: "DRAFT",
        tags: ["forest"],
        publishedAt: null,
      }),
    ]);
    await screen.findByRole("button", { name: /A walk/ });
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search posts" }),
      "FOREST",
    );
    expect(screen.queryByRole("button", { name: /A walk/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Quiet morning/ }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole("group", { name: "Filter posts" })).getByRole(
        "button",
        { name: /Published/ },
      ),
    );
    expect(screen.getByText(/No posts match/)).toBeInTheDocument();
    await userEvent.clear(screen.getByRole("searchbox"));
    expect(screen.getByRole("button", { name: /A walk/ })).toBeInTheDocument();
  });

  it("keeps the current post in place while a photo upload is pending", async () => {
    const ports = setup([saved()]);
    await userEvent.click(
      await screen.findByRole("button", { name: "New post" }),
    );
    let finish!: (
      value: Awaited<ReturnType<typeof ports.upload.execute>>,
    ) => void;
    ports.upload.execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await userEvent.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File(["x"], "forest.jpg", { type: "image/jpeg" }),
    );
    expect(screen.getByRole("button", { name: /A walk/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save post" })).toBeDisabled();
    finish({ photo: photo("forest", "POSTS_ONLY"), optimizationIssues: [] });
    expect(await screen.findByText("Photo forest")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview" })).toBeEnabled();
  });

  it("writes a new post with text, library photos and tags, and publishes it", async () => {
    const ports = setup();
    expect(await screen.findByText("No posts yet")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "New post" }));
    await userEvent.type(
      screen.getByPlaceholderText("A title for the post"),
      "A walk",
    );
    await userEvent.click(screen.getByRole("button", { name: /^Text/ }));
    await userEvent.type(
      screen.getByPlaceholderText(/Write here/),
      "First line",
    );
    await userEvent.type(
      screen.getByLabelText("Tags"),
      "#Trip, Black and white{Enter}",
    );
    expect(screen.getByText("#trip")).toBeInTheDocument();
    expect(screen.getByText("#black and white")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /^Photo from the library/ }),
    );
    // Private photos are not offered; posts-only ones are.
    expect(
      screen.queryByRole("button", { name: "Add Photo private" }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Add Photo only" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Add Photo g1" }));
    expect(
      screen.getByText("Posts only · opens no detail view"),
    ).toBeInTheDocument();

    // The gallery photo goes before the posts-only one.
    await userEvent.click(
      screen.getByRole("button", { name: "Move Photo g1 up" }),
    );
    await userEvent.click(screen.getByLabelText("Published"));
    await userEvent.click(screen.getByRole("button", { name: "Save post" }));

    expect(ports.posts.create).toHaveBeenCalledWith({
      title: "A walk",
      status: "PUBLISHED",
      publishedAt: null,
      tags: ["trip", "black and white"],
      blocks: [
        { kind: "TEXT", text: "First line", style: "BODY" },
        { kind: "PHOTO", photoId: "g1", caption: "" },
        { kind: "PHOTO", photoId: "only", caption: "" },
      ],
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Post published.",
    );
    expect(screen.getByRole("button", { name: /A walk/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }, 15000);

  it("will not publish without a title or blocks, but saves the draft", async () => {
    const ports = setup();
    await userEvent.click(
      await screen.findByRole("button", { name: "New post" }),
    );
    await userEvent.click(screen.getByLabelText("Published"));
    await userEvent.click(screen.getByRole("button", { name: "Save post" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Give the post a title",
    );
    expect(ports.posts.create).not.toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText("Draft"));
    await userEvent.click(screen.getByRole("button", { name: "Save post" }));
    expect(await screen.findByText("Draft saved.")).toBeInTheDocument();
  });

  it("refuses a malformed tag and too many", async () => {
    setup();
    await userEvent.click(
      await screen.findByRole("button", { name: "New post" }),
    );
    await userEvent.type(screen.getByLabelText("Tags"), "!!{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("is not a tag");
    const tags = screen.getByLabelText("Tags");
    fireEvent.change(tags, {
      target: {
        value: Array.from({ length: 21 }, (_, i) => `t${i}`).join(",") + ",",
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("up to 20 tags");
    fireEvent.change(tags, { target: { value: "one," } });
    await userEvent.type(tags, "two");
    fireEvent.blur(tags);
    expect(screen.getByText("#two")).toBeInTheDocument();
    await userEvent.type(tags, "{Backspace}");
    expect(screen.queryByText("#two")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove tag one" }),
    );
    expect(screen.queryByText("#one")).toBeNull();
  });

  it("edits a saved post with its version and keeps edits on a conflict", async () => {
    const ports = setup([saved()]);
    await userEvent.click(
      await screen.findByRole("button", { name: /A walk/ }),
    );
    expect(
      screen.getByRole("textbox", { name: "Text of block 1" }),
    ).toHaveValue("Hello");
    expect(vi.mocked(useUnsavedEditor)).toHaveBeenLastCalledWith(
      false,
      expect.anything(),
    );

    const title = screen.getByPlaceholderText("A title for the post");
    await userEvent.clear(title);
    await userEvent.type(title, "Renamed");
    expect(vi.mocked(useUnsavedEditor)).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ label: "Post “Renamed”" }),
    );
    ports.posts.update.mockRejectedValueOnce(new PostConflictError());
    await userEvent.click(screen.getByRole("button", { name: "Save post" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "changed while you were editing",
    );
    expect(title).toHaveValue("Renamed");
    await userEvent.click(screen.getByRole("button", { name: "Reload posts" }));
    await waitFor(() => expect(ports.posts.all).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByRole("button", { name: "Save post" }));
    expect(ports.posts.update).toHaveBeenLastCalledWith(
      "post_1",
      expect.objectContaining({ title: "Renamed", tags: ["trip"] }),
      4,
    );
    expect(await screen.findByText("Post published.")).toBeInTheDocument();
  });

  it("asks before leaving unsaved changes and before deleting", async () => {
    const ports = setup([
      saved(),
      saved({
        id: "post_2",
        title: "Second",
        status: "DRAFT",
        publishedAt: null,
      }),
    ]);
    await userEvent.click(
      await screen.findByRole("button", { name: /A walk/ }),
    );
    await userEvent.type(
      screen.getByPlaceholderText("A title for the post"),
      "!",
    );
    confirm.mockResolvedValueOnce(false);
    await userEvent.click(screen.getByRole("button", { name: /Second/ }));
    expect(screen.getByPlaceholderText("A title for the post")).toHaveValue(
      "A walk!",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Cancel changes" }),
    );
    expect(screen.getByPlaceholderText("A title for the post")).toHaveValue(
      "A walk",
    );

    await userEvent.click(screen.getByRole("button", { name: /Second/ }));
    confirm.mockResolvedValueOnce(false);
    await userEvent.click(screen.getByRole("button", { name: "Delete post" }));
    expect(ports.posts.remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Delete post" }));
    expect(ports.posts.remove).toHaveBeenCalledWith("post_2");
    expect(await screen.findByText("Post deleted.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Second/ })).toBeNull();
  });

  it("uploads photos for posts only or for the gallery too", async () => {
    const ports = setup();
    await userEvent.click(
      await screen.findByRole("button", { name: "New post" }),
    );
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File(["x"], "my_trip-1.jpg", { type: "image/jpeg" }),
    );
    await waitFor(() =>
      expect(ports.upload.execute).toHaveBeenCalledWith({
        file: expect.any(File),
        title: "my trip 1",
        visibility: "POSTS_ONLY",
      }),
    );
    expect(await screen.findByText("Photo up-my trip 1")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/To the gallery too/));
    ports.upload.execute.mockRejectedValueOnce(new Error("offline"));
    await userEvent.upload(
      input,
      new File(["x"], "b.jpg", { type: "image/jpeg" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("b.jpg");
    expect(ports.upload.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ visibility: "PUBLIC" }),
    );
  });

  it("does not upload files that cannot fit in the remaining block slots", async () => {
    const ports = setup([
      saved({
        blocks: Array.from({ length: 59 }, () => ({
          kind: "TEXT" as const,
          text: "A note",
          style: "BODY" as const,
        })),
      }),
    ]);
    await userEvent.click(
      await screen.findByRole("button", { name: /A walk/ }),
    );
    await userEvent.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      [
        new File(["x"], "first.jpg", { type: "image/jpeg" }),
        new File(["x"], "second.jpg", { type: "image/jpeg" }),
      ],
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only 1 more photo fits in this post. Extra files were not uploaded.",
    );
    expect(ports.upload.execute).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: /^Text/ }),
    ).toBeDisabled();
  }, 15000);

  it("reorders, restyles, captions and removes blocks, and previews the post", async () => {
    setup([saved()]);
    await userEvent.click(
      await screen.findByRole("button", { name: /A walk/ }),
    );
    await userEvent.type(screen.getByLabelText("Caption of Photo g1"), "Dusk");
    await userEvent.click(
      screen.getByRole("button", { name: "Move Photo g1 up" }),
    );
    const blocks = screen.getByRole("list", { name: "Post blocks" });
    expect(
      within(blocks)
        .getAllByRole("button", { name: /position/ })
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Move Photo g1, position 1 of 2",
      "Move Text block, position 2 of 2",
    ]);
    await userEvent.click(
      screen.getByRole("button", { name: "Move Text block down" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    await userEvent.click(screen.getByRole("button", { name: "Phone" }));
    expect(document.querySelector(".post-studio__preview")).toHaveAttribute(
      "data-device",
      "phone",
    );
    await userEvent.click(screen.getByRole("button", { name: "Desktop" }));
    expect(document.querySelector(".post-studio__preview")).toHaveAttribute(
      "data-device",
      "desktop",
    );
    expect(screen.getByRole("heading", { name: "A walk" })).toBeInTheDocument();
    expect(screen.getByText("Dusk")).toBeInTheDocument();
    expect(screen.getByText("#trip")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    await userEvent.click(
      screen.getByRole("button", { name: "Remove Photo g1" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remove Text block" }),
    );
    expect(screen.getByText(/The post is empty/)).toBeInTheDocument();
  });

  it("explains a list that cannot load and retries", async () => {
    const ports = {
      posts: {
        all: vi
          .fn()
          .mockRejectedValue(new Error("Sign in as the administrator")),
      },
      photos: { execute: vi.fn().mockRejectedValue(new Error("down")) },
      upload: { execute: vi.fn() },
    };
    render(<PostStudio ports={ports as unknown as PostStudioPorts} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("administrator");
    ports.posts.all.mockResolvedValueOnce([]);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No posts yet")).toBeInTheDocument();
  });
});
