import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Photo } from "@/src/domain/entities/Photo";
import { User } from "@/src/domain/entities/User";
import { getAllPhotos, savePhoto } from "@/src/infrastructure/photoServices";
import { SessionProvider } from "../SessionProvider";
import ManagePhotos from "../ManagePhotos";

vi.mock("@/src/infrastructure/photoServices", () => ({
  getAllPhotos: { execute: vi.fn() },
  savePhoto: { execute: vi.fn() },
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
});

describe("ManagePhotos", () => {
  it("loads persisted highlights and saves edits without uploading another file", async () => {
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "The coast" }),
    );
    expect(screen.getByAltText("square thumbnail preview")).toBeInTheDocument();
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
  it("keeps edits available after a failed save", async () => {
    vi.mocked(savePhoto.execute).mockRejectedValueOnce(new Error("offline"));
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "The coast" }),
    );
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
