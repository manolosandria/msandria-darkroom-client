import { describe, expect, it } from "vitest";
import { Photo } from "../Photo";

const photo = (fields: Partial<ConstructorParameters<typeof Photo>[0]>) =>
  new Photo({
    id: "p",
    title: "P",
    width: 10,
    height: 10,
    renditions: [{ width: 10, url: "https://cdn/p.jpg" }],
    ...fields,
  });

describe("Photo variant corner", () => {
  it("follows the title to the other end of its edge without a corner of its own", () => {
    expect(photo({}).getVariantCorner()).toBe("BOTTOM_RIGHT");
    expect(photo({ titlePosition: "BOTTOM_RIGHT" }).getVariantCorner()).toBe("BOTTOM_LEFT");
    expect(photo({ titlePosition: "TOP_LEFT" }).getVariantCorner()).toBe("TOP_RIGHT");
    expect(photo({ titlePosition: "TOP_RIGHT" }).getVariantCorner()).toBe("TOP_LEFT");
  });

  it("keeps a chosen corner, but never the title's", () => {
    const chosen = photo({ titlePosition: "TOP_LEFT", variantPosition: "BOTTOM_LEFT" });
    expect(chosen.getVariantPosition()).toBe("BOTTOM_LEFT");
    expect(chosen.getVariantCorner()).toBe("BOTTOM_LEFT");
    const clash = photo({ titlePosition: "TOP_LEFT", variantPosition: "TOP_LEFT" });
    expect(clash.getVariantPosition()).toBeNull();
    expect(clash.getVariantCorner()).toBe("TOP_RIGHT");
  });
});
