import { CommentRepository } from "@/src/domain/repositories/CommentRepository";
export class DeleteComment {
  constructor(private repository: Pick<CommentRepository, "remove">) {}
  execute(commentId: string) {
    return this.repository.remove(commentId);
  }
}
