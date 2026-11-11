import { SessionRepository } from "@/src/domain/repositories/SessionRepository";

/** Asks the API to email a one-time sign-in code, and trades that code for a session. */
export class SignInByEmail {
  constructor(private sessionRepository: SessionRepository) {}

  request(email: string) {
    return this.sessionRepository.requestEmailCode(email);
  }

  verify(email: string, code: string) {
    return this.sessionRepository.signInWithEmailCode(email, code);
  }
}
