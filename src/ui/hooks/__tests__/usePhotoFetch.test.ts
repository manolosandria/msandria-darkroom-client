import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePhotoFetch } from "../usePhotoFetch";

describe("usePhotoFetch", () => {
  it("starts loading and then exposes the resolved data", async () => {
    const fetcher = vi.fn().mockResolvedValue(["a", "b"]);

    const { result } = renderHook(() => usePhotoFetch(fetcher, "empty"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(["a", "b"]);
    expect(result.current.error).toBeNull();
  });

  it("surfaces the empty message when the result is null", async () => {
    const fetcher = vi.fn().mockResolvedValue(null);

    const { result } = renderHook(() => usePhotoFetch(fetcher, "empty message"));

    await waitFor(() => expect(result.current.error).toBe("empty message"));
  });

  it("surfaces the empty message when the result is an empty array", async () => {
    const fetcher = vi.fn().mockResolvedValue([]);

    const { result } = renderHook(() => usePhotoFetch(fetcher, "empty message"));

    await waitFor(() => expect(result.current.error).toBe("empty message"));
  });

  it("surfaces a failure message when the fetcher rejects", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => usePhotoFetch(fetcher, "empty", "custom failure"));

    await waitFor(() => expect(result.current.error).toBe("custom failure"));
  });

  it("re-fetches when retry is called", async () => {
    const fetcher = vi.fn().mockResolvedValue(["a"]);

    const { result } = renderHook(() => usePhotoFetch(fetcher, "empty"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.retry();

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
