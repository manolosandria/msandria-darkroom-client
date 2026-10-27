import {
  PhotoBrowseRepository,
  PhotoPageQuery,
} from "../../domain/repositories/PhotoBrowseRepository";

export class BrowsePhotos {
  constructor(private readonly repository: PhotoBrowseRepository) {}
  execute(query: PhotoPageQuery, signal?: AbortSignal) {
    return this.repository.browse(query, signal);
  }
}
