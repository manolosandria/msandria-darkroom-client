import { describe, expect, it, vi } from "vitest";
import { ApiCommentRepository } from "../ApiCommentRepository";

const API_URL = "http://api.test/";

function respondWith(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return vi.fn().mockResolvedValue(
    new Response(status === 204 || body === null ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    }),
  );
}

const apiComment = (overrides: Record<string, unknown> = {}) => ({
  id: "cmt_1",
  authorName: "Ana G.",
  body: "What light",
  status: "APPROVED",
  createdAt: "2026-10-17T12:00:00.000Z",
  mine: false,
  ...overrides,
});

describe("ApiCommentRepository", () => {
  it("lists a photo's comments with credentials and maps them", async () => {
    const fetchFn = respondWith([apiComment({ status: "PENDING", mine: true, authorName: null })]);
    const [comment] = await new ApiCommentRepository(API_URL, fetchFn).listForPhoto("pho 1");

    expect(fetchFn).toHaveBeenCalledWith("http://api.test/photos/pho%201/comments", {
      method: "GET",
      credentials: "include",
    });
    expect(comment.getId()).toBe("cmt_1");
    expect(comment.getAuthorName()).toBeNull();
    expect(comment.getBody()).toBe("What light");
    expect(comment.getCreatedAt()).toEqual(new Date("2026-10-17T12:00:00.000Z"));
    expect(comment.isPending()).toBe(true);
    expect(comment.isMine()).toBe(true);
  });

  it("posts only the body", async () => {
    const fetchFn = respondWith(apiComment({ status: "PENDING", mine: true }), 201);
    const comment = await new ApiCommentRepository(API_URL, fetchFn).create("pho_1", "What light");

    expect(fetchFn).toHaveBeenCalledWith("http://api.test/photos/pho_1/comments", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "What light" }),
    });
    expect(comment.isPending()).toBe(true);
  });

  it("loads the moderation queue with dates", async () => {
    const fetchFn = respondWith([
      {
        id: "cmt_1",
        photo: { id: "pho_1", title: "Virgencita" },
        authorName: "Ana G.",
        body: "What light",
        createdAt: "2026-10-17T12:00:00.000Z",
      },
    ]);
    const [pending] = await new ApiCommentRepository(API_URL, fetchFn).pending();

    expect(fetchFn).toHaveBeenCalledWith("http://api.test/comments/pending", {
      method: "GET",
      credentials: "include",
    });
    expect(pending.createdAt).toEqual(new Date("2026-10-17T12:00:00.000Z"));
    expect(pending.photo.title).toBe("Virgencita");
  });

  it("approves and deletes by id", async () => {
    const approveFetch = respondWith(apiComment());
    await new ApiCommentRepository(API_URL, approveFetch).approve("cmt_1");
    expect(approveFetch).toHaveBeenCalledWith("http://api.test/comments/cmt_1/approve", {
      method: "POST",
      credentials: "include",
    });

    const deleteFetch = respondWith(null, 204);
    await new ApiCommentRepository(API_URL, deleteFetch).remove("cmt_1");
    expect(deleteFetch).toHaveBeenCalledWith("http://api.test/comments/cmt_1", {
      method: "DELETE",
      credentials: "include",
    });
  });

  it.each([
    [400, "rejected"],
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "notFound"],
  ])("turns %i into a %s refusal", async (status, failure) => {
    const fetchFn = respondWith({}, status);
    await expect(
      new ApiCommentRepository(API_URL, fetchFn).create("pho_1", "x"),
    ).rejects.toMatchObject({ name: "CommentError", failure });
  });

  it("recognises a missing public name", async () => {
    const fetchFn = respondWith({ code: "PUBLIC_NAME_REQUIRED" }, 409);
    await expect(
      new ApiCommentRepository(API_URL, fetchFn).create("pho_1", "x"),
    ).rejects.toMatchObject({ failure: "publicNameRequired" });
  });

  it("reports other conflicts and failures as plain errors", async () => {
    await expect(
      new ApiCommentRepository(API_URL, respondWith({ code: "OTHER" }, 409)).create("p", "x"),
    ).rejects.toThrow("The API answered 409");
    await expect(
      new ApiCommentRepository(
        API_URL,
        vi.fn().mockResolvedValue(new Response("not json", { status: 409 })),
      ).create("p", "x"),
    ).rejects.toThrow("The API answered 409");
    await expect(
      new ApiCommentRepository(API_URL, respondWith({}, 500)).listForPhoto("p"),
    ).rejects.toThrow("The API answered 500");
  });

  it("reports throttling with its wait, without retrying", async () => {
    const fetchFn = respondWith({}, 429, { "Retry-After": "30" });
    await expect(
      new ApiCommentRepository(API_URL, fetchFn).create("pho_1", "x"),
    ).rejects.toMatchObject({ name: "RateLimitError", retryAfterSeconds: 30 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("refuses to run without an API URL", async () => {
    await expect(new ApiCommentRepository(undefined, vi.fn()).listForPhoto("p")).rejects.toThrow(
      "NEXT_PUBLIC_API_URL is not set",
    );
  });
});
