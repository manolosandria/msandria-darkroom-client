import { User } from "./../entities/User";

export interface SessionRepository {
  // Trades a Google ID token for a session. The session itself never reaches this
  // code: it lives in an HttpOnly cookie the browser keeps out of JavaScript's reach.
  signIn(googleIdToken: string): Promise<User>;
  // The signed-in user, or null when there is no live session.
  currentUser(): Promise<User | null>;
  signOut(): Promise<void>;
}
