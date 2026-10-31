import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Photo } from "@/src/domain/entities/Photo";
import { User } from "@/src/domain/entities/User";
import {
  OwnProfile,
  PhotoReactions as Counts,
} from "@/src/domain/entities/Profile";
import { ProfilePhotoError } from "@/src/domain/errors/ProfilePhotoError";
import { SessionPorts } from "@/src/ui/hooks/useSession";
import { SessionProvider } from "../SessionProvider";
import { PhotoReactions } from "../PhotoReactions";
import { ProfileSettings } from "../ProfileSettings";
import ProfileView from "../ProfileView";
import { CommentAuthor } from "../ProfileParts";

const photo = (id: string) =>
  new Photo({
    id,
    title: `Photo ${id}`,
    width: 1200,
    height: 800,
    createdAt: new Date("2026-10-01"),
    renditions: [{ width: 320, url: `https://img.test/${id}.jpg` }],
  });

const own = (overrides: Partial<OwnProfile> = {}): OwnProfile => ({
  id: "usr_1",
  publicName: "Ana G.",
  email: "ana@example.com",
  avatar: null,
  cover: null,
  profilePublic: false,
  likesPublic: false,
  favoritesPublic: false,
  likes: [photo("liked")],
  favorites: [],
  ...overrides,
});

function withSession(node: React.ReactNode, user: User | null) {
  const ports: SessionPorts = {
    getCurrentUser: vi.fn().mockResolvedValue(user),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
  return render(<SessionProvider ports={ports}>{node}</SessionProvider>);
}
const ana = new User({ id: "usr_1", email: "ana@example.com", role: "VIEWER" });

describe("ProfileSettings", () => {
  it("lists the own likes and keeps the lists private until the profile is public", async () => {
    render(
      <ProfileSettings
        ports={{
          mine: vi.fn().mockResolvedValue(own()),
          update: vi.fn(),
          galleryPhotos: vi.fn(),
        }}
      />,
    );
    expect(
      await screen.findByRole("list", { name: "Your likes" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Show my likes/)).toBeDisabled();
    expect(screen.getByLabelText(/Public profile/)).not.toBeChecked();
  });

  it("saves each privacy switch on its own", async () => {
    const update = vi.fn().mockResolvedValue(own({ profilePublic: true }));
    render(
      <ProfileSettings
        ports={{
          mine: vi.fn().mockResolvedValue(own()),
          update,
          galleryPhotos: vi.fn(),
        }}
      />,
    );
    await userEvent.click(await screen.findByLabelText(/Public profile/));
    expect(update).toHaveBeenCalledWith({ profilePublic: true });
    await waitFor(() =>
      expect(screen.getByLabelText(/Show my likes/)).toBeEnabled(),
    );
  });

  it("chooses the cover among public gallery photos and explains a refusal", async () => {
    const galleryPhotos = vi.fn().mockResolvedValue([photo("dune")]);
    const update = vi.fn().mockRejectedValue(new ProfilePhotoError());
    render(
      <ProfileSettings
        ports={{
          mine: vi.fn().mockResolvedValue(own()),
          update,
          galleryPhotos,
        }}
      />,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Choose cover" }),
    );
    const picker = screen.getByRole("group", { name: "Choose your cover" });
    await userEvent.click(
      await within(picker).findByRole("button", { name: "Use Photo dune" }),
    );
    expect(galleryPhotos).toHaveBeenCalledWith("");
    expect(update).toHaveBeenCalledWith({ coverPhotoId: "dune" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a photograph from the public gallery.",
    );
  });
});

describe("ProfileView", () => {
  it("shows only the chosen name of a private profile", async () => {
    render(
      <ProfileView
        id="usr_2"
        load={vi
          .fn()
          .mockResolvedValue({
            id: "usr_2",
            publicName: "Luis M.",
            profilePublic: false,
          })}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Luis M." }),
    ).toBeInTheDocument();
    expect(screen.getByText("This profile is private.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows email and the lists a public profile shares", async () => {
    render(
      <ProfileView
        id="usr_1"
        load={vi.fn().mockResolvedValue({
          ...own(),
          profilePublic: true,
          likes: [photo("liked")],
          favorites: undefined,
        })}
      />,
    );
    expect(
      await screen.findByRole("link", { name: "ana@example.com" }),
    ).toHaveAttribute("href", "mailto:ana@example.com");
    expect(screen.getByRole("list", { name: "Likes" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Favorites" })).toBeNull();
  });

  it("says when the profile does not exist", async () => {
    render(
      <ProfileView id="x" load={vi.fn().mockRejectedValue(new Error())} />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This profile does not exist.",
    );
  });
});

describe("CommentAuthor", () => {
  it("links to the profile and describes it with the card", () => {
    render(
      <CommentAuthor
        id="cmt_1"
        name="Ana G."
        author={{
          id: "usr_1",
          publicName: "Ana G.",
          email: "ana@example.com",
          avatar: photo("a"),
          cover: null,
        }}
      />,
    );
    const link = screen.getByRole("link", { name: "Ana G." });
    expect(link).toHaveAttribute("href", "/profile/usr_1");
    expect(link).toHaveAccessibleDescription(/ana@example.com/);
  });
});

describe("PhotoReactions", () => {
  const counts = (overrides: Partial<Counts> = {}): Counts => ({
    likes: 2,
    liked: false,
    favorited: false,
    ...overrides,
  });

  it("shows the count signed out but offers nothing to press", async () => {
    withSession(
      <PhotoReactions
        photoId="pho_1"
        ports={{
          reactions: vi.fn().mockResolvedValue(counts()),
          react: vi.fn(),
        }}
      />,
      null,
    );
    const like = await screen.findByRole("button", { name: /Like/ });
    expect(like).toBeDisabled();
    expect(like).toHaveAttribute("title", "Sign in to like photographs");
    expect(screen.getByLabelText("2 likes")).toBeInTheDocument();
  });

  it("likes and saves with the answers the API gives back", async () => {
    const react = vi
      .fn()
      .mockResolvedValueOnce(counts({ likes: 3, liked: true }))
      .mockResolvedValueOnce(
        counts({ likes: 3, liked: true, favorited: true }),
      );
    withSession(
      <PhotoReactions
        photoId="pho_1"
        ports={{ reactions: vi.fn().mockResolvedValue(counts()), react }}
      />,
      ana,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Like/ })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: /Like/ }));
    expect(react).toHaveBeenLastCalledWith("pho_1", "like", true);
    expect(await screen.findByLabelText("3 likes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Save/ }));
    expect(react).toHaveBeenLastCalledWith("pho_1", "favorite", true);
    expect(
      await screen.findByRole("button", { name: /Saved/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the state when a reaction fails", async () => {
    withSession(
      <PhotoReactions
        photoId="pho_1"
        ports={{
          reactions: vi.fn().mockResolvedValue(counts()),
          react: vi.fn().mockRejectedValue(new Error("down")),
        }}
      />,
      ana,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Like/ })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: /Like/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That did not go through.",
    );
    expect(screen.getByLabelText("2 likes")).toBeInTheDocument();
  });
});
