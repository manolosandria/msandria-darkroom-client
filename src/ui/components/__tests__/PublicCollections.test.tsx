import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PublicCollections from "../PublicCollections";
import { Photo } from "@/src/domain/entities/Photo";

vi.mock("@/src/infrastructure/catalogServices", () => ({
  editCatalog: { load: vi.fn().mockResolvedValue({
    collections: [{ id: "street", title: "Street stories", description: "Life in the city.", coverPhotoId: "cover", categories: [], entries: [{ photoId: "cover", columns: 2, rows: 1 }] }],
    categories: [], works: [], photos: [],
  }) },
}));
vi.mock("@/src/infrastructure/photoServices", () => ({
  getCollectionPhotos: () => ({ execute: async () => [
    new Photo({ id: "cover", title: "A city morning", width: 640, height: 480, renditions: [{ width: 640, url: "https://cdn/cover.jpg" }] }),
  ] }),
}));

it("shows collection covers and opens the selected mosaic with a way back", async () => {
  const user = userEvent.setup();
  render(<PublicCollections />);
  await screen.findByRole("heading", { name: "Street stories", level: 2 });
  expect(screen.getByText("Life in the city.")).toBeInTheDocument();
  await screen.findByRole("img", { name: "A city morning" });
  expect(screen.queryByRole("link", { name: /A city morning/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Street stories/ }));
  expect(screen.getByRole("heading", { level: 1, name: "Street stories" })).toBeInTheDocument();
  expect(await screen.findByRole("link", { name: /A city morning/ })).toHaveAttribute("href", "/photo/cover");
  await user.click(screen.getByRole("button", { name: /All collections/ }));
  expect(screen.getByRole("heading", { name: "Collections", level: 1 })).toBeInTheDocument();
});
