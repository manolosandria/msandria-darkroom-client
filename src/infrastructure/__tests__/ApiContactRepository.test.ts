import { describe, expect, it, vi } from "vitest";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { ApiContactRepository } from "../ApiContactRepository";

const draft = {
  name: "Ana",
  email: "ana@example.com",
  body: "I would like a print of Sunset.",
  consent: true,
};

describe("ApiContactRepository", () => {
  it("sends the message and reaches the inbox with the session", async () => {
    const fetchFn = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ comments: 2, inbox: 1 }))),
      );
    const repository = new ApiContactRepository("https://api.example/", fetchFn);

    await repository.send(draft);
    expect(await repository.notifications()).toEqual({ comments: 2, inbox: 1 });
    await repository.inbox();
    await repository.read("a/b");
    await repository.remove("a/b");

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.example/contact",
      expect.objectContaining({ method: "POST", body: JSON.stringify(draft) }),
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.example/contact/inbox/a%2Fb/read",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.example/contact/inbox/a%2Fb",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(
      fetchFn.mock.calls.every(([, init]) => init.credentials === "include"),
    ).toBe(true);
  });

  it("explains each refusal", async () => {
    const answer = (status: number) =>
      new ApiContactRepository(
        "https://api.example",
        vi.fn().mockResolvedValue(new Response(null, { status })),
      );

    await expect(answer(400).send(draft)).rejects.toThrow(/cannot contain links/);
    await expect(answer(403).inbox()).rejects.toThrow(/administrator/);
    await expect(answer(500).inbox()).rejects.toThrow(/try again/);
    await expect(answer(429).send(draft)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("refuses to send without an API", async () => {
    await expect(new ApiContactRepository(undefined).send(draft)).rejects.toThrow(
      /not configured/,
    );
  });
});
