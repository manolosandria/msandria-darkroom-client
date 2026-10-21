import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Gallery from "../Gallery";
import { Photo } from "@/src/domain/entities/Photo";

vi.mock("@/src/infrastructure/catalogServices", () => ({
  editCatalog: { load: vi.fn().mockResolvedValue({
    collections: [], works: [],
    categories: [{ id: "street", name: "Street" }],
    photos: [{ id: "0", categories: [{ id: "street" }] }],
  }) },
}));

function makePhoto(id: string) {
  return new Photo({ id, title: `Photo ${id}`, width: 1920, height: 1080, renditions: [{ width: 640, url: `https://cdn/${id}.jpg` }] });
}

describe("Gallery", () => {
  it("paginates a stable shuffled selection twelve photos at a time", async () => {
    const user = userEvent.setup();
    const photos = Array.from({ length: 25 }, (_, index) => makePhoto(String(index)));
    render(<Gallery getAllPhotos={{ execute: vi.fn().mockResolvedValue(photos) }} />);
    await screen.findByText("Page 1 of 3");
    const firstPage = screen.getAllByRole("img").map(image => image.getAttribute("alt"));
    expect(firstPage).toHaveLength(12);
    await user.click(screen.getByRole("button", { name: /next/i }));
    const secondPage = screen.getAllByRole("img").map(image => image.getAttribute("alt"));
    expect(secondPage).toHaveLength(12);
    expect(secondPage.some(title => firstPage.includes(title))).toBe(false);
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /previous/i }));
    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(screen.getAllByRole("img").map(image => image.getAttribute("alt"))).toEqual(firstPage);
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.selectOptions(screen.getByLabelText("Filter by category"), "street");
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Photo 0" })).toBeInTheDocument();
  });
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
