import { describe, expect, it, vi } from "vitest";
import { ApiProfileRepository } from "../ApiProfileRepository";
import { ApiPhotoRepository } from "../ApiPhotoRepository";
import { ApiCommentRepository } from "../ApiCommentRepository";
import { ProfilePhotoError } from "@/src/domain/errors/ProfilePhotoError";

const API_URL = "http://api.test";
const photos = new ApiPhotoRepository(API_URL);

const listing = (id: string) => ({
  id,
  title: `Photo ${id}`,
  width: 1200,
  height: 800,
  createdAt: "2026-10-01T00:00:00.000Z",
  renditions: [{ width: 320, url: `https://img.test/${id}-320.jpg` }],
});

const card = {
  id: "usr_1",
  publicName: "Ana G.",
  email: "ana@example.com",
  avatar: listing("pho_a"),
  cover: null,
};

// A fresh response per call: a body can be read only once.
function respondWith(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

const repository = (fetchFn: ReturnType<typeof respondWith>) =>
  new ApiProfileRepository(
    API_URL,
    (entry) => photos.fromListing(entry),
    fetchFn,
  );

describe("ApiProfileRepository", () => {
  it("reads the own profile with credentials and maps its photos", async () => {
    const fetchFn = respondWith({
      ...card,
      profilePublic: true,
      likesPublic: false,
      favoritesPublic: true,
      likes: [listing("pho_l"), { ...listing("gone"), renditions: [] }],
      favorites: [],
    });
    const profile = await repository(fetchFn).mine();
    expect(fetchFn).toHaveBeenCalledWith(`${API_URL}/auth/me/profile`, {
      method: "GET",
      credentials: "include",
    });
    expect(profile.avatar?.getId()).toBe("pho_a");
    expect(profile.likes.map((photo) => photo.getId())).toEqual(["pho_l"]);
    expect(profile).toMatchObject({
      likesPublic: false,
      favoritesPublic: true,
    });
  });

  it("sends only the changed fields and explains a refused photo", async () => {
    const ok = respondWith({ ...card, likes: [], favorites: [] });
    await repository(ok).update({ avatarPhotoId: null });
    expect(ok.mock.calls[0][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ avatarPhotoId: null }),
    });
    await expect(
      repository(respondWith({}, 400)).update({ coverPhotoId: "private" }),
    ).rejects.toBeInstanceOf(ProfilePhotoError);
  });

  it("reads a private profile as its name alone", async () => {
    await expect(
      repository(
        respondWith({
          id: "usr_2",
          publicName: "Luis M.",
          profilePublic: false,
        }),
      ).profile("usr_2"),
    ).resolves.toEqual({
      id: "usr_2",
      publicName: "Luis M.",
      profilePublic: false,
    });
  });

  it("keeps only the lists a public profile shares", async () => {
    const profile = await repository(
      respondWith({ ...card, profilePublic: true, likes: [listing("pho_l")] }),
    ).profile("usr_1");
    expect(profile.profilePublic && profile.likes?.length).toBe(1);
    expect(profile.profilePublic && profile.favorites).toBeUndefined();
  });

  it("likes with PUT and unsaves with DELETE", async () => {
    const counts = { likes: 3, liked: true, favorited: false };
    const fetchFn = respondWith(counts);
    await expect(
      repository(fetchFn).react("pho_1", "like", true),
    ).resolves.toEqual(counts);
    await repository(fetchFn).react("pho_1", "favorite", false);
    expect(
      fetchFn.mock.calls.map(([url, init]) => [url, init?.method]),
    ).toEqual([
      [`${API_URL}/photos/pho_1/like`, "PUT"],
      [`${API_URL}/photos/pho_1/favorite`, "DELETE"],
    ]);
    await repository(fetchFn).reactions("pho_1");
    expect(fetchFn.mock.calls[2][0]).toBe(`${API_URL}/photos/pho_1/reactions`);
  });

  it("fails plainly when the API refuses", async () => {
    await expect(repository(respondWith({}, 500)).mine()).rejects.toThrow(
      "The API answered 500",
    );
  });

  it("gives comments their author's card when the profile is public", async () => {
    const profiles = repository(vi.fn());
    const comments = new ApiCommentRepository(
      API_URL,
      respondWith([
        {
          id: "cmt_1",
          authorName: "Ana G.",
          body: "Lovely",
          status: "APPROVED",
          createdAt: "2026-10-01T00:00:00.000Z",
          mine: false,
          author: card,
        },
        {
          id: "cmt_2",
          authorName: "Luis M.",
          body: "Yes",
          status: "APPROVED",
          createdAt: "2026-10-01T00:00:00.000Z",
          mine: false,
          author: null,
        },
      ]),
      (entry) => profiles.toCard(entry),
    );
    const [first, second] = await comments.listForPhoto("pho_1");
    expect(first.getAuthor()).toMatchObject({
      id: "usr_1",
      email: "ana@example.com",
    });
    expect(first.getAuthor()?.avatar?.getId()).toBe("pho_a");
    expect(second.getAuthor()).toBeNull();
  });
});
