"use client";

import { useEffect, useState } from "react";
import {
  PhotoReactions as Counts,
  Reaction,
} from "@/src/domain/entities/Profile";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { manageProfile } from "@/src/infrastructure/profileServices";
import { rateLimitMessage } from "@/src/ui/rateLimitMessage";
import { useSessionValue } from "./SessionProvider";
import "./profiles.css";

export type ReactionPorts = Pick<typeof manageProfile, "reactions" | "react">;

/**
 * Like and save a photo. The like count is public; whether the visitor liked or saved
 * it only shows to them. Saved photos are the favorites of their profile. Signed out,
 * the buttons say what signing in would offer.
 */
export function PhotoReactions({
  photoId,
  ports = manageProfile,
}: {
  photoId: string;
  ports?: ReactionPorts;
}) {
  const { user } = useSessionValue();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const userId = user?.getId();

  useEffect(() => {
    let live = true;
    ports
      .reactions(photoId)
      .then((next) => live && setCounts(next))
      .catch(() => live && setCounts(null));
    return () => {
      live = false;
    };
  }, [photoId, ports, userId]);

  const toggle = async (kind: Reaction, on: boolean) => {
    setBusy(true);
    setError("");
    try {
      setCounts(await ports.react(photoId, kind, on));
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
  if (!counts) return null;
  const signedOut = !user;
  return (
    <div className="photo-reactions" role="group" aria-label="Reactions">
      <button
        type="button"
        aria-pressed={counts.liked}
        disabled={busy || signedOut}
        title={signedOut ? "Sign in to like photographs" : undefined}
        onClick={() => toggle("like", !counts.liked)}
      >
        <span aria-hidden="true">{counts.liked ? "♥" : "♡"}</span>
        Like
        <span aria-label={`${counts.likes} likes`}>{counts.likes}</span>
      </button>
      <button
        type="button"
        aria-pressed={counts.favorited}
        disabled={busy || signedOut}
        title={signedOut ? "Sign in to save favorites" : undefined}
        onClick={() => toggle("favorite", !counts.favorited)}
      >
        <span aria-hidden="true">{counts.favorited ? "★" : "☆"}</span>
        {counts.favorited ? "Saved" : "Save"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
