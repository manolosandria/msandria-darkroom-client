import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import HomeBannerEditor from "../HomeBannerEditor";
import { defaultHomeBanner } from "@/src/domain/entities/HomeBanner";
import { manageHomeBanner } from "@/src/infrastructure/homeBannerServices";
import { useSessionValue } from "../SessionProvider";

vi.mock("../SessionProvider", () => ({ useSessionValue: vi.fn() }));
vi.mock("../EditingWorkspace", () => ({
  useEditingWorkspace: () => ({ confirm: async () => true }),
  useUnsavedEditor: vi.fn(),
}));
vi.mock("../HomePage", () => ({
  default: ({ banner }: { banner: { title: string } }) => (
    <div data-testid="preview">{banner.title}</div>
  ),
}));
// The slide list has its own tests; here it only marks its place.
vi.mock("../BannerSlideList", () => ({ BannerSlideList: () => null }));
vi.mock("@/src/infrastructure/homeBannerServices", () => ({
  manageHomeBanner: { get: vi.fn(), save: vi.fn() },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSessionValue).mockReturnValue({
    user: { isAdmin: () => true },
  } as ReturnType<typeof useSessionValue>);
  vi.mocked(manageHomeBanner.get).mockResolvedValue({ ...defaultHomeBanner });
});
describe("Home banner editor", () => {
  it("applies a palette and changes composition using keyboard destinations", async () => {
    render(<HomeBannerEditor />);
    await screen.findByLabelText("Title");
    // One group of properties at a time: the others are hidden.
    expect(screen.getByRole("tab", { name: "Text" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.queryByRole("button", { name: "Apply Atlantic palette" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Palette" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Apply Atlantic palette" }),
    );
    expect(screen.getByLabelText("Background")).toHaveValue("#e9eff1");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Palette" }), {
      key: "ArrowLeft",
    });
    expect(screen.getByRole("tab", { name: "Text" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Text" }), {
      key: "ArrowLeft",
    });
    expect(screen.getByRole("tab", { name: "Composition" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: "Composition" }), {
      key: "Enter",
    });
    fireEvent.click(screen.getByRole("radio", { name: "Welcome below" }));
    expect(screen.getByRole("radio", { name: "Welcome below" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(manageHomeBanner.save).not.toHaveBeenCalled();
  });
  it("offers the Welcome panel controls only over the photograph and saves them", async () => {
    vi.mocked(manageHomeBanner.save).mockImplementation(async (banner) => ({
      ...banner,
      version: 2,
    }));
    render(<HomeBannerEditor />);
    await screen.findByLabelText("Title");
    expect(screen.queryByRole("radiogroup", { name: "Welcome position" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Composition" }));
    fireEvent.click(screen.getByRole("radio", { name: "Welcome over photo" }));
    fireEvent.click(screen.getByRole("radio", { name: "Top right" }));
    fireEvent.click(screen.getByRole("radio", { name: /Frosted glass/ }));
    fireEvent.change(screen.getByLabelText(/^Width/), { target: { value: "65" } });
    fireEvent.change(screen.getByLabelText(/^Panel opacity/), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/^Corner radius/), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Panel color"), { target: { value: "#222222" } });
    fireEvent.click(screen.getByRole("button", { name: "Swap colors" }));
    fireEvent.click(screen.getByRole("button", { name: "Save banner" }));
    await screen.findByRole("status");
    expect(manageHomeBanner.save).toHaveBeenCalledWith({
      ...defaultHomeBanner,
      layout: "text-overlay",
      overlayOpacity: 30,
      welcome: {
        position: "top-right",
        width: 65,
        panel: "glass",
        panelColor: "#ffffff",
        textColor: "#222222",
        radius: 20,
      },
    });
    // Text only has no panel to color or round.
    fireEvent.click(screen.getByRole("radio", { name: /Text only/ }));
    expect(screen.getByLabelText(/^Panel opacity/)).toBeDisabled();
    expect(screen.getByLabelText("Panel color")).toBeDisabled();
  });
  it("previews a draft before publishing and retains it after failure", async () => {
    vi.mocked(manageHomeBanner.save)
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce({
        ...defaultHomeBanner,
        title: "Welcome",
        version: 2,
      });
    render(<HomeBannerEditor />);
    const input = await screen.findByLabelText("Title");
    fireEvent.change(input, { target: { value: "Welcome" } });
    expect(screen.getByTestId("preview")).toHaveTextContent("Welcome");
    expect(manageHomeBanner.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save banner" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection lost",
    );
    expect(input).toHaveValue("Welcome");
    fireEvent.click(screen.getByRole("button", { name: "Save banner" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Home banner saved.",
    );
    expect(manageHomeBanner.save).toHaveBeenLastCalledWith({
      ...defaultHomeBanner,
      title: "Welcome",
    });
    expect(screen.getByRole("button", { name: "Save banner" })).toBeDisabled();
  });
  it("cancels a draft and restores defaults while keeping the current version", async () => {
    vi.mocked(manageHomeBanner.get).mockResolvedValue({
      ...defaultHomeBanner,
      title: "Saved",
      version: 5,
    });
    render(<HomeBannerEditor />);
    const input = await screen.findByLabelText("Title");
    fireEvent.change(input, { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel changes" }));
    await waitFor(() => expect(input).toHaveValue("Saved"));
    fireEvent.click(screen.getByRole("button", { name: "Restore original" }));
    await waitFor(() => expect(input).toHaveValue(defaultHomeBanner.title));
    expect(manageHomeBanner.save).not.toHaveBeenCalled();
  });
  it("does not load administrative settings for a visitor", () => {
    vi.mocked(useSessionValue).mockReturnValue({ user: null } as ReturnType<
      typeof useSessionValue
    >);
    render(<HomeBannerEditor />);
    expect(
      screen.getByText(/Sign in as the administrator/),
    ).toBeInTheDocument();
    expect(manageHomeBanner.get).not.toHaveBeenCalled();
  });
});
