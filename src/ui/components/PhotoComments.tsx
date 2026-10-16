"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { COMMENT_MAX_LENGTH, PhotoComment } from "@/src/domain/entities/PhotoComment";
import {
  deleteComment,
  getPhotoComments,
  postComment,
} from "@/src/infrastructure/commentServices";
import {
  DELETED_AUTHOR,
  commentFailureMessage,
  formatCommentDate,
} from "@/src/ui/commentMessages";
import { useSessionValue } from "./SessionProvider";

type LoadState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; comments: PhotoComment[] };

interface PhotoCommentsProps {
  photoId: string;
}

// The comments section of the info panel. Visitors read approved comments; a signed-in
// visitor also sees their own while they wait for moderation, and can delete them.
// The parent keys this component by photo, so moving to another photo starts afresh.
export function PhotoComments({ photoId }: PhotoCommentsProps) {
  const session = useSessionValue();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", comments: await getPhotoComments.execute(photoId) });
    } catch {
      setState({ status: "failed" });
    }
  }, [photoId]);

  // Loads once the session is known, so the visitor's own pending comments come back
  // with the first answer instead of appearing a moment later.
  // Signing in or out reloads them, since what the visitor may see changes.
  const sessionKey = session.loading ? null : (session.user?.getId() ?? "anonymous");
  useEffect(() => {
    if (sessionKey === null) return;
    // Deferred to a microtask so the initial setState doesn't run
    // synchronously inside the effect body (react-hooks/set-state-in-effect).
    queueMicrotask(load);
  }, [load, sessionKey]);

  const comments = state.status === "ready" ? state.comments : [];

  return (
    <section aria-label="Comments" className="photo-viewer__panel-section">
      <h3 className="photo-viewer__panel-heading">Comments</h3>
      {state.status === "loading" ? (
        <p role="status" className="text-sm text-neutral-500">Loading comments…</p>
      ) : state.status === "failed" ? (
        <p role="alert" className="text-sm text-neutral-600">
          Could not load the comments.{" "}
          <button type="button" className="photo-comments__link" onClick={load}>
            Try again
          </button>
        </p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-neutral-500">No comments yet.</p>
      ) : (
        <ol className="photo-comments__list">
          {comments.map((comment) => (
            <CommentItem
              key={comment.getId()}
              comment={comment}
              onDeleted={() =>
                setState({
                  status: "ready",
                  comments: comments.filter((other) => other.getId() !== comment.getId()),
                })
              }
            />
          ))}
        </ol>
      )}
      <CommentForm
        photoId={photoId}
        onPosted={(comment) =>
          setState((current) =>
            current.status === "ready"
              ? { status: "ready", comments: [...current.comments, comment] }
              : current,
          )
        }
      />
    </section>
  );
}

function CommentItem({ comment, onDeleted }: { comment: PhotoComment; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const author = comment.getAuthorName() ?? DELETED_AUTHOR;
  return (
    <li className="photo-comments__item">
      <p className="photo-comments__meta">
        <span className={comment.getAuthorName() ? "font-medium text-neutral-900" : "italic"}>
          {author}
        </span>
        <time dateTime={comment.getCreatedAt().toISOString()}>
          {formatCommentDate(comment.getCreatedAt())}
        </time>
      </p>
      <p className="whitespace-pre-line break-words leading-relaxed">{comment.getBody()}</p>
      {(comment.isPending() || comment.isMine()) && (
        <p className="photo-comments__meta">
          {comment.isPending() && <span>Awaiting moderation</span>}
          {comment.isMine() && (
            <button
              type="button"
              className="photo-comments__link"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                setError("");
                try {
                  await deleteComment.execute(comment.getId());
                  onDeleted();
                } catch (failure) {
                  setError(commentFailureMessage(failure));
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="photo-comments__error">
          {error}
        </p>
      )}
    </li>
  );
}

function CommentForm({
  photoId,
  onPosted,
}: {
  photoId: string;
  onPosted: (comment: PhotoComment) => void;
}) {
  const session = useSessionValue();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (session.loading) return null;
  if (!session.user) {
    return <p className="photo-comments__note">Sign in to leave a comment.</p>;
  }
  const publicName = session.user.getPublicName()?.current ?? null;
  if (!publicName) {
    return (
      <p className="photo-comments__note">
        <Link href="/account" className="photo-comments__link">
          Choose a public name
        </Link>{" "}
        to leave a comment.
      </p>
    );
  }

  return (
    <form
      aria-label="Leave a comment"
      className="photo-comments__form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (sending || !body.trim()) return;
        setSending(true);
        setError("");
        setSent(false);
        try {
          onPosted(await postComment.execute(photoId, body));
          setBody("");
          setSent(true);
        } catch (failure) {
          setError(commentFailureMessage(failure));
        } finally {
          setSending(false);
        }
      }}
    >
      <label htmlFor={`comment-${photoId}`} className="sr-only">
        Comment
      </label>
      <textarea
        id={`comment-${photoId}`}
        value={body}
        maxLength={COMMENT_MAX_LENGTH}
        rows={3}
        placeholder="Write a comment"
        onChange={(event) => setBody(event.target.value)}
        disabled={sending}
      />
      <p className="photo-comments__meta">
        <span>
          Commenting as <strong className="font-medium text-neutral-900">{publicName}</strong> ·{" "}
          <Link href="/account" className="photo-comments__link">
            Change
          </Link>
        </span>
        <span aria-hidden="true">
          {body.length}/{COMMENT_MAX_LENGTH}
        </span>
      </p>
      {error && (
        <p role="alert" className="photo-comments__error">
          {error}
        </p>
      )}
      {sent && (
        <p role="status" className="photo-comments__note">
          Thanks. Your comment will appear once it is approved.
        </p>
      )}
      <button type="submit" className="photo-comments__submit" disabled={sending || !body.trim()}>
        {sending ? "Sending…" : "Post comment"}
      </button>
    </form>
  );
}
