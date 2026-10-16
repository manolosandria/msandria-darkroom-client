"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PendingComment } from "@/src/domain/entities/PhotoComment";
import {
  approveComment,
  deleteComment,
  getPendingComments,
} from "@/src/infrastructure/commentServices";
import {
  DELETED_AUTHOR,
  commentFailureMessage,
  formatCommentDate,
} from "@/src/ui/commentMessages";
import { ErrorMessage } from "./ErrorMessage";
import { useSessionValue } from "./SessionProvider";

export default function CommentModeration() {
  const session = useSessionValue();
  return (
    <main className="upload-workspace">
      <div className="upload-container">
        <div className="upload-heading">
          <span className="upload-eyebrow">THE DARKROOM / MODERATE</span>
          <h1>Review comments.</h1>
          <p>Nothing visitors write appears until you approve it. Deleting rejects it.</p>
        </div>
        <Link href="/upload" className="upload-link">
          ← Upload photos
        </Link>
        {session.loading ? (
          <p role="status">Loading session…</p>
        ) : session.error ? (
          <ErrorMessage message={session.error} onRetry={session.reload} />
        ) : session.user?.isAdmin() ? (
          <ModerationQueue />
        ) : (
          <p>Sign in as the gallery&apos;s administrator to review comments.</p>
        )}
      </div>
    </main>
  );
}

type QueueState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; comments: PendingComment[] };

function ModerationQueue() {
  const [state, setState] = useState<QueueState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", comments: await getPendingComments.execute() });
    } catch {
      setState({ status: "failed" });
    }
  }, []);

  useEffect(() => {
    // Deferred to a microtask so the initial setState doesn't run
    // synchronously inside the effect body (react-hooks/set-state-in-effect).
    queueMicrotask(load);
  }, [load]);

  if (state.status === "loading") return <p role="status">Loading comments…</p>;
  if (state.status === "failed")
    return <ErrorMessage message="Could not load the pending comments." onRetry={load} />;
  if (state.comments.length === 0)
    return <p className="my-6">No comments are waiting for review.</p>;

  const settle = (id: string) =>
    setState({
      status: "ready",
      comments: state.comments.filter((comment) => comment.id !== id),
    });

  return (
    <ol className="my-6 flex max-w-3xl flex-col gap-4">
      {state.comments.map((comment) => (
        <PendingItem key={comment.id} comment={comment} onSettled={() => settle(comment.id)} />
      ))}
    </ol>
  );
}

function PendingItem({ comment, onSettled }: { comment: PendingComment; onSettled: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      onSettled();
    } catch (failure) {
      setError(commentFailureMessage(failure));
      setBusy(false);
    }
  };

  return (
    <li className="upload-card p-5 space-y-3">
      <p className="text-xs text-gray-600">
        <span className="font-semibold text-gray-900">{comment.authorName ?? DELETED_AUTHOR}</span>{" "}
        on{" "}
        <Link href={`/photo/${encodeURIComponent(comment.photo.id)}`} className="upload-link">
          {comment.photo.title}
        </Link>{" "}
        · {formatCommentDate(comment.createdAt)}
      </p>
      <p className="whitespace-pre-line break-words text-sm leading-relaxed">{comment.body}</p>
      {error && (
        <p role="alert" className="upload-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="upload-primary"
          disabled={busy}
          onClick={() => act(() => approveComment.execute(comment.id))}
        >
          Approve
        </button>
        <button
          type="button"
          className="upload-secondary"
          disabled={busy}
          onClick={() => act(() => deleteComment.execute(comment.id))}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
