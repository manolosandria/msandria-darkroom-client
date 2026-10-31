import { ProfileChanges, Reaction } from "../../domain/entities/Profile";
import { ProfileRepository } from "../../domain/repositories/ProfileRepository";

export class ManageProfile {
  constructor(private readonly repository: ProfileRepository) {}
  mine() {
    return this.repository.mine();
  }
  update(changes: ProfileChanges) {
    return this.repository.update(changes);
  }
  profile(id: string) {
    return this.repository.profile(id);
  }
  reactions(photoId: string) {
    return this.repository.reactions(photoId);
  }
  react(photoId: string, kind: Reaction, on: boolean) {
    return this.repository.react(photoId, kind, on);
  }
}
