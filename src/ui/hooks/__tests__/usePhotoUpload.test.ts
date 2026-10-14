import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { Photo } from "@/src/domain/entities/Photo";
import {
  PhotoUploadError,
  PublishedPhoto,
} from "@/src/domain/repositories/PhotoRepository";
import { usePhotoUpload } from "../usePhotoUpload";

const uploadPhoto = vi.fn();

const draft = {
  file: new File(["bytes"], "virgencita.jpg", { type: "image/jpeg" }),
  title: "Virgencita",
};

const published: PublishedPhoto = {
  photo: new Photo({
    id: "1",
    title: "Virgencita",
    width: 1920,
    height: 1080,
    renditions: [{ width: 640, url: "https://cdn/1.jpg" }],
  }),
  optimizationIssues: [],
};

function render() {
  return renderHook(() => usePhotoUpload({ uploadPhoto }));
}

beforeEach(() => {
  uploadPhoto.mockResolvedValue(published);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("usePhotoUpload", () => {
  it("starts with nothing published and nothing to report", () => {
    const { result } = render();

    expect(result.current).toMatchObject({
      uploading: false,
      published: null,
      error: null,
    });
  });

  it("reports the photo it published", async () => {
    const { result } = render();

    await act(async () => {
      expect(await result.current.publish(draft)).toBe(true);
    });

    expect(uploadPhoto).toHaveBeenCalledWith(draft);
    expect(result.current.published).toBe(published);
    expect(result.current.uploading).toBe(false);
  });

  // The browser's own wording on a `required` file input is both generic and, in a
  // form this small, easy to miss.
  it("says so instead of calling the API when no file was chosen", async () => {
    const { result } = render();

    await act(async () => {
      expect(await result.current.publish({ ...draft, file: null })).toBe(false);
    });

    expect(uploadPhoto).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Choose a photo to publish.");
  });

  it("marks itself as uploading while the API has not answered", async () => {
    uploadPhoto.mockReturnValue(new Promise(() => {}));
    const { result } = render();

    void act(() => {
      void result.current.publish(draft);
    });

    await waitFor(() => expect(result.current.uploading).toBe(true));
  });

  // Each refusal is turned into something worth reading, and the caller is told the
  // upload did not go through so the form can keep what was typed.
  it.each([
    ["unauthenticated", "The session ended. Sign in again to publish."],
    ["forbidden", "This account is not allowed to publish photos."],
    [
      "tooLarge",
      "That file is too large for the API. Export it smaller and try again.",
    ],
    ["unreachable", "Could not reach the API"],
  ])("explains a %s refusal", async (failure, message) => {
    uploadPhoto.mockRejectedValue(
      new PhotoUploadError(
        failure as PhotoUploadError["failure"],
        "whatever the API said",
      ),
    );
    const { result } = render();

    await act(async () => {
      expect(await result.current.publish(draft)).toBe(false);
    });

    expect(result.current.error).toBe(message);
    expect(result.current.published).toBeNull();
  });

  it("repeats the reason a rejection gives", async () => {
    uploadPhoto.mockRejectedValue(
      new PhotoUploadError("rejected", "title should not be empty"),
    );
    const { result } = render();

    await act(async () => {
      await result.current.publish(draft);
    });

    expect(result.current.error).toBe(
      "The API rejected the photo: title should not be empty",
    );
  });

  it("falls back to a reachability message for a failure it does not know", async () => {
    uploadPhoto.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = render();

    await act(async () => {
      await result.current.publish(draft);
    });

    expect(result.current.error).toBe("Could not reach the API");
  });

  it("clears the last report when asked", async () => {
    const { result } = render();
    await act(async () => {
      await result.current.publish(draft);
    });

    act(() => result.current.reset());

    expect(result.current.published).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
