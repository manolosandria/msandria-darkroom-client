import {
  ContactDraft,
  ContactRepository,
  CuratorDashboard,
  CuratorNotifications,
  InboxMessage,
} from "../domain/repositories/ContactRepository";
import { rateLimitError } from "./rateLimitError";
export class ApiContactRepository implements ContactRepository {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}
  async send(draft: ContactDraft) {
    await this.request("POST", "/contact", draft);
  }
  async inbox(): Promise<InboxMessage[]> {
    return (await this.request("GET", "/contact/inbox")).json();
  }
  async notifications(): Promise<CuratorNotifications> {
    return (await this.request("GET", "/curator/notifications")).json();
  }
  async dashboard(): Promise<CuratorDashboard> {
    return (await this.request("GET", "/curator/dashboard")).json();
  }
  async read(id: string) {
    await this.request(
      "PATCH",
      `/contact/inbox/${encodeURIComponent(id)}/read`,
    );
  }
  async remove(id: string) {
    await this.request("DELETE", `/contact/inbox/${encodeURIComponent(id)}`);
  }
  private async request(method: string, path: string, body?: ContactDraft) {
    if (!this.baseUrl) throw new Error("Contact is not configured yet.");
    const response = await this.fetchFn(
      `${this.baseUrl.replace(/\/+$/, "")}${path}`,
      {
        method,
        credentials: "include",
        cache: "no-store",
        ...(body
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
      },
    );
    if (response.status === 429) throw rateLimitError(response);
    if (!response.ok)
      throw new Error(
        response.status === 400
          ? "Check your name, email and message. Messages must be 10–3000 characters and cannot contain links."
          : response.status === 401 || response.status === 403
            ? "Sign in as the administrator to open the inbox."
            : "The request could not be completed. Please try again.",
      );
    return response;
  }
}
