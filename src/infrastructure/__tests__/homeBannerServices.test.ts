import { describe, expect, it, vi } from "vitest";
import { ApiHomeBannerRepository } from "../homeBannerServices";
import { defaultHomeBanner } from "../../domain/entities/HomeBanner";

describe("Home banner persistence", () => {
  it("reads fresh public settings and sends an authenticated complete save", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => defaultHomeBanner });
    const repository = new ApiHomeBannerRepository(
      "https://api.example.com/",
      fetchFn,
    );
    expect(await repository.get()).toEqual(defaultHomeBanner);
    expect(fetchFn).toHaveBeenLastCalledWith(
      "https://api.example.com/home/banner",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        cache: "no-store",
      }),
    );
    await repository.save(defaultHomeBanner);
    expect(fetchFn).toHaveBeenLastCalledWith(
      "https://api.example.com/home/banner",
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        body: JSON.stringify(defaultHomeBanner),
      }),
    );
  });
  it("reports conflicts and missing configuration without changing the draft", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 409 });
    await expect(
      new ApiHomeBannerRepository("https://api.example.com", fetchFn).save(
        defaultHomeBanner,
      ),
    ).rejects.toThrow("Your draft is preserved");
    await expect(
      new ApiHomeBannerRepository(undefined, fetchFn).get(),
    ).rejects.toThrow("not configured");
  });
});
