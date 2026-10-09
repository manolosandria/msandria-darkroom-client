import { describe, expect, it } from "vitest";
import { User, UserParams } from "../User";

const params = (overrides: Partial<UserParams> = {}): UserParams => ({
  id: "usr_1",
  email: "manolo@example.com",
  name: "Manolo Sandria",
  role: "VIEWER",
  ...overrides,
});

describe("User", () => {
  it("keeps the identity the API reported", () => {
    const user = new User(params());

    expect(user.getId()).toBe("usr_1");
    expect(user.getEmail()).toBe("manolo@example.com");
    expect(user.getName()).toBe("Manolo Sandria");
    expect(user.getRole()).toBe("VIEWER");
  });

  it("trims the email and the name", () => {
    const user = new User(params({ email: "  manolo@example.com  ", name: "  Manolo  " }));

    expect(user.getEmail()).toBe("manolo@example.com");
    expect(user.getName()).toBe("Manolo");
  });

  it("treats a blank name as no name at all", () => {
    expect(new User(params({ name: "   " })).getName()).toBeUndefined();
  });

  it("accepts an account Google gave no name for", () => {
    expect(new User(params({ name: undefined })).getName()).toBeUndefined();
  });

  it("requires an id", () => {
    expect(() => new User(params({ id: "" }))).toThrow("User ID is required.");
  });

  it("requires an email", () => {
    expect(() => new User(params({ email: "  " }))).toThrow("User email is required.");
  });

  it("rejects a role it does not know", () => {
    expect(() => new User(params({ role: "SUPERADMIN" as UserParams["role"] }))).toThrow(
      "Unknown user role: SUPERADMIN",
    );
  });

  describe("isAdmin", () => {
    it("is true for the administrator", () => {
      expect(new User(params({ role: "ADMIN" })).isAdmin()).toBe(true);
    });

    it("is false for a registered visitor", () => {
      expect(new User(params({ role: "VIEWER" })).isAdmin()).toBe(false);
    });
  });

  describe("getDisplayName", () => {
    it("greets by name when there is one", () => {
      expect(new User(params()).getDisplayName()).toBe("Manolo Sandria");
    });

    it("falls back to the email", () => {
      expect(new User(params({ name: undefined })).getDisplayName()).toBe(
        "manolo@example.com",
      );
    });
  });
});
