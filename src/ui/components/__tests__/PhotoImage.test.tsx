import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("offers only renditions up to the thumbnail cap, or the smallest when none fits", () => {
    const photo = new Photo({ id: "large", title: "Large", width: 2560, height: 1700,
      renditions: [320, 640, 1280, 2560].map((width) => ({ width, url: `https://cdn/${width}` })) });
    const { rerender } = render(<PhotoImage photo={photo} fallbackSizes="72px" maxWidth={640} />);
    expect(screen.getByRole("img")).toHaveAttribute("srcset", "https://cdn/320 320w, https://cdn/640 640w");
    rerender(<PhotoImage photo={photo} fallbackSizes="72px" maxWidth={100} />);
    expect(screen.getByRole("img")).toHaveAttribute("srcset", "https://cdn/320 320w");
  });

  it("switches once to the other image host when the image fails to load", () => {
    const photo = new Photo({ id: "both", title: "Both hosts", width: 640, height: 480,
      renditions: [
        { width: 320, url: "https://r2/320", fallbackUrl: "https://cloudinary/320" },
        { width: 640, url: "https://r2/640", fallbackUrl: "https://cloudinary/640" },
      ] });
    render(<PhotoImage photo={photo} fallbackSizes="100vw" />);
    const image = screen.getByRole("img");

    fireEvent.error(image);
    expect(image).toHaveAttribute("srcset", "https://cloudinary/320 320w, https://cloudinary/640 640w");
    expect(image).toHaveAttribute("src", "https://cloudinary/320");
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", "https://cloudinary/320");
  });

  it("keeps its only host when there is no fallback", () => {
    const photo = new Photo({ id: "one", title: "One host", width: 320, height: 240,
      renditions: [{ width: 320, url: "https://r2/320" }] });
    render(<PhotoImage photo={photo} fallbackSizes="100vw" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://r2/320");
  });

  it("does not invent candidates for an image with only one available rendition", () => {
    const photo = new Photo({ id: "tiny", title: "Tiny", width: 240, height: 160,
      renditions: [{ width: 240, url: "https://cdn/240" }] });
    render(<PhotoImage photo={photo} fallbackSizes="100vw" />);
    expect(screen.getByRole("img")).toHaveAttribute("srcset", "https://cdn/240 240w");
  });
});
