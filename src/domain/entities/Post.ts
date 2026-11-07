import { Photo } from "./Photo";

export type PostStatus = "DRAFT" | "PUBLISHED";
export type PostTextStyle = "HEADING" | "BODY" | "QUOTE";

export type PostTextBlock = { kind: "TEXT"; text: string; style: PostTextStyle };
// `hasDetail`: the photo has its own detail view (it is in the gallery or a public
// collection). A posts-only photo does not, so it is shown without a link.
export type PostPhotoBlock = {
  kind: "PHOTO";
  caption: string | null;
  photo: Photo;
  hasDetail: boolean;
};
export type PostBlock = PostTextBlock | PostPhotoBlock;

export type Post = {
  id: string;
  version: number;
  title: string;
  status: PostStatus;
  publishedAt: Date | null;
  tags: string[];
  likes: number;
  liked: boolean;
  saved: boolean;
  blocks: PostBlock[];
};

export type PostPage = {
  page: number;
  limit: number;
  total: number;
  tag: string | null;
  posts: Post[];
};

export type PostReactions = { likes: number; liked: boolean; saved: boolean };
export type PostReaction = "like" | "save";

// What the editor sends: the whole post, blocks in their final order.
export type PostDraftBlock =
  | { kind: "TEXT"; text: string; style: PostTextStyle }
  | { kind: "PHOTO"; photoId: string; caption: string };
export type PostDraft = {
  title: string;
  status: PostStatus;
  // ISO date; null lets the API use the moment of publishing.
  publishedAt: string | null;
  tags: string[];
  blocks: PostDraftBlock[];
};

export const MAX_POST_TAGS = 20;
export const MAX_POST_BLOCKS = 60;
export const POSTS_PER_PAGE = 5;

const TAG_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,39}$/u;

// A tag as the API stores it: no leading "#", single spaces and lower case, so "#Trip"
// and "trip" are the same tag. Null when it cannot be one.
export function normalizeTag(raw: string): string | null {
  const tag = raw
    .normalize("NFC")
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return TAG_PATTERN.test(tag) ? tag : null;
}

// Plain text in paragraphs: a blank line separates them, a single break stays a break.
// Nothing is ever read as HTML.
export function paragraphsOf(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

// Published with a date still ahead: the public does not see it yet.
export function isScheduled(post: Post, now = new Date()): boolean {
  return (
    post.status === "PUBLISHED" &&
    post.publishedAt !== null &&
    post.publishedAt.getTime() > now.getTime()
  );
}

export function draftOf(post: Post): PostDraft {
  return {
    title: post.title,
    status: post.status,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    tags: [...post.tags],
    blocks: post.blocks.map((block) =>
      block.kind === "TEXT"
        ? { kind: "TEXT", text: block.text, style: block.style }
        : {
            kind: "PHOTO",
            photoId: block.photo.getId(),
            caption: block.caption ?? "",
          },
    ),
  };
}

// Why the post cannot be published yet, or null when it can. The API checks the same.
export function publishingProblem(draft: PostDraft): string | null {
  if (!draft.title.trim()) return "Give the post a title before publishing.";
  if (!draft.blocks.length) return "Add a text or a photo before publishing.";
  if (draft.blocks.some((block) => block.kind === "TEXT" && !block.text.trim()))
    return "Fill in or remove the empty text blocks.";
  return null;
}
