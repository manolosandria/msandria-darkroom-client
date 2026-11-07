"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Post,
  PostPhotoBlock,
  PostReaction,
  PostReactions,
  isScheduled,
  paragraphsOf,
} from "@/src/domain/entities/Post";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { browsePosts } from "@/src/infrastructure/postServices";
import { rateLimitMessage } from "@/src/ui/rateLimitMessage";
import { rememberPhotoListOnViewerClick } from "@/src/ui/viewerSequence";
import { PhotoImage } from "./PhotoImage";
import { useSessionValue } from "./SessionProvider";
import "./profiles.css";
import "./posts.css";

export type PostReactionPorts = Pick<typeof browsePosts, "react">;

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "long",
  timeZone: "America/Mexico_City",
});

export const postHref = (id: string) => `/post/${encodeURIComponent(id)}`;
export const tagHref = (tag: string) =>
  `/?tag=${encodeURIComponent(tag)}#posts`;

/**
 * One post as the public reads it: title, date, its blocks in order, tags, and Like and
 * Save. A photo of the gallery opens its own detail view; a posts-only photo has none,
 * so it is shown without a link. `preview` (Curator) leaves out links and reactions.
 */
export function PostArticle({
  post,
  headingLevel = 2,
  linkTitle = true,
  preview = false,
  ports = browsePosts,
}: {
  post: Post;
  headingLevel?: 1 | 2;
  linkTitle?: boolean;
  preview?: boolean;
  ports?: PostReactionPorts;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const detailIds = post.blocks.flatMap((block) =>
    block.kind === "PHOTO" && block.hasDetail ? [block.photo.getId()] : [],
  );
  const title = post.title || "Untitled post";
  return (
    <article className="post" aria-labelledby={`post-${post.id}`}>
      <header className="post__header">
        <Heading id={`post-${post.id}`} className="post__title">
          {linkTitle && !preview ? (
            <Link href={postHref(post.id)}>{title}</Link>
          ) : (
            title
          )}
        </Heading>
        <p className="post__date">
          {post.status === "DRAFT" ? (
            <span className="post__badge">Draft</span>
          ) : null}
          {isScheduled(post) ? (
            <span className="post__badge">Scheduled</span>
          ) : null}
          {post.publishedAt && (
            <time dateTime={post.publishedAt.toISOString()}>
              {dateFormat.format(post.publishedAt)}
            </time>
          )}
        </p>
      </header>
      <div className="post__body">
        {post.blocks.map((block, index) =>
          block.kind === "TEXT" ? (
            <PostText key={index} text={block.text} style={block.style} />
          ) : (
            <PostFigure
              key={index}
              block={block}
              linked={!preview && block.hasDetail}
              onOpen={() => rememberPhotoListOnViewerClick(detailIds)}
            />
          ),
        )}
      </div>
      {(post.tags.length > 0 || !preview) && (
        <footer className="post__footer">
          {post.tags.length > 0 && (
            <ul className="post__tags" aria-label="Tags">
              {post.tags.map((tag) => (
                <li key={tag}>
                  {preview ? (
                    <span>#{tag}</span>
                  ) : (
                    <Link href={tagHref(tag)}>#{tag}</Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!preview && post.status === "PUBLISHED" && !isScheduled(post) && (
            <PostReactionsBar post={post} ports={ports} />
          )}
        </footer>
      )}
    </article>
  );
}

function PostText({ text, style }: { text: string; style: string }) {
  const paragraphs = paragraphsOf(text);
  if (style === "HEADING")
    return <h3 className="post__heading">{paragraphs.join(" ")}</h3>;
  const content = paragraphs.map((paragraph, index) => (
    <p key={index}>{paragraph}</p>
  ));
  return style === "QUOTE" ? (
    <blockquote className="post__quote">{content}</blockquote>
  ) : (
    <div className="post__text">{content}</div>
  );
}

function PostFigure({
  block,
  linked,
  onOpen,
}: {
  block: PostPhotoBlock;
  linked: boolean;
  onOpen: () => void;
}) {
  // PhotoImage fills its box, so the box keeps the photo's proportion; a tall photo
  // is narrowed to stay within the window's height.
  const image = (
    <span
      className="post__frame"
      style={{ "--ratio": block.photo.getAspectRatio() } as React.CSSProperties}
    >
      <PhotoImage
        photo={block.photo}
        className="post__image"
        fallbackSizes="(max-width: 720px) 100vw, 680px"
      />
    </span>
  );
  return (
    <figure className="post__figure">
      {linked ? (
        <Link
          href={`/photo/${encodeURIComponent(block.photo.getId())}`}
          className="post__photo-link"
          aria-label={`Open ${block.photo.getTitle()}`}
          onClick={onOpen}
        >
          {image}
        </Link>
      ) : (
        image
      )}
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  );
}

/**
 * Like and Save for a post. The like count is public; whether the visitor liked or
 * saved it shows only to them. Saved posts are listed on the account page. Signed out,
 * the buttons say what signing in would offer.
 */
export function PostReactionsBar({
  post,
  ports = browsePosts,
}: {
  post: Pick<Post, "id" | "likes" | "liked" | "saved">;
  ports?: PostReactionPorts;
}) {
  const { user } = useSessionValue();
  const [counts, setCounts] = useState<PostReactions>({
    likes: post.likes,
    liked: post.liked,
    saved: post.saved,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signedOut = !user;
  const toggle = async (kind: PostReaction, on: boolean) => {
    setBusy(true);
    setError("");
    try {
      setCounts(await ports.react(post.id, kind, on));
    } catch (caught) {
      setError(
        caught instanceof RateLimitError
          ? rateLimitMessage(caught)
          : "That did not go through. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="photo-reactions post__reactions" role="group" aria-label="Reactions">
      <button
        type="button"
        aria-pressed={counts.liked}
        disabled={busy || signedOut}
        title={signedOut ? "Sign in to like posts" : undefined}
        onClick={() => toggle("like", !counts.liked)}
      >
        <span aria-hidden="true">{counts.liked ? "♥" : "♡"}</span>
        Like
        <span aria-label={`${counts.likes} likes`}>{counts.likes}</span>
      </button>
      <button
        type="button"
        aria-pressed={counts.saved}
        disabled={busy || signedOut}
        title={signedOut ? "Sign in to save posts" : undefined}
        onClick={() => toggle("save", !counts.saved)}
      >
        <span aria-hidden="true">{counts.saved ? "★" : "☆"}</span>
        {counts.saved ? "Saved" : "Save"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
