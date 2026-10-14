import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Photo } from "@/src/domain/entities/Photo";
import { User, UserRole } from "@/src/domain/entities/User";
import {
  PhotoUploadError,
  PublishedPhoto,
} from "@/src/domain/repositories/PhotoRepository";
import { SessionPorts } from "@/src/ui/hooks/useSession";
import { SessionProvider } from "../SessionProvider";
import UploadPanel from "../UploadPanel";

const execute = vi.fn();
const getCurrentUser = vi.fn();

const sessionPorts: SessionPorts = {
  getCurrentUser: () => getCurrentUser(),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

function accountOf(role: UserRole) {
  return new User({
    id: `usr_${role}`,
    email: "manolo@example.com",
    name: "Manolo Sandria",
    role,
  });
}

function publishedPhoto(optimizationIssues: PublishedPhoto["optimizationIssues"] = []) {
  return {
    photo: new Photo({
      id: "virgencita",
      title: "Virgencita",
      width: 1920,
      height: 1080,
      renditions: [{ width: 640, url: "https://cdn/w_640/virgencita" }],
    }),
    optimizationIssues,
  };
}

function renderPanel() {
  return render(
    <SessionProvider ports={sessionPorts}>
      <UploadPanel uploadPhoto={{ execute }} />
    </SessionProvider>,
  );
}

const chosenFile = new File(["bytes"], "virgencita.jpg", { type: "image/jpeg" });

async function fillInAndSubmit(title = "Virgencita") {
  await userEvent.upload(screen.getByLabelText("Photo"), chosenFile);
  await userEvent.type(screen.getByLabelText("Title"), title);
  await userEvent.click(screen.getByRole("button", { name: "Publish" }));
}

beforeEach(() => {
  getCurrentUser.mockResolvedValue(accountOf("ADMIN"));
  execute.mockResolvedValue(publishedPhoto());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("UploadPanel", () => {
  it("asks a visitor without a session to sign in from the header", async () => {
    getCurrentUser.mockResolvedValue(null);

    renderPanel();

    expect(
      await screen.findByText(/Sign in with the button in the header/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Photo")).not.toBeInTheDocument();
  });

  // The hidden form is a courtesy, not a safeguard: the API turns the publish down
  // for this account whatever this page draws.
  it("tells a registered visitor that only the administrator publishes", async () => {
    getCurrentUser.mockResolvedValue(accountOf("VIEWER"));

    renderPanel();

    expect(
      await screen.findByText(/Only the gallery's administrator can publish/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Photo")).not.toBeInTheDocument();
  });

  it("offers the form to the administrator", async () => {
    renderPanel();

    expect(await screen.findByLabelText("Photo")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("shows nothing until the session is known", () => {
    getCurrentUser.mockReturnValue(new Promise(() => {}));

    renderPanel();

    expect(screen.queryByLabelText("Photo")).not.toBeInTheDocument();
    expect(screen.queryByText(/Sign in with the button/)).not.toBeInTheDocument();
  });

  it("lets the administrator retry when the session could not be read", async () => {
    getCurrentUser.mockRejectedValueOnce(new Error("boom"));
    renderPanel();

    await userEvent.click(await screen.findByRole("button", { name: "Try Again" }));

    expect(await screen.findByLabelText("Photo")).toBeInTheDocument();
  });

  it("sends the chosen file and the title to the API", async () => {
    renderPanel();
    await screen.findByLabelText("Photo");

    await userEvent.type(screen.getByLabelText(/Description/), "Veracruz");
    await fillInAndSubmit();

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        file: chosenFile,
        title: "Virgencita",
        description: "Veracruz",
      }),
    );
  });

  it("leaves out a description nobody typed", async () => {
    renderPanel();
    await screen.findByLabelText("Photo");

    await fillInAndSubmit();

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ description: undefined }),
      ),
    );
  });

  it("asks for a file when the form is submitted without one", async () => {
    renderPanel();
    await screen.findByLabelText("Photo");

    await userEvent.type(screen.getByLabelText("Title"), "Virgencita");
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText("Choose a photo to publish.")).toBeInTheDocument();
    expect(execute).not.toHaveBeenCalled();
  });

  it("reports the published photo and that nothing needs fixing", async () => {
    renderPanel();
    await screen.findByLabelText("Photo");

    await fillInAndSubmit();

    expect(await screen.findByText("Published: Virgencita")).toBeInTheDocument();
    expect(screen.getByText(/Nothing to fix/)).toBeInTheDocument();
  });

  it("separates what has to be exported again from what the upload corrected", async () => {
    execute.mockResolvedValue(
      publishedPhoto([
        {
          getKind: () => "LOCATION" as const,
          getUnit: () => "TAG_COUNT" as const,
          getCurrentValue: () => "2",
          getRecommendedValue: () => "0",
          isPending: () => false,
        },
        {
          getKind: () => "UNDERSIZED" as const,
          getUnit: () => "PIXELS" as const,
          getCurrentValue: () => "1600",
          getRecommendedValue: () => "2048",
          isPending: () => true,
        },
      ] as PublishedPhoto["optimizationIssues"]),
    );
    renderPanel();
    await screen.findByLabelText("Photo");

    await fillInAndSubmit();

    expect(await screen.findByText("Worth exporting again")).toBeInTheDocument();
    expect(screen.getByText("Corrected while uploading")).toBeInTheDocument();
    expect(screen.getByText("Smaller than recommended")).toBeInTheDocument();
    expect(screen.getByText("GPS location")).toBeInTheDocument();
    // The API measures and this site words it: the plain numbers it sent come out with
    // their unit attached.
    expect(screen.getByText(/1600 px → 2048 px/)).toBeInTheDocument();
    expect(screen.getByText(/2 tags → 0 tags/)).toBeInTheDocument();
  });

  it("shows only the renditions the API sent, never the original file", async () => {
    renderPanel();
    await screen.findByLabelText("Photo");

    await fillInAndSubmit();

    const image = await screen.findByAltText("Virgencita");
    expect(image.getAttribute("src")).toContain("https://cdn/w_640/virgencita");
  });

  it("keeps the form filled in when the API rejected the photo", async () => {
    execute.mockRejectedValue(
      new PhotoUploadError("rejected", "title should not be empty"),
    );
    renderPanel();
    await screen.findByLabelText("Photo");

    await fillInAndSubmit();

    expect(
      await screen.findByText(/title should not be empty/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Virgencita");
  });

  it("empties the form once the photo went through", async () => {
    renderPanel();
    await screen.findByLabelText("Photo");

    await fillInAndSubmit();

    await screen.findByText("Published: Virgencita");
    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("holds the publish button while the upload is on its way", async () => {
    execute.mockReturnValue(new Promise(() => {}));
    renderPanel();
    await screen.findByLabelText("Photo");

    await fillInAndSubmit();

    expect(
      await screen.findByRole("button", { name: "Publishing..." }),
    ).toBeDisabled();
  });

  it("drops the report when it is dismissed", async () => {
    renderPanel();
    await screen.findByLabelText("Photo");
    await fillInAndSubmit();
    await screen.findByText("Published: Virgencita");

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("Published: Virgencita")).not.toBeInTheDocument();
  });
});
