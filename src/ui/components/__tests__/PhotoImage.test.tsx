import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Photo } from "@/src/domain/entities/Photo";
import { PhotoImage } from "../PhotoImage";

describe("PhotoImage", () => {
  it("preserves actual widths and stable URLs, including a small nonstandard source", () => {
    const photo = new Photo({ id: "small", title: "Small photo", width: 517, height: 345,
      renditions: [{ width: 517, url: "https://cdn/517" }, { width: 320, url: "https://cdn/320" }] });
    const { rerender } = render(<PhotoImage photo={photo} fallbackSizes="100vw" />);
    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("srcset", "https://cdn/320 320w, https://cdn/517 517w");
    expect(image).toHaveAttribute("src", "https://cdn/320");
    expect(image).toHaveAttribute("width", "517");
    expect(image).toHaveAttribute("height", "345");
    expect(image).toHaveAttribute("sizes", "auto, 100vw");
    const source = image.getAttribute("srcset");
    rerender(<PhotoImage photo={photo} fallbackSizes="50vw" />);
    expect(image).toHaveAttribute("srcset", source);
  });

  it("does not invent candidates for an image with only one available rendition", () => {
    const photo = new Photo({ id: "tiny", title: "Tiny", width: 240, height: 160,
      renditions: [{ width: 240, url: "https://cdn/240" }] });
    render(<PhotoImage photo={photo} fallbackSizes="100vw" />);
    expect(screen.getByRole("img")).toHaveAttribute("srcset", "https://cdn/240 240w");
  });
});
