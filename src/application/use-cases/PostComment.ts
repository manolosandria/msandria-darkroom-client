import { CommentRepository } from "@/src/domain/repositories/CommentRepository";
export class PostComment {
  constructor(private repository: Pick<CommentRepository, "create">) {}
  execute(photoId: string, body: string) {
    return this.repository.create(photoId, body.trim());
  }
}
