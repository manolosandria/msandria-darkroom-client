import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Photo } from "@/src/domain/entities/Photo";
import { OwnProfile } from "@/src/domain/entities/Profile";
import { ProfilePhotoError } from "@/src/domain/errors/ProfilePhotoError";
import { PROFILE_CHANGED, UseAsProfilePhoto } from "../UseAsProfilePhoto";

const photo = (id: string) =>
  new Photo({
    id,
    title: `Photo ${id}`,
    width: 1200,
    height: 800,
    renditions: [{ width: 320, url: `https://img.test/${id}.jpg` }],
  });

const mine: OwnProfile = {
  id: "usr_1",
  publicName: "Ana G.",
  email: "ana@example.com",
  avatar: photo("old-face"),
  cover: null,
  profilePublic: false,
  likesPublic: false,
  favoritesPublic: false,
  likes: [],
  favorites: [],
};

function ports() {
  return {
    mine: vi.fn().mockResolvedValue(mine),
    update: vi.fn().mockResolvedValue(mine),
  };
}

describe("UseAsProfilePhoto", () => {
  it("compares the current profile photo with this one before saving", async () => {
    const port = ports();
    const changed = vi.fn();
    window.addEventListener(PROFILE_CHANGED, changed);
    render(<UseAsProfilePhoto photo={photo("sky")} ports={port} />);

    await userEvent.click(screen.getByRole("button", { name: /Use as/ }));
    await userEvent.click(screen.getByRole("button", { name: "Profile photo" }));

    expect(await screen.findByAltText("Photo old-face")).toBeInTheDocument();
    expect(screen.getByAltText("Photo sky")).toBeInTheDocument();
    expect(port.update).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Use as profile photo" }),
    );
    expect(port.update).toHaveBeenCalledWith({ avatarPhotoId: "sky" });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Profile photo updated.",
    );
    expect(changed).toHaveBeenCalled();
    window.removeEventListener(PROFILE_CHANGED, changed);
  });

  it("cancels without saving and explains a refused photograph", async () => {
    const port = ports();
    render(<UseAsProfilePhoto photo={photo("sky")} ports={port} />);
    await userEvent.click(screen.getByRole("button", { name: /Use as/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    port.update.mockRejectedValueOnce(new ProfilePhotoError());
    await userEvent.click(screen.getByRole("button", { name: /Use as/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cover" }));
    expect(await screen.findByText("Now: none")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Use as cover" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only photographs of the public gallery can be used.",
    );
  });
});
