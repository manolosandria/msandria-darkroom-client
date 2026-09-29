import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UploadPanel from "../UploadPanel";
import { Photo } from "@/src/domain/entities/Photo";

function makeFile(name = "photo.jpg", type = "image/jpeg") {
  return new File(["binary"], name, { type });
}

describe("UploadPanel", () => {
  it("uploads the selected file with its title and description", async () => {
    const user = userEvent.setup();
    const photo = new Photo({ id: "1", title: "Esfera", url: "https://cdn/1.jpg" });
    const uploadPhoto = { execute: vi.fn().mockResolvedValue(photo) };

    render(<UploadPanel uploadPhoto={uploadPhoto} />);

    await user.upload(screen.getByLabelText("Photo"), makeFile());
    await user.type(screen.getByLabelText("Title"), "Esfera");
    await user.type(screen.getByLabelText("Description"), "A sphere");
    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() =>
      expect(uploadPhoto.execute).toHaveBeenCalledWith({
        file: expect.any(File),
        title: "Esfera",
        description: "A sphere",
      }),
    );
    expect(await screen.findByText("Photo uploaded successfully.")).toBeInTheDocument();
  });

  it("shows a validation error and skips the upload when no file is selected", async () => {
    const user = userEvent.setup();
    const uploadPhoto = { execute: vi.fn() };

    render(<UploadPanel uploadPhoto={uploadPhoto} />);

    await user.type(screen.getByLabelText("Title"), "Esfera");
    await user.click(screen.getByRole("button", { name: /upload/i }));

    expect(await screen.findByText("Select a photo to upload.")).toBeInTheDocument();
    expect(uploadPhoto.execute).not.toHaveBeenCalled();
  });

  it("shows a validation error and skips the upload when the title is empty", async () => {
    const user = userEvent.setup();
    const uploadPhoto = { execute: vi.fn() };

    render(<UploadPanel uploadPhoto={uploadPhoto} />);

    await user.upload(screen.getByLabelText("Photo"), makeFile());
    await user.click(screen.getByRole("button", { name: /upload/i }));

    expect(await screen.findByText("Give the photo a title.")).toBeInTheDocument();
    expect(uploadPhoto.execute).not.toHaveBeenCalled();
  });

  it("shows an error message when the upload fails", async () => {
    const user = userEvent.setup();
    const uploadPhoto = { execute: vi.fn().mockRejectedValue(new Error("network down")) };

    render(<UploadPanel uploadPhoto={uploadPhoto} />);

    await user.upload(screen.getByLabelText("Photo"), makeFile());
    await user.type(screen.getByLabelText("Title"), "Esfera");
    await user.click(screen.getByRole("button", { name: /upload/i }));

    expect(await screen.findByText("Failed to upload photo. Please try again.")).toBeInTheDocument();
  });
});
