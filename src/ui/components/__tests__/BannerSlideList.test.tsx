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

  it("edits each slide's title and link and removes slides", async () => {
    render(<Harness initial={[slide("a"), slide("b")]} />);
    fireEvent.change(await screen.findByLabelText("Title for Photo b"), {
      target: { value: "Follow me" },
    });
    expect(latestOf()[1]).toEqual({ ...slide("b"), text: "Follow me" });
    const card = screen.getByLabelText("Title for Photo a").closest("li")!;
    expect(card).not.toHaveClass("is-active");
    expect(
      screen.getByLabelText("Title for Photo b").closest("li"),
    ).toHaveClass("is-active");
    await within(card).findByRole("option", { name: "Gallery category" });
    fireEvent.change(within(card).getByLabelText("Link destination"), {
      target: { value: "category" },
    });
    expect(latestOf()[0].href).toBe("/gallery?category=city");
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Photo a from Home" }),
    );
    expect(latestOf().map((item) => item.photoId)).toEqual(["b"]);
  });

  it("reorders by dragging a card's grip, by arrow keys or by buttons", async () => {
    render(<Harness initial={[slide("a"), slide("b"), slide("c")]} />);
    const cards = await screen.findAllByRole("listitem");
    cards.forEach((card, index) => {
      card.getBoundingClientRect = () =>
        ({ left: index * 220, top: 0, width: 200, height: 300 }) as DOMRect;
    });
    const grip = screen.getByRole("button", {
      name: "Reorder Photo a, position 1 of 3",
    });
    fireEvent.pointerDown(grip, { button: 0, clientX: 100, clientY: 20 });
    fireEvent.pointerMove(grip, { clientX: 540, clientY: 40 });
    expect(cards[0]).toHaveClass("is-dragged");
    expect(cards[2]).toHaveClass("is-target");
    fireEvent.pointerUp(grip, { clientX: 540, clientY: 40 });
    expect(latestOf().map((item) => item.photoId)).toEqual(["b", "c", "a"]);
    expect(screen.getByText(/moved to position 3 of 3/)).toBeInTheDocument();

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Reorder Photo a, position 3 of 3" }),
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
});
