import { CommentRepository } from "@/src/domain/repositories/CommentRepository";
export class GetPendingComments {
  constructor(private repository: Pick<CommentRepository, "pending">) {}
  execute() {
    return this.repository.pending();
  }
}
