import { Photo, PhotoRendition } from "../domain/entities/Photo";
import { PhotoFrame } from "../domain/entities/PhotoFrame";
import { PhotoHighlights } from "../domain/entities/PhotoHighlights";
import {
  Post,
  PostBlock,
  PostDraft,
  PostPage,
  PostReaction,
  PostReactions,
  PostStatus,
  PostTextStyle,
} from "../domain/entities/Post";
import { PostConflictError } from "../domain/errors/PostConflictError";
import {
  PostPageQuery,
  PostRepository,
} from "../domain/repositories/PostRepository";
import { rateLimitError } from "./rateLimitError";

type ApiPostPhoto = {
  id: string;
  title: string;
  width: number;
  height: number;
  createdAt: string;
  renditions: PhotoRendition[];
  highlights?: PhotoHighlights;
  frame?: PhotoFrame | null;
  hasDetail: boolean;
};

type ApiPostBlock =
  | { kind: "TEXT"; text: string; style: PostTextStyle }
  | { kind: "PHOTO"; caption: string | null; photo: ApiPostPhoto };

type ApiPost = {
  id: string;
  version: number;
  title: string;
  status: PostStatus;
  publishedAt: string | null;
  tags: string[];
  likes: number;
  liked: boolean;
  saved: boolean;
  blocks: ApiPostBlock[];
};

type ApiPostPage = Omit<PostPage, "posts"> & { posts: ApiPost[] };

export class ApiPostRepository implements PostRepository {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  async list(query: PostPageQuery): Promise<PostPage> {
    const search = new URLSearchParams();
    if (query.page) search.set("page", String(query.page));
    if (query.limit) search.set("limit", String(query.limit));
    if (query.tag) search.set("tag", query.tag);
    const suffix = search.size ? `?${search}` : "";
    return this.toPage(await (await this.request("GET", `/posts${suffix}`)).json());
  }

  async findById(id: string): Promise<Post | null> {
    const response = await this.request(
      "GET",
      `/posts/${encodeURIComponent(id)}`,
      undefined,
      [404],
    );
    if (response.status === 404) return null;
    return this.toPost(await response.json());
  }

  async react(
    id: string,
    kind: PostReaction,
    on: boolean,
  ): Promise<PostReactions> {
    const response = await this.request(
      on ? "PUT" : "DELETE",
      `/posts/${encodeURIComponent(id)}/${kind}`,
    );
    return response.json();
  }

  async saved(page = 1): Promise<PostPage> {
    return this.toPage(
      await (await this.request("GET", `/auth/me/saved-posts?page=${page}`)).json(),
    );
  }

  async manage(): Promise<Post[]> {
    const posts: ApiPost[] = await (
      await this.request("GET", "/posts/manage")
    ).json();
    return posts.map((post) => this.toPost(post));
  }

  async create(draft: PostDraft): Promise<Post> {
    return this.toPost(await (await this.request("POST", "/posts", draft)).json());
  }

  async update(id: string, draft: PostDraft, version: number): Promise<Post> {
    return this.toPost(
      await (
        await this.request("PATCH", `/posts/${encodeURIComponent(id)}`, {
          ...draft,
          version,
        })
      ).json(),
    );
  }

  async remove(id: string): Promise<void> {
    await this.request("DELETE", `/posts/${encodeURIComponent(id)}`);
  }

  private toPage(page: ApiPostPage): PostPage {
    return { ...page, posts: page.posts.map((post) => this.toPost(post)) };
  }

  private toPost(post: ApiPost): Post {
    return {
      id: post.id,
      version: post.version,
      title: post.title,
      status: post.status,
      publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
      tags: post.tags,
      likes: post.likes,
      liked: post.liked,
      saved: post.saved,
      // A photo with nothing to deliver (its file is still moving) cannot be shown.
      blocks: post.blocks.flatMap((block) =>
        block.kind === "PHOTO" && block.photo.renditions.length === 0
          ? []
          : [this.toBlock(block)],
      ),
    };
  }

  private toBlock(block: ApiPostBlock): PostBlock {
    if (block.kind === "TEXT") return block;
    const { hasDetail, ...photo } = block.photo;
    return {
      kind: "PHOTO",
      caption: block.caption,
      hasDetail,
      photo: new Photo({
        id: photo.id,
        title: photo.title,
        width: photo.width,
        height: photo.height,
        createdAt: new Date(photo.createdAt),
        renditions: photo.renditions.map((rendition) => ({
          ...rendition,
          url: this.absoluteUrl(rendition.url),
        })),
        highlights: photo.highlights,
        frame:
          photo.frame && (photo.frame.leftRight > 0 || photo.frame.topBottom > 0)
            ? photo.frame
            : null,
      }),
    };
  }

  // A private photo in a draft is served by the API itself, as a path on its origin.
  private absoluteUrl(url: string) {
    return url.startsWith("/")
      ? `${this.baseUrl?.replace(/\/+$/, "") ?? ""}${url}`
      : url;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    allowed: number[] = [],
  ) {
    if (!this.baseUrl)
      throw new Error("NEXT_PUBLIC_API_URL is not set: posts cannot load.");
    const response = await this.fetchFn(
      `${this.baseUrl.replace(/\/+$/, "")}${path}`,
      {
        method,
        credentials: "include",
        cache: "no-store",
        ...(body === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      },
    );
    if (response.ok || allowed.includes(response.status)) return response;
    if (response.status === 429) throw rateLimitError(response);
    if (response.status === 409) throw new PostConflictError();
    throw new Error(await this.reason(response));
  }

  // The API's own words for a refused post (a private photo, a missing title), else a
  // sentence about the status.
  private async reason(response: Response): Promise<string> {
    if (response.status === 400) {
      try {
        const body = (await response.json()) as { message?: string | string[] };
        const message = Array.isArray(body.message)
          ? body.message.join(". ")
          : body.message;
        if (message) return message;
      } catch {
        /* Fall through to the generic sentence. */
      }
      return "The post was refused. Check its fields and try again.";
    }
    if (response.status === 401) return "Sign in to continue.";
    if (response.status === 403) return "Sign in as the administrator to manage posts.";
    if (response.status === 404) return "This post no longer exists.";
    return "The request could not be completed. Please try again.";
  }
}
