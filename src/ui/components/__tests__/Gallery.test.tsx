import { defaultGallerySettings } from "@/src/domain/entities/GallerySettings";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Gallery from "../Gallery";
import { Photo } from "@/src/domain/entities/Photo";
import {
  PhotoPage,
  PhotoPageQuery,
} from "@/src/domain/repositories/PhotoBrowseRepository";

vi.mock("@/src/infrastructure/catalogServices", () => ({
  galleryCategories: {
    load: vi
      .fn()
      .mockResolvedValue({
        collections: [],
        works: [],
        photos: [],
        categories: [
          { id: "street", name: "Street" },
          { id: "animal", name: "Animal" },
          { id: "color", name: "Color" },
        ],
      }),
  },
}));
vi.mock("@/src/infrastructure/gallerySettingsServices", async () => {
  const { defaultGallerySettings } = await import(
    "@/src/domain/entities/GallerySettings"
  );
  return {
    manageGallerySettings: {
      get: vi.fn().mockResolvedValue(defaultGallerySettings),
    },
  };
});
function result(page = 1, total = 25): PhotoPage {
  return {
    page,
    total,
    limit: 12,
    tiles: Array.from(
      { length: Math.min(12, Math.max(0, total - (page - 1) * 12)) },
      (_, i) => {
        const id = String((page - 1) * 12 + i);
        const photo = new Photo({
          id,
          title: `Photo ${id}`,
          width: 1920,
          height: 1080,
          renditions: [{ width: 640, url: `https://cdn/${id}.jpg` }],
        });
        return { key: id, photo, variants: [photo] };
      },
    ),
  };
}
describe("Gallery server pagination", () => {
  it("requests only the current page with a stable seed and blocks rapid repeated navigation", async () => {
    const user = userEvent.setup();
    let finish: (value: PhotoPage) => void = () => {};
    const execute = vi
      .fn()
      .mockResolvedValueOnce(result())
      .mockImplementationOnce(
        () =>
          new Promise<PhotoPage>((resolve) => {
            finish = resolve;
          }),
      );
    render(
      <Gallery browsePhotos={{ execute }} settings={defaultGallerySettings} />,
    );
    await screen.findByText("Page 1 of 3");
    expect(screen.getAllByRole("img")).toHaveLength(12);
    const seed = execute.mock.calls[0][0].seed;
    await user.dblClick(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    expect(execute.mock.calls[1][0]).toMatchObject({
      page: 2,
      limit: 12,
      seed,
    });
    await act(async () => finish(result(2)));
    await screen.findByText("Page 2 of 3");
    expect(screen.getByRole("img", { name: "Photo 12" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(execute).toHaveBeenCalledTimes(2);
  });
  it("debounces search and sends category and presentation filters to the API", async () => {
    const user = userEvent.setup();
    const execute = vi
      .fn()
      .mockImplementation((query: PhotoPageQuery) =>
        Promise.resolve(result(query.page, 1)),
      );
    render(
      <Gallery browsePhotos={{ execute }} settings={defaultGallerySettings} />,
    );
    await screen.findByRole("img");
    await user.type(screen.getByRole("searchbox"), "street");
    expect(execute).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(execute.mock.calls.at(-1)?.[0]).toMatchObject({
        search: "street",
        page: 1,
      }),
    );
    await user.click(screen.getByRole("button", { name: /^Filters/ }));
    await user.click(screen.getByRole("button", { name: "Street" }));
    await waitFor(() =>
      expect(execute.mock.calls.at(-1)?.[0]).toMatchObject({
        categories: "street",
      }),
    );
    // Any of a group, and one of every group chosen.
    await user.click(screen.getByRole("button", { name: "Animal" }));
    await user.click(screen.getByRole("button", { name: "Color" }));
    await waitFor(() =>
      expect(execute.mock.calls.at(-1)?.[0]).toMatchObject({
        categories: "street,animal|color",
      }),
    );
    expect(
      within(screen.getByRole("list", { name: "Active filters" })).getAllByRole(
        "button",
      ),
    ).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    await waitFor(() =>
      expect(execute.mock.calls.at(-1)?.[0].categories).toBeUndefined(),
    );
    expect(
      screen.getByRole("button", { name: "Clear all filters" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^Filters/ }));
    await user.click(screen.getByRole("radio", { name: "Natural proportions" }));
    expect(screen.getAllByText("Natural proportions").length).toBeGreaterThan(1);
    await waitFor(() =>
      expect(execute.mock.calls.at(-1)?.[0]).toMatchObject({
        layout: "justified",
      }),
    );
  });
  it("aborts obsolete requests and retries failed reads manually", async () => {
    const user = userEvent.setup();
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(result(1, 1));
    const view = render(
      <Gallery browsePhotos={{ execute }} settings={defaultGallerySettings} />,
    );
    await screen.findByText(/Photos could not be loaded/);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await screen.findByRole("img");
    expect(execute.mock.calls[0][1].aborted).toBe(true);
    const signal = execute.mock.calls[1][1] as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
  it("honors administrator enabled options and shows an empty selection", async () => {
    const user = userEvent.setup();
    render(
      <Gallery
        browsePhotos={{ execute: vi.fn().mockResolvedValue(result(1, 0)) }}
        settings={{
          ...defaultGallerySettings,
          visitorOptions: { layouts: ["justified"], crops: ["rectangular"] },
        }}
      />,
    );
    await screen.findByText("No photos in this selection.");
    await user.click(screen.getByRole("button", { name: /^Filters/ }));
    expect(
      screen.getByRole("radio", { name: "Natural proportions" }),
    ).toBeChecked();
    expect(
      within(screen.getByRole("radiogroup", { name: "View shapes" })).getAllByRole("radio"),
    ).toHaveLength(1);
    expect(
      screen.queryByRole("navigation", { name: "Gallery pagination" }),
    ).not.toBeInTheDocument();
  });
  it("returns to the same place after visiting a photo", async () => {
    window.sessionStorage.setItem("gallerySeed", "42");
    window.history.replaceState(null, "", "/gallery?category=street&q=night&page=2");
    const execute = vi.fn().mockResolvedValue(result(2));
    // The public page, which reads its saved settings, not the Curator preview.
    render(<Gallery browsePhotos={{ execute }} />);
    await waitFor(() => expect(execute).toHaveBeenCalled());
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toMatchObject({
      page: 2,
      seed: "42",
      categories: "street",
      search: "night",
    });
    expect(screen.getByRole("searchbox")).toHaveValue("night");
    await userEvent.setup().click(await screen.findByRole("button", { name: /Next/ }));
    await waitFor(() => expect(window.location.search).toContain("page=3"));
    expect(window.location.search).toContain("category=street");
    window.history.replaceState(null, "", "/");
    window.sessionStorage.clear();
  });
  it("splits the page into the cards the curator chose", async () => {
    const execute = vi.fn().mockResolvedValue(result(1, 1));
    const { container, rerender } = render(
      <Gallery browsePhotos={{ execute }} settings={defaultGallerySettings} />,
    );
    await screen.findByRole("img");
    const cards = () =>
      Array.from(container.querySelectorAll(".gallery-card")).map((card) =>
        card.getAttribute("data-blocks"),
      );
    // Without a layout, title and filters share a card, side by side.
    expect(cards()).toEqual(["heading filters", "photos"]);
    expect(container.querySelector(".gallery-card__row")).not.toBeNull();
    rerender(
      <Gallery
        browsePhotos={{ execute }}
        settings={{
          ...defaultGallerySettings,
          pageLayout: {
            groups: [["photos"], ["filters"], ["heading"]],
            filtersPlacement: "side",
            headingAlign: "center",
          },
        }}
      />,
    );
    expect(cards()).toEqual(["photos", "filters", "heading"]);
    expect(container.querySelector(".gallery-cards-row")).not.toBeNull();
    expect(container.querySelector(".gallery-heading")).toHaveAttribute(
      "data-align",
      "center",
    );
    expect(
      screen.getByRole("region", { name: "Gallery filters" }),
    ).toHaveAttribute("data-anchor", "start");
    rerender(
      <Gallery
        browsePhotos={{ execute }}
        settings={{
          ...defaultGallerySettings,
          pageLayout: {
            groups: [["heading", "filters", "photos"]],
            filtersPlacement: "below",
            headingAlign: "start",
          },
        }}
      />,
    );
    expect(cards()).toEqual(["heading filters photos"]);
    expect(container.querySelector(".gallery-card__row")).toBeNull();
  });
});
