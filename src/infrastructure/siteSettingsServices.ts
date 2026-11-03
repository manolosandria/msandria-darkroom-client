import {
  SiteSettings,
  SiteSettingsRepository,
} from "../domain/entities/SiteSettings";
import { ManageSiteSettings } from "../application/use-cases/ManageSiteSettings";

export class ApiSiteSettingsRepository implements SiteSettingsRepository {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}
  private async request(settings?: SiteSettings): Promise<SiteSettings> {
    if (!this.baseUrl) throw new Error("Site settings are not configured.");
    const response = await this.fetchFn(
      `${this.baseUrl.replace(/\/+$/, "")}/site/settings`,
      {
        method: settings ? "PUT" : "GET",
        credentials: "include",
        cache: "no-store",
        ...(settings
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(settings),
            }
          : {}),
      },
    );
    if (!response.ok)
      throw new Error(
        response.status === 409
          ? "The site settings changed in another session. Your draft is preserved. Reload state to continue."
          : "Could not load or save the site settings. Please try again.",
      );
    return response.json();
  }
  get() {
    return this.request();
  }
  save(settings: SiteSettings) {
    return this.request(settings);
  }
}
export const manageSiteSettings = new ManageSiteSettings(
  new ApiSiteSettingsRepository(process.env.NEXT_PUBLIC_API_URL),
);
