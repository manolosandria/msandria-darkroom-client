import { describe, expect, it, vi } from "vitest";
import { ApiSessionRepository } from "../ApiSessionRepository";
import { EmailSignInError } from "../../domain/errors/EmailSignInError";

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
  describe("account deletion", () => {
    it("loads the current user's last administrator warning with credentials", async () => {
      const fetchFn = respondWith({ isLastAdmin: true });
      await expect(new ApiSessionRepository(API_URL, fetchFn).deletionPreview()).resolves.toEqual({ isLastAdmin: true });
      expect(fetchFn).toHaveBeenCalledWith(`${API_URL}/auth/me/deletion-preview`, { method: "GET", credentials: "include" });
    });
    it("deletes only the current account with an explicit boolean acknowledgement", async () => {
      const fetchFn = respondWith({ status: "deleted" });
      await new ApiSessionRepository(API_URL, fetchFn).deleteAccount(true);
      expect(fetchFn).toHaveBeenCalledWith(`${API_URL}/auth/me`, { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmLastAdmin: true }) });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
    it.each([["LAST_ADMIN_CONFIRMATION_REQUIRED", "lastAdmin"], ["ACCOUNT_DELETION_CHANGED", "changed"]])("maps %s to a confirmation requirement without retry", async (code, reason) => {
      const fetchFn = respondWith({ code }, 409);
      await expect(new ApiSessionRepository(API_URL, fetchFn).deleteAccount(false)).rejects.toMatchObject({ reason });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
    it.each([401, 500])("reports a deletion failure (%i)", async (status) => {
      const fetchFn = respondWith({}, status);
      await expect(new ApiSessionRepository(API_URL, fetchFn).deleteAccount(false)).rejects.toThrow(`The API answered ${status}`);
    });
  });

  describe("signIn", () => {
    it("reports throttling without retrying a Google token", async () => {
      const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 429, headers: { "Retry-After": "42" } }));
      await expect(new ApiSessionRepository(API_URL, fetchFn).signIn("token")).rejects.toMatchObject({ name: "RateLimitError", retryAfterSeconds: 42 });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

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

  describe("public name", () => {
    const publicName = {
      style: "ALIAS",
      alias: "Slow Lens",
      choices: { FULL_NAME: "Manolo Sandria", ALIAS: "Slow Lens" },
      current: "Slow Lens",
    };

    it("keeps the public name the API reports with the account", async () => {
      const fetchFn = respondWith(apiUser({ publicName }));
      const user = await new ApiSessionRepository(API_URL, fetchFn).currentUser();
      expect(user?.getPublicName()).toEqual(publicName);
    });

    it("sends only the style and alias, and returns the updated account", async () => {
      const fetchFn = respondWith(apiUser({ publicName }));
      const user = await new ApiSessionRepository(API_URL, fetchFn).updatePublicName("ALIAS", "Slow Lens");
      expect(fetchFn).toHaveBeenCalledWith(`${API_URL}/auth/me/public-name`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: "ALIAS", alias: "Slow Lens" }),
      });
      expect(user.getPublicName()?.current).toBe("Slow Lens");
    });

    it("leaves the alias out when it should stay as stored", async () => {
      const fetchFn = respondWith(apiUser({ publicName }));
      await new ApiSessionRepository(API_URL, fetchFn).updatePublicName("FULL_NAME");
      expect(optionsOf(fetchFn).body).toBe(JSON.stringify({ style: "FULL_NAME" }));
    });

    it("reports a rejected alias", async () => {
      const fetchFn = respondWith({ code: "ALIAS_REQUIRED" }, 400);
      await expect(
        new ApiSessionRepository(API_URL, fetchFn).updatePublicName("ALIAS", null),
      ).rejects.toMatchObject({ name: "PublicNameError" });
    });
  });
  describe("email sign-in", () => {
    it("asks for a link with the address only", async () => {
      const fetchFn = respondWith({}, 202);
      await new ApiSessionRepository(API_URL, fetchFn).requestEmailLink("ana@example.com");
      expect(fetchFn).toHaveBeenCalledWith(`${API_URL}/auth/email`, expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "ana@example.com" }),
      }));
    });

    it.each([
      [400, "invalidEmail"],
      [503, "unavailable"],
    ])("names a %i refusal of the request", async (status, reason) => {
      await expect(
        new ApiSessionRepository(API_URL, respondWith({}, status)).requestEmailLink("x"),
      ).rejects.toEqual(new EmailSignInError(reason as "invalidEmail"));
    });

    it("trades the token for the signed-in user, or says the link is spent", async () => {
      const fetchFn = respondWith(apiUser({ role: "VIEWER" }));
      const user = await new ApiSessionRepository(API_URL, fetchFn).signInWithEmailLink("tok");
      expect(user.getEmail()).toBe("manolo@example.com");
      expect(optionsOf(fetchFn).body).toBe(JSON.stringify({ token: "tok" }));
      await expect(
        new ApiSessionRepository(API_URL, respondWith({}, 400)).signInWithEmailLink("old"),
      ).rejects.toMatchObject({ reason: "invalidLink" });
    });
  });
});
