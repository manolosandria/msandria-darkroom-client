"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { POSTS_PER_PAGE, PostPage, normalizeTag } from "@/src/domain/entities/Post";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { browsePosts } from "@/src/infrastructure/postServices";
import { rateLimitMessage } from "@/src/ui/rateLimitMessage";
import { PostArticle, PostReactionPorts } from "./PostArticle";
import "./posts.css";

export type HomePostsPorts = Pick<typeof browsePosts, "page"> & PostReactionPorts;

// `?page=` and `?tag=` in Home's address: a page or a tag can be shared and survives
// a return from a photo.
export function postsHref(page: number, tag: string | null) {
  const query = new URLSearchParams();
  if (tag) query.set("tag", tag);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return `/${search ? `?${search}` : ""}#posts`;
}

/**
 * Home's blog under the carousel: published posts, newest first, a page at a time,
 * optionally narrowed to one tag. Nothing is shown while there are no posts at all.
 */
export default function HomePosts({
  ports = browsePosts,
}: {
  ports?: HomePostsPorts;
}) {
  const params = useSearchParams();
  const requested = Number(params.get("page"));
  const page = Number.isSafeInteger(requested) && requested > 1 ? requested : 1;
  const rawTag = params.get("tag");
  const tag = rawTag ? normalizeTag(rawTag) : null;
  const [result, setResult] = useState<{ key: string; page: PostPage } | null>(
    null,
  );
  const [error, setError] = useState<{ key: string; message: string } | null>(
    null,
  );
  const key = `${page}|${tag ?? ""}`;

  useEffect(() => {
    let live = true;
    ports
      .page({ page, limit: POSTS_PER_PAGE, tag: tag ?? undefined })
      .then((next) => {
        if (live) setResult({ key, page: next });
      })
      .catch((caught: unknown) => {
        if (!live) return;
        setError({
          key,
          message:
            caught instanceof RateLimitError
              ? rateLimitMessage(caught)
              : "Posts could not be loaded. Please try again later.",
        });
      });
    return () => {
      live = false;
    };
  }, [ports, page, tag, key]);

  const current = result?.key === key ? result.page : null;
  const failed = error?.key === key ? error.message : "";
  if (!current && !failed)
    return (
      <section id="posts" className="home-posts" aria-busy="true">
        <p className="home-posts__status">Loading posts…</p>
      </section>
    );
  if (current && current.total === 0 && !tag && page === 1) return null;
  const pages = current ? Math.max(1, Math.ceil(current.total / current.limit)) : 1;
  return (
    <section id="posts" className="home-posts" aria-labelledby="home-posts-title">
      <div className="home-posts__head">
        <h2 id="home-posts-title">Journal</h2>
        {tag && (
          <p className="home-posts__filter">
            Posts tagged <strong>#{tag}</strong>{" "}
            <Link href={postsHref(1, null)}>Show all</Link>
          </p>
        )}
      </div>
      {failed && (
        <p role="alert" className="home-posts__status">
          {failed}
        </p>
      )}
      {current && current.posts.length === 0 && (
        <p className="home-posts__status">
          {tag ? "No posts carry this tag." : "There is nothing on this page."}
        </p>
      )}
      {current?.posts.map((post) => (
        <PostArticle key={post.id} post={post} ports={ports} />
      ))}
      {current && pages > 1 && (
        <nav className="home-posts__pages" aria-label="Post pages">
          {page > 1 ? (
            <Link href={postsHref(page - 1, tag)} rel="prev">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={postsHref(page + 1, tag)} rel="next">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}
