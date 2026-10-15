import { RateLimitError } from "@/src/domain/errors/RateLimitError";

export function rateLimitMessage(failure: RateLimitError): string {
  return failure.retryAfterSeconds
    ? `Too many attempts. Try again in ${failure.retryAfterSeconds} seconds.`
    : "Too many attempts. Please wait before trying again.";
}
