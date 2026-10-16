import { CommentError, CommentFailure } from "@/src/domain/errors/CommentError";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { rateLimitMessage } from "./rateLimitMessage";

// The API never words its refusals for visitors; these are the words.
const FAILURE_MESSAGES: Record<CommentFailure, string> = {
  unauthenticated: "Your session ended. Sign in again to comment.",
  forbidden: "You can only delete your own comments.",
  notFound: "That comment or photo no longer exists.",
  publicNameRequired: "Choose a public name in your account before commenting.",
  rejected:
    "Comments can be up to 1000 characters and cannot include links or hidden characters.",
};

export function commentFailureMessage(failure: unknown): string {
  if (failure instanceof RateLimitError) return rateLimitMessage(failure);
  if (failure instanceof CommentError) return FAILURE_MESSAGES[failure.failure];
  return "Could not reach the API";
}

// Shown in the project's time zone, like capture dates, so every visitor reads the same
// day.
export function formatCommentDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/Mexico_City",
  });
}

// What a deleted account leaves behind: the text, without its name.
export const DELETED_AUTHOR = "Deleted user";
