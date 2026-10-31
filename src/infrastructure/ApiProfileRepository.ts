import { Photo } from "../domain/entities/Photo";
import {
  OwnProfile,
  PhotoReactions,
  ProfileCard,
  ProfileChanges,
  PublicProfile,
  Reaction,
} from "../domain/entities/Profile";
import { ProfilePhotoError } from "../domain/errors/ProfilePhotoError";
import { ProfileRepository } from "../domain/repositories/ProfileRepository";
import { rateLimitError } from "./rateLimitError";

/** Turns a photo as the API lists it into the domain's, or null when it cannot show. */
export type ListingMapper = (entry: unknown) => Photo | null;

type ApiCard = {
  id: string;
  publicName: string | null;
  email: string;
  avatar: unknown;
  cover: unknown;
};

export class ApiProfileRepository implements ProfileRepository {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly toPhoto: ListingMapper,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  async mine(): Promise<OwnProfile> {
    return this.toOwn(await this.json("GET", "/auth/me/profile"));
  }

  async update(changes: ProfileChanges): Promise<OwnProfile> {
    const response = await this.send("PATCH", "/auth/me/profile", changes);
    if (response.status === 400) throw new ProfilePhotoError();
    return this.toOwn(await this.ok(response).json());
  }

  async profile(id: string): Promise<PublicProfile> {
    const entry = await this.json("GET", `/profiles/${encodeURIComponent(id)}`);
    if (!entry.profilePublic)
      return {
        id: entry.id,
        publicName: entry.publicName,
        profilePublic: false,
      };
    return {
      ...this.toCard(entry),
      profilePublic: true,
      ...(entry.likes && { likes: this.photos(entry.likes) }),
      ...(entry.favorites && { favorites: this.photos(entry.favorites) }),
    };
  }

  reactions(photoId: string): Promise<PhotoReactions> {
    return this.json("GET", `/photos/${encodeURIComponent(photoId)}/reactions`);
  }

  async react(
    photoId: string,
    kind: Reaction,
    on: boolean,
  ): Promise<PhotoReactions> {
    return this.json(
      on ? "PUT" : "DELETE",
      `/photos/${encodeURIComponent(photoId)}/${kind}`,
    );
  }

  /** The author card a comment carries, shared with the comment repository. */
  toCard(entry: ApiCard): ProfileCard {
    return {
      id: entry.id,
      publicName: entry.publicName,
      email: entry.email,
      avatar: entry.avatar ? this.toPhoto(entry.avatar) : null,
      cover: entry.cover ? this.toPhoto(entry.cover) : null,
    };
  }

  private toOwn(entry: ApiCard & Record<string, unknown>): OwnProfile {
    return {
      ...this.toCard(entry),
      profilePublic: Boolean(entry.profilePublic),
      likesPublic: Boolean(entry.likesPublic),
      favoritesPublic: Boolean(entry.favoritesPublic),
      likes: this.photos(entry.likes as unknown[]),
      favorites: this.photos(entry.favorites as unknown[]),
    };
  }

  private photos(entries: unknown[] = []) {
    return entries.flatMap((entry) => this.toPhoto(entry) ?? []);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Each caller narrows the JSON it reads.
  private async json(method: string, path: string): Promise<any> {
    return this.ok(await this.send(method, path)).json();
  }

  private send(method: string, path: string, body?: unknown) {
    if (!this.baseUrl) throw new Error("NEXT_PUBLIC_API_URL is not set");
    return this.fetchFn(`${this.baseUrl.replace(/\/+$/, "")}${path}`, {
      method,
      credentials: "include",
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
  }

  private ok(response: Response) {
    if (response.status === 429) throw rateLimitError(response);
    if (!response.ok)
      throw new Error(
        `The API answered ${response.status} ${response.statusText}`.trim(),
      );
    return response;
  }
}
