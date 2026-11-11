import {
  ContactSettings,
  ContactSettingsRepository,
} from "../domain/entities/ContactSettings";
import { ManageContactSettings } from "../application/use-cases/ManageContactSettings";

export class ApiContactSettingsRepository implements ContactSettingsRepository {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}
  private async request(settings?: ContactSettings): Promise<ContactSettings> {
    if (!this.baseUrl) throw new Error("Contact settings are not configured.");
    const response = await this.fetchFn(
      `${this.baseUrl.replace(/\/+$/, "")}/contact/settings`,
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
          ? "The contact settings changed in another session. Your draft is preserved. Reload state to continue."
          : "Could not load or save the contact settings. Please try again.",
      );
    return response.json();
  }
  get() {
    return this.request();
  }
  save(settings: ContactSettings) {
    return this.request(settings);
  }
}
export const manageContactSettings = new ManageContactSettings(
  new ApiContactSettingsRepository(process.env.NEXT_PUBLIC_API_URL),
);
