import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import HomePage from "../HomePage";
import { Photo } from "@/src/domain/entities/Photo";

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

describe("HomePage", () => {
  it("shows the featured photo once loading finishes", async () => {
    const photo = new Photo({ id: "1", title: "Atardecer", url: "https://cdn/1.jpg" });
    const getPhotoById = { execute: vi.fn().mockResolvedValue(photo) };

    render(<HomePage getPhotoById={getPhotoById} />);

    await waitFor(() => expect(screen.getByText("Atardecer")).toBeInTheDocument());
  });

  it("shows an error message when the photo is not found", async () => {
    const getPhotoById = { execute: vi.fn().mockResolvedValue(null) };

    render(<HomePage getPhotoById={getPhotoById} />);

    await waitFor(() => expect(screen.getByText("Photo not found")).toBeInTheDocument());
  });
});
