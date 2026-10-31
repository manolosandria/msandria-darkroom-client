"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Photo } from "@/src/domain/entities/Photo";
import { OwnProfile, ProfileChanges } from "@/src/domain/entities/Profile";
import { ProfilePhotoError } from "@/src/domain/errors/ProfilePhotoError";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { manageProfile } from "@/src/infrastructure/profileServices";
import { browsePhotos } from "@/src/infrastructure/photoServices";
import { rateLimitMessage } from "@/src/ui/rateLimitMessage";
import { PhotoImage } from "./PhotoImage";
import { ProfileAvatar, ProfilePhotos } from "./ProfileParts";
import "./profiles.css";

export type ProfilePorts = {
  mine: () => Promise<OwnProfile>;
  update: (changes: ProfileChanges) => Promise<OwnProfile>;
  /** Photographs of the public gallery to choose the photo and cover from. */
  galleryPhotos: (search: string) => Promise<Photo[]>;
};

const defaultPorts: ProfilePorts = {
  mine: () => manageProfile.mine(),
  update: (changes) => manageProfile.update(changes),
  galleryPhotos: async (search) =>
    (
      await browsePhotos.execute({
        limit: 24,
        seed: "profile",
        ...(search.trim() && { search: search.trim() }),
      })
    ).tiles.map((tile) => tile.photo),
};

type PrivacyKey = "profilePublic" | "likesPublic" | "favoritesPublic";
const PRIVACY: { key: PrivacyKey; label: string; hint: string }[] = [
  {
    key: "profilePublic",
    label: "Public profile",
    hint: "Others see your photo, cover and email, and your comments link here. Off, they see only your public name.",
  },
  {
    key: "likesPublic",
    label: "Show my likes",
    hint: "Listed on your public profile.",
  },
  {
    key: "favoritesPublic",
    label: "Show my favorites",
    hint: "Listed on your public profile.",
  },
];

type PhotoField = "avatarPhotoId" | "coverPhotoId";

/**
 * `/account` → Profile: who sees what, the profile photo and cover (only from the
 * public gallery), and the visitor's own likes and favorites.
 */
export function ProfileSettings({
  ports = defaultPorts,
}: {
  ports?: ProfilePorts;
}) {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState<PhotoField | null>(null);

  useEffect(() => {
    ports
      .mine()
      .then(setProfile)
      .catch(() => setError("Your profile could not be loaded."));
  }, [ports]);

  const save = async (changes: ProfileChanges) => {
    setSaving(true);
    setError("");
    try {
      setProfile(await ports.update(changes));
      setPicking(null);
    } catch (caught) {
      setError(
        caught instanceof RateLimitError
          ? rateLimitMessage(caught)
          : caught instanceof ProfilePhotoError
            ? caught.message
            : "Your profile could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="upload-card p-6 md:p-8 max-w-3xl space-y-5"
      aria-label="Profile"
    >
      <h2 className="text-xl font-semibold">Profile</h2>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!profile ? (
        !error && <p role="status">Loading profile…</p>
      ) : (
        <>
          <div>
            <div className="profile-cover">
              {profile.cover && (
                <PhotoImage
                  photo={profile.cover}
                  fallbackSizes="720px"
                  maxWidth={1280}
                />
              )}
            </div>
            <div className="profile-header">
              <ProfileAvatar photo={profile.avatar} />
              <Link href={`/profile/${profile.id}`} className="upload-link">
                See your profile as others do
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {(["avatarPhotoId", "coverPhotoId"] as const).map((field) => {
              const label = field === "avatarPhotoId" ? "photo" : "cover";
              const current =
                field === "avatarPhotoId" ? profile.avatar : profile.cover;
              return (
                <span key={field} className="flex gap-2">
                  <button
                    type="button"
                    className="upload-secondary"
                    aria-expanded={picking === field}
                    disabled={saving}
                    onClick={() => setPicking(picking === field ? null : field)}
                  >
                    Choose {label}
                  </button>
                  {current && (
                    <button
                      type="button"
                      className="upload-secondary"
                      disabled={saving}
                      onClick={() => save({ [field]: null })}
                    >
                      Remove {label}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          {picking && (
            <GalleryPicker
              label={
                picking === "avatarPhotoId"
                  ? "Choose your photo"
                  : "Choose your cover"
              }
              load={ports.galleryPhotos}
              disabled={saving}
              onPick={(photo) => save({ [picking]: photo.getId() })}
            />
          )}
          <fieldset className="space-y-3" disabled={saving}>
            <legend className="font-medium">Who sees what</legend>
            {PRIVACY.map(({ key, label, hint }) => (
              <label key={key} className="flex gap-3 items-start">
                <input
                  type="checkbox"
                  checked={profile[key]}
                  disabled={key !== "profilePublic" && !profile.profilePublic}
                  onChange={(event) => save({ [key]: event.target.checked })}
                />
                <span>
                  <span className="block">{label}</span>
                  <span className="block text-sm text-gray-600">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <h3 className="font-medium">Your likes</h3>
          <ProfilePhotos photos={profile.likes} label="Your likes" />
          <h3 className="font-medium">Your favorites</h3>
          <ProfilePhotos photos={profile.favorites} label="Your favorites" />
        </>
      )}
    </section>
  );
}

function GalleryPicker({
  label,
  load,
  disabled,
  onPick,
}: {
  label: string;
  load: ProfilePorts["galleryPhotos"];
  disabled: boolean;
  onPick: (photo: Photo) => void;
}) {
  const [search, setSearch] = useState("");
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  useEffect(() => {
    let live = true;
    // Typing waits a moment, as Gallery's search does, before asking again.
    const timer = setTimeout(() => {
      load(search)
        .then((next) => live && setPhotos(next))
        .catch(() => live && setPhotos([]));
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [load, search]);
  return (
    <div role="group" aria-label={label} className="space-y-3">
      <input
        type="search"
        aria-label="Search the gallery"
        placeholder="Search the gallery"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="w-full rounded border px-3 py-2"
      />
      {photos === null ? (
        <p role="status">Loading photographs…</p>
      ) : photos.length ? (
        <ul className="profile-photos">
          {photos.map((photo) => (
            <li key={photo.getId()}>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Use ${photo.getTitle()}`}
                onClick={() => onPick(photo)}
              >
                <PhotoImage
                  photo={photo}
                  fallbackSizes="120px"
                  maxWidth={320}
                  crop={photo.getHighlights()?.square}
                />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-600">No public photographs match.</p>
      )}
    </div>
  );
}
