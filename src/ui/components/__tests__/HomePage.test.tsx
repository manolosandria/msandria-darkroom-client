import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import HomePage from "../HomePage";
import { Photo } from "@/src/domain/entities/Photo";

function makePhoto(id: string, title: string) {
  return new Photo({ id, title, width: 1920, height: 1080, renditions: [{ width: 640, url: `https://cdn/${id}.jpg` }] });
}

describe("HomePage", () => {
  it("features the newest photo once loading finishes", async () => {
    const getAllPhotos = {
      execute: vi.fn().mockResolvedValue([makePhoto("2", "Atardecer"), makePhoto("1", "Esfera")]),
    };

    render(<HomePage getAllPhotos={getAllPhotos} />);

    await waitFor(() => expect(screen.getByText("Atardecer")).toBeInTheDocument());
    expect(screen.queryByText("Esfera")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next photograph" }));
    expect(screen.getByText("Esfera")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next photograph" }));
    expect(screen.getByText("Atardecer")).toBeInTheDocument();
  });

  it("shows an error message when there are no photos", async () => {
    const getAllPhotos = { execute: vi.fn().mockResolvedValue(null) };

    render(<HomePage getAllPhotos={getAllPhotos} />);

    await waitFor(() => expect(screen.getByText("Photo not found")).toBeInTheDocument());
  });
});
