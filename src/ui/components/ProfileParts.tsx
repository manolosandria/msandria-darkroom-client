"use client";

import Link from "next/link";
import { Photo } from "@/src/domain/entities/Photo";
import { ProfileCard } from "@/src/domain/entities/Profile";
import { PhotoImage } from "./PhotoImage";
import "./profiles.css";

export function ProfileAvatar({
  photo,
  small,
}: {
  photo: Photo | null;
  small?: boolean;
}) {
  return (
    <span
      className={`profile-avatar${small ? " profile-avatar--small" : ""}`}
      aria-hidden="true"
    >
      {photo && (
        <PhotoImage
          photo={photo}
          fallbackSizes={small ? "40px" : "88px"}
          maxWidth={320}
          crop={photo.getHighlights()?.square}
        />
      )}
    </span>
  );
}

/** A grid of square thumbnails, each opening its photo in the viewer. */
export function ProfilePhotos({
  photos,
  label,
}: {
  photos: Photo[];
  label: string;
}) {
  if (!photos.length)
    return <p className="text-sm text-gray-600">Nothing yet.</p>;
  return (
    <ul className="profile-photos" aria-label={label}>
      {photos.map((photo) => (
        <li key={photo.getId()}>
          <Link href={`/photo/${photo.getId()}`} aria-label={photo.getTitle()}>
            <PhotoImage
              photo={photo}
              fallbackSizes="120px"
              maxWidth={320}
              crop={photo.getHighlights()?.square}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * The author of a comment whose profile is public: the name links to the profile, and
 * pointing at it or focusing it shows the card with photo, cover, name and email.
 */
export function CommentAuthor({
  author,
  name,
  id,
}: {
  author: ProfileCard;
  name: string;
  id: string;
}) {
  const cardId = `author-card-${id}`;
  return (
    <span className="comment-author">
      <Link
        href={`/profile/${author.id}`}
        className="photo-comments__author"
        aria-describedby={cardId}
      >
        {name}
      </Link>
      <span id={cardId} role="tooltip" className="comment-author__card">
        <span className="comment-author__cover" aria-hidden="true">
          {author.cover && (
            <PhotoImage
              photo={author.cover}
              fallbackSizes="240px"
              maxWidth={640}
            />
          )}
        </span>
        <span className="comment-author__body">
          <ProfileAvatar photo={author.avatar} small />
          <span>
            <strong>{author.publicName ?? name}</strong>
            <span>{author.email}</span>
          </span>
        </span>
      </span>
    </span>
  );
}
