import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogEditor } from "../ManageCollections";
import { CollectionMosaic } from "../CollectionMosaic";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import { getManagedPhotos } from "@/src/infrastructure/photoServices";
import { Photo } from "@/src/domain/entities/Photo";
import { Catalog } from "@/src/domain/entities/Catalog";
import { CatalogConflictError } from "@/src/domain/errors/CatalogConflictError";

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
const photo = (title: string, visibility?: "PRIVATE") =>
  new Photo({
    id: title,
    title,
    visibility,
    width: 100,
    height: 100,
    renditions: [{ width: 100, url: `https://cdn/${title}` }],
  });
const photos = [photo("Color"), photo("Monochrome")];
const catalog = (collections: Catalog["collections"] = []): Catalog => ({
  categories: [{ id: "cat", name: "Street" }],
  collections,
  works: [],
  photos: [],
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(manageCatalog.saveCollection).mockResolvedValue({ id: "saved", title: "City", version: 2, categories: [], entries: [] });
  vi.mocked(manageCatalog.load).mockResolvedValue(catalog());
  vi.mocked(getManagedPhotos.execute).mockResolvedValue(photos);
});
afterEach(() => {
  Reflect.deleteProperty(document, "elementFromPoint");
});

async function startNewCollection(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", { name: /New collection/ }),
  );
}
async function saveAndAccept(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Save collection" }));
  await user.click(await screen.findByRole("button", { name: "Accept" }));
}

describe("catalog tabs", () => {
  it("keeps a stale draft and offers an explicit reload without retrying the write", async () => {
    vi.mocked(manageCatalog.load).mockResolvedValue(catalog([{ id: "c", version: 4, title: "City", categories: [], entries: [] }]));
    vi.mocked(manageCatalog.saveCollection).mockRejectedValueOnce(new CatalogConflictError());
    const user = userEvent.setup(); render(<CatalogEditor />);
    await user.click(await screen.findByRole("button", { name: /City/ }));
    await user.click(await screen.findByRole("button", { name: "Edit collection" }));
    await user.type(screen.getByLabelText("Collection title"), " at night");
    await saveAndAccept(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Your edits are kept");
    expect(screen.getByLabelText("Collection title")).toHaveValue("City at night");
    expect(manageCatalog.saveCollection).toHaveBeenCalledTimes(1);
    expect(manageCatalog.saveCollection).toHaveBeenCalledWith(expect.objectContaining({ version: 4 }), "c");
    expect(screen.getByRole("button", { name: "Reload state" })).toBeInTheDocument();
  });
  it("shows collection categories separately from the top-level variants panel", async () => {
    const user = userEvent.setup();
    render(<CatalogEditor />);
    expect(
      await screen.findByRole("tab", { name: "Collections" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByLabelText("Category name")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Categories" }));
    expect(screen.getByLabelText("Category name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Work title")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Variants" })).not.toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveClass("studio-card");
  });

  it("keeps an unsaved collection while another tab is open", async () => {
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await startNewCollection(user);
    await user.type(screen.getByLabelText("Collection title"), "Harbour");
    await user.click(screen.getByRole("tab", { name: "Categories" }));
    await user.click(screen.getByRole("tab", { name: "Collections" }));
    expect(screen.getByLabelText("Collection title")).toHaveValue("Harbour");
  });
});

describe("collection browser", () => {
  it("shows a chosen collection's details in the side panel and opens its editor", async () => {
    vi.mocked(manageCatalog.load).mockResolvedValue(
      catalog([
        {
          id: "city",
          title: "City",
          description: "Streets after the rain",
          categories: [{ id: "cat", name: "Street" }],
          entries: [
            { photoId: "Color", columns: 1, rows: 1 },
            { photoId: "Monochrome", columns: 1, rows: 1 },
          ],
        },
      ]),
    );
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await user.click(await screen.findByRole("button", { name: /City/ }));
    const panel = screen.getByRole("complementary", {
      name: "Collection details",
    });
    expect(panel).toHaveTextContent("Streets after the rain");
    expect(within(panel).getByText("Street")).toBeInTheDocument();
    expect(
      within(
        within(panel).getByRole("list", { name: "Photos in the collection" }),
      ).getAllByRole("img"),
    ).toHaveLength(2);
    await user.click(
      within(panel).getByRole("button", { name: "Edit collection" }),
    );
    expect(screen.getByLabelText("Collection title")).toHaveValue("City");
    expect(screen.getByLabelText("Description")).toHaveValue(
      "Streets after the rain",
    );
  });

  it("keeps a draft per collection and saves only the selected collection", async () => {
    vi.mocked(manageCatalog.load).mockResolvedValue(
      catalog([
        { id: "one", title: "One", categories: [], entries: [] },
        { id: "two", title: "Two", categories: [], entries: [] },
      ]),
    );
    const user = userEvent.setup();
    render(<CatalogEditor />);
    const open = async (name: RegExp) => {
      await user.click(await screen.findByRole("button", { name }));
      await user.click(screen.getByRole("button", { name: "Edit collection" }));
    };
    await open(/One/);
    await user.type(screen.getByLabelText("Collection title"), " edited");
    await user.click(screen.getByRole("button", { name: "← All collections" }));
    await open(/Two/);
    await user.type(screen.getByLabelText("Collection title"), " pending");
    await user.click(screen.getByRole("button", { name: "← All collections" }));
    await open(/One/);
    expect(screen.getByLabelText("Collection title")).toHaveValue("One edited");
    await saveAndAccept(user);
    await screen.findByText("Saved.");
    expect(manageCatalog.saveCollection).toHaveBeenCalledTimes(1);
    expect(manageCatalog.saveCollection).toHaveBeenCalledWith(
      expect.objectContaining({ title: "One edited" }),
      "one",
    );
    await user.click(screen.getByRole("button", { name: "← All collections" }));
    await open(/Two/);
    expect(screen.getByLabelText("Collection title")).toHaveValue(
      "Two pending",
    );
    await user.click(screen.getByRole("button", { name: "Cancel changes" }));
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Collection title")).toHaveValue("Two");
    // Many typed edits across three editors: slow when the whole suite runs at once.
  }, 15000);
});

describe("collection editor", () => {
  it("refreshes privacy changed in another window without losing collection edits", async () => {
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await startNewCollection(user);
    await user.type(screen.getByLabelText("Collection title"), "Pending");
    await user.click(screen.getByRole("button", { name: "Add Color" }));
    vi.mocked(getManagedPhotos.execute).mockResolvedValue([
      photo("Color", "PRIVATE"),
      photos[1],
    ]);
    act(() => {
      window.dispatchEvent(new Event("curator:catalog-changed"));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "will not appear in the public collection",
    );
    await user.click(
      screen.getByRole("button", { name: "← Collection details" }),
    );
    expect(screen.getByLabelText("Collection title")).toHaveValue("Pending");
  });

  it("frames a private photo and warns above the composition", async () => {
    vi.mocked(getManagedPhotos.execute).mockResolvedValue([
      photo("Private coast", "PRIVATE"),
    ]);
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await startNewCollection(user);
    await user.click(screen.getByRole("button", { name: "Add Private coast" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Private coast");
    const canvas = screen.getByRole("list", { name: "Collection composition" });
    expect(
      alert.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen
        .getByRole("region", { name: "Add photos" })
        .compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const tile = within(canvas).getByRole("listitem");
    expect(tile).toHaveClass("studio-tile--private");
    expect(within(tile).getByText("!")).toBeInTheDocument();
  });

  it("keeps the composition after a failed save and retries only on request", async () => {
    vi.mocked(manageCatalog.saveCollection)
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce({ id: "new", title: "City", version: 2, categories: [], entries: [] });
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await startNewCollection(user);
    await user.type(screen.getByLabelText("Collection title"), "City");
    await user.type(screen.getByLabelText("Description"), "  At night ");
    await user.click(screen.getByRole("button", { name: "Add Color" }));
    await user.selectOptions(screen.getByLabelText("Width"), "2");
    await saveAndAccept(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
    expect(screen.getByLabelText("Width")).toHaveValue("2");
    expect(manageCatalog.saveCollection).toHaveBeenCalledTimes(1);
    await saveAndAccept(user);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Collection created.",
    );
    expect(manageCatalog.saveCollection).toHaveBeenLastCalledWith(
      {
        title: "City",
        description: "At night",
        coverPhotoId: null,
        categoryIds: [],
        entries: [{ photoId: "Color", columns: 2, rows: 1, showTitle: true }],
      },
      undefined,
    );
  });

  it("reorders, hides a title, picks the cover and removes from the side panel", async () => {
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await startNewCollection(user);
    await user.type(screen.getByLabelText("Collection title"), "City");
    await user.click(screen.getByRole("button", { name: "Add Color" }));
    await user.click(screen.getByRole("button", { name: "Add Monochrome" }));
    await user.click(screen.getByRole("button", { name: "← Move earlier" }));
    expect(
      screen.getByRole("button", { name: "Photo 1: Monochrome" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("checkbox", { name: "Show title in the collection" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Use as collection cover" }),
    );
    expect(screen.getByText("★ Cover")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Photo 2: Color" }));
    expect(
      screen.getByRole("complementary", { name: "Photo details" }),
    ).toHaveTextContent("Photo 2 of 2");
    await user.click(
      screen.getByRole("button", { name: "Remove from collection" }),
    );
    expect(
      screen.getAllByText("Will be removed when you save").length,
    ).toBeGreaterThan(0);
    await saveAndAccept(user);
    expect(manageCatalog.saveCollection).toHaveBeenCalledWith(
      {
        title: "City",
        description: "",
        coverPhotoId: "Monochrome",
        categoryIds: [],
        entries: [
          { photoId: "Monochrome", columns: 1, rows: 1, showTitle: false },
        ],
      },
      undefined,
    );
  });

  it("filters the photos to add by title and category and hides those already added", async () => {
    vi.mocked(manageCatalog.load).mockResolvedValue({
      ...catalog(),
      photos: [{ id: "Monochrome", categories: [{ id: "cat" }] }],
    });
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await startNewCollection(user);
    const picker = screen.getByRole("region", { name: "Add photos" });
    await user.type(within(picker).getByRole("searchbox"), "colo");
    expect(within(picker).getAllByRole("button", { name: /^Add / })).toHaveLength(1);
    await user.clear(within(picker).getByRole("searchbox"));
    await user.selectOptions(within(picker).getByLabelText("Category"), "cat");
    expect(
      within(picker).getByRole("button", { name: "Add Monochrome" }),
    ).toBeInTheDocument();
    expect(
      within(picker).queryByRole("button", { name: "Add Color" }),
    ).not.toBeInTheDocument();
    await user.click(within(picker).getByRole("button", { name: "Add Monochrome" }));
    expect(within(picker).getByText("No photos match these filters.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Photo 1: Monochrome" }),
    ).toBeInTheDocument();
  });

  it("reorders by dragging a photo onto another one", async () => {
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await startNewCollection(user);
    await user.click(screen.getByRole("button", { name: "Add Color" }));
    await user.click(screen.getByRole("button", { name: "Add Monochrome" }));
    await user.click(screen.getByRole("button", { name: "Photo 1: Color" }));
    const dragged = screen.getByRole("button", { name: "Photo 2: Monochrome" });
    const target = screen
      .getByRole("button", { name: "Photo 1: Color" })
      .closest("li")!;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => target,
    });
    fireEvent.pointerDown(dragged, { button: 0, clientX: 200, clientY: 10 });
    fireEvent.pointerMove(dragged, { clientX: 20, clientY: 10 });
    fireEvent.pointerUp(dragged);
    fireEvent.click(dragged);
    expect(
      screen.getByRole("button", { name: "Photo 1: Monochrome" }),
    ).toBeInTheDocument();
    // The click that ends a drag does not select the dragged photo.
    expect(
      screen.getByRole("complementary", { name: "Photo details" }),
    ).toHaveTextContent("Color");
  });

  it("resizes a photo by dragging its corner", async () => {
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await startNewCollection(user);
    await user.click(screen.getByRole("button", { name: "Add Color" }));
    const tile = screen
      .getByRole("button", { name: "Photo 1: Color" })
      .closest("li")!;
    const corner = tile.querySelector(".studio-handle--corner")!;
    fireEvent.pointerDown(corner, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(corner, { clientX: 2, clientY: 1 });
    fireEvent.pointerUp(corner);
    expect(tile).toHaveStyle({ gridColumn: "span 3", gridRow: "span 2" });
    expect(screen.getByLabelText("Width")).toHaveValue("3");
    expect(screen.getByLabelText("Height")).toHaveValue("2");
  });
});

describe("collection mosaic", () => {
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

  it("leaves out the caption of a photo whose title is hidden", () => {
    render(
      <CollectionMosaic
        mosaic
        tiles={[
          {
            key: "a",
            photo: photos[0],
            variants: [photos[0]],
            entry: { photoId: "Color", columns: 1, rows: 1, showTitle: false },
          },
          {
            key: "b",
            photo: photos[1],
            variants: [photos[1]],
            entry: { photoId: "Monochrome", columns: 1, rows: 1 },
          },
        ]}
      />,
    );
    expect(screen.queryByText("Color")).not.toBeInTheDocument();
    expect(screen.getByText("Monochrome")).toBeInTheDocument();
  });
});

it("opens an existing work from its cover in the standalone variants panel", async () => {
  vi.mocked(manageCatalog.load).mockResolvedValue({ ...catalog(), works: [{ id: "w", title: "Two expressions", variants: [{ photoId: "Color" }, { photoId: "Monochrome" }] }] });
  render(<CatalogEditor variants />);
  await userEvent.click(await screen.findByRole("button", { name: /Two expressions/ }));
  expect(screen.getByLabelText("Work title")).toHaveValue("Two expressions");
  expect(screen.getAllByRole("checkbox").filter(input => (input as HTMLInputElement).checked)).toHaveLength(2);
  expect(screen.queryByRole("tab", { name: "Variants" })).not.toBeInTheDocument();
});
