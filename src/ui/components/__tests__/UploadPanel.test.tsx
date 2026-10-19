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
vi.mock('@/src/infrastructure/catalogServices', () => ({ manageCatalog: { load: vi.fn().mockResolvedValue({ categories: [], collections: [], works: [], photos: [] }) } }));

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
    const image = screen.getByAltText("first");
    Object.defineProperties(image, {
      naturalWidth: { value: 1800 },
      naturalHeight: { value: 1200 },
    });
    fireEvent.load(image);
    await userEvent.click(
      await screen.findByRole("button", { name: "Add square highlight" }),
    );
    expect(screen.getByAltText("square thumbnail preview")).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Upload All (1)" })[0],
    );
    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          highlights: {
            square: expect.objectContaining({ width: expect.any(Number) }),
          },
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
