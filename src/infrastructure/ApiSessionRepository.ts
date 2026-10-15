import { AccountDeletionError } from "../domain/errors/AccountDeletionError";
import { AccountRepository, AccountDeletionPreview } from "../domain/repositories/AccountRepository";
import { rateLimitError } from "./rateLimitError";
import { User, UserRole } from "../domain/entities/User";
import { SessionRepository } from "../domain/repositories/SessionRepository";

// What the API answers about an account. There is no token here on purpose: the
// session travels in an HttpOnly cookie that this code cannot read, which is what
// keeps a cross-site script from stealing it.
type ApiUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
};

export class ApiSessionRepository implements SessionRepository, AccountRepository {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  async signIn(googleIdToken: string): Promise<User> {
    const response = await this.send("POST", "/auth/google", {
      idToken: googleIdToken,
    });
    return this.toDomainUser((await this.ensureOk(response).json()) as ApiUser);
  }

  // A 401 is the ordinary answer for a visitor who has not signed in, so it means
  // "nobody" rather than a failure worth reporting.
  async currentUser(): Promise<User | null> {
    const response = await this.send("GET", "/auth/me");
    if (response.status === 401) return null;
    return this.toDomainUser((await this.ensureOk(response).json()) as ApiUser);
  }

  async signOut(): Promise<void> {
    this.ensureOk(await this.send("POST", "/auth/logout"));
  }

  async deletionPreview(): Promise<AccountDeletionPreview> {
    return (await this.ensureOk(await this.send("GET", "/auth/me/deletion-preview")).json()) as AccountDeletionPreview;
  }

  async deleteAccount(confirmLastAdmin: boolean): Promise<void> {
    const response = await this.send("DELETE", "/auth/me", { confirmLastAdmin });
    if (response.status === 409) {
      const body = await response.json() as { code?: string };
      throw new AccountDeletionError(body.code === "LAST_ADMIN_CONFIRMATION_REQUIRED" ? "lastAdmin" : "changed");
    }
    this.ensureOk(response);
  }

  // `credentials: "include"` is what makes the browser attach the session cookie to
  // a cross-origin call and accept the one that comes back. Without it the API would
  // never see the session, and the API has to answer with
  // `Access-Control-Allow-Credentials` for the browser to let this code read the reply.
  private send(method: string, path: string, body?: unknown) {
    if (!this.baseUrl) {
      throw new Error("NEXT_PUBLIC_API_URL is not set: the gallery cannot reach the API.");
    }
    return this.fetchFn(`${this.baseUrl.replace(/\/+$/, "")}${path}`, {
      method,
      credentials: "include",
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  }

  private ensureOk(response: Response) {
    if (response.status === 429) throw rateLimitError(response);
    if (!response.ok) {
      throw new Error(`The API answered ${response.status} ${response.statusText}`.trim());
    }
    return response;
  }

  private toDomainUser(entry: ApiUser): User {
    return new User({
      id: entry.id,
      email: entry.email,
      name: entry.name ?? undefined,
      role: entry.role,
    });
  }
}
