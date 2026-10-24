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
    fireEvent.click(
      screen.getByRole("button", { name: "Apply Atlantic palette" }),
    );
    expect(screen.getByLabelText("Background")).toHaveValue("#e9eff1");
    fireEvent.click(screen.getByRole("button", { name: "Welcome bottom" }));
    expect(screen.getByRole("button",{name:"Welcome bottom"})).toHaveAttribute("aria-pressed","true");
    expect(manageHomeBanner.save).not.toHaveBeenCalled();
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
