import { CommentRepository } from "@/src/domain/repositories/CommentRepository";
export class ApproveComment {
  constructor(private repository: Pick<CommentRepository, "approve">) {}
  execute(commentId: string) {
    return this.repository.approve(commentId);
  }
}
