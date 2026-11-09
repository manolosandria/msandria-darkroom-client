"use client";
import { Photo } from "@/src/domain/entities/Photo";
import { photoDetails } from "@/src/ui/photoDetails";
import { HighlightView, highlightViews } from "@/src/ui/highlightViews";
import { PhotoImage } from "./PhotoImage";
import { PhotoComments } from "./PhotoComments";
import { PhotoReactions } from "./PhotoReactions";

interface PhotoInfoPanelProps {
  photo: Photo;
  onClose: () => void;
  /** The highlight the viewer shows instead of the whole photo, if any. */
  highlight?: string | null;
  onHighlightChange?: (key: string | null) => void;
}

// The viewer's side panel, a white column of its own beside the photo, top to bottom:
// title, description, the details recorded when the photo was taken and the comments.
// Ratings will go between the details and the comments when they exist.
export function PhotoInfoPanel({
  photo,
  onClose,
  highlight = null,
  onHighlightChange = () => {},
}: PhotoInfoPanelProps) {
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
        <PhotoReactions photoId={photo.getId()} photo={photo} />
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

      <PhotoHighlightsSection
        photo={photo}
        open={highlight}
        onChoose={onHighlightChange}
      />

      <PhotoComments key={photo.getId()} photoId={photo.getId()} />
    </aside>
  );
}

// The crops the photographer chose for the thumbnails, each in its own shape. Choosing
// one shows it in the viewer instead of the whole photo; choosing it again brings the
// whole photo back.
function PhotoHighlightsSection({
  photo,
  open,
  onChoose,
}: {
  photo: Photo;
  open: string | null;
  onChoose: (key: string | null) => void;
}) {
  const views = highlightViews(photo.getHighlights());
  if (!views.length) return null;
  const ratio = (view: HighlightView) =>
    (photo.getAspectRatio() * view.crop.width) / view.crop.height;
  return (
    <section aria-label="Highlights" className="photo-viewer__panel-section">
      <h3 className="photo-viewer__panel-heading">Highlights</h3>
      <ul className="photo-viewer__highlights">
        {views.map((view) => (
          <li key={view.key}>
            <button
              type="button"
              aria-pressed={open === view.key}
              aria-label={
                open === view.key
                  ? `Show the whole photo instead of the ${view.label} highlight`
                  : `Show the ${view.label} highlight in the viewer`
              }
              onClick={() => onChoose(open === view.key ? null : view.key)}
            >
              <span
                className="photo-viewer__highlight-image"
                style={{ aspectRatio: `${ratio(view)}` }}
              >
                <PhotoImage
                  photo={photo}
                  maxWidth={320}
                  fallbackSizes="96px"
                  className="object-cover"
                  crop={view.crop}
                />
              </span>
              <small>{view.label}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
