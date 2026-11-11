import {
  ContactSettings,
  ContactSettingsRepository,
} from "@/src/domain/entities/ContactSettings";
export class ManageContactSettings {
  constructor(private readonly repository: ContactSettingsRepository) {}
  get() {
    return this.repository.get();
  }
  save(settings: ContactSettings) {
    return this.repository.save(settings);
  }
}
