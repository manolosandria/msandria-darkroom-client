import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
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
  it("refreshes photo visibility without replacing a collection draft", async () => {
    render(<CatalogEditor />);
    await userEvent.type(await screen.findByLabelText("Collection title"), "Unsaved collection");
    await userEvent.selectOptions(screen.getByLabelText("Add photo"), "Color");
    const privatePhoto = new Photo({ id: "Color", title: "Color", visibility: "PRIVATE", width: 100, height: 100, renditions: [{ width: 100, url: "https://cdn/Color" }] });
    vi.mocked(getManagedPhotos.execute).mockResolvedValue([privatePhoto, photos[1]]);
    act(() => { window.dispatchEvent(new Event("curator:catalog-changed")); });
    expect(await screen.findByRole("alert")).toHaveTextContent("will not appear in the public collection");
    expect(screen.getByLabelText("Collection title")).toHaveValue("Unsaved collection");
    expect(screen.getByRole("checkbox", { name: "Include photo 1" })).toBeChecked();
  });
  it("warns when an included photo is private", async () => {
    vi.mocked(getManagedPhotos.execute).mockResolvedValue([
      new Photo({
        id: "hidden",
        title: "Private coast",
        visibility: "PRIVATE",
        width: 100,
        height: 100,
        renditions: [{ width: 100, url: "https://cdn/private" }],
      }),
    ]);
    render(<CatalogEditor />);
    await userEvent.selectOptions(
      await screen.findByLabelText("Add photo"),
      "hidden",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "will not appear in the public collection",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Private coast");
  });
  it("keeps a draft per collection and saves only the selected collection", async () => {
    vi.mocked(manageCatalog.load).mockResolvedValue({
      categories: [],
      works: [],
      photos: [],
      collections: [
        { id: "one", title: "One", categories: [], entries: [] },
        { id: "two", title: "Two", categories: [], entries: [] },
      ],
    });
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await user.selectOptions(
      await screen.findByLabelText("Edit collection"),
      "one",
    );
    await user.type(screen.getByLabelText("Collection title"), " edited");
    await user.selectOptions(screen.getByLabelText("Edit collection"), "two");
    await user.type(screen.getByLabelText("Collection title"), " pending");
    await user.selectOptions(screen.getByLabelText("Edit collection"), "one");
    expect(screen.getByLabelText("Collection title")).toHaveValue("One edited");
    await user.click(screen.getByRole("button", { name: "Save collection" }));
    await user.click(await screen.findByRole("button", { name: "Accept" }));
    await screen.findByText("Saved.");
    expect(manageCatalog.saveCollection).toHaveBeenCalledTimes(1);
    expect(manageCatalog.saveCollection).toHaveBeenCalledWith(
      expect.objectContaining({ title: "One edited" }),
      "one",
    );
    await user.selectOptions(screen.getByLabelText("Edit collection"), "two");
    expect(screen.getByLabelText("Collection title")).toHaveValue(
      "Two pending",
    );
    await user.click(screen.getByRole("button", { name: "Cancel changes" }));
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Collection title")).toHaveValue("Two");
  });
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
    await user.click(await screen.findByRole("button", { name: "Accept" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
    expect(screen.getByLabelText("Collection title")).toHaveValue("City");
    expect(screen.getByLabelText("Width")).toHaveValue("2");
    expect(manageCatalog.saveCollection).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Save collection" }));
    await user.click(await screen.findByRole("button", { name: "Accept" }));
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
    await user.click(await screen.findByRole("button", { name: "Accept" }));
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
