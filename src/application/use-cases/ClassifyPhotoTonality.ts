import { PhotoTonalityRepository } from "../../domain/repositories/PhotoRepository";

/** Classifies a batch of older photographs as colour or black and white. */
export class ClassifyPhotoTonality {
  constructor(private readonly repository: PhotoTonalityRepository) {}
  execute() {
    return this.repository.classifyPendingTonality();
  }
}
