import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UploadReview } from "../UploadReview";
import type { UploadItem } from "../UploadPanel";

vi.mock("../ClassificationCatalog", () => ({
  ClassificationCatalogBoundary: ({ children }: { children: React.ReactNode }) => children,
  useClassificationCatalog: () => ({ catalog: { collections: [{ id: "lake", title: "Night walks" }] } }),
}));

const item: UploadItem = {
  id: 1, file: new File(["x"], "lake.jpg", { type: "image/jpeg" }),
  preview: "blob:lake", title: "Night on the lake", description: "Moonlight at the pier.",
  classification: { visibility: "COLLECTIONS_ONLY", categoryNames: ["night", "water"], collections: [{ id: "lake", position: 3 }] },
  frame: { color: "#f2efe6", leftRight: 4, topBottom: 6 },
  trim: { x: 0.1, y: 0.05, width: 0.8, height: 0.9 },
  highlights: {
    square: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
    custom: [{ id: "pier", name: "The pier", crop: { x: 0, y: 0, width: 0.5, height: 0.5 }, shape: "portrait" }],
    presentation: { gallery: ["square", "custom:pier"], home: [] },
  },
  status: "draft", variantTargetId: "original",
};

describe("Upload review", () => {
  it("summarizes the actual metadata, appearance, highlights and named destinations", async () => {
    const onEdit = vi.fn();
    render(<UploadReview item={item} forPost={false} onEdit={onEdit} />);
    const review = screen.getByRole("region", { name: "Upload summary" });
    for (const text of ["Night on the lake", "Moonlight at the pier.", "#F2EFE6", "top/bottom 6%", "left 10%", "The pier", "Not offered", "night, water", "Night walks · position 3", "Only in collections"]) {
      expect(review).toHaveTextContent(text);
    }
    await userEvent.click(within(review).getByRole("button", { name: "Edit appearance" }));
    expect(onEdit).toHaveBeenCalledWith(1);
    await userEvent.click(within(review).getByRole("button", { name: "Edit highlights & display" }));
    expect(onEdit).toHaveBeenCalledWith(2);
  });
  it("reviews the post destination with the same privacy as the prepared file", () => {
    render(<UploadReview item={{ ...item, classification: { visibility: "POSTS_ONLY", categoryNames: [], collections: [] } }} forPost onEdit={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Upload summary" })).toHaveTextContent("Only in posts");
    expect(screen.queryByText("Categories", { exact: true })).toBeNull();
  });
});
