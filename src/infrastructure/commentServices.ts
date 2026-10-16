import { ApproveComment } from "../application/use-cases/ApproveComment";
import { DeleteComment } from "../application/use-cases/DeleteComment";
import { GetPendingComments } from "../application/use-cases/GetPendingComments";
import { GetPhotoComments } from "../application/use-cases/GetPhotoComments";
import { PostComment } from "../application/use-cases/PostComment";
import { ApiCommentRepository } from "./ApiCommentRepository";

const commentRepository = new ApiCommentRepository(process.env.NEXT_PUBLIC_API_URL);

export const getPhotoComments = new GetPhotoComments(commentRepository);
export const postComment = new PostComment(commentRepository);
export const getPendingComments = new GetPendingComments(commentRepository);
export const approveComment = new ApproveComment(commentRepository);
export const deleteComment = new DeleteComment(commentRepository);
