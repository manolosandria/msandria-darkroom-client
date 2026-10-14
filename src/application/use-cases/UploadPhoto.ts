import {
  PhotoDraft,
  PhotoRepository,
  PublishedPhoto,
} from "@/src/domain/repositories/PhotoRepository";

export class UploadPhoto {
  constructor(private photoRepository: PhotoRepository) {}

  async execute(draft: PhotoDraft): Promise<PublishedPhoto> {
    return this.photoRepository.upload(draft);
  }
}
