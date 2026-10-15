import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Photo } from "@/src/domain/entities/Photo";
import { User } from "@/src/domain/entities/User";
import { getAllPhotos, getPhotoById, savePhoto } from "@/src/infrastructure/photoServices";
import { SessionProvider } from "../SessionProvider";
import ManagePhotos from "../ManagePhotos";

vi.mock("@/src/infrastructure/photoServices", () => ({
  getAllPhotos: { execute: vi.fn() },
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
  vi.mocked(getAllPhotos.execute).mockResolvedValue([photo]);
  vi.mocked(savePhoto.execute).mockResolvedValue();
  vi.mocked(getPhotoById.execute).mockResolvedValue(photo);
});

describe("ManagePhotos", () => {
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
