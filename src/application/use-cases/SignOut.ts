import { SessionRepository } from "@/src/domain/repositories/SessionRepository";

export class SignOut {
  constructor(private sessionRepository: SessionRepository) {}

  async execute() {
    return this.sessionRepository.signOut();
  }
}
