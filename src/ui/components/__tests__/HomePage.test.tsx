import { defaultHomeBanner } from "@/src/domain/entities/HomeBanner";
import { manageHomeBanner } from "@/src/infrastructure/homeBannerServices";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import HomePage from "../HomePage";
import { Photo } from "@/src/domain/entities/Photo";

function makePhoto(id: string, title: string) {
  return new Photo({
    id,
    title,
    width: 1920,
    height: 1080,
    renditions: [{ width: 640, url: `https://cdn/${id}.jpg` }],
  });
}

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.99);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("HomePage", () => {
  it("renders the saved slide text and destination with overlay navigation", async () => {
    render(
      <HomePage
        banner={{
          ...defaultHomeBanner,
          layout: "text-overlay",
          controlsPosition: "overlay",
          navigation: "progress",
          slides: [
            {
              photoId: "a",
              text: "Visit Instagram",
              href: "https://www.instagram.com/example/",
            },
          ],
        }}
        getAllPhotos={{
          execute: vi.fn().mockResolvedValue([makePhoto("a", "Photo")]),
        }}
      />,
    );
    const link = await screen.findByRole("link", { name: /Visit Instagram/ });
    expect(link).toHaveAttribute("href", "https://www.instagram.com/example/");
    expect(screen.getByRole("main")).toHaveClass(
      "home-gallery--text-overlay",
      "home-gallery--controls-overlay",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("max", "1");
  });
  it("shows the slides chosen in Curator, in their order, instead of random photos", async () => {
    const getAllPhotos = { execute: vi.fn().mockResolvedValue([makePhoto("r", "Random")]) };
    const getPhotoById = {
      execute: vi.fn((id: string) =>
        Promise.resolve(id === "gone" ? null : makePhoto(id, `Photo ${id}`)),
      ),
    };
    render(
      <HomePage
        banner={{
          ...defaultHomeBanner,
          slides: [
            { photoId: "b", text: "Second chosen", href: "/gallery" },
            { photoId: "gone", text: "Missing", href: "/gallery" },
            { photoId: "a", text: "First chosen", href: "/photo/a" },
          ],
        }}
        getAllPhotos={getAllPhotos}
        getPhotoById={getPhotoById}
      />,
    );
    expect(await screen.findByRole("link", { name: /Second chosen/ })).toHaveAttribute("href", "/gallery");
    expect(screen.getByText("01 / 02", { exact: false })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("region", { name: "Featured photographs" }), { key: "ArrowRight" });
    expect(screen.getByRole("link", { name: /First chosen/ })).toHaveAttribute("href", "/photo/a");
    expect(getAllPhotos.execute).not.toHaveBeenCalled();
    // Each slide's detail came with the slide list; nothing is fetched again.
    expect(getPhotoById.execute).toHaveBeenCalledTimes(3);
  });
  it("opens the destination only from the title and remembers Home's order for the viewer", async () => {
    window.sessionStorage.clear();
    render(
      <HomePage
        banner={defaultHomeBanner}
        getAllPhotos={{
          execute: vi.fn().mockResolvedValue([makePhoto("a", "First"), makePhoto("b", "Second")]),
        }}
        getPhotoById={{ execute: vi.fn().mockResolvedValue(null) }}
      />,
    );
    const title = await screen.findByRole("link", { name: /First/ });
    const carousel = screen.getByRole("region", { name: "Featured photographs" });
    expect(within(carousel).getAllByRole("link")).toEqual([title]);
    for (const image of screen.getAllByAltText("First")) expect(image.closest("a")).toBeNull();
    fireEvent.click(title);
    expect(JSON.parse(window.sessionStorage.getItem("viewerSequence")!)).toEqual([["a"], ["b"]]);
  });
  it("changes slides with focused horizontal keys and accepts composition drops", async () => {
    render(
      <HomePage
        banner={defaultHomeBanner}
        onLayoutChange={() => {}}
        getAllPhotos={{
          execute: vi
            .fn()
            .mockResolvedValue([
              makePhoto("a", "First"),
              makePhoto("b", "Second"),
            ]),
        }}
      />,
    );
    await screen.findByText("First");
    const carousel = screen.getByRole("region", {
      name: "Featured photographs",
    });
    expect(carousel).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(screen.getByText("Second")).toBeInTheDocument();
    const transfer = { dropEffect: "none" };
    expect(
      fireEvent.dragOver(screen.getByRole("main"), { dataTransfer: transfer }),
    ).toBe(false);
    expect(transfer.dropEffect).toBe("move");
  });
  it("swipes horizontally without following the photo link and ignores vertical scroll", async () => {
    render(
      <HomePage
        banner={defaultHomeBanner}
        getAllPhotos={{
          execute: vi
            .fn()
            .mockResolvedValue([
              makePhoto("a", "First"),
              makePhoto("b", "Second"),
            ]),
        }}
      />,
    );
    await screen.findByText("First");
    const carousel = screen.getByRole("region", {
      name: "Featured photographs",
    });
    fireEvent.touchStart(carousel, {
      touches: [{ clientX: 220, clientY: 100 }],
    });
    fireEvent.touchEnd(carousel, {
      changedTouches: [{ clientX: 120, clientY: 105 }],
    });
    expect(screen.getByText("Second")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Second/ });
    expect(fireEvent.click(link)).toBe(false);
    fireEvent.touchStart(carousel, {
      touches: [{ clientX: 220, clientY: 100 }],
    });
    fireEvent.touchEnd(carousel, {
      changedTouches: [{ clientX: 210, clientY: 220 }],
    });
    expect(screen.getByText("Second")).toBeInTheDocument();
  });
  it("uses approved highlights and honors an explicit full-photo mobile choice", async () => {
    const photo = new Photo({
      id: "crop",
      title: "Crop",
      width: 1800,
      height: 1200,
      renditions: [{ width: 640, url: "https://cdn/crop.jpg" }],
      highlights: {
        landscape: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
        presentation: {
          gallery: ["original"],
          home: ["original", "landscape"],
        },
      },
    });
    render(
      <HomePage
        banner={{
          ...defaultHomeBanner,
          photoCrops: [
            { photoId: "crop", desktop: "landscape", mobile: "full" },
          ],
        }}
        getAllPhotos={{ execute: vi.fn().mockResolvedValue([photo]) }}
      />,
    );
    const desktop = await screen.findByTestId("banner-crop-desktop");
    expect(desktop.querySelector(".home-carousel__crop-source")).toHaveStyle({
      width: "200%",
      left: "-50%",
    });
    expect(
      screen
        .getByTestId("banner-crop-mobile")
        .querySelector(".home-carousel__crop-source"),
    ).toHaveStyle({ width: "100%", left: "0%" });
  });
  it("applies saved appearance and escaped text to public Home", async () => {
    const get = vi.spyOn(manageHomeBanner, "get").mockResolvedValue({
      ...defaultHomeBanner,
      title: "<b>Welcome</b>",
      layout: "text-right",
      shape: "arch",
      backgroundColor: "#112233",
      font: "sans",
    });
    render(
      <HomePage getAllPhotos={{ execute: vi.fn().mockResolvedValue(null) }} />,
    );
    expect(await screen.findByText("<b>Welcome</b>")).toBeInTheDocument();
    const home = screen.getByRole("main");
    expect(home).toHaveClass("home-gallery--text-right", "home-gallery--arch");
    expect(home.style.getPropertyValue("--banner-background")).toBe("#112233");
    expect(home.querySelector("b")).toBeNull();
    get.mockRestore();
  });
  it("keeps a shuffled selection stable while navigating", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.99);
    const getAllPhotos = {
      execute: vi
        .fn()
        .mockResolvedValue([
          makePhoto("2", "Atardecer"),
          makePhoto("1", "Esfera"),
        ]),
    };

    render(<HomePage getAllPhotos={getAllPhotos} />);

    await waitFor(() =>
      expect(screen.getByText("Atardecer")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Esfera")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next photograph" }));
    expect(screen.getByText("Esfera")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next photograph" }));
    expect(screen.getByText("Atardecer")).toBeInTheDocument();
    random.mockRestore();
  });

  it("shows each photo inside its own frame", async () => {
    const framed = new Photo({
      id: "f",
      title: "Framed",
      width: 1500,
      height: 1000,
      renditions: [{ width: 640, url: "https://cdn/f.jpg" }],
      frame: { color: "#f2efe6", leftRight: 6, topBottom: 3 },
    });
    render(
      <HomePage
        banner={{ ...defaultHomeBanner, imageMode: "framed" }}
        getAllPhotos={{ execute: vi.fn().mockResolvedValue([framed]) }}
      />,
    );

    const frame = await screen.findByTestId("carousel-frame");
    // 6 % and 3 % of the short side, which is two thirds of the width.
    expect(frame.style.padding).toBe("2% 4%");
    expect(frame.style.background).toContain("242, 239, 230");
  });

  it("shows a photo without a frame bare", async () => {
    render(
      <HomePage
        banner={{ ...defaultHomeBanner, imageMode: "framed" }}
        getAllPhotos={{
          execute: vi.fn().mockResolvedValue([makePhoto("1", "Bare")]),
        }}
      />,
    );

    const frame = await screen.findByTestId("carousel-frame");
    expect(frame.style.padding).toBe("0%");
    expect(frame.style.background).toBe("");
  });

  it("shows an error message when there are no photos", async () => {
    const getAllPhotos = { execute: vi.fn().mockResolvedValue(null) };

    render(<HomePage getAllPhotos={getAllPhotos} />);

    await waitFor(() =>
      expect(screen.getByText("Photo not found")).toBeInTheDocument(),
    );
  });
});

it("excludes photos disabled for Home and renders only enabled crops", async () => {
  const excluded = new Photo({
    id: "excluded",
    title: "Excluded",
    width: 1200,
    height: 1800,
    renditions: [{ width: 640, url: "https://cdn/excluded.jpg" }],
    highlights: { presentation: { gallery: ["original"], home: [] } },
  });
  const cropped = new Photo({
    id: "cropped",
    title: "Cropped",
    width: 1200,
    height: 1800,
    renditions: [{ width: 640, url: "https://cdn/cropped.jpg" }],
    highlights: {
      landscape: { x: 0, y: 0.2, width: 1, height: 0.4 },
      presentation: { gallery: [], home: ["landscape"] },
    },
  });
  render(
    <HomePage
      banner={{ ...defaultHomeBanner, imageMode: "framed" }}
      getAllPhotos={{ execute: vi.fn().mockResolvedValue([excluded, cropped]) }}
    />,
  );
  const img = await screen.findByRole("img", { name: "Cropped" });
  expect(
    screen.queryByRole("img", { name: "Excluded" }),
  ).not.toBeInTheDocument();
  expect(img.style.top).toBe("-50%");
  expect(
    screen.getByRole("button", { name: "Next photograph" }),
  ).toBeDisabled();
});

it("removes a photo disabled in the inline Home editor without breaking navigation", async () => {
  const photos = [makePhoto("a", "First"), makePhoto("b", "Second")];
  const getAllPhotos = { execute: vi.fn().mockResolvedValue(photos) };
  const { rerender } = render(
    <HomePage banner={defaultHomeBanner} getAllPhotos={getAllPhotos} />,
  );
  await screen.findByText("First");
  const disabled = new Photo({
    id: "a",
    title: "First",
    width: 1920,
    height: 1080,
    renditions: [{ width: 640, url: "https://cdn/a.jpg" }],
    highlights: { presentation: { gallery: ["original"], home: [] } },
  });
  rerender(
    <HomePage
      banner={defaultHomeBanner}
      getAllPhotos={getAllPhotos}
      editedPhoto={disabled}
    />,
  );
  expect(screen.getByText("Second")).toBeInTheDocument();
  expect(screen.queryByText("First")).not.toBeInTheDocument();
});
