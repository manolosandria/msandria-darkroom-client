import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { describe, expect, it } from "vitest";
import { PhotoUploadError } from "@/src/domain/repositories/PhotoRepository";
import { apiFailureMessage } from "../apiFailureMessage";

describe("apiFailureMessage", () => {
  it("explains the rate limit and wait without treating it as an outage", () => {
    expect(apiFailureMessage(new RateLimitError(42))).toBe("Too many attempts. Try again in 42 seconds.");
    expect(apiFailureMessage(new RateLimitError())).toBe("Too many attempts. Please wait before trying again.");
  });

  // Each refusal is turned into something the photographer can act on.
  it.each([
    ["unauthenticated", "The session ended. Sign in again to publish."],
    ["forbidden", "This account is not allowed to publish photos."],
    [
      "tooLarge",
      "That file is too large for the API. Export it smaller and try again.",
    ],
    ["unreachable", "Could not reach the API"],
  ])("explains a %s refusal", (failure, message) => {
    const refusal = new PhotoUploadError(
      failure as PhotoUploadError["failure"],
      "whatever the API said",
    );

    expect(apiFailureMessage(refusal)).toBe(message);
  });

  // A rejection is the only refusal the API explains in words worth repeating.
  it("repeats the reason a rejection gives", () => {
    const rejection = new PhotoUploadError(
      "rejected",
      "title should not be empty",
    );

    expect(apiFailureMessage(rejection)).toBe(
      "The API rejected the photo: title should not be empty",
    );
  });

  it("falls back to a reachability message for a failure it does not know", () => {
    expect(apiFailureMessage(new TypeError("Failed to fetch"))).toBe(
      "Could not reach the API",
    );
  });
});
