import { SessionRepository } from "@/src/domain/repositories/SessionRepository";

export class SignIn {
  constructor(private sessionRepository: SessionRepository) {}

  async execute(googleIdToken: string) {
    return this.sessionRepository.signIn(googleIdToken);
  }
}
