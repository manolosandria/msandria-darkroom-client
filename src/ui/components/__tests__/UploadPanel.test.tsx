import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Photo } from "@/src/domain/entities/Photo";
import { User } from "@/src/domain/entities/User";
import { SessionProvider } from "../SessionProvider";
import UploadPanel from "../UploadPanel";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import { getManagedPhotos } from "@/src/infrastructure/photoServices";
vi.mock("@/src/ui/borderTrimImage", () => ({
  findBorder: vi.fn(async () => ({ x: 0, y: 0.25, width: 1, height: 0.5 })),
  trimmedPreview: vi.fn(async () => "blob:trimmed"),
}));
vi.mock("@/src/infrastructure/photoServices", () => ({ uploadPhoto: { execute: vi.fn() }, getManagedPhotos: { execute: vi.fn() } }));
vi.mock('@/src/infrastructure/catalogServices', () => ({ manageCatalog: { saveWork: vi.fn(), load: vi.fn().mockResolvedValue({ categories: [], collections: [], works: [], photos: [] }) } }));

const execute = vi.fn();
const getCurrentUser = vi.fn();
const photo = new Photo({
  id: "p1",
  title: "Published photo",
  width: 1800,
  height: 1200,
  renditions: [{ width: 640, url: "https://cdn/photo.jpg" }],
});
const ports = {
  getCurrentUser: () => getCurrentUser(),
  signIn: vi.fn(),
  signOut: vi.fn(),
};
const file = (name = "first.jpg") =>
  new File(["image"], name, { type: "image/jpeg" });
function renderPanel() {
  return render(
    <SessionProvider ports={ports}>
      <UploadPanel uploadPhoto={{ execute }} />
    </SessionProvider>,
  );
}
async function select(files: File[] = [file()]) {
  await userEvent.upload(await screen.findByLabelText("Photos"), files);
}

beforeEach(() => {
  getCurrentUser.mockResolvedValue(
    new User({ id: "admin", email: "admin@example.com", role: "ADMIN" }),
  );
  execute.mockResolvedValue({ photo, optimizationIssues: [] });
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    }),
  );
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("Upload workspace", () => {
  it("asks anonymous visitors to sign in", async () => {
    getCurrentUser.mockResolvedValue(null);
    renderPanel();
    expect(
      await screen.findByText(/Sign in with the button/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Photos")).not.toBeInTheDocument();
  });
  it("restricts the workspace to the administrator", async () => {
    getCurrentUser.mockResolvedValue(
      new User({ id: "viewer", email: "viewer@example.com", role: "VIEWER" }),
    );
    renderPanel();
    expect(await screen.findByText(/Only the gallery/)).toBeInTheDocument();
  });
  it("creates an independent editable panel for every selected photo", async () => {
    renderPanel();
    await select([file(), file("second.jpg")]);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(
      screen
        .getAllByLabelText("Title")
        .map((input) => (input as HTMLInputElement).value),
    ).toEqual(["first", "second"]);
    expect(execute).not.toHaveBeenCalled();
  });
  it("accepts dropped photos and reports unsupported files without discarding valid ones", async () => {
    renderPanel();
    await screen.findByLabelText("Photos");
    fireEvent.drop(
      screen.getByRole("button", { name: /Drop your photos/ }).parentElement!,
      {
        dataTransfer: {
          files: [file(), new File(["x"], "bad.txt", { type: "text/plain" })],
        },
      },
    );
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("bad.txt");
  });
  it("waits for each request before starting the next, and preserves each report", async () => {
    let finish!: (result: unknown) => void;
    execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderPanel();
    await select([file(), file("second.jpg")]);
    await userEvent.click(
      screen.getAllByRole("button", { name: "Upload All (2)" })[0],
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button", { name: "Uploading…" })[0]).toBeDisabled();
    finish({ photo, optimizationIssues: [] });
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getAllByText(/Nothing to fix/)).toHaveLength(2),
    );
    expect(execute.mock.calls[1][0].file.name).toBe("second.jpg");
  });
  it("keeps rejected edits, continues the queue, and retries only failures", async () => {
    execute.mockRejectedValueOnce(new Error("offline"));
    renderPanel();
    await select([file(), file("second.jpg")]);
    await userEvent.type(screen.getAllByLabelText(/Description/)[0], "A story");
    await userEvent.click(
      screen.getAllByRole("button", { name: "Upload All (2)" })[0],
    );
    await screen.findByText(/Your edits are kept/);
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "Upload All (1)" })[0],
      ).toBeEnabled(),
    );
    expect(screen.getAllByLabelText(/Description/)[0]).toHaveValue("A story");
    await userEvent.click(
      screen.getAllByRole("button", { name: "Upload All (1)" })[0],
    );
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(3));
    expect(execute.mock.calls[2][0]).toMatchObject({
      description: "A story",
      title: "first",
    });
  });
  it("pauses on 429, preserves edits and never republishes completed photos on retry", async () => {
    execute.mockResolvedValueOnce({ photo, optimizationIssues: [] }).mockRejectedValueOnce(new RateLimitError(42));
    renderPanel();
    await select([file(), file("second.jpg"), file("third.jpg")]);
    await userEvent.type(screen.getAllByLabelText(/Description/)[1], "Keep this story");
    await userEvent.click(screen.getAllByRole("button", { name: "Upload All (3)" })[0]);
    await screen.findByText(/Publishing paused/);
    expect(screen.getByText("Too many attempts. Try again in 42 seconds.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Upload All (2)" })[0]).toBeEnabled());
    expect(execute).toHaveBeenCalledTimes(2);
    expect(screen.getAllByLabelText(/Description/)[1]).toHaveValue("Keep this story");
    await userEvent.click(screen.getAllByRole("button", { name: "Upload All (2)" })[0]);
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(4));
    expect(execute.mock.calls[2][0]).toMatchObject({ description: "Keep this story", file: expect.objectContaining({ name: "second.jpg" }) });
    expect(execute.mock.calls[3][0].file.name).toBe("third.jpg");
  });
  it("sends manually selected highlights with the photo", async () => {
    renderPanel();
    await select();
    await userEvent.click(screen.getByRole("tab", { name: /Highlights/ }));
    const image = screen.getByAltText("first");
    Object.defineProperties(image, {
      naturalWidth: { value: 1800 },
      naturalHeight: { value: 1200 },
    });
    fireEvent.load(image);
    await userEvent.click(
      await screen.findByRole("button", { name: "New square highlight" }),
    );
    const stage = document.querySelector(".highlight-stage") as HTMLElement;
    expect(stage.closest(".upload-shared-stage")).not.toBeNull();
    expect(screen.getByAltText("first")).not.toBeVisible();
    stage.setPointerCapture = vi.fn();
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 400,
    } as DOMRect);
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 60, clientY: 40 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 300, clientY: 300 });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    await userEvent.click(
      screen.getByRole("button", { name: "Accept highlight" }),
    );
    expect(screen.getByAltText("square thumbnail preview")).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Upload All (1)" })[0],
    );
    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          // A new square joins Gallery's grids in its own proportion.
          highlights: {
            square: expect.objectContaining({ width: expect.any(Number) }),
            presentation: expect.objectContaining({
              gallery: ["original", "square"],
            }),
          },
        }),
      ),
    );
  });
  it("sends the chosen frame with the photo", async () => {
    renderPanel();
    await select();
    await userEvent.click(screen.getByRole("tab", { name: /Appearance/ }));
    const image = screen.getByAltText("first");
    Object.defineProperties(image, {
      naturalWidth: { value: 1800 },
      naturalHeight: { value: 1200 },
    });
    fireEvent.load(image);
    await userEvent.click(
      await screen.findByRole("checkbox", { name: /show a frame/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Black" }));
    expect(document.querySelector(".frame-fields__preview")).toBeNull();
    expect(document.querySelector(".upload-photo-border")).toHaveStyle({ background: "#1b1b1b" });
    await userEvent.click(
      screen.getAllByRole("button", { name: "Upload All (1)" })[0],
    );
    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          frame: { color: "#1b1b1b", leftRight: 4, topBottom: 4 },
        }),
      ),
    );
  });
  it("sends the border to remove and edits the photo without it", async () => {
    renderPanel();
    await select();
    await userEvent.click(screen.getByRole("tab", { name: /Appearance/ }));
    const image = screen.getByAltText("first");
    Object.defineProperties(image, {
      naturalWidth: { value: 1800 },
      naturalHeight: { value: 1200 },
    });
    fireEvent.load(image);
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Remove border" }),
    );

    expect(await screen.findByLabelText("Top border in pixels")).toHaveValue(300);
    // The frame preview shows what the trim keeps, once it has been drawn.
    await waitFor(
      () =>
        expect(
          screen.getByTestId("upload-frame-preview").querySelector("img"),
        ).toHaveAttribute("src", "blob:trimmed"),
      { timeout: 2000 },
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: "Upload All (1)" })[0],
    );
    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          trim: { x: 0, y: 0.25, width: 1, height: 0.5 },
        }),
      ),
    );
  });
  it("releases the local preview when removing a draft", async () => {
    renderPanel();
    await select();
    await userEvent.click(
      within(screen.getByRole("article")).getByRole("button", {
        name: "Remove",
      }),
    );
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });
});

it("retries variant linking without uploading a successful file again", async () => {
  const target = new Photo({ id: "original", title: "Original", width: 100, height: 100, renditions: [{ width: 100, url: "https://cdn/original" }] });
  vi.mocked(getManagedPhotos.execute).mockResolvedValue([target]);
  vi.mocked(manageCatalog.saveWork).mockRejectedValueOnce(new Error("Link unavailable")).mockResolvedValueOnce({id:"work",title:"Work",version:1,variants:[]});
  renderPanel();
  await select();
  await userEvent.click(screen.getByRole("tab", { name: /Organization/ }));
  await userEvent.click(screen.getByText(/group another interpretation/));
  await userEvent.click(await screen.findByRole("radio", { name: "Original" }));
  await userEvent.click(screen.getByRole("button", { name: "Upload" }));
  await screen.findByText(/The file is uploaded/);
  expect(screen.getByLabelText("Title")).toBeDisabled();
  expect(execute).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: "Upload" }));
  await screen.findByRole("button", { name: "Uploaded" });
  expect(execute).toHaveBeenCalledTimes(1);
  expect(manageCatalog.saveWork).toHaveBeenCalledTimes(2);
});

it("moves through optional steps without publishing and keeps details when going back", async () => {
  renderPanel();
  await select();
  await userEvent.clear(screen.getByLabelText("Title"));
  await userEvent.type(screen.getByLabelText("Title"), "Lake at night");
  expect(screen.getByRole("tabpanel")).toHaveAccessibleName("1 Details");
  for (let index = 0; index < 4; index++) await userEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("tabpanel")).toHaveAccessibleName("5 Review");
  expect(execute).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("tab", { name: /Details/ }));
  expect(screen.getByLabelText("Title")).toHaveValue("Lake at night");
  await userEvent.click(screen.getByRole("button", { name: "Upload" }));
  await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ title: "Lake at night" })));
});
it("supports keyboard navigation between preparation tabs", async () => {
  renderPanel();
  await select();
  screen.getByRole("tab", { name: /Details/ }).focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: /Appearance/ })).toHaveFocus();
  await userEvent.keyboard("{End}");
  expect(screen.getByRole("tabpanel")).toHaveAccessibleName("5 Review");
});

it("expands the shared photo without losing edits or highlights", async () => {
  renderPanel();
  await select();
  await userEvent.type(screen.getByLabelText(/Description/), "Night on the lake");
  await userEvent.click(screen.getByRole("button", { name: /Expand photo/ }));
  expect(screen.getByRole("article")).toHaveAttribute("data-expanded");
  await userEvent.click(screen.getByRole("tab", { name: /Review/ }));
  const summary = screen.getByRole("region", { name: "Upload summary" });
  expect(summary).toHaveTextContent("Night on the lake");
  expect(summary).toHaveTextContent("No frame");
  expect(summary).toHaveTextContent("Public · Gallery");
  const inspector = document.querySelector(".upload-fields") as HTMLElement;
  inspector.scrollTop = 100;
  await userEvent.click(within(summary).getByRole("button", { name: "Edit the photograph" }));
  expect(inspector.scrollTop).toBe(0);
  expect(screen.getByLabelText(/Description/)).toHaveValue("Night on the lake");
  await userEvent.click(screen.getByRole("button", { name: /Compact view/ }));
  expect(screen.getByRole("article")).not.toHaveAttribute("data-expanded");
});
