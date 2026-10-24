import {
  HomeBanner,
  HomeBannerRepository,
} from "../domain/entities/HomeBanner";
import { ManageHomeBanner } from "../application/use-cases/ManageHomeBanner";

export class ApiHomeBannerRepository implements HomeBannerRepository {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}
  private async request(banner?: HomeBanner): Promise<HomeBanner> {
    if (!this.baseUrl) throw new Error("Home settings are not configured.");
    const response = await this.fetchFn(
      `${this.baseUrl.replace(/\/+$/, "")}/home/banner`,
      {
        method: banner ? "PUT" : "GET",
        credentials: "include",
        cache: "no-store",
        ...(banner
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(banner),
            }
          : {}),
      },
    );
    if (!response.ok)
      throw new Error(
        response.status === 409
          ? "The banner changed in another session. Your draft is preserved. Reload state to continue."
          : "Could not load or save the banner. Please try again.",
      );
    return response.json();
  }
  get() {
    return this.request();
  }
  save(banner: HomeBanner) {
    return this.request(banner);
  }
}
export const manageHomeBanner = new ManageHomeBanner(
  new ApiHomeBannerRepository(process.env.NEXT_PUBLIC_API_URL),
);
