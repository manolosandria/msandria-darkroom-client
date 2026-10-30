import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { BannerSlideList } from "../BannerSlideList";
import { HomeBanner } from "@/src/domain/entities/HomeBanner";
import { Photo } from "@/src/domain/entities/Photo";

vi.mock("@/src/infrastructure/catalogServices", () => ({
  editCatalog: {
    load: vi.fn().mockResolvedValue({
      categories: [{ id: "city", name: "City" }],
      collections: [{ id: "travel", title: "Travel" }],
      works: [],
      photos: [],
    }),
  },
}));

const photo = (
  id: string,
  visibility: "PUBLIC" | "PRIVATE" = "PUBLIC",
  title = `Photo ${id}`,
) =>
  new Photo({
    id,
    title,
    width: 10,
    height: 10,
    renditions: [{ width: 160, url: `https://cdn/${id}` }],
    visibility,
  });
const getPhotos = {
  execute: vi
    .fn()
    .mockResolvedValue([
      photo("a"),
      photo("b"),
      photo("c", "PUBLIC", "Árbol del Médano"),
      photo("p", "PRIVATE"),
    ]),
};
const general = {
  eyebrow: "GENERAL",
  title: "A moment.",
  accentText: "Another way",
  linkText: "Explore",
  href: "/gallery",
  position: "bottom-left" as const,
  width: 50,
  fontSize: 72,
};
const changes: NonNullable<HomeBanner["slides"]>[] = [];
const latestOf = () => changes[changes.length - 1];
function Harness({
  initial = [] as NonNullable<HomeBanner["slides"]>,
  onFocusSlide = () => {},
}) {
  const [slides, setSlides] = useState(initial);
  return (
    <BannerSlideList
      slides={slides}
      onChange={(next) => {
        changes.push(next);
        setSlides(next);
      }}
      getPhotos={getPhotos}
      onFocusSlide={onFocusSlide}
      activePhotoId="b"
      general={general}
    />
  );
}
const slide = (id: string) => ({
  photoId: id,
  text: `Photo ${id}`,
  href: `/photo/${id}`,
});

describe("BannerSlideList", () => {
  it("adds public photographs from thumbnails, searching titles without accents", async () => {
    const onFocusSlide = vi.fn();
    render(<Harness onFocusSlide={onFocusSlide} />);
    expect(screen.getByText(/at random/)).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Photo a to Home" }),
    );
    expect(latestOf()).toEqual([slide("a")]);
    expect(onFocusSlide).toHaveBeenLastCalledWith("a");
    expect(
      screen.queryByRole("button", { name: "Add Photo a to Home" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Add Photo p to Home" }),
    ).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Search by title"), {
      target: { value: "medano" },
    });
    expect(
      screen.getByRole("button", { name: "Add Árbol del Médano to Home" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add Photo b to Home" }),
    ).toBeNull();
  });

  it("edits the chosen slide in a detail under the strip and removes slides", async () => {
    render(<Harness initial={[slide("a"), slide("b")]} />);
    // The preview shows b, so b is the slide in the detail.
    const thumbB = await screen.findByRole("button", {
      name: "Slide 2 of 2: Photo b",
    });
    expect(thumbB).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Title for Photo a")).toBeNull();
    fireEvent.change(screen.getByLabelText("Title for Photo b"), {
      target: { value: "Follow me" },
    });
    expect(latestOf()[1]).toEqual({ ...slide("b"), text: "Follow me" });

    fireEvent.click(
      screen.getByRole("button", { name: "Slide 1 of 2: Photo a" }),
    );
    const detail = screen.getByRole("region", { name: "Slide 1: Photo a" });
    expect(within(detail).getByLabelText("Title for Photo a")).toBeVisible();
    await within(detail).findByRole("option", { name: "Gallery category" });
    fireEvent.change(within(detail).getByLabelText("Link destination"), {
      target: { value: "category" },
    });
    expect(latestOf()[0].href).toBe("/gallery?category=city");
    fireEvent.click(within(detail).getByRole("button", { name: "Remove" }));
    expect(latestOf().map((item) => item.photoId)).toEqual(["b"]);
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Photo b from Home" }),
    );
    expect(latestOf()).toEqual([]);
  });

  it("reorders by dragging a thumbnail from anywhere, by arrow keys or by buttons", async () => {
    const onFocusSlide = vi.fn();
    render(
      <Harness
        initial={[slide("a"), slide("b"), slide("c")]}
        onFocusSlide={onFocusSlide}
      />,
    );
    const items = within(
      await screen.findByRole("list", { name: "Slide order" }),
    ).getAllByRole("listitem");
    items.forEach((item, index) => {
      item.getBoundingClientRect = () =>
        ({ left: index * 140, top: 0, width: 132, height: 88 }) as DOMRect;
    });
    const thumb = screen.getByRole("button", { name: "Slide 1 of 3: Photo a" });
    fireEvent.pointerDown(thumb, { button: 0, clientX: 60, clientY: 40 });
    fireEvent.pointerMove(thumb, { clientX: 350, clientY: 40 });
    expect(items[0]).toHaveClass("is-dragged");
    // The others make room while dragging: the thumbnail already shows its new place.
    expect(
      within(screen.getByRole("list", { name: "Slide order" }))
        .getAllByRole("button", { name: /^Slide/ })
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Slide 1 of 3: Photo b",
      "Slide 2 of 3: Árbol del Médano",
      "Slide 3 of 3: Photo a",
    ]);
    fireEvent.pointerUp(thumb, { clientX: 350, clientY: 40 });
    // The click that follows a drop does not pick the slide.
    fireEvent.click(thumb);
    expect(onFocusSlide).not.toHaveBeenCalled();
    expect(latestOf().map((item) => item.photoId)).toEqual(["b", "c", "a"]);
    expect(screen.getByText(/moved to position 3 of 3/)).toBeInTheDocument();

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Slide 3 of 3: Photo a" }),
      { key: "ArrowLeft" },
    );
    expect(latestOf().map((item) => item.photoId)).toEqual(["b", "a", "c"]);
    fireEvent.click(screen.getByRole("button", { name: "Move Photo b later" }));
    expect(latestOf().map((item) => item.photoId)).toEqual(["a", "b", "c"]);
  });

  it("warns about a slide not enabled for Home and stops adding at eight", async () => {
    const hidden = new Photo({
      id: "h",
      title: "Hidden",
      width: 10,
      height: 10,
      renditions: [{ width: 160, url: "https://cdn/h" }],
      visibility: "PUBLIC",
      highlights: { presentation: { gallery: ["original"], home: [] } },
    });
    getPhotos.execute.mockResolvedValueOnce([hidden, photo("x")]);
    render(
      <Harness
        initial={[
          { photoId: "h", text: "Hidden", href: "/gallery" },
          ...Array.from({ length: 7 }, (_, i) => slide(`s${i}`)),
        ]}
      />,
    );
    expect(await screen.findByText(/Not enabled for Home/)).toBeInTheDocument();
    expect(screen.getByText("Eight slides chosen")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Photo x to Home" }),
    ).toBeDisabled();
  });
  it("gives a slide its own title, edits it, puts it back in place and returns to the general one", async () => {
    const onFocusSlide = vi.fn();
    render(<Harness initial={[slide("a")]} onFocusSlide={onFocusSlide} />);
    await screen.findAllByRole("listitem");
    expect(
      screen.getByRole("button", { name: "General title" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Own title" }));
    expect(latestOf()[0].heading).toEqual(general);
    expect(onFocusSlide).toHaveBeenCalledWith("a");
    expect(screen.getByRole("button", { name: "Own title" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Calaca" },
    });
    fireEvent.change(screen.getByLabelText(/Title size/), {
      target: { value: "40" },
    });
    expect(latestOf()[0].heading).toMatchObject({
      title: "Calaca",
      fontSize: 40,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Same place as the general title" }),
    );
    expect(latestOf()[0].heading).toMatchObject({
      position: "bottom-left",
      width: 50,
      title: "Calaca",
    });
    fireEvent.click(screen.getByRole("button", { name: "General title" }));
    expect(latestOf()[0].heading).toBeUndefined();
  });
});
