import { CommentRepository } from "@/src/domain/repositories/CommentRepository";
export class GetPhotoComments {
  constructor(private repository: Pick<CommentRepository, "listForPhoto">) {}
  execute(photoId: string) {
    return this.repository.listForPhoto(photoId);
  }
}
