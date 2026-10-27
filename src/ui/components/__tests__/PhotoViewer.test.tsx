import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PhotoViewer from "../PhotoViewer";
import { Photo } from "@/src/domain/entities/Photo";
import { resetViewerHintForTests } from "@/src/ui/viewerHint";
import { setViewerPanelOpen } from "@/src/ui/viewerPanelState";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
// Comments have their own tests and need a session; here they only mark their place.
vi.mock("../PhotoComments", () => ({
  PhotoComments: ({ photoId }: { photoId: string }) => <section aria-label="Comments">{photoId}</section>,
}));

function makePhoto(id: string, frame?: ReturnType<Photo["getFrame"]>) {
  return new Photo({
    id,
    title: `Photo ${id}`,
    description: `The story of ${id}`,
    metadata: {
      capturedAt: "2024-05-10T20:23:01.000Z",
      camera: { make: "FUJIFILM", model: "X-T4", lens: null, iso: 160, aperture: 5.6, exposureTime: 0.002, focalLength: 23 },
    },
    width: 3000,
    height: 2000,
    frame,
    renditions: [
      { width: 640, url: `https://cdn/${id}/640` },
      { width: 960, url: `https://cdn/${id}/960` },
      { width: 1920, url: `https://cdn/${id}/1920` },
      { width: 2560, url: `https://cdn/${id}/2560` },
    ],
  });
}

function setup(id = "b", frame?: ReturnType<Photo["getFrame"]>) {
  const getPhoto = { execute: vi.fn().mockResolvedValue(makePhoto(id, frame)) };
  const getAllPhotos = {
    execute: vi.fn().mockResolvedValue([makePhoto("a"), makePhoto("b"), makePhoto("c")]),
  };
  render(<PhotoViewer photoId={id} getPhoto={getPhoto} getAllPhotos={getAllPhotos} />);
  return { getPhoto, getAllPhotos };
}

describe("PhotoViewer", () => {
  beforeEach(() => {
    push.mockReset();
    window.localStorage.clear();
    resetViewerHintForTests();
    setViewerPanelOpen(false);
  });

  it("tells a first-time visitor once that a click hides the controls", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByAltText("Photo b");

    expect(await screen.findByText(/Click the photo to hide the controls/)).toBeInTheDocument();
    expect(window.localStorage.getItem("viewerHintSeen")).toBe("1");
    await user.click(screen.getByAltText("Photo b"));
    expect(screen.queryByText(/Click the photo to hide the controls/)).not.toBeInTheDocument();
  });

  it("loads the same width from the other image host when the photo fails", async () => {
    const photo = new Photo({
      id: "b",
      title: "Photo b",
      width: 3000,
      height: 2000,
      renditions: [
        { width: 1920, url: "https://r2/b/1920", fallbackUrl: "https://cloudinary/b/1920" },
      ],
    });
    render(
      <PhotoViewer
        photoId="b"
        getPhoto={{ execute: vi.fn().mockResolvedValue(photo) }}
        getAllPhotos={{ execute: vi.fn().mockResolvedValue([photo]) }}
      />,
    );
    const image = await screen.findByAltText("Photo b");
    expect(image).toHaveAttribute("src", "https://r2/b/1920");

    fireEvent.error(image);

    expect(screen.getByAltText("Photo b")).toHaveAttribute("src", "https://cloudinary/b/1920");
  });

  it("does not repeat the hint on a later visit", async () => {
    window.localStorage.setItem("viewerHintSeen", "1");
    setup();
    await screen.findByAltText("Photo b");
    expect(screen.queryByText(/hide the controls/)).not.toBeInTheDocument();
  });

  it("keeps the info panel open when moving to another photo", async () => {
    const user = userEvent.setup();
    const getPhoto = { execute: vi.fn((id: string) => Promise.resolve(makePhoto(id))) };
    const getAllPhotos = {
      execute: vi.fn().mockResolvedValue([makePhoto("a"), makePhoto("b"), makePhoto("c")]),
    };
    // The route remounts the viewer for every photo, as a keyed element does.
    const { rerender } = render(
      <PhotoViewer key="b" photoId="b" getPhoto={getPhoto} getAllPhotos={getAllPhotos} />,
    );
    await screen.findByAltText("Photo b");
    await user.click(screen.getByRole("button", { name: "Show photo information" }));

    rerender(
      <PhotoViewer key="c" photoId="c" getPhoto={getPhoto} getAllPhotos={getAllPhotos} />,
    );

    expect(screen.getByRole("complementary", { name: "Photo information" })).toBeInTheDocument();
    await screen.findByAltText("Photo c");
    const panel = screen.getByRole("complementary", { name: "Photo information" });
    expect(panel).toHaveTextContent("The story of c");
  });

  it("draws each quality with sharper pixel blocks", async () => {
    setup();
    await screen.findByAltText("Photo b");
    const blocks = ["Data saver", "Standard", "Maximum"].map((name) =>
      screen.getByRole("button", { name }).querySelector("svg")?.getAttribute("data-blocks"),
    );
    expect(blocks).toEqual(["3", "6", "12"]);
  });

  it("shows the requested photo at the standard quality by default", async () => {
    const { getPhoto } = setup();

    const image = await screen.findByAltText("Photo b");
    expect(getPhoto.execute).toHaveBeenCalledWith("b");
    expect(image).toHaveAttribute("src", "https://cdn/b/1920");
  });

  it("switches renditions when the quality changes and remembers the choice", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByAltText("Photo b");

    await user.click(screen.getByRole("button", { name: "Maximum" }));
    expect(screen.getByAltText("Photo b")).toHaveAttribute("src", "https://cdn/b/2560");
    expect(screen.getByRole("button", { name: "Maximum" })).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("photoQuality")).toBe("max");

    await user.click(screen.getByRole("button", { name: "Data saver" }));
    expect(screen.getByAltText("Photo b")).toHaveAttribute("src", "https://cdn/b/960");
  });

  it("opens with the quality stored on an earlier visit", async () => {
    window.localStorage.setItem("photoQuality", "saver");
    setup();

    expect(await screen.findByAltText("Photo b")).toHaveAttribute("src", "https://cdn/b/960");
  });

  it("still works when storage refuses to be read or written", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    setup();
    await screen.findByAltText("Photo b");

    await user.click(screen.getByRole("button", { name: "Maximum" }));

    expect(screen.getByAltText("Photo b")).toHaveAttribute("src", "https://cdn/b/2560");
    vi.restoreAllMocks();
  });

  it("turns each side edge into a link to the neighbouring photo and offers a way back", async () => {
    setup("b");
    await screen.findByAltText("Photo b");

    await waitFor(() => expect(screen.getByRole("link", { name: "Previous photo" })).toHaveAttribute("href", "/photo/a"));
    expect(screen.getByRole("link", { name: "Next photo" })).toHaveAttribute("href", "/photo/c");
    expect(screen.getByRole("link", { name: "Back to gallery" })).toHaveAttribute("href", "/gallery");
  });

  it("offers no previous link on the first photo and no next on the last", async () => {
    setup("a");
    await screen.findByAltText("Photo a");
    await waitFor(() => expect(screen.getByRole("link", { name: "Next photo" })).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Previous photo" })).not.toBeInTheDocument();
  });

  it("moves with the arrow keys and leaves with Escape", async () => {
    setup("b");
    await waitFor(() => expect(screen.getByRole("link", { name: "Next photo" })).toBeInTheDocument());

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(push).toHaveBeenLastCalledWith("/photo/c");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(push).toHaveBeenLastCalledWith("/photo/a");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(push).toHaveBeenLastCalledWith("/gallery");
  });

  it("moves on a horizontal swipe but not on a short or vertical one", async () => {
    setup("b");
    const image = await screen.findByAltText("Photo b");
    await waitFor(() => expect(screen.getByRole("link", { name: "Next photo" })).toBeInTheDocument());
    const swipe = (from: [number, number], to: [number, number]) => {
      fireEvent.pointerDown(image, { clientX: from[0], clientY: from[1] });
      fireEvent.pointerUp(image, { clientX: to[0], clientY: to[1] });
    };

    swipe([100, 100], [130, 100]);
    swipe([100, 100], [180, 400]);
    expect(push).not.toHaveBeenCalled();

    swipe([300, 100], [100, 110]);
    expect(push).toHaveBeenLastCalledWith("/photo/c");
    swipe([100, 100], [300, 90]);
    expect(push).toHaveBeenLastCalledWith("/photo/a");
  });

  it("paints the photo's own frame colour around it", async () => {
    setup("b", { color: "#ffffff", leftRight: 4, topBottom: 6 });
    await screen.findByAltText("Photo b");

    expect(screen.getByTestId("photo-frame").style.background).toBe("rgb(255, 255, 255)");
  });

  it("shows the title over the photo together with the controls", async () => {
    setup("b");
    await screen.findByAltText("Photo b");

    expect(screen.getByText("Photo b", { selector: "figcaption" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-controls", "visible");
  });

  it("hides everything on a mouse click and brings it back when the mouse moves", async () => {
    setup("b");
    const image = await screen.findByAltText("Photo b");
    const main = screen.getByRole("main");

    fireEvent.pointerDown(image, { pointerType: "mouse", clientX: 200, clientY: 200 });
    fireEvent.pointerUp(image, { pointerType: "mouse", clientX: 200, clientY: 200 });
    fireEvent.click(image, { clientX: 200, clientY: 200 });
    expect(main).toHaveAttribute("data-controls", "hidden");

    fireEvent.pointerMove(main, { pointerType: "mouse", clientX: 203, clientY: 201 });
    expect(main).toHaveAttribute("data-controls", "hidden");

    fireEvent.pointerMove(main, { pointerType: "mouse", clientX: 260, clientY: 220 });
    expect(main).toHaveAttribute("data-controls", "visible");
  });

  it("toggles the controls with each tap on a touch screen", async () => {
    setup("b");
    const image = await screen.findByAltText("Photo b");
    const main = screen.getByRole("main");
    const tap = () => {
      fireEvent.pointerDown(image, { pointerType: "touch", clientX: 100, clientY: 100 });
      fireEvent.pointerUp(image, { pointerType: "touch", clientX: 100, clientY: 100 });
      fireEvent.click(image);
    };

    tap();
    expect(main).toHaveAttribute("data-controls", "hidden");
    fireEvent.pointerMove(main, { pointerType: "touch", clientX: 300, clientY: 300 });
    expect(main).toHaveAttribute("data-controls", "hidden");
    tap();
    expect(main).toHaveAttribute("data-controls", "visible");
  });

  it("does not hide the controls when a swipe ends", async () => {
    setup("b");
    const image = await screen.findByAltText("Photo b");
    await waitFor(() => expect(screen.getByRole("link", { name: "Next photo" })).toBeInTheDocument());

    fireEvent.pointerDown(image, { pointerType: "touch", clientX: 300, clientY: 100 });
    fireEvent.pointerUp(image, { pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.click(image);

    expect(push).toHaveBeenLastCalledWith("/photo/c");
    expect(screen.getByRole("main")).toHaveAttribute("data-controls", "visible");
  });

  it("keeps the controls when a quality button is clicked", async () => {
    const user = userEvent.setup();
    setup("b");
    await screen.findByAltText("Photo b");

    await user.click(screen.getByRole("button", { name: "Maximum" }));

    expect(screen.getByRole("main")).toHaveAttribute("data-controls", "visible");
  });

  it("opens and closes the info panel with title, description and camera details", async () => {
    const user = userEvent.setup();
    setup("b");
    await screen.findByAltText("Photo b");
    expect(screen.queryByRole("complementary", { name: "Photo information" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show photo information" }));

    const panel = screen.getByRole("complementary", { name: "Photo information" });
    const text = panel.textContent ?? "";
    expect(text.indexOf("Photo b")).toBeLessThan(text.indexOf("The story of b"));
    expect(text.indexOf("The story of b")).toBeLessThan(text.indexOf("Details"));
    expect(text).toContain("FUJIFILM X-T4");
    expect(text).toContain("f/5.6");
    expect(text).toContain("1/500 s");
    expect(screen.getByRole("button", { name: "Hide photo information" })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Close photo information" }));
    expect(screen.queryByRole("complementary", { name: "Photo information" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show photo information" })).toBeInTheDocument();
  });

  it("closes the panel with Escape before leaving the photo", async () => {
    const user = userEvent.setup();
    setup("b");
    await screen.findByAltText("Photo b");
    await user.click(screen.getByRole("button", { name: "Show photo information" }));

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("complementary", { name: "Photo information" })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(push).toHaveBeenLastCalledWith("/gallery");
  });

  it("toggles the panel from the information button too", async () => {
    const user = userEvent.setup();
    setup("b");
    await screen.findByAltText("Photo b");

    await user.click(screen.getByRole("button", { name: "Show photo information" }));
    await user.click(screen.getByRole("button", { name: "Hide photo information" }));

    expect(screen.queryByRole("complementary", { name: "Photo information" })).not.toBeInTheDocument();
  });

  it("keeps the panel open when a click on the photo hides the controls", async () => {
    const user = userEvent.setup();
    setup("b");
    const image = await screen.findByAltText("Photo b");
    await user.click(screen.getByRole("button", { name: "Show photo information" }));

    fireEvent.pointerDown(image, { pointerType: "mouse", clientX: 200, clientY: 200 });
    fireEvent.pointerUp(image, { pointerType: "mouse", clientX: 200, clientY: 200 });
    fireEvent.click(image, { clientX: 200, clientY: 200 });

    expect(screen.getByRole("main")).toHaveAttribute("data-controls", "hidden");
    expect(screen.getByRole("complementary", { name: "Photo information" })).toBeInTheDocument();
  });

  it("puts the title in the bottom-left corner unless the photo chooses another", async () => {
    setup("b");
    const caption = await screen.findByText("Photo b", { selector: "figcaption" });
    expect(caption).toHaveAttribute("data-position", "BOTTOM_LEFT");
    expect(caption.className).toContain("photo-viewer__title--bottom-left");
  });

  it("puts the title in the corner chosen for the photo", async () => {
    const photo = new Photo({
      id: "t",
      title: "Top",
      width: 10,
      height: 10,
      titlePosition: "TOP_RIGHT",
      renditions: [{ width: 640, url: "https://cdn/t" }],
    });
    render(
      <PhotoViewer
        photoId="t"
        getPhoto={{ execute: vi.fn().mockResolvedValue(photo) }}
        getAllPhotos={{ execute: vi.fn().mockResolvedValue([photo]) }}
      />,
    );

    const caption = await screen.findByText("Top", { selector: "figcaption" });
    expect(caption.className).toContain("photo-viewer__title--top-right");
  });

  it("neither hides the controls nor swipes when the panel is clicked or dragged", async () => {
    const user = userEvent.setup();
    setup("b");
    await screen.findByAltText("Photo b");
    await user.click(screen.getByRole("button", { name: "Show photo information" }));
    const panel = screen.getByRole("complementary", { name: "Photo information" });

    fireEvent.pointerDown(panel, { pointerType: "mouse", clientX: 300, clientY: 100 });
    fireEvent.pointerUp(panel, { pointerType: "mouse", clientX: 100, clientY: 100 });
    fireEvent.click(panel);

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("main")).toHaveAttribute("data-controls", "visible");
  });

  it("says so when no camera details were recorded", async () => {
    const user = userEvent.setup();
    const bare = new Photo({ id: "x", title: "Bare", width: 10, height: 10, renditions: [{ width: 640, url: "https://cdn/x" }] });
    render(
      <PhotoViewer
        photoId="x"
        getPhoto={{ execute: vi.fn().mockResolvedValue(bare) }}
        getAllPhotos={{ execute: vi.fn().mockResolvedValue([bare]) }}
      />,
    );
    await screen.findByAltText("Bare");

    await user.click(screen.getByRole("button", { name: "Show photo information" }));

    expect(screen.getByText("No camera details were recorded for this photo.")).toBeInTheDocument();
  });

  it("explains when the photo does not exist and lets the visitor retry", async () => {
    const getPhoto = { execute: vi.fn().mockResolvedValue(null) };
    const getAllPhotos = { execute: vi.fn().mockResolvedValue([makePhoto("a")]) };
    render(<PhotoViewer photoId="zzz" getPhoto={getPhoto} getAllPhotos={getAllPhotos} />);

    expect(await screen.findByText("Photo not found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
