"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PostPage } from "@/src/domain/entities/Post";
import { browsePosts } from "@/src/infrastructure/postServices";
import { postHref } from "./PostArticle";

export type SavedPostsPorts = Pick<typeof browsePosts, "saved">;

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "America/Mexico_City",
});

/**
 * The posts this account saved, newest save first, twenty at a time. Only the account
 * sees this list; a post that stopped being published drops out of it.
 */
export function SavedPosts({ ports = browsePosts }: { ports?: SavedPostsPorts }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PostPage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    ports
      .saved(page)
      .then((next) => {
        if (!live) return;
        setResult(next);
        setFailed(false);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [ports, page]);

  const pages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;
  return (
    <section className="upload-card p-6 md:p-8 max-w-3xl space-y-4" aria-labelledby="saved-posts-title">
      <h2 id="saved-posts-title" className="text-xl font-semibold">
        Saved posts
      </h2>
      {failed && (
        <p role="alert" className="text-sm text-red-700">
          Saved posts could not be loaded. Please try again later.
        </p>
      )}
      {result && result.posts.length === 0 && (
        <p className="text-sm text-gray-700">
          Posts you save on Home appear here. Only you can see this list.
        </p>
      )}
      {result && result.posts.length > 0 && (
        <ul className="space-y-2">
          {result.posts.map((post) => (
            <li key={post.id} className="flex flex-wrap items-baseline gap-x-3">
              <Link href={postHref(post.id)} className="upload-link">
                {post.title || "Untitled post"}
              </Link>
              {post.publishedAt && (
                <span className="text-xs text-gray-600">
                  {dateFormat.format(post.publishedAt)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {result && pages > 1 && (
        <nav className="flex items-center gap-3 text-sm" aria-label="Saved post pages">
          <button type="button" className="upload-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Newer
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button type="button" className="upload-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Older
          </button>
        </nav>
      )}
    </section>
  );
}
