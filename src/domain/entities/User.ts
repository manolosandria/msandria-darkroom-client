// Who the visitor is, as the API reports it. The role travels so the interface can
// decide what to offer; it never decides what is allowed, which the API settles on
// every request by reading the role from its own database.
export type UserRole = "VIEWER" | "ADMIN";

export type UserParams = {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
};

export class User {
  private readonly id: string;
  private readonly email: string;
  private readonly name?: string;
  private readonly role: UserRole;

  constructor(params: UserParams) {
    this.id = params.id;
    this.email = params.email.trim();
    this.name = params.name?.trim() || undefined;
    this.role = params.role;
    this.validate();
  }

  private validate() {
    if (!this.id) throw new Error("User ID is required.");
    if (!this.email) throw new Error("User email is required.");
    if (this.role !== "VIEWER" && this.role !== "ADMIN") {
      throw new Error(`Unknown user role: ${String(this.role)}`);
    }
  }

  getId() {
    return this.id;
  }
  getEmail() {
    return this.email;
  }
  getName() {
    return this.name;
  }
  getRole() {
    return this.role;
  }

  // Only decides what the interface shows. The API enforces it independently.
  isAdmin() {
    return this.role === "ADMIN";
  }

  // The name when Google gave one, the email otherwise: something to greet with.
  getDisplayName() {
    return this.name ?? this.email;
  }
}
