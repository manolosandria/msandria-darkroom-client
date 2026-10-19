import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogEditor } from "../ManageCollections";
import { CollectionMosaic } from "../CollectionMosaic";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import { getManagedPhotos } from "@/src/infrastructure/photoServices";
import { Photo } from "@/src/domain/entities/Photo";

vi.mock("@/src/infrastructure/catalogServices", () => ({
  manageCatalog: {
    load: vi.fn(),
    saveCollection: vi.fn(),
    saveCategory: vi.fn(),
    saveWork: vi.fn(),
    setPhotoCategories: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("@/src/infrastructure/photoServices", () => ({
  getManagedPhotos: { execute: vi.fn() },
}));
const photos = ["Color", "Monochrome"].map(
  (title) =>
    new Photo({
      id: title,
      title,
      width: 100,
      height: 100,
      renditions: [{ width: 100, url: `https://cdn/${title}` }],
    }),
);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(manageCatalog.load).mockResolvedValue({
    categories: [{ id: "cat", name: "Street" }],
    collections: [],
    works: [],
    photos: [],
  });
  vi.mocked(getManagedPhotos.execute).mockResolvedValue(photos);
});

describe("collection editor", () => {
  it("keeps the composition after a failed save and retries only on request", async () => {
    vi.mocked(manageCatalog.saveCollection)
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce();
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await user.type(await screen.findByLabelText("Collection title"), "City");
    await user.selectOptions(screen.getByLabelText("Add photo"), "Color");
    await user.selectOptions(screen.getByLabelText("Width"), "2");
    await user.click(screen.getByRole("button", { name: "Save collection" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
    expect(screen.getByLabelText("Collection title")).toHaveValue("City");
    expect(screen.getByLabelText("Width")).toHaveValue("2");
    expect(manageCatalog.saveCollection).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Save collection" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
    expect(manageCatalog.saveCollection).toHaveBeenLastCalledWith(
      {
        title: "City",
        coverPhotoId: null,
        categoryIds: [],
        entries: [{ photoId: "Color", columns: 2, rows: 1 }],
      },
      undefined,
    );
  });

  it("reorders photos and removes only the chosen entry", async () => {
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await user.type(await screen.findByLabelText("Collection title"), "City");
    await user.selectOptions(screen.getByLabelText("Add photo"), "Color");
    await user.selectOptions(screen.getByLabelText("Add photo"), "Monochrome");
    await user.click(screen.getByRole("button", { name: "Move photo 2 up" }));
    await user.click(screen.getByRole("checkbox", { name: "Include photo 2" }));
    await user.click(screen.getByRole("button", { name: "Save collection" }));
    expect(manageCatalog.saveCollection).toHaveBeenCalledWith(
      {
        title: "City",
        coverPhotoId: null,
        categoryIds: [],
        entries: [{ photoId: "Monochrome", columns: 1, rows: 1 }],
      },
      undefined,
    );
  });

  it("switches the displayed variant and its viewer link in one tile", async () => {
    const user = userEvent.setup();
    render(
      <CollectionMosaic
        mosaic
        tiles={[
          {
            key: "work",
            photo: photos[0],
            variants: photos,
            entry: { photoId: "Color", columns: 2, rows: 3 },
          },
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    await user.selectOptions(screen.getByRole("combobox"), "Monochrome");
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/photo/Monochrome",
    );
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Monochrome");
    expect(screen.getByRole("listitem")).toHaveStyle({
      gridColumn: "span 2",
      gridRow: "span 3",
    });
  });
});
