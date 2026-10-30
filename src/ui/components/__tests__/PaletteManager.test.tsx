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

  it("lights up a color's zones in the drawing while its row is pointed at", async () => {
    render(<PaletteManager />);
    const guide = await screen.findByRole("complementary", {
      name: "Where each color goes",
    });
    const drawing = guide.querySelector(".palette-diagram")!;
    const accent = screen.getByLabelText("Palette accent");
    const row = accent.closest("label")!;
    fireEvent.pointerEnter(row);
    expect(drawing).toHaveAttribute("data-highlight", "accent");
    const legend = within(guide).getAllByRole("listitem");
    expect(legend[2]).toHaveAttribute("data-linked");
    fireEvent.pointerLeave(row);
    expect(drawing).not.toHaveAttribute("data-highlight");
    fireEvent.focus(screen.getByLabelText("Palette surface"));
    expect(drawing).toHaveAttribute("data-highlight", "surface");
    fireEvent.blur(screen.getByLabelText("Palette surface"));
    expect(drawing).not.toHaveAttribute("data-highlight");
    expect(row).toHaveTextContent(/#[0-9A-F]{6}/);
  });

  it("marks the row of a zone pointed at and opens its picker on click", async () => {
    render(<PaletteManager />);
    const guide = await screen.findByRole("complementary", {
      name: "Where each color goes",
    });
    const chip = guide.querySelector(".palette-diagram__chip")!;
    fireEvent.pointerOver(chip);
    const accent = screen.getByLabelText("Palette accent");
    expect(accent.closest("label")).toHaveAttribute("data-linked");
    expect(within(guide).getAllByRole("listitem")[2]).toHaveAttribute(
      "data-linked",
    );
    const opened = vi.fn();
    accent.addEventListener("click", opened);
    fireEvent.click(chip);
    expect(opened).toHaveBeenCalled();
    expect(accent).toHaveFocus();
    fireEvent.pointerLeave(guide.querySelector(".palette-diagram")!);
    expect(accent.closest("label")).not.toHaveAttribute("data-linked");
  });

  it("draws and edits the same palette, whichever side chooses it", async () => {
    render(<PaletteManager />);
    const preview = await screen.findByLabelText("Preview");
    fireEvent.click(screen.getByRole("button", { name: "Night" }));
    expect(
      (preview as HTMLSelectElement).selectedOptions[0],
    ).toHaveTextContent("Night");
    const other = within(preview).getAllByRole("option")[0];
    fireEvent.change(preview, {
      target: { value: (other as HTMLOptionElement).value },
    });
    expect(
      screen.getByRole("button", { name: other.textContent! }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("does not load administrative settings for visitors", () => {
    vi.mocked(useSessionValue).mockReturnValue({
      user: null,
    } as unknown as ReturnType<typeof useSessionValue>);
    render(<PaletteManager />);
    expect(manageGallerySettings.get).not.toHaveBeenCalled();
  });
});
