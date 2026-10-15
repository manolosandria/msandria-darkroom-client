import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PhotoViewer from "../PhotoViewer";
import { Photo } from "@/src/domain/entities/Photo";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function makePhoto(id: string, frame?: ReturnType<Photo["getFrame"]>) {
  return new Photo({
    id,
    title: `Photo ${id}`,
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

  it("links to the neighbouring photos and to the gallery", async () => {
    setup("b");
    await screen.findByAltText("Photo b");

    await waitFor(() => expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/photo/a"));
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/photo/c");
    expect(screen.getByRole("link", { name: "Gallery" })).toHaveAttribute("href", "/gallery");
  });

  it("offers no previous link on the first photo and no next on the last", async () => {
    setup("a");
    await screen.findByAltText("Photo a");
    await waitFor(() => expect(screen.getByRole("link", { name: "Next" })).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Previous" })).not.toBeInTheDocument();
  });

  it("moves with the arrow keys and leaves with Escape", async () => {
    setup("b");
    await waitFor(() => expect(screen.getByRole("link", { name: "Next" })).toBeInTheDocument());

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
    await waitFor(() => expect(screen.getByRole("link", { name: "Next" })).toBeInTheDocument());
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

  it("explains when the photo does not exist and lets the visitor retry", async () => {
    const getPhoto = { execute: vi.fn().mockResolvedValue(null) };
    const getAllPhotos = { execute: vi.fn().mockResolvedValue([makePhoto("a")]) };
    render(<PhotoViewer photoId="zzz" getPhoto={getPhoto} getAllPhotos={getAllPhotos} />);

    expect(await screen.findByText("Photo not found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
