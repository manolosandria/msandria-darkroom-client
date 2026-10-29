import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { BannerSlideList } from "../BannerSlideList";
import { HomeBanner } from "@/src/domain/entities/HomeBanner";
import { Photo } from "@/src/domain/entities/Photo";

const photo = (id: string, visibility: "PUBLIC" | "PRIVATE" = "PUBLIC") =>
  new Photo({ id, title: `Photo ${id}`, width: 10, height: 10, renditions: [{ width: 160, url: `https://cdn/${id}` }], visibility });
const getPhotos = {
  execute: vi.fn().mockResolvedValue([photo("a"), photo("b"), photo("c"), photo("p", "PRIVATE")]),
};
const changes: NonNullable<HomeBanner["slides"]>[] = [];
const latestOf = () => changes[changes.length - 1];
function Harness({ initial = [] as NonNullable<HomeBanner["slides"]> }) {
  const [slides, setSlides] = useState(initial);
  return (
    <BannerSlideList
      slides={slides}
      onChange={(next) => {
        changes.push(next);
        setSlides(next);
      }}
      getPhotos={getPhotos}
    />
  );
}

describe("BannerSlideList", () => {
  it("adds public photographs, reorders and removes slides", async () => {
    render(<Harness />);
    expect(screen.getByText(/at random/)).toBeInTheDocument();
    const select = await screen.findByLabelText("Add photograph");
    expect(await screen.findByRole("option", { name: "Photo a" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Photo p" })).not.toBeInTheDocument();

    for (const id of ["a", "b"]) {
      fireEvent.change(select, { target: { value: id } });
      fireEvent.click(screen.getByRole("button", { name: "Add to Home" }));
    }
    expect(latestOf().map((slide) => slide.photoId)).toEqual(["a", "b"]);
    expect(latestOf()[0]).toEqual({ photoId: "a", text: "Photo a", href: "/photo/a" });
    expect(screen.queryByRole("option", { name: "Photo a" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Move Photo b earlier" }));
    expect(latestOf().map((slide) => slide.photoId)).toEqual(["b", "a"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Photo b from Home" }));
    expect(latestOf().map((slide) => slide.photoId)).toEqual(["a"]);
  });

  it("offers no more photographs once eight slides are chosen", async () => {
    render(
      <Harness
        initial={Array.from({ length: 8 }, (_, i) => ({ photoId: `s${i}`, text: "", href: "/gallery" }))}
      />,
    );
    await screen.findByText(/in this order/);
    expect(screen.queryByLabelText("Add photograph")).not.toBeInTheDocument();
  });
});
