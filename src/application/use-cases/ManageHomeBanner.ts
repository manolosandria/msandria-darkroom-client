import {
  HomeBanner,
  HomeBannerRepository,
} from "../../domain/entities/HomeBanner";
export class ManageHomeBanner {
  constructor(private readonly repository: HomeBannerRepository) {}
  get() {
    return this.repository.get();
  }
  save(banner: HomeBanner) {
    return this.repository.save(banner);
  }
}
