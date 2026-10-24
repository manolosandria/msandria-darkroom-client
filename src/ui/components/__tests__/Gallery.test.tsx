import { defaultGallerySettings } from "@/src/domain/entities/GallerySettings";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Gallery from "../Gallery";
import { Photo } from "@/src/domain/entities/Photo";

vi.mock("@/src/infrastructure/catalogServices", () => ({
  editCatalog: {
    load: vi.fn().mockResolvedValue({
      collections: [],
      works: [],
      categories: [
        { id: "street", name: "Street" },
        { id: "color", name: "color" },
        { id: "memory", name: "Memory" },
        { id: "custom", name: "Personal study" },
      ],
      photos: [{ id: "0", categories: [{ id: "street" }] }],
    }),
  },
}));

function makePhoto(id: string) {
  return new Photo({
    id,
    title: `Photo ${id}`,
    width: 1920,
    height: 1080,
    renditions: [{ width: 640, url: `https://cdn/${id}.jpg` }],
  });
}

describe("Gallery", () => {
  it("paginates a stable shuffled selection twelve photos at a time", async () => {
    const user = userEvent.setup();
    const photos = Array.from({ length: 25 }, (_, index) =>
      makePhoto(String(index)),
    );
    render(
      <Gallery getAllPhotos={{ execute: vi.fn().mockResolvedValue(photos) }} />,
    );
    await screen.findByText("Page 1 of 3");
    const firstPage = screen
      .getAllByRole("img")
      .map((image) => image.getAttribute("alt"));
    expect(firstPage).toHaveLength(12);
    await user.click(screen.getByRole("button", { name: /next/i }));
    const secondPage = screen
      .getAllByRole("img")
      .map((image) => image.getAttribute("alt"));
    expect(secondPage).toHaveLength(12);
    expect(secondPage.some((title) => firstPage.includes(title))).toBe(false);
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /previous/i }));
    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(
      screen.getAllByRole("img").map((image) => image.getAttribute("alt")),
    ).toEqual(firstPage);
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /Subjects/ }));
    await user.click(screen.getByRole("button", { name: "Street" }));
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Photo 0" })).toBeInTheDocument();
    for (const [group, name] of [
      ["Subjects", "Street"],
      ["Color & treatment", "color"],
      ["Themes", "Memory"],
      ["Other", "Personal study"],
    ]) {
      await user.click(screen.getByRole("button", { name: new RegExp(group) }));
      expect(screen.getByRole("group", { name: group })).toContainElement(
        screen.getByRole("button", { name }),
      );
      await user.keyboard("{Escape}");
    }
    expect(
      screen.queryByRole("combobox", { name: "Filter by category" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All photographs" }));
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "All photographs" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
  it("searches titles or category names and resets the current page", async () => {
    const user = userEvent.setup();
    render(
      <Gallery
        getAllPhotos={{
          execute: vi
            .fn()
            .mockResolvedValue(
              Array.from({ length: 25 }, (_, i) => makePhoto(String(i))),
            ),
        }}
      />,
    );
    await screen.findByText("Page 1 of 3");
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.type(screen.getByRole("searchbox"), "Street");
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "Photo 24");
    expect(screen.getByRole("img", { name: "Photo 24" })).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
  it("shows the fetched photos once loading finishes", async () => {
    const getAllPhotos = {
      execute: vi.fn().mockResolvedValue([makePhoto("1"), makePhoto("2")]),
    };

    render(<Gallery getAllPhotos={getAllPhotos} />);

    await waitFor(() =>
      expect(screen.getByText("Photo 1")).toBeInTheDocument(),
    );
    expect(screen.getByText("Photo 2")).toBeInTheDocument();
    expect(screen.queryByText(/no photos found/i)).not.toBeInTheDocument();
  });

  it("shows an error message when no photos are returned", async () => {
    const getAllPhotos = { execute: vi.fn().mockResolvedValue(null) };

    render(<Gallery getAllPhotos={getAllPhotos} />);

    await waitFor(() =>
      expect(screen.getByText("No photos found")).toBeInTheDocument(),
    );
  });

  it("lets the visitor retry after a failed fetch", async () => {
    const user = userEvent.setup();
    const getAllPhotos = {
      execute: vi
        .fn()
        .mockRejectedValueOnce(new Error("network down"))
        .mockResolvedValueOnce([makePhoto("1")]),
    };

    render(<Gallery getAllPhotos={getAllPhotos} />);

    await waitFor(() =>
      expect(screen.getByText("Failed to fetch photos")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() =>
      expect(screen.getByText("Photo 1")).toBeInTheDocument(),
    );
    expect(getAllPhotos.execute).toHaveBeenCalledTimes(2);
  });
});

it("only shows variants and photos enabled for Gallery", async () => {
  const excluded = new Photo({
    id: "excluded",
    title: "Excluded",
    width: 1200,
    height: 1800,
    renditions: [{ width: 640, url: "https://cdn/excluded.jpg" }],
    highlights: { presentation: { gallery: [], home: ["original"] } },
  });
  render(
    <Gallery
      getAllPhotos={{
        execute: vi.fn().mockResolvedValue([excluded, makePhoto("yes")]),
      }}
    />,
  );
  expect(
    await screen.findByRole("img", { name: "Photo yes" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("img", { name: "Excluded" }),
  ).not.toBeInTheDocument();
});

it("offers visitor layouts and view aspects while honoring each crop matrix cell", async () => {
  const user = userEvent.setup();
  const photo = new Photo({
    id: "p",
    title: "Portrait",
    width: 1200,
    height: 1800,
    renditions: [{ width: 640, url: "https://cdn/p.jpg" }],
    highlights: {
      square: { x: 0, y: 0, width: 1, height: 2 / 3 },
      presentation: {
        gallery: ["original", "square"],
        home: [],
        galleryRules: [
          { layout: "random", aspect: "portrait", views: ["original"] },
          { layout: "justified", aspect: "square", views: ["square"] },
          { layout: "uniform", aspect: "square", views: ["square"] },
        ],
      },
    },
  });
  render(
    <Gallery
      settings={defaultGallerySettings}
      getAllPhotos={{ execute: vi.fn().mockResolvedValue([photo]) }}
    />,
  );
  await screen.findByRole("img", { name: "Portrait" });
  expect(screen.getByLabelText("Distribution")).toHaveValue("random");
  await user.selectOptions(screen.getByLabelText("Distribution"), "justified");
  expect(
    document.querySelector(".gallery-tile")?.getAttribute("style"),
  ).toContain("--ratio: 1");
  await user.selectOptions(screen.getByLabelText("View shapes"), "rectangular");
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("View shapes"), "square");
  expect(screen.getByRole("img", { name: "Portrait" })).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Distribution"), "uniform");
  expect(screen.getByRole("img", { name: "Portrait" })).toBeInTheDocument();
});
it("only offers options enabled by the administrator and falls back from disabled defaults", async () => {
  render(
    <Gallery
      settings={{
        ...defaultGallerySettings,
        visitorOptions: {
          layouts: ["justified"],
          crops: ["rectangular"],
        },
      }}
      getAllPhotos={{ execute: vi.fn().mockResolvedValue([makePhoto("1")]) }}
    />,
  );
  await screen.findByRole("img");
  expect(screen.getByLabelText("Distribution")).toHaveValue("justified");
  expect(
    within(screen.getByLabelText("Distribution")).queryByRole("option", {
      name: "Random emphasis",
    }),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByLabelText("View shapes")).getAllByRole("option"),
  ).toHaveLength(1);
});
