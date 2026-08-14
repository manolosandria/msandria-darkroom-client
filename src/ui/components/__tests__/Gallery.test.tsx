import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Gallery from "../Gallery";
import { Photo } from "@/src/domain/entities/Photo";

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

function makePhoto(id: string) {
  return new Photo({ id, title: `Photo ${id}`, url: `https://cdn/${id}.jpg` });
}

describe("Gallery", () => {
  it("shows the fetched photos once loading finishes", async () => {
    const getAllPhotos = { execute: vi.fn().mockResolvedValue([makePhoto("1"), makePhoto("2")]) };

    render(<Gallery getAllPhotos={getAllPhotos} />);

    await waitFor(() => expect(screen.getByText("Photo 1")).toBeInTheDocument());
    expect(screen.getByText("Photo 2")).toBeInTheDocument();
    expect(screen.queryByText(/no photos found/i)).not.toBeInTheDocument();
  });

  it("shows an error message when no photos are returned", async () => {
    const getAllPhotos = { execute: vi.fn().mockResolvedValue(null) };

    render(<Gallery getAllPhotos={getAllPhotos} />);

    await waitFor(() => expect(screen.getByText("No photos found")).toBeInTheDocument());
  });

  it("lets the visitor retry after a failed fetch", async () => {
    const user = userEvent.setup();
    const getAllPhotos = {
      execute: vi
        .fn()
        .mockRejectedValueOnce(new Error("network down"))
        .mockResolvedValueOnce([makePhoto("1")]),
    };

    render(<Gallery getAllPhotos={getAllPhotos} />);

    await waitFor(() => expect(screen.getByText("Failed to fetch photos")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(screen.getByText("Photo 1")).toBeInTheDocument());
    expect(getAllPhotos.execute).toHaveBeenCalledTimes(2);
  });
});
