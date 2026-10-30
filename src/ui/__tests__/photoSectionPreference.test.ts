import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readHiddenSections,
  resetHiddenSectionsForTests,
  writeHiddenSections,
} from "../photoSectionPreference";

const KNOWN = ["details", "frame", "file"];

afterEach(() => {
  resetHiddenSectionsForTests();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("photoSectionPreference", () => {
  it("remembers hidden sections and ignores ones that no longer exist", () => {
    writeHiddenSections(["file", "gone"]);
    resetHiddenSectionsForTests();
    expect(readHiddenSections(KNOWN)).toEqual(["file"]);
  });

  it("starts with every section shown when nothing or nonsense was stored", () => {
    expect(readHiddenSections(KNOWN)).toEqual([]);
    window.localStorage.setItem("photoInspectorHiddenSections", "{}");
    expect(readHiddenSections(KNOWN)).toEqual([]);
    window.localStorage.setItem("photoInspectorHiddenSections", "not json");
    expect(readHiddenSections(KNOWN)).toEqual([]);
  });

  it("keeps the choice in memory when storage refuses it", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readHiddenSections(KNOWN)).toEqual([]);
    writeHiddenSections(["frame"]);
    expect(readHiddenSections(KNOWN)).toEqual(["frame"]);
  });
});
