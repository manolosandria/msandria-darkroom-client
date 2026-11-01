import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  resetHiddenSectionsForTests,
  writeInspectorView,
} from "@/src/ui/photoSectionPreference";
import userEvent from "@testing-library/user-event";
import { PhotoOptimizationIssue } from "@/src/domain/entities/PhotoOptimizationIssue";
import { Photo } from "@/src/domain/entities/Photo";
import { PhotoUploadError } from "@/src/domain/repositories/PhotoRepository";
import { User } from "@/src/domain/entities/User";
import {
  getManagedPhotos,
  getPhotoById,
  savePhoto,
  getUnoptimizedPhotos,
  replacePhoto,
} from "@/src/infrastructure/photoServices";
vi.mock("@/src/infrastructure/catalogServices", () => ({
  manageCatalog: {
    load: vi
      .fn()
      .mockResolvedValue({
        categories: [],
        collections: [],
        works: [],
        photos: [],
      }),
  },
}));
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import { SessionProvider } from "../SessionProvider";
import ManagePhotos from "../ManagePhotos";
import { choose, chooseWhenReady } from "./chooseOption";

vi.mock("@/src/infrastructure/photoServices", () => ({
  getManagedPhotos: { execute: vi.fn() },
  getUnoptimizedPhotos: { execute: vi.fn() },
  replacePhoto: { execute: vi.fn() },
  savePhoto: { execute: vi.fn() },
  getPhotoById: { execute: vi.fn() },
}));
const photo = new Photo({
  id: "photo",
  title: "The coast",
  width: 1800,
  height: 1200,
  renditions: [{ width: 640, url: "https://cdn/coast.jpg" }],
  highlights: { square: { x: 0.1, y: 0.1, width: 0.4, height: 0.6 } },
});
const admin = new User({
  id: "admin",
  email: "admin@example.com",
  role: "ADMIN",
});
const ports = {
  getCurrentUser: vi.fn(async () => admin),
  signIn: vi.fn(),
  signOut: vi.fn(),
};
function show() {
  render(
    <SessionProvider ports={ports}>
      <ManagePhotos />
    </SessionProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  // Most of these tests read the sections in one scroll; the tabs have their own.
  writeInspectorView("scroll");
  vi.mocked(getManagedPhotos.execute).mockResolvedValue([photo]);
  vi.mocked(savePhoto.execute).mockImplementation(async (updated) => {
    vi.mocked(getPhotoById.execute).mockResolvedValue(updated);
  });
  vi.mocked(getPhotoById.execute).mockResolvedValue(photo);
});

describe("ManagePhotos", () => {
  it("filters the library by title, category and camera inside its scrolling card", async () => {
    const shot = (id: string, title: string, make: string, model: string) =>
      new Photo({
        id,
        title,
        width: 640,
        height: 480,
        renditions: [{ width: 640, url: `https://cdn/${id}.jpg` }],
        metadata: {
          camera: { make, model, lens: null, iso: null, aperture: null, exposureTime: null, focalLength: null },
        },
      });
    vi.mocked(getManagedPhotos.execute).mockResolvedValue([
      shot("a", "Café at dawn", "FUJIFILM", "X-T4"),
      shot("b", "Harbour", "Canon", "Canon EOS R6"),
      shot("c", "Dawn harbour", "Canon", "Canon EOS R6"),
    ]);
    const empty = await manageCatalog.load();
    vi.mocked(manageCatalog.load).mockResolvedValue({
      ...empty,
      categories: [{ id: "sea", name: "Sea" }],
      photos: [{ id: "b", categories: [{ id: "sea" }] }, { id: "c", categories: [{ id: "sea" }] }],
    });
    const user = userEvent.setup();
    show();
    const library = await screen.findByRole("navigation", { name: "Published photos" });
    expect(library.closest(".studio-card")).not.toBeNull();
    await screen.findByRole("button", { name: "Harbour" });
    await user.type(screen.getByRole("searchbox"), "cafe");
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(1);
    expect(screen.getByText("1 of 3 photos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    choose(screen.getByLabelText("Camera"), "Canon EOS R6");
    await chooseWhenReady(await screen.findByLabelText("Category"), "Sea");
    await user.type(screen.getByRole("searchbox"), "dawn");
    expect(screen.getByRole("button", { name: "Dawn harbour" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Harbour" })).not.toBeInTheDocument();
    choose(screen.getByLabelText("Camera"), "FUJIFILM X-T4");
    expect(screen.getByText("No photos match these filters.")).toBeInTheDocument();
    vi.mocked(manageCatalog.load).mockResolvedValue(empty);
  });

  it("keeps unsaved edits while switching photos and confirms cancellation", async () => {
    const other = new Photo({
      id: "other",
      title: "Other photo",
      width: 640,
      height: 480,
      renditions: [{ width: 640, url: "https://cdn/other.jpg" }],
    });
    vi.mocked(getManagedPhotos.execute).mockResolvedValue([photo, other]);
    vi.mocked(getPhotoById.execute).mockImplementation(async (id) =>
      id === "other" ? other : photo,
    );
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "The coast" }),
    );
    await userEvent.type(await screen.findByLabelText("Title"), " unsaved");
    expect(
      screen.getAllByRole("button", { name: "Save changes" }),
    ).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Other photo" }));
    expect(await screen.findByLabelText("Title")).toHaveValue("Other photo");
    await userEvent.click(screen.getByRole("button", { name: "The coast" }));
    expect(await screen.findByLabelText("Title")).toHaveValue(
      "The coast unsaved",
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: "Cancel changes" })[0],
    );
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Enter}");
    expect(screen.getByLabelText("Title")).toHaveValue("The coast");
    expect(savePhoto.execute).not.toHaveBeenCalled();
  });
  it("keeps edits after a conflict and reloads the latest state only on request", async () => {
    vi.mocked(savePhoto.execute).mockRejectedValueOnce(
      new PhotoUploadError("conflict", "changed"),
    );
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "The coast" }),
    );
    await screen.findByLabelText("Description");
    await userEvent.type(
      screen.getByLabelText("Description"),
      "My unsaved story",
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: "Save changes" })[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Accept" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This photo changed while you were editing it. Reload its state before saving.",
    );
    expect(screen.getByLabelText("Description")).toHaveValue(
      "My unsaved story",
    );
    const current = new Photo({
      id: "photo",
      version: 2,
      title: "Latest coast",
      description: "Saved elsewhere",
      width: 1800,
      height: 1200,
      visibility: "PRIVATE",
      categoryNames: ["Sea"],
      renditions: [{ width: 640, url: "https://cdn/latest.jpg" }],
    });
    vi.mocked(getPhotoById.execute).mockResolvedValue(current);
    await userEvent.click(screen.getByRole("button", { name: "Reload state" }));
    expect(await screen.findByLabelText("Description")).toHaveValue(
      "Saved elsewhere",
    );
    expect(screen.getByRole("radio", { name: /Private/ })).toBeChecked();
    expect(
      screen.queryByRole("button", { name: "Reload state" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Save changes" })[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Accept" }),
    );
    await screen.findByText("Changes saved.");
    expect(vi.mocked(savePhoto.execute).mock.lastCall?.[0].getVersion()).toBe(
      2,
    );
  });

  it("retains private classification and the new version after replacing and reopening a photo", async () => {
    const updated = new Photo({
      id: "photo",
      version: 2,
      title: "The coast",
      width: 2400,
      height: 1600,
      visibility: "PRIVATE",
      categoryNames: ["Sea"],
      collections: [{ id: "sea", position: 2 }],
      renditions: [{ width: 640, url: "https://cdn/new.jpg" }],
    });
    const other = new Photo({
      id: "other",
      title: "Other photo",
      width: 640,
      height: 480,
      renditions: [{ width: 640, url: "https://cdn/other.jpg" }],
    });
    vi.mocked(getManagedPhotos.execute).mockResolvedValue([photo, other]);
    vi.mocked(replacePhoto.execute).mockResolvedValue({
      photo: updated,
      optimizationIssues: [],
    });
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "The coast" }),
    );
    await userEvent.upload(
      await screen.findByLabelText("Replacement file"),
      new File(["image"], "new.jpg", { type: "image/jpeg" }),
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: "Save changes" })[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Accept" }),
    );
    await screen.findByText("Changes saved.");
    await userEvent.click(screen.getByRole("button", { name: "Other photo" }));
    await screen.findByLabelText("Description");
    await userEvent.click(screen.getByRole("button", { name: "The coast" }));
    expect(await screen.findByRole("radio", { name: /Private/ })).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Remove category Sea" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Save changes" })[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Accept" }),
    );
    await screen.findByText("Changes saved.");
    expect(
      vi.mocked(savePhoto.execute).mock.lastCall?.[0].getClassification(),
    ).toEqual(updated.getClassification());
    expect(vi.mocked(savePhoto.execute).mock.lastCall?.[0].getVersion()).toBe(
      2,
    );
  });
  it("shows only outstanding photos and removes a resolved replacement from the pending list", async () => {
    const issue = new PhotoOptimizationIssue({
      kind: "LOCATION",
      resolution: "NEEDS_REUPLOAD",
      unit: "TAG_COUNT",
      currentValue: "2",
      recommendedValue: "0",
    });
    vi.mocked(getUnoptimizedPhotos.execute).mockResolvedValue([
      { photo, optimizationIssues: [issue] },
    ]);
    const replacement = new Photo({
      id: "photo",
      title: "The coast",
      width: 2400,
      height: 1600,
      renditions: [{ width: 640, url: "https://cdn/new.jpg" }],
    });
    vi.mocked(replacePhoto.execute).mockResolvedValue({
      photo: replacement,
      optimizationIssues: [],
    });
    show();
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Only photos needing optimization",
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "The coast" }),
    );
    expect(await screen.findByText("GPS location")).toBeInTheDocument();
    const file = new File(["image"], "new.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByLabelText("Replacement file"), file);
    await userEvent.click(
      screen.getAllByRole("button", { name: "Save changes" })[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Accept" }),
    );
    await screen.findByText("No photos need optimization.");
    expect(replacePhoto.execute).toHaveBeenCalledWith(
      expect.any(Photo),
      file,
      photo,
    );
    expect(savePhoto.execute).not.toHaveBeenCalled();
  });
  it("keeps the chosen file and edits available after replacement fails", async () => {
    vi.mocked(replacePhoto.execute).mockRejectedValue(new Error("offline"));
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "The coast" }),
    );
    const input = await screen.findByLabelText("Replacement file");
    const file = new File(["image"], "new.jpg", { type: "image/jpeg" });
    await userEvent.upload(input, file);
    await userEvent.type(
      screen.getByLabelText("Description"),
      "Preserved story",
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: "Save changes" })[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Accept" }),
    );
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Description")).toHaveValue("Preserved story");
    expect((input as HTMLInputElement).files?.[0]).toBe(file);
    await userEvent.click(
      screen.getAllByRole("button", { name: "Save changes" })[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Accept" }),
    );
    expect(replacePhoto.execute).toHaveBeenCalledTimes(2);
  });

  it("loads persisted highlights and saves edits without uploading another file", async () => {
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "The coast" }),
    );
    expect(
      await screen.findByAltText("square thumbnail preview"),
    ).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.type(screen.getByLabelText("Title"), "Coastal light");
    await userEvent.click(
      screen.getByRole("button", { name: "Remove square highlight" }),
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: "Save changes" })[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Accept" }),
    );
    expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
    const saved = vi.mocked(savePhoto.execute).mock.calls[0][0];
    expect(saved.getTitle()).toBe("Coastal light");
    expect(saved.getHighlights()).toEqual({});
    expect(saved.getId()).toBe("photo");
    expect(
      screen.getByRole("button", { name: "Coastal light" }),
    ).toBeInTheDocument();
  });
  it("loads the description from detail before editing a compact listing item", async () => {
    const detail = new Photo({
      id: "photo",
      title: "The coast",
      width: 1800,
      height: 1200,
      description: "A story only in the detail",
      renditions: [{ width: 1800, url: "https://cdn/detail.jpg" }],
    });
    vi.mocked(getPhotoById.execute).mockResolvedValue(detail);
    show();
    expect(getPhotoById.execute).not.toHaveBeenCalled();
    await userEvent.click(
      await screen.findByRole("button", { name: "The coast" }),
    );
    expect(await screen.findByLabelText("Description")).toHaveValue(
      "A story only in the detail",
    );
    expect(getPhotoById.execute).toHaveBeenCalledWith("photo");
    await userEvent.click(
      screen.getAllByRole("button", { name: "Save changes" })[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Accept" }),
    );
    await screen.findByText("Changes saved.");
    expect(vi.mocked(savePhoto.execute).mock.calls[0][0].getDescription()).toBe(
      "A story only in the detail",
    );
  });

  it("saves the title corner chosen for the viewer, starting from the photo's own", async () => {
    const detail = new Photo({
      id: "photo",
      title: "The coast",
      width: 1800,
      height: 1200,
      titlePosition: "TOP_LEFT",
      renditions: [{ width: 1800, url: "https://cdn/detail.jpg" }],
    });
    vi.mocked(getPhotoById.execute).mockResolvedValue(detail);
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "The coast" }),
    );
    expect(await screen.findByRole("radio", { name: "Top left" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Bottom right" }));
    await userEvent.click(
      screen.getAllByRole("button", { name: "Save changes" })[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Accept" }),
    );
    await screen.findByText("Changes saved.");
    expect(
      vi.mocked(savePhoto.execute).mock.calls[0][0].getTitlePosition(),
    ).toBe("BOTTOM_RIGHT");
  });

  it("saves the frame, starting from the photo's own", async () => {
    vi.mocked(getPhotoById.execute).mockResolvedValue(
      new Photo({
        id: "photo",
        title: "The coast",
        width: 1800,
        height: 1200,
        frame: { color: "#ffffff", leftRight: 4, topBottom: 4 },
        renditions: [{ width: 1800, url: "https://cdn/detail.jpg" }],
      }),
    );
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "The coast" }),
    );
    expect(
      await screen.findByRole("checkbox", { name: /show a frame/i }),
    ).toBeChecked();
    fireEvent.change(
      screen.getByRole("slider", { name: "Top and bottom thickness" }),
      { target: { value: "8" } },
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: "Save changes" })[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Accept" }),
    );
    await screen.findByText("Changes saved.");
    expect(vi.mocked(savePhoto.execute).mock.calls[0][0].getFrame()).toEqual({
      color: "#ffffff",
      leftRight: 4,
      topBottom: 8,
    });
  });

  it("offers retry after detail fails without opening an empty editor", async () => {
    vi.mocked(getPhotoById.execute).mockRejectedValueOnce(new Error("offline"));
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "The coast" }),
    );
    await screen.findByText("Failed to fetch photos");
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
    expect(savePhoto.execute).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: /retry|try again/i }),
    );
    expect(await screen.findByLabelText("Title")).toHaveValue("The coast");
  });

  it("keeps edits available after a failed save", async () => {
    vi.mocked(savePhoto.execute).mockRejectedValueOnce(new Error("offline"));
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "The coast" }),
    );
    await screen.findByLabelText("Description");
    await userEvent.type(screen.getByLabelText("Description"), "Evening walk");
    await userEvent.click(
      screen.getAllByRole("button", { name: "Save changes" })[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Accept" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not reach the API",
      ),
    );
    expect(screen.getByLabelText("Description")).toHaveValue("Evening walk");
    expect(
      screen.getAllByRole("button", { name: "Save changes" })[0],
    ).toBeEnabled();
  });

  it("browses as a grid or a list and returns to the library from the editor", async () => {
    const user = userEvent.setup();
    show();
    const library = await screen.findByRole("navigation", { name: "Published photos" });
    expect(library).toHaveClass("photo-browser--grid");
    await user.click(screen.getByRole("radio", { name: "List" }));
    expect(library).toHaveClass("photo-browser--list");
    expect(within(library).getByText("Public")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "The coast" }));
    await screen.findByLabelText("Title");
    expect(library).toHaveClass("photo-browser--strip");
    expect(screen.queryByRole("radio", { name: "List" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Library/ }));
    expect(library).toHaveClass("photo-browser--list");
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("shows a chosen highlight large and jumps to a collapsed section", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: "The coast" }));
    const views = await screen.findByRole("radiogroup", { name: "Preview view" });
    expect(within(views).getByRole("radio", { name: "Original" })).toHaveAttribute("aria-checked", "true");
    await user.click(within(views).getByRole("radio", { name: /Square/ }));
    expect(within(views).getByRole("radio", { name: /Square/ })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: "Collapse all" }));
    const frame = screen.getByText("Frame", { selector: "summary span" }).closest("details");
    expect(frame).not.toHaveAttribute("open");
    await user.click(within(screen.getByRole("navigation", { name: "Photo sections" })).getByRole("button", { name: "Frame" }));
    expect(frame).toHaveAttribute("open");
  });

  it("shows one section at a time as tabs, keeping the others' edits", async () => {
    const user = userEvent.setup();
    writeInspectorView("tabs");
    show();
    await user.click(await screen.findByRole("button", { name: "The coast" }));
    const nav = await screen.findByRole("navigation", { name: "Photo sections" });
    const slotOf = (name: string) =>
      screen.getByText(name, { selector: "summary span" }).closest(".photo-develop__slot");
    expect(slotOf("Details")).not.toHaveAttribute("hidden");
    expect(slotOf("Frame")).toHaveAttribute("hidden");
    expect(screen.queryByRole("button", { name: "Collapse all" })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "The bay");
    await user.click(within(nav).getByRole("button", { name: "Frame" }));
    expect(slotOf("Frame")).not.toHaveAttribute("hidden");
    expect(slotOf("Frame")!.querySelector("details")).toHaveAttribute("open");
    expect(slotOf("Details")).toHaveAttribute("hidden");
    await user.click(within(nav).getByRole("button", { name: "Details" }));
    expect(screen.getByLabelText("Title")).toHaveValue("The bay");
  });

  it("returns to Details when the title is missing on another tab, and remembers the view", async () => {
    const user = userEvent.setup();
    writeInspectorView("tabs");
    show();
    await user.click(await screen.findByRole("button", { name: "The coast" }));
    const nav = await screen.findByRole("navigation", { name: "Photo sections" });
    await user.clear(screen.getByLabelText("Title"));
    await user.click(within(nav).getByRole("button", { name: "Frame" }));
    fireEvent.submit(screen.getByLabelText("Title").closest("form")!);
    expect(within(nav).getByRole("button", { name: "Details" })).toHaveAttribute("aria-current", "true");
    expect(savePhoto.execute).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "All in one scroll" }));
    expect(window.localStorage.getItem("photoInspectorView")).toBe("scroll");
    expect(screen.getByRole("button", { name: "Collapse all" })).toBeInTheDocument();
  });

  it("hides a section without losing its state and remembers it for the next visit", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    resetHiddenSectionsForTests();
    show();
    await user.click(await screen.findByRole("button", { name: "The coast" }));
    const nav = await screen.findByRole("navigation", { name: "Photo sections" });
    await user.click(screen.getByRole("button", { name: "Show or hide sections" }));
    await user.click(screen.getByRole("checkbox", { name: /Frame/ }));
    const slot = screen
      .getByText("Frame", { selector: "summary span" })
      .closest(".photo-develop__slot");
    expect(slot).toHaveAttribute("hidden");
    expect(within(nav).queryByRole("button", { name: "Frame" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("photoInspectorHiddenSections")).toBe('["frame"]');
    await user.click(screen.getByRole("checkbox", { name: /Frame/ }));
    expect(slot).not.toHaveAttribute("hidden");
    expect(screen.getByRole("checkbox", { name: /Details/ })).toBeDisabled();
    await user.click(within(nav).getByRole("button", { name: "Frame" }));
    await user.click(screen.getByRole("button", { name: "Show or hide sections" }));
    await user.click(screen.getByRole("checkbox", { name: /Frame/ }));
    expect(within(nav).getByRole("button", { name: "Details" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    window.localStorage.clear();
    resetHiddenSectionsForTests();
  });

  it("starts with the remembered sections hidden and follows the section being read", async () => {
    const user = userEvent.setup();
    resetHiddenSectionsForTests();
    window.localStorage.setItem(
      "photoInspectorHiddenSections",
      '["details","highlights"]',
    );
    const observed: Element[] = [];
    let report: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {};
    const original = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
        report = callback;
      }
      observe(element: Element) {
        observed.push(element);
      }
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
    try {
      show();
      await user.click(await screen.findByRole("button", { name: "The coast" }));
      const nav = await screen.findByRole("navigation", { name: "Photo sections" });
      expect(within(nav).getByRole("button", { name: "Details" })).toBeInTheDocument();
      expect(within(nav).queryByRole("button", { name: "Highlights" })).not.toBeInTheDocument();
      const frame = observed.find(
        (element) => (element as HTMLElement).dataset.section === "frame",
      )!;
      act(() =>
        report([
          { target: frame, isIntersecting: true },
          { target: document.createElement("div"), isIntersecting: false },
        ]),
      );
      expect(within(nav).getByRole("button", { name: "Frame" })).toHaveAttribute(
        "aria-current",
        "true",
      );
      await user.click(within(nav).getByRole("button", { name: "Visibility" }));
      act(() => report([{ target: frame, isIntersecting: false }]));
      expect(within(nav).getByRole("button", { name: "Visibility" })).toHaveAttribute(
        "aria-current",
        "true",
      );
      act(() => report([]));
    } finally {
      globalThis.IntersectionObserver = original;
      window.localStorage.clear();
      resetHiddenSectionsForTests();
    }
  });

  it("warns that a replacement loses the current file and lets the curator keep it", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: "The coast" }));
    await user.upload(
      await screen.findByLabelText("Replacement file"),
      new File(["image"], "new.jpg", { type: "image/jpeg" }),
    );
    expect(screen.getByText("⚠ The current file will be lost.")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Save changes" })[0]);
    expect(await screen.findByRole("dialog")).toHaveTextContent("cannot be recovered");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Keep the current file" }));
    expect(screen.queryByText("⚠ The current file will be lost.")).not.toBeInTheDocument();
    expect(replacePhoto.execute).not.toHaveBeenCalled();
  });
});
