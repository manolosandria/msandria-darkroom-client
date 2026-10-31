import { SessionRepository } from "@/src/domain/repositories/SessionRepository";

/** Asks the API to email a sign-in link, and trades that link for a session. */
export class SignInByEmail {
  constructor(private sessionRepository: SessionRepository) {}

  request(email: string) {
    return this.sessionRepository.requestEmailLink(email);
  }

  verify(token: string) {
    return this.sessionRepository.signInWithEmailLink(token);
  }
}
