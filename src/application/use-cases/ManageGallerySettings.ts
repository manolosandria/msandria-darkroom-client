import {
  GallerySettings,
  GallerySettingsRepository,
} from "../../domain/entities/GallerySettings";
export class ManageGallerySettings {
  constructor(private readonly repository: GallerySettingsRepository) {}
  get() {
    return this.repository.get();
  }
  save(banner: GallerySettings) {
    return this.repository.save(banner);
  }
}
