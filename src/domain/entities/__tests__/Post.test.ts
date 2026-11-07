import { describe, expect, it } from "vitest";
import { Photo } from "../Photo";
import {
  Post,
  draftOf,
  isScheduled,
  normalizeTag,
  paragraphsOf,
  publishingProblem,
} from "../Post";

const photo = new Photo({
  id: "p1",
  title: "Sunset",
  width: 1600,
  height: 1000,
  renditions: [{ width: 640, url: "https://img.example/p1/640" }],
});

const post = (overrides: Partial<Post> = {}): Post => ({
  id: "post_1",
  version: 1,
  title: "A walk",
  status: "PUBLISHED",
  publishedAt: new Date("2026-11-01T12:00:00Z"),
  tags: ["trip"],
  likes: 0,
  liked: false,
  saved: false,
  blocks: [
    { kind: "TEXT", text: "Hello", style: "BODY" },
    { kind: "PHOTO", caption: null, photo, hasDetail: true },
  ],
  ...overrides,
});

describe("Post", () => {
  it.each([
    ["#Trip", "trip"],
    ["  Black   and white ", "black and white"],
    ["ñandú_2", "ñandú_2"],
    ["##", null],
    ["-odd", null],
    ["with/slash", null],
  ])("normalizes the tag %j as %j, like the API", (raw, expected) => {
    expect(normalizeTag(raw)).toBe(expected);
  });

  it("splits text into paragraphs on blank lines only", () => {
    expect(paragraphsOf("One\nline\n\n  \nTwo\n\n")).toEqual([
      "One\nline",
      "Two",
    ]);
  });

  it("knows a published post with a later date is scheduled", () => {
    const now = new Date("2026-11-06T00:00:00Z");
    expect(isScheduled(post(), now)).toBe(false);
    expect(
      isScheduled(post({ publishedAt: new Date("2026-12-24T00:00:00Z") }), now),
    ).toBe(true);
    expect(
      isScheduled(
        post({ status: "DRAFT", publishedAt: new Date("2026-12-24T00:00:00Z") }),
        now,
      ),
    ).toBe(false);
    expect(isScheduled(post({ publishedAt: null }), now)).toBe(false);
  });

  it("turns a post back into what the editor sends", () => {
    expect(draftOf(post())).toEqual({
      title: "A walk",
      status: "PUBLISHED",
      publishedAt: "2026-11-01T12:00:00.000Z",
      tags: ["trip"],
      blocks: [
        { kind: "TEXT", text: "Hello", style: "BODY" },
        { kind: "PHOTO", photoId: "p1", caption: "" },
      ],
    });
    expect(draftOf(post({ publishedAt: null })).publishedAt).toBeNull();
  });

  it("says why a post cannot be published yet", () => {
    const draft = draftOf(post());
    expect(publishingProblem(draft)).toBeNull();
    expect(publishingProblem({ ...draft, title: "  " })).toMatch(/title/);
    expect(publishingProblem({ ...draft, blocks: [] })).toMatch(/Add a text/);
    expect(
      publishingProblem({
        ...draft,
        blocks: [{ kind: "TEXT", text: " ", style: "BODY" }],
      }),
    ).toMatch(/empty text/);
  });
});
