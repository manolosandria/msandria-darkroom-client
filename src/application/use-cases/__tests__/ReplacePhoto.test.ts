import { describe, expect, it, vi } from "vitest";
import { ReplacePhoto } from "../ReplacePhoto";
import { Photo } from "@/src/domain/entities/Photo";

const photo = new Photo({ id: "p", title: "P", width: 10, height: 10, renditions: [{ width: 640, url: "https://cdn/p.jpg" }] });
const file = new File(["x"], "x.jpg");

describe("ReplacePhoto", () => {
  it("passes the border trim along only when there is one", async () => {
    const replace = vi.fn().mockResolvedValue({});
    const useCase = new ReplacePhoto({ replace });
    const trim = { x: 0, y: 0.1, width: 1, height: 0.8 };

    await useCase.execute(photo, file, photo, trim);
    await useCase.execute(photo, file, photo);
    await useCase.execute(photo, file);

    expect(replace.mock.calls).toEqual([
      [photo, file, photo, trim],
      [photo, file, photo],
      [photo, file],
    ]);
  });
});
