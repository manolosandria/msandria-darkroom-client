import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { usePhotoFetch } from "../usePhotoFetch";

describe("usePhotoFetch", () => {
  it("keeps the latest result when an older request finishes last", async () => {
    let resolveOld!: (value: string[]) => void;
    const old = () => new Promise<string[]>((resolve) => {
      resolveOld = resolve;
    });
    const fresh = () => Promise.resolve(["current"]);
    const { result, rerender } = renderHook(
      ({ fetcher }) => usePhotoFetch(fetcher, "empty"),
      { initialProps: { fetcher: old } },
    );
    await waitFor(() => expect(resolveOld).toBeDefined());
    rerender({ fetcher: fresh });
    await waitFor(() => expect(result.current.data).toEqual(["current"]));
    await act(async () => resolveOld(["obsolete"]));
    expect(result.current.data).toEqual(["current"]);
  });

  it("ignores an obsolete failure after a successful retry", async () => {
    let rejectOld!: (reason: Error) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject; }))
      .mockResolvedValue(["current"]);
    const { result } = renderHook(() => usePhotoFetch(fetcher, "empty"));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    await act(async () => { await result.current.retry(); });
    await act(async () => rejectOld(new Error("obsolete")));
    expect(result.current.data).toEqual(["current"]);
    expect(result.current.error).toBeNull();
  });
  it("can keep the previous result on screen while the next one loads", async () => {
    let resolveNext!: (value: string[]) => void;
    const first = () => Promise.resolve(["first"]);
    const next = () => new Promise<string[]>((resolve) => { resolveNext = resolve; });
    const { result, rerender } = renderHook(
      ({ fetcher }) => usePhotoFetch(fetcher, "empty", undefined, true, true),
      { initialProps: { fetcher: first } },
    );
    await waitFor(() => expect(result.current.data).toEqual(["first"]));
    rerender({ fetcher: next });
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.data).toEqual(["first"]);
    await act(async () => resolveNext(["second"]));
    expect(result.current.data).toEqual(["second"]);
  });

  it("sends nothing until enabled", async () => {
    const fetcher = vi.fn().mockResolvedValue(["a"]);
    const { result, rerender } = renderHook(
      ({ enabled }) => usePhotoFetch(fetcher, "empty", undefined, enabled),
      { initialProps: { enabled: false } },
    );
    await act(async () => {});
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.data).toEqual(["a"]));
  });

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
