import { Photo } from "./Photo";

/**
 * What a comment shows of its author when their profile is public: a link to the
 * profile and a card with name, email, photo and cover. With a private profile the API
 * sends none of it, only the name the comment was signed with.
 */
export type ProfileCard = {
  id: string;
  publicName: string | null;
  email: string;
  avatar: Photo | null;
  cover: Photo | null;
};

/** Someone else's profile. A private one says only the name they chose. */
export type PublicProfile =
  | { id: string; publicName: string | null; profilePublic: false }
  | (ProfileCard & {
      profilePublic: true;
      // Present only when the person made each list public.
      likes?: Photo[];
      favorites?: Photo[];
    });

/** The signed-in visitor's own profile, with both lists whatever their privacy. */
export type OwnProfile = ProfileCard & {
  profilePublic: boolean;
  likesPublic: boolean;
  favoritesPublic: boolean;
  likes: Photo[];
  favorites: Photo[];
};

/** Omitting a field keeps it; null removes the photo. */
export type ProfileChanges = Partial<{
  profilePublic: boolean;
  likesPublic: boolean;
  favoritesPublic: boolean;
  avatarPhotoId: string | null;
  coverPhotoId: string | null;
}>;

export type PhotoReactions = {
  likes: number;
  liked: boolean;
  favorited: boolean;
};
export type Reaction = "like" | "favorite";
