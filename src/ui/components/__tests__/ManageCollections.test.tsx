import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogEditor } from "../ManageCollections";
import { CollectionMosaic } from "../CollectionMosaic";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import { getManagedPhotos, uploadPhoto } from "@/src/infrastructure/photoServices";
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
  uploadPhoto: { execute: vi.fn() },
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
    await user.selectOptions(
      screen.getByLabelText("Width on wide screens"),
      "4",
    );
    await saveAndAccept(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
    expect(screen.getByLabelText("Width on wide screens")).toHaveValue("4");
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
        showVariants: false,
        categoryIds: [],
        entries: [
          {
            photoId: "Color",
            columns: 4,
            rows: 2,
            mobileColumns: null,
            mobileRows: null,
            showTitle: true,
            caption: null,
          },
        ],
        texts: [],
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
        showVariants: false,
        categoryIds: [],
        entries: [
          {
            photoId: "Monochrome",
            columns: 2,
            rows: 2,
            mobileColumns: null,
            mobileRows: null,
            showTitle: false,
            caption: null,
          },
        ],
        texts: [],
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
    // New photos start 2×2 on the eight-column grid.
    expect(tile).toHaveStyle({ "--span-columns": "4", "--span-rows": "3" });
    expect(screen.getByLabelText("Width on wide screens")).toHaveValue("4");
    expect(screen.getByLabelText("Height on wide screens")).toHaveValue("3");
  });

  it("gives a piece its own phone size when resized in the phone layout", async () => {
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await startNewCollection(user);
    await user.click(screen.getByRole("button", { name: "Add Color" }));
    expect(
      screen.getByRole("checkbox", { name: "Own size on phones" }),
    ).not.toBeChecked();
    expect(screen.getByLabelText("Width on phones")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Phones/ }));
    expect(
      screen.getByRole("list", { name: "Collection composition on phones" }),
    ).toBeInTheDocument();
    const tile = screen
      .getByRole("button", { name: "Photo 1: Color" })
      .closest("li")!;
    const corner = tile.querySelector(".studio-handle--corner")!;
    fireEvent.pointerDown(corner, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(corner, { clientX: 9, clientY: 0 });
    fireEvent.pointerUp(corner);
    // Clamped to the four phone columns; the wide size is untouched.
    expect(tile).toHaveStyle({
      "--span-columns": "2",
      "--span-mobile-columns": "4",
      "--span-mobile-rows": "2",
    });
    expect(
      screen.getByRole("checkbox", { name: "Own size on phones" }),
    ).toBeChecked();
    await user.click(
      screen.getByRole("checkbox", { name: "Own size on phones" }),
    );
    expect(tile).toHaveStyle({ "--span-mobile-columns": "2" });
  });

  it("adds text blocks between photos and text attached to a photo", async () => {
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await startNewCollection(user);
    await user.type(screen.getByLabelText("Collection title"), "City");
    await user.click(screen.getByRole("button", { name: "Add Color" }));
    await user.type(
      screen.getByLabelText(/Text with the photo/),
      "Taken at dawn",
    );
    expect(
      screen.getByRole("button", {
        name: "Photo 1: Color, with text: Taken at dawn",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Add text block/ }));
    await saveAndAccept(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Write something in every text block",
    );
    expect(manageCatalog.saveCollection).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Text"), "Night falls");
    await user.click(screen.getByRole("button", { name: /Heading/ }));
    await user.click(screen.getByRole("button", { name: "Center" }));
    await user.click(screen.getByRole("button", { name: "← Move earlier" }));
    expect(
      screen.getByRole("button", { name: "Text block: Night falls" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add Monochrome" }));
    await saveAndAccept(user);
    expect(manageCatalog.saveCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: [
          expect.objectContaining({
            photoId: "Color",
            caption: "Taken at dawn",
          }),
          expect.objectContaining({ photoId: "Monochrome" }),
        ],
        texts: [
          {
            position: 0,
            text: "Night falls",
            style: "HEADING",
            align: "CENTER",
            columns: 4,
            rows: 1,
            mobileColumns: null,
            mobileRows: null,
          },
        ],
      }),
      undefined,
    );
  }, 20000);

  it("removes a text block from the side panel", async () => {
    const user = userEvent.setup();
    render(<CatalogEditor />);
    await startNewCollection(user);
    await user.click(screen.getByRole("button", { name: /Add text block/ }));
    expect(
      screen.getByRole("button", { name: "Text block: empty" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove text block" }));
    expect(
      screen.queryByRole("button", { name: /Text block/ }),
    ).not.toBeInTheDocument();
  });
});

describe("collection mosaic", () => {
  it("switches the displayed variant and its viewer link in one tile", async () => {
    const user = userEvent.setup();
    render(
      <CollectionMosaic
        mosaic
        variants
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
    await user.click(screen.getByRole("radio", { name: "Monochrome" }));
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/photo/Monochrome",
    );
    expect(within(screen.getByRole("link")).getByRole("img")).toHaveAttribute(
      "alt",
      "Monochrome",
    );
    expect(screen.getByRole("listitem")).toHaveStyle({
      "--span-columns": "2",
      "--span-rows": "3",
      "--span-mobile-columns": "2",
      "--span-mobile-rows": "3",
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

it("adds a library photo to a new work and uploads dropped files with the work's visibility", async () => {
  vi.mocked(getManagedPhotos.execute).mockResolvedValue([photo("Color", "PRIVATE"), photo("Monochrome")]);
  const uploaded = photo("Infrared");
  vi.mocked(uploadPhoto.execute).mockResolvedValue({ photo: uploaded, optimizationIssues: [] });
  vi.mocked(manageCatalog.saveWork).mockResolvedValue({ id: "w", title: "Night", version: 1, variants: [] });
  render(<CatalogEditor variants />);
  const library = await screen.findByRole("region", { name: "Photo library" });
  await userEvent.click(within(library).getAllByRole("checkbox")[0]);
  const zone = screen.getByRole("group", { name: "Variants of this work" });
  expect(within(zone).getByText("Color")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save variants" })).toBeDisabled();
  await userEvent.upload(
    screen.getByLabelText("Upload files…"),
    new File(["image"], "night_infrared.jpg", { type: "image/jpeg" }),
  );
  expect(await within(zone).findByText("Infrared")).toBeInTheDocument();
  expect(uploadPhoto.execute).toHaveBeenCalledWith(
    expect.objectContaining({ title: "night infrared", visibility: "PRIVATE" }),
  );
  expect(screen.getByLabelText("Work title")).toHaveValue("Infrared");
  await userEvent.click(screen.getByRole("button", { name: "Save variants" }));
  await waitFor(() =>
    expect(manageCatalog.saveWork).toHaveBeenCalledWith(
      { title: "Infrared", photoIds: ["Color", "Infrared"] },
      undefined,
    ),
  );
});

it("adds a photo dragged from the library and refuses files that are not images", async () => {
  render(<CatalogEditor variants />);
  const zone = await screen.findByRole("group", { name: "Variants of this work" });
  const data = new Map<string, string>([["application/x-darkroom-photo", "Monochrome"]]);
  fireEvent.drop(zone, { dataTransfer: { getData: (type: string) => data.get(type) ?? "", files: [] } });
  expect(within(zone).getByText("Monochrome")).toBeInTheDocument();
  fireEvent.drop(zone, {
    dataTransfer: { getData: () => "", files: [new File(["x"], "notes.txt", { type: "text/plain" })] },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("Drop JPEG, PNG or WebP images.");
  expect(uploadPhoto.execute).not.toHaveBeenCalled();
});

it("offers variants in a public mosaic only when the collection allows it", () => {
  const tiles = [{ key: "work", photo: photos[0], variants: photos }];
  const { rerender } = render(<CollectionMosaic mosaic tiles={tiles} />);
  expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  rerender(<CollectionMosaic mosaic variants tiles={tiles} />);
  expect(
    screen.getByRole("radiogroup", { name: "Variants of Color" }),
  ).toBeInTheDocument();
});

describe("collection mosaic with text", () => {
  it("places text blocks before the photo they precede, in their style", () => {
    render(
      <CollectionMosaic
        mosaic
        tiles={[
          {
            key: "a",
            photo: photos[0],
            variants: [photos[0]],
            entry: { photoId: "Color", columns: 2, rows: 2, position: 0 },
          },
          {
            key: "b",
            photo: photos[1],
            variants: [photos[1]],
            entry: { photoId: "Monochrome", columns: 2, rows: 2, position: 1 },
          },
        ]}
        texts={[
          {
            position: 1,
            text: "Between",
            style: "QUOTE",
            align: "END",
            columns: 8,
            rows: 1,
          },
          { position: 2, text: "After", columns: 4, rows: 1 },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Color",
      "Between",
      "Monochrome",
      "After",
    ]);
    const quote = within(items[1]).getByText("Between");
    expect(quote).toHaveAttribute("data-style", "QUOTE");
    expect(quote).toHaveAttribute("data-align", "END");
    expect(items[1]).toHaveStyle({
      "--span-columns": "8",
      "--span-mobile-columns": "4",
    });
    expect(within(items[3]).getByText("After")).toHaveAttribute(
      "data-style",
      "BODY",
    );
  });

  it("shows a photo's own text as part of the same piece", () => {
    render(
      <CollectionMosaic
        mosaic
        tiles={[
          {
            key: "a",
            photo: photos[0],
            variants: [photos[0]],
            entry: {
              photoId: "Color",
              columns: 2,
              rows: 2,
              caption: " At dawn ",
            },
          },
        ]}
      />,
    );
    const piece = screen.getByRole("listitem");
    expect(piece).toHaveClass("mosaic-piece--captioned");
    expect(within(piece).getByRole("figure")).toContainElement(
      screen.getByText("At dawn"),
    );
    expect(screen.getByRole("link")).toHaveAccessibleDescription("At dawn");
  });
});
