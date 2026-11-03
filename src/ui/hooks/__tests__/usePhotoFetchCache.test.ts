import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePhotoFetch } from "../usePhotoFetch";
import { forgetAllReads, recentRead } from "@/src/ui/recentReads";

afterEach(() => forgetAllReads());

describe("usePhotoFetch with a cache key", () => {
  it("shows what was read a moment ago at once, then the API's answer", async () => {
    const first = renderHook(() =>
      usePhotoFetch(async () => "photo v1", "Missing", undefined, true, false, "photo:1"),
    );
    await waitFor(() => expect(first.result.current.data).toBe("photo v1"));
    first.unmount();

    let answer: (value: string | null) => void = () => {};
    const again = renderHook(() =>
      usePhotoFetch(
        () => new Promise<string | null>((resolve) => (answer = resolve)),
        "Missing",
        undefined,
        true,
        false,
        "photo:1",
      ),
    );
    expect(again.result.current).toMatchObject({ data: "photo v1", loading: false });
    await waitFor(() => expect(answer).not.toBeNull());
    answer("photo v2");
    await waitFor(() => expect(again.result.current.data).toBe("photo v2"));
  });

  it("drops a photo that is no longer visible", async () => {
    const seen = renderHook(() =>
      usePhotoFetch(async () => "photo", "Missing", undefined, true, false, "photo:2"),
    );
    await waitFor(() => expect(recentRead("photo:2")).toBe("photo"));
    seen.unmount();

    const fetcher = vi.fn().mockRejectedValue(new Error("404"));
    const hidden = renderHook(() =>
      usePhotoFetch(fetcher, "Missing", "Gone", true, false, "photo:2"),
    );
    await waitFor(() => expect(hidden.result.current.error).toBe("Gone"));
    expect(hidden.result.current.data).toBeNull();
    expect(recentRead("photo:2")).toBeUndefined();
  });
});
