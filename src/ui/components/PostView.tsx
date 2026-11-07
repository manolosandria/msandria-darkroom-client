"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Post } from "@/src/domain/entities/Post";
import { browsePosts } from "@/src/infrastructure/postServices";
import { PostArticle } from "./PostArticle";
import { useSessionValue } from "./SessionProvider";
import "./posts.css";

export type PostViewPorts = Pick<typeof browsePosts, "findById" | "react">;

/**
 * A post at its own address (`/post/[id]`). A draft or a scheduled post exists only for
 * the administrator; the API answers 404 to anyone else, shown here as not found.
 */
export default function PostView({
  postId,
  ports = browsePosts,
}: {
  postId: string;
  ports?: PostViewPorts;
}) {
  const { user } = useSessionValue();
  const userId = user?.getId();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "found"; post: Post }
    | { status: "missing" }
    | { status: "failed" }
  >({ status: "loading" });

  useEffect(() => {
    let live = true;
    ports
      .findById(postId)
      .then((post) => {
        if (live) setState(post ? { status: "found", post } : { status: "missing" });
      })
      .catch(() => live && setState({ status: "failed" }));
    return () => {
      live = false;
    };
  }, [ports, postId, userId]);

  return (
    <main className="post-page">
      <p className="post-page__back">
        <Link href="/#posts">← All posts</Link>
      </p>
      {state.status === "loading" && (
        <p className="home-posts__status" aria-busy="true">
          Loading the post…
        </p>
      )}
      {state.status === "missing" && (
        <p className="home-posts__status">This post does not exist.</p>
      )}
      {state.status === "failed" && (
        <p role="alert" className="home-posts__status">
          The post could not be loaded. Please try again later.
        </p>
      )}
      {state.status === "found" && (
        <PostArticle
          key={state.post.version}
          post={state.post}
          headingLevel={1}
          linkTitle={false}
          ports={ports}
        />
      )}
    </main>
  );
}
