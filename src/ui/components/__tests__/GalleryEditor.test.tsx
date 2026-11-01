import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import GalleryEditor from "../GalleryEditor";
import { choose, chooseWhenReady } from "./chooseOption";
import { defaultGallerySettings } from "@/src/domain/entities/GallerySettings";
import { manageGallerySettings } from "@/src/infrastructure/gallerySettingsServices";
import { useSessionValue } from "../SessionProvider";
vi.mock("../SessionProvider", () => ({ useSessionValue: vi.fn() }));
vi.mock("../EditingWorkspace", () => ({
  useEditingWorkspace: () => ({ confirm: async () => true }),
  useUnsavedEditor: vi.fn(),
}));
vi.mock("../Gallery", () => ({
  default: ({ settings }: { settings: typeof defaultGallerySettings }) => (
    <div data-testid="preview">{JSON.stringify(settings)}</div>
  ),
}));
vi.mock("@/src/infrastructure/gallerySettingsServices", () => ({
  manageGallerySettings: { get: vi.fn(), save: vi.fn() },
}));
vi.mock("@/src/infrastructure/catalogServices", () => ({
  manageCatalog: {
    load: async () => ({ categories: [{ id: "animal", name: "Animal" }] }),
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSessionValue).mockReturnValue({
    user: { isAdmin: () => true },
  } as ReturnType<typeof useSessionValue>);
  vi.mocked(manageGallerySettings.get).mockResolvedValue(
    structuredClone(defaultGallerySettings),
  );
});
describe("Gallery studio", () => {
  it("edits text and category styles in preview, preserves a failed draft and saves explicitly", async () => {
    vi.mocked(manageGallerySettings.save)
      .mockRejectedValueOnce(new Error("Conflict: reload state"))
      .mockImplementationOnce(async (draft) => ({ ...draft, version: 2 }));
    render(<GalleryEditor />);
    const text = await screen.findByLabelText("Text 1");
    fireEvent.change(text, { target: { value: "New archive" } });
    await chooseWhenReady(screen.getByLabelText("Edit style for"), "Animal");
    fireEvent.click(screen.getByLabelText("Customize this category"));
    choose(screen.getByLabelText("Gallery font"), "Monospace · Courier");
    expect(screen.getByTestId("preview")).toHaveTextContent("New archive");
    expect(manageGallerySettings.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save gallery" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Conflict");
    expect(text).toHaveValue("New archive");
    fireEvent.click(screen.getByRole("button", { name: "Save gallery" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Gallery design saved",
    );
    expect(manageGallerySettings.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        categories: [
          expect.objectContaining({
            categoryId: "animal",
            group: "Subjects",
            customize: true,
            appearance: expect.objectContaining({ font: "mono" }),
          }),
        ],
      }),
    );
  });
  it("removes and adds text and cancels back to saved state", async () => {
    render(<GalleryEditor />);
    await screen.findByLabelText("Text 1");
    fireEvent.click(screen.getByRole("tab", { name: "Introduction" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove text 1" }));
    expect(screen.getAllByRole("textbox", { name: /^Text \d+$/ })).toHaveLength(
      2,
    );
    fireEvent.click(screen.getByRole("button", { name: "+ Add text" }));
    expect(screen.getAllByRole("textbox", { name: /^Text \d+$/ })).toHaveLength(
      3,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel changes" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Text 1")).toHaveValue(
        "Explore the archive",
      ),
    );
  });
  it("does not load administrative settings for visitors", () => {
    vi.mocked(useSessionValue).mockReturnValue({ user: null } as ReturnType<
      typeof useSessionValue
    >);
    render(<GalleryEditor />);
    expect(manageGallerySettings.get).not.toHaveBeenCalled();
  });
});

it("adds, edits, applies and deletes palettes in the draft before saving", async () => {
  render(<GalleryEditor />);
  fireEvent.click(await screen.findByRole("button", { name: "Night" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply palette" }));
  expect(
    JSON.parse(screen.getByTestId("preview").textContent!).appearance
      .background,
  ).toBe("#171b20");
  fireEvent.change(screen.getByLabelText("New palette name"), {
    target: { value: "My night" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save current colors as new palette" }),
  );
  expect(screen.getByLabelText("Palette name")).toHaveValue("My night");
  fireEvent.change(screen.getByLabelText("Palette accent"), {
    target: { value: "#aabbcc" },
  });
  expect(
    JSON.parse(screen.getByTestId("preview").textContent!).palettes.at(-1)
      .accent,
  ).toBe("#aabbcc");
  fireEvent.click(screen.getByRole("button", { name: "Delete palette" }));
  await waitFor(() =>
    expect(
      JSON.parse(screen.getByTestId("preview").textContent!).palettes.some(
        (palette: { name: string }) => palette.name === "My night",
      ),
    ).toBe(false),
  );
  expect(manageGallerySettings.save).not.toHaveBeenCalled();
});
it("lets the administrator disable visitor options without allowing an empty group", async () => {
  render(<GalleryEditor />);
  await screen.findByLabelText("Offer Squares");
  fireEvent.click(screen.getByLabelText("Offer Squares"));
  fireEvent.click(screen.getByLabelText("Offer Natural proportions"));
  expect(screen.getByLabelText("Offer Random emphasis")).toBeDisabled();
  expect(
    JSON.parse(screen.getByTestId("preview").textContent!).visitorOptions
      .layouts,
  ).toEqual(["random"]);
});
it("previews the gallery inside a chosen monitor or phone", async () => {
  render(<GalleryEditor />);
  const desktop = await screen.findByRole("radio", { name: /Desktop/ });
  expect(desktop).toHaveAttribute("aria-checked", "true");
  fireEvent.click(screen.getByRole("radio", { name: /Phone/ }));
  expect(screen.getByRole("radio", { name: /Phone/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(
    screen.getByTestId("preview").closest(".device-frame"),
  ).toHaveClass("device-frame--mobile");
});
