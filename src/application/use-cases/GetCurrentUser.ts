import { SessionRepository } from "@/src/domain/repositories/SessionRepository";

export class GetCurrentUser {
  constructor(private sessionRepository: SessionRepository) {}

  async execute() {
    return this.sessionRepository.currentUser();
  }
}
