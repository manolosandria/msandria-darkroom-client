import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhotoOptimizationIssue } from "@/src/domain/entities/PhotoOptimizationIssue";
import { Photo } from "@/src/domain/entities/Photo";
import { PhotoUploadError } from "@/src/domain/repositories/PhotoRepository";
import { User } from "@/src/domain/entities/User";
import { getManagedPhotos, getPhotoById, savePhoto, getUnoptimizedPhotos, replacePhoto } from "@/src/infrastructure/photoServices";
vi.mock('@/src/infrastructure/catalogServices', () => ({ manageCatalog: { load: vi.fn().mockResolvedValue({ categories: [], collections: [], works: [], photos: [] }) } }));
import { SessionProvider } from "../SessionProvider";
import ManagePhotos from "../ManagePhotos";

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
  vi.mocked(getManagedPhotos.execute).mockResolvedValue([photo]);
  vi.mocked(savePhoto.execute).mockImplementation(async (updated) => {
    vi.mocked(getPhotoById.execute).mockResolvedValue(updated);
  });
  vi.mocked(getPhotoById.execute).mockResolvedValue(photo);
});

describe("ManagePhotos", () => {
  it("keeps edits after a conflict and reloads the latest state only on request", async () => {
    vi.mocked(savePhoto.execute).mockRejectedValueOnce(new PhotoUploadError("conflict", "changed"));
    show();
    await userEvent.click(await screen.findByRole("button", { name: "The coast" }));
    await screen.findByLabelText("Description");
    await userEvent.type(screen.getByLabelText("Description"), "My unsaved story");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This photo changed while you were editing it. Reload its state before saving.");
    expect(screen.getByLabelText("Description")).toHaveValue("My unsaved story");
    const current = new Photo({ id: "photo", version: 2, title: "Latest coast", description: "Saved elsewhere", width: 1800, height: 1200, visibility: "PRIVATE", categoryNames: ["Sea"], renditions: [{ width: 640, url: "https://cdn/latest.jpg" }] });
    vi.mocked(getPhotoById.execute).mockResolvedValue(current);
    await userEvent.click(screen.getByRole("button", { name: "Reload state" }));
    expect(await screen.findByLabelText("Description")).toHaveValue("Saved elsewhere");
    expect(screen.getByLabelText("Visibility")).toHaveValue("PRIVATE");
    expect(screen.queryByRole("button", { name: "Reload state" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Changes saved.");
    expect(vi.mocked(savePhoto.execute).mock.lastCall?.[0].getVersion()).toBe(2);
  });

  it("retains private classification and the new version after replacing and reopening a photo", async () => {
    const updated = new Photo({ id: "photo", version: 2, title: "The coast", width: 2400, height: 1600, visibility: "PRIVATE", categoryNames: ["Sea"], collections: [{ id: "sea", position: 2 }], renditions: [{ width: 640, url: "https://cdn/new.jpg" }] });
    const other = new Photo({ id: "other", title: "Other photo", width: 640, height: 480, renditions: [{ width: 640, url: "https://cdn/other.jpg" }] });
    vi.mocked(getManagedPhotos.execute).mockResolvedValue([photo, other]);
    vi.mocked(replacePhoto.execute).mockResolvedValue({ photo: updated, optimizationIssues: [] });
    show();
    await userEvent.click(await screen.findByRole("button", { name: "The coast" }));
    await userEvent.upload(await screen.findByLabelText("Replacement file"), new File(["image"], "new.jpg", { type: "image/jpeg" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Changes saved.");
    await userEvent.click(screen.getByRole("button", { name: "Other photo" }));
    await screen.findByLabelText("Description");
    await userEvent.click(screen.getByRole("button", { name: "The coast" }));
    expect(await screen.findByLabelText("Visibility")).toHaveValue("PRIVATE");
    expect(screen.getByRole("button", { name: "Remove category Sea" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Changes saved.");
    expect(vi.mocked(savePhoto.execute).mock.lastCall?.[0].getClassification()).toEqual(updated.getClassification());
    expect(vi.mocked(savePhoto.execute).mock.lastCall?.[0].getVersion()).toBe(2);
  });
  it("shows only outstanding photos and removes a resolved replacement from the pending list", async () => {
    const issue = new PhotoOptimizationIssue({ kind: "LOCATION", resolution: "NEEDS_REUPLOAD", unit: "TAG_COUNT", currentValue: "2", recommendedValue: "0" });
    vi.mocked(getUnoptimizedPhotos.execute).mockResolvedValue([{ photo, optimizationIssues: [issue] }]);
    const replacement = new Photo({ id: "photo", title: "The coast", width: 2400, height: 1600, renditions: [{ width: 640, url: "https://cdn/new.jpg" }] });
    vi.mocked(replacePhoto.execute).mockResolvedValue({ photo: replacement, optimizationIssues: [] });
    show();
    await userEvent.click(await screen.findByRole("checkbox", { name: "Only photos needing optimization" }));
    await userEvent.click(await screen.findByRole("button", { name: "The coast" }));
    expect(await screen.findByText("GPS location")).toBeInTheDocument();
    const file = new File(["image"], "new.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByLabelText("Replacement file"), file);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("No photos need optimization.");
    expect(replacePhoto.execute).toHaveBeenCalledWith(expect.any(Photo), file, photo);
    expect(savePhoto.execute).not.toHaveBeenCalled();
  });
  it("keeps the chosen file and edits available after replacement fails", async () => {
    vi.mocked(replacePhoto.execute).mockRejectedValue(new Error("offline"));
    show();
    await userEvent.click(await screen.findByRole("button", { name: "The coast" }));
    const input = await screen.findByLabelText("Replacement file");
    const file = new File(["image"], "new.jpg", { type: "image/jpeg" });
    await userEvent.upload(input, file);
    await userEvent.type(screen.getByLabelText("Description"), "Preserved story");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Description")).toHaveValue("Preserved story");
    expect((input as HTMLInputElement).files?.[0]).toBe(file);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(replacePhoto.execute).toHaveBeenCalledTimes(2);
  });

  it("loads persisted highlights and saves edits without uploading another file", async () => {
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "The coast" }),
    );
    expect(await screen.findByAltText("square thumbnail preview")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.type(screen.getByLabelText("Title"), "Coastal light");
    await userEvent.click(
      screen.getByRole("button", { name: "Remove square highlight" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
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
    const detail = new Photo({ id: "photo", title: "The coast", width: 1800, height: 1200,
      description: "A story only in the detail", renditions: [{ width: 1800, url: "https://cdn/detail.jpg" }] });
    vi.mocked(getPhotoById.execute).mockResolvedValue(detail);
    show();
    expect(getPhotoById.execute).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole("button", { name: "The coast" }));
    expect(await screen.findByLabelText("Description")).toHaveValue("A story only in the detail");
    expect(getPhotoById.execute).toHaveBeenCalledWith("photo");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Changes saved.");
    expect(vi.mocked(savePhoto.execute).mock.calls[0][0].getDescription()).toBe("A story only in the detail");
  });

  it("saves the title corner chosen for the viewer, starting from the photo's own", async () => {
    const detail = new Photo({ id: "photo", title: "The coast", width: 1800, height: 1200,
      titlePosition: "TOP_LEFT", renditions: [{ width: 1800, url: "https://cdn/detail.jpg" }] });
    vi.mocked(getPhotoById.execute).mockResolvedValue(detail);
    show();
    await userEvent.click(await screen.findByRole("button", { name: "The coast" }));
    const corner = await screen.findByLabelText("Title corner in the viewer");
    expect(corner).toHaveValue("TOP_LEFT");
    await userEvent.selectOptions(corner, "BOTTOM_RIGHT");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Changes saved.");
    expect(vi.mocked(savePhoto.execute).mock.calls[0][0].getTitlePosition()).toBe("BOTTOM_RIGHT");
  });

  it("offers retry after detail fails without opening an empty editor", async () => {
    vi.mocked(getPhotoById.execute).mockRejectedValueOnce(new Error("offline"));
    show();
    await userEvent.click(await screen.findByRole("button", { name: "The coast" }));
    await screen.findByText("Failed to fetch photos");
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
    expect(savePhoto.execute).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /retry|try again/i }));
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
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not reach the API",
      ),
    );
    expect(screen.getByLabelText("Description")).toHaveValue("Evening walk");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });
});
