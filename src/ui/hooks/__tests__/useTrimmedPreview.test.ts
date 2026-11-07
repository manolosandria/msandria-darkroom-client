import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTrimmedPreview } from "../useTrimmedPreview";
import { trimmedPreview } from "@/src/ui/borderTrimImage";

vi.mock("@/src/ui/borderTrimImage", () => ({
  findBorder: vi.fn(),
  trimmedPreview: vi.fn(),
}));

const draw = vi.mocked(trimmedPreview);
const trim = { x: 0, y: 0.1, width: 1, height: 0.8 };

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("useTrimmedPreview", () => {
  it("shows the original while there is no trim", () => {
    const { result } = renderHook(() => useTrimmedPreview("blob:a", null));
    expect(result.current).toBe("blob:a");
    expect(draw).not.toHaveBeenCalled();
  });

  it("shows the drawn image once the trim settles, and releases it after", async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { revokeObjectURL }));
    draw.mockResolvedValue("blob:trimmed");
    const { result, rerender, unmount } = renderHook(
      ({ value }) => useTrimmedPreview("blob:a", value),
      { initialProps: { value: trim as typeof trim | null } },
    );
    expect(result.current).toBe("blob:a");
    await waitFor(() => expect(result.current).toBe("blob:trimmed"));
    // The same sides in a new object do not draw it again.
    rerender({ value: { ...trim } });
    expect(result.current).toBe("blob:trimmed");
    expect(draw).toHaveBeenCalledTimes(1);
    rerender({ value: null });
    expect(result.current).toBe("blob:a");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:trimmed");
    unmount();
  });

  it("keeps the original if the trim cannot be drawn", async () => {
    draw.mockRejectedValue(new Error("no canvas"));
    const { result } = renderHook(() => useTrimmedPreview("blob:a", trim));
    await waitFor(() => expect(draw).toHaveBeenCalled());
    expect(result.current).toBe("blob:a");
  });

  it("releases a drawing that arrives after the trim changed", async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { revokeObjectURL }));
    let finish: (url: string) => void = () => undefined;
    draw.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { rerender } = renderHook(({ value }) => useTrimmedPreview("blob:a", value), {
      initialProps: { value: trim as typeof trim | null },
    });
    await waitFor(() => expect(draw).toHaveBeenCalled());
    rerender({ value: null });
    finish("blob:late");
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:late"));
  });
});
