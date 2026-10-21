import { describe, expect, it, vi } from "vitest";
import { assignPhotoVariant } from "../AssignPhotoVariant";
const base = { collections: [], categories: [], photos: [] };
describe("assign photo variant", () => {
  it("extends a freshly read group and does not duplicate an already linked file", async () => {
    const catalog = {
      load: vi
        .fn()
        .mockResolvedValue({
          ...base,
          works: [
            {
              id: "w",
              title: "Moment",
              variants: [{ photoId: "a" }, { photoId: "b" }],
            },
          ],
        }),
      saveWork: vi.fn(),
    };
    await assignPhotoVariant(catalog, "c", "a", "Other");
    expect(catalog.saveWork).toHaveBeenCalledWith(
      { title: "Moment", photoIds: ["a", "b", "c"] },
      "w",
    );
    catalog.saveWork.mockClear();
    await assignPhotoVariant(catalog, "b", "a", "Other");
    expect(catalog.saveWork).not.toHaveBeenCalled();
  });
  it("creates a work for two standalone photographs", async () => {
    const catalog = {
      load: vi.fn().mockResolvedValue({ ...base, works: [] }),
      saveWork: vi.fn(),
    };
    await assignPhotoVariant(catalog, "b", "a", "Moment");
    expect(catalog.saveWork).toHaveBeenCalledWith(
      { title: "Moment", photoIds: ["a", "b"] },
      undefined,
    );
  });
  it("does not silently move an existing member to another work", async () => {
    const catalog = {
      load: vi
        .fn()
        .mockResolvedValue({
          ...base,
          works: [
            {
              id: "w",
              title: "Moment",
              variants: [{ photoId: "a" }, { photoId: "b" }],
            },
          ],
        }),
      saveWork: vi.fn(),
    };
    await expect(
      assignPhotoVariant(catalog, "b", "c", "Other"),
    ).rejects.toThrow("already belongs");
    expect(catalog.saveWork).not.toHaveBeenCalled();
  });
});
