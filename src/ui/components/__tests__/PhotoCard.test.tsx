import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PhotoCard } from "../PhotoCard";
import { Photo } from "@/src/domain/entities/Photo";

describe("PhotoCard", () => {
  it("only loads the renditions sent by the API, never the original", () => {
    const photo = new Photo({
      id: "atardecer",
      title: "Atardecer",
      width: 1920,
      height: 1080,
      renditions: [
        { width: 640, url: "https://cdn/w_640/atardecer" },
        { width: 1280, url: "https://cdn/w_1280/atardecer" },
      ],
    });

    render(<PhotoCard photo={photo} />);

    const image = screen.getByAltText("Atardecer");
    expect(image.getAttribute("srcset")).toBe("https://cdn/w_640/atardecer 640w, https://cdn/w_1280/atardecer 1280w");
    expect(image.getAttribute("sizes")).toBe("auto, (max-width: 42rem) 100vw, 42rem");
    const candidates = [image.getAttribute("src"), ...image.getAttribute("srcset")!.split(", ").map((c) => c.split(" ")[0])];
    expect(new Set(candidates)).toEqual(
      new Set(["https://cdn/w_640/atardecer", "https://cdn/w_1280/atardecer"]),
    );
  });
});
