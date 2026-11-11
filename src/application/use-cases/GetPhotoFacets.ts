import { PhotoFacetsRepository } from "../../domain/repositories/PhotoBrowseRepository";

export class GetPhotoFacets {
  constructor(private readonly repository: PhotoFacetsRepository) {}
  execute() {
    return this.repository.facets();
  }
}
