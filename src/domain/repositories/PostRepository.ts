import {
  Post,
  PostDraft,
  PostPage,
  PostReaction,
  PostReactions,
} from "../entities/Post";

export type PostPageQuery = { page?: number; limit?: number; tag?: string };

export interface PostRepository {
  list(query: PostPageQuery): Promise<PostPage>;
  // Null when the post does not exist or the visitor may not see it.
  findById(id: string): Promise<Post | null>;
  react(id: string, kind: PostReaction, on: boolean): Promise<PostReactions>;
  saved(page?: number): Promise<PostPage>;
  // Administrator only: drafts and scheduled posts included.
  manage(): Promise<Post[]>;
  create(draft: PostDraft): Promise<Post>;
  update(id: string, draft: PostDraft, version: number): Promise<Post>;
  remove(id: string): Promise<void>;
}
