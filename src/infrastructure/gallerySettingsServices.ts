import {
  GallerySettings,
  GallerySettingsRepository,
} from "../domain/entities/GallerySettings";
import { ManageGallerySettings } from "../application/use-cases/ManageGallerySettings";

export class ApiGallerySettingsRepository implements GallerySettingsRepository {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}
  private async request(banner?: GallerySettings): Promise<GallerySettings> {
    if (!this.baseUrl) throw new Error("Gallery settings are not configured.");
    const response = await this.fetchFn(
      `${this.baseUrl.replace(/\/+$/, "")}/gallery/settings`,
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
          ? "The gallery design changed in another session. Your draft is preserved. Reload state to continue."
          : "Could not load or save the gallery design. Please try again.",
      );
    return response.json();
  }
  get() {
    return this.request();
  }
  save(banner: GallerySettings) {
    return this.request(banner);
  }
}
export const manageGallerySettings = new ManageGallerySettings(
  new ApiGallerySettingsRepository(process.env.NEXT_PUBLIC_API_URL),
);
