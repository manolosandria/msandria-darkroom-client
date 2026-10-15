import { RateLimitError } from "../domain/errors/RateLimitError";

export function rateLimitError(response: Response): RateLimitError {
  const value = response.headers.get("Retry-After");
  const seconds = value !== null && /^\d+$/.test(value) ? Number(value) : NaN;
  return new RateLimitError(
    Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined,
  );
}
