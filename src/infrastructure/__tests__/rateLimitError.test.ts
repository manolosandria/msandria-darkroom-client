import { describe, expect, it } from "vitest";
import { rateLimitError } from "../rateLimitError";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";

describe("rate limit responses", () => {
  it.each([null, "invalid", "-1", "0", "1.5", "999999999999999999999999"])("ignores an absent or unusable Retry-After value: %s", (header) => {
    const response = new Response(null, { status: 429, headers: header === null ? {} : { "Retry-After": header } });
    const error = rateLimitError(response);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.retryAfterSeconds).toBeUndefined();
  });
  it("keeps the API wait in seconds", () => {
    const error = rateLimitError(new Response(null, { status: 429, headers: { "Retry-After": "42" } }));
    expect(error.retryAfterSeconds).toBe(42);
  });
});
