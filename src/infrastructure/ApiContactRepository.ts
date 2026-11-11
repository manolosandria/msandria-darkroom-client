import {
  BlockedSender,
  ContactDraft,
  ContactRepository,
  ContactSubmission,
  CuratorDashboard,
  CuratorNotifications,
  InboxMessage,
} from "../domain/repositories/ContactRepository";
import { rateLimitError } from "./rateLimitError";

// What each refusal means, by route: a 400 on the code is a wrong code, on the form
// a field the API would not take.
const refusal = (path: string, status: number) =>
  path === "/contact/verify" && status === 400
    ? "That code is wrong or has expired. Check it, or send the message again for a new one."
    : status === 400
      ? "Check your name, email and message. Messages must be 10–3000 characters and cannot contain links."
      : status === 401 || status === 403
        ? "Sign in as the administrator to open the inbox."
        : status === 503
          ? "Confirming messages by email is not available right now. Sign in to send your message."
          : "The request could not be completed. Please try again.";

export class ApiContactRepository implements ContactRepository {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}
  async send(draft: ContactDraft): Promise<ContactSubmission> {
    return (await this.request("POST", "/contact", draft)).json();
  }
  async confirm(verificationId: string, code: string) {
    await this.request("POST", "/contact/verify", { verificationId, code });
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
  async block(messageId: string) {
    await this.request(
      "POST",
      `/contact/inbox/${encodeURIComponent(messageId)}/block`,
    );
  }
  async blocked(): Promise<BlockedSender[]> {
    return (await this.request("GET", "/contact/blocked")).json();
  }
  async unblock(id: string) {
    await this.request("DELETE", `/contact/blocked/${encodeURIComponent(id)}`);
  }
  private async request(method: string, path: string, body?: object) {
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
    if (!response.ok) throw new Error(refusal(path, response.status));
    return response;
  }
}
