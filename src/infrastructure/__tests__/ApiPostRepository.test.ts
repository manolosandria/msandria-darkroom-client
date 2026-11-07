import { describe, expect, it, vi } from "vitest";
import { PostConflictError } from "@/src/domain/errors/PostConflictError";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { ApiPostRepository } from "../ApiPostRepository";

const apiPost = {
  id: "post_1",
  version: 2,
  title: "A walk",
  status: "PUBLISHED",
  publishedAt: "2026-11-01T12:00:00.000Z",
  tags: ["trip"],
  likes: 3,
  liked: true,
  saved: false,
  blocks: [
    { kind: "TEXT", text: "Hello", style: "BODY" },
    {
      kind: "PHOTO",
      caption: "Dusk",
      photo: {
        id: "p1",
        title: "Sunset",
        width: 1600,
        height: 1000,
        createdAt: "2026-10-01T00:00:00.000Z",
        renditions: [{ width: 640, url: "/photos/p1/renditions/640" }],
        frame: { color: "#fff", leftRight: 0, topBottom: 0 },
        hasDetail: false,
      },
    },
  ],
};

const draft = {
  title: "A walk",
  status: "DRAFT" as const,
  publishedAt: null,
  tags: [],
  blocks: [],
};

const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers }));

describe("ApiPostRepository", () => {
  it("reads a page with its query and the session, and builds the photos", async () => {
    const fetchFn = vi.fn(() =>
      json({ page: 2, limit: 5, total: 6, tag: "trip", posts: [apiPost] }),
    );
    const repository = new ApiPostRepository("https://api.example/", fetchFn);

    const page = await repository.list({ page: 2, limit: 5, tag: "trip" });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.example/posts?page=2&limit=5&tag=trip",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    const [post] = page.posts;
    expect(post.publishedAt).toEqual(new Date("2026-11-01T12:00:00.000Z"));
    const block = post.blocks[1];
    expect(block.kind).toBe("PHOTO");
    if (block.kind !== "PHOTO") return;
    expect(block.hasDetail).toBe(false);
    expect(block.caption).toBe("Dusk");
    // A frame without thickness is no frame; an API path becomes a full URL.
    expect(block.photo.getFrame()).toBeNull();
    expect(block.photo.getRenditions()[0].url).toBe(
      "https://api.example/photos/p1/renditions/640",
    );
  });

  it("leaves out a photo with nothing to deliver", async () => {
    const photoBlock = apiPost.blocks[1] as { photo: object };
    const fetchFn = vi.fn(() =>
      json({
        ...apiPost,
        blocks: [
          apiPost.blocks[0],
          { ...photoBlock, photo: { ...photoBlock.photo, renditions: [] } },
        ],
      }),
    );
    const post = await new ApiPostRepository("https://api.example", fetchFn).findById(
      "post_1",
    );
    expect(post?.blocks.map((block) => block.kind)).toEqual(["TEXT"]);
  });

  it("asks for the first page without a query", async () => {
    const fetchFn = vi.fn(() =>
      json({ page: 1, limit: 5, total: 0, tag: null, posts: [] }),
    );
    await new ApiPostRepository("https://api.example", fetchFn).list({});
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.example/posts",
      expect.anything(),
    );
  });

  it("answers null for a post the visitor cannot see", async () => {
    const fetchFn = vi
      .fn()
      .mockImplementationOnce(() => json({ message: "Not found" }, 404))
      .mockImplementationOnce(() => json({ ...apiPost, publishedAt: null }));
    const repository = new ApiPostRepository("https://api.example", fetchFn);

    expect(await repository.findById("a/b")).toBeNull();
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.example/posts/a%2Fb",
      expect.anything(),
    );
    expect((await repository.findById("post_1"))?.publishedAt).toBeNull();
  });

  it("likes, unsaves and lists the saved posts", async () => {
    const fetchFn = vi
      .fn()
      .mockImplementationOnce(() => json({ likes: 1, liked: true, saved: false }))
      .mockImplementationOnce(() => json({ likes: 1, liked: true, saved: false }))
      .mockImplementationOnce(() =>
        json({ page: 1, limit: 20, total: 1, tag: null, posts: [apiPost] }),
      )
      .mockImplementationOnce(() =>
        json({ page: 3, limit: 20, total: 1, tag: null, posts: [] }),
      );
    const repository = new ApiPostRepository("https://api.example", fetchFn);

    expect(await repository.react("post_1", "like", true)).toEqual({
      likes: 1,
      liked: true,
      saved: false,
    });
    await repository.react("post_1", "save", false);
    expect((await repository.saved()).posts).toHaveLength(1);
    await repository.saved(3);

    expect(fetchFn.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ["https://api.example/posts/post_1/like", "PUT"],
      ["https://api.example/posts/post_1/save", "DELETE"],
      ["https://api.example/auth/me/saved-posts?page=1", "GET"],
      ["https://api.example/auth/me/saved-posts?page=3", "GET"],
    ]);
  });

  it("manages posts with JSON bodies and the version", async () => {
    const fetchFn = vi
      .fn()
      .mockImplementationOnce(() => json([apiPost]))
      .mockImplementationOnce(() => json(apiPost, 201))
      .mockImplementationOnce(() => json(apiPost))
      .mockImplementationOnce(() => json({ deleted: true }));
    const repository = new ApiPostRepository("https://api.example", fetchFn);

    expect(await repository.manage()).toHaveLength(1);
    await repository.create(draft);
    await repository.update("post_1", draft, 2);
    await repository.remove("post_1");

    expect(fetchFn).toHaveBeenNthCalledWith(
      3,
      "https://api.example/posts/post_1",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, version: 2 }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      4,
      "https://api.example/posts/post_1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("translates refusals", async () => {
    const repository = (response: () => Promise<Response>) =>
      new ApiPostRepository("https://api.example", vi.fn(response));

    await expect(
      repository(() => json({}, 409)).update("p", draft, 1),
    ).rejects.toBeInstanceOf(PostConflictError);
    await expect(
      repository(() => json({}, 429, { "Retry-After": "30" })).react("p", "like", true),
    ).rejects.toBeInstanceOf(RateLimitError);
    await expect(
      repository(() =>
        json({ message: "A published post cannot show private photos" }, 400),
      ).create(draft),
    ).rejects.toThrow("A published post cannot show private photos");
    await expect(
      repository(() => json({ message: ["title must be shorter", "bad"] }, 400)).create(
        draft,
      ),
    ).rejects.toThrow("title must be shorter. bad");
    await expect(
      repository(() => Promise.resolve(new Response("oops", { status: 400 }))).create(
        draft,
      ),
    ).rejects.toThrow("The post was refused");
    await expect(repository(() => json({}, 401)).saved()).rejects.toThrow(
      "Sign in to continue.",
    );
    await expect(repository(() => json({}, 403)).manage()).rejects.toThrow(
      "administrator",
    );
    await expect(repository(() => json({}, 404)).remove("p")).rejects.toThrow(
      "no longer exists",
    );
    await expect(repository(() => json({}, 500)).manage()).rejects.toThrow(
      "could not be completed",
    );
  });

  it("refuses to run without an API address", async () => {
    await expect(new ApiPostRepository(undefined).list({})).rejects.toThrow(
      "NEXT_PUBLIC_API_URL",
    );
  });
});
