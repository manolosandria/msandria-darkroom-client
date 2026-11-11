import { User } from "./../entities/User";

export interface SessionRepository {
  // Trades a Google ID token for a session. The session itself never reaches this
  // code: it lives in an HttpOnly cookie the browser keeps out of JavaScript's reach.
  signIn(googleIdToken: string): Promise<User>;
  // Asks for a one-time sign-in code by email. The answer is the same whether or not
  // the address has an account, so nothing here tells who is registered.
  requestEmailCode(email: string): Promise<void>;
  // Trades the emailed code for a session, as signIn does with Google's token.
  signInWithEmailCode(email: string, code: string): Promise<User>;
  // The signed-in user, or null when there is no live session.
  currentUser(): Promise<User | null>;
  signOut(): Promise<void>;
}
