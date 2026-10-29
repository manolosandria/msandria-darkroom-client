import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import PaletteManager, { GALLERY_SETTINGS_SAVED } from "../PaletteManager";
import { defaultGallerySettings } from "@/src/domain/entities/GallerySettings";
import { manageGallerySettings } from "@/src/infrastructure/gallerySettingsServices";
import { useSessionValue } from "../SessionProvider";

vi.mock("../SessionProvider", () => ({ useSessionValue: vi.fn() }));
vi.mock("../EditingWorkspace", () => ({
  useEditingWorkspace: () => ({ confirm: async () => true }),
  useUnsavedEditor: vi.fn(),
}));
vi.mock("@/src/infrastructure/gallerySettingsServices", () => ({
  manageGallerySettings: { get: vi.fn(), save: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSessionValue).mockReturnValue({
    user: { isAdmin: () => true },
  } as ReturnType<typeof useSessionValue>);
  vi.mocked(manageGallerySettings.get).mockResolvedValue(
    structuredClone({ ...defaultGallerySettings, version: 3 }),
  );
});

describe("Palette manager", () => {
  it("explains where each color goes and saves only the palettes", async () => {
    vi.mocked(manageGallerySettings.save).mockImplementation(async (draft) => ({
      ...draft,
      version: 4,
    }));
    const saved = vi.fn();
    window.addEventListener(GALLERY_SETTINGS_SAVED, saved);
    render(<PaletteManager />);
    const guide = await screen.findByRole("complementary", {
      name: "Where each color goes",
    });
    expect(within(guide).getAllByRole("listitem")).toHaveLength(4);
    expect(guide).toHaveTextContent(/Chosen filters/);
    fireEvent.click(screen.getByRole("button", { name: "Night" }));
    fireEvent.change(screen.getByLabelText("Palette name"), {
      target: { value: "Midnight" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save palettes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Palettes saved.",
    );
    const sent = vi.mocked(manageGallerySettings.save).mock.calls[0][0];
    expect(sent.version).toBe(3);
    expect(sent.blocks).toEqual(defaultGallerySettings.blocks);
    expect(sent.palettes?.some((palette) => palette.name === "Midnight")).toBe(
      true,
    );
    await waitFor(() => expect(saved).toHaveBeenCalled());
    window.removeEventListener(GALLERY_SETTINGS_SAVED, saved);
  });

  it("does not load administrative settings for visitors", () => {
    vi.mocked(useSessionValue).mockReturnValue({
      user: null,
    } as unknown as ReturnType<typeof useSessionValue>);
    render(<PaletteManager />);
    expect(manageGallerySettings.get).not.toHaveBeenCalled();
  });
});
