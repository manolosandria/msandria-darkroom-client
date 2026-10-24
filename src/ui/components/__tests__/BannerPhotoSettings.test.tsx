import { savePhoto, getPhotoById } from "@/src/infrastructure/photoServices";
vi.mock("../HighlightEditor", () => ({
  HighlightEditor: ({
    onChange,
    value,
  }: {
    onChange: (value: object) => void;
    value: object;
  }) => (
    <button
      onClick={() =>
        onChange({ ...value, square: { x: 0, y: 0, width: 0.5, height: 0.5 } })
      }
    >
      Change crop
    </button>
  ),
}));
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BannerPhotoSettings } from "../BannerPhotoSettings";
import { Photo } from "@/src/domain/entities/Photo";
import { defaultHomeBanner } from "@/src/domain/entities/HomeBanner";
vi.mock("../EditingWorkspace", () => ({
  useEditingWorkspace: () => ({ confirm: async () => true }),
  useUnsavedEditor: vi.fn(),
}));
describe("Banner photo settings", () => {
  it("saves photo highlights separately from the banner and refreshes the version", async () => {
    const photo = new Photo({
      id: "a",
      title: "Photo",
      width: 1000,
      height: 1000,
      version: 3,
      renditions: [{ width: 640, url: "https://cdn/a.jpg" }],
    });
    const saved = vi.spyOn(savePhoto, "execute").mockResolvedValue(undefined);
    const reload = vi.spyOn(getPhotoById, "execute").mockResolvedValue(photo);
    const updated = vi.fn();
    render(
      <BannerPhotoSettings
        photo={photo}
        banner={defaultHomeBanner}
        onChange={() => {}}
        onClose={() => {}}
        onUpdated={updated}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Edit photo highlights/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Change crop" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save photo highlights" }),
    );
    await waitFor(() => expect(updated).toHaveBeenCalledWith(photo));
    expect(saved).toHaveBeenCalledWith(expect.any(Photo), photo);
    expect(saved.mock.calls[0][0].getHighlights()).toEqual({
      square: { x: 0, y: 0, width: 0.5, height: 0.5 },
    });
    saved.mockRestore();
    reload.mockRestore();
  });
  it("filters highlights by ratio and saves the exact custom choice for one device", () => {
    const photo = new Photo({
      id: "a",
      title: "Test photo",
      width: 1800,
      height: 1200,
      renditions: [{ width: 640, url: "https://cdn/a.jpg" }],
      highlights: {
        custom: [
          {
            id: "detail",
            name: "My detail",
            crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
          },
        ],
      },
    });
    const change = vi.fn();
    render(
      <BannerPhotoSettings
        photo={photo}
        banner={defaultHomeBanner}
        onChange={change}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Square 1:1" }));
    expect(screen.queryByText("My detail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Landscape 3:2" }));
    fireEvent.click(screen.getByRole("button", { name: /My detail/ }));
    expect(change).toHaveBeenCalledWith([
      { photoId: "a", desktop: "custom:detail", mobile: "portrait" },
    ]);
  });
});

it("keeps Gallery's aspect matrix when saving photo crops from Home", async () => {
  const presentation = {
    gallery: ["original"],
    home: ["original"],
    galleryRules: [{ layout: "random", aspect: "square", views: ["original"] }],
  };
  const photo = new Photo({
    id: "a",
    title: "Photo",
    width: 1000,
    height: 1000,
    version: 3,
    renditions: [{ width: 640, url: "https://cdn/a.jpg" }],
    highlights: { presentation },
  });
  const saved = vi.spyOn(savePhoto, "execute").mockResolvedValue(undefined);
  const reload = vi.spyOn(getPhotoById, "execute").mockResolvedValue(photo);
  const updated = vi.fn();
  render(
    <BannerPhotoSettings
      photo={photo}
      banner={defaultHomeBanner}
      onChange={() => {}}
      onClose={() => {}}
      onUpdated={updated}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /Edit photo highlights/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Change crop" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Save photo highlights" }),
  );
  await waitFor(() => expect(updated).toHaveBeenCalledWith(photo));
  expect(saved.mock.calls[0][0].getHighlights().presentation).toEqual(
    presentation,
  );
  saved.mockRestore();
  reload.mockRestore();
});
