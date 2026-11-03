import {
  SiteSettings,
  SiteSettingsRepository,
} from "../../domain/entities/SiteSettings";
export class ManageSiteSettings {
  constructor(private readonly repository: SiteSettingsRepository) {}
  get() {
    return this.repository.get();
  }
  save(settings: SiteSettings) {
    return this.repository.save(settings);
  }
}
