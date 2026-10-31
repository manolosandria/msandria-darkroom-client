"use client";
import { Photo } from "@/src/domain/entities/Photo";
import { photoDetails } from "@/src/ui/photoDetails";
import { PhotoComments } from "./PhotoComments";
import { PhotoReactions } from "./PhotoReactions";

interface PhotoInfoPanelProps {
  photo: Photo;
  onClose: () => void;
}

// The viewer's side panel, a white column of its own beside the photo, top to bottom:
// title, description, the details recorded when the photo was taken and the comments.
// Ratings will go between the details and the comments when they exist.
export function PhotoInfoPanel({ photo, onClose }: PhotoInfoPanelProps) {
  const description = photo.getDescription();
  const details = photoDetails(photo.getMetadata());

  return (
    <aside aria-label="Photo information" data-viewer-panel className="photo-viewer__panel">
      <header className="photo-viewer__panel-header">
        <h2 className="photo-viewer__panel-title">{photo.getTitle()}</h2>
        <button
          type="button"
          aria-label="Close photo information"
          onClick={onClose}
          className="photo-viewer__panel-close"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
            <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {description && (
        <section className="photo-viewer__panel-section">
          <p className="whitespace-pre-line leading-relaxed">{description}</p>
        </section>
      )}

      <section className="photo-viewer__panel-section">
        <PhotoReactions photoId={photo.getId()} />
      </section>

      <section aria-label="Details" className="photo-viewer__panel-section">
        <h3 className="photo-viewer__panel-heading">Details</h3>
        {details.length > 0 ? (
          <dl className="photo-viewer__details">
            {details.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-neutral-500">No camera details were recorded for this photo.</p>
        )}
      </section>

      <PhotoComments key={photo.getId()} photoId={photo.getId()} />
    </aside>
  );
}
