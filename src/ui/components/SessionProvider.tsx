"use client";

import { createContext, useContext } from "react";
import {
  getCurrentUser,
  signIn,
  signOut,
} from "@/src/infrastructure/sessionServices";
import { SessionPorts, useSession } from "@/src/ui/hooks/useSession";

type Session = ReturnType<typeof useSession>;

const SessionContext = createContext<Session | null>(null);

const defaultPorts: SessionPorts = {
  getCurrentUser: () => getCurrentUser.execute(),
  signIn: (idToken: string) => signIn.execute(idToken),
  signOut: () => signOut.execute(),
};

type Props = {
  children: React.ReactNode;
  // Replaced in tests so the tree runs without an API.
  ports?: SessionPorts;
};

// One session for the whole page. Every component that asks the API who is signed in
// would otherwise do so on its own: the header, the upload page and each admin panel
// would each spend a round trip learning the same thing, and could disagree about it
// while the answers were in flight.
export function SessionProvider({ children, ports = defaultPorts }: Props) {
  const session = useSession(ports);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSessionValue(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useSessionValue must be used inside a SessionProvider.");
  }
  return session;
}
