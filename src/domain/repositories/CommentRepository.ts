import { PendingComment, PhotoComment } from "../entities/PhotoComment";

export interface CommentRepository {
  // Approved comments, plus the visitor's own pending ones when signed in.
  listForPhoto(photoId: string): Promise<PhotoComment[]>;
  create(photoId: string, body: string): Promise<PhotoComment>;
  pending(): Promise<PendingComment[]>;
  approve(commentId: string): Promise<void>;
  // Deleting is also how the administrator rejects a comment.
  remove(commentId: string): Promise<void>;
}
