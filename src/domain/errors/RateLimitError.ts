export class RateLimitError extends Error {
  constructor(readonly retryAfterSeconds?: number) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
  }
}
