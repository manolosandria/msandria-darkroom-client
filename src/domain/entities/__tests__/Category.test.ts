import { describe, expect, it } from "vitest";
import { Category } from "../Category";

describe("Category", () => {
  it("trims the given name", () => {
    expect(() => new Category("  Nature  ")).not.toThrow();
  });

  it("rejects a blank name", () => {
    expect(() => new Category("   ")).toThrow("Category name is required.");
  });
});
