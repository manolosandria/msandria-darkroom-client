import { useCallback, useEffect, useState } from "react";
import { User } from "@/src/domain/entities/User";

export type SessionState = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: SessionState = { user: null, loading: true, error: null };

export type SessionPorts = {
  getCurrentUser: () => Promise<User | null>;
  signIn: (googleIdToken: string) => Promise<User>;
  signOut: () => Promise<void>;
};

export function useSession(ports: SessionPorts) {
  // Held from the first render on. Taking the ports fresh each render would make
  // every callback a new identity, re-running the effect below for as long as the
  // component lives: an inline object would hammer the API forever.
  const [{ getCurrentUser, signIn, signOut }] = useState(() => ports);
  const [state, setState] = useState<SessionState>(INITIAL_STATE);

  // Asking the API who we are is the only way to know: the session cookie is
  // HttpOnly, so this code cannot look at it.
  const load = useCallback(async () => {
    setState({ user: null, loading: true, error: null });
    try {
      setState({ user: await getCurrentUser(), loading: false, error: null });
    } catch {
      setState({ user: null, loading: false, error: "Could not reach the API" });
    }
  }, [getCurrentUser]);

  useEffect(() => {
    // Deferred to a microtask so the initial setState doesn't run
    // synchronously inside the effect body (react-hooks/set-state-in-effect).
    queueMicrotask(load);
  }, [load]);

  const startSession = useCallback(
    async (googleIdToken: string) => {
      setState({ user: null, loading: true, error: null });
      try {
        setState({ user: await signIn(googleIdToken), loading: false, error: null });
      } catch {
        setState({ user: null, loading: false, error: "Could not sign in" });
      }
    },
    [signIn],
  );

  // The session ends on the API, which deletes its row; clearing the user here only
  // catches the interface up. If that call fails the session is still live, so the
  // user stays signed in rather than being shown a logged-out screen that lies.
  const endSession = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      await signOut();
      setState({ user: null, loading: false, error: null });
    } catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Could not sign out",
      }));
    }
  }, [signOut]);

  return { ...state, signIn: startSession, signOut: endSession, reload: load };
}
