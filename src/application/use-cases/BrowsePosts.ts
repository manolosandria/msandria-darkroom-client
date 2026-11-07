import { PostReaction } from "../../domain/entities/Post";
import {
  PostPageQuery,
  PostRepository,
} from "../../domain/repositories/PostRepository";

// What any visitor does with posts: read the pages, open one, like and save.
export class BrowsePosts {
  constructor(private readonly repository: PostRepository) {}
  page(query: PostPageQuery) {
    return this.repository.list(query);
  }
  findById(id: string) {
    return this.repository.findById(id);
  }
  react(id: string, kind: PostReaction, on: boolean) {
    return this.repository.react(id, kind, on);
  }
  saved(page?: number) {
    return this.repository.saved(page);
  }
}
