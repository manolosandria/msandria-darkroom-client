import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { User } from "@/src/domain/entities/User";
import { SessionPorts, useSession } from "../useSession";

const admin = new User({
  id: "usr_admin",
  email: "manolo@example.com",
  name: "Manolo Sandria",
  role: "ADMIN",
});

const viewer = new User({
  id: "usr_viewer",
  email: "visitante@example.com",
  role: "VIEWER",
});

const ports = (overrides: Partial<SessionPorts> = {}): SessionPorts => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
  signIn: vi.fn().mockResolvedValue(viewer),
  signOut: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("useSession", () => {
  it("asks the API who is signed in and settles with nobody", async () => {
    const { result } = renderHook(() => useSession(ports()));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("exposes the user the API reports", async () => {
    const { result } = renderHook(() =>
      useSession(ports({ getCurrentUser: vi.fn().mockResolvedValue(admin) })),
    );

    await waitFor(() => expect(result.current.user).toBe(admin));
    expect(result.current.user?.isAdmin()).toBe(true);
  });

  it("reports an API it cannot reach", async () => {
    const { result } = renderHook(() =>
      useSession(ports({ getCurrentUser: vi.fn().mockRejectedValue(new Error("boom")) })),
    );

    await waitFor(() => expect(result.current.error).toBe("Could not reach the API"));
    expect(result.current.user).toBeNull();
  });

  describe("signIn", () => {
    it("trades the Google token for a session and keeps the user", async () => {
      const signIn = vi.fn().mockResolvedValue(viewer);
      const { result } = renderHook(() => useSession(ports({ signIn })));
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.signIn("google-token");
      });

      expect(signIn).toHaveBeenCalledWith("google-token");
      expect(result.current.user).toBe(viewer);
      expect(result.current.loading).toBe(false);
    });

    it("reports a sign-in the API refused", async () => {
      const signIn = vi.fn().mockRejectedValue(new Error("boom"));
      const { result } = renderHook(() => useSession(ports({ signIn })));
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.signIn("bad-token");
      });

      expect(result.current.error).toBe("Could not sign in");
      expect(result.current.user).toBeNull();
    });
  });

  describe("signOut", () => {
    it("clears the user once the API has deleted the session", async () => {
      const { result } = renderHook(() =>
        useSession(ports({ getCurrentUser: vi.fn().mockResolvedValue(admin) })),
      );
      await waitFor(() => expect(result.current.user).toBe(admin));

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.user).toBeNull();
    });

    // The session is only really over when the API says so. Showing a signed-out
    // header while the cookie still works would be a lie.
    it("keeps the user signed in when the API could not end the session", async () => {
      const { result } = renderHook(() =>
        useSession(
          ports({
            getCurrentUser: vi.fn().mockResolvedValue(admin),
            signOut: vi.fn().mockRejectedValue(new Error("boom")),
          }),
        ),
      );
      await waitFor(() => expect(result.current.user).toBe(admin));

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.user).toBe(admin);
      expect(result.current.error).toBe("Could not sign out");
    });
  });

  describe("reload", () => {
    it("asks the API again", async () => {
      const getCurrentUser = vi.fn().mockResolvedValue(null);
      const { result } = renderHook(() => useSession(ports({ getCurrentUser })));
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.reload();
      });

      expect(getCurrentUser).toHaveBeenCalledTimes(2);
    });
  });
});

// A consumer that builds the ports inline must not restart the effect on every
// render: that would keep asking the API who we are, forever.
describe("useSession stability", () => {
  it("asks the API once even when the ports object is rebuilt each render", async () => {
    const getCurrentUser = vi.fn().mockResolvedValue(viewer);
    const { result, rerender } = renderHook(() =>
      useSession({
        getCurrentUser,
        signIn: vi.fn().mockResolvedValue(viewer),
        signOut: vi.fn().mockResolvedValue(undefined),
      }),
    );

    await waitFor(() => expect(result.current.user).toBe(viewer));
    rerender();
    rerender();

    expect(getCurrentUser).toHaveBeenCalledTimes(1);
  });
});
