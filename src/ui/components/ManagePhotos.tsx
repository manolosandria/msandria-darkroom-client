"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Photo } from "@/src/domain/entities/Photo";
import { getAllPhotos, savePhoto } from "@/src/infrastructure/photoServices";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import { messageFor } from "@/src/ui/hooks/usePhotoUpload";
import { ErrorMessage } from "./ErrorMessage";
import { HighlightEditor } from "./HighlightEditor";
import { useSessionValue } from "./SessionProvider";

const loadPhotos = () => getAllPhotos.execute();

export default function ManagePhotos() {
  const session = useSessionValue();
  return (
    <main className="upload-workspace">
      <div className="upload-container">
        <div className="upload-heading">
          <span className="upload-eyebrow">THE DARKROOM / MANAGE</span>
          <h1>Refine your photographs.</h1>
          <p>Edit titles, stories, and the details that fill each thumbnail.</p>
        </div>
        <Link href="/upload" className="upload-link">
          ← Upload photos
        </Link>
        {session.loading ? (
          <p role="status">Loading session…</p>
        ) : session.error ? (
          <ErrorMessage message={session.error} onRetry={session.reload} />
        ) : session.user?.isAdmin() ? (
          <PhotoLibrary />
        ) : (
          <p>Sign in as the gallery&apos;s administrator to manage photos.</p>
        )}
      </div>
    </main>
  );
}

function PhotoLibrary() {
  const { data, loading, error, retry } = usePhotoFetch(
    loadPhotos,
    "No photos published yet.",
  );
  const [selected, setSelected] = useState<Photo | null>(null);
  const [revisions, setRevisions] = useState<Record<string, Photo>>({});
  if (loading) return <p role="status">Loading photographs…</p>;
  if (error) return <ErrorMessage message={error} onRetry={retry} />;
  return (
    <div className="manage-layout">
      <nav className="manage-library" aria-label="Published photos">
        {data?.map((original) => {
          const photo = revisions[original.getId()] ?? original;
          return (
            <button
              type="button"
              key={photo.getId()}
              aria-pressed={selected?.getId() === photo.getId()}
              onClick={() => setSelected(photo)}
            >
              <span className="manage-thumbnail">
                <Image
                  src={photo.urlForWidth(320)}
                  alt=""
                  width={photo.getWidth()}
                  height={photo.getHeight()}
                  unoptimized
                  sizes="64px"
                  style={thumbnailStyle(photo)}
                />
              </span>
              <span>{photo.getTitle()}</span>
            </button>
          );
        })}
      </nav>
      {selected ? (
        <PhotoEditor
          key={selected.getId()}
          photo={selected}
          onSaved={(updated) => {
            setSelected(updated);
            setRevisions((previous) => ({
              ...previous,
              [updated.getId()]: updated,
            }));
          }}
        />
      ) : (
        <p className="upload-muted">
          Select a photograph to edit its details and highlights.
        </p>
      )}
    </div>
  );
}

function thumbnailStyle(photo: Photo): React.CSSProperties {
  const crop = photo.getHighlights().square;
  if (!crop)
    return {
      position: "absolute",
      width: "100%",
      height: "100%",
      objectFit: "cover",
    };
  return {
    position: "absolute",
    maxWidth: "none",
    width: `${100 / crop.width}%`,
    height: `${100 / crop.height}%`,
    left: `${(-crop.x / crop.width) * 100}%`,
    top: `${(-crop.y / crop.height) * 100}%`,
    right: "auto",
    bottom: "auto",
  };
}

function PhotoEditor({
  photo,
  onSaved,
}: {
  photo: Photo;
  onSaved: (photo: Photo) => void;
}) {
  const [title, setTitle] = useState(photo.getTitle());
  const [description, setDescription] = useState(photo.getDescription() ?? "");
  const [highlights, setHighlights] = useState(photo.getHighlights());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="upload-card manage-editor"
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        if (!title.trim()) {
          setError("Give the photograph a title before saving.");
          return;
        }
        setSaving(true);
        setError("");
        setSaved(false);
        try {
          const updated = new Photo({
            id: photo.getId(),
            title,
            description,
            highlights,
            width: photo.getWidth(),
            height: photo.getHeight(),
            renditions: photo.getRenditions(),
            metadata: photo.getMetadata(),
            createdAt: photo.getCreatedAt(),
          });
          await savePhoto.execute(updated);
          setSaved(true);
          onSaved(updated);
        } catch (failure) {
          setError(messageFor(failure));
        } finally {
          setSaving(false);
        }
      }}
    >
      <fieldset className="upload-fields" disabled={saving}>
        <label>
          Title
          <input
            required
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setSaved(false);
            }}
          />
        </label>
        <HighlightEditor
          src={photo.urlForWidth(1280)}
          width={photo.getWidth()}
          height={photo.getHeight()}
          value={highlights}
          onChange={(next) => {
            setHighlights(next);
            setSaved(false);
          }}
          disabled={saving}
        />
        {error && (
          <p role="alert" className="upload-error">
            {error}
          </p>
        )}
        {saved && <p role="status">Changes saved.</p>}
        <button type="submit" className="upload-primary">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </fieldset>
    </form>
  );
}
