"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { readCommentDraft, saveCommentDraft } from "@/src/ui/commentDrafts";
import { useSessionValue } from "./SessionProvider";

type LoadState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; comments: PhotoComment[] };

interface PhotoCommentsProps {
  photoId: string;
}

// How long a comment waits after Enter before it is sent, so it can still be taken
// back or corrected.
export const SEND_DELAY_MS = 5000;

// Rotated while the box is empty, to make the invitation feel less like a form.
export const COMMENT_PROMPTS = [
  "What do you think?",
  "Share your thoughts",
  "What caught your eye?",
  "Say something nice",
  "How does it make you feel?",
];
const PROMPT_INTERVAL_MS = 4000;

// The box grows with its text up to this height, then scrolls.
const MAX_BOX_HEIGHT_PX = 160;

// When the remaining characters are worth counting.
const COUNTER_THRESHOLD = COMMENT_MAX_LENGTH - 200;

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

  // No heading: the divider above the section is enough. Comments read top to bottom,
  // oldest first, and the box stays at the bottom of the panel.
  return (
    <section aria-label="Comments" className="photo-viewer__panel-section photo-comments">
      {state.status === "loading" ? (
        <p role="status" className="photo-comments__note">
          Loading comments…
        </p>
      ) : state.status === "failed" ? (
        <p role="alert" className="photo-comments__note">
          Could not load the comments.{" "}
          <button type="button" className="photo-comments__link" onClick={load}>
            Try again
          </button>
        </p>
      ) : (
        comments.length > 0 && (
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
        )
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
    <li className={`photo-comments__card${comment.isPending() ? " is-pending" : ""}`}>
      <p className="photo-comments__meta">
        <span
          className={
            comment.getAuthorName() ? "photo-comments__author" : "photo-comments__author is-deleted"
          }
        >
          {author}
        </span>
        <time dateTime={comment.getCreatedAt().toISOString()}>
          {formatCommentDate(comment.getCreatedAt())}
        </time>
      </p>
      <p className="photo-comments__body">{comment.getBody()}</p>
      {(comment.isPending() || comment.isMine()) && (
        <p className="photo-comments__footer">
          {comment.isPending() && <span className="photo-comments__badge">Awaiting moderation</span>}
          {comment.isMine() && (
            <button
              type="button"
              className="photo-comments__button is-dark"
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
              {/* Taking back a comment nobody has seen yet is cancelling it. */}
              {comment.isPending()
                ? deleting
                  ? "Cancelling…"
                  : "Cancel"
                : deleting
                  ? "Deleting…"
                  : "Delete"}
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
  // A draft survives moving to another photo and back.
  const [body, setBody] = useState(() => readCommentDraft(photoId));
  const [queued, setQueued] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [prompt, setPrompt] = useState(0);
  const box = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);

  // Grows the box with its text instead of offering a resize handle.
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_BOX_HEIGHT_PX)}px`;
  }, [body]);

  useEffect(() => saveCommentDraft(photoId, body), [photoId, body]);

  const empty = body.length === 0;
  useEffect(() => {
    if (!empty) return;
    const interval = setInterval(
      () => setPrompt((index) => (index + 1) % COMMENT_PROMPTS.length),
      PROMPT_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [empty]);

  // A comment still waiting to go when the visitor moves on was meant to be sent, so
  // it is sent rather than lost; there is no panel left to report the outcome in.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current) postComment.execute(photoId, pending.current).catch(() => {});
    },
    [photoId],
  );

  const send = useCallback(
    async (text: string) => {
      timer.current = null;
      pending.current = null;
      setQueued(null);
      setSending(true);
      try {
        onPosted(await postComment.execute(photoId, text));
        setSent(true);
      } catch (failure) {
        // Gives the text back so nothing is lost, unless something new was typed.
        setBody((current) => (current ? current : text));
        setError(commentFailureMessage(failure));
      } finally {
        setSending(false);
      }
    },
    [photoId, onPosted],
  );

  if (session.loading) return null;
  if (!session.user) {
    return <p className="photo-comments__note photo-comments__dock">Sign in to leave a comment.</p>;
  }
  const publicName = session.user.getPublicName()?.current ?? null;
  if (!publicName) {
    return (
      <p className="photo-comments__note photo-comments__dock">
        <Link href="/account" className="photo-comments__link">
          Choose a public name
        </Link>{" "}
        to leave a comment.
      </p>
    );
  }

  const busy = sending || queued !== null;
  const queue = () => {
    const text = body.trim();
    if (busy || !text) return;
    setError("");
    setSent(false);
    setBody("");
    setQueued(text);
    pending.current = text;
    timer.current = setTimeout(() => void send(text), SEND_DELAY_MS);
  };
  const sendNow = () => {
    if (timer.current) clearTimeout(timer.current);
    if (queued) void send(queued);
  };
  // Stops the send and gives the text back to the box to be corrected or cleared.
  const takeBack = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    if (queued) setBody(queued);
    setQueued(null);
    box.current?.focus();
  };

  return (
    <div className="photo-comments__dock">
      {queued !== null && (
        <div role="status" className="photo-comments__card is-queued">
          <p className="photo-comments__meta">
            <span className="photo-comments__author">{publicName}</span>
            <span>Sending…</span>
          </p>
          <p className="photo-comments__body">{queued}</p>
          <p className="photo-comments__hint">
            A moderator will review it before it appears.
          </p>
          <p className="photo-comments__footer">
            <button type="button" className="photo-comments__button is-light" onClick={takeBack}>
              Cancel and edit
            </button>
            <button type="button" className="photo-comments__button is-go" onClick={sendNow}>
              Send now
            </button>
          </p>
          <span
            aria-hidden="true"
            className="photo-comments__countdown"
            style={{ animationDuration: `${SEND_DELAY_MS}ms` }}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="photo-comments__error">
          {error}
        </p>
      )}
      {sent && !queued && (
        <p role="status" className="photo-comments__note">
          Thanks. Your comment will appear once it is approved.
        </p>
      )}
      <form
        aria-label="Leave a comment"
        className="photo-comments__form"
        onSubmit={(event) => {
          event.preventDefault();
          queue();
        }}
      >
        <label htmlFor={`comment-${photoId}`} className="sr-only">
          Comment
        </label>
        <div className="photo-comments__field">
          <textarea
            id={`comment-${photoId}`}
            ref={box}
            value={body}
            maxLength={COMMENT_MAX_LENGTH}
            rows={1}
            placeholder={COMMENT_PROMPTS[prompt]}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter breaks the line. Never mid-composition, where
              // Enter confirms an accented or Asian character instead.
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing)
                return;
              event.preventDefault();
              queue();
            }}
          />
          <button
            type="submit"
            aria-label="Post comment"
            title="Post comment (Enter)"
            className="photo-comments__send"
            disabled={busy || !body.trim()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 19V5M5 12l7-7 7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="photo-comments__signature">
          {body.length > COUNTER_THRESHOLD && (
            <span className="photo-comments__counter" aria-hidden="true">
              {body.length}/{COMMENT_MAX_LENGTH}
            </span>
          )}
          Commenting as <strong>{publicName}</strong>
          <Link
            href="/account"
            aria-label="Change public name"
            title="Change public name"
            className="photo-comments__edit"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </p>
      </form>
    </div>
  );
}
