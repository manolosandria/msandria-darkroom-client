import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Photo } from "@/src/domain/entities/Photo";
import { Post, PostPage } from "@/src/domain/entities/Post";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { useSessionValue } from "../SessionProvider";
import HomePosts, { postsHref } from "../HomePosts";
import PostView from "../PostView";
import { SavedPosts } from "../SavedPosts";

const search = { current: new URLSearchParams() };
vi.mock("next/navigation", () => ({
  useSearchParams: () => search.current,
}));
vi.mock("../SessionProvider", () => ({ useSessionValue: vi.fn() }));
vi.mock("@/src/infrastructure/postServices", () => ({ browsePosts: {} }));

const photo = (id: string) =>
  new Photo({
    id,
    title: `Photo ${id}`,
    width: 1600,
    height: 1000,
    renditions: [{ width: 640, url: `https://img.example/${id}` }],
  });

const post = (overrides: Partial<Post> = {}): Post => ({
  id: "post_1",
  version: 1,
  title: "A walk",
  status: "PUBLISHED",
  publishedAt: new Date("2026-11-01T18:00:00Z"),
  tags: ["trip"],
  likes: 2,
  liked: false,
  saved: false,
  blocks: [
    { kind: "TEXT", text: "Morning.\n\nEvening.", style: "BODY" },
    { kind: "TEXT", text: "On the road", style: "HEADING" },
    { kind: "TEXT", text: "Go slow", style: "QUOTE" },
    { kind: "PHOTO", caption: "From the gallery", photo: photo("g1"), hasDetail: true },
    { kind: "PHOTO", caption: null, photo: photo("o1"), hasDetail: false },
  ],
  ...overrides,
});

const page = (overrides: Partial<PostPage> = {}): PostPage => ({
  page: 1,
  limit: 5,
  total: 1,
  tag: null,
  posts: [post()],
  ...overrides,
});

const signedIn = (yes: boolean) =>
  vi.mocked(useSessionValue).mockReturnValue({
    user: yes ? { getId: () => "u1" } : null,
  } as unknown as ReturnType<typeof useSessionValue>);

beforeEach(() => {
  search.current = new URLSearchParams();
  signedIn(true);
});

describe("HomePosts", () => {
  it("keeps page and tag in Home's address", () => {
    expect(postsHref(1, null)).toBe("/#posts");
    expect(postsHref(3, "black and white")).toBe(
      "/?tag=black+and+white&page=3#posts",
    );
  });

  it("shows each post with its blocks; only gallery photos link to their detail", async () => {
    const ports = { page: vi.fn(async () => page()), react: vi.fn() };
    render(<HomePosts ports={ports} />);

    expect(await screen.findByRole("link", { name: "A walk" })).toHaveAttribute(
      "href",
      "/post/post_1",
    );
    expect(ports.page).toHaveBeenCalledWith({ page: 1, limit: 5, tag: undefined });
    expect(screen.getByText("Morning.")).toBeInTheDocument();
    expect(screen.getByText("Evening.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "On the road" })).toBeInTheDocument();
    expect(screen.getByText("Go slow").closest("blockquote")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Open Photo g1" })).toHaveAttribute(
      "href",
      "/photo/g1",
    );
    expect(screen.queryByRole("link", { name: "Open Photo o1" })).toBeNull();
    expect(screen.getByAltText("Photo o1")).toBeInTheDocument();
    expect(screen.getByText("From the gallery")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#trip" })).toHaveAttribute(
      "href",
      "/?tag=trip#posts",
    );
    expect(screen.queryByRole("navigation", { name: "Post pages" })).toBeNull();
  });

  it("filters by the tag in the address and pages through", async () => {
    search.current = new URLSearchParams("tag=%23Trip&page=2");
    const ports = {
      page: vi.fn(async () => page({ page: 2, total: 11, tag: "trip" })),
      react: vi.fn(),
    };
    render(<HomePosts ports={ports} />);

    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(ports.page).toHaveBeenCalledWith({ page: 2, limit: 5, tag: "trip" });
    expect(screen.getByText("#trip", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Newer" })).toHaveAttribute(
      "href",
      "/?tag=trip#posts",
    );
    expect(screen.getByRole("link", { name: "Older →" })).toHaveAttribute(
      "href",
      "/?tag=trip&page=3#posts",
    );
    expect(screen.getByRole("link", { name: "Show all" })).toHaveAttribute(
      "href",
      "/#posts",
    );
  });

  it("shows nothing while there are no posts at all", async () => {
    const ports = { page: vi.fn(async () => page({ total: 0, posts: [] })), react: vi.fn() };
    const { container } = render(<HomePosts ports={ports} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("says so when a tag or a page has nothing", async () => {
    search.current = new URLSearchParams("tag=none");
    const ports = {
      page: vi.fn(async () => page({ total: 0, posts: [], tag: "none" })),
      react: vi.fn(),
    };
    render(<HomePosts ports={ports} />);
    expect(await screen.findByText("No posts carry this tag.")).toBeInTheDocument();
  });

  it("explains a failure, a rate limit included", async () => {
    const ports = { page: vi.fn().mockRejectedValue(new Error("down")), react: vi.fn() };
    const { unmount } = render(<HomePosts ports={ports} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Posts could not be loaded",
    );
    unmount();
    ports.page.mockRejectedValue(new RateLimitError(30));
    render(<HomePosts ports={ports} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/30 seconds|wait/i);
  });

  it("likes and saves a post, and asks to sign in otherwise", async () => {
    const ports = {
      page: vi.fn(async () => page()),
      react: vi
        .fn()
        .mockResolvedValueOnce({ likes: 3, liked: true, saved: false })
        .mockRejectedValueOnce(new Error("down")),
    };
    render(<HomePosts ports={ports} />);

    await userEvent.click(await screen.findByRole("button", { name: /Like/ }));
    expect(ports.react).toHaveBeenCalledWith("post_1", "like", true);
    expect(await screen.findByLabelText("3 likes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Save/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("did not go through");
  });

  it("disables reactions signed out", async () => {
    signedIn(false);
    render(<HomePosts ports={{ page: vi.fn(async () => page()), react: vi.fn() }} />);
    expect(await screen.findByRole("button", { name: /Like/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Save/ })).toHaveAttribute(
      "title",
      "Sign in to save posts",
    );
  });
});

describe("PostView", () => {
  it("shows a post at its own address with its title as the page heading", async () => {
    const ports = { findById: vi.fn(async () => post()), react: vi.fn() };
    render(<PostView postId="post_1" ports={ports} />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "A walk" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "A walk" })).toBeNull();
  });

  it("marks drafts and scheduled posts for the administrator", async () => {
    const ports = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(post({ status: "DRAFT", publishedAt: null, title: "" })),
      react: vi.fn(),
    };
    render(<PostView postId="post_1" ports={ports} />);
    expect(await screen.findByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Untitled post" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Like/ })).toBeNull();
  });

  it("says when the post does not exist or cannot load", async () => {
    const ports = { findById: vi.fn(async () => null), react: vi.fn() };
    const { unmount } = render(<PostView postId="x" ports={ports} />);
    expect(await screen.findByText("This post does not exist.")).toBeInTheDocument();
    unmount();
    ports.findById.mockRejectedValue(new Error("down"));
    render(<PostView postId="x" ports={ports} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
  });
});

describe("SavedPosts", () => {
  it("lists the saved posts and pages through them", async () => {
    const ports = {
      saved: vi.fn(async (page = 1) => ({
        page,
        limit: 20,
        total: 25,
        tag: null,
        posts: [post({ id: `p${page}`, title: `Saved ${page}` })],
      })),
    };
    render(<SavedPosts ports={ports} />);
    expect(await screen.findByRole("link", { name: "Saved 1" })).toHaveAttribute(
      "href",
      "/post/p1",
    );
    await userEvent.click(screen.getByRole("button", { name: "Older" }));
    expect(await screen.findByRole("link", { name: "Saved 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Older" })).toBeDisabled();
  });

  it("explains an empty list and a failure", async () => {
    const ports = {
      saved: vi.fn(async () => ({ page: 1, limit: 20, total: 0, tag: null, posts: [] })),
    };
    const { unmount } = render(<SavedPosts ports={ports} />);
    expect(await screen.findByText(/Only you can see this list/)).toBeInTheDocument();
    unmount();
    ports.saved.mockRejectedValue(new Error("down"));
    render(<SavedPosts ports={ports} />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
