import {
  PhotoUploadError,
  PhotoUploadFailure,
} from "@/src/domain/repositories/PhotoRepository";

// Every refusal the API can give, in words worth reading. The vocabulary was written
// for publishing and serves a save just as well: both go through the same routes and
// are turned down for the same reasons.
const FAILURE_MESSAGES: Record<PhotoUploadFailure, string> = {
  unauthenticated: "The session ended. Sign in again to publish.",
  forbidden: "This account is not allowed to publish photos.",
  tooLarge: "That file is too large for the API. Export it smaller and try again.",
  rejected: "The API rejected the photo",
  unreachable: "Could not reach the API",
};

// Anything that is not one of the API's own refusals never reached it, so it reads as
// a reachability problem rather than leaking a stack trace onto the screen.
export function apiFailureMessage(failure: unknown): string {
  if (failure instanceof PhotoUploadError) {
    // A rejection is the only refusal the API explains in words worth repeating.
    return failure.failure === "rejected"
      ? `${FAILURE_MESSAGES.rejected}: ${failure.message}`
      : FAILURE_MESSAGES[failure.failure];
  }
  return FAILURE_MESSAGES.unreachable;
}
