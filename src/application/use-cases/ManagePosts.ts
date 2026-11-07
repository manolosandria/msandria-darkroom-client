import { PostDraft } from "../../domain/entities/Post";
import { PostRepository } from "../../domain/repositories/PostRepository";

// The administrator's side: every post, drafts included, and the writes.
export class ManagePosts {
  constructor(private readonly repository: PostRepository) {}
  all() {
    return this.repository.manage();
  }
  create(draft: PostDraft) {
    return this.repository.create(draft);
  }
  update(id: string, draft: PostDraft, version: number) {
    return this.repository.update(id, draft, version);
  }
  remove(id: string) {
    return this.repository.remove(id);
  }
}
