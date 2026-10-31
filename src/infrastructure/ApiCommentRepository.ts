import { CommentError } from "../domain/errors/CommentError";
import {
  PendingComment,
  PhotoComment,
  PhotoCommentStatus,
} from "../domain/entities/PhotoComment";
import { CommentRepository } from "../domain/repositories/CommentRepository";
import { rateLimitError } from "./rateLimitError";
import { ProfileCard } from "../domain/entities/Profile";

// Turns the author card a comment carries into the domain's.
export type AuthorCardMapper = (entry: never) => ProfileCard;

type ApiComment = {
  id: string;
  authorName: string | null;
  body: string;
  status: PhotoCommentStatus;
  createdAt: string;
  mine: boolean;
  author?: unknown;
};

type ApiPendingComment = {
  id: string;
  photo: { id: string; title: string };
  authorName: string | null;
  body: string;
  createdAt: string;
};

const STATUS_FAILURES = {
  400: "rejected",
  401: "unauthenticated",
  403: "forbidden",
  404: "notFound",
} as const;

export class ApiCommentRepository implements CommentRepository {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly toCard?: AuthorCardMapper,
  ) {}

  async listForPhoto(photoId: string): Promise<PhotoComment[]> {
    const response = await this.send("GET", `/photos/${encodeURIComponent(photoId)}/comments`);
    const entries = (await (await this.ensureOk(response)).json()) as ApiComment[];
    return entries.map((entry) => this.toComment(entry));
  }

  private toComment({ author, ...entry }: ApiComment): PhotoComment {
    return new PhotoComment({
      ...entry,
      createdAt: new Date(entry.createdAt),
      author: author && this.toCard ? this.toCard(author as never) : null,
    });
  }

  async create(photoId: string, body: string): Promise<PhotoComment> {
    const response = await this.send("POST", `/photos/${encodeURIComponent(photoId)}/comments`, { body });
    return this.toComment((await (await this.ensureOk(response)).json()) as ApiComment);
  }

  async pending(): Promise<PendingComment[]> {
    const response = await this.send("GET", "/comments/pending");
    const entries = (await (await this.ensureOk(response)).json()) as ApiPendingComment[];
    return entries.map((entry) => ({ ...entry, createdAt: new Date(entry.createdAt) }));
  }

  async approve(commentId: string): Promise<void> {
    await this.ensureOk(await this.send("POST", `/comments/${encodeURIComponent(commentId)}/approve`));
  }

  async remove(commentId: string): Promise<void> {
    await this.ensureOk(await this.send("DELETE", `/comments/${encodeURIComponent(commentId)}`));
  }

  // Same rule as the session repository: without `credentials: "include"` the browser
  // would not attach the session cookie to this cross-origin call.
  private send(method: string, path: string, body?: unknown) {
    if (!this.baseUrl) {
      throw new Error("NEXT_PUBLIC_API_URL is not set: the gallery cannot reach the API.");
    }
    return this.fetchFn(`${this.baseUrl.replace(/\/+$/, "")}${path}`, {
      method,
      credentials: "include",
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  }

  // Each refusal becomes something the interface can explain. The wording stays out of
  // here: the API's own messages are not meant for visitors.
  private async ensureOk(response: Response) {
    if (response.ok) return response;
    if (response.status === 429) throw rateLimitError(response);
    const failure = STATUS_FAILURES[response.status as keyof typeof STATUS_FAILURES];
    if (failure) throw new CommentError(failure);
    if (response.status === 409) {
      const { code } = (await response.json().catch(() => ({}))) as { code?: string };
      if (code === "PUBLIC_NAME_REQUIRED") throw new CommentError("publicNameRequired");
    }
    throw new Error(`The API answered ${response.status} ${response.statusText}`.trim());
  }
}
