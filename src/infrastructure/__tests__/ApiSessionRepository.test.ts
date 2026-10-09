import { describe, expect, it, vi } from "vitest";
import { ApiSessionRepository } from "../ApiSessionRepository";

const API_URL = "http://api.test";

function apiUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "usr_1",
    email: "manolo@example.com",
    name: "Manolo Sandria",
    role: "ADMIN",
    ...overrides,
  };
}

function respondWith(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const optionsOf = (fetchFn: ReturnType<typeof vi.fn>) =>
  fetchFn.mock.calls[0][1] as RequestInit;

describe("ApiSessionRepository", () => {
  describe("signIn", () => {
    it("trades the Google token for a session and maps the account", async () => {
      const fetchFn = respondWith(apiUser());

      const user = await new ApiSessionRepository(API_URL, fetchFn).signIn("google-token");

      expect(fetchFn.mock.calls[0][0]).toBe("http://api.test/auth/google");
      expect(optionsOf(fetchFn).method).toBe("POST");
      expect(optionsOf(fetchFn).body).toBe(JSON.stringify({ idToken: "google-token" }));
      expect(user.getId()).toBe("usr_1");
      expect(user.isAdmin()).toBe(true);
    });

    // Without this the browser neither sends the session cookie nor accepts the one
    // the API returns, and the whole flow silently does nothing.
    it("asks the browser to carry the session cookie", async () => {
      const fetchFn = respondWith(apiUser());

      await new ApiSessionRepository(API_URL, fetchFn).signIn("google-token");

      expect(optionsOf(fetchFn).credentials).toBe("include");
    });

    it("reports a token the API refused", async () => {
      const fetchFn = respondWith({ message: "Unauthorized" }, 401);

      await expect(
        new ApiSessionRepository(API_URL, fetchFn).signIn("bad-token"),
      ).rejects.toThrow("The API answered 401");
    });

    it("tolerates a trailing slash in the base url", async () => {
      const fetchFn = respondWith(apiUser());

      await new ApiSessionRepository("http://api.test/", fetchFn).signIn("google-token");

      expect(fetchFn.mock.calls[0][0]).toBe("http://api.test/auth/google");
    });

    it("fails clearly when the API url is missing", async () => {
      await expect(
        new ApiSessionRepository(undefined, respondWith(apiUser())).signIn("t"),
      ).rejects.toThrow("NEXT_PUBLIC_API_URL is not set");
    });
  });

  describe("currentUser", () => {
    it("describes whoever the session belongs to", async () => {
      const fetchFn = respondWith(apiUser({ role: "VIEWER" }));

      const user = await new ApiSessionRepository(API_URL, fetchFn).currentUser();

      expect(fetchFn.mock.calls[0][0]).toBe("http://api.test/auth/me");
      expect(optionsOf(fetchFn).method).toBe("GET");
      expect(optionsOf(fetchFn).credentials).toBe("include");
      expect(user?.isAdmin()).toBe(false);
    });

    // Not being signed in is the ordinary case for a visitor, not a failure.
    it("reads a 401 as nobody signed in", async () => {
      const fetchFn = respondWith({ message: "Unauthorized" }, 401);

      await expect(
        new ApiSessionRepository(API_URL, fetchFn).currentUser(),
      ).resolves.toBeNull();
    });

    it("still reports a genuine API failure", async () => {
      const fetchFn = respondWith({ message: "Boom" }, 500);

      await expect(
        new ApiSessionRepository(API_URL, fetchFn).currentUser(),
      ).rejects.toThrow("The API answered 500");
    });

    it("accepts an account Google gave no name for", async () => {
      const fetchFn = respondWith(apiUser({ name: null }));

      const user = await new ApiSessionRepository(API_URL, fetchFn).currentUser();

      expect(user?.getName()).toBeUndefined();
      expect(user?.getDisplayName()).toBe("manolo@example.com");
    });
  });

  describe("signOut", () => {
    it("asks the API to delete the session", async () => {
      const fetchFn = respondWith({ status: "ok" });

      await new ApiSessionRepository(API_URL, fetchFn).signOut();

      expect(fetchFn.mock.calls[0][0]).toBe("http://api.test/auth/logout");
      expect(optionsOf(fetchFn).method).toBe("POST");
      expect(optionsOf(fetchFn).credentials).toBe("include");
    });

    it("reports a sign-out the API could not complete", async () => {
      const fetchFn = respondWith({ message: "Boom" }, 500);

      await expect(
        new ApiSessionRepository(API_URL, fetchFn).signOut(),
      ).rejects.toThrow("The API answered 500");
    });
  });
});
