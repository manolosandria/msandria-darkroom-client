import { describe, expect, it, vi } from "vitest";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { ApiContactRepository } from "../ApiContactRepository";

const draft = {
  name: "Ana",
  email: "ana@example.com",
  body: "I would like a print of Sunset.",
  consent: true,
  website: "",
};

const answering = (body: unknown) =>
  vi
    .fn()
    .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body))));

describe("ApiContactRepository", () => {
  it("sends the message and says whether it waits for a code", async () => {
    const pending = { status: "pending", verificationId: "p1", expiresAt: "x" };
    const fetchFn = answering(pending);
    const repository = new ApiContactRepository("https://api.example/", fetchFn);

    await expect(repository.send(draft)).resolves.toEqual(pending);
    await repository.confirm("p1", "012345");

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.example/contact",
      expect.objectContaining({ method: "POST", body: JSON.stringify(draft) }),
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.example/contact/verify",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ verificationId: "p1", code: "012345" }),
      }),
    );
  });

  it("reaches the inbox and its blocked senders with the session", async () => {
    const fetchFn = answering({ comments: 2, inbox: 1 });
    const repository = new ApiContactRepository("https://api.example", fetchFn);

    expect(await repository.notifications()).toEqual({ comments: 2, inbox: 1 });
    await repository.inbox();
    await repository.read("a/b");
    await repository.remove("a/b");
    await repository.block("a/b");
    await repository.blocked();
    await repository.unblock("b/1");

    for (const [url, method] of [
      ["https://api.example/contact/inbox/a%2Fb/read", "PATCH"],
      ["https://api.example/contact/inbox/a%2Fb", "DELETE"],
      ["https://api.example/contact/inbox/a%2Fb/block", "POST"],
      ["https://api.example/contact/blocked", "GET"],
      ["https://api.example/contact/blocked/b%2F1", "DELETE"],
    ])
      expect(fetchFn).toHaveBeenCalledWith(url, expect.objectContaining({ method }));
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
    await expect(answer(400).confirm("p1", "000000")).rejects.toThrow(
      /wrong or has expired/,
    );
    await expect(answer(503).send(draft)).rejects.toThrow(/Sign in to send/);
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
